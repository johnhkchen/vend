import { describe, expect, test } from "bun:test";
import {
  buildRunRecord,
  RUN_LOG_SCHEMA_VERSION,
  RUN_OUTCOMES,
  type RunOutcome,
  type RunRecordInput,
  serializeRunRecord,
} from "./run-log.ts";

// T-001-04 countable-run-log: the two PURE functions (buildRunRecord,
// serializeRunRecord) covered to the branch with fabricated inputs — no fs, no
// spawn, no clock (mirrors budget.test.ts). `appendRunLog` is the thin impure fs
// verb and is deliberately NOT exercised here; its logic is this tested pure pair.
// This file is the gate for `bun run check:test`.

/** A complete, valid input; tests override one field at a time. */
const baseInput = (over: Partial<RunRecordInput> = {}): RunRecordInput => ({
  runId: "run-001",
  play: "decompose-epic",
  epic: "E-001",
  model: "claude-opus-4-8",
  outcome: "success",
  usage: { input_tokens: 1200, output_tokens: 800 },
  costUsd: 0.42,
  gateResults: [{ gate: "typecheck", passed: true }],
  startedAt: "2026-06-18T12:00:00.000Z",
  endedAt: "2026-06-18T12:05:00.000Z",
  ...over,
});

describe("buildRunRecord — happy path", () => {
  test("carries every field through and stamps the schema version", () => {
    const rec = buildRunRecord(baseInput());
    expect(rec.v).toBe(RUN_LOG_SCHEMA_VERSION);
    expect(rec.runId).toBe("run-001");
    expect(rec.play).toBe("decompose-epic");
    expect(rec.epic).toBe("E-001");
    expect(rec.model).toBe("claude-opus-4-8");
    expect(rec.outcome).toBe("success");
    expect(rec.costUsd).toBe(0.42);
    expect(rec.startedAt).toBe("2026-06-18T12:00:00.000Z");
    expect(rec.endedAt).toBe("2026-06-18T12:05:00.000Z");
    expect(rec.gateResults).toEqual([{ gate: "typecheck", passed: true }]);
  });

  test("normalizes a full four-bucket usage", () => {
    const rec = buildRunRecord(
      baseInput({
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 1000,
          cache_creation_input_tokens: 20,
        },
      }),
    );
    expect(rec.usage).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 1000,
      cache_creation_input_tokens: 20,
    });
  });

  test("preserves an optional gate detail and drops extra keys", () => {
    const rec = buildRunRecord(
      baseInput({
        gateResults: [
          { gate: "lint", passed: false, detail: "2 errors" },
          // an extra key the runner attached must not reach the ledger:
          { gate: "test", passed: true, extra: "noise" } as never,
        ],
      }),
    );
    expect(rec.gateResults).toEqual([
      { gate: "lint", passed: false, detail: "2 errors" },
      { gate: "test", passed: true },
    ]);
  });
});

describe("buildRunRecord — normalization of absent / partial / non-finite data", () => {
  test("absent usage → all sub-counts 0", () => {
    const rec = buildRunRecord(baseInput({ usage: undefined }));
    expect(rec.usage).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    });
  });

  test("partial usage → missing sub-counts 0", () => {
    const rec = buildRunRecord(baseInput({ usage: { input_tokens: 10 } }));
    expect(rec.usage.input_tokens).toBe(10);
    expect(rec.usage.output_tokens).toBe(0);
    expect(rec.usage.cache_read_input_tokens).toBe(0);
  });

  test("non-finite usage sub-count → 0", () => {
    const rec = buildRunRecord(baseInput({ usage: { input_tokens: NaN, output_tokens: 10 } }));
    expect(rec.usage.input_tokens).toBe(0);
    expect(rec.usage.output_tokens).toBe(10);
  });

  test("absent costUsd → 0", () => {
    expect(buildRunRecord(baseInput({ costUsd: undefined })).costUsd).toBe(0);
  });

  test("non-finite costUsd → 0", () => {
    expect(buildRunRecord(baseInput({ costUsd: Infinity })).costUsd).toBe(0);
  });

  test("absent gateResults → []", () => {
    expect(buildRunRecord(baseInput({ gateResults: undefined })).gateResults).toEqual([]);
  });
});

describe("buildRunRecord — validation throws RangeError at the boundary", () => {
  test.each(["runId", "play", "epic", "model", "startedAt", "endedAt"] as const)(
    "empty %s throws",
    (field) => {
      expect(() => buildRunRecord(baseInput({ [field]: "" }))).toThrow(RangeError);
    },
  );

  test("unknown outcome throws", () => {
    expect(() => buildRunRecord(baseInput({ outcome: "exploded" as RunOutcome }))).toThrow(RangeError);
  });
});

describe("buildRunRecord — every outcome is accepted, record is frozen", () => {
  test.each([...RUN_OUTCOMES])("accepts outcome %s", (outcome) => {
    const rec = buildRunRecord(baseInput({ outcome }));
    expect(rec.outcome).toBe(outcome);
  });

  test("the returned record is frozen (immutable ledger entry)", () => {
    expect(Object.isFrozen(buildRunRecord(baseInput()))).toBe(true);
  });

  test("a failed run still builds a valid record carrying its failure outcome (AC #2)", () => {
    const rec = buildRunRecord(baseInput({ outcome: "budget-exhausted", costUsd: 9.99 }));
    expect(rec.outcome).toBe("budget-exhausted");
    expect(rec.costUsd).toBe(9.99);
  });
});

describe("serializeRunRecord — countability contract (wc -l / jq)", () => {
  test("ends with exactly one newline and has no interior newline", () => {
    const line = serializeRunRecord(buildRunRecord(baseInput()));
    expect(line.endsWith("\n")).toBe(true);
    expect(line.slice(0, -1).includes("\n")).toBe(false);
  });

  test("round-trips: JSON.parse of the line deep-equals the record", () => {
    const rec = buildRunRecord(baseInput());
    const parsed = JSON.parse(serializeRunRecord(rec));
    expect(parsed).toEqual(rec);
  });

  test("a string field with an embedded newline stays on one physical line", () => {
    const rec = buildRunRecord(
      baseInput({
        gateResults: [{ gate: "test", passed: false, detail: "line1\nline2" }],
        play: "weird\nname",
      }),
    );
    const line = serializeRunRecord(rec);
    // exactly one physical line (one trailing \n, none inside)
    expect(line.split("\n").filter((s) => s.length > 0)).toHaveLength(1);
    // but the data survives round-trip with the newline intact
    const parsed = JSON.parse(line) as typeof rec;
    expect(parsed.play).toBe("weird\nname");
    expect(parsed.gateResults[0]?.detail).toBe("line1\nline2");
  });

  test("two serialized records concatenate into two countable lines", () => {
    const a = serializeRunRecord(buildRunRecord(baseInput({ runId: "a" })));
    const b = serializeRunRecord(buildRunRecord(baseInput({ runId: "b" })));
    const ledger = a + b;
    const lines = ledger.split("\n").filter((s) => s.length > 0);
    expect(lines).toHaveLength(2);
    expect((JSON.parse(lines[0]!) as { runId: string }).runId).toBe("a");
    expect((JSON.parse(lines[1]!) as { runId: string }).runId).toBe("b");
  });
});
