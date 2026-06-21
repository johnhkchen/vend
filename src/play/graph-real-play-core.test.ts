import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RunOutcome } from "../log/run-log.ts";
import type { RunSummary } from "../engine/cast.ts";
import { runGraph, runGraphConcurrent } from "../engine/graph-core.ts";
import type { DagNode, DagSpec, NodeId, NodeUpstreams } from "../engine/dag-core.ts";
import { allocate } from "../budget/wallet.ts";
import type { Budget } from "../budget/budget.ts";
import {
  NOTE_NODE,
  PROPOSE_1_NODE,
  PROPOSE_2_NODE,
  REAL_PLAY_EDGES,
  SURVEY_NODE,
  buildConsolidationTopic,
  epicIdFromPath,
  pickSignal,
  realPlayMacro,
  type SignalSelection,
} from "./graph-real-play-core.ts";

// T-047-01 — the DETERMINISTIC wiring proof (AC#2) for the real-play graph. We import ONLY the pure
// core + the pure `runGraph` (graph-core.ts) — NEVER ./graph-real-play.ts (it value-imports the three
// plays' `b`, the addon) and NEVER ./graph.ts (its `castGraph` value-imports `castPlay`, which
// spawns). So this `bun test` loads no native addon, spawns NOTHING, and casts no live model. The
// concurrent `castGraph` shell's fan-out/join/halt semantics ARE the ones `runGraph` is proven on
// (graph-example.test.ts); here we pin that the REAL adapters extract signal #1/#2 on fan-out and that
// the join adapter receives BOTH minted epic paths and builds a note referencing both.

/** A canned cast result — the only thing the pure core sees of a node (graph-example.ts shape). */
function summary(outcome: RunOutcome, produced?: string): RunSummary {
  return { runId: `run-${outcome}`, outcome, materialized: outcome === "success", produced };
}

/** A minimal staged survey board with a `## Pull these` block of `vend chain "..."` lines — the
 *  exact shape `surveyBoardEffect` writes and `parseBoardSignals` scans. */
function boardFixture(signals: readonly string[]): string {
  const pulls = signals.map((s) => `vend chain "${s}"`).join("\n");
  return ["# Survey — staged demand board", "", "## Pull these", "", "```", pulls, "```", ""].join("\n");
}

const SIGNAL_1 = "ship the real-play graph — proves the substrate carries real plays";
const SIGNAL_2 = "settle the graph — concurrency proof and honest verdict";

describe("pickSignal: the fan-out adapter extracts ranked signal #1 / #2", () => {
  const md = boardFixture([SIGNAL_1, SIGNAL_2]);

  test("index 0 → signal #1, index 1 → signal #2 (ranked order preserved)", () => {
    expect(pickSignal(md, 0)).toEqual({ ok: true, signal: SIGNAL_1 } satisfies SignalSelection);
    expect(pickSignal(md, 1)).toEqual({ ok: true, signal: SIGNAL_2 } satisfies SignalSelection);
  });

  test("fewer than index+1 signals → an honest degrade (no throw)", () => {
    const oneSignal = boardFixture([SIGNAL_1]);
    const sel = pickSignal(oneSignal, 1);
    expect(sel.ok).toBe(false);
    if (!sel.ok) expect(sel.reason).toContain("signal #2");

    const empty = boardFixture([]);
    expect(pickSignal(empty, 0).ok).toBe(false);
  });
});

describe("the join adapter: build a topic referencing BOTH minted epics", () => {
  test("epicIdFromPath derives the id from a minted path", () => {
    expect(epicIdFromPath("/repo/docs/active/epic/E-010.md")).toBe("E-010");
    expect(epicIdFromPath("E-042.md")).toBe("E-042");
  });

  test("buildConsolidationTopic names both epics", () => {
    const topic = buildConsolidationTopic(["/r/docs/active/epic/E-010.md", "/r/docs/active/epic/E-011.md"]);
    expect(topic).toContain("E-010");
    expect(topic).toContain("E-011");
  });

  test("degrades legibly with one or zero epics (never throws)", () => {
    expect(buildConsolidationTopic(["/r/E-010.md"])).toContain("E-010");
    expect(buildConsolidationTopic([])).toContain("degraded");
  });
});

describe("wiring proof (AC#2): fan-out delivers the board to BOTH proposes; the JOIN receives both epics", () => {
  test("driven through the pure runGraph over the REAL node ids + edges and the REAL adapters", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-graph-realplay-"));
    try {
      // The survey source produces a real board path (a written fixture the propose adapters read).
      const boardPath = join(root, "survey-board.md");
      await writeFile(boardPath, boardFixture([SIGNAL_1, SIGNAL_2]), "utf8");
      const epicAPath = join(root, "E-100.md");
      const epicBPath = join(root, "E-101.md");

      // What each node's REAL adapter saw — the wiring evidence.
      const proposeSaw: Record<NodeId, SignalSelection> = {};
      let joinUpstreams: Record<string, string> = {};
      let joinTopic = "";

      // A propose stub that runs the REAL fan-out adapter (read upstream board → pickSignal), records
      // the selection, and produces its minted epic path. The shell's adapt is exactly this read +
      // pickSignal (then assembleProposeEpicInputs, which needs the addon — out of scope for the unit).
      const proposeStub = (id: NodeId, index: number, epicPath: string) => ({
        id,
        cast: async (upstreams: NodeUpstreams) => {
          const bp = upstreams.get(SURVEY_NODE);
          const md = bp !== undefined ? await Bun.file(bp).text() : "";
          proposeSaw[id] = pickSignal(md, index);
          return summary("success", epicPath);
        },
      });

      const spec: DagSpec = {
        nodes: [
          { id: SURVEY_NODE, cast: async () => summary("success", boardPath) },
          proposeStub(PROPOSE_1_NODE, 0, epicAPath),
          proposeStub(PROPOSE_2_NODE, 1, epicBPath),
          {
            id: NOTE_NODE,
            cast: async (upstreams: NodeUpstreams) => {
              joinUpstreams = Object.fromEntries(upstreams);
              // The REAL join adapter: pull BOTH proposes' produced epic paths, build the topic.
              const epicPaths = [upstreams.get(PROPOSE_1_NODE), upstreams.get(PROPOSE_2_NODE)].filter(
                (p): p is string => p !== undefined,
              );
              joinTopic = buildConsolidationTopic(epicPaths);
              return summary("success", join(root, "consolidating-note.md"));
            },
          },
        ],
        edges: REAL_PLAY_EDGES,
      };

      const result = await runGraph(spec);

      // FAN-OUT: each propose branch read the SAME survey board and picked its ranked signal.
      expect(proposeSaw[PROPOSE_1_NODE]).toEqual({ ok: true, signal: SIGNAL_1 });
      expect(proposeSaw[PROPOSE_2_NODE]).toEqual({ ok: true, signal: SIGNAL_2 });

      // JOIN: the note node received BOTH proposes' produced epic paths, keyed by from-node.
      expect(joinUpstreams).toEqual({ [PROPOSE_1_NODE]: epicAPath, [PROPOSE_2_NODE]: epicBPath });

      // and built a topic referencing BOTH minted epics.
      expect(joinTopic).toContain("E-100");
      expect(joinTopic).toContain("E-101");

      // The graph ran clean to its sole sink (the note).
      expect(result.halted).toBe(false);
      expect(result.outcome).toBe("success");
      expect(Object.fromEntries(result.produced)).toEqual({ [NOTE_NODE]: join(root, "consolidating-note.md") });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

// T-052-01 (E-052) — the SHARED-WALLET sizing proof. `castRealPlayGraph` now allocates ONE wallet
// (sized by `realPlayMacro`) and passes it as `castGraph`'s third arg, so both fan-out proposes draw
// from one envelope and the 2-upstream JOIN runs (it stayed stub-only in E-047 because per-node
// budgets leaked across the branches). We pin the PURE sizing here — `realPlayMacro` arithmetic plus a
// run of the REAL diamond (`REAL_PLAY_EDGES`) through the pure budgeted dispatcher `runGraphConcurrent`
// (the one the impure `castGraph` delegates to) under the real-play-sized wallet. NO `castPlay`, NO
// native addon, NOTHING spawned — never importing ./graph-real-play.ts or ../engine/graph.ts.

// The four real-play node budgets, mirrored from the plays (survey.ts / propose-epic.ts / note.ts) so
// the sizing proof is self-contained without value-importing the addon-loading plays.
const SURVEY_PRICE: Budget = { tokens: 300_000, timeMs: 1_800_000 };
const PROPOSE_PRICE: Budget = { tokens: 150_000, timeMs: 1_800_000 };
const NOTE_PRICE: Budget = { tokens: 8_000, timeMs: 600_000 };

/** A COSTED stub node — a canned success carrying both a `produced` ref AND measured `actuals`
 *  (`{ usage, wallMs }`) so the dispatcher's `debitWave` folds a real delta (graph-example.ts shape).
 *  Tokens ride `input_tokens` so `countTokens` == that count. */
function costedStub(id: NodeId, produced: string, price: Budget): DagNode {
  return {
    id,
    cast: async () => ({
      runId: `run-${id}`,
      outcome: "success" as RunOutcome,
      materialized: true,
      produced,
      actuals: { usage: { input_tokens: price.tokens }, wallMs: price.timeMs },
    }),
  };
}

/** The real-play diamond as COSTED stubs over the REAL edge set — priced at the four node budgets. */
function costedDiamond(): { spec: DagSpec; priceOf: (id: NodeId) => Budget } {
  const prices: Record<NodeId, Budget> = {
    [SURVEY_NODE]: SURVEY_PRICE,
    [PROPOSE_1_NODE]: PROPOSE_PRICE,
    [PROPOSE_2_NODE]: PROPOSE_PRICE,
    [NOTE_NODE]: NOTE_PRICE,
  };
  const spec: DagSpec = {
    nodes: [
      costedStub(SURVEY_NODE, "board.md", SURVEY_PRICE),
      costedStub(PROPOSE_1_NODE, "E-A.md", PROPOSE_PRICE),
      costedStub(PROPOSE_2_NODE, "E-B.md", PROPOSE_PRICE),
      costedStub(NOTE_NODE, "note.md", NOTE_PRICE),
    ],
    edges: REAL_PLAY_EDGES,
  };
  const priceOf = (id: NodeId): Budget => (prices[id] as Budget) ?? { tokens: 0, timeMs: 0 };
  return { spec, priceOf };
}

describe("realPlayMacro: ONE envelope sized to cover the whole diamond (E-052, AC)", () => {
  test("arithmetic: tokens SUM both proposes; wall-clock counts ONE (the proposes overlap)", () => {
    // tokens = 300k(survey) + 2×150k(proposes) + 8k(note) = 608k.
    // timeMs  = 1.8M(survey) + 1.8M(ONE propose — the two overlap) + 0.6M(note) = 4.2M.
    expect(realPlayMacro(SURVEY_PRICE, PROPOSE_PRICE, NOTE_PRICE)).toEqual({
      tokens: 608_000,
      timeMs: 4_200_000,
    });
  });

  test("the macro-sized wallet covers ALL FOUR nodes — every wave authorizes, the JOIN runs", async () => {
    const { spec, priceOf } = costedDiamond();
    const wallet = allocate(realPlayMacro(SURVEY_PRICE, PROPOSE_PRICE, NOTE_PRICE));

    const result = await runGraphConcurrent(spec, { wallet, priceOf });

    // All four nodes cast — survey, BOTH proposes (the fan-out), and the JOIN (capture-note). Nothing
    // budget-stopped: the single shared envelope funds the whole diamond.
    expect([...result.nodes.keys()].sort()).toEqual([NOTE_NODE, PROPOSE_1_NODE, PROPOSE_2_NODE, SURVEY_NODE].sort());
    expect(result.skipped).toEqual([]);
    expect(result.halted).toBe(false);
    expect(result.outcome).toBe("success");

    // Spend bounded by the ONE envelope on BOTH denominations (P7 under concurrency) — never negative.
    expect(result.walletRemaining?.tokens).toBeGreaterThanOrEqual(0);
    expect(result.walletRemaining?.timeMs).toBeGreaterThanOrEqual(0);
    // Tokens: spent 608k of 608k → 0 left. Wall-clock: spent survey(1.8M)+max(propose)=1.8M+note(0.6M)
    // = 4.2M of 4.2M → 0 left. The tight envelope is fully and exactly drawn.
    expect(result.walletRemaining).toEqual({ tokens: 0, timeMs: 0 });
  });

  test("NOT per-node: a one-propose-sized wallet budget-stops the second propose and skips the JOIN", async () => {
    const { spec, priceOf } = costedDiamond();
    // The naive under-count that forgets the fan-out DOUBLES the proposes: only ONE propose's tokens.
    const perNodeMacro: Budget = {
      tokens: SURVEY_PRICE.tokens + PROPOSE_PRICE.tokens + NOTE_PRICE.tokens, // 458k — one propose short
      timeMs: 4_200_000,
    };
    const wallet = allocate(perNodeMacro);

    const result = await runGraphConcurrent(spec, { wallet, priceOf });

    // propose-2 is hard-stopped at the wave boundary (cumulative 300k > 158k remaining after survey),
    // so the JOIN never runs — the cross-branch leak E-052 closes is exactly what this under-count
    // reproduces, proving the macro MUST count both proposes.
    expect(result.nodes.has(PROPOSE_2_NODE)).toBe(false);
    expect(result.nodes.has(NOTE_NODE)).toBe(false);
    const stopped = result.skipped.find((s) => s.id === PROPOSE_2_NODE);
    expect(stopped).toBeDefined();
    expect(stopped?.reason).toMatch(/budget-stopped/);
    // A clean refusal (IA-9): the wave halted, but no cast failed.
    expect(result.halted).toBe(true);
    expect(result.outcome).toBe("success");
  });
});
