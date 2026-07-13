// Shared charter-cite disposition contract (T-077-02-01).
//
// Decompose has two editorial charter-cite surfaces: inline prose at materialization and
// `advances` entries before the bounds gate. Both must agree on the record a successful degrade
// emits, while structural defects remain refusals. This module settles that vocabulary before the
// two appliers land: a resolvable cite carries its snapshotted title; an unresolved, well-shaped
// cite carries the requested strip/annotate disposition; an invalid cite input is structural.
//
// PURE and addon-free — no fs, clock, process, BAML, renderer, gate, or ledger dependency. The
// snapshot is the only resolution oracle. Later tickets own applying the action and persisting the
// returned disposition.

import type { CharterSnapshot } from "./charter-snapshot.ts";

/** The complete set of editorial transformations an unresolved charter cite may take. */
export const DEGRADE_ACTIONS = ["strip", "annotate"] as const;

export type DegradeAction = (typeof DEGRADE_ACTIONS)[number];

/** One already-located charter cite and the action its caller will apply on a snapshot miss. */
export interface CharterCite {
  readonly code: string;
  readonly location: string;
  readonly action: DegradeAction;
}

/** Durable per-cite evidence for a successful editorial degradation. */
export interface DegradeDisposition {
  readonly code: string;
  readonly location: string;
  readonly action: DegradeAction;
}

export type StructuralCiteReason = "invalid-code" | "missing-location";

export interface ResolvableCharterCite {
  readonly classification: "resolvable";
  readonly code: string;
  readonly location: string;
  readonly title: string;
}

export interface DegradableCharterCite {
  readonly classification: "degradable";
  readonly disposition: DegradeDisposition;
}

export interface StructuralCharterCite {
  readonly classification: "structural";
  readonly code: string;
  readonly location: string;
  readonly reason: StructuralCiteReason;
}

/** The exhaustive judgment for one cite. */
export type CharterCiteClassification =
  | ResolvableCharterCite
  | DegradableCharterCite
  | StructuralCharterCite;

export interface Materialized {
  readonly status: "materialized";
  readonly degrades: readonly DegradeDisposition[];
}

export interface MaterializedWithDegrades {
  readonly status: "materialized-with-degrades";
  readonly degrades: readonly DegradeDisposition[];
}

export interface StructuralRefusal {
  readonly status: "structural-refusal";
  readonly finding: StructuralCharterCite;
}

/** A clean materialization, a successful degraded materialization, or a structural refusal. */
export type MaterializationDisposition =
  | Materialized
  | MaterializedWithDegrades
  | StructuralRefusal;

/** The same prefix-generic code shape accepted by `snapshotCharterCodes`. */
const CHARTER_CODE = /^[A-Z]{1,3}\d+$/;

/**
 * Classify one cited charter code against a cut-time snapshot. Surrounding whitespace is
 * canonicalized before lookup and recording. A valid snapshot miss is editorial and degradable;
 * malformed input is structural returned data, never an exception.
 */
export function classifyCharterCite(
  cite: CharterCite,
  snapshot: CharterSnapshot,
): CharterCiteClassification {
  const code = cite.code.trim();
  const location = cite.location.trim();

  if (!CHARTER_CODE.test(code)) {
    return { classification: "structural", code, location, reason: "invalid-code" };
  }
  if (location === "") {
    return { classification: "structural", code, location, reason: "missing-location" };
  }

  const title = snapshot.get(code);
  if (title !== undefined) {
    return { classification: "resolvable", code, location, title };
  }
  return {
    classification: "degradable",
    disposition: { code, location, action: cite.action },
  };
}

/**
 * Fold per-cite judgments into the materialization taxonomy. First structural finding wins; in a
 * successful result every degradation is preserved in caller order and never deduplicated.
 */
export function materializationDisposition(
  classifications: readonly CharterCiteClassification[],
): MaterializationDisposition {
  const degrades: DegradeDisposition[] = [];
  for (const classification of classifications) {
    if (classification.classification === "structural") {
      return { status: "structural-refusal", finding: classification };
    }
    if (classification.classification === "degradable") {
      degrades.push(classification.disposition);
    }
  }
  return degrades.length > 0
    ? { status: "materialized-with-degrades", degrades }
    : { status: "materialized", degrades };
}
