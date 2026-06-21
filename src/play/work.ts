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

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { allocate } from "../budget/wallet.ts";
import type { Budget } from "../budget/budget.ts";
import { spendDown, type SessionResult, type StepSignal } from "../engine/spend.ts";
import { castPreflight } from "../doctor/preflight.ts";
import type { DoctorReport } from "../doctor/doctor-core.ts";
import { castProposeDecomposeChain } from "./chain-propose-decompose.ts";
import { proposeEpicPlay } from "./propose-epic.ts";
import { decomposeEpicPlay } from "./decompose-epic.ts";
import { recalibrate } from "../ledger/recalibrate.ts";
import { budgetForTier } from "../shelf/gather.ts";
import { loadRunLog } from "../log/run-log.ts";
import { parseBoardSignals, labelForSignal, isBoardStale } from "./work-core.ts";

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
  /** The E1 trust self-report for this walk-away session (T-026-02): forwarded to every chain
   *  cast so the sweep's records carry the `intervened` bit — turning a genuine `vend work` sweep
   *  into forward E1 evidence (E-026). `--intervened` ⇒ true (author stepped in), `--no-intervened`
   *  ⇒ false (let it clear), absent ⇒ unknown (unreported — the rate is never fabricated). */
  readonly intervened?: boolean;
  /** The IA-7 production-line emit, forwarded to `spendDown` (the CLI renders it). */
  readonly onStep?: (s: StepSignal) => void;
  /** Spend even when the staged board is stale — the human override (IA-5, T-027-01). Default
   *  (absent/false): the freshness gate refuses a board older than the project's live state. */
  readonly staleOk?: boolean;
}

/** The `docs/active/**` dirs whose newest `*.md` mtime IS the project's "live state" the board is
 *  measured against (the decomposed epic→story→ticket board the staged board ranks). Mirrors
 *  load.ts's three dirs — the no-shared-util idiom: a thin readdir+stat here, not load.ts's full
 *  node parse, since the freshness gate needs only the newest mtime (T-027-01). */
const ACTIVE_DIRS = ["docs/active/epic", "docs/active/stories", "docs/active/tickets"] as const;

/**
 * The result {@link castWork} reports back as DATA (the CLI renders it via work-core). Tagged: a
 * missing or empty board is a clean precondition outcome (the CLI prints a hint and exits 1), a
 * settled session carries the {@link SessionResult} for the receipt.
 */
export type WorkResult =
  /** The environment failed the doctor preflight (T-042-04): a broken dependency — a CLEAN refusal
   *  at the door, BEFORE the board is read, the wallet is funded, or any token is metered (P3/P4/P7,
   *  mirroring lisa's check_required_deps-before-run_loop). Carries the rendered {@link DoctorReport}
   *  so the CLI prints the SAME named-check + fix-it-hint surface `vend doctor` emits and exits with
   *  its exitCode — a successful refusal, not a crash, like the no-board/empty-board/stale-board family. */
  | { readonly kind: "unfit-env"; readonly report: DoctorReport }
  | { readonly kind: "no-board"; readonly tried: readonly string[] }
  | { readonly kind: "empty-board"; readonly boardPath: string }
  /** The board predates the project's live state (T-027-01, E-027): a CLEAN refusal (the CLI renders
   *  the amber IA-9 andon + exits like no-board/empty-board), NOT a thrown fault. Carries both mtimes
   *  so the render needs no second stat. Bypassed by `--stale-ok` (IA-5). */
  | { readonly kind: "stale-board"; readonly boardPath: string; readonly boardMtimeMs: number; readonly liveMtimeMs: number }
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

/** The newest `*.md` mtime across {@link ACTIVE_DIRS} — the project's "live state" timestamp the
 *  board's staging time is checked against (T-027-01). Mirrors load.ts's readdir-per-dir idiom but
 *  takes `stat().mtimeMs` and a running max instead of file bodies. TOLERANT: a missing dir (ENOENT)
 *  or a per-file stat fault is skipped, so a partly-scaffolded board never throws. Returns 0 when
 *  there are no active files at all ⇒ {@link isBoardStale} reads fresh (no live state to be stale
 *  against). IMPURE (reads mtimes); the staleness DECISION it feeds is the pure, unit-tested core. */
async function newestActiveMtimeMs(root: string): Promise<number> {
  let newest = 0;
  for (const rel of ACTIVE_DIRS) {
    let names: string[];
    try {
      names = await readdir(join(root, rel));
    } catch {
      continue; // a missing dir is not the project's newest change — just skip it
    }
    for (const name of names) {
      if (!name.endsWith(".md")) continue;
      try {
        const s = await stat(join(root, rel, name));
        if (s.mtimeMs > newest) newest = s.mtimeMs;
      } catch {
        continue; // a vanished/unreadable entry can't be the newest change
      }
    }
  }
  return newest;
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

  // Doctor preflight (T-042-04): refuse a cast against a broken environment at the DOOR — before the
  // board is read, the wallet is funded, or any token is metered (P3/P4/P7). Reuses the `vend doctor`
  // check (probe → render) exactly as lisa runs check_required_deps before its run_loop. A broken dep
  // is returned as DATA (a red DoctorReport) — never a mid-run crash after a budget is committed.
  const preflight = await castPreflight();
  if (!preflight.ok) return { kind: "unfit-env", report: preflight };

  const board = await readBoard(root, opts.boardPath);
  if (!board) {
    return { kind: "no-board", tried: opts.boardPath ? [opts.boardPath] : DEFAULT_BOARDS.map((p) => join(root, p)) };
  }
  const candidates = parseBoardSignals(board.md);
  if (candidates.length === 0) return { kind: "empty-board", boardPath: board.path };

  // The freshness gate (T-027-01, E-027): BEFORE funding the wallet, refuse a board that predates the
  // project's live state — spending it down clears already-done/superseded work (overproduction). The
  // decision is the pure `isBoardStale`; the two mtimes are gathered here (the board's stat + the
  // newest `docs/active/**` change). `--stale-ok` (IA-5) bypasses the gather entirely. mtime is a
  // heuristic (git checkout can reset it) — hence the override, not a hard lock.
  if (!opts.staleOk) {
    const boardMtimeMs = (await stat(board.path)).mtimeMs;
    const liveMtimeMs = await newestActiveMtimeMs(root);
    if (isBoardStale(boardMtimeMs, liveMtimeMs)) {
      return { kind: "stale-board", boardPath: board.path, boardMtimeMs, liveMtimeMs };
    }
  }

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
        // The E1 self-report (T-026-02) — session-level, spread only when reported so an
        // unreported sweep keeps the bit unknown (never a fabricated walk-away), exactly like model.
        ...(opts.intervened !== undefined ? { intervened: opts.intervened } : {}),
      }),
    labelOf: (signal) => labelForSignal(signal),
    ...(opts.onStep ? { onStep: opts.onStep } : {}),
  });

  return { kind: "spent", session, funded };
}
