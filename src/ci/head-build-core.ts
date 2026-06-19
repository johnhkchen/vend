// The `check:head` PURE classifier (T-010-01) — the addon-free heart of the
// "done means committed AND builds" gate (E-010), the build-soundness companion to E-008's
// commit-completeness gate.
//
// THE CENTRAL RULE (ci-strategy.md): check *logic* lives here in the app repo, behind a
// `bun run check:*` script; the trigger (the lisa on-clear hook, T-010-02) is a thin shell
// that only invokes it. This classifier IS that logic — the single source of "what a HEAD
// build outcome MEANS for the process exit." The one IMPURE verb (materialize HEAD in a git
// worktree, run the build, exit the process) lives in check-head.ts.
//
// PURE: every export takes plain data and returns fresh values — no fs, git, clock, network, or
// process. This keeps head-build-core.test.ts an ordinary pure-function test, the same
// discipline committed-core / press-core / gates / decompose-epic-core follow.
//
// EXIT VOCABULARY (copied from check-committed.ts, the sibling gate): 0 = HEAD builds; 1 = ANDON
// (HEAD does not build from a clean checkout — the E-007 partial-commit class); 2 = environment
// error (git missing / not a repo / worktree add failed) — kept DISTINCT from a broken HEAD so
// the T-010-02 hook can tell "couldn't check" from "found a problem" and fail-open on 2.

/** Which step of the isolated-build pipeline failed, or `null` if every step passed. */
export type BuildStep = "preflight" | "worktree" | "build";

/**
 * The RAW result the impure verb reports — DATA, not a decision. The verb says only "the build
 * step exited non-zero"; it never decides what exit code that maps to. {@link classifyBuildOutcome}
 * owns that judgment.
 */
export interface BuildOutcome {
  /** `null` = all steps passed; otherwise the FIRST step that failed. */
  failedStep: BuildStep | null;
  /** Human context for the message — typically a trimmed tail of captured stderr/stdout. */
  detail: string;
}

/** The classified verdict: the process exit code, a pass flag, and the line the entry prints. */
export interface HeadVerdict {
  exitCode: 0 | 1 | 2;
  /** `true` iff `exitCode === 0`. No separate boolean to desync — it is derived. */
  ok: boolean;
  /** What check-head.ts writes to stdout (ok) or stderr (not ok). */
  message: string;
}

/**
 * Map a child-process exit code to pass/fail for a build step. PURE/TOTAL. A non-zero exit is a
 * failure; zero is success. Factored out so both the verb and its tests share one definition.
 */
export function buildStepFailed(exitCode: number): boolean {
  return exitCode !== 0;
}

/**
 * Classify a {@link BuildOutcome} into a {@link HeadVerdict}. PURE/TOTAL — the whole of the gate's
 * judgment. Mirrors check-committed's 0/1/2 scheme:
 *  - all steps passed       → 0 (gate passes)
 *  - the BUILD step failed   → 1 (ANDON — HEAD is broken from a clean checkout, the E-007 class)
 *  - preflight/worktree failed → 2 (environment error — we could not even run the check)
 */
export function classifyBuildOutcome(outcome: BuildOutcome): HeadVerdict {
  const { failedStep, detail } = outcome;
  if (failedStep === null) {
    return { exitCode: 0, ok: true, message: "check:head: ok — committed HEAD builds" };
  }
  if (failedStep === "build") {
    return {
      exitCode: 1,
      ok: false,
      message: `check:head: HEAD does not build from a clean checkout (E-007 class): ${detail}`,
    };
  }
  // preflight | worktree — we could not run the check at all.
  return {
    exitCode: 2,
    ok: false,
    message: `check:head: could not check HEAD (${failedStep}): ${detail}`,
  };
}
