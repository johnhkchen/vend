import { describe, expect, test } from "bun:test";
import {
  buildRunRecord,
  DEFAULT_PROJECT,
  forPlay,
  projectOf,
  readRuns,
  reviveRecord,
  RUN_LOG_SCHEMA_VERSION,
  RUN_OUTCOMES,
  type RunOutcome,
  type RunRecord,
  type RunRecordInput,
  serializeRunRecord,
  totalTokens,
  wallClockMs,
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

// ── T-013-01: the allocated envelope (write path) ──────────────────────────────────
describe("buildRunRecord — allocated envelope (T-013-01)", () => {
  test("carries an envelope through and round-trips via serialize/parse", () => {
    const rec = buildRunRecord(baseInput({ envelope: { timeMs: 600_000, tokens: 60_000 } }));
    expect(rec.envelope).toEqual({ timeMs: 600_000, tokens: 60_000 });
    const parsed = JSON.parse(serializeRunRecord(rec));
    expect(parsed).toEqual(rec);
  });

  test("absent envelope ⇒ the field is OMITTED, not null (back-compat symmetry)", () => {
    const rec = buildRunRecord(baseInput({ envelope: undefined }));
    expect("envelope" in rec).toBe(false);
    // and the serialized line carries no `envelope` key at all
    expect(serializeRunRecord(rec).includes("envelope")).toBe(false);
  });

  test("non-finite envelope numbers coerce to 0 (the num idiom), never NaN", () => {
    const rec = buildRunRecord(baseInput({ envelope: { timeMs: NaN, tokens: Infinity } }));
    expect(rec.envelope).toEqual({ timeMs: 0, tokens: 0 });
  });
});

// ── T-013-01: the read face — reviveRecord / readRuns / forPlay / derivations ───────
/** Serialize a list of inputs into a JSONL ledger string (the on-disk shape readRuns sees). */
const ledgerOf = (...inputs: RunRecordInput[]): string =>
  inputs.map((i) => serializeRunRecord(buildRunRecord(i))).join("");

describe("readRuns — parse a JSONL ledger, skip+count malformed lines", () => {
  test("parses every well-formed line and reports zero skipped", () => {
    const jsonl = ledgerOf(
      baseInput({ runId: "r1" }),
      baseInput({ runId: "r2", play: "propose-epic" }),
      baseInput({ runId: "r3", outcome: "gate-failed" }),
    );
    const { records, skipped } = readRuns(jsonl);
    expect(records).toHaveLength(3);
    expect(skipped).toBe(0);
    expect(records.map((r) => r.runId)).toEqual(["r1", "r2", "r3"]);
  });

  test("blank lines are ignored, not counted as skipped", () => {
    const jsonl = `\n${ledgerOf(baseInput({ runId: "r1" }))}\n   \n`;
    const { records, skipped } = readRuns(jsonl);
    expect(records).toHaveLength(1);
    expect(skipped).toBe(0);
  });

  test("a non-JSON line and a torn final line are skipped + counted; good lines survive", () => {
    const good = ledgerOf(baseInput({ runId: "r1" }), baseInput({ runId: "r2" }));
    const jsonl = `${good}not json at all\n{"runId":"r3","play":`; // last line is torn (no trailing \n)
    const { records, skipped } = readRuns(jsonl);
    expect(records.map((r) => r.runId)).toEqual(["r1", "r2"]);
    expect(skipped).toBe(2);
  });

  test("a structurally-invalid line (unknown outcome / empty id) is skipped", () => {
    const jsonl = [
      JSON.stringify({ ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput()))), outcome: "exploded" }),
      JSON.stringify({ ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput()))), runId: "" }),
      serializeRunRecord(buildRunRecord(baseInput({ runId: "ok" }))).trimEnd(),
    ].join("\n");
    const { records, skipped } = readRuns(jsonl);
    expect(records.map((r) => r.runId)).toEqual(["ok"]);
    expect(skipped).toBe(2);
  });
});

describe("reviveRecord / readRuns — backward compatibility with pre-T-013-01 records", () => {
  // A verbatim copy of a real v:1 line from .vend/runs.jsonl — no `envelope` field.
  const legacyLine =
    '{"v":1,"runId":"A1","play":"decompose-epic","epic":"E-001","model":"claude-cli-default",' +
    '"outcome":"success","usage":{"input_tokens":10923,"output_tokens":5720,' +
    '"cache_read_input_tokens":39436,"cache_creation_input_tokens":22262},"costUsd":0.4399529999999999,' +
    '"gateResults":[{"gate":"value","passed":true}],' +
    '"startedAt":"2026-06-18T20:49:24.679Z","endedAt":"2026-06-18T20:50:40.749Z"}';

  test("an envelope-less legacy record still parses, with envelope === undefined", () => {
    const { records, skipped } = readRuns(legacyLine);
    expect(skipped).toBe(0);
    expect(records).toHaveLength(1);
    expect(records[0]!.envelope).toBeUndefined();
    expect(records[0]!.runId).toBe("A1");
  });

  test("a record with a malformed envelope keeps its actuals, drops just the envelope", () => {
    const rec = reviveRecord({
      ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "m1" })))),
      envelope: { timeMs: "lots", tokens: null },
    });
    expect(rec).not.toBeNull();
    expect(rec!.envelope).toBeUndefined();
    expect(rec!.runId).toBe("m1");
  });

  test("reviveRecord returns null (never throws) for non-object input", () => {
    expect(reviveRecord(42)).toBeNull();
    expect(reviveRecord(null)).toBeNull();
    expect(reviveRecord("nope")).toBeNull();
  });
});

describe("forPlay — filter by play and (optionally) outcome", () => {
  const { records } = readRuns(
    ledgerOf(
      baseInput({ runId: "d1", play: "decompose-epic", outcome: "success" }),
      baseInput({ runId: "d2", play: "decompose-epic", outcome: "budget-exhausted" }),
      baseInput({ runId: "d3", play: "decompose-epic", outcome: "success" }),
      baseInput({ runId: "p1", play: "propose-epic", outcome: "success" }),
    ),
  );

  test("filters to one play across all outcomes", () => {
    expect(forPlay(records, "decompose-epic").map((r) => r.runId)).toEqual(["d1", "d2", "d3"]);
    expect(forPlay(records, "propose-epic").map((r) => r.runId)).toEqual(["p1"]);
  });

  test("outcome filter partitions successes (uncensored) from censored runs", () => {
    expect(forPlay(records, "decompose-epic", { outcome: "success" }).map((r) => r.runId)).toEqual(["d1", "d3"]);
    expect(forPlay(records, "decompose-epic", { outcome: "budget-exhausted" }).map((r) => r.runId)).toEqual(["d2"]);
  });

  test("an unknown play yields an empty list", () => {
    expect(forPlay(records, "no-such-play")).toEqual([]);
  });
});

describe("project identifier — round-trip, default, malformed (T-013-03 AC #1)", () => {
  test("a supplied project round-trips through build → serialize → revive", () => {
    const rec = buildRunRecord(baseInput({ runId: "pr1", project: "vend" }));
    expect(rec.project).toBe("vend");
    const revived = reviveRecord(JSON.parse(serializeRunRecord(rec)));
    expect(revived!.project).toBe("vend");
  });

  test("an absent project is OMITTED from the record (byte-for-byte back-compat)", () => {
    const rec = buildRunRecord(baseInput({ runId: "pr2" }));
    expect("project" in rec).toBe(false);
    expect(projectOf(rec)).toBe(DEFAULT_PROJECT);
  });

  test("an empty / whitespace project is treated as absent (omitted, default on read)", () => {
    const blank = buildRunRecord(baseInput({ runId: "pr3", project: "   " }));
    expect("project" in blank).toBe(false);
    expect(projectOf(blank)).toBe(DEFAULT_PROJECT);
  });

  test("a present project is trimmed", () => {
    expect(buildRunRecord(baseInput({ project: "  acme  " })).project).toBe("acme");
  });

  test("a malformed project is dropped on revive, the record stays valid", () => {
    const rec = reviveRecord({
      ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "pr4" })))),
      project: 42,
    });
    expect(rec).not.toBeNull();
    expect(rec!.project).toBeUndefined();
    expect(projectOf(rec!)).toBe(DEFAULT_PROJECT);
  });
});

describe("forPlay — group a play's runs by project (T-013-03 AC #1)", () => {
  const { records } = readRuns(
    ledgerOf(
      baseInput({ runId: "a1", play: "decompose-epic", project: "alpha" }),
      baseInput({ runId: "a2", play: "decompose-epic", project: "alpha" }),
      baseInput({ runId: "b1", play: "decompose-epic", project: "beta" }),
      baseInput({ runId: "leg", play: "decompose-epic" }), // no project → default bucket
    ),
  );

  test("the project filter selects only that project's runs", () => {
    expect(forPlay(records, "decompose-epic", { project: "alpha" }).map((r) => r.runId)).toEqual(["a1", "a2"]);
    expect(forPlay(records, "decompose-epic", { project: "beta" }).map((r) => r.runId)).toEqual(["b1"]);
  });

  test("a legacy (project-less) record groups under DEFAULT_PROJECT", () => {
    expect(forPlay(records, "decompose-epic", { project: DEFAULT_PROJECT }).map((r) => r.runId)).toEqual(["leg"]);
  });

  test("project composes with the outcome filter", () => {
    const some = readRuns(
      ledgerOf(
        baseInput({ runId: "s1", play: "p", project: "x", outcome: "success" }),
        baseInput({ runId: "s2", play: "p", project: "x", outcome: "budget-exhausted" }),
        baseInput({ runId: "s3", play: "p", project: "y", outcome: "success" }),
      ),
    ).records;
    expect(forPlay(some, "p", { project: "x", outcome: "success" }).map((r) => r.runId)).toEqual(["s1"]);
  });
});

describe("derivations — wallClockMs and totalTokens", () => {
  const rec: RunRecord = buildRunRecord(
    baseInput({
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 1000, cache_creation_input_tokens: 20 },
      startedAt: "2026-06-18T12:00:00.000Z",
      endedAt: "2026-06-18T12:05:00.000Z",
    }),
  );

  test("wallClockMs = endedAt − startedAt", () => {
    expect(wallClockMs(rec)).toBe(5 * 60 * 1000);
  });

  test("wallClockMs returns null on an unparseable timestamp", () => {
    const bad = reviveRecord({
      ...JSON.parse(serializeRunRecord(rec)),
      endedAt: "not-a-date",
    });
    expect(bad).not.toBeNull();
    expect(wallClockMs(bad!)).toBeNull();
  });

  test("totalTokens sums all four usage buckets", () => {
    expect(totalTokens(rec)).toBe(100 + 50 + 1000 + 20);
  });
});
