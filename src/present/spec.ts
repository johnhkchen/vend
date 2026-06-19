// The PRESENTATION SPEC — the typed code-as-config that governs how the canonical work-graph
// is PROJECTED for a human (T-021-02, story S-021-02, epic E-021 linear-presentation-surface).
// This is the PRESENTATION side of E-021's data/presentation split: the graph (src/graph/) is
// the fixed source of truth; calibration edits THIS spec, never the graph. The seven knobs come
// straight from docs/active/pm/linear-surface-prep.md §2a/§2b: vocabulary, density,
// field-visibility (face + details), grouping, metaphor, labels, color-language.
//
// PURITY (house pattern, cf. gates.ts / id-guard.ts / graph/model.ts): everything here is pure
// — closed-set membership checks, coercion, freezing — no fs, clock, network, or native addon,
// so spec.test.ts is an ordinary pure-function test over plain records. Reading a YAML config
// file and extracting its `presentation:` wrapper is a FUTURE impure loader's job (the model.ts
// ↔ load.ts split); this module validates the spec OBJECT itself.
//
// TWO REFUSAL SEAMS (the budget.ts house rule, restated in gates.ts): a malformed spec is an
// EXPECTED, recoverable refusal — the calibration loop dials a knob and re-validates — so the
// primary surface RETURNS a verdict (validateSpec → SpecResult), like gates.clear. A thin
// throwing wrapper (parseSpec → PresentationSpecError) serves callers that treat a broken config
// as corrupt data, mirroring the sibling model.ts. The verdict COLLECTS EVERY violation (the
// GraphIntegrityError discipline) — a human tuning several knobs fixes them all at once, not in
// a fix-one-rerun loop.
//
// FIELD CASING: this validator validates the CANONICAL camelCase shape (input keys == output
// keys, `groupBy` / `colorLanguage`) — so the exported presets round-trip cleanly and the
// function is a validator, not a key-transformer. §2b's YAML sketch uses snake_case
// (group_by, color_language); mapping those keys to the canonical shape is a future YAML
// loader's job, the same way the `presentation:` wrapper extraction is out of scope here.

// ── error class (the GraphIntegrityError discipline: collect all, report once) ────────────────

/** One or more knobs in a spec are malformed (out-of-set value, wrong type, unknown/duplicate
 *  token). Collects EVERY violation and throws once, so a corrupt spec is reported in full. The
 *  presentation analogue of GraphIntegrityError — an expected, typed refusal the caller can
 *  catch. Thrown only by {@link parseSpec}; {@link validateSpec} returns the violations instead. */
export class PresentationSpecError extends Error {
  readonly violations: readonly SpecViolation[];
  constructor(violations: readonly SpecViolation[]) {
    super(
      `PresentationSpecError: ${violations.length} invalid field(s):\n- ` +
        violations.map((v) => `${v.field}: ${v.reason}`).join("\n- "),
    );
    this.name = "PresentationSpecError";
    this.violations = violations;
  }
}

// ── closed-set knobs (as-const tuples → derived unions AND runtime membership oracles) ─────────

/** §2a Vocabulary — how much dev language leaks through. */
export const VOCABULARIES = ["plain", "mixed", "technical"] as const;
/** §2a Density — how much information per card. */
export const DENSITIES = ["low", "medium", "full"] as const;
/** §2a Grouping — the axis cards are grouped along. */
export const GROUPINGS = ["epic", "story", "status", "role", "leverage"] as const;
/** §2a Metaphor — the overall layout shape. */
export const METAPHORS = ["tree", "board", "timeline"] as const;
/** §2a Color language — what color MEANS. */
export const COLOR_LANGUAGES = ["leverage", "status", "role"] as const;
/** §2b preset — the spec's origin marker (not a knob; never cross-checked against knob values). */
export const PRESETS = ["designer", "dev", "custom"] as const;
/** §2b face — the intent-layer tokens allowed on the card face (field-visibility, half one). */
export const FACE_FIELDS = ["plain_title", "why", "state", "breakdown"] as const;
/** §2b details — the dev-layer tokens allowed behind progressive disclosure (field-visibility). */
export const DETAIL_FIELDS = ["charter_codes", "file_cites", "baml_internals", "raw_acceptance_criteria"] as const;

export type Vocabulary = (typeof VOCABULARIES)[number];
export type Density = (typeof DENSITIES)[number];
export type Grouping = (typeof GROUPINGS)[number];
export type Metaphor = (typeof METAPHORS)[number];
export type ColorLanguage = (typeof COLOR_LANGUAGES)[number];
export type Preset = (typeof PRESETS)[number];
export type FaceField = (typeof FACE_FIELDS)[number];
export type DetailField = (typeof DETAIL_FIELDS)[number];

// ── typed spec shape (all readonly — the model.ts immutability idiom) ──────────────────────────

/** The labels knob (§2b `labels:`): a map of canonical status → display string
 *  (`open → "To do"`). An empty map is valid — it means "show raw statuses". */
export interface SpecLabels {
  readonly status: Readonly<Record<string, string>>;
}

/** The presentation spec — the calibratable code-as-config that drives a projection of the
 *  canonical graph. The seven knobs of §2a (field-visibility split into `face`/`details` per
 *  §2b) plus the `preset` origin marker. camelCase fields; snake_case input keys are bridged
 *  by {@link validateSpec}. */
export interface PresentationSpec {
  readonly preset: Preset;
  readonly vocabulary: Vocabulary;
  readonly density: Density;
  readonly face: readonly FaceField[];
  readonly details: readonly DetailField[];
  readonly groupBy: Grouping; // §2b group_by
  readonly metaphor: Metaphor;
  readonly labels: SpecLabels;
  readonly colorLanguage: ColorLanguage; // §2b color_language
}

/** One malformed knob: which field, and why (always naming the bad value + the allowed set). */
export interface SpecViolation {
  readonly field: string;
  readonly reason: string;
}

/** The validation verdict — a value the caller switches on, never an exception (budget.ts rule).
 *  `ok:true` carries the frozen, typed spec; `ok:false` carries EVERY violation found. */
export type SpecResult =
  | { readonly ok: true; readonly spec: PresentationSpec }
  | { readonly ok: false; readonly violations: readonly SpecViolation[] };

// ── presets (§2c) — exported typed constants, the calibration loop's starting points ──────────

/** §2c designer preset — intent on the face, all dev detail hidden. Also the canonical
 *  "valid spec" fixture. Frozen so it cannot be mutated in place. */
export const DESIGNER_PRESET: PresentationSpec = Object.freeze({
  preset: "designer",
  vocabulary: "plain",
  density: "low",
  face: Object.freeze(["plain_title", "why", "state", "breakdown"]) as readonly FaceField[],
  details: Object.freeze([
    "charter_codes",
    "file_cites",
    "baml_internals",
    "raw_acceptance_criteria",
  ]) as readonly DetailField[],
  groupBy: "story",
  metaphor: "tree",
  labels: Object.freeze({
    status: Object.freeze({ open: "To do", in_progress: "In progress", done: "Done" }),
  }),
  colorLanguage: "leverage",
});

/** §2c dev preset — technical vocabulary, full density, cites and internals promoted to the
 *  face. The other end of the calibration range. */
export const DEV_PRESET: PresentationSpec = Object.freeze({
  preset: "dev",
  vocabulary: "technical",
  density: "full",
  face: Object.freeze(["plain_title", "state", "breakdown"]) as readonly FaceField[],
  details: Object.freeze(["charter_codes", "file_cites", "baml_internals"]) as readonly DetailField[],
  groupBy: "epic",
  metaphor: "tree",
  labels: Object.freeze({ status: Object.freeze({}) }),
  colorLanguage: "status",
});

// ── coercion helpers (pure, private; each pushes a violation + returns a fallback) ─────────────

/** The model.ts object guard: a non-null, non-array object. */
function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/** Render an allowed set as `a | b | c` for a clear error message. */
function allowedList(allowed: readonly string[]): string {
  return allowed.join(" | ");
}

/**
 * Validate that `data[key]` is a string in `allowed`. On miss, pushes a violation naming the
 * value and the allowed set, and returns null (the caller treats the assembled spec as invalid
 * because the violations array is non-empty). `field` is the camelCase name reported.
 */
function enumField<T extends string>(
  data: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  field: string,
  violations: SpecViolation[],
): T | null {
  const v = data[key];
  if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
  const shown = typeof v === "string" ? `'${v}'` : JSON.stringify(v) ?? String(v);
  violations.push({ field, reason: `${shown} is not one of ${key} → ${allowedList(allowed)}` });
  return null;
}

/**
 * Validate that `data[key]` is an array whose every element is a DISTINCT member of `allowed`.
 * Pushes a violation for a non-array, any unknown token, or any duplicate. Returns the validated
 * tokens (or [] on a non-array). Empty is valid — a deliberately bare card.
 */
function tokenArray<T extends string>(
  data: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  violations: SpecViolation[],
): T[] {
  const v = data[key];
  if (!Array.isArray(v)) {
    violations.push({ field: key, reason: `must be an array of ${allowedList(allowed)}` });
    return [];
  }
  const seen = new Set<string>();
  const out: T[] = [];
  for (const tok of v) {
    if (typeof tok !== "string" || !(allowed as readonly string[]).includes(tok)) {
      violations.push({ field: key, reason: `'${String(tok)}' is not a valid ${key} token → ${allowedList(allowed)}` });
      continue;
    }
    if (seen.has(tok)) {
      violations.push({ field: key, reason: `duplicate token '${tok}'` });
      continue;
    }
    seen.add(tok);
    out.push(tok as T);
  }
  return out;
}

/**
 * Validate the labels knob: an object with a `status` object whose every value is a string.
 * An empty `status` map is valid. Pushes a violation otherwise; returns a frozen SpecLabels.
 */
function labelMap(data: Record<string, unknown>, violations: SpecViolation[]): SpecLabels {
  const v = data["labels"];
  if (!isRecord(v) || !isRecord(v["status"])) {
    violations.push({ field: "labels", reason: "must be an object with a `status` map of string → string" });
    return { status: Object.freeze({}) };
  }
  const status: Record<string, string> = {};
  for (const [k, val] of Object.entries(v["status"])) {
    if (typeof val !== "string") {
      violations.push({ field: "labels.status", reason: `value for '${k}' must be a string` });
      continue;
    }
    status[k] = val;
  }
  return { status: Object.freeze(status) };
}

// ── the validator (total, pure; collects all violations) ───────────────────────────────────────

/**
 * Validate an untyped spec object into a typed, frozen {@link PresentationSpec}. Total and PURE:
 * never throws — a malformed spec is RETURNED as `{ ok:false, violations }` (the budget.ts rule:
 * an expected refusal is data). Collects EVERY violation (the GraphIntegrityError discipline) so
 * a human dialing several knobs fixes them in one pass. Bridges snake_case input keys
 * (`group_by`, `color_language`) to the camelCase typed shape here, in the one place it happens.
 */
export function validateSpec(input: unknown): SpecResult {
  if (!isRecord(input)) {
    return { ok: false, violations: [{ field: "<spec>", reason: "spec must be an object" }] };
  }
  const violations: SpecViolation[] = [];

  const preset = enumField(input, "preset", PRESETS, "preset", violations);
  const vocabulary = enumField(input, "vocabulary", VOCABULARIES, "vocabulary", violations);
  const density = enumField(input, "density", DENSITIES, "density", violations);
  const groupBy = enumField(input, "groupBy", GROUPINGS, "groupBy", violations);
  const metaphor = enumField(input, "metaphor", METAPHORS, "metaphor", violations);
  const colorLanguage = enumField(input, "colorLanguage", COLOR_LANGUAGES, "colorLanguage", violations);
  const face = tokenArray(input, "face", FACE_FIELDS, violations);
  const details = tokenArray(input, "details", DETAIL_FIELDS, violations);
  const labels = labelMap(input, violations);

  if (violations.length > 0) return { ok: false, violations };

  const spec: PresentationSpec = Object.freeze({
    preset: preset!,
    vocabulary: vocabulary!,
    density: density!,
    face: Object.freeze(face) as readonly FaceField[],
    details: Object.freeze(details) as readonly DetailField[],
    groupBy: groupBy!,
    metaphor: metaphor!,
    labels,
    colorLanguage: colorLanguage!,
  });
  return { ok: true, spec };
}

// ── convenience seam + narrower ────────────────────────────────────────────────────────────────

/**
 * Validate and return the typed spec, THROWING {@link PresentationSpecError} (carrying every
 * violation) on a malformed spec. The corrupt-config-as-data seam — mirrors the sibling
 * model.ts's throwing parsers. Prefer {@link validateSpec} when an invalid spec is an expected,
 * recoverable state (the calibration UI).
 */
export function parseSpec(input: unknown): PresentationSpec {
  const r = validateSpec(input);
  if (!r.ok) throw new PresentationSpecError(r.violations);
  return r.spec;
}

/** Narrow a {@link SpecResult} to its valid branch — the gates.ts `isStop` analogue. */
export function isValidSpec(r: SpecResult): r is { ok: true; spec: PresentationSpec } {
  return r.ok;
}
