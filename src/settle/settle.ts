// The IMPURE settle shell (S-079-01/S-079-03): claim optional Lisa whole-loop provenance; observe
// the current board, repository gate, presweep, structured review artifacts, and last-settle marker;
// hand those facts to the pure settle core; atomically publish its continuation; consume provenance
// only after a verdict; and render one terminal result. No play/executor/budget/run ledger enters.

import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { classifySweep, donePhaseIds, type SweepVerdict } from "../ci/presweep-core.ts";
import { loadWorkGraph } from "../graph/load.ts";
import type { TicketNode } from "../graph/model.ts";
import {
  DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH,
  DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH,
} from "../seam/lisa-loop-settled-core.ts";
import {
  computeSettleVerdict,
  LAST_SETTLE_MARKER_PATH,
  serializeLastSettleMarker,
  type ReviewConcern,
  type SettleGateResult,
  type SettleResult,
} from "./settle-core.ts";

export const ANSI_RED = "\x1b[31m" as const;
export const ANSI_RESET = "\x1b[0m" as const;

const REPOSITORY_GATE_ACTION =
  "Run `bun run check` and repair the reported failure, then rerun `vend settle`.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMissingFile(error: unknown): boolean {
  return isRecord(error) && error["code"] === "ENOENT";
}

function isAlreadyExists(error: unknown): boolean {
  return isRecord(error) && error["code"] === "EEXIST";
}

function malformedDispositionConcern(
  ticketId: string,
  relativePath: string,
  reason: string,
): ReviewConcern {
  return {
    ticketId,
    name: `malformed review disposition: ${reason}`,
    nextAction:
      `Repair ${relativePath} to a valid pass or reasoned block disposition, then rerun \`vend settle\`.`,
  };
}

/**
 * Convert one present Lisa review-disposition artifact into settle's structured concern shape.
 * Missing files are handled by discovery; malformed PRESENT bytes are visible, never a silent pass.
 * PURE/TOTAL over strings so artifact policy is pinned without filesystem fixtures.
 */
export function reviewConcernFromDisposition(
  ticketId: string,
  relativePath: string,
  contents: string,
): ReviewConcern | null {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return malformedDispositionConcern(ticketId, relativePath, `invalid JSON (${detail})`);
  }

  if (!isRecord(value)) {
    return malformedDispositionConcern(ticketId, relativePath, "root must be an object");
  }
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "disposition" || keys[1] !== "reason") {
    return malformedDispositionConcern(
      ticketId,
      relativePath,
      "expected exactly 'disposition' and 'reason'",
    );
  }
  if (value["disposition"] === "pass" && value["reason"] === null) return null;

  if (value["disposition"] === "block") {
    const reason = typeof value["reason"] === "string" ? value["reason"].trim() : "";
    if (reason.length > 0) {
      return {
        ticketId,
        name: reason,
        nextAction:
          `Resolve ${reason} for ${ticketId}, then record a passing disposition in ${relativePath}.`,
      };
    }
    return malformedDispositionConcern(ticketId, relativePath, "block requires a nonblank reason");
  }

  return malformedDispositionConcern(
    ticketId,
    relativePath,
    "expected pass/null or block/nonblank-reason",
  );
}

async function loadReviewConcerns(root: string): Promise<ReviewConcern[]> {
  const workRoot = join(root, "docs", "active", "work");
  let entries;
  try {
    entries = await readdir(workRoot, { withFileTypes: true });
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }

  const concerns: ReviewConcern[] = [];
  const ticketIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const ticketId of ticketIds) {
    const relativePath = `docs/active/work/${ticketId}/review-disposition.json`;
    let contents: string;
    try {
      contents = await readFile(join(root, relativePath), "utf8");
    } catch (error) {
      if (isMissingFile(error)) continue;
      throw error;
    }
    const concern = reviewConcernFromDisposition(ticketId, relativePath, contents);
    if (concern !== null) concerns.push(concern);
  }
  return concerns;
}

function lastNonblankLine(text: string): string | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.at(-1) ?? null;
}

function passingTestCount(text: string): number | null {
  const matches = [...text.matchAll(/(?:^|\s)(\d+)\s+pass(?:ed)?\b/g)];
  const raw = matches.at(-1)?.[1];
  return raw === undefined ? null : Number(raw);
}

async function runRepositoryGate(root: string): Promise<SettleGateResult> {
  try {
    const process = Bun.spawn(["bun", "run", "check"], {
      cwd: root,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
      process.exited,
    ]);
    const combined = `${stdout}\n${stderr}`;
    if (exitCode === 0) {
      const tests = passingTestCount(combined);
      return {
        ok: true,
        name: "repository gate",
        detail: tests === null ? "bun run check passed" : `${tests} tests`,
        nextAction: null,
      };
    }
    const tail = lastNonblankLine(combined);
    return {
      ok: false,
      name: "repository gate",
      detail: `bun run check exited ${exitCode}${tail === null ? "" : `: ${tail}`}`,
      nextAction: REPOSITORY_GATE_ACTION,
    };
  } catch (error) {
    return {
      ok: false,
      name: "repository gate",
      detail: `could not run bun run check: ${error instanceof Error ? error.message : String(error)}`,
      nextAction: REPOSITORY_GATE_ACTION,
    };
  }
}

async function runPresweep(root: string, tickets: readonly TicketNode[]): Promise<SweepVerdict> {
  const process = Bun.spawn(["git", "status", "--porcelain"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`git status failed (${stderr.trim() || `exit ${exitCode}`})`);
  }
  return classifySweep({ doneIds: donePhaseIds(tickets), porcelain: stdout });
}

interface OptionalFileObservation {
  readonly contents: string;
  readonly modifiedAtMs: number;
}

async function readOptionalFile(path: string): Promise<OptionalFileObservation | null> {
  try {
    const contents = await readFile(path, "utf8");
    const metadata = await stat(path);
    return { contents, modifiedAtMs: metadata.mtimeMs };
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

async function writeMarkerAtomically(root: string, contents: string): Promise<void> {
  const destination = join(root, LAST_SETTLE_MARKER_PATH);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  await mkdir(dirname(destination), { recursive: true });
  try {
    await writeFile(temporary, contents, { encoding: "utf8", flag: "wx" });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

interface ClaimedLoopSettledMarker {
  readonly stablePath: string;
  readonly claimedPath: string;
  readonly contents: string;
  readonly modifiedAtMs: number;
}

type LoopSettledClaimPaths = Pick<ClaimedLoopSettledMarker, "stablePath" | "claimedPath">;

/**
 * Restore a claim without replacing a newer complete event. A hard link publishes the old inode
 * only when the stable name is absent; EEXIST means the producer's newer singleton wins.
 */
async function restoreLoopSettledMarker(claim: LoopSettledClaimPaths): Promise<void> {
  try {
    await link(claim.claimedPath, claim.stablePath);
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
  await rm(claim.claimedPath, { force: true });
}

/** Atomically take one pending marker out of circulation so only this settle can print it. */
async function claimLoopSettledMarker(root: string): Promise<ClaimedLoopSettledMarker | null> {
  const stablePath = join(root, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH);
  const claimedPath = `${stablePath}.${process.pid}.${randomUUID()}.settling`;
  try {
    await rename(stablePath, claimedPath);
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }

  try {
    const [contents, metadata] = await Promise.all([
      readFile(claimedPath, "utf8"),
      stat(claimedPath),
    ]);
    return { stablePath, claimedPath, contents, modifiedAtMs: metadata.mtimeMs };
  } catch (error) {
    await restoreLoopSettledMarker({ stablePath, claimedPath });
    throw error;
  }
}

export interface RunSettleOptions {
  readonly root?: string;
}

function latestModifiedAt(...values: Array<number | undefined>): number | null {
  const present = values.filter((value): value is number => value !== undefined);
  return present.length === 0 ? null : Math.max(...present);
}

/** Observe one current repository snapshot, compute its typed verdict, and advance its frontier. */
export async function runSettle(options: RunSettleOptions = {}): Promise<SettleResult> {
  const root = options.root ?? process.cwd();
  const loopClaim = await claimLoopSettledMarker(root);
  let loopFinalized = loopClaim === null;
  try {
    const [graph, lastSettle, failureTrace, reviewConcerns] = await Promise.all([
      loadWorkGraph({ root }),
      readOptionalFile(join(root, LAST_SETTLE_MARKER_PATH)),
      readOptionalFile(join(root, DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH)),
      loadReviewConcerns(root),
    ]);
    const gate = await runRepositoryGate(root);
    const presweep = await runPresweep(root, graph.tickets);
    const result = computeSettleVerdict({
      graph,
      loopSettledContents: loopClaim?.contents ?? null,
      lastSettleContents: lastSettle?.contents ?? null,
      cord: {
        failureTraceContents: failureTrace?.contents ?? null,
        failureTraceModifiedAtMs: failureTrace?.modifiedAtMs ?? null,
        lastClaimModifiedAtMs: latestModifiedAt(
          lastSettle?.modifiedAtMs,
          loopClaim?.modifiedAtMs,
        ),
      },
      gate,
      presweep,
      reviewConcerns,
    });
    if (result.kind === "refusal") return result;

    await writeMarkerAtomically(root, serializeLastSettleMarker(result.nextMarker));
    if (loopClaim !== null) await rm(loopClaim.claimedPath);
    loopFinalized = true;
    return result;
  } finally {
    if (!loopFinalized && loopClaim !== null) {
      await restoreLoopSettledMarker(loopClaim);
    }
  }
}

export interface RenderSettleOptions {
  /** Production defaults to ANSI red. Tests/plain transports may explicitly disable it. */
  readonly color?: boolean;
}

function red(line: string, color: boolean): string {
  return color ? `${ANSI_RED}${line}${ANSI_RESET}` : line;
}

function countNoun(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Render the complete one-screen result without consulting the world or revising core policy. */
export function renderSettleResult(
  result: SettleResult,
  options: RenderSettleOptions = {},
): string {
  const color = options.color !== false;
  if (result.kind === "refusal") {
    return [
      "settle",
      red(`refusal [${result.code}] ${result.path}: ${result.reason}`, color),
      red(`next: ${result.nextAction}`, color),
    ].join("\n") + "\n";
  }

  const lines = ["settle"];
  if (result.loop !== null) {
    const loopLine = `loop: ${result.loop.project} — ${countNoun(result.loop.ticketsDone, "ticket")} done`;
    lines.push(
      result.loop.durationSecs === undefined
        ? loopLine
        : `${loopLine} in ${result.loop.durationSecs}s`,
    );
  } else {
    lines.push("loop: none pending");
  }
  if (result.cordFailureReason !== null) {
    lines.push(`cord: last recording failed — ${result.cordFailureReason}`);
  }
  const deltaIds = result.delta.newlyDoneTicketIds.join(", ");
  if (result.delta.firstSettle) {
    lines.push("delta: first settle — no baseline");
  } else {
    lines.push(deltaIds.length > 0 ? `delta: ${deltaIds}` : "delta: none since last settle");
  }

  for (const epic of result.epics) {
    lines.push(
      `epic: ${epic.epicId} — ${epic.cleared}/${epic.total} cleared` +
        (epic.allDone ? " — sweep ready" : ""),
    );
  }
  lines.push(`gate: ${result.gate.ok ? "green" : "red"} — ${result.gate.name}: ${result.gate.detail}`);
  lines.push(
    result.presweep.ok
      ? `presweep: green — ${countNoun(result.presweep.doneIds.length, "done ticket")}, source + board committed`
      : `presweep: red — ${countNoun(result.presweep.offenders.length, "offender")}: ${result.presweep.offenders.join(", ")}`,
  );

  if (result.reviewConcerns.length === 0) {
    lines.push("review concerns: none");
  } else {
    for (const concern of result.reviewConcerns) {
      lines.push(`review concern: ${concern.ticketId} — ${concern.name}`);
    }
  }

  if (result.exceptions.length === 0) {
    lines.push("exceptions: none");
  } else {
    for (const exception of result.exceptions) {
      lines.push(red(
        `exception [${exception.kind}] ${exception.name}: ${exception.message} — next: ${exception.nextAction}`,
        color,
      ));
    }
  }
  return `${lines.join("\n")}\n`;
}
