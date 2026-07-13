// Thin effect shell for the lisa → Vend loop-settled marker. The pure module validates every
// external fact before this file creates anything; marker success and failure trace both stay below
// exported `.vend` paths. The project-owned on-notify hook contains this process so lisa completion
// cannot be blocked.

import { randomUUID } from "node:crypto";
import { appendFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import {
  classifyLisaCompleteEvent,
  DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH,
  DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH,
  serializeLisaLoopSettledFailure,
  serializeLisaLoopSettledMarker,
  type LisaCompleteEventInput,
  type LisaLoopSettledMarker,
} from "./lisa-loop-settled-core.ts";

export type RecordLisaLoopSettledResult =
  | {
      readonly kind: "recorded";
      readonly path: typeof DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH;
      readonly marker: LisaLoopSettledMarker;
    }
  | { readonly kind: "ignored"; readonly reason: string }
  | { readonly kind: "refused"; readonly reason: string; readonly traceError?: string }
  | { readonly kind: "failed"; readonly reason: string; readonly traceError?: string };

export interface RecordLisaLoopSettledOptions {
  /** Trusted project working root when the event's own project path is unusable. */
  readonly root?: string;
  /** Failure-only clock seam; successful and ignored events do not mint timestamps. */
  readonly now?: () => Date;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function failureRoot(input: LisaCompleteEventInput, options: RecordLisaLoopSettledOptions): string {
  return input.projectRoot !== undefined && isAbsolute(input.projectRoot)
    ? input.projectRoot
    : (options.root ?? process.cwd());
}

/** Append one complete JSONL record, containing even a failure of the diagnostic path as data. */
async function appendFailureTrace(
  root: string,
  reason: string,
  now: () => Date,
): Promise<string | null> {
  const tracePath = join(root, DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH);
  try {
    await mkdir(dirname(tracePath), { recursive: true });
    await appendFile(tracePath, serializeLisaLoopSettledFailure({
      timestamp: now().toISOString(),
      reason,
    }), "utf8");
    return null;
  } catch (error) {
    return `failure trace append failed: ${errorMessage(error)}`;
  }
}

/** Atomically publish the latest validated whole-loop fact beneath Vend-owned state. */
export async function recordLisaLoopSettled(
  input: LisaCompleteEventInput,
  options: RecordLisaLoopSettledOptions = {},
): Promise<RecordLisaLoopSettledResult> {
  const classified = classifyLisaCompleteEvent(input);
  if (classified.kind === "ignored") return classified;

  const now = options.now ?? (() => new Date());
  if (classified.kind === "refused") {
    const traceError = await appendFailureTrace(failureRoot(input, options), classified.reason, now);
    return traceError === null ? classified : Object.freeze({ ...classified, traceError });
  }

  const markerPath = join(classified.projectRoot, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH);
  const temporaryPath = `${markerPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(markerPath), { recursive: true });
    await writeFile(temporaryPath, serializeLisaLoopSettledMarker(classified.marker), { flag: "wx" });
    await rename(temporaryPath, markerPath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    const reason = `marker write failed: ${errorMessage(error)}`;
    const traceError = await appendFailureTrace(classified.projectRoot, reason, now);
    return Object.freeze({
      kind: "failed" as const,
      reason,
      ...(traceError === null ? {} : { traceError }),
    });
  }

  return Object.freeze({
    kind: "recorded",
    path: DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH,
    marker: classified.marker,
  });
}

if (import.meta.main) {
  try {
    const outcome = await recordLisaLoopSettled({
      event: process.env.LISA_EVENT,
      projectRoot: process.env.LISA_PROJECT,
      ticketsDone: process.env.LISA_TICKETS_DONE,
      durationSecs: process.env.LISA_DURATION_SECS,
    });
    if (outcome.kind === "refused") {
      console.error(
        `lisa loop-settled marker refused: ${outcome.reason}` +
          (outcome.traceError === undefined ? "" : `; ${outcome.traceError}`),
      );
      process.exitCode = 1;
    } else if (outcome.kind === "failed") {
      console.error(
        `lisa loop-settled ${outcome.reason}` +
          (outcome.traceError === undefined ? "" : `; ${outcome.traceError}`),
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`lisa loop-settled marker write failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
