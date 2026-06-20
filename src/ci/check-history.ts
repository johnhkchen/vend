// `bun run check:history [<range>]` entry (T-034-02) — the thin IMPURE verb of E-034's post-hoc
// "every commit was test-green" audit. The backward-looking complement to E-033's forward pre-commit
// gate: E-033 stops a red commit at the seam where it is made; this sweeps a RANGE of already-made
// commits and flags any red one that slipped in via `--no-verify`, an uninstalled hook, or a rebase.
//
// THE CENTRAL RULE (ci-strategy.md): check *logic* lives in the pure core — here `history-core.ts`
// (`classifyHistory` + `boundRange`, T-034-01). This file is only the trigger: it gathers the raw
// inputs (the resolved sha list, each commit's build outcome) and feeds them in. It owns the side
// effects (spawn git, materialize worktrees, build, write streams, exit) and delegates ALL judgment
// to the pure core, exactly as check-committed.ts / check-head.ts do for their gates.
//
// THE MECHANISM: resolve the range with `git rev-list`, bound it with `boundRange` (NO silent cap —
// a dropped commit is stated loudly), build+test EACH commit in a fresh isolated worktree by reusing
// E-010's `buildCommittedHead` generalized to a commit-ish (cleaned up in every path — no
// working-tree disturbance, no leak), flatten each `BuildOutcome` via `classifyBuildOutcome` into a
// `CommitResult`, then let `classifyHistory` render the verdict. It runs on the HOST (it needs the
// real `.git` object store for worktrees), like check-head. Sequential — parallelism is a non-goal.
//
// EXIT VOCABULARY (sibling-consistent with check-committed / check-head): 0 = clean (every covered
// commit test-green, OR an honest-empty range); 1 = ANDON (at least one covered commit is red — the
// audit's reason to exist); 2 = environment error (git missing / not a repo / rev-list failed) —
// kept DISTINCT from a red commit so a caller can tell "couldn't audit" from "found a red commit."
//
// `sweepCommits` is the integration-test seam (check-history.test.ts drives it against a synthetic
// multi-commit repo, `install: null`, offline); the `import.meta.main` block is smoke-only, proven
// by the live AC#3 run, like check-head's main block.

import { buildCommittedHead } from "./check-head.ts";
import { classifyBuildOutcome } from "./head-build-core.ts";
import { type CommitResult, boundRange, classifyHistory } from "./history-core.ts";

/**
 * Parse the CLI tail (`check:history [<range>] [--max <n>]`). PURE — argv in, options out, deciding
 * nothing else. The first non-flag token is the range (default handled by {@link resolveRange}); the
 * cap echoes `boundRange`'s `max` knob the widen-hint advertises. An absent/garbage `--max` leaves
 * `max` undefined so `boundRange` falls back to `DEFAULT_HISTORY_MAX`.
 */
export function parseArgs(argv: readonly string[]): { range?: string; max?: number } {
  let range: string | undefined;
  let max: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--max") {
      const n = Number(argv[++i]);
      if (Number.isFinite(n)) max = n;
    } else if (arg.startsWith("--max=")) {
      const n = Number(arg.slice("--max=".length));
      if (Number.isFinite(n)) max = n;
    } else if (!arg.startsWith("-") && range === undefined) {
      range = arg;
    }
  }
  return { range, max };
}

/** Trimmed tail of captured output for an error message. Keeps the last `max` chars. */
function tail(text: string, max = 300): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `…${trimmed.slice(-max)}` : trimmed;
}

/**
 * Resolve a git range token to an ORDERED sha list (newest-first, as `git rev-list` emits) via
 * `git -C <root> rev-list <range>`. IMPURE. Returns `{ shas }` on success or `{ error }` on a
 * non-zero git exit (not a repo, bad range) — the caller maps `error` to exit 2. The default token
 * is `"HEAD"` (all reachable commits, then capped by {@link boundRange} to the most recent N), which
 * is the "sensible bound / last-N" default the ticket calls for — `main..HEAD` would be empty on
 * `main` itself.
 */
export function resolveRange(
  root: string,
  range?: string,
): { shas: string[] } | { error: string } {
  const token = range && range.trim() !== "" ? range : "HEAD";
  const out = Bun.spawnSync(["git", "-C", root, "rev-list", token]);
  if (out.exitCode !== 0) {
    return { error: tail(out.stderr.toString()) || `git rev-list ${token} failed` };
  }
  const shas = out.stdout
    .toString()
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  return { shas };
}

/** Options for {@link sweepCommits}. `install`/`check` mirror {@link buildCommittedHead}'s knobs. */
export interface HistorySweepOptions {
  /** Repo to audit (its toplevel is resolved inside `buildCommittedHead`). */
  root: string;
  /** The ordered, already-bounded commit shas to build+test, one isolated worktree each. */
  shas: readonly string[];
  /** Install command per worktree; `null` skips it (offline tests). Default `["bun", "install"]`. */
  install?: readonly string[] | null;
  /**
   * The build/check command per worktree. Default (via `buildCommittedHead`) `["bun", "run",
   * "check"]` — `baml:gen → typecheck → test`, so a fresh checkout is valid (codegen included).
   */
  check?: readonly string[];
}

/**
 * Build+test each commit in `shas`, in order, in a fresh isolated worktree, and flatten each result
 * to a `history-core` {@link CommitResult}. IMPURE (spawns git/bun via `buildCommittedHead`). The
 * integration seam: it gathers data, deciding nothing — `green`/`summary` come straight from
 * {@link classifyBuildOutcome}, and the audit verdict is {@link classifyHistory}'s job. Sequential
 * (parallelism is a ticket non-goal); cost ≈ worktree + install + build per commit, by design (this
 * is a periodic/CI audit, not the hot path).
 */
export async function sweepCommits(opts: HistorySweepOptions): Promise<CommitResult[]> {
  const results: CommitResult[] = [];
  for (const sha of opts.shas) {
    const subjOut = Bun.spawnSync(["git", "-C", opts.root, "log", "-1", "--format=%s", sha]);
    const subject = subjOut.exitCode === 0 ? subjOut.stdout.toString().trim() : "(unknown subject)";
    const outcome = await buildCommittedHead({
      root: opts.root,
      commitish: sha,
      install: opts.install,
      check: opts.check,
    });
    const verdict = classifyBuildOutcome(outcome);
    results.push({
      sha,
      subject,
      green: verdict.ok,
      summary: verdict.ok ? undefined : verdict.message,
    });
  }
  return results;
}

if (import.meta.main) {
  // Resolve the repo root so the audit is correct regardless of where `bun run` was invoked.
  const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
  if (top.exitCode !== 0) {
    process.stderr.write(`check:history: not a git repository (${top.stderr.toString().trim()})\n`);
    process.exit(2);
  }
  const root = top.stdout.toString().trim();

  const { range, max } = parseArgs(process.argv.slice(2));
  const resolved = resolveRange(root, range);
  if ("error" in resolved) {
    process.stderr.write(`check:history: could not resolve range (${resolved.error})\n`);
    process.exit(2);
  }

  // Bound the range loudly — never silently audit a subset and report "all green".
  const bound = boundRange(resolved.shas, {
    max,
    widenHint: "a higher --max (or a narrower range)",
  });
  process.stdout.write(bound.note + "\n");

  const results = await sweepCommits({ root, shas: bound.covered });
  const verdict = classifyHistory(results);
  (verdict.anyRed ? process.stderr : process.stdout).write(verdict.report + "\n");
  process.exit(verdict.anyRed ? 1 : 0);
}
