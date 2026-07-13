import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildLisaLoopSettledMarker,
  classifyLisaCompleteEvent,
  parseLisaLoopSettledMarker,
  reviveLisaLoopSettledMarker,
  serializeLisaLoopSettledMarker,
} from "./lisa-loop-settled-core.ts";

const expectedMarker = Object.freeze({
  v: 1,
  kind: "lisa-loop-settled",
  project: "vend",
  ticketsDone: 2,
  durationSecs: 41,
} as const);

describe("lisa loop-settled v1 fixture", () => {
  test("the canonical fixture validates and round-trips byte-for-byte", async () => {
    const fixture = await readFile(join(import.meta.dir, "fixtures", "lisa-loop-settled.valid.json"), "utf8");
    const parsed = parseLisaLoopSettledMarker(fixture);

    expect(parsed).toEqual({ kind: "valid", marker: expectedMarker });
    if (parsed.kind !== "valid") throw new Error("fixture unexpectedly malformed");
    expect(Object.isFrozen(parsed.marker)).toBe(true);
    expect(serializeLisaLoopSettledMarker(parsed.marker)).toBe(fixture);
  });
});

describe("buildLisaLoopSettledMarker", () => {
  test("accepts zero as an honest count and duration", () => {
    expect(buildLisaLoopSettledMarker({ project: "vend", ticketsDone: 0, durationSecs: 0 })).toEqual({
      ...expectedMarker,
      ticketsDone: 0,
      durationSecs: 0,
    });
  });

  test.each([
    ["empty project", { project: " ", ticketsDone: 1, durationSecs: 2 }],
    ["negative tickets", { project: "vend", ticketsDone: -1, durationSecs: 2 }],
    ["fractional tickets", { project: "vend", ticketsDone: 1.5, durationSecs: 2 }],
    ["unsafe tickets", { project: "vend", ticketsDone: Number.MAX_SAFE_INTEGER + 1, durationSecs: 2 }],
    ["negative duration", { project: "vend", ticketsDone: 1, durationSecs: -1 }],
    ["fractional duration", { project: "vend", ticketsDone: 1, durationSecs: 2.5 }],
  ] as const)("rejects %s", (_label, input) => {
    expect(() => buildLisaLoopSettledMarker(input)).toThrow(TypeError);
  });
});

describe("parseLisaLoopSettledMarker — closed malformed refusal", () => {
  test("invalid JSON is refused without throwing", () => {
    expect(parseLisaLoopSettledMarker("{nope")).toEqual({ kind: "malformed", reason: "invalid-json" });
  });

  test.each([
    ["null", null],
    ["array", []],
    ["wrong version", { ...expectedMarker, v: 2 }],
    ["missing kind", { v: 1, project: "vend", ticketsDone: 2, durationSecs: 41 }],
    ["wrong kind", { ...expectedMarker, kind: "ticket-settled" }],
    ["empty project", { ...expectedMarker, project: "" }],
    ["string tickets", { ...expectedMarker, ticketsDone: "2" }],
    ["negative tickets", { ...expectedMarker, ticketsDone: -1 }],
    ["fractional duration", { ...expectedMarker, durationSecs: 1.5 }],
    ["unsafe duration", { ...expectedMarker, durationSecs: Number.MAX_SAFE_INTEGER + 1 }],
    ["extra key", { ...expectedMarker, completedAt: "2026-07-13T12:00:00Z" }],
  ] as const)("refuses %s", (_label, value) => {
    expect(reviveLisaLoopSettledMarker(value)).toBeNull();
    expect(parseLisaLoopSettledMarker(JSON.stringify(value))).toEqual({
      kind: "malformed",
      reason: "schema-mismatch",
    });
  });
});

describe("classifyLisaCompleteEvent", () => {
  test("normalizes the documented complete event into the canonical marker", () => {
    expect(classifyLisaCompleteEvent({
      event: "complete",
      projectRoot: "/Users/operator/work/vend/",
      ticketsDone: "2",
      durationSecs: "41",
    })).toEqual({
      kind: "complete",
      marker: expectedMarker,
      projectRoot: "/Users/operator/work/vend/",
    });
  });

  test("ignores attention rather than mistaking it for loop completion", () => {
    expect(classifyLisaCompleteEvent({
      event: "attention",
      projectRoot: "/work/vend",
      ticketsDone: undefined,
      durationSecs: undefined,
    })).toEqual({ kind: "ignored", reason: "event-is-not-complete" });
  });

  test.each([
    ["relative project", { projectRoot: "vend", ticketsDone: "2", durationSecs: "41" }],
    ["missing tickets", { projectRoot: "/work/vend", ticketsDone: undefined, durationSecs: "41" }],
    ["leading-zero tickets", { projectRoot: "/work/vend", ticketsDone: "02", durationSecs: "41" }],
    ["negative tickets", { projectRoot: "/work/vend", ticketsDone: "-1", durationSecs: "41" }],
    ["partial duration", { projectRoot: "/work/vend", ticketsDone: "2", durationSecs: "41s" }],
    ["unsafe duration", {
      projectRoot: "/work/vend",
      ticketsDone: "2",
      durationSecs: String(Number.MAX_SAFE_INTEGER + 1),
    }],
  ] as const)("refuses a complete event with %s", (_label, values) => {
    expect(classifyLisaCompleteEvent({ event: "complete", ...values }).kind).toBe("refused");
  });
});
