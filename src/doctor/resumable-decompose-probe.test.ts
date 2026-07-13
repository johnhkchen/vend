import { describe, expect, test } from "bun:test";
import {
  buildDecomposeDraftRecord,
  nextDecomposeRepairAction,
  type DecomposeDraftRecord,
} from "../engine/decompose-draft.ts";
import { EXIT_FAILED, EXIT_OK, renderDoctorReport } from "./doctor-core.ts";
import {
  RESUMABLE_DECOMPOSE_CHECK,
  RESUMABLE_DECOMPOSE_OK,
  probeResumableDecompose,
  resumableDecomposeChecks,
} from "./resumable-decompose-probe.ts";

// T-077-04-03 — plain persisted-draft facts prove the doctor condition without filesystem IO.
// Rendering the resulting Checks binds the pure mapping to doctor's shared exit-code contract;
// the separate CLI smoke proves the default cwd-backed store is actually wired.

const CLEAR = { status: "clear", cleared: ["value", "structural"] } as const;

function draft(runId: string, epic: string): DecomposeDraftRecord {
  return buildDecomposeDraftRecord({
    runId,
    epic,
    parsedDraft: { stories: [{ id: `S-${runId}` }], tickets: [] },
    gateFindings: CLEAR,
    nextRepairAction: nextDecomposeRepairAction(CLEAR),
    createdAt: "2026-07-13T12:00:00.000Z",
  });
}

describe("probeResumableDecompose — persisted draft facts", () => {
  test("a draft emits an exact red epic Check with the literal resume command", async () => {
    const checks = await probeResumableDecompose({
      loadDrafts: async () => ({ records: [draft("run-1", "E-077")], skipped: 0 }),
    });

    expect(checks).toEqual([
      {
        name: `${RESUMABLE_DECOMPOSE_CHECK}: E-077`,
        ok: false,
        hint: "resume with `vend run decompose-epic E-077 --resume`",
      },
    ]);

    const report = renderDoctorReport(checks);
    expect(report.ok).toBe(false);
    expect(report.exitCode).toBe(EXIT_FAILED);
    expect(report.report).toContain("✗ resumable-decompose: E-077");
    expect(report.report).toContain("vend run decompose-epic E-077 --resume");
  });

  test("a readable store with no active drafts stays green", async () => {
    const checks = await probeResumableDecompose({
      loadDrafts: async () => ({ records: [], skipped: 0 }),
    });

    expect(checks).toEqual([{ name: RESUMABLE_DECOMPOSE_OK, ok: true }]);
    const report = renderDoctorReport(checks);
    expect(report.ok).toBe(true);
    expect(report.exitCode).toBe(EXIT_OK);
  });

  test("repeated attempts produce one latest-positioned Check per epic", () => {
    const checks = resumableDecomposeChecks([
      draft("run-1", "E-077"),
      draft("run-2", "E-078"),
      draft("run-3", "E-077"),
    ]);

    expect(checks.map(({ name }) => name)).toEqual([
      `${RESUMABLE_DECOMPOSE_CHECK}: E-078`,
      `${RESUMABLE_DECOMPOSE_CHECK}: E-077`,
    ]);
    expect(checks.map(({ hint }) => hint)).toEqual([
      "resume with `vend run decompose-epic E-078 --resume`",
      "resume with `vend run decompose-epic E-077 --resume`",
    ]);
  });

  test("a loader fault becomes a red drafts-readable Check rather than a rejection", async () => {
    const checks = await probeResumableDecompose({
      loadDrafts: async () => {
        throw new Error("permission denied");
      },
    });

    expect(checks).toEqual([
      {
        name: `${RESUMABLE_DECOMPOSE_CHECK}: drafts readable`,
        ok: false,
        hint: "repair the decompose draft store: permission denied",
      },
    ]);
    expect(renderDoctorReport(checks).exitCode).toBe(EXIT_FAILED);
  });
});
