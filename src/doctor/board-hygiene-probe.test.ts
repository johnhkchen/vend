import { describe, expect, test } from "bun:test";
import { buildGraph, type RawNode, type WorkGraph } from "../graph/model.ts";
import { EXIT_FAILED, EXIT_OK, renderDoctorReport } from "./doctor-core.ts";
import {
  BOARD_HYGIENE_CHECK,
  BOARD_HYGIENE_OK,
  orphanEpicCheck,
  probeBoardHygiene,
} from "./board-hygiene-probe.ts";

// T-068-03-02 — injected board facts prove the impure doctor probe without fs. Fixtures pass
// through the real buildGraph so the test binds to the canonical frozen graph shape and the pure
// T-068-03-01 detector. Rendering the returned Check[] proves the required CLI exit contract.

function raw(file: string, data: Record<string, unknown>): RawNode {
  return { file, data, body: "" };
}

function epic(id: string): RawNode {
  return raw(`${id}.md`, {
    id,
    title: `Epic ${id}`,
    status: "open",
    advances: ["P3"],
  });
}

function story(id: string, tickets: readonly string[]): RawNode {
  return raw(`${id}.md`, {
    id,
    title: `Story ${id}`,
    type: "story",
    status: "open",
    priority: "medium",
    tickets,
  });
}

function ticket(id: string, storyId: string): RawNode {
  return raw(`${id}.md`, {
    id,
    story: storyId,
    title: `Ticket ${id}`,
    type: "task",
    status: "open",
    priority: "medium",
    phase: "ready",
    depends_on: [],
  });
}

function populatedGraph(): WorkGraph {
  return buildGraph(
    [epic("E-001")],
    [story("S-001-01", ["T-001-01"])],
    [ticket("T-001-01", "S-001-01")],
  );
}

function graphWithOrphans(...orphanIds: string[]): WorkGraph {
  return buildGraph(
    [epic("E-001"), ...orphanIds.map(epic)],
    [story("S-001-01", ["T-001-01"])],
    [ticket("T-001-01", "S-001-01")],
  );
}

describe("probeBoardHygiene — injected board facts", () => {
  test("an orphan epic emits a red Check naming its id + fix-it and renders exit 1", async () => {
    const checks = await probeBoardHygiene({
      loadGraph: async () => graphWithOrphans("E-002"),
    });

    expect(checks).toHaveLength(1);
    expect(checks[0]?.ok).toBe(false);
    expect(checks[0]?.name).toContain("orphan epic E-002");
    expect(checks[0]?.hint).toContain("E-002");
    expect(checks[0]?.hint).toContain("finish decomposing");

    const report = renderDoctorReport(checks);
    expect(report.ok).toBe(false);
    expect(report.exitCode).toBe(EXIT_FAILED);
    expect(report.report).toContain("E-002");
    expect(report.report).toContain("finish decomposing");
  });

  test("a fully populated board stays green and renders exit 0", async () => {
    const checks = await probeBoardHygiene({ loadGraph: async () => populatedGraph() });

    expect(checks).toEqual([{ name: BOARD_HYGIENE_OK, ok: true }]);
    const report = renderDoctorReport(checks);
    expect(report.ok).toBe(true);
    expect(report.exitCode).toBe(EXIT_OK);
    expect(report.report).toContain(BOARD_HYGIENE_OK);
  });

  test("multiple orphans appear in one red Check in deterministic id order", () => {
    const check = orphanEpicCheck(graphWithOrphans("E-003", "E-002"));

    expect(check.ok).toBe(false);
    expect(check.name).toBe(`${BOARD_HYGIENE_CHECK}: orphan epics E-002, E-003`);
    expect(check.hint).toContain("E-002, E-003");
  });

  test("a loader fault becomes a red board-readable Check rather than a rejection", async () => {
    const checks = await probeBoardHygiene({
      loadGraph: async () => {
        throw new Error("broken story edge");
      },
    });

    expect(checks).toEqual([
      {
        name: `${BOARD_HYGIENE_CHECK}: board readable`,
        ok: false,
        hint: "repair the board graph: broken story edge",
      },
    ]);
    expect(renderDoctorReport(checks).exitCode).toBe(EXIT_FAILED);
  });
});
