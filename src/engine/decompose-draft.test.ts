import { expect, test } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  appendDecomposeDraft,
  buildDecomposeDraftRecord,
  buildDecomposeDraftSettlementRecord,
  DECOMPOSE_DRAFT_SCHEMA_VERSION,
  type DecomposeGateFindings,
  latestDecomposeDraft,
  loadDecomposeDrafts,
  nextDecomposeRepairAction,
  readDecomposeDrafts,
  serializeDecomposeDraftRecord,
  serializeDecomposeDraftSettlementRecord,
  settleDecomposeDraft,
} from "./decompose-draft.ts";

const CLEAR = { status: "clear", cleared: ["value", "structural"] } as const;
const STOP = {
  status: "stop",
  gate: "structural",
  unit: "T-077-99-01",
  reason: "missing required field `phase`",
} as const;

function record(
  runId: string,
  epic: string,
  gateFindings: DecomposeGateFindings = CLEAR,
  subtype?: string,
) {
  return buildDecomposeDraftRecord({
    runId,
    epic,
    parsedDraft: { stories: [{ id: `S-${runId}` }], tickets: [] },
    gateFindings,
    nextRepairAction: nextDecomposeRepairAction(gateFindings, subtype),
    createdAt: "2026-07-13T12:00:00.000Z",
  });
}

function settlement(runId: string, epic: string) {
  return buildDecomposeDraftSettlementRecord({
    runId,
    epic,
    settledAt: "2026-07-13T13:00:00.000Z",
  });
}

test("decompose draft records are schema-versioned JSONL and preserve parsed/gate state", () => {
  const built = record("run-clear", "E-077");
  expect(built.v).toBe(DECOMPOSE_DRAFT_SCHEMA_VERSION);
  expect(built.parsedDraft).toEqual({ stories: [{ id: "S-run-clear" }], tickets: [] });
  expect(built.gateFindings).toEqual(CLEAR);
  expect(built.nextRepairAction).toEqual({
    kind: "resume-at-gates",
    cause: "post-gate-interruption",
  });

  const serialized = serializeDecomposeDraftRecord(built);
  expect(serialized.endsWith("\n")).toBe(true);
  expect(serialized.trimEnd()).toBe(JSON.stringify(built));
});

test("decompose draft settlements are schema-versioned, discriminated JSONL rows", () => {
  const built = settlement("run-settled", "E-077");
  expect(built).toEqual({
    v: DECOMPOSE_DRAFT_SCHEMA_VERSION,
    kind: "settled",
    runId: "run-settled",
    epic: "E-077",
    settledAt: "2026-07-13T13:00:00.000Z",
  });

  const serialized = serializeDecomposeDraftSettlementRecord(built);
  expect(serialized.endsWith("\n")).toBe(true);
  expect(serialized.trimEnd()).toBe(JSON.stringify(built));
});

test("next repair action uses the exact cap-hit subtype and retains a stopped gate as-is", () => {
  expect(nextDecomposeRepairAction(CLEAR, "error_max_turns")).toEqual({
    kind: "resume-at-gates",
    cause: "executor-max-turns",
  });
  expect(nextDecomposeRepairAction(CLEAR, "success")).toEqual({
    kind: "resume-at-gates",
    cause: "post-gate-interruption",
  });
  expect(nextDecomposeRepairAction(STOP, "error_max_turns")).toEqual({
    kind: "repair-gate",
    gate: STOP.gate,
    unit: STOP.unit,
    reason: STOP.reason,
    cause: "executor-max-turns",
  });
  expect(nextDecomposeRepairAction(STOP)).toEqual({
    kind: "repair-gate",
    gate: STOP.gate,
    unit: STOP.unit,
    reason: STOP.reason,
    cause: "gate-stop",
  });
});

test("reader skips malformed, partial, and unsupported rows while preserving valid append order", () => {
  const first = record("run-1", "E-077");
  const second = record("run-2", "E-078", STOP);
  const text = [
    serializeDecomposeDraftRecord(first).trimEnd(),
    "{torn",
    JSON.stringify({ ...first, v: 2 }),
    JSON.stringify({ ...first, nextRepairAction: { kind: "invented" } }),
    serializeDecomposeDraftRecord(second).trimEnd(),
    "",
  ].join("\n");

  const read = readDecomposeDrafts(text);
  expect(read.skipped).toBe(3);
  expect(read.records.map(({ runId }) => runId)).toEqual(["run-1", "run-2"]);
  expect(read.records[1]?.gateFindings).toEqual(STOP);
  expect(read.records[1]?.nextRepairAction).toEqual({
    kind: "repair-gate",
    gate: STOP.gate,
    unit: STOP.unit,
    reason: STOP.reason,
    cause: "gate-stop",
  });
});

test("settlement clears only earlier drafts for its epic and a later failure becomes active", () => {
  const e077First = record("run-1", "E-077");
  const e078 = record("run-2", "E-078");
  const e077Second = record("run-3", "E-077", STOP);
  const settled = settlement("run-4", "E-077");
  const afterSettlement = record("run-5", "E-077", STOP);

  const cleared = readDecomposeDrafts([
    serializeDecomposeDraftRecord(e077First),
    serializeDecomposeDraftRecord(e078),
    serializeDecomposeDraftRecord(e077Second),
    serializeDecomposeDraftSettlementRecord(settled),
  ].join(""));
  expect(cleared.skipped).toBe(0);
  expect(cleared.records.map(({ runId }) => runId)).toEqual(["run-2"]);
  expect(latestDecomposeDraft(cleared.records, "E-077")).toBeNull();
  expect(latestDecomposeDraft(cleared.records, "E-078")?.runId).toBe("run-2");

  const failedAgain = readDecomposeDrafts([
    serializeDecomposeDraftRecord(e077First),
    serializeDecomposeDraftRecord(e078),
    serializeDecomposeDraftSettlementRecord(settled),
    serializeDecomposeDraftRecord(afterSettlement),
  ].join(""));
  expect(failedAgain.records.map(({ runId }) => runId)).toEqual(["run-2", "run-5"]);
  expect(latestDecomposeDraft(failedAgain.records, "E-077")?.runId).toBe("run-5");
});

test("malformed settlement rows are skipped once and do not clear active drafts", () => {
  const active = record("run-active", "E-077");
  const read = readDecomposeDrafts([
    serializeDecomposeDraftRecord(active).trimEnd(),
    JSON.stringify({ v: DECOMPOSE_DRAFT_SCHEMA_VERSION, kind: "settled", runId: "run-bad", epic: "E-077" }),
  ].join("\n"));

  expect(read.skipped).toBe(1);
  expect(read.records.map(({ runId }) => runId)).toEqual(["run-active"]);
});

test("latest draft follows append order globally and within one epic", () => {
  const records = [
    record("run-1", "E-077"),
    record("run-2", "E-078"),
    record("run-3", "E-077", STOP),
  ];
  expect(latestDecomposeDraft(records)?.runId).toBe("run-3");
  expect(latestDecomposeDraft(records, "E-077")?.runId).toBe("run-3");
  expect(latestDecomposeDraft(records, "E-078")?.runId).toBe("run-2");
  expect(latestDecomposeDraft(records, "E-999")).toBeNull();
  expect(latestDecomposeDraft([])).toBeNull();
});

test("loading a missing draft store returns an empty readable result", async () => {
  const path = join(tmpdir(), `vend-missing-decompose-draft-${crypto.randomUUID()}`, "drafts.jsonl");
  await expect(loadDecomposeDrafts({ path })).resolves.toEqual({ records: [], skipped: 0 });
});

test("filesystem settlement leaves raw ledger facts but no active draft", async () => {
  const path = join(tmpdir(), `vend-settled-decompose-draft-${crypto.randomUUID()}`, "drafts.jsonl");
  const draft = record("run-checkpoint", "E-077");
  await appendDecomposeDraft({
    runId: draft.runId,
    epic: draft.epic,
    parsedDraft: draft.parsedDraft,
    gateFindings: draft.gateFindings,
    nextRepairAction: draft.nextRepairAction,
    createdAt: draft.createdAt,
  }, { path });
  expect((await loadDecomposeDrafts({ path })).records).toHaveLength(1);

  await settleDecomposeDraft({
    runId: "run-success",
    epic: "E-077",
    settledAt: "2026-07-13T13:00:00.000Z",
  }, { path });

  const loaded = await loadDecomposeDrafts({ path });
  expect(loaded).toEqual({ records: [], skipped: 0 });
  const raw = (await Bun.file(path).text()).trimEnd().split("\n").map((line) => JSON.parse(line));
  expect(raw).toHaveLength(2);
  expect(raw[0]).toEqual(draft);
  expect(raw[1]).toEqual(settlement("run-success", "E-077"));
});
