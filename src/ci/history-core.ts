// The history-audit PURE core (T-034-01) — the addon-free heart of E-034's post-hoc "every commit was
// test-green" audit. The fourth layer of the commit-discipline frame, after E-008 (`check:committed`,
// source is committed), E-010 (`check:head`, committed HEAD builds), and E-033 (`check:precommit`, tests
// pass at the commit being made). E-033 gates FORWARD at the pre-commit seam; E-034 audits BACKWARD over
// a range — catching a red commit that slipped in via `--no-verify`, an uninstalled hook, or a rebase.
//
// THE CENTRAL RULE (ci-strategy.md): check *logic* lives here in the app repo; the trigger (the T-034-02
// `check-history.ts` sweep + `check:history` script) is the thin impure verb that gathers the per-commit
// results and the raw sha list and feeds them in. This module IS that logic — the single source of "what
// a set of per-commit outcomes MEANS for the audit verdict," and "what a bound drops."
//
// PURE/TOTAL: every export takes plain data and returns fresh values — no Bun.spawn, no git, no fs, no
// clock, no network, no process. The IMPURE verbs (run `git rev-list`, build each commit in an isolated
// worktree, run the tests, exit) live in T-034-02. This keeps history-core.test.ts an ordinary
// pure-function test, the same discipline committed-core / head-build-core / precommit-core / press-core /
// gates / decompose-epic-core follow.
//
// MIRRORS head-build-core.ts, one level UP: head-build-core classifies ONE build outcome; this aggregates
// MANY already-classified per-commit verdicts. So it does NOT import BuildOutcome — the sweep flattens each
// build result to a `green` boolean + an optional failure `summary` row before handing them here.
//
// HOUSE RULE (committed-core.ts / budget.ts): an offending input is RETURNED data, never thrown. "Some
// commits are red," "the range is empty," and "the bound dropped commits" are all expected outcomes,
// modelled as data. There is no throw in this module.

// ── classifyHistory ────────────────────────────────────────────────────────────────────────────

/**
 * One per-commit outcome — DATA the impure sweep reports, deciding nothing. The sweep fills these by
 * building each commit in an isolated worktree and reusing head-build-core's `classifyBuildOutcome`:
 * `green = outcome.failedStep === null`, `summary` = the failure tail for a red commit. This module only
 * cares "green or not" + the failure context to NAME a red commit — never the build-step internals.
 */
export interface CommitResult {
  /** The commit id, rendered verbatim (short or full — the core never resolves it). */
  sha: string;
  /** The commit subject line (`git log -1 --format=%s`). */
  subject: string;
  /** `true` = tests passed at this commit; `false` = red. */
  green: boolean;
  /** Failure context for a red commit — the E-008 "name the failure" tail. Optional; may be absent. */
  summary?: string;
}

/** The classified audit verdict: did any commit fail, how many, and the line(s) the caller prints. */
export interface HistoryVerdict {
  /** `true` iff at least one commit is red. Derived as `redCount > 0` — no parallel field to desync. */
  anyRed: boolean;
  redCount: number;
  /** The full human-readable audit text the impure caller prints verbatim. */
  report: string;
}

/**
 * Render the failure suffix for a red commit's report line. PURE/TOTAL. Returns `""` when the summary is
 * absent or blank (so a missing summary yields a bare `<sha> <subject>` line, never `: undefined`), else
 * `": " + summary` with internal whitespace collapsed so a multi-line captured tail stays one line.
 * Mirrors precommit-core's `tail`.
 */
function summarySuffix(summary: string | undefined): string {
  const s = (summary ?? "").trim();
  return s === "" ? "" : `: ${s.replace(/\s+/g, " ")}`;
}

/**
 * Classify a list of per-commit {@link CommitResult}s into a {@link HistoryVerdict}. PURE/TOTAL — the
 * whole of the audit's judgment. Three mutually-exclusive, exhaustive report shapes (tsc proves each
 * branch returns a complete verdict):
 *  - EMPTY range      → an HONEST-EMPTY line ("no commits in range"), never a misleading "all green".
 *  - all GREEN        → a one-line tally.
 *  - some RED         → a header naming the count, one line per red commit (sha + subject + failure
 *                       summary, the E-008 "name the failure" style, in INPUT ORDER so the chronological
 *                       signal survives), then a tally footer.
 * Greens are not listed individually — the audit surfaces reds (cf. committed-core emitting only offenders).
 * The caller exits non-zero iff `anyRed`.
 */
export function classifyHistory(results: readonly CommitResult[]): HistoryVerdict {
  const total = results.length;
  const reds = results.filter((r) => !r.green);
  const redCount = reds.length;

  if (total === 0) {
    return { anyRed: false, redCount: 0, report: "history: no commits in range — nothing to audit" };
  }
  if (redCount === 0) {
    return { anyRed: false, redCount: 0, report: `history: ok — all ${total} commit(s) test-green` };
  }
  const lines = [
    `history: ANDON — ${redCount} of ${total} commit(s) are red:`,
    ...reds.map((r) => `  ${r.sha} ${r.subject}${summarySuffix(r.summary)}`),
    `history: ${redCount} of ${total} commit(s) red — audit failed`,
  ];
  return { anyRed: true, redCount, report: lines.join("\n") };
}

// ── boundRange ─────────────────────────────────────────────────────────────────────────────────

/**
 * The default cap on how many commits a single audit sweep covers — the R12 SHARED CONTRACT (cf.
 * committed-core's SOURCE_PREFIXES, precommit-core's HOOKS_DIR). The impure T-034-02 caller derives the
 * default from THIS export and never re-literals the number. Widening the default later is a one-line edit.
 */
export const DEFAULT_HISTORY_MAX = 100;

/** Bounding options for {@link boundRange}. */
export interface BoundOpts {
  /** Cap on commits to sweep. Defaults to {@link DEFAULT_HISTORY_MAX}; non-positive covers nothing. */
  max?: number;
  /** Caller's range token surfaced in the widen nudge, e.g. `"--max 500"` or `"origin/main..HEAD"`. */
  widenHint?: string;
}

/** The bounded subset to sweep + how many were dropped + a note that is always truthful about coverage. */
export interface RangeBound {
  /** The commits to actually sweep — a fresh prefix of `allShas` (never an alias of the input). */
  covered: string[];
  /** How many commits the bound dropped; `0` when everything fit. */
  droppedCount: number;
  /** Always non-empty. LOUD (`covered N of M (bounded at K …)`) iff `droppedCount > 0`; quiet otherwise. */
  note: string;
}

/**
 * Bound the full resolved commit list to the commits a single sweep will cover. PURE/TOTAL. The
 * NO-SILENT-CAP heart of the audit: a cap that silently audited 20 of 200 commits and let the caller
 * print "all green" would be a lie — so when commits are dropped the `note` LOUDLY states
 * `covered N of M (bounded at K — widen with <hint>)`. When nothing is dropped the note quietly confirms
 * full coverage, so the caller can always print something truthful and never fabricates it.
 *
 * `max` resolution: `undefined` → {@link DEFAULT_HISTORY_MAX}; otherwise floored and clamped to ≥ 0 (a
 * negative or fractional bound is an expected, handled input — returned data, never thrown). `max: 0`
 * legitimately covers nothing (a dry-run count).
 */
export function boundRange(allShas: readonly string[], opts?: BoundOpts): RangeBound {
  const max =
    opts?.max === undefined ? DEFAULT_HISTORY_MAX : Math.max(0, Math.floor(opts.max));
  const covered = allShas.slice(0, max);
  const total = allShas.length;
  const droppedCount = total - covered.length;

  if (droppedCount > 0) {
    const hint = opts?.widenHint && opts.widenHint.trim() !== "" ? opts.widenHint : "a higher --max";
    return {
      covered: [...covered],
      droppedCount,
      note: `history: covered ${covered.length} of ${total} (bounded at ${max} — widen with ${hint})`,
    };
  }
  return {
    covered: [...covered],
    droppedCount: 0,
    note: `history: covered all ${total} commit(s) (within bound ${max})`,
  };
}
