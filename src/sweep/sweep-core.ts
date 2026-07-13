// The PURE sweep assembly core (S-079-02): turn one current board snapshot plus its matching
// presweep verdict into exact epic frontmatter flips, an optional dirty Lisa provenance ledger, and
// the complete pathspec + provenance commit message. Markdown writes, Git staging/commit,
// confirmation, and CLI rendering belong to the impure sweep shell.

import { SWEEP_PREFIXES, type SweepVerdict } from "../ci/presweep-core.ts";
import type { WorkGraph } from "../graph/model.ts";
import { deriveEpicClearance } from "../settle/settle-core.ts";

function sweepBoardPrefix(): "docs/active/" {
  const prefix = SWEEP_PREFIXES.find((candidate) => candidate === "docs/active/");
  if (prefix === undefined) {
    throw new TypeError("computeSweep: SWEEP_PREFIXES must include docs/active/");
  }
  return prefix;
}

/** Exact card directory under the board member of the shared presweep scope. */
export const SWEEP_EPIC_PREFIX = `${sweepBoardPrefix()}epic/` as const;

/** The only Lisa-owned runtime file sweep may carry alongside its card flips. */
export const SWEEP_PROVENANCE_PATH = ".lisa/provenance.jsonl" as const;

/** One checked frontmatter-field transition for the future effect shell to apply. */
export interface EpicFrontmatterFlip {
  readonly epicId: string;
  readonly path: string;
  readonly field: "status";
  readonly from: string;
  readonly to: "done";
  readonly clearedTicketIds: readonly string[];
}

/** The complete, non-empty commit assembly presented by the future `vend sweep` verb. */
export interface SweepFlipSet {
  readonly kind: "flip-set";
  readonly flips: readonly EpicFrontmatterFlip[];
  /** Exact optional non-card cargo observed while this plan was prepared. */
  readonly provenancePath: typeof SWEEP_PROVENANCE_PATH | null;
  /** Ordered card files plus declared provenance cargo; never a broad board/source/Lisa prefix. */
  readonly pathspec: readonly string[];
  readonly message: string;
}

export interface PresweepOffendersRefusal {
  readonly kind: "refusal";
  readonly code: "presweep-offenders";
  readonly offenders: readonly string[];
  readonly reason: string;
  readonly nextAction: string;
}

export interface StalePresweepRefusal {
  readonly kind: "refusal";
  readonly code: "stale-presweep";
  readonly expectedDoneTicketIds: readonly string[];
  readonly observedDoneTicketIds: readonly string[];
  readonly reason: string;
  readonly nextAction: string;
}

export interface NoEpicsReadyRefusal {
  readonly kind: "refusal";
  readonly code: "no-epics-ready";
  readonly reason: string;
  readonly nextAction: string;
}

export type SweepRefusal =
  | PresweepOffendersRefusal
  | StalePresweepRefusal
  | NoEpicsReadyRefusal;

export type SweepResult = SweepFlipSet | SweepRefusal;

export interface ComputeSweepInput {
  readonly graph: WorkGraph;
  readonly presweep: SweepVerdict;
  readonly provenanceDirty: boolean;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function epicPath(epicId: string): string {
  if (!/^E-\d+$/.test(epicId)) {
    throw new TypeError(`computeSweep: unsafe epic id ${JSON.stringify(epicId)}`);
  }
  return `${SWEEP_EPIC_PREFIX}${epicId}.md`;
}

function provenanceMessage(flips: readonly EpicFrontmatterFlip[]): string {
  const subject = `sweep: close ${flips.map((flip) => flip.epicId).join(", ")}`;
  const body = flips.map(
    (flip) => `${flip.epicId} cleared by ${flip.clearedTicketIds.join(", ")}`,
  );
  return `${subject}\n\n${body.join("\n")}`;
}

/**
 * Assemble an effect-ready sweep result from one immutable board snapshot. Presweep andons and
 * snapshot drift return named refusal data; impossible typed verdict combinations throw.
 */
export function computeSweep(input: ComputeSweepInput): SweepResult {
  const observedDoneTicketIds = sortedUnique(input.presweep.doneIds);
  const offenders = sortedUnique(input.presweep.offenders);

  if (input.presweep.ok === (offenders.length > 0)) {
    throw new TypeError(
      "computeSweep: presweep ok must be true exactly when the offender list is empty",
    );
  }

  if (!input.presweep.ok) {
    return {
      kind: "refusal",
      code: "presweep-offenders",
      offenders,
      reason: "Presweep could not prove that phase-done work is committed.",
      nextAction: `Commit or restore ${offenders.join(", ")}, then rerun \`vend sweep\`.`,
    };
  }

  const clearance = deriveEpicClearance(input.graph);
  const expectedDoneTicketIds = [...clearance.doneTicketIds];
  if (!sameStrings(expectedDoneTicketIds, observedDoneTicketIds)) {
    return {
      kind: "refusal",
      code: "stale-presweep",
      expectedDoneTicketIds,
      observedDoneTicketIds,
      reason: "Presweep and the current board describe different phase-done ticket sets.",
      nextAction: "Rerun presweep against the current board, then rerun `vend sweep`.",
    };
  }

  const statusByEpicId = new Map(input.graph.epics.map((epic) => [epic.id, epic.status] as const));
  const flips = clearance.epics
    .filter((epic) => epic.allDone && statusByEpicId.get(epic.epicId) !== "done")
    .map((epic): EpicFrontmatterFlip => {
      const status = statusByEpicId.get(epic.epicId);
      if (status === undefined) {
        throw new TypeError(`computeSweep: clearance references missing epic ${epic.epicId}`);
      }
      return {
        epicId: epic.epicId,
        path: epicPath(epic.epicId),
        field: "status",
        from: status,
        to: "done",
        clearedTicketIds: [...epic.clearedTicketIds],
      };
    })
    .sort((left, right) => left.epicId.localeCompare(right.epicId));

  if (flips.length === 0) {
    return {
      kind: "refusal",
      code: "no-epics-ready",
      reason: "No all-done epic needs a status flip.",
      nextAction: "Wait until an open epic has all tickets at phase: done, then rerun `vend sweep`.",
    };
  }

  const provenancePath = input.provenanceDirty ? SWEEP_PROVENANCE_PATH : null;
  return {
    kind: "flip-set",
    flips,
    provenancePath,
    pathspec: [
      ...flips.map((flip) => flip.path),
      ...(provenancePath === null ? [] : [provenancePath]),
    ],
    message: provenanceMessage(flips),
  };
}
