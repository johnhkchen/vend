// The `vend work` gesture's IMPURE shell (T-024-03, story S-024-01, epic E-024) — the founding
// gesture made a real command (charter P2/P4/P7): fund a macro-wallet once, walk away, and let Vend
// spend it down across casts on the ranked board until a clean stop. The COMPOSITION LAYER — the one
// site that wires the three E-024 pieces together: the wallet (T-024-01, `allocate`), the autonomous
// spend loop (T-024-02, `spendDown`), and the real pull→clear cast (T-011-02,
// `castProposeDecomposeChain`). It writes no engine logic; it injects the four play-specific edges
// `spendDown` needs and reports the session back as DATA for the CLI to render (work-core).
//
// ENGINE ⊥ PLAY (E-007 keystone): the engine never imports `src/play/`; the cast is INJECTED. This
// module is allowed to import BOTH the engine (`spendDown`) and the plays (the chain + propose/
// decompose for pricing) precisely because it is the composition layer — the chain-propose-decompose
// precedent. The price seam is E-013's `recalibrate` over the ledger, exactly as cli.ts's `envelope`
// arm prices a play.
//
// PURITY: IMPURE (reads the board file + the ledger; awaits real casts via the chain). It value-
// imports the chain (the BAML native addon), so NO `bun test` value-imports this module — its parse
// + render is the tested pure core (work-core.test.ts), its loop is the tested `spendDown` + wallet
// (spend-core.test.ts / wallet.test.ts), its cast is the tested chain. Proven LIVE (AC#3), the
// `castChain` / chain-propose-decompose.ts stance.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { allocate } from "../budget/wallet.ts";
import type { Budget } from "../budget/budget.ts";
import { spendDown, type SessionResult, type StepSignal } from "../engine/spend.ts";
import { castProposeDecomposeChain } from "./chain-propose-decompose.ts";
import { proposeEpicPlay } from "./propose-epic.ts";
import { decomposeEpicPlay } from "./decompose-epic.ts";
import { recalibrate } from "../ledger/recalibrate.ts";
import { budgetForTier } from "../shelf/gather.ts";
import { loadRunLog } from "../log/run-log.ts";
import { parseBoardSignals, labelForSignal } from "./work-core.ts";

/** The "fund it, walk away for two hours" default macro budget when `--budget` is omitted (design
 *  D6): the vision's literal framing made the pre-filled default (IA-6 — adjust is the exception). */
export const DEFAULT_MACRO_BUDGET: Budget = { timeMs: 7_200_000, tokens: 2_000_000 };

/** Staged boards tried IN ORDER when no explicit `--board` is given: the steer board (board + forks)
 *  first, then the survey board — both emit the same `vend chain "…"` ranked gesture lines. */
const DEFAULT_BOARDS = ["docs/active/pm/staged/steer.md", "docs/active/pm/staged/survey-board.md"];

/** The tier the chain's predicted price is recalibrated at — the neutral middle the `envelope`/
 *  `audit` arms default to (E-013). The chain casts the same two plays for every signal, so the
 *  price is signal-independent and computed once. */
const PRICE_TIER = "standard" as const;

/** Options for {@link castWork} — the per-gesture values the loop does not carry. */
export interface WorkOptions {
  /** The funded macro budget; omitted ⇒ {@link DEFAULT_MACRO_BUDGET}. */
  readonly budget?: Budget;
  /** An explicit staged-board path; omitted ⇒ the {@link DEFAULT_BOARDS} steer→survey fallback. */
  readonly boardPath?: string;
  /** Repo root the board is read from and casts run under (default `process.cwd()`). */
  readonly projectRoot?: string;
  /** Pinned model id threaded to each cast; omitted ⇒ the engine default. */
  readonly model?: string;
  /** The IA-7 production-line emit, forwarded to `spendDown` (the CLI renders it). */
  readonly onStep?: (s: StepSignal) => void;
}

/**
 * The result {@link castWork} reports back as DATA (the CLI renders it via work-core). Tagged: a
 * missing or empty board is a clean precondition outcome (the CLI prints a hint and exits 1), a
 * settled session carries the {@link SessionResult} for the receipt.
 */
export type WorkResult =
  | { readonly kind: "no-board"; readonly tried: readonly string[] }
  | { readonly kind: "empty-board"; readonly boardPath: string }
  | { readonly kind: "spent"; readonly session: SessionResult; readonly funded: Budget };

/** Per-denomination sum of two budgets — the chain's predicted price is the sum of its two plays'
 *  envelopes (it casts both), kept denomination-separate (IA-8). */
function sumBudgets(a: Budget, b: Budget): Budget {
  return { timeMs: a.timeMs + b.timeMs, tokens: a.tokens + b.tokens };
}

/** Read the first readable board: an explicit path is tried alone; otherwise the steer→survey
 *  fallback. A missing file (ENOENT) is not an error — it just isn't the board (try the next).
 *  Returns the markdown + the path it came from, or null if none were readable. */
async function readBoard(root: string, explicit?: string): Promise<{ md: string; path: string } | null> {
  const candidates = explicit ? [explicit] : DEFAULT_BOARDS.map((p) => join(root, p));
  for (const path of candidates) {
    try {
      return { md: await readFile(path, "utf8"), path };
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === "ENOENT") continue;
      throw e; // a real fs fault, not a clean "not this board"
    }
  }
  return null;
}

/**
 * Cast the `vend work` gesture end to end — the counter's Confirm→Run→Settle spine (IA-6). Reads the
 * staged board into its ranked signals, funds the wallet, prices each pull at its recalibrated
 * envelope (E-013), and drives {@link spendDown}: pull the highest-leverage affordable signal, cast
 * the propose→decompose chain on it, debit the wallet by the ACTUALS, repeat until a clean stop. The
 * price gates authorization (P7 — never a cast the wallet can't afford); the wallet debits the real
 * burn. Returns the {@link WorkResult} for the CLI to render. IMPURE; NOT unit-tested (see header).
 */
export async function castWork(opts: WorkOptions = {}): Promise<WorkResult> {
  const root = opts.projectRoot ?? process.cwd();

  const board = await readBoard(root, opts.boardPath);
  if (!board) {
    return { kind: "no-board", tried: opts.boardPath ? [opts.boardPath] : DEFAULT_BOARDS.map((p) => join(root, p)) };
  }
  const candidates = parseBoardSignals(board.md);
  if (candidates.length === 0) return { kind: "empty-board", boardPath: board.path };

  const funded = opts.budget ?? DEFAULT_MACRO_BUDGET;
  const wallet = allocate(funded);

  // Predict the chain's price ONCE from the ledger (it casts the same two plays for every signal):
  // the per-denomination sum of propose-epic + decompose-epic, each recalibrated at the standard
  // tier over its measured history, cold-starting to the warranted hand prior (E-013). This gates
  // P7 authorization; the wallet still debits the cast's actuals, not this prediction.
  const { records } = await loadRunLog();
  const prior = budgetForTier(PRICE_TIER);
  // Keep the two per-step envelopes the wallet authorizes on — they recalibrate separately and can
  // diverge. `price` (their sum) gates `canAfford`; the individual envelopes are threaded into the
  // cast PER STEP below so the chain RUNS under exactly what was authorized (E-025: the E-024 sweep
  // authorized at 227k but cast at the 150k static default → budget-exhausted, cleared 0).
  const proposeEnvelope = recalibrate(proposeEpicPlay.name, records, PRICE_TIER, prior).envelope;
  const decomposeEnvelope = recalibrate(decomposeEpicPlay.name, records, PRICE_TIER, prior).envelope;
  const price = sumBudgets(proposeEnvelope, decomposeEnvelope);

  const session = await spendDown<string>({
    wallet,
    candidates,
    priceOf: () => price,
    castOne: (signal) =>
      castProposeDecomposeChain({
        signal,
        projectRoot: root,
        proposeBudget: proposeEnvelope,
        decomposeBudget: decomposeEnvelope,
        ...(opts.model ? { model: opts.model } : {}),
      }),
    labelOf: (signal) => labelForSignal(signal),
    ...(opts.onStep ? { onStep: opts.onStep } : {}),
  });

  return { kind: "spent", session, funded };
}
