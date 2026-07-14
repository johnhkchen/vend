# T-021-02 — Structure: presentation-spec-schema-and-validator

_The blueprint — files, boundaries, public interface, internal organization, ordering. Not
code; the shape of the code._

## Files

| File | Change | Purpose |
|---|---|---|
| `src/present/spec.ts` | **create** | The pure presentation-spec module: knob enums, `PresentationSpec` type, presets, validator, error class. |
| `src/present/spec.test.ts` | **create** | Pure-function test suite over the validator + presets (AC coverage). |

New directory `src/present/` — the presentation side of E-021's data/presentation split (D1).
No other files touched. No fs, no BAML, no new dependency (D5, research §"Constraints").

## `src/present/spec.ts` — internal organization (top → bottom)

Order mirrors `model.ts` / `gates.ts`: header doc → error class → closed-set tuples & derived
types → typed interfaces → presets → coercion helpers → the validator → narrower/convenience.

### 1. Module header (the model.ts discipline)

Why pure (no fs/clock/network/addon — testable as a plain function); the data/presentation
split (this is the presentation side, reading the spec, never the graph); the two refusal
seams (`validateSpec` returns a verdict per the budget.ts rule; `parseSpec` throws for
corrupt-config callers); the snake→camel bridge; loader/`presentation:`-wrapper extraction is
out of scope.

### 2. Error class — `PresentationSpecError extends Error`

The `GraphIntegrityError` shape: `readonly violations: readonly SpecViolation[]`, a message that
lists every violation (`"PresentationSpecError: N invalid field(s):\n- …"`), `this.name` set.

### 3. Closed-set tuples + derived unions (the `GATE_NAMES` idiom)

`VOCABULARIES, DENSITIES, GROUPINGS, METAPHORS, COLOR_LANGUAGES, PRESETS, FACE_FIELDS,
DETAIL_FIELDS` as `[...] as const`, each with `export type X = (typeof XS)[number]`. These are
both the type source **and** the runtime membership oracle the validator greps.

### 4. Typed interfaces

`SpecLabels { status: Readonly<Record<string,string>> }`, then `PresentationSpec` (all
`readonly`, camelCase, per D5). `SpecViolation { field; reason }`. `SpecResult` discriminated
union (`{ok:true; spec}` | `{ok:false; violations}`).

### 5. Presets (D6) — exported typed constants

`DESIGNER_PRESET` and `DEV_PRESET`, authored from §2b/§2c, deep-frozen via `Object.freeze`
(small flat-enough objects; freeze the labels.status sub-map too). Typed as `PresentationSpec`
so a drift from the type is a compile error.

### 6. Coercion helpers (pure, private) — the validator's building blocks

Each pushes a `SpecViolation` and returns a fallback when the field is bad, so validation
**continues** and collects all errors (D3). Signature family takes the input record + a
`violations[]` accumulator:

- `enumField(data, key, allowed, label) → string | null` — value must be a string in `allowed`;
  on miss pushes `"{label}: '{value}' is not one of {key} → a | b | c"`. Used for vocabulary,
  density, group_by→groupBy, metaphor, color_language→colorLanguage, preset.
- `tokenArray(data, key, allowed, label) → string[]` — value must be an array whose every
  element is a distinct member of `allowed`; pushes a violation for a non-array, an unknown
  token, or a duplicate token. Used for `face` and `details`.
- `labelMap(data) → SpecLabels` — `labels` must be an object with a `status` object whose every
  value is a string; pushes a violation otherwise. Empty `status` map is valid (D4).

A small private `isRecord(x): x is Record<string, unknown>` guard (the model.ts
`typeof === object && !Array.isArray && !== null` check) gates the top of `validateSpec`.

### 7. The validator — `validateSpec(input: unknown): SpecResult`

Total, pure. Flow:

1. If `!isRecord(input)` → return `{ok:false, violations:[{field:"<spec>", reason:"…not an
   object"}]}` (the structural floor; can't read knobs off a non-object).
2. Run each coercer against `input`, accumulating into one `violations[]`.
3. If `violations.length > 0` → `{ok:false, violations}`.
4. Else assemble the `PresentationSpec` (camelCase fields, the snake→camel mapping happens
   here) and return `{ok:true, spec}`. The returned spec is `Object.freeze`-d (read-only, the
   model.ts immutability idiom; labels.status frozen too).

### 8. Convenience + narrower

- `parseSpec(input: unknown): PresentationSpec` — calls `validateSpec`; on `ok:false` throws
  `new PresentationSpecError(violations)`; else returns `result.spec`. (The throwing seam, D2.)
- `isValidSpec(r: SpecResult): r is {ok:true; spec: PresentationSpec}` — the `isStop` analogue.

## Public interface (the module's exports)

```
// types
PresentationSpec, SpecLabels, SpecViolation, SpecResult
Vocabulary, Density, Grouping, Metaphor, ColorLanguage, Preset, FaceField, DetailField
// closed sets (membership oracles, also useful to a UI building knob pickers)
VOCABULARIES, DENSITIES, GROUPINGS, METAPHORS, COLOR_LANGUAGES, PRESETS, FACE_FIELDS, DETAIL_FIELDS
// presets
DESIGNER_PRESET, DEV_PRESET
// behaviour
validateSpec, parseSpec, isValidSpec
// error
PresentationSpecError
```

## `src/present/spec.test.ts` — coverage blueprint

`import { describe, expect, test } from "bun:test";` then:

- **presets validate** — `validateSpec(DESIGNER_PRESET).ok === true`; same for `DEV_PRESET`;
  the AC's "valid spec accepted" case, exercised against the real deliverable presets.
- **the AC reject case** — a clone of `DESIGNER_PRESET` with `density: "huge"` →
  `ok === false`, exactly one violation, its `field === "density"`, its `reason` contains
  `"huge"` and the allowed set.
- **each knob rejects an out-of-set value** — vocabulary, group_by, metaphor, color_language,
  preset (table-driven over the bad-value list).
- **collect-all (D3)** — a spec with two bad knobs → `violations.length >= 2`.
- **tokenArray** — unknown token in `face`, duplicate token in `details`, non-array `face`.
- **labels** — non-object `labels`, non-string status value rejected; empty `status` accepted.
- **non-object input** — `validateSpec(null)` / `validateSpec(42)` → one `<spec>` violation.
- **`parseSpec` throws** — `parseSpec({...bad})` throws `PresentationSpecError` carrying
  violations; `parseSpec(DESIGNER_PRESET)` returns the typed spec.
- **read-only** — mutating the returned `spec` (or `spec.labels.status`) throws (frozen).
- **`isValidSpec`** narrows correctly on both branches.

## Ordering of changes (one atomic commit)

1. `src/present/spec.ts` (types + presets + validator).
2. `src/present/spec.test.ts`.
3. `bun run check` green → commit. Single self-contained unit; no migration ordering, no
   dependency on other in-flight tickets (`depends_on: []`).
