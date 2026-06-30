import { describe, expect, test } from "bun:test";
import { buildRunRecord, type RunOutcome, type RunRecord } from "../log/run-log.ts";
import {
  countByProject,
  FORWARD_LEDGER_PATH,
  isForwardCleared,
  KEYSTONE_BAR,
  mergeForwardLedger,
  selectForwardCleared,
} from "./portable-core.ts";

// proposed-batch #4 / F3 — the pure portable forward-E1 core. Imports only run-log's PURE record
// helpers (no fs/git/addon), so this is an ordinary pure-function test (the walk-away.ts discipline).

const rec = (
  runId: string,
  outcome: RunOutcome,
  opts: { intervened?: boolean; attested?: boolean; project?: string } = {},
): RunRecord =>
  buildRunRecord({
    runId,
    play: "work",
    epic: "E-062",
    model: "claude-opus-4-8",
    outcome,
    project: opts.project ?? "vend",
    startedAt: "2026-06-30T00:00:00.000Z",
    endedAt: "2026-06-30T00:01:00.000Z",
    ...(opts.intervened !== undefined ? { intervened: opts.intervened } : {}),
    ...(opts.attested ? { intervenedAttested: opts.attested } : {}),
  });

describe("isForwardCleared — the keystone gauge (3 conjuncts)", () => {
  test("success + intervened:false + not attested → true", () => {
    expect(isForwardCleared(rec("r1", "success", { intervened: false }))).toBe(true);
  });
  test("intervened:true → false (the author stepped in)", () => {
    expect(isForwardCleared(rec("r2", "success", { intervened: true }))).toBe(false);
  });
  test("intervened UNRECORDED → false (unknown is not evidence)", () => {
    expect(isForwardCleared(rec("r3", "success"))).toBe(false);
  });
  test("not a success → false", () => {
    expect(isForwardCleared(rec("r4", "gate-failed", { intervened: false }))).toBe(false);
  });
  test("attested back-fill → false (real evidence, but not the forward instrument)", () => {
    expect(isForwardCleared(rec("r5", "success", { intervened: false, attested: true }))).toBe(false);
  });
});

describe("mergeForwardLedger — dedup by runId, only cleared-forward appended", () => {
  test("appends the cleared-forward records from incoming; ignores non-cleared", () => {
    const incoming = [
      rec("a", "success", { intervened: false }),
      rec("b", "success", { intervened: true }), // intervened → not promoted
      rec("c", "gate-failed", { intervened: false }), // not success → not promoted
      rec("d", "success", { intervened: false }),
    ];
    const { merged, added } = mergeForwardLedger([], incoming);
    expect(added.map((r) => r.runId)).toEqual(["a", "d"]);
    expect(merged.map((r) => r.runId)).toEqual(["a", "d"]);
  });

  test("is idempotent — a runId already in the committed ledger is not re-added", () => {
    const existing = [rec("a", "success", { intervened: false })];
    const incoming = [rec("a", "success", { intervened: false }), rec("e", "success", { intervened: false })];
    const { merged, added } = mergeForwardLedger(existing, incoming);
    expect(added.map((r) => r.runId)).toEqual(["e"]); // 'a' already present
    expect(merged.map((r) => r.runId)).toEqual(["a", "e"]); // existing preserved, new appended
  });

  test("existing records are kept even if not cleared-forward (existing is trusted as-is)", () => {
    const existing = [rec("x", "success", { intervened: false })];
    const { merged } = mergeForwardLedger(existing, []);
    expect(merged.map((r) => r.runId)).toEqual(["x"]);
  });
});

describe("selectForwardCleared / countByProject / constants", () => {
  test("selectForwardCleared keeps order and only cleared-forward", () => {
    const recs = [rec("a", "success", { intervened: false }), rec("b", "timed-out", { intervened: false })];
    expect(selectForwardCleared(recs).map((r) => r.runId)).toEqual(["a"]);
  });
  test("countByProject groups + sorts by project", () => {
    const recs = [rec("a", "success", { project: "vend" }), rec("b", "success", { project: "kitchen" }), rec("c", "success", { project: "vend" })];
    expect(countByProject(recs)).toEqual([
      { project: "kitchen", count: 1 },
      { project: "vend", count: 2 },
    ]);
  });
  test("the keystone bar is 10 and the committed ledger is tracked under .vend/", () => {
    expect(KEYSTONE_BAR).toBe(10);
    expect(FORWARD_LEDGER_PATH).toBe(".vend/forward-e1.jsonl");
  });
});
