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

const expectedUntrackedMarker = Object.freeze({
  v: 1,
  kind: "lisa-loop-settled",
  project: "vend",
  ticketsDone: 2,
} as const);

const expectedTrackedMarker = Object.freeze({
  ...expectedUntrackedMarker,
  durationSecs: 41,
} as const);

describe("lisa loop-settled v1 fixture", () => {
  test("the canonical fixture validates and round-trips byte-for-byte", async () => {
    const fixture = await readFile(join(import.meta.dir, "fixtures", "lisa-loop-settled.valid.json"), "utf8");
    const parsed = parseLisaLoopSettledMarker(fixture);

    expect(parsed).toEqual({ kind: "valid", marker: expectedUntrackedMarker });
    if (parsed.kind !== "valid") throw new Error("fixture unexpectedly malformed");
    expect(Object.isFrozen(parsed.marker)).toBe(true);
    expect(Object.hasOwn(parsed.marker, "durationSecs")).toBe(false);
    expect(serializeLisaLoopSettledMarker(parsed.marker)).toBe(fixture);
  });

  test("the tracked shape validates and round-trips without changing its bytes", () => {
    const bytes = `${JSON.stringify(expectedTrackedMarker)}\n`;
    const parsed = parseLisaLoopSettledMarker(bytes);

    expect(parsed).toEqual({ kind: "valid", marker: expectedTrackedMarker });
    if (parsed.kind !== "valid") throw new Error("tracked marker unexpectedly malformed");
    expect(Object.isFrozen(parsed.marker)).toBe(true);
    expect(serializeLisaLoopSettledMarker(parsed.marker)).toBe(bytes);
  });
});

describe("buildLisaLoopSettledMarker", () => {
  test("omits duration when lisa did not track it", () => {
    const marker = buildLisaLoopSettledMarker({ project: "vend", ticketsDone: 2 });
    expect(marker).toEqual(expectedUntrackedMarker);
    expect(Object.hasOwn(marker, "durationSecs")).toBe(false);
  });

  test("accepts zero as an honest count and duration", () => {
    expect(buildLisaLoopSettledMarker({ project: "vend", ticketsDone: 0, durationSecs: 0 })).toEqual({
      ...expectedTrackedMarker,
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
    ["wrong version", { ...expectedTrackedMarker, v: 2 }],
    ["missing kind", { v: 1, project: "vend", ticketsDone: 2, durationSecs: 41 }],
    ["wrong kind", { ...expectedTrackedMarker, kind: "ticket-settled" }],
    ["empty project", { ...expectedTrackedMarker, project: "" }],
    ["string tickets", { ...expectedTrackedMarker, ticketsDone: "2" }],
    ["negative tickets", { ...expectedTrackedMarker, ticketsDone: -1 }],
    ["null duration", { ...expectedUntrackedMarker, durationSecs: null }],
    ["fractional duration", { ...expectedTrackedMarker, durationSecs: 1.5 }],
    ["unsafe duration", { ...expectedTrackedMarker, durationSecs: Number.MAX_SAFE_INTEGER + 1 }],
    ["extra key", { ...expectedUntrackedMarker, completedAt: "2026-07-13T12:00:00Z" }],
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
      marker: expectedTrackedMarker,
      projectRoot: "/Users/operator/work/vend/",
    });
  });

  test("completes without inventing a duration when lisa did not track one", () => {
    const classified = classifyLisaCompleteEvent({
      event: "complete",
      projectRoot: "/work/vend",
      ticketsDone: "2",
      durationSecs: undefined,
    });

    expect(classified).toEqual({
      kind: "complete",
      marker: expectedUntrackedMarker,
      projectRoot: "/work/vend",
    });
    if (classified.kind !== "complete") throw new Error("untracked complete event was not admitted");
    expect(Object.hasOwn(classified.marker, "durationSecs")).toBe(false);
  });

  test("refuses a present garbage duration", () => {
    expect(classifyLisaCompleteEvent({
      event: "complete",
      projectRoot: "/work/vend",
      ticketsDone: "2",
      durationSecs: "41s",
    })).toEqual({
      kind: "refused",
      reason: "LISA_DURATION_SECS must be a non-negative safe integer",
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
    ["unsafe duration", {
      projectRoot: "/work/vend",
      ticketsDone: "2",
      durationSecs: String(Number.MAX_SAFE_INTEGER + 1),
    }],
  ] as const)("refuses a complete event with %s", (_label, values) => {
    expect(classifyLisaCompleteEvent({ event: "complete", ...values }).kind).toBe("refused");
  });
});
