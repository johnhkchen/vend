// The PURE settle verdict core (S-079-01): assemble machine-known board, gate, presweep, review,
// and last-settle facts into one deterministic value. Filesystem discovery, Git/check execution,
// marker persistence, terminal rendering, and CLI dispatch belong to the impure settle shell.
//
// Expected persisted-state defects are returned as named refusal data. Programmer wiring defects
// in the already-typed gate/presweep/review facts throw, following the project's core convention.

import type { SweepVerdict } from "../ci/presweep-core.ts";
import type { WorkGraph } from "../graph/model.ts";
import {
  DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH,
  parseLisaLoopSettledMarker,
  type LisaLoopSettledMarker,
} from "../seam/lisa-loop-settled-core.ts";

export const LAST_SETTLE_MARKER_PATH = ".vend/last-settle.json" as const;
export const LAST_SETTLE_MARKER_VERSION = 1 as const;

export interface LastSettleMarker {
  readonly version: typeof LAST_SETTLE_MARKER_VERSION;
  /** Canonical sorted, unique ids that had reached `phase: done` at the preceding settle. */
  readonly doneTicketIds: readonly string[];
}

export interface LastSettleRefusal {
  readonly kind: "refusal";
  readonly code: "malformed-last-settle-marker";
  readonly path: typeof LAST_SETTLE_MARKER_PATH;
  readonly reason: string;
  readonly nextAction: string;
}

export interface LoopSettledRefusal {
  readonly kind: "refusal";
  readonly code: "malformed-loop-settled-marker";
  readonly path: typeof DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH;
  readonly reason: string;
  readonly nextAction: string;
}

export type SettleRefusal = LastSettleRefusal | LoopSettledRefusal;

export type MarkerParseResult =
  | { readonly ok: true; readonly firstSettle: true; readonly marker: null }
  | { readonly ok: true; readonly firstSettle: false; readonly marker: LastSettleMarker }
  | { readonly ok: false; readonly refusal: LastSettleRefusal };

export interface EpicClearance {
  readonly epicId: string;
  readonly title: string;
  readonly cleared: number;
  readonly total: number;
  readonly clearedTicketIds: readonly string[];
  readonly allDone: boolean;
}

export interface EpicClearanceResult {
  readonly epics: readonly EpicClearance[];
  readonly doneTicketIds: readonly string[];
  /** A deterministic array representation of the semantic all-done epic set. */
  readonly allDoneEpicIds: readonly string[];
}

/** Gate-line facts whose source (inline check or recorded result) is chosen by the effect shell. */
export interface SettleGateResult {
  readonly ok: boolean;
  readonly name: string;
  readonly detail: string;
  /** Required for a failure and null for a pass, so a renderer never invents recovery advice. */
  readonly nextAction: string | null;
}

/** A structured open concern already extracted from one ticket's work-directory review artifacts. */
export interface ReviewConcern {
  readonly ticketId: string;
  readonly name: string;
  readonly nextAction: string;
}

export interface SettleDelta {
  readonly firstSettle: boolean;
  readonly newlyDoneTicketIds: readonly string[];
}

export interface SettleException {
  readonly kind: "gate" | "presweep" | "review";
  readonly name: string;
  readonly message: string;
  readonly nextAction: string;
}

export interface SettleVerdict {
  readonly kind: "verdict";
  /** Whole-loop provenance from one pending Lisa completion marker, or null after consumption. */
  readonly loop: LisaLoopSettledMarker | null;
  readonly delta: SettleDelta;
  readonly epics: readonly EpicClearance[];
  readonly doneTicketIds: readonly string[];
  readonly allDoneEpicIds: readonly string[];
  readonly gate: SettleGateResult;
  readonly presweep: SweepVerdict;
  readonly reviewConcerns: readonly ReviewConcern[];
  readonly exceptions: readonly SettleException[];
  /** The continuation the shell writes only after this successful verdict. */
  readonly nextMarker: LastSettleMarker;
}

export type SettleResult = SettleVerdict | SettleRefusal;

export interface ComputeSettleInput {
  readonly graph: WorkGraph;
  readonly loopSettledContents: string | null;
  readonly lastSettleContents: string | null;
  readonly gate: SettleGateResult;
  readonly presweep: SweepVerdict;
  readonly reviewConcerns: readonly ReviewConcern[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function markerRefusal(reason: string): LastSettleRefusal {
  return {
    kind: "refusal",
    code: "malformed-last-settle-marker",
    path: LAST_SETTLE_MARKER_PATH,
    reason,
    nextAction: `Remove ${LAST_SETTLE_MARKER_PATH} and rerun \`vend settle\` for a full-board first-settle summary.`,
  };
}

function loopSettledRefusal(reason: string): LoopSettledRefusal {
  return {
    kind: "refusal",
    code: "malformed-loop-settled-marker",
    path: DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH,
    reason,
    nextAction:
      `Repair or remove ${DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH}, then rerun \`vend settle\`; ` +
      "the malformed marker was left pending for diagnosis.",
  };
}

type MarkerValidation =
  | { readonly ok: true; readonly marker: LastSettleMarker }
  | { readonly ok: false; readonly reason: string };

/** Validate the canonical durable marker value without consulting the current board. */
function validateMarkerValue(value: unknown): MarkerValidation {
  if (!isRecord(value)) return { ok: false, reason: "marker root must be a JSON object" };

  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "doneTicketIds" || keys[1] !== "version") {
    return { ok: false, reason: "marker must contain exactly 'version' and 'doneTicketIds'" };
  }
  if (value.version !== LAST_SETTLE_MARKER_VERSION) {
    return {
      ok: false,
      reason: `marker version must be ${LAST_SETTLE_MARKER_VERSION}, got ${JSON.stringify(value.version)}`,
    };
  }
  if (!Array.isArray(value.doneTicketIds) || value.doneTicketIds.some((id) => !isNonBlank(id))) {
    return { ok: false, reason: "marker doneTicketIds must be an array of non-blank strings" };
  }

  const ids = value.doneTicketIds as string[];
  const canonical = [...new Set(ids)].sort();
  if (canonical.length !== ids.length || canonical.some((id, index) => id !== ids[index])) {
    return { ok: false, reason: "marker doneTicketIds must be sorted and unique" };
  }
  return {
    ok: true,
    marker: { version: LAST_SETTLE_MARKER_VERSION, doneTicketIds: [...ids] },
  };
}

/** Parse persisted marker bytes. Absence means first settle; malformed bytes are refusal data. */
export function parseLastSettleMarker(contents: string | null): MarkerParseResult {
  if (contents === null) return { ok: true, firstSettle: true, marker: null };

  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, refusal: markerRefusal(`marker is not valid JSON: ${detail}`) };
  }

  const validation = validateMarkerValue(value);
  return validation.ok
    ? { ok: true, firstSettle: false, marker: validation.marker }
    : { ok: false, refusal: markerRefusal(validation.reason) };
}

/** Serialize a canonical marker. Invalid typed calls are programmer errors, not persisted input. */
export function serializeLastSettleMarker(marker: LastSettleMarker): string {
  const validation = validateMarkerValue(marker);
  if (!validation.ok) throw new TypeError(`serializeLastSettleMarker: ${validation.reason}`);
  return `${JSON.stringify(validation.marker)}\n`;
}

/**
 * Derive phase-done board state once. Epic completion follows canonical containment, while the
 * global done frontier follows the graph's flat ticket index. Empty epics never clear vacuously.
 */
export function deriveEpicClearance(graph: WorkGraph): EpicClearanceResult {
  const epics = graph.epics.map((epic): EpicClearance => {
    const ticketsById = new Map(
      epic.stories.flatMap((story) => story.tickets).map((ticket) => [ticket.id, ticket] as const),
    );
    const tickets = [...ticketsById.values()].sort((a, b) => a.id.localeCompare(b.id));
    const clearedTicketIds = tickets
      .filter((ticket) => ticket.phase === "done")
      .map((ticket) => ticket.id);
    const total = tickets.length;
    return {
      epicId: epic.id,
      title: epic.title,
      cleared: clearedTicketIds.length,
      total,
      clearedTicketIds,
      allDone: total > 0 && clearedTicketIds.length === total,
    };
  });

  const doneTicketIds = graph.tickets
    .filter((ticket) => ticket.phase === "done")
    .map((ticket) => ticket.id)
    .sort();
  const allDoneEpicIds = epics.filter((epic) => epic.allDone).map((epic) => epic.epicId).sort();
  return { epics, doneTicketIds, allDoneEpicIds };
}

function copyGate(gate: SettleGateResult): SettleGateResult {
  if (!isNonBlank(gate.name) || !isNonBlank(gate.detail)) {
    throw new TypeError("computeSettleVerdict: gate name and detail must be non-blank strings");
  }
  if (gate.ok && gate.nextAction !== null) {
    throw new TypeError("computeSettleVerdict: a passing gate must have nextAction: null");
  }
  if (!gate.ok && !isNonBlank(gate.nextAction)) {
    throw new TypeError("computeSettleVerdict: a failed gate requires a non-blank nextAction");
  }
  return { ok: gate.ok, name: gate.name, detail: gate.detail, nextAction: gate.nextAction };
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function copyPresweep(presweep: SweepVerdict): SweepVerdict {
  const doneIds = sortedUnique(presweep.doneIds);
  const offenders = sortedUnique(presweep.offenders);
  if (!presweep.ok && offenders.length === 0) {
    throw new TypeError("computeSettleVerdict: a failed presweep requires at least one offender");
  }
  return { ok: presweep.ok, doneIds, offenders };
}

function copyReviewConcerns(concerns: readonly ReviewConcern[]): ReviewConcern[] {
  const copied = concerns.map((concern) => {
    if (
      !isNonBlank(concern.ticketId) ||
      !isNonBlank(concern.name) ||
      !isNonBlank(concern.nextAction)
    ) {
      throw new TypeError("computeSettleVerdict: review concern fields must be non-blank strings");
    }
    return {
      ticketId: concern.ticketId,
      name: concern.name,
      nextAction: concern.nextAction,
    };
  });
  return copied.sort(
    (a, b) =>
      a.ticketId.localeCompare(b.ticketId) ||
      a.name.localeCompare(b.name) ||
      a.nextAction.localeCompare(b.nextAction),
  );
}

function deriveExceptions(
  gate: SettleGateResult,
  presweep: SweepVerdict,
  reviewConcerns: readonly ReviewConcern[],
): SettleException[] {
  const exceptions: SettleException[] = [];
  if (!gate.ok) {
    exceptions.push({
      kind: "gate",
      name: gate.name,
      message: gate.detail,
      nextAction: gate.nextAction!,
    });
  }
  for (const path of presweep.offenders) {
    exceptions.push({
      kind: "presweep",
      name: path,
      message: `Uncommitted presweep offender: ${path}`,
      nextAction: `Commit or restore ${path}, then rerun \`bun run check:presweep\`.`,
    });
  }
  for (const concern of reviewConcerns) {
    exceptions.push({
      kind: "review",
      name: concern.ticketId,
      message: concern.name,
      nextAction: concern.nextAction,
    });
  }
  return exceptions;
}

/** Assemble one internally consistent settle result from a single immutable board snapshot. */
export function computeSettleVerdict(input: ComputeSettleInput): SettleResult {
  let loop: LisaLoopSettledMarker | null = null;
  if (input.loopSettledContents !== null) {
    const parsedLoop = parseLisaLoopSettledMarker(input.loopSettledContents);
    if (parsedLoop.kind === "malformed") {
      const reason = parsedLoop.reason === "invalid-json"
        ? "marker is not valid JSON"
        : "marker does not match the closed v1 Lisa loop-settled schema";
      return loopSettledRefusal(reason);
    }
    loop = parsedLoop.marker;
  }

  const marker = parseLastSettleMarker(input.lastSettleContents);
  if (!marker.ok) return marker.refusal;

  const gate = copyGate(input.gate);
  const presweep = copyPresweep(input.presweep);
  const reviewConcerns = copyReviewConcerns(input.reviewConcerns);
  const clearance = deriveEpicClearance(input.graph);
  const priorDone = new Set(marker.marker?.doneTicketIds ?? []);
  const newlyDoneTicketIds = clearance.doneTicketIds.filter((id) => !priorDone.has(id));
  const doneTicketIds = [...clearance.doneTicketIds];

  return {
    kind: "verdict",
    loop,
    delta: { firstSettle: marker.firstSettle, newlyDoneTicketIds },
    epics: clearance.epics,
    doneTicketIds,
    allDoneEpicIds: [...clearance.allDoneEpicIds],
    gate,
    presweep,
    reviewConcerns,
    exceptions: deriveExceptions(gate, presweep, reviewConcerns),
    nextMarker: { version: LAST_SETTLE_MARKER_VERSION, doneTicketIds: [...doneTicketIds] },
  };
}
