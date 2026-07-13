import { describe, expect, test } from "bun:test";
import { buildGraph, type RawNode, type WorkGraph } from "../graph/model.ts";
import { serializeLisaLoopSettledMarker } from "../seam/lisa-loop-settled-core.ts";
import {
  computeSettleVerdict,
  deriveEpicClearance,
  LAST_SETTLE_MARKER_PATH,
  LAST_SETTLE_MARKER_VERSION,
  parseLastSettleMarker,
  serializeLastSettleMarker,
  type ComputeSettleInput,
  type LastSettleMarker,
  type SettleGateResult,
} from "./settle-core.ts";

function node(file: string, data: Record<string, unknown>): RawNode {
  return { file, data, body: `fixture body for ${String(data.id)}` };
}

/** Canonical graph fixture: one all-done epic, one partial epic, and one empty epic. */
function fixtureGraph(): WorkGraph {
  return buildGraph(
    [
      node("E-300.md", { id: "E-300", title: "empty", status: "open", advances: [], serves: "fixture" }),
      node("E-100.md", { id: "E-100", title: "cleared epic", status: "open", advances: [], serves: "fixture" }),
      node("E-200.md", { id: "E-200", title: "partial epic", status: "open", advances: [], serves: "fixture" }),
    ],
    [
      node("S-200-01.md", {
        id: "S-200-01", title: "partial story", status: "open", priority: "high",
        tickets: ["T-200-01", "T-200-02"],
      }),
      node("S-100-01.md", {
        id: "S-100-01", title: "cleared story", status: "open", priority: "high",
        tickets: ["T-100-01", "T-100-02"],
      }),
    ],
    [
      // Phase is authoritative: this counts despite status still being open.
      node("T-100-01.md", {
        id: "T-100-01", story: "S-100-01", title: "first cleared", type: "task",
        status: "open", priority: "high", phase: "done", depends_on: [],
      }),
      node("T-100-02.md", {
        id: "T-100-02", story: "S-100-01", title: "second cleared", type: "task",
        status: "done", priority: "high", phase: "done", depends_on: ["T-100-01"],
      }),
      node("T-200-01.md", {
        id: "T-200-01", story: "S-200-01", title: "partial cleared", type: "task",
        status: "done", priority: "medium", phase: "done", depends_on: [],
      }),
      // Status is not authoritative: this does not count because phase is not done.
      node("T-200-02.md", {
        id: "T-200-02", story: "S-200-01", title: "still active", type: "task",
        status: "done", priority: "medium", phase: "review", depends_on: ["T-200-01"],
      }),
    ],
  );
}

const greenGate = (): SettleGateResult => ({
  ok: true,
  name: "repository gate",
  detail: "green — 200 tests",
  nextAction: null,
});

function input(overrides: Partial<ComputeSettleInput> = {}): ComputeSettleInput {
  return {
    graph: fixtureGraph(),
    loopSettledContents: null,
    lastSettleContents: null,
    gate: greenGate(),
    presweep: { ok: true, doneIds: ["T-100-01", "T-100-02", "T-200-01"], offenders: [] },
    reviewConcerns: [],
    ...overrides,
  };
}

describe("deriveEpicClearance — the shared phase-done source", () => {
  test("returns per-epic counts, a non-vacuous all-done set, and the sorted board frontier", () => {
    expect(deriveEpicClearance(fixtureGraph())).toEqual({
      epics: [
        {
          epicId: "E-100",
          title: "cleared epic",
          cleared: 2,
          total: 2,
          clearedTicketIds: ["T-100-01", "T-100-02"],
          allDone: true,
        },
        {
          epicId: "E-200",
          title: "partial epic",
          cleared: 1,
          total: 2,
          clearedTicketIds: ["T-200-01"],
          allDone: false,
        },
        {
          epicId: "E-300",
          title: "empty",
          cleared: 0,
          total: 0,
          clearedTicketIds: [],
          allDone: false,
        },
      ],
      doneTicketIds: ["T-100-01", "T-100-02", "T-200-01"],
      allDoneEpicIds: ["E-100"],
    });
  });
});

describe("last-settle marker — versioned done frontier", () => {
  test("absence is a valid first settle", () => {
    expect(parseLastSettleMarker(null)).toEqual({ ok: true, firstSettle: true, marker: null });
  });

  test("canonical bytes round-trip and tolerate historical ids no longer on the board", () => {
    const marker: LastSettleMarker = {
      version: LAST_SETTLE_MARKER_VERSION,
      doneTicketIds: ["T-001-ARCHIVED", "T-100-01"],
    };
    const bytes = serializeLastSettleMarker(marker);
    expect(bytes).toBe('{"version":1,"doneTicketIds":["T-001-ARCHIVED","T-100-01"]}\n');
    expect(parseLastSettleMarker(bytes)).toEqual({
      ok: true,
      firstSettle: false,
      marker,
    });
  });

  const malformedCases: readonly [string, string, string][] = [
    ["invalid JSON", "{", "not valid JSON"],
    ["wrong version", '{"version":2,"doneTicketIds":[]}', "version must be 1"],
    ["extra key", '{"version":1,"doneTicketIds":[],"extra":true}', "exactly"],
    ["wrong id type", '{"version":1,"doneTicketIds":[7]}', "non-blank strings"],
    ["blank id", '{"version":1,"doneTicketIds":["  "]}', "non-blank strings"],
    ["duplicate ids", '{"version":1,"doneTicketIds":["T-1","T-1"]}', "sorted and unique"],
    ["unsorted ids", '{"version":1,"doneTicketIds":["T-2","T-1"]}', "sorted and unique"],
  ];

  for (const [name, bytes, reasonFragment] of malformedCases) {
    test(`${name} is a named actionable refusal, never a crash`, () => {
      const result = parseLastSettleMarker(bytes);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected malformed marker refusal");
      expect(result.refusal).toMatchObject({
        kind: "refusal",
        code: "malformed-last-settle-marker",
        path: LAST_SETTLE_MARKER_PATH,
        nextAction: "Remove .vend/last-settle.json and rerun `vend settle` for a full-board first-settle summary.",
      });
      expect(result.refusal.reason).toContain(reasonFragment);
    });
  }
});

describe("computeSettleVerdict — one complete machine-known result", () => {
  test("a prior marker yields board delta, clearance, carried facts, and ordered actionable exceptions", () => {
    const reviewConcerns = [
      { ticketId: "T-200-02", name: "missing release proof", nextAction: "Run the release fixture." },
      { ticketId: "T-100-02", name: "follow-up naming concern", nextAction: "Resolve the naming note." },
    ];
    const offenders = ["src/z.ts", "docs/active/tickets/T-200-02.md"];
    const verdict = computeSettleVerdict(input({
      lastSettleContents: serializeLastSettleMarker({
        version: LAST_SETTLE_MARKER_VERSION,
        doneTicketIds: ["T-100-01", "T-200-01"],
      }),
      gate: {
        ok: false,
        name: "repository gate",
        detail: "typecheck failed",
        nextAction: "Run `bun run build` and repair the reported type error.",
      },
      presweep: {
        ok: false,
        doneIds: ["T-200-01", "T-100-02", "T-100-01"],
        offenders,
      },
      reviewConcerns,
    }));

    expect(verdict.kind).toBe("verdict");
    if (verdict.kind !== "verdict") throw new Error("expected settle verdict");
    expect(verdict.loop).toBeNull();
    expect(verdict.delta).toEqual({ firstSettle: false, newlyDoneTicketIds: ["T-100-02"] });
    expect(verdict.doneTicketIds).toEqual(["T-100-01", "T-100-02", "T-200-01"]);
    expect(verdict.allDoneEpicIds).toEqual(["E-100"]);
    expect(verdict.epics.map(({ epicId, cleared, total, allDone }) => ({ epicId, cleared, total, allDone })))
      .toEqual([
        { epicId: "E-100", cleared: 2, total: 2, allDone: true },
        { epicId: "E-200", cleared: 1, total: 2, allDone: false },
        { epicId: "E-300", cleared: 0, total: 0, allDone: false },
      ]);
    expect(verdict.gate).toEqual({
      ok: false,
      name: "repository gate",
      detail: "typecheck failed",
      nextAction: "Run `bun run build` and repair the reported type error.",
    });
    expect(verdict.presweep).toEqual({
      ok: false,
      doneIds: ["T-100-01", "T-100-02", "T-200-01"],
      offenders: ["docs/active/tickets/T-200-02.md", "src/z.ts"],
    });
    expect(verdict.reviewConcerns).toEqual([
      { ticketId: "T-100-02", name: "follow-up naming concern", nextAction: "Resolve the naming note." },
      { ticketId: "T-200-02", name: "missing release proof", nextAction: "Run the release fixture." },
    ]);
    expect(verdict.exceptions).toEqual([
      {
        kind: "gate",
        name: "repository gate",
        message: "typecheck failed",
        nextAction: "Run `bun run build` and repair the reported type error.",
      },
      {
        kind: "presweep",
        name: "docs/active/tickets/T-200-02.md",
        message: "Uncommitted presweep offender: docs/active/tickets/T-200-02.md",
        nextAction: "Commit or restore docs/active/tickets/T-200-02.md, then rerun `bun run check:presweep`.",
      },
      {
        kind: "presweep",
        name: "src/z.ts",
        message: "Uncommitted presweep offender: src/z.ts",
        nextAction: "Commit or restore src/z.ts, then rerun `bun run check:presweep`.",
      },
      {
        kind: "review",
        name: "T-100-02",
        message: "follow-up naming concern",
        nextAction: "Resolve the naming note.",
      },
      {
        kind: "review",
        name: "T-200-02",
        message: "missing release proof",
        nextAction: "Run the release fixture.",
      },
    ]);
    expect(verdict.nextMarker).toEqual({
      version: LAST_SETTLE_MARKER_VERSION,
      doneTicketIds: ["T-100-01", "T-100-02", "T-200-01"],
    });
    expect(verdict.exceptions.every(({ nextAction }) => nextAction.trim().length > 0)).toBe(true);
    // Sorting/copying is internal; caller-owned arrays stay in their original order.
    expect(offenders).toEqual(["src/z.ts", "docs/active/tickets/T-200-02.md"]);
    expect(reviewConcerns.map(({ ticketId }) => ticketId)).toEqual(["T-200-02", "T-100-02"]);
  });

  test("no prior marker is a full-board first-settle summary with no invented exceptions", () => {
    const verdict = computeSettleVerdict(input());
    expect(verdict.kind).toBe("verdict");
    if (verdict.kind !== "verdict") throw new Error("expected settle verdict");
    expect(verdict.delta).toEqual({
      firstSettle: true,
      newlyDoneTicketIds: ["T-100-01", "T-100-02", "T-200-01"],
    });
    expect(verdict.loop).toBeNull();
    expect(verdict.exceptions).toEqual([]);
  });

  test("a valid pending Lisa marker becomes typed whole-loop provenance", () => {
    const verdict = computeSettleVerdict(input({
      loopSettledContents: serializeLisaLoopSettledMarker({
        v: 1,
        kind: "lisa-loop-settled",
        project: "vend",
        ticketsDone: 3,
        durationSecs: 84,
      }),
    }));

    expect(verdict.kind).toBe("verdict");
    if (verdict.kind !== "verdict") throw new Error("expected settle verdict");
    expect(verdict.loop).toEqual({
      v: 1,
      kind: "lisa-loop-settled",
      project: "vend",
      ticketsDone: 3,
      durationSecs: 84,
    });
  });

  test.each([
    ["invalid JSON", "{", "not valid JSON"],
    [
      "schema mismatch",
      '{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":3}',
      "closed v1",
    ],
  ] as const)("a malformed Lisa marker (%s) refuses without verdict claims", (_name, bytes, reason) => {
    const result = computeSettleVerdict(input({ loopSettledContents: bytes }));
    expect(result).toMatchObject({
      kind: "refusal",
      code: "malformed-loop-settled-marker",
      path: ".vend/loop-settled.json",
      nextAction:
        "Repair or remove .vend/loop-settled.json, then rerun `vend settle`; " +
        "the malformed marker was left pending for diagnosis.",
    });
    if (result.kind !== "refusal") throw new Error("expected loop marker refusal");
    expect(result.reason).toContain(reason);
    expect("delta" in result).toBe(false);
  });

  test("writing the returned marker makes an immediate repeated settle report an empty delta", () => {
    const first = computeSettleVerdict(input());
    if (first.kind !== "verdict") throw new Error("expected first settle verdict");

    const repeated = computeSettleVerdict(input({
      lastSettleContents: serializeLastSettleMarker(first.nextMarker),
    }));
    expect(repeated.kind).toBe("verdict");
    if (repeated.kind !== "verdict") throw new Error("expected repeated settle verdict");
    expect(repeated.delta).toEqual({ firstSettle: false, newlyDoneTicketIds: [] });
  });

  test("a malformed marker refuses the aggregate computation by name", () => {
    expect(computeSettleVerdict(input({ lastSettleContents: "not-json" }))).toMatchObject({
      kind: "refusal",
      code: "malformed-last-settle-marker",
      path: LAST_SETTLE_MARKER_PATH,
    });
  });
});
