# T-021-03 — Design: role-presets-save-load-seat-default

_Enumerate viable approaches, assess against the research, choose one with rationale, record
what was rejected and why._

## What must be true at the end (from the AC)

1. **Load a named preset** → `loadPreset("designer")` (or seat-default with nothing saved)
   returns a spec with `vocabulary:plain · density:low · metaphor:tree` (i.e. `DESIGNER_PRESET`).
2. **Save + reload round-trips byte-equal** → a tuned spec written to disk and read back, then
   re-written, produces identical bytes.
3. **Per-seat default** → a test confirms the **designer seat resolves to the designer preset by
   default** (no saved file).

## Decision summary

A single new module `src/present/presets.ts` (pure serialize/deserialize + seat→preset table +
thin impure fs verbs, the `materialize.ts`/`run-log.ts` one-file split), plus
`src/present/presets.test.ts`. Persist the **canonical camelCase spec** as **block YAML via
`Bun.YAML.stringify(obj, null, 2)`** through a **canonical serializer** (fixed field order).
Seat resolution = **saved-or-default**: `loadSeatSpec(seat)` returns the saved file if present,
else `defaultPresetForSeat(seat)`. Default presets dir `.vend/presets/`, overridable.

---

## D1 — Where does the code live? (one file vs split)

- **Option A — one file `presets.ts`** holding pure serializer + seat table + thin impure fs
  verbs, header documents the split. _Precedent: `materialize.ts`, `run-log.ts`._
- **Option B — split `presets.ts` (pure) + `presets-store.ts` (impure)**, mirroring
  `graph/model.ts` ↔ `graph/load.ts`.

**Chosen: A.** The impure surface is tiny (two thin verbs: `saveSeatSpec`, `loadSeatSpec`) and
the pure surface (serializer, seat table) is small — exactly the shape where the house keeps
both in one file with a header-documented split (`run-log.ts`, `materialize.ts`). The model.ts
split earns its second file because the pure core is large (parsing, linking, integrity); here
it is not. One file keeps the calibration-loop API discoverable in one place.

## D2 — Serialization format: YAML vs JSON vs hand-rolled

- **Option A — `Bun.YAML.stringify(canonicalObj, null, 2)`.** Block-style YAML, already the
  board's serializer, no new dep, deterministic, **verified byte-equal on round-trip**, readable
  (close to §2b's sketch but camelCase), and `Bun.YAML.parse` composes straight into
  `validateSpec`.
- **Option B — `JSON.stringify(obj, null, 2)`.** Trivially deterministic and byte-equal, no
  quoting edge cases. But JSON is not the board's idiom (frontmatter is YAML) and drifts from the
  §2b YAML intent for no gain.
- **Option C — hand-rolled block-YAML serializer in §2b snake_case with a `presentation:`
  wrapper.** Most faithful to §2b's eventual Linear config, but pulls in the snake↔camel bridge
  and bespoke quoting (`"To do"`, `"In progress"`) that `Bun.YAML` already handles — scope and
  risk the AC does not ask for, and `spec.ts` explicitly defers.

**Chosen: A.** It is the lowest-risk way to hit "byte-equal round-trip" while staying in the
house idiom and adding zero dependencies. The §2b snake_case/`presentation:`-wrapper render
contract is deferred exactly as `spec.ts`'s header states (a future Linear-config loader), and
noted as an open concern. Verified empirically (research §"House persistence patterns"):
`stringify(parse(stringify(x,null,2)),null,2) === stringify(x,null,2)` for both presets,
including the empty-status-map and spaced label values.

## D3 — How is byte-equality guaranteed? (canonical serializer)

Byte-equality across `save → load → save` requires the serialized form to depend **only** on the
spec's values, not on the field insertion order of whatever object is handed in. So
`serializeSpec` does **not** stringify the input object directly; it builds a fresh plain object
in **one fixed field order** (`preset, vocabulary, density, face, details, groupBy, metaphor,
labels:{status}, colorLanguage` — the order `validateSpec` itself assembles) and stringifies
that. `labels.status` keys are emitted in their existing iteration order; since `Bun.YAML.parse`
preserves order and `validateSpec` rebuilds `status` in parse order, a save→load→save cycle is
byte-stable. **Both** the save path and the round-trip check funnel through this one serializer,
so byte-equality is structural, not coincidental.

## D4 — Seat resolution model: saved-or-default

- **Option A — `loadSeatSpec(seat)` = saved file if present, else built-in preset.** One call
  resolves a seat to its effective spec. "Tuned view reproduces on demand" and "designer seat
  resolves to the designer preset by default" become **the same code path** distinguished only
  by whether a file exists (the `load.ts` ENOENT→default precedent).
- **Option B — separate `resolveSeat` (with fallback) and `loadSavedSpec` (throws on missing).**
  More surface, two concepts where one suffices.

**Chosen: A.** It directly encodes the AC's two clauses as one tolerant verb. A **present but
malformed** file is still a loud refusal (D6) — only **absence** falls back to the default.

## D5 — Named-preset lookup vs seat lookup

The AC phrases it two ways: "loading the **'designer' preset**" and "the **designer seat**
resolves to the designer preset." These are two lenses:

- `presetByName(name: Preset): PresentationSpec | null` — pure, maps the `preset` token
  (`"designer"|"dev"|"custom"`) to its built-in spec (`custom → null`, it has no canonical
  built-in). Satisfies "loading the 'designer' preset."
- `defaultPresetForSeat(seat: Seat): PresentationSpec` — pure, maps a **seat** to its default
  preset (`designer → DESIGNER_PRESET`, `dev → DEV_PRESET`). Satisfies "the designer seat
  resolves to the designer preset by default."

**Chosen: provide both** — they are one-liners over a shared table, and each names a real
concept the calibration loop and the AC use. `SEATS = ["designer","dev"] as const` defines the
`Seat` type; `founder` (job-stories) is excluded because it has no preset.

## D6 — Corrupt-config behavior on load

Mirror the `validateSpec`/`parseSpec` duality and `loadWorkGraph`'s loud propagation:

- A **missing** seat file → return the default preset (expected first-run state, ENOENT→default).
- A **present but malformed** file (bad YAML, or valid YAML failing `validateSpec`) → **throw**
  `PresentationSpecError` (corrupt config is loud, never silently coerced to a default — a silent
  fallback would hide that the designer's saved tune was lost). The pure `deserializeSpec`
  remains **total** (returns a `SpecResult` verdict, folding YAML syntax errors into a violation);
  the impure `loadSeatSpec` converts a `not-ok` verdict into the throw.

## Rejected, briefly

- **A `presentation:` YAML wrapper + snake_case now** — deferred (D2 option C); not in the AC,
  and `spec.ts` assigns it to a future loader.
- **A registry/index file listing all saved presets** — over-built; one file per seat
  (`.vend/presets/{seat}.yaml`) is enough for the two seats and trivially discoverable.
- **Storing only the `preset` name and re-deriving knobs on load** — breaks the moment a spec is
  *tuned* away from a built-in; the AC requires persisting the full tuned spec byte-for-byte.
- **A new dependency (js-yaml, etc.)** — house rule: `Bun.YAML` is sufficient.

## Public surface (the contract this design commits to)

```
// seats
SEATS, type Seat
defaultPresetForSeat(seat): PresentationSpec
presetByName(name: Preset): PresentationSpec | null
// serialization (pure, canonical, byte-equal)
serializeSpec(spec): string
deserializeSpec(text, source?): SpecResult          // total; YAML errors → a violation
// fs verbs (impure, .vend/presets, overridable dir)
DEFAULT_PRESETS_DIR, seatSpecPath(seat, dir?)
saveSeatSpec(seat, spec, dir?): Promise<string>      // mkdir -p + write; returns path
loadSeatSpec(seat, dir?): Promise<PresentationSpec>  // saved-or-default; throws on corrupt
```
