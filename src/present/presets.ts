// Role presets + spec PERSISTENCE + per-seat default (T-021-03, story S-021-02, epic E-021
// linear-presentation-surface). This is the layer that turns T-021-02's pure presentation-spec
// (src/present/spec.ts) into something SAVED and RELOADED: the calibration loop starts from a
// seat's preset, the designer dials the knobs, the tuned spec is saved, and "the tuned view
// reproduces on demand" because loading the seat returns the saved spec (falling back to the
// built-in preset when nothing is saved). Grounded in docs/active/pm/linear-surface-prep.md §2c
// ("the same graph renders differently per seat") and job-stories §"the designer preset loads by
// default for the designer's seat."
//
// PURITY (house pattern, cf. materialize.ts / run-log.ts — pure render/serialize + one thin
// impure verb in one file): the seat→preset table and the serialize/deserialize pair are PURE
// (no fs/clock/network/addon) and unit-tested with fabricated specs. The two world-touching
// verbs — saveSeatSpec / loadSeatSpec — are the only impure surface, thin wrappers over
// mkdir/readFile/writeFile, exercised by a real-fs temp-dir test exactly as `materialize` /
// `appendRunLog` are.
//
// BYTE-EQUAL IS STRUCTURAL (the AC's "round-trips byte-equal"): serializeSpec does NOT stringify
// the input object directly — it rebuilds a fresh plain object in ONE fixed field order (the
// order validateSpec assembles) and Bun.YAML.stringifies that. Both the save path and any
// round-trip check funnel through this one canonical serializer, so save → load → save reproduces
// identical bytes regardless of the input's key order. Bun.YAML is the board's serializer
// (model.ts) — no external YAML dependency, here or anywhere.
//
// SCOPE: this persists the CANONICAL camelCase spec, so it composes straight into validateSpec
// with no key bridging. The §2b snake_case / `presentation:`-wrapper YAML config (the eventual
// Linear render contract) is a SEPARATE future loader, deferred exactly as spec.ts's header
// states — not this ticket's job.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DESIGNER_PRESET, DEV_PRESET, PresentationSpecError, validateSpec } from "./spec.ts";
import type { PresentationSpec, Preset, SpecResult } from "./spec.ts";

// ── seats (the GATE_NAMES idiom: an as-const tuple → both the type and the membership set) ──────

/** The roles the same canonical graph is projected for (§2c). `designer` and `dev` are the two
 *  seats with a built-in preset; `founder` (job-stories) has no preset, so it is not a Seat. */
export const SEATS = ["designer", "dev"] as const;
export type Seat = (typeof SEATS)[number];

// ── seat / preset table (pure) ──────────────────────────────────────────────────────────────────

/** The single source mapping a seat to its built-in default preset. Seat and named lookups both
 *  read this, so they can never drift. */
const SEAT_DEFAULTS: Readonly<Record<Seat, PresentationSpec>> = Object.freeze({
  designer: DESIGNER_PRESET,
  dev: DEV_PRESET,
});

/**
 * The built-in default preset for a seat: `designer → DESIGNER_PRESET`, `dev → DEV_PRESET`. Pure.
 * This is the spec a seat resolves to when nothing has been saved for it — the AC's "the designer
 * seat resolves to the designer preset by default."
 */
export function defaultPresetForSeat(seat: Seat): PresentationSpec {
  return SEAT_DEFAULTS[seat];
}

/**
 * Look up a built-in preset by its `preset` token: `designer → DESIGNER_PRESET`,
 * `dev → DEV_PRESET`, `custom → null` (a tuned spec has no canonical built-in). Pure. Satisfies
 * "loading the 'designer' preset returns vocabulary:plain · density:low · metaphor:tree."
 */
export function presetByName(name: Preset): PresentationSpec | null {
  if (name === "designer") return DESIGNER_PRESET;
  if (name === "dev") return DEV_PRESET;
  return null;
}

// ── canonical serializer / total deserializer (pure; byte-equal by construction) ────────────────

/**
 * Serialize a spec to canonical block YAML. PURE and DETERMINISTIC: builds a fresh plain object in
 * the FIXED field order validateSpec assembles (so the output depends only on the spec's values,
 * never the input's key order), copying the array and label-map fields into plain structures
 * while preserving their order, then `Bun.YAML.stringify(obj, null, 2)`. Reads the (frozen) spec
 * only — never mutates it. Routing every save and round-trip check through this one function is
 * what makes the AC's byte-equal round-trip structural rather than coincidental.
 */
export function serializeSpec(spec: PresentationSpec): string {
  const status: Record<string, string> = {};
  for (const [k, v] of Object.entries(spec.labels.status)) status[k] = v;
  const canonical = {
    preset: spec.preset,
    vocabulary: spec.vocabulary,
    density: spec.density,
    face: [...spec.face],
    details: [...spec.details],
    groupBy: spec.groupBy,
    metaphor: spec.metaphor,
    labels: { status },
    colorLanguage: spec.colorLanguage,
  };
  return Bun.YAML.stringify(canonical, null, 2);
}

/**
 * Parse serialized YAML back into a validated spec verdict. TOTAL and PURE (the budget.ts rule):
 * never throws — a malformed file is RETURNED as `{ ok:false, violations }`. A YAML *syntax*
 * error folds into a single `<yaml>` violation (optionally naming `source`); otherwise the parsed
 * value is handed to {@link validateSpec}, whose verdict (and full violation list) is returned
 * unchanged. The mirror of serializeSpec, composing T-021-02's validator without duplicating it.
 */
export function deserializeSpec(text: string, source?: string): SpecResult {
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(text);
  } catch (err) {
    const where = source ? ` in ${source}` : "";
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, violations: [{ field: "<yaml>", reason: `malformed YAML${where}: ${reason}` }] };
  }
  return validateSpec(parsed);
}

// ── impure fs verbs (the two thin world-touching functions) ──────────────────────────────────────

/** Where saved seat presets live — the project-state dir convention (cf. run-log's
 *  `.vend/runs.jsonl`). Overridable per call so tests write to a temp dir. */
export const DEFAULT_PRESETS_DIR = ".vend/presets";

/** The file a seat's saved spec lives in: `{dir}/{seat}.yaml`. Pure path helper (no fs). */
export function seatSpecPath(seat: Seat, dir: string = DEFAULT_PRESETS_DIR): string {
  return join(dir, `${seat}.yaml`);
}

/**
 * Save a (tuned) spec as the seat's preset. The single write verb: `mkdir -p` the target dir,
 * then `writeFile` the canonical serialization. Returns the path written. Thin and untested
 * directly (its judgment is serializeSpec's), exactly as `materialize` / `appendRunLog` are; the
 * byte-equal round-trip is covered by a real-fs test.
 */
export async function saveSeatSpec(
  seat: Seat,
  spec: PresentationSpec,
  dir: string = DEFAULT_PRESETS_DIR,
): Promise<string> {
  const path = seatSpecPath(seat, dir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializeSpec(spec), "utf8");
  return path;
}

/**
 * Resolve a seat to its effective spec — the saved tune if one exists, else the built-in default
 * preset. "The tuned view reproduces on demand" and "the designer seat resolves to the designer
 * preset by default" are the SAME path, distinguished only by whether the file exists: a missing
 * file (ENOENT) falls back to {@link defaultPresetForSeat} (the load.ts tolerance precedent), but
 * a PRESENT-but-corrupt file throws {@link PresentationSpecError} — a saved tune lost to a bad
 * write is a loud refusal, never silently swapped for a default.
 */
export async function loadSeatSpec(
  seat: Seat,
  dir: string = DEFAULT_PRESETS_DIR,
): Promise<PresentationSpec> {
  const path = seatSpecPath(seat, dir);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return defaultPresetForSeat(seat);
    throw err;
  }
  const result = deserializeSpec(text, path);
  if (!result.ok) throw new PresentationSpecError(result.violations);
  return result.spec;
}
