// The per-commit green-gate PURE policy (T-033-01) — the addon-free heart of E-033's
// "every commit is tests-green" gate. The third layer of the commit-discipline frame, after
// E-008 (`check:committed`, on-stop: source is committed) and E-010 (`check:head`, on-clear:
// committed HEAD builds). This layer answers a different question — "do the tests pass at THIS
// commit?" — at the one seam lisa's loop has no hook of its own: the git pre-commit hook.
//
// THE CENTRAL RULE (ci-strategy.md): check *logic* lives here in the app repo; the trigger (the
// T-033-02 `.githooks/pre-commit` invoker) is a thin shell that only runs the tests and feeds the
// raw result in. This module IS that logic — the single source of "what a test-run outcome MEANS
// for whether the commit may proceed."
//
// PURE: every export takes plain data and returns fresh values — no Bun.spawn, no readFile, no git,
// no clock, no network, no process. The IMPURE verbs (run `bun run check:test`, read
// `core.hooksPath`, block the commit) live in T-033-02. This keeps precommit-core.test.ts an
// ordinary pure-function test, the same discipline committed-core / head-build-core / press-core /
// gates / decompose-epic-core follow.
//
// TWO DISCIPLINES, encoded as DATA so the shell never re-derives them:
//   - tests-failed → BLOCK (fail-closed) — the gate's whole job; the message NAMES the failure
//     (the E-008 "name the file" style) so the model sees the andon and fixes before committing.
//   - could-not-run → ALLOW (fail-open) — mirrors on-stop.sh: a broken checker must never wedge the
//     loop, but the skip is visible (a note), never silent.
//
// HOUSE RULE (committed-core.ts / budget.ts): an offending outcome is RETURNED data, never thrown.
// "Tests failed" is an expected outcome, not an exception. The one throw below (assertNever) is a
// programmer-error guard the compiler proves unreachable on valid data.

// ── classifyPrecommit ────────────────────────────────────────────────────────────────────────

/** Why the gate reached its verdict. Exhaustively switched in {@link verdictMessage} (no `default`). */
export type PrecommitReason = "green" | "tests-failed" | "could-not-run";

/**
 * The RAW result the impure verb reports — DATA, not a decision (cf. head-build-core's BuildOutcome).
 * The T-033-02 runner spawns the test gate and fills these in: `ran` = the process actually started
 * and completed; `exitCode` = its exit code (`null` when it never ran); `stderr` = captured context
 * for the andon message. The verb never decides what this MEANS — {@link classifyPrecommit} owns that.
 */
export interface PrecommitRun {
  /** Did the test process actually spawn and complete? `false` = no bun, not a repo, spawn/env error. */
  ran: boolean;
  /** The process exit code; `null` when `ran` is false (it never ran, so there is no code). */
  exitCode: number | null;
  /** Captured stderr/stdout tail — surfaced in the message so a block/skip names its cause. */
  stderr?: string;
}

/** The classified verdict: block-or-allow, the reason, and the line the invoker prints. */
export interface PrecommitVerdict {
  /** `true` iff the commit must be refused. Only `tests-failed` blocks. */
  block: boolean;
  reason: PrecommitReason;
  /** Always set — the invoker never has to synthesize text. Names the failure on a block. */
  message: string;
}

/**
 * Trim captured output to a short, single-spaced suffix for the message, or `""` when absent. PURE.
 * Guarantees `tail(undefined)` is `""` (never the string "undefined").
 */
function tail(stderr: string | undefined): string {
  const s = (stderr ?? "").trim();
  if (s === "") return "";
  return `: ${s.replace(/\s+/g, " ")}`;
}

/**
 * Build the message for a verdict. PURE/TOTAL. The `switch` has one arm per {@link PrecommitReason}
 * and NO `default` — so adding a fourth reason fails `tsc` here (the unhandled case makes `reason`
 * un-assignable to `never` at {@link assertNever}). This is how the gate proves every case is handled.
 */
function verdictMessage(reason: PrecommitReason, run: PrecommitRun): string {
  switch (reason) {
    case "green":
      return "precommit: ok — tests green";
    case "tests-failed":
      return `precommit: BLOCK — tests failed (exit ${run.exitCode}); fix before committing${tail(run.stderr)}`;
    case "could-not-run":
      return `precommit: skip — could not run tests (fail-open)${tail(run.stderr)}`;
  }
  return assertNever(reason);
}

/**
 * Classify a {@link PrecommitRun} into a {@link PrecommitVerdict}. PURE/TOTAL — the whole of the
 * gate's judgment. `ran` is checked FIRST so a process that never started can never be misread as a
 * non-zero exit (the input models `exitCode` as present-but-meaningless when `!ran`).
 *  - !ran            → allow,  could-not-run  (fail-open, mirrors on-stop.sh)
 *  - ran, exit === 0 → allow,  green
 *  - ran, exit !== 0 → BLOCK,  tests-failed    (fail-closed; message names the failure)
 */
export function classifyPrecommit(run: PrecommitRun): PrecommitVerdict {
  let block: boolean;
  let reason: PrecommitReason;
  if (!run.ran) {
    block = false;
    reason = "could-not-run";
  } else if (run.exitCode === 0) {
    block = false;
    reason = "green";
  } else {
    block = true;
    reason = "tests-failed";
  }
  return { block, reason, message: verdictMessage(reason, run) };
}

// ── hookInstallState ─────────────────────────────────────────────────────────────────────────

/**
 * The committed hooks directory — the R12 SHARED CONTRACT (cf. committed-core's SOURCE_PREFIXES).
 * T-033-02's `.githooks/pre-commit` script, its `git config core.hooksPath .githooks` install step,
 * and its `check:hooks` guard all derive the path from THIS export and never re-list it. Renaming or
 * widening the contract later is a one-line edit here.
 */
export const HOOKS_DIR = ".githooks" as const;

/** Whether the committed git pre-commit gate is wired, and the line the guard prints either way. */
export interface HookState {
  active: boolean;
  /** Always set — printed on both paths so an absent gate is visible, not silent (E-012 spirit). */
  message: string;
}

/**
 * Decide whether the configured `core.hooksPath` activates the committed gate. PURE/TOTAL. The impure
 * verb in T-033-02 reads the value (`git config core.hooksPath`) and passes it here — `null`/`undefined`
 * when the key is unset. A single trailing slash is normalized away so `.githooks/` still counts; any
 * other value fails to the "run `bun run hooks:install`" nudge, which fails safe (it never falsely
 * claims active). PURE — no fs-relative resolution (that would need I/O).
 */
export function hookInstallState(hooksPath: string | null | undefined): HookState {
  const value = (hooksPath ?? "").replace(/\/$/, "");
  if (value === "") {
    return {
      active: false,
      message: "precommit: git hook not installed (core.hooksPath unset) — run `bun run hooks:install`",
    };
  }
  if (value === HOOKS_DIR) {
    return { active: true, message: `precommit: gate active (core.hooksPath = ${HOOKS_DIR})` };
  }
  return {
    active: false,
    message: `precommit: core.hooksPath is "${value}", not ${HOOKS_DIR} — run \`bun run hooks:install\``,
  };
}

// ── exhaustiveness guard ───────────────────────────────────────────────────────────────────────

/**
 * Programmer-error guard: reached only if a {@link PrecommitReason} is added without a matching arm
 * in {@link verdictMessage}, in which case `tsc` rejects the call (the new reason is not `never`). On
 * valid data it is unreachable — this is the one throw in the module and it never fires at runtime on
 * expected outcomes, so it does not violate the "returned data, never thrown" house rule.
 */
function assertNever(x: never): never {
  throw new Error(`precommit-core: unhandled reason ${JSON.stringify(x)}`);
}
