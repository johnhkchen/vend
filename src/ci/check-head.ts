// `bun run check:head` entry (T-010-01) — the thin IMPURE verb of the "committed HEAD builds"
// gate (E-010). Mirrors check-committed.ts's `import.meta.main` shell: it does the side effects
// (spawn git, materialize a worktree, run the build, write stderr, exit the process) and delegates
// ALL judgment to the pure core in head-build-core.ts.
//
// THE CENTRAL RULE (ci-strategy.md): this is a `check:*` script in the app repo. The T-010-02 lisa
// on-clear hook is the trigger that invokes it (NOT on-stop — a full HEAD build every turn is
// catastrophic latency; settled at E-010 decompose); the definition of "good" lives in
// head-build-core.ts, never in the hook. It runs on the HOST (it needs the real `.git` object
// store to spin up the worktree), which is why E-010 enforces here, not in a Dagger container.
//
// THE MECHANISM (settled E-010 boundary: git worktree, NOT Docker — P5 local-first): materialize
// the committed HEAD in an isolated worktree (`git worktree add --detach <tmp> HEAD`), run the
// app `check` (baml:gen → typecheck → test) against THAT clean tree, capture the exit, and remove
// the worktree IN EVERY PATH (success / fail / error) so nothing leaks. Because the worktree has
// no working-tree files, a partial-but-committed HEAD (E-007's cast.ts-without-play.ts) can no
// longer be masked by an uncommitted dependency the way the in-place `check` is.
//
// `buildCommittedHead` is the integration-test seam (head-build-core.test.ts drives it against a
// synthetic broken/clean HEAD); the `import.meta.main` block below is smoke-only, like the cli
// dispatch block.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BuildOutcome, buildStepFailed, classifyBuildOutcome } from "./head-build-core.ts";

export interface HeadBuildOptions {
  /** Repo whose committed HEAD to build. The real toplevel is resolved via `git rev-parse`. */
  root: string;
  /**
   * The commit-ish to materialize in the worktree. Default `"HEAD"` — so every existing caller
   * (and `check:head`) is unchanged. T-034-02's history sweep passes an arbitrary sha to build any
   * commit in range. The `vend-head-` temp prefix is retained for any commit-ish (it names the
   * builder, not the commit).
   */
  commitish?: string;
  /**
   * Install command run in the worktree before the build; `null` SKIPS it. Default
   * `["bun", "install"]`. The integration test passes `null` (its synthetic repo has no deps),
   * keeping every test run offline and sub-second.
   */
  install?: readonly string[] | null;
  /** The build/check command run in the worktree. Default `["bun", "run", "check"]`. */
  check?: readonly string[];
}

/** Trimmed tail of captured output, for the verdict message. Keeps the last `max` chars. */
function tail(text: string, max = 500): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `…${trimmed.slice(-max)}` : trimmed;
}

/**
 * Materialize a committed commit-ish (default `HEAD`) in an isolated git worktree, run install+check
 * there, and report a {@link BuildOutcome}. IMPURE (spawns git/bun, touches the fs). Removes the
 * worktree and its temp parent in ALL paths via `finally` — no leak on success, failure, or error.
 * Decides nothing: classification is {@link classifyBuildOutcome}'s job. With the default commit-ish
 * this is the E-010 `check:head` builder unchanged; with an arbitrary sha it is T-034-02's per-commit
 * history-audit builder.
 */
export async function buildCommittedHead(opts: HeadBuildOptions): Promise<BuildOutcome> {
  const install = opts.install === undefined ? (["bun", "install"] as const) : opts.install;
  const check = opts.check ?? (["bun", "run", "check"] as const);
  const commitish = opts.commitish ?? "HEAD";

  // ── preflight: resolve the repo toplevel (also proves it is a git repo) ──────────────────────
  const top = Bun.spawnSync(["git", "-C", opts.root, "rev-parse", "--show-toplevel"]);
  if (top.exitCode !== 0) {
    return { failedStep: "preflight", detail: tail(top.stderr.toString()) || "not a git repository" };
  }
  const repoTop = top.stdout.toString().trim();

  // ── worktree add: a fresh, isolated checkout of HEAD ─────────────────────────────────────────
  // mkdtemp makes the PARENT; `git worktree add` requires its target to NOT pre-exist, so the
  // worktree lands in a `head` subdir git creates itself.
  const parent = await mkdtemp(join(tmpdir(), "vend-head-"));
  const worktree = join(parent, "head");
  const added = Bun.spawnSync(["git", "-C", repoTop, "worktree", "add", "--detach", worktree, commitish]);
  if (added.exitCode !== 0) {
    await rm(parent, { recursive: true, force: true });
    return { failedStep: "worktree", detail: tail(added.stderr.toString()) || "worktree add failed" };
  }

  try {
    // ── install (optional) ─────────────────────────────────────────────────────────────────────
    if (install) {
      const ran = Bun.spawnSync([...install], { cwd: worktree });
      if (buildStepFailed(ran.exitCode)) {
        return { failedStep: "build", detail: tail(ran.stderr.toString() + ran.stdout.toString()) };
      }
    }
    // ── build/check against the clean HEAD tree ─────────────────────────────────────────────────
    const ran = Bun.spawnSync([...check], { cwd: worktree });
    if (buildStepFailed(ran.exitCode)) {
      return { failedStep: "build", detail: tail(ran.stderr.toString() + ran.stdout.toString()) };
    }
    return { failedStep: null, detail: "" };
  } finally {
    // Remove the worktree in EVERY path. Best-effort: cleanup never throws past this block.
    Bun.spawnSync(["git", "-C", repoTop, "worktree", "remove", "--force", worktree]);
    await rm(parent, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const outcome = await buildCommittedHead({ root: process.cwd() });
  const verdict = classifyBuildOutcome(outcome);
  (verdict.ok ? process.stdout : process.stderr).write(verdict.message + "\n");
  process.exit(verdict.exitCode);
}
