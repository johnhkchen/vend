// The IMPURE settle shell (S-079-01): observe the current board, repository gate, presweep,
// structured review artifacts, and last-settle marker; hand those facts to the pure settle core;
// atomically publish its continuation; and render one terminal verdict. This module never imports
// a play, executor, budget, or run ledger — `vend settle` is a free typed gesture.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { classifySweep, donePhaseIds, type SweepVerdict } from "../ci/presweep-core.ts";
import { loadWorkGraph } from "../graph/load.ts";
import type { TicketNode } from "../graph/model.ts";
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

async function readOptionalText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
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

export interface RunSettleOptions {
  readonly root?: string;
}

/** Observe one current repository snapshot, compute its typed verdict, and advance its frontier. */
export async function runSettle(options: RunSettleOptions = {}): Promise<SettleResult> {
  const root = options.root ?? process.cwd();
  const [graph, lastSettleContents, reviewConcerns] = await Promise.all([
    loadWorkGraph({ root }),
    readOptionalText(join(root, LAST_SETTLE_MARKER_PATH)),
    loadReviewConcerns(root),
  ]);
  const gate = await runRepositoryGate(root);
  const presweep = await runPresweep(root, graph.tickets);
  const result = computeSettleVerdict({
    graph,
    lastSettleContents,
    gate,
    presweep,
    reviewConcerns,
  });
  if (result.kind === "verdict") {
    await writeMarkerAtomically(root, serializeLastSettleMarker(result.nextMarker));
  }
  return result;
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
  const deltaIds = result.delta.newlyDoneTicketIds.join(", ");
  if (result.delta.firstSettle) {
    lines.push(
      deltaIds.length > 0
        ? `delta: first settle — ${deltaIds}`
        : "delta: first settle — no completed tickets",
    );
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
