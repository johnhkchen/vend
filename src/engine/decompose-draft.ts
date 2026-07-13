// Versioned recovery state for a decompose cast after its paid output has parsed and run through
// gates. This mirrors runs.jsonl's pure-core / impure-shell shape, but remains a separate ledger:
// accounting rows are terminal facts, while these rows are mid-cast checkpoints that later work
// can clear, diagnose, and resume.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { GateVerdict } from "./play.ts";

export const DECOMPOSE_DRAFT_SCHEMA_VERSION = 1;
export const DEFAULT_DECOMPOSE_DRAFT_PATH = ".vend/decompose-drafts.jsonl";
export const RESUMABLE_DECOMPOSE_PLAY = "decompose-epic";

export type DecomposeGateFindings = GateVerdict;
export type DecomposeRepairCause = "executor-max-turns" | "gate-stop" | "post-gate-interruption";

/** Descriptive recovery metadata, never an auto-repair instruction. */
export type DecomposeNextRepairAction =
  | {
      readonly kind: "repair-gate";
      readonly gate: string;
      readonly unit: string;
      readonly reason: string;
      readonly cause: "executor-max-turns" | "gate-stop";
    }
  | {
      readonly kind: "resume-at-gates";
      readonly cause: "executor-max-turns" | "post-gate-interruption";
    };

export interface DecomposeDraftRecordInput<T extends object> {
  readonly runId: string;
  readonly epic: string;
  readonly parsedDraft: T;
  readonly gateFindings: DecomposeGateFindings;
  readonly nextRepairAction: DecomposeNextRepairAction;
  readonly createdAt: string;
}

export interface DecomposeDraftRecord<T extends object = Record<string, unknown>> {
  readonly v: typeof DECOMPOSE_DRAFT_SCHEMA_VERSION;
  readonly runId: string;
  readonly epic: string;
  readonly parsedDraft: T;
  readonly gateFindings: DecomposeGateFindings;
  readonly nextRepairAction: DecomposeNextRepairAction;
  readonly createdAt: string;
}

export interface ReadDecomposeDraftsResult {
  readonly records: readonly DecomposeDraftRecord[];
  readonly skipped: number;
}

export interface DecomposeDraftStoreOptions {
  readonly path?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeGateFindings(value: unknown): DecomposeGateFindings | null {
  if (!isRecord(value)) return null;
  if (value.status === "clear") {
    if (value.cleared === undefined) return Object.freeze({ status: "clear" });
    if (!Array.isArray(value.cleared) || !value.cleared.every(isNonEmptyString)) return null;
    return Object.freeze({ status: "clear", cleared: Object.freeze([...value.cleared]) });
  }
  if (
    value.status === "stop" &&
    isNonEmptyString(value.gate) &&
    isNonEmptyString(value.unit) &&
    isNonEmptyString(value.reason)
  ) {
    return Object.freeze({
      status: "stop",
      gate: value.gate,
      unit: value.unit,
      reason: value.reason,
    });
  }
  return null;
}

function normalizeNextRepairAction(value: unknown): DecomposeNextRepairAction | null {
  if (!isRecord(value)) return null;
  if (
    value.kind === "resume-at-gates" &&
    (value.cause === "executor-max-turns" || value.cause === "post-gate-interruption")
  ) {
    return Object.freeze({ kind: "resume-at-gates", cause: value.cause });
  }
  if (
    value.kind === "repair-gate" &&
    isNonEmptyString(value.gate) &&
    isNonEmptyString(value.unit) &&
    isNonEmptyString(value.reason) &&
    (value.cause === "executor-max-turns" || value.cause === "gate-stop")
  ) {
    return Object.freeze({
      kind: "repair-gate",
      gate: value.gate,
      unit: value.unit,
      reason: value.reason,
      cause: value.cause,
    });
  }
  return null;
}

/**
 * Select the honest next action from facts already present at the post-gate seam. Max-turns is
 * recognized only by the characterized terminal subtype; no unlike turn counters enter this API.
 */
export function nextDecomposeRepairAction(
  gateFindings: DecomposeGateFindings,
  executorSubtype?: string,
): DecomposeNextRepairAction {
  const capHit = executorSubtype === "error_max_turns";
  if (gateFindings.status === "stop") {
    return Object.freeze({
      kind: "repair-gate",
      gate: gateFindings.gate,
      unit: gateFindings.unit,
      reason: gateFindings.reason,
      cause: capHit ? "executor-max-turns" : "gate-stop",
    });
  }
  return Object.freeze({
    kind: "resume-at-gates",
    cause: capHit ? "executor-max-turns" : "post-gate-interruption",
  });
}

/** Strict write boundary: reject programmer errors before persisting a misleading checkpoint. */
export function buildDecomposeDraftRecord<T extends object>(
  input: DecomposeDraftRecordInput<T>,
): DecomposeDraftRecord<T> {
  if (!isNonEmptyString(input.runId)) throw new TypeError("decompose draft runId must be a non-empty string");
  if (!isNonEmptyString(input.epic)) throw new TypeError("decompose draft epic must be a non-empty string");
  if (!isRecord(input.parsedDraft)) throw new TypeError("decompose parsed draft must be an object");
  if (!isNonEmptyString(input.createdAt)) throw new TypeError("decompose draft createdAt must be a non-empty string");

  const gateFindings = normalizeGateFindings(input.gateFindings);
  if (gateFindings === null) throw new TypeError("decompose draft gate findings are malformed");
  const nextRepairAction = normalizeNextRepairAction(input.nextRepairAction);
  if (nextRepairAction === null) throw new TypeError("decompose draft next repair action is malformed");

  return Object.freeze({
    v: DECOMPOSE_DRAFT_SCHEMA_VERSION,
    runId: input.runId,
    epic: input.epic,
    parsedDraft: Object.freeze({ ...input.parsedDraft }) as T,
    gateFindings,
    nextRepairAction,
    createdAt: input.createdAt,
  });
}

export function serializeDecomposeDraftRecord<T extends object>(record: DecomposeDraftRecord<T>): string {
  return `${JSON.stringify(record)}\n`;
}

/** Tolerant read boundary for one unknown JSON value. */
export function reviveDecomposeDraftRecord(value: unknown): DecomposeDraftRecord | null {
  if (!isRecord(value) || value.v !== DECOMPOSE_DRAFT_SCHEMA_VERSION) return null;
  if (!isNonEmptyString(value.runId) || !isNonEmptyString(value.epic) || !isNonEmptyString(value.createdAt)) {
    return null;
  }
  if (!isRecord(value.parsedDraft)) return null;
  const gateFindings = normalizeGateFindings(value.gateFindings);
  const nextRepairAction = normalizeNextRepairAction(value.nextRepairAction);
  if (gateFindings === null || nextRepairAction === null) return null;

  return Object.freeze({
    v: DECOMPOSE_DRAFT_SCHEMA_VERSION,
    runId: value.runId,
    epic: value.epic,
    parsedDraft: Object.freeze({ ...value.parsedDraft }),
    gateFindings,
    nextRepairAction,
    createdAt: value.createdAt,
  });
}

/** Parse a JSONL store without letting one torn or future-version row hide earlier checkpoints. */
export function readDecomposeDrafts(jsonl: string): ReadDecomposeDraftsResult {
  const records: DecomposeDraftRecord[] = [];
  let skipped = 0;
  for (const line of jsonl.split("\n")) {
    if (line.trim().length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      skipped += 1;
      continue;
    }
    const record = reviveDecomposeDraftRecord(parsed);
    if (record === null) skipped += 1;
    else records.push(record);
  }
  return Object.freeze({ records: Object.freeze(records), skipped });
}

/** Latest means latest appended valid row; clocks are evidence, not ordering authority. */
export function latestDecomposeDraft(
  records: readonly DecomposeDraftRecord[],
  epic?: string,
): DecomposeDraftRecord | null {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record !== undefined && (epic === undefined || record.epic === epic)) return record;
  }
  return null;
}

/** Thin append-only filesystem shell. */
export async function appendDecomposeDraft<T extends object>(
  input: DecomposeDraftRecordInput<T>,
  opts: DecomposeDraftStoreOptions = {},
): Promise<void> {
  const path = opts.path ?? DEFAULT_DECOMPOSE_DRAFT_PATH;
  const line = serializeDecomposeDraftRecord(buildDecomposeDraftRecord(input));
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, line, "utf8");
}

/** Thin read filesystem shell; a fresh project has an empty store. */
export async function loadDecomposeDrafts(
  opts: DecomposeDraftStoreOptions = {},
): Promise<ReadDecomposeDraftsResult> {
  const path = opts.path ?? DEFAULT_DECOMPOSE_DRAFT_PATH;
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return Object.freeze({ records: Object.freeze([]), skipped: 0 });
    }
    throw error;
  }
  return readDecomposeDrafts(text);
}
