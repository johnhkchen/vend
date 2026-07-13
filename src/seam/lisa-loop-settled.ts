// Thin effect shell for the lisa → Vend loop-settled marker. The pure module validates every
// external fact before this file creates anything; the only durable target is the exported `.vend`
// path. The project-owned on-notify hook contains this process so lisa completion cannot be blocked.

import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  classifyLisaCompleteEvent,
  DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH,
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
  | { readonly kind: "refused"; readonly reason: string };

/** Atomically publish the latest validated whole-loop fact beneath Vend-owned state. */
export async function recordLisaLoopSettled(
  input: LisaCompleteEventInput,
): Promise<RecordLisaLoopSettledResult> {
  const classified = classifyLisaCompleteEvent(input);
  if (classified.kind !== "complete") return classified;

  const markerPath = join(classified.projectRoot, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH);
  const temporaryPath = `${markerPath}.${process.pid}.${randomUUID()}.tmp`;
  let published = false;
  await mkdir(dirname(markerPath), { recursive: true });
  try {
    await writeFile(temporaryPath, serializeLisaLoopSettledMarker(classified.marker), { flag: "wx" });
    await rename(temporaryPath, markerPath);
    published = true;
  } finally {
    if (!published) await rm(temporaryPath, { force: true });
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
      console.error(`lisa loop-settled marker refused: ${outcome.reason}`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`lisa loop-settled marker write failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
