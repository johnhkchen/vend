import { describe, expect, test } from "bun:test";
import { buildGraph, type RawNode, type WorkGraph } from "../graph/model.ts";
import { computeSweep, SWEEP_PROVENANCE_PATH } from "./sweep-core.ts";

function node(file: string, data: Record<string, unknown>): RawNode {
  return { file, data, body: `fixture body for ${String(data.id)}` };
}

function fixtureGraph(doneEpicStatus = "open"): WorkGraph {
  return buildGraph(
    [
      node("E-100.md", {
        id: "E-100",
        title: "cleared epic",
        status: doneEpicStatus,
        advances: [],
        serves: "fixture",
      }),
      node("E-200.md", {
        id: "E-200",
        title: "partial epic",
        status: "active",
        advances: [],
        serves: "fixture",
      }),
    ],
    [
      node("S-100-01.md", {
        id: "S-100-01",
        title: "cleared story",
        status: "open",
        priority: "high",
        tickets: ["T-100-01", "T-100-02"],
      }),
      node("S-200-01.md", {
        id: "S-200-01",
        title: "partial story",
        status: "open",
        priority: "high",
        tickets: ["T-200-01", "T-200-02"],
      }),
    ],
    [
      node("T-100-01.md", {
        id: "T-100-01",
        story: "S-100-01",
        title: "first cleared",
        type: "task",
        status: "open",
        priority: "high",
        phase: "done",
        depends_on: [],
      }),
      node("T-100-02.md", {
        id: "T-100-02",
        story: "S-100-01",
        title: "second cleared",
        type: "task",
        status: "done",
        priority: "high",
        phase: "done",
        depends_on: ["T-100-01"],
      }),
      node("T-200-01.md", {
        id: "T-200-01",
        story: "S-200-01",
        title: "partial cleared",
        type: "task",
        status: "done",
        priority: "medium",
        phase: "done",
        depends_on: [],
      }),
      node("T-200-02.md", {
        id: "T-200-02",
        story: "S-200-01",
        title: "still active",
        type: "task",
        status: "done",
        priority: "medium",
        phase: "review",
        depends_on: ["T-200-01"],
      }),
    ],
  );
}

function partialOnlyGraph(): WorkGraph {
  return buildGraph(
    [
      node("E-200.md", {
        id: "E-200",
        title: "partial epic",
        status: "active",
        advances: [],
        serves: "fixture",
      }),
    ],
    [
      node("S-200-01.md", {
        id: "S-200-01",
        title: "partial story",
        status: "open",
        priority: "high",
        tickets: ["T-200-01", "T-200-02"],
      }),
    ],
    [
      node("T-200-01.md", {
        id: "T-200-01",
        story: "S-200-01",
        title: "partial cleared",
        type: "task",
        status: "done",
        priority: "medium",
        phase: "done",
        depends_on: [],
      }),
      node("T-200-02.md", {
        id: "T-200-02",
        story: "S-200-01",
        title: "still active",
        type: "task",
        status: "done",
        priority: "medium",
        phase: "review",
        depends_on: ["T-200-01"],
      }),
    ],
  );
}

const doneIds = ["T-100-01", "T-100-02", "T-200-01"] as const;

describe("computeSweep — assembled flip set", () => {
  test("one all-done and one partial epic produce exactly the done epic's scoped flip set", () => {
    expect(computeSweep({
      graph: fixtureGraph(),
      presweep: { ok: true, doneIds, offenders: [] },
      provenanceDirty: false,
    })).toEqual({
      kind: "flip-set",
      flips: [
        {
          epicId: "E-100",
          path: "docs/active/epic/E-100.md",
          field: "status",
          from: "open",
          to: "done",
          clearedTicketIds: ["T-100-01", "T-100-02"],
        },
      ],
      provenancePath: null,
      pathspec: ["docs/active/epic/E-100.md"],
      message: "sweep: close E-100\n\nE-100 cleared by T-100-01, T-100-02",
    });
  });

  test("dirty Lisa provenance is explicit cargo after the exact epic paths", () => {
    const result = computeSweep({
      graph: fixtureGraph(),
      presweep: { ok: true, doneIds, offenders: [] },
      provenanceDirty: true,
    });

    expect(result).toMatchObject({
      kind: "flip-set",
      provenancePath: SWEEP_PROVENANCE_PATH,
      pathspec: ["docs/active/epic/E-100.md", SWEEP_PROVENANCE_PATH],
      message: "sweep: close E-100\n\nE-100 cleared by T-100-01, T-100-02",
    });
  });
});

describe("computeSweep — named refusals", () => {
  test("presweep offenders refuse before any flip is assembled", () => {
    const result = computeSweep({
      graph: fixtureGraph(),
      presweep: {
        ok: false,
        doneIds,
        offenders: ["src/z.ts", "docs/active/tickets/T-100-02.md", "src/z.ts"],
      },
      provenanceDirty: true,
    });

    expect(result).toEqual({
      kind: "refusal",
      code: "presweep-offenders",
      offenders: ["docs/active/tickets/T-100-02.md", "src/z.ts"],
      reason: "Presweep could not prove that phase-done work is committed.",
      nextAction:
        "Commit or restore docs/active/tickets/T-100-02.md, src/z.ts, then rerun `vend sweep`.",
    });
    expect("flips" in result).toBe(false);
  });

  test("a board with only a partial epic has no empty success plan", () => {
    expect(computeSweep({
      graph: partialOnlyGraph(),
      presweep: { ok: true, doneIds: ["T-200-01"], offenders: [] },
      provenanceDirty: false,
    })).toEqual({
      kind: "refusal",
      code: "no-epics-ready",
      reason: "No all-done epic needs a status flip.",
      nextAction: "Wait until an open epic has all tickets at phase: done, then rerun `vend sweep`.",
    });
  });

  test("an already-done epic is not rewritten", () => {
    expect(computeSweep({
      graph: fixtureGraph("done"),
      presweep: { ok: true, doneIds, offenders: [] },
      provenanceDirty: false,
    })).toMatchObject({ kind: "refusal", code: "no-epics-ready" });
  });

  test("a presweep from another board snapshot is a named retryable refusal", () => {
    expect(computeSweep({
      graph: fixtureGraph(),
      presweep: { ok: true, doneIds: ["T-100-01"], offenders: [] },
      provenanceDirty: false,
    })).toEqual({
      kind: "refusal",
      code: "stale-presweep",
      expectedDoneTicketIds: ["T-100-01", "T-100-02", "T-200-01"],
      observedDoneTicketIds: ["T-100-01"],
      reason: "Presweep and the current board describe different phase-done ticket sets.",
      nextAction: "Rerun presweep against the current board, then rerun `vend sweep`.",
    });
  });
});

describe("computeSweep — contract invariants", () => {
  test("inconsistent presweep values are programmer errors", () => {
    expect(() => computeSweep({
      graph: fixtureGraph(),
      presweep: { ok: true, doneIds, offenders: ["src/x.ts"] },
      provenanceDirty: false,
    })).toThrow(TypeError);
    expect(() => computeSweep({
      graph: fixtureGraph(),
      presweep: { ok: false, doneIds, offenders: [] },
      provenanceDirty: false,
    })).toThrow(TypeError);
  });

  test("canonicalization does not mutate caller arrays", () => {
    const callerDoneIds = ["T-200-01", "T-100-01", "T-100-02", "T-100-01"];
    const callerOffenders: string[] = [];
    const beforeDoneIds = [...callerDoneIds];

    expect(computeSweep({
      graph: fixtureGraph(),
      presweep: { ok: true, doneIds: callerDoneIds, offenders: callerOffenders },
      provenanceDirty: false,
    }).kind).toBe("flip-set");
    expect(callerDoneIds).toEqual(beforeDoneIds);
    expect(callerOffenders).toEqual([]);
  });
});
