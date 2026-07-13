// Pure contract at the lisa → Vend whole-loop seam. Lisa already emits these facts through its
// user-owned `on-notify complete` hook; this module only validates and normalizes that existing
// emission into the exact Vend marker consumed by the later settle slice. Filesystem/process work
// stays in lisa-loop-settled.ts.

import { basename, isAbsolute } from "node:path";

export const LISA_LOOP_SETTLED_SCHEMA_VERSION = 1 as const;
export const LISA_LOOP_SETTLED_KIND = "lisa-loop-settled" as const;
export const DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH = ".vend/loop-settled.json" as const;

const REQUIRED_MARKER_KEYS = Object.freeze(["v", "kind", "project", "ticketsDone"] as const);
const MARKER_KEYS = Object.freeze([...REQUIRED_MARKER_KEYS, "durationSecs"] as const);

export interface LisaLoopSettledMarkerInput {
  readonly project: string;
  readonly ticketsDone: number;
  readonly durationSecs?: number;
}

export interface LisaLoopSettledMarker {
  readonly v: typeof LISA_LOOP_SETTLED_SCHEMA_VERSION;
  readonly kind: typeof LISA_LOOP_SETTLED_KIND;
  readonly project: string;
  readonly ticketsDone: number;
  readonly durationSecs?: number;
}

export interface LisaCompleteEventInput {
  readonly event: string | undefined;
  readonly projectRoot: string | undefined;
  readonly ticketsDone: string | undefined;
  readonly durationSecs: string | undefined;
}

export type ParseLisaLoopSettledMarkerResult =
  | { readonly kind: "valid"; readonly marker: LisaLoopSettledMarker }
  | { readonly kind: "malformed"; readonly reason: string };

export type ClassifyLisaCompleteEventResult =
  | { readonly kind: "complete"; readonly marker: LisaLoopSettledMarker; readonly projectRoot: string }
  | { readonly kind: "ignored"; readonly reason: string }
  | { readonly kind: "refused"; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function hasExactMarkerKeys(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return (
    keys.length >= REQUIRED_MARKER_KEYS.length &&
    keys.length <= MARKER_KEYS.length &&
    REQUIRED_MARKER_KEYS.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => (MARKER_KEYS as readonly string[]).includes(key))
  );
}

function parseEventQuantity(value: string | undefined): number | null {
  if (value === undefined || !/^(?:0|[1-9][0-9]*)$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** Strict construction boundary for values Vend itself claims are valid marker facts. */
export function buildLisaLoopSettledMarker(input: LisaLoopSettledMarkerInput): LisaLoopSettledMarker {
  if (!isNonEmptyString(input.project)) {
    throw new TypeError("lisa loop-settled project must be a non-empty string");
  }
  if (!isNonNegativeSafeInteger(input.ticketsDone)) {
    throw new TypeError("lisa loop-settled ticketsDone must be a non-negative safe integer");
  }
  if (input.durationSecs !== undefined && !isNonNegativeSafeInteger(input.durationSecs)) {
    throw new TypeError("lisa loop-settled durationSecs must be a non-negative safe integer");
  }

  return Object.freeze({
    v: LISA_LOOP_SETTLED_SCHEMA_VERSION,
    kind: LISA_LOOP_SETTLED_KIND,
    project: input.project,
    ticketsDone: input.ticketsDone,
    ...(input.durationSecs === undefined ? {} : { durationSecs: input.durationSecs }),
  });
}

/** Closed-schema read boundary: a partial, future, or unrelated object is not a pending loop. */
export function reviveLisaLoopSettledMarker(value: unknown): LisaLoopSettledMarker | null {
  if (
    !isRecord(value) ||
    !hasExactMarkerKeys(value) ||
    value.v !== LISA_LOOP_SETTLED_SCHEMA_VERSION ||
    value.kind !== LISA_LOOP_SETTLED_KIND ||
    !isNonEmptyString(value.project) ||
    !isNonNegativeSafeInteger(value.ticketsDone) ||
    (Object.hasOwn(value, "durationSecs") && !isNonNegativeSafeInteger(value.durationSecs))
  ) {
    return null;
  }

  return buildLisaLoopSettledMarker({
    project: value.project,
    ticketsDone: value.ticketsDone,
    ...(Object.hasOwn(value, "durationSecs") ? { durationSecs: value.durationSecs as number } : {}),
  });
}

/** Parse external marker bytes without allowing invalid JSON or schema drift to throw downstream. */
export function parseLisaLoopSettledMarker(text: string): ParseLisaLoopSettledMarkerResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return Object.freeze({ kind: "malformed", reason: "invalid-json" });
  }
  const marker = reviveLisaLoopSettledMarker(value);
  return marker === null
    ? Object.freeze({ kind: "malformed", reason: "schema-mismatch" })
    : Object.freeze({ kind: "valid", marker });
}

/** Convert lisa's documented `on-notify complete` strings into the durable Vend marker facts. */
export function classifyLisaCompleteEvent(input: LisaCompleteEventInput): ClassifyLisaCompleteEventResult {
  if (input.event !== "complete") {
    return Object.freeze({ kind: "ignored", reason: "event-is-not-complete" });
  }
  if (!isNonEmptyString(input.projectRoot) || !isAbsolute(input.projectRoot)) {
    return Object.freeze({ kind: "refused", reason: "LISA_PROJECT must be an absolute project root" });
  }

  const project = basename(input.projectRoot);
  if (!isNonEmptyString(project)) {
    return Object.freeze({ kind: "refused", reason: "LISA_PROJECT must name a project" });
  }
  const ticketsDone = parseEventQuantity(input.ticketsDone);
  if (ticketsDone === null) {
    return Object.freeze({ kind: "refused", reason: "LISA_TICKETS_DONE must be a non-negative safe integer" });
  }
  const durationSecs = input.durationSecs === undefined
    ? undefined
    : parseEventQuantity(input.durationSecs);
  if (durationSecs === null) {
    return Object.freeze({ kind: "refused", reason: "LISA_DURATION_SECS must be a non-negative safe integer" });
  }

  return Object.freeze({
    kind: "complete",
    marker: buildLisaLoopSettledMarker({ project, ticketsDone, durationSecs }),
    projectRoot: input.projectRoot,
  });
}

/** Deterministic field order and a final newline make fixture and disk bytes directly comparable. */
export function serializeLisaLoopSettledMarker(marker: LisaLoopSettledMarker): string {
  return `${JSON.stringify(buildLisaLoopSettledMarker(marker))}\n`;
}
