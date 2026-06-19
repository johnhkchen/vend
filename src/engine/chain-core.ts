// The chain primitive's PURE core (T-011-01, story S-011-01, epic E-011) — the engine's first
// COMPOSITION primitive: run a sequence of plays, threading each play's `produced` output into
// the next play's input, halting the chain on any non-success. The play-generic mirror of
// cast-core.ts: the JUDGMENT (sequencing + threading + halt decision) is pure and tested HERE;
// the impure shell (chain.ts) builds the real cast thunks over `castPlay` and delegates.
//
// PURITY (house pattern, the cast-core.ts discipline): every import is a TYPE (erased under
// verbatimModuleSyntax) — `RunSummary` (the cast result it threads) and `RunOutcome` (the
// vocabulary it halts on). No fs, clock, network, process, or native addon. `runChain` is "pure
// given its injected edges": it owns the loop but SPAWNS NOTHING — the `cast` thunks are
// injected (chain.ts injects `adapt → castPlay`; chain-core.test.ts injects fakes returning
// canned summaries). The same purity seam as `makeStreamSink`'s injected write/sink.
//
// WHY a separate file from chain.ts: chain.ts value-imports `castPlay` (which pulls the executor
// seam), so a test importing chain.ts would spawn. Keeping the decision logic here — type-only
// imports — lets chain-core.test.ts prove the AC#3 threading + halt fixtures as an ordinary
// pure-function test (no addon, no spawn), exactly as cast-core.test.ts proves `classify`.

import type { RunSummary } from "./cast.ts";
import type { RunOutcome } from "../log/run-log.ts";

/**
 * One step of a chain, ABSTRACTED over how it casts. `cast` receives the upstream `produced`
 * reference (the previous step's output — `undefined` for the first step, which has no upstream)
 * and returns the step's {@link RunSummary} (which carries this step's OWN `produced`). The
 * play-specific adapter (upstream → typed inputs → `castPlay`) is closed over by `cast`; the
 * pure core only ever sees the `produced` STRING thread, never a play or a typed input.
 */
export interface ChainStep {
  readonly cast: (upstream: string | undefined) => Promise<RunSummary>;
}

/**
 * The pure per-step halt decision. A chain proceeds to the next step ONLY when the just-cast
 * step both (a) SUCCEEDED and (b) surfaced a `produced` reference to thread. The two
 * non-proceed reasons are kept DISTINCT so each is a loud andon rather than a silent stall:
 *  - a non-success outcome (a gate STOP, timeout, budget exhaustion, id-collision) — the AC's
 *    "halts on any STOP";
 *  - a success that surfaced NO `produced` — nothing to feed the next play (a wiring gap made
 *    visible, instead of threading `undefined` into the next adapter and failing obscurely).
 */
export interface ThreadDecision {
  readonly proceed: boolean;
  /** The andon string when it does not proceed; absent when it proceeds. */
  readonly reason?: string;
}

/** Decide whether a chain may thread PAST this step into the next. PURE. */
export function decideThread(summary: RunSummary): ThreadDecision {
  if (summary.outcome !== "success") {
    return { proceed: false, reason: `halted: step outcome '${summary.outcome}' is not success` };
  }
  if (summary.produced === undefined || summary.produced.length === 0) {
    return { proceed: false, reason: "halted: step succeeded but surfaced no `produced` reference to thread" };
  }
  return { proceed: true };
}

/**
 * The outcome of running a chain.
 *  - `steps`    : one {@link RunSummary} per CAST step (skipped downstream steps are absent) —
 *                 each corresponds to exactly one run-log record (`castPlay` logs per cast).
 *  - `outcome`  : the LAST cast step's outcome — the chain's terminal outcome a caller maps to
 *                 an exit code, mirroring a single-play cast.
 *  - `halted`   : did a non-success step SKIP downstream casts (the last step failing does NOT
 *                 set this — nothing downstream was skipped).
 *  - `produced` : the final cast step's `produced` — the chain's net output (for T-011-02's
 *                 gesture).
 *  - `haltReason`: why it halted, when it did.
 */
export interface ChainResult {
  readonly steps: readonly RunSummary[];
  readonly outcome: RunOutcome;
  readonly halted: boolean;
  readonly produced?: string;
  readonly haltReason?: string;
}

/**
 * Run a chain of steps in sequence, threading each step's `produced` → the next step's `cast`,
 * halting on the FIRST non-success (or a success that produced nothing). PURE given injected
 * `cast` thunks — it spawns nothing and touches no fs; its logic is the sequencing, the thread
 * (`upstream = summary.produced`), and the {@link decideThread} halt gate, all exercised with
 * fake casts in chain-core.test.ts.
 *
 * The halt gate is evaluated ONLY between steps (never after the last) so a chain that completes
 * every step never reports a misleading `haltReason`: "halt" means a downstream cast was skipped.
 * The empty chain is a vacuous success no-op.
 */
export async function runChain(steps: readonly ChainStep[]): Promise<ChainResult> {
  const summaries: RunSummary[] = [];
  let upstream: string | undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step === undefined) break; // unreachable (i < length), but satisfies noUncheckedIndexedAccess
    const summary = await step.cast(upstream);
    summaries.push(summary);

    if (i === steps.length - 1) break; // nothing downstream to thread/halt

    const decision = decideThread(summary);
    if (!decision.proceed) {
      return {
        steps: summaries,
        outcome: summary.outcome,
        halted: true,
        produced: summary.produced,
        haltReason: decision.reason,
      };
    }
    upstream = summary.produced; // thread this step's output into the next step's cast
  }

  const last = summaries[summaries.length - 1];
  if (last === undefined) return { steps: [], outcome: "success", halted: false }; // empty chain
  return { steps: summaries, outcome: last.outcome, halted: false, produced: last.produced };
}
