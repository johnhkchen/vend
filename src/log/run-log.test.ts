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
  type UsageInput,
  wallClockMs,
} from "./run-log.ts";
import { recalibrate } from "../ledger/recalibrate.ts";

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
  test("includes the unknown-seat materialization andon", () => {
    expect(RUN_OUTCOMES).toContain("unknown-seat");
  });

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

describe("intervention bit — round-trip, absence, false-is-a-value, malformed (T-014-01 AC #1)", () => {
  test("intervened: true round-trips through build → serialize → revive", () => {
    const rec = buildRunRecord(baseInput({ runId: "iv1", intervened: true }));
    expect(rec.intervened).toBe(true);
    const revived = reviveRecord(JSON.parse(serializeRunRecord(rec)));
    expect(revived!.intervened).toBe(true);
  });

  test("intervened: false is a VALUE (clean walk-away), written and round-tripped — not absence", () => {
    const rec = buildRunRecord(baseInput({ runId: "iv2", intervened: false }));
    expect("intervened" in rec).toBe(true);
    expect(rec.intervened).toBe(false);
    const revived = reviveRecord(JSON.parse(serializeRunRecord(rec)));
    expect(revived!.intervened).toBe(false);
  });

  test("an absent intervened is OMITTED from the record (byte-for-byte back-compat)", () => {
    const rec = buildRunRecord(baseInput({ runId: "iv3" }));
    expect("intervened" in rec).toBe(false);
    expect(rec.intervened).toBeUndefined();
  });

  test("a non-boolean intervened is coerced to absent on build (legal, not a caller error)", () => {
    const rec = buildRunRecord(baseInput({ runId: "iv4", intervened: "yes" as unknown as boolean }));
    expect("intervened" in rec).toBe(false);
  });

  test("a malformed intervened is dropped on revive, the record stays valid", () => {
    const rec = reviveRecord({
      ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "iv5" })))),
      intervened: "yes",
    });
    expect(rec).not.toBeNull();
    expect(rec!.intervened).toBeUndefined();
    expect(rec!.runId).toBe("iv5");
  });

  test("a pre-T-014-01 line (no intervened field) parses, with intervened === undefined", () => {
    const legacyLine =
      '{"v":1,"runId":"L1","play":"decompose-epic","epic":"E-001","model":"claude-cli-default",' +
      '"outcome":"success","usage":{"input_tokens":1,"output_tokens":2,' +
      '"cache_read_input_tokens":3,"cache_creation_input_tokens":4},"costUsd":0.1,"gateResults":[],' +
      '"startedAt":"2026-06-18T20:49:24.679Z","endedAt":"2026-06-18T20:50:40.749Z"}';
    const { records, skipped } = readRuns(legacyLine);
    expect(skipped).toBe(0);
    expect(records[0]!.intervened).toBeUndefined();
  });
});

describe("intervention provenance — attested back-fill vs forward (T-028-01 AC #1)", () => {
  /** A raw parsed line as `attest-intervention.ts` writes it: the bit PLUS the marker object. */
  const attestedLine = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "bf", intervened: false })))),
    intervenedAttestation: { by: "john", at: "2026-06-19T04:50:43.479Z", basis: "real clearing run" },
    ...over,
  });

  test("a back-fill line carrying the intervenedAttestation marker revives as attested", () => {
    const revived = reviveRecord(attestedLine());
    expect(revived).not.toBeNull();
    expect(revived!.intervenedAttested).toBe(true);
    expect(revived!.intervened).toBe(false); // the bit itself is preserved, attested as a walk-away
  });

  test("a plain forward line (intervened set, no marker) is NOT attested — field omitted", () => {
    const fwd = reviveRecord(JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "fw", intervened: true })))));
    expect(fwd!.intervened).toBe(true);
    expect("intervenedAttested" in fwd!).toBe(false);
    expect(fwd!.intervenedAttested).toBeUndefined();
  });

  test("an explicit intervenedAttested: true on the line is surfaced (write-symmetry path)", () => {
    const revived = reviveRecord({
      ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "fa", intervened: false })))),
      intervenedAttested: true,
    });
    expect(revived!.intervenedAttested).toBe(true);
  });

  test("a non-object intervenedAttestation does not trip the flag (truthy-object check)", () => {
    const revived = reviveRecord(attestedLine({ intervenedAttestation: "yes" }));
    expect("intervenedAttested" in revived!).toBe(false);
  });

  test("a record with no intervened bit at all carries no provenance flag, stays valid", () => {
    const revived = reviveRecord(JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "none" })))));
    expect(revived).not.toBeNull();
    expect("intervenedAttested" in revived!).toBe(false);
  });

  test("buildRunRecord round-trips intervenedAttested: true; false is omitted (one-way flag)", () => {
    const attested = buildRunRecord(baseInput({ runId: "ba", intervened: false, intervenedAttested: true }));
    expect(attested.intervenedAttested).toBe(true);
    expect(reviveRecord(JSON.parse(serializeRunRecord(attested)))!.intervenedAttested).toBe(true);

    const forward = buildRunRecord(baseInput({ runId: "bf2", intervened: true, intervenedAttested: false }));
    expect("intervenedAttested" in forward).toBe(false); // false is never written — byte-identical to forward
  });
});

describe("turnsUsed — round-trip, absence, normalization, malformed (T-015-02 AC #2)", () => {
  test("turnsUsed round-trips through build → serialize → revive", () => {
    const rec = buildRunRecord(baseInput({ runId: "tu1", turnsUsed: 7 }));
    expect(rec.turnsUsed).toBe(7);
    const revived = reviveRecord(JSON.parse(serializeRunRecord(rec)));
    expect(revived!.turnsUsed).toBe(7);
  });

  test("turnsUsed: 0 is a VALUE (a no-turn run), written and round-tripped — not absence", () => {
    const rec = buildRunRecord(baseInput({ runId: "tu2", turnsUsed: 0 }));
    expect("turnsUsed" in rec).toBe(true);
    expect(rec.turnsUsed).toBe(0);
    const revived = reviveRecord(JSON.parse(serializeRunRecord(rec)));
    expect(revived!.turnsUsed).toBe(0);
  });

  test("an absent turnsUsed is OMITTED from the record (byte-for-byte back-compat)", () => {
    const rec = buildRunRecord(baseInput({ runId: "tu3" }));
    expect("turnsUsed" in rec).toBe(false);
    expect(rec.turnsUsed).toBeUndefined();
    expect(serializeRunRecord(rec).includes("turnsUsed")).toBe(false);
  });

  test("a non-finite / negative / non-integer turnsUsed is coerced to absent on build", () => {
    expect("turnsUsed" in buildRunRecord(baseInput({ runId: "tu4", turnsUsed: NaN }))).toBe(false);
    expect("turnsUsed" in buildRunRecord(baseInput({ runId: "tu5", turnsUsed: -1 }))).toBe(false);
    expect("turnsUsed" in buildRunRecord(baseInput({ runId: "tu6", turnsUsed: 2.5 }))).toBe(false);
  });

  test("a malformed turnsUsed is dropped on revive, the record stays valid", () => {
    const rec = reviveRecord({
      ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "tu7" })))),
      turnsUsed: "lots",
    });
    expect(rec).not.toBeNull();
    expect(rec!.turnsUsed).toBeUndefined();
    expect(rec!.runId).toBe("tu7");
  });

  test("a pre-T-015-02 line (no turnsUsed field) parses, with turnsUsed === undefined", () => {
    const legacyLine =
      '{"v":1,"runId":"L2","play":"decompose-epic","epic":"E-001","model":"claude-cli-default",' +
      '"outcome":"success","usage":{"input_tokens":1,"output_tokens":2,' +
      '"cache_read_input_tokens":3,"cache_creation_input_tokens":4},"costUsd":0.1,"gateResults":[],' +
      '"startedAt":"2026-06-18T20:49:24.679Z","endedAt":"2026-06-18T20:50:40.749Z"}';
    const { records, skipped } = readRuns(legacyLine);
    expect(skipped).toBe(0);
    expect(records[0]!.turnsUsed).toBeUndefined();
  });
});

describe("reducedGrounding marker — round-trip, absence, one-way, malformed, legacy (T-060-01-02 AC)", () => {
  test("reducedGrounding: true round-trips through build → serialize → revive (survives the read boundary)", () => {
    const rec = buildRunRecord(baseInput({ runId: "rg1", reducedGrounding: true }));
    expect(rec.reducedGrounding).toBe(true);
    const revived = reviveRecord(JSON.parse(serializeRunRecord(rec)));
    expect(revived!.reducedGrounding).toBe(true);
  });

  test("an absent reducedGrounding is OMITTED from the record (byte-for-byte back-compat)", () => {
    const rec = buildRunRecord(baseInput({ runId: "rg2" }));
    expect("reducedGrounding" in rec).toBe(false);
    expect(rec.reducedGrounding).toBeUndefined();
    expect(serializeRunRecord(rec).includes("reducedGrounding")).toBe(false);
  });

  test("reducedGrounding: false is a ONE-WAY flag — never written (a fully-grounded run carries no marker)", () => {
    const rec = buildRunRecord(baseInput({ runId: "rg3", reducedGrounding: false }));
    expect("reducedGrounding" in rec).toBe(false);
    expect(rec.reducedGrounding).toBeUndefined();
    expect(serializeRunRecord(rec).includes("reducedGrounding")).toBe(false);
  });

  test("a non-boolean reducedGrounding is coerced to absent on build (legal, not a caller error)", () => {
    const rec = buildRunRecord(baseInput({ runId: "rg4", reducedGrounding: "yes" as unknown as boolean }));
    expect("reducedGrounding" in rec).toBe(false);
  });

  test("a malformed reducedGrounding is dropped on revive, the record stays valid", () => {
    const rec = reviveRecord({
      ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "rg5" })))),
      reducedGrounding: "yes",
    });
    expect(rec).not.toBeNull();
    expect(rec!.reducedGrounding).toBeUndefined();
    expect(rec!.runId).toBe("rg5");
  });

  test("a pre-T-060-01-02 line (no reducedGrounding field) parses, with reducedGrounding === undefined", () => {
    const legacyLine =
      '{"v":1,"runId":"L3","play":"decompose-epic","epic":"E-060","model":"claude-cli-default",' +
      '"outcome":"success","usage":{"input_tokens":1,"output_tokens":2,' +
      '"cache_read_input_tokens":3,"cache_creation_input_tokens":4},"costUsd":0.1,"gateResults":[],' +
      '"startedAt":"2026-06-18T20:49:24.679Z","endedAt":"2026-06-18T20:50:40.749Z"}';
    const { records, skipped } = readRuns(legacyLine);
    expect(skipped).toBe(0);
    expect(records[0]!.reducedGrounding).toBeUndefined();
  });
});

describe("overEnvelope marker — round-trip, byte compatibility, one-way, malformed, legacy (T-068-02-01 AC)", () => {
  test("overEnvelope: true round-trips through build → serialize → revive (survives the read boundary)", () => {
    const rec = buildRunRecord(baseInput({ runId: "oe1", overEnvelope: true }));
    expect(rec.overEnvelope).toBe(true);
    const revived = reviveRecord(JSON.parse(serializeRunRecord(rec)));
    expect(revived!.overEnvelope).toBe(true);
  });

  test("an absent overEnvelope is OMITTED from the record (byte-for-byte back-compat)", () => {
    const rec = buildRunRecord(baseInput({ runId: "oe2" }));
    expect("overEnvelope" in rec).toBe(false);
    expect(rec.overEnvelope).toBeUndefined();
    expect(serializeRunRecord(rec).includes("overEnvelope")).toBe(false);
  });

  test("overEnvelope: false is one-way and serializes byte-identically to an absent marker", () => {
    const absent = buildRunRecord(baseInput({ runId: "oe3" }));
    const explicitFalse = buildRunRecord(baseInput({ runId: "oe3", overEnvelope: false }));
    expect("overEnvelope" in explicitFalse).toBe(false);
    expect(explicitFalse.overEnvelope).toBeUndefined();
    expect(serializeRunRecord(explicitFalse)).toBe(serializeRunRecord(absent));
  });

  test("a non-boolean overEnvelope is coerced to absent on build (legal, not a caller error)", () => {
    const rec = buildRunRecord(baseInput({ runId: "oe4", overEnvelope: "yes" as unknown as boolean }));
    expect("overEnvelope" in rec).toBe(false);
  });

  test("a malformed overEnvelope is dropped on revive, the record stays valid", () => {
    const rec = reviveRecord({
      ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "oe5" })))),
      overEnvelope: "yes",
    });
    expect(rec).not.toBeNull();
    expect(rec!.overEnvelope).toBeUndefined();
    expect(rec!.runId).toBe("oe5");
  });

  test("a pre-E-068 line (no overEnvelope field) parses, with overEnvelope === undefined", () => {
    const legacyLine =
      '{"v":1,"runId":"L4","play":"decompose-epic","epic":"E-067","model":"claude-cli-default",' +
      '"outcome":"success","usage":{"input_tokens":1,"output_tokens":2,' +
      '"cache_read_input_tokens":3,"cache_creation_input_tokens":4},"costUsd":0.1,"gateResults":[],' +
      '"startedAt":"2026-06-18T20:49:24.679Z","endedAt":"2026-06-18T20:50:40.749Z"}';
    const { records, skipped } = readRuns(legacyLine);
    expect(skipped).toBe(0);
    expect(records[0]!.overEnvelope).toBeUndefined();
  });
});

describe("seatDefaulted marker — structured round-trip, byte compatibility, malformed, legacy (T-070-01-01 AC)", () => {
  const marker = {
    requested: "kodex",
    applied: "claude",
    reason: "unknown-seat",
  } as const;

  const preE070Line =
    '{"v":1,"runId":"sd2","play":"decompose-epic","epic":"E-001","model":"claude-opus-4-8",' +
    '"outcome":"success","usage":{"input_tokens":1200,"output_tokens":800,' +
    '"cache_read_input_tokens":0,"cache_creation_input_tokens":0},"costUsd":0.42,' +
    '"gateResults":[{"gate":"typecheck","passed":true}],' +
    '"startedAt":"2026-06-18T12:00:00.000Z","endedAt":"2026-06-18T12:05:00.000Z"}\n';

  test("requested raw seat, applied default, and reason serialize/revive byte-stably", () => {
    const rec = buildRunRecord(baseInput({ runId: "sd1", seatDefaulted: marker }));
    expect(rec.seatDefaulted).toEqual(marker);

    const line = serializeRunRecord(rec);
    const revived = reviveRecord(JSON.parse(line));
    expect(revived).not.toBeNull();
    expect(revived!.seatDefaulted).toEqual(marker);
    expect(serializeRunRecord(revived!)).toBe(line);
  });

  test("an absent marker emits a byte-identical pre-E-070 record", () => {
    const rec = buildRunRecord(baseInput({ runId: "sd2" }));
    expect("seatDefaulted" in rec).toBe(false);
    expect(serializeRunRecord(rec).includes("seatDefaulted")).toBe(false);
    expect(serializeRunRecord(rec)).toBe(preE070Line);
  });

  test("a pre-E-070 line revives without a marker", () => {
    const { records, skipped } = readRuns(preE070Line);
    expect(skipped).toBe(0);
    expect(records).toHaveLength(1);
    expect("seatDefaulted" in records[0]!).toBe(false);
  });

  test("a partial marker is omitted atomically on build", () => {
    const rec = buildRunRecord(
      baseInput({
        runId: "sd3",
        seatDefaulted: { requested: "kodex", applied: "claude" },
      } as never),
    );
    expect("seatDefaulted" in rec).toBe(false);
    expect(serializeRunRecord(rec).includes("seatDefaulted")).toBe(false);
  });

  test("a valid marker is canonically copied without extra nested fields", () => {
    const rec = buildRunRecord(
      baseInput({
        runId: "sd4",
        seatDefaulted: { ...marker, diagnostic: "do-not-persist" },
      } as never),
    );
    expect(rec.seatDefaulted).toEqual(marker);
  });

  test("malformed marker metadata is dropped on revive without losing the record", () => {
    const rec = reviveRecord({
      ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "sd5" })))),
      seatDefaulted: { requested: "kodex", applied: 42, reason: "unknown-seat" },
    });
    expect(rec).not.toBeNull();
    expect(rec!.runId).toBe("sd5");
    expect("seatDefaulted" in rec!).toBe(false);
  });
});

describe("seatInferred marker — structured readRuns round-trip, byte compatibility, malformed (T-071-02-02 AC)", () => {
  const marker = {
    seat: "codex",
    reason: "recent cost-weighted burn: claude hotter",
  } as const;

  const preSeatInferredLine =
    '{"v":1,"runId":"si2","play":"decompose-epic","epic":"E-001","model":"claude-opus-4-8",' +
    '"outcome":"success","usage":{"input_tokens":1200,"output_tokens":800,' +
    '"cache_read_input_tokens":0,"cache_creation_input_tokens":0},"costUsd":0.42,' +
    '"gateResults":[{"gate":"typecheck","passed":true}],' +
    '"startedAt":"2026-06-18T12:00:00.000Z","endedAt":"2026-06-18T12:05:00.000Z"}\n';

  test("chosen seat and heat reason survive build and a byte-stable readRuns round-trip", () => {
    const built = buildRunRecord(baseInput({ runId: "si1", seatInferred: marker }));
    expect(built.seatInferred).toEqual(marker);

    const line = serializeRunRecord(built);
    const { records, skipped } = readRuns(line);
    expect(skipped).toBe(0);
    expect(records).toHaveLength(1);
    expect(records[0]!.seatInferred).toEqual(marker);
    expect(serializeRunRecord(records[0]!)).toBe(line);
  });

  test("an absent marker emits a byte-identical pre-seatInferred record", () => {
    const rec = buildRunRecord(baseInput({ runId: "si2" }));
    expect("seatInferred" in rec).toBe(false);
    expect(serializeRunRecord(rec).includes("seatInferred")).toBe(false);
    expect(serializeRunRecord(rec)).toBe(preSeatInferredLine);
  });

  test("a partial marker is omitted atomically and byte-identically to absence on build", () => {
    const rec = buildRunRecord(
      baseInput({
        runId: "si2",
        seatInferred: { seat: "codex" },
      } as never),
    );
    expect("seatInferred" in rec).toBe(false);
    expect(serializeRunRecord(rec)).toBe(preSeatInferredLine);
  });

  test("a valid marker is canonically copied without extra nested fields", () => {
    const rec = buildRunRecord(
      baseInput({
        runId: "si3",
        seatInferred: { ...marker, diagnostic: "do-not-persist" },
      } as never),
    );
    expect(rec.seatInferred).toEqual(marker);
  });

  test("malformed marker metadata is dropped on revive without losing the record", () => {
    const rec = reviveRecord({
      ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "si4" })))),
      seatInferred: { seat: "codex", reason: 42 },
    });
    expect(rec).not.toBeNull();
    expect(rec!.runId).toBe("si4");
    expect("seatInferred" in rec!).toBe(false);
  });
});

describe("seatOfExecution — raw round-trip, byte compatibility, malformed, legacy (T-071-01-01 AC)", () => {
  const preE071Line =
    '{"v":1,"runId":"se2","play":"decompose-epic","epic":"E-001","model":"claude-opus-4-8",' +
    '"outcome":"success","usage":{"input_tokens":1200,"output_tokens":800,' +
    '"cache_read_input_tokens":0,"cache_creation_input_tokens":0},"costUsd":0.42,' +
    '"gateResults":[{"gate":"typecheck","passed":true}],' +
    '"startedAt":"2026-06-18T12:00:00.000Z","endedAt":"2026-06-18T12:05:00.000Z"}\n';

  test("a supplied raw seat survives build and the readRuns round-trip verbatim without KNOWN_SEATS policing", () => {
    const rawSeat = "future-lane/raw";
    const built = buildRunRecord(baseInput({ runId: "se1", seatOfExecution: rawSeat }));
    expect(built.seatOfExecution).toBe(rawSeat);

    const line = serializeRunRecord(built);
    const { records, skipped } = readRuns(line);
    expect(skipped).toBe(0);
    expect(records).toHaveLength(1);
    expect(records[0]!.seatOfExecution).toBe(rawSeat);
    expect(serializeRunRecord(records[0]!)).toBe(line);
  });

  test("an absent seat emits a byte-identical pre-E-071 record", () => {
    const rec = buildRunRecord(baseInput({ runId: "se2" }));
    expect("seatOfExecution" in rec).toBe(false);
    expect(serializeRunRecord(rec).includes("seatOfExecution")).toBe(false);
    expect(serializeRunRecord(rec)).toBe(preE071Line);
  });

  test("a pre-E-071 line survives readRuns with the seat omitted rather than defaulted", () => {
    const { records, skipped } = readRuns(preE071Line);
    expect(skipped).toBe(0);
    expect(records).toHaveLength(1);
    expect("seatOfExecution" in records[0]!).toBe(false);
  });

  test("a malformed seat is dropped on revive without losing the record", () => {
    const rec = reviveRecord({
      ...JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "se3" })))),
      seatOfExecution: 42,
    });
    expect(rec).not.toBeNull();
    expect(rec!.runId).toBe("se3");
    expect("seatOfExecution" in rec!).toBe(false);
  });
});

describe("capturedDiff — artifact-reference round-trip and omission (T-073-01-01)", () => {
  test("a non-empty reference round-trips through build, serialize, and revive", () => {
    const reference = ".vend/artifacts/run-diff.diff";
    const built = buildRunRecord(baseInput({ runId: "diff1", capturedDiff: reference }));
    expect(built.capturedDiff).toBe(reference);
    const revived = reviveRecord(JSON.parse(serializeRunRecord(built)));
    expect(revived?.capturedDiff).toBe(reference);
  });

  test("absent and empty references are omitted", () => {
    const absent = buildRunRecord(baseInput({ runId: "diff2" }));
    const empty = buildRunRecord(baseInput({ runId: "diff3", capturedDiff: "" }));
    expect("capturedDiff" in absent).toBe(false);
    expect("capturedDiff" in empty).toBe(false);
  });

  test("malformed optional metadata is dropped without losing the record", () => {
    const raw = JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "diff4" }))));
    const revived = reviveRecord({ ...raw, capturedDiff: 42 });
    expect(revived).not.toBeNull();
    expect("capturedDiff" in revived!).toBe(false);
  });
});

describe("crossVendorVerdict — reviewed and inert run-log round trip (T-073-01-04 AC)", () => {
  test("a cross-reviewed line carries both seats and pass/fail while a single-seat line carries no verdict", () => {
    const verdict = {
      authoringSeat: "claude",
      reviewingSeat: "codex",
      verdict: "pass",
      detail: "No blocking defect found",
    } as const;
    const reviewedLine = serializeRunRecord(
      buildRunRecord(baseInput({ runId: "xv-reviewed", crossVendorVerdict: verdict })),
    );
    const singleSeatLine = serializeRunRecord(buildRunRecord(baseInput({ runId: "xv-single-seat" })));
    const jsonl = reviewedLine + singleSeatLine;

    const rawLines = jsonl.trimEnd().split("\n").map((line) => JSON.parse(line));
    expect(rawLines[0].crossVendorVerdict).toEqual(verdict);
    expect("crossVendorVerdict" in rawLines[1]).toBe(false);

    const { records, skipped } = readRuns(jsonl);
    expect(skipped).toBe(0);
    expect(records).toHaveLength(2);
    expect(records[0]!.crossVendorVerdict).toEqual(verdict);
    expect("crossVendorVerdict" in records[1]!).toBe(false);
  });

  test("a fail verdict and its detail survive a byte-stable readRuns round trip", () => {
    const verdict = {
      authoringSeat: "codex",
      reviewingSeat: "claude",
      verdict: "fail",
      detail: "The new branch drops the recorded artifact",
    } as const;
    const line = serializeRunRecord(
      buildRunRecord(baseInput({ runId: "xv-fail", crossVendorVerdict: verdict })),
    );
    const { records, skipped } = readRuns(line);

    expect(skipped).toBe(0);
    expect(records[0]!.crossVendorVerdict).toEqual(verdict);
    expect(serializeRunRecord(records[0]!)).toBe(line);
  });

  test("detail is optional and is not synthesized for a pass", () => {
    const verdict = {
      authoringSeat: "claude",
      reviewingSeat: "codex",
      verdict: "pass",
    } as const;
    const built = buildRunRecord(baseInput({ runId: "xv-pass", crossVendorVerdict: verdict }));
    expect(built.crossVendorVerdict).toEqual(verdict);
    expect("detail" in built.crossVendorVerdict!).toBe(false);
  });

  test("partial provenance is omitted atomically on build", () => {
    const built = buildRunRecord(
      baseInput({
        runId: "xv-partial",
        crossVendorVerdict: { authoringSeat: "claude", verdict: "pass" },
      } as never),
    );
    expect("crossVendorVerdict" in built).toBe(false);
    expect(serializeRunRecord(built).includes("crossVendorVerdict")).toBe(false);
  });

  test("malformed optional verdict metadata is dropped without losing the run", () => {
    const raw = JSON.parse(serializeRunRecord(buildRunRecord(baseInput({ runId: "xv-malformed" }))));
    const revived = reviveRecord({
      ...raw,
      crossVendorVerdict: {
        authoringSeat: "claude",
        reviewingSeat: 42,
        verdict: "pass",
      },
    });

    expect(revived).not.toBeNull();
    expect(revived!.runId).toBe("xv-malformed");
    expect("crossVendorVerdict" in revived!).toBe(false);
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

  test("totalTokens COST-WEIGHTS the four usage buckets (not a parity sum)", () => {
    // input·1.0 + output·5.0 + cache_read·0.1 + cache_creation·1.25
    expect(totalTokens(rec)).toBe(100 * 1.0 + 50 * 5.0 + 1000 * 0.1 + 20 * 1.25); // = 475
    // and it is NOT the old parity sum — the whole point of the reweight
    expect(totalTokens(rec)).not.toBe(100 + 50 + 1000 + 20);
  });
});

// ── T-068-01-03: totalTokens is cost-weighted, mirroring budget's COST_WEIGHTS ──────
describe("totalTokens — cost-weighted, inline mirror of budget's COST_WEIGHTS (T-068-01-03 AC)", () => {
  // The confirmed vector (T-068-01-01), pinned here to match budget.test.ts's COST_WEIGHTS
  // guard. This is the drift tripwire: run-log's inline copy and budget's exported copy MUST
  // agree, and neither may drift back to parity (all 1.0). If budget's vector changes, this and
  // budget.test.ts's guard both change — they are kept in lockstep by test, not by a shared symbol.
  const W = { input: 1.0, cache_read: 0.1, cache_creation: 1.25, output: 5.0 };

  /** totalTokens over a record carrying exactly `usage`. */
  const tt = (usage: UsageInput): number => totalTokens(buildRunRecord(baseInput({ usage })));

  test("each single bucket is weighted by its ratio (pins the vector, guards vs parity drift)", () => {
    // input is the numeraire — parity and cost agree here (weight 1.0)
    expect(tt({ input_tokens: 1000 })).toBe(1000 * W.input);
    // cache reads are CHEAP — 1000 read tokens cost ~100, not 1000 (mirrors budget's
    // countTokens({cache_read:1000}) ≈ 100). This is the reweight's whole reason.
    expect(tt({ cache_read_input_tokens: 1000 })).toBe(1000 * W.cache_read); // 100
    // a cache write costs just above a fresh input token
    expect(tt({ cache_creation_input_tokens: 1000 })).toBe(1000 * W.cache_creation); // 1250
    // output is 5× input
    expect(tt({ output_tokens: 1000 })).toBe(1000 * W.output); // 5000
  });

  test("a cache-dominated fixture record recomputes from parity units to a saner cost figure", () => {
    // boilerplate-demo's recorded failed E-008 decompose buckets (the epic's exhibit):
    // cache_read dominates (~84.5% of the parity sum) but costs ~0.1× a fresh input token.
    const usage = {
      input_tokens: 14,
      output_tokens: 23_965,
      cache_read_input_tokens: 443_711,
      cache_creation_input_tokens: 57_490,
    };
    const parity = 14 + 23_965 + 443_711 + 57_490; // = 525,180 old units
    const cost = 14 * W.input + 23_965 * W.output + 443_711 * W.cache_read + 57_490 * W.cache_creation;

    const rec = buildRunRecord(baseInput({ usage }));
    expect(totalTokens(rec)).toBeCloseTo(cost); // ≈ 236,072.6
    // the reweight makes the cache-dominated record measure ~real cost — well under parity
    expect(totalTokens(rec)).toBeLessThan(parity);
    // and cheap cached context is no longer counted at parity: the shortfall is real
    expect(parity - totalTokens(rec)).toBeGreaterThan(250_000);
  });
});

// ── T-068-01-03: the cost reweight flows through the Ledger's recalibration for free ──
// A read-only import of the REAL `recalibrate` (reading a module is not modifying it — no file
// overlap with T-068-01-04, which edits recalibrate.ts's FUNDING constants). `recalibrate`'s token
// dimension is `positiveInt(percentile(successes.map(totalTokens).sort, p))`, so once `totalTokens`
// is cost-weighted its p90 envelope is cost-denominated over the EXISTING records — no re-run. This
// uses `recalibrate()` (the RAW, unclamped percentile), NOT `fundingEnvelope()`, so it is
// independent of the FUNDING_FLOOR/CEILING band (T-068-01-04) and of `countTokens` (T-068-01-02).
describe("cost reweight flows through recalibrate — cost-denominated p90, no history re-run (T-068-01-03 AC)", () => {
  const W = { input: 1.0, cache_read: 0.1, cache_creation: 1.25, output: 5.0 };
  const usage = { input_tokens: 14, output_tokens: 23_965, cache_read_input_tokens: 443_711, cache_creation_input_tokens: 57_490 };
  const parity = 14 + 23_965 + 443_711 + 57_490; // 525,180 old parity units
  const cost = 14 * W.input + 23_965 * W.output + 443_711 * W.cache_read + 57_490 * W.cache_creation; // 236,072.6

  // Five historical SUCCESS records for one play, all cache-dominated — the shape a grown board logs.
  const { records } = readRuns(
    ledgerOf(
      ...[1, 2, 3, 4, 5].map((i) =>
        baseInput({ runId: `e008-${i}`, play: "decompose-epic", outcome: "success", usage }),
      ),
    ),
  );

  test("recalibrate reads the existing records and returns a COST-denominated p90 token envelope", () => {
    // A generous prior so cold-start never fires and the prior never dominates the token bound.
    const prior = { timeMs: 600_000, tokens: 1_000_000_000 };
    const result = recalibrate("decompose-epic", records, "standard", prior);

    // measured (5 successes ≥ cold-start min) — the envelope is derived from the logged buckets,
    // no history was re-executed to produce it.
    expect(result.source).toBe("measured");
    // the token envelope is the cost-weighted p90 (positiveInt = Math.ceil), NOT the parity p90.
    expect(result.envelope.tokens).toBe(Math.ceil(cost)); // 236,073
    // the reweight shrinks the envelope well below what a parity sum would have bound.
    expect(result.envelope.tokens).toBeLessThan(parity); // 525,180
  });
});
