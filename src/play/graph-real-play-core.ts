// The real-play graph's PURE core (T-047-01, story S-047-01, epic E-047) — the addon-free judgment
// behind the first REAL-play `castGraph` caller (graph-real-play.ts). Where E-046 proved the typed
// DAG substrate with STUB nodes, E-047 carries real plays + real concurrency through it: a
// `survey → [propose ×2] → capture-note` diamond. This module owns the load-bearing ADAPTER logic
// (the fan-out signal selection + the join's consolidating topic) and the node IDENTITY the shell and
// its test both bind to — split out from the shell for the house testability reason, exactly as
// chain-propose-decompose-core.ts is split from chain-propose-decompose.ts:
//
//  - graph-real-play.ts value-imports the three plays (each loads the BAML native addon), so NO
//    `bun test` may value-import it. Keeping the pure judgment HERE — `pickSignal`,
//    `buildConsolidationTopic`, the id derivation, the run-log subjects, the node ids + edges — lets
//    graph-real-play-core.test.ts exercise the WIRING deterministically (the graph-example.ts /
//    chain-propose-decompose.test.ts discipline): no live model, no addon ever loaded.
//
// PURITY (the work-core.ts / chain-core.ts discipline): every export takes plain values and returns
// plain values — no fs, clock, network, process, seam, or addon. The ONE value import is
// `parseBoardSignals` (work-core.ts), itself pure: the single source of board→signals truth, reused
// so the fan-out never re-greps the board. The `DagEdge` import is TYPE-ONLY (erased).

import type { DagEdge } from "../engine/dag-core.ts";
import { parseBoardSignals } from "./work-core.ts";

// ── Node identity ────────────────────────────────────────────────────────────
// Distinct ids for the four nodes — the two propose nodes share ONE play but `castGraph` keys
// upstreams by from-node id, so they MUST differ. Exported so the shell and the test agree
// byte-for-byte (the chain-propose-decompose epicSubjectFromPath-shared-constant stance).

/** The survey source node — reads the project, produces the staged board path. */
export const SURVEY_NODE = "survey";
/** The first propose fan-out branch — takes board signal #1. */
export const PROPOSE_1_NODE = "propose-1";
/** The second propose fan-out branch — takes board signal #2 (runs concurrently with #1). */
export const PROPOSE_2_NODE = "propose-2";
/** The join sink — consumes BOTH proposes' minted epic paths, produces the consolidating note. */
export const NOTE_NODE = "capture-note";

/**
 * The diamond's edges, in declaration order (the two fan-out edges, then the two join edges). The
 * `graph-example.ts` diamond (A→{B,C}→D) made real. Exported so the shell builds the graph from the
 * SAME edge set the test drives `runGraph` over.
 */
export const REAL_PLAY_EDGES: readonly DagEdge[] = [
  { from: SURVEY_NODE, to: PROPOSE_1_NODE },
  { from: SURVEY_NODE, to: PROPOSE_2_NODE },
  { from: PROPOSE_1_NODE, to: NOTE_NODE },
  { from: PROPOSE_2_NODE, to: NOTE_NODE },
];

// ── The fan-out adapter judgment ──────────────────────────────────────────────

/**
 * The result of selecting signal #index off the staged board: a hit carrying the signal, or an
 * honest degrade reason (the board carried fewer signals than the fan-out needs). The graph's
 * "degrades honestly — record it" contract (the ticket) as RETURNED DATA, never a throw — a thrown
 * adapter would reject `castGraph`'s `Promise.all` and crash the whole cast instead of degrading.
 */
export type SignalSelection =
  | { readonly ok: true; readonly signal: string }
  | { readonly ok: false; readonly reason: string };

/**
 * Select the `index`-th ranked signal off a staged survey board. PURE/TOTAL. Reuses
 * `parseBoardSignals` (work-core) — the single source of board→signals truth — which returns the
 * `vend chain "<signal>"` lines IN RANKED ORDER (IA-1). Fewer than `index+1` signals ⇒ an honest
 * degrade `SignalSelection` the shell routes through the propose value gate (an empty signal STOPs
 * cleanly) rather than crashing the graph.
 */
export function pickSignal(boardMd: string, index: number): SignalSelection {
  const signals = parseBoardSignals(boardMd);
  const signal = signals[index];
  if (signal === undefined) {
    return {
      ok: false,
      reason: `board carried ${signals.length} signal(s); fan-out branch needs signal #${index + 1}`,
    };
  }
  return { ok: true, signal };
}

// ── The join adapter judgment ─────────────────────────────────────────────────

/**
 * Derive an epic id from its minted path — `basename` minus `.md`. PURE. The `epicSubjectFromPath`
 * rule (chain-propose-decompose.ts), lifted here so the join can name the epics it consolidates
 * without value-importing the addon-loading chain module. Falls back to the whole path if it has no
 * basename (a defensive non-empty id).
 */
export function epicIdFromPath(epicPath: string): string {
  const base = epicPath.split("/").pop() ?? epicPath;
  return base.replace(/\.md$/, "") || epicPath;
}

/**
 * Build the JOIN node's note topic — the consolidating text that references BOTH minted epics. PURE.
 * Derives each epic's id from its path and names them in the topic, so the captured note is honestly
 * about the two epics the fan-out just proposed (the "join receiving both" headline). Total on a
 * degraded join (one or zero epics reached the sink): it names whatever it has, never throws.
 */
export function buildConsolidationTopic(epicPaths: readonly string[]): string {
  const ids = epicPaths.map(epicIdFromPath);
  if (ids.length === 0) {
    return "Consolidate the freshly-proposed epics (none reached the join — degraded run).";
  }
  if (ids.length === 1) {
    return `Consolidate the freshly-proposed epic ${ids[0]} (only one branch reached the join — degraded run).`;
  }
  return (
    `Consolidate the two freshly-proposed epics ${ids.join(" and ")}: capture how they relate — ` +
    `shared demand, overlap, and the order to clear them.`
  );
}

// ── Run-log subjects (non-empty by construction — appendRunLog asserts) ────────

/** The propose node's run-log subject — its picked signal, or a legible degraded marker. PURE. */
export function subjectForProposeSignal(signal: string): string {
  return signal.trim() || "propose (degraded — no signal selected)";
}

/** The join node's run-log subject — names the epics it consolidates. PURE. */
export function subjectForJoin(epicPaths: readonly string[]): string {
  const ids = epicPaths.map(epicIdFromPath);
  return ids.length > 0 ? `consolidate ${ids.join(" + ")}` : "consolidate (degraded — no epics)";
}
