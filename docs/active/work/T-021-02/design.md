# T-021-02 — Design: presentation-spec-schema-and-validator

_Options, tradeoffs, decisions — grounded in research.md. One choice per question, with the
rejected alternatives and why._

## D1 — Where it lives

**Options:** (a) extend `src/graph/` (the data side); (b) new `src/present/` directory; (c)
drop it in `src/play/` next to the other pure cores.

**Decision: (b) `src/present/spec.ts` + `src/present/spec.test.ts`.**

The epic is an explicit **data/presentation split**. `src/graph/` *is* the data side (model +
loader). Putting the spec there would blur the very boundary E-021 exists to draw. `src/play/`
is for playbook plays (BAML-backed verbs), which this is not. A new `src/present/` directory
names the presentation side cleanly and gives the downstream renderer / calibration tickets an
obvious home. Rejected (a)/(c): they erode the conceptual seam the epic is built on.

## D2 — Throw vs return on a malformed spec

**Options:** (a) **throw** a typed error (the `model.ts` / `GraphIntegrityError` discipline);
(b) **return** a discriminated-union result (the `gates.ts` / `GateResult` discipline);
(c) both — a result-returning core plus a throwing convenience wrapper.

**Decision: (c) — `validateSpec` returns a result (primary); `parseSpec` throws (convenience).**

Both house disciplines are live, and the budget.ts rule picks between them by *meaning*. A
presentation spec is **user-editable config**: in the calibration loop (§2c) the designer dials
a knob, we re-validate, and an invalid value is an **expected, recoverable state the UI shows**
— not corrupt internal data and not a programmer error. By the budget.ts rule ("an expected
refusal is data, not an exception"), the primary surface must **return** a verdict — like
`gates.clear`. So `validateSpec(input): SpecResult` is the core.

But some callers (a strict loader that treats a broken config file as corrupt data, or a test)
prefer exception semantics — mirroring `model.ts` in the sibling directory. So I add a thin
`parseSpec(input): PresentationSpec` that calls `validateSpec` and **throws** a
`PresentationSpecError` (carrying all violations) when invalid. This gives both seams from one
core, exactly as the codebase already offers `clear` (returns) alongside `model`'s throwing
parsers. Rejected pure-(a): hostile to the calibration UI. Rejected pure-(b): no clean seam for
corrupt-config-as-data callers and no symmetry with the sibling `model.ts`.

## D3 — Collect all violations, or stop at the first

**Options:** (a) first-error (the `gates.clear` andon — stop the line at the first stop);
(b) collect-all (the `GraphIntegrityError` discipline — report the corrupt artifact in full).

**Decision: (b) collect ALL violations.**

`gates.clear` stops at the first failure because it reports the **highest-priority** defect of
a *generated* plan (value > allocation > …) — there is a priority ordering worth surfacing. A
presentation spec has **no priority ordering among knobs**, and the consumer is a human dialing
several knobs at once: telling them "density is invalid" and hiding that `group_by` is *also*
wrong would force a frustrating fix-one-rerun loop. `model.ts`'s `GraphIntegrityError` already
sets the precedent for "collect every violation, report once." Each violation names the field,
the bad value, and the allowed set — a *clear* error per the AC.

## D4 — Required-everything vs optional-with-defaults

**Options:** (a) every knob required (a spec fully specifies the projection); (b) optional
knobs that fall back to designer-preset defaults.

**Decision: (a) all seven knobs + `preset` required; `labels.status` may be an empty map.**

§2c's loop is "**start from a preset** → adjust knobs → save" — so a real spec is *always* a
complete object (a copied preset, then edited). A full spec keeps the validator simple and the
render contract unambiguous (no "what did this knob default to?" guessing at render time).
Ergonomics come from the **exported presets** (D6), not from partial specs. The one tolerated
emptiness is `labels.status`: an empty relabel map is meaningful ("show raw statuses"), not
malformed. `face` / `details` arrays may be empty (a deliberately bare card) but reject unknown
or duplicate tokens. Rejected (b): defaulting hides intent and complicates the validator with a
merge step that belongs (if anywhere) in a loader.

## D5 — Modeling the seven knobs as types

Closed sets become `as const` tuples with derived unions (the `GATE_NAMES` idiom) — the tuple
doubles as the **runtime membership oracle** the validator greps:

```ts
export const VOCABULARIES   = ["plain", "mixed", "technical"] as const;
export const DENSITIES      = ["low", "medium", "full"] as const;
export const GROUPINGS      = ["epic", "story", "status", "role", "leverage"] as const;
export const METAPHORS      = ["tree", "board", "timeline"] as const;
export const COLOR_LANGUAGES= ["leverage", "status", "role"] as const;
export const PRESETS        = ["designer", "dev", "custom"] as const;
export const FACE_FIELDS    = ["plain_title", "why", "state", "breakdown"] as const;
export const DETAIL_FIELDS  = ["charter_codes", "file_cites", "baml_internals", "raw_acceptance_criteria"] as const;
```

The typed shape (camelCase, `readonly` throughout — the model.ts immutability idiom):

```ts
export interface PresentationSpec {
  readonly preset: Preset;
  readonly vocabulary: Vocabulary;
  readonly density: Density;
  readonly face: readonly FaceField[];          // §2b `face:`  (field-visibility, intent layer)
  readonly details: readonly DetailField[];     // §2b `details:` (field-visibility, dev layer)
  readonly groupBy: Grouping;                   // §2b `group_by`
  readonly metaphor: Metaphor;
  readonly labels: SpecLabels;                  // §2b `labels:` (the labels knob)
  readonly colorLanguage: ColorLanguage;        // §2b `color_language`
}
export interface SpecLabels { readonly status: Readonly<Record<string, string>>; }
```

**Field-visibility = `face` + `details`** (two knobs in §2b's sketch but one conceptual knob).
Keeping them as two named arrays is faithful to §2b and lets the renderer place a token by
which array it came from. **Snake→camel bridge:** the validator reads `group_by` /
`color_language` from input and emits `groupBy` / `colorLanguage` — exactly `coerceTicket`'s
`depends_on → dependsOn`.

## D6 — Presets as exported constants

§2c's designer / dev presets are concrete deliverables and the calibration loop's starting
points. Export them as **typed `PresentationSpec` constants** (`DESIGNER_PRESET`, `DEV_PRESET`)
built from §2b/§2c. They double as the test's "a valid spec is accepted" fixture (round-trips
through `validateSpec` to `ok: true`) and as the ergonomic base for callers. This is
code-as-config in the truest sense — the preset *is* runnable config, type-checked at author
time.

## D7 — Result & error shapes

```ts
export interface SpecViolation { readonly field: string; readonly reason: string; }
export type SpecResult =
  | { readonly ok: true;  readonly spec: PresentationSpec }
  | { readonly ok: false; readonly violations: readonly SpecViolation[] };

export class PresentationSpecError extends Error {   // the GraphIntegrityError discipline
  readonly violations: readonly SpecViolation[];
}
```

`SpecViolation.reason` always names the offending value and the allowed set, e.g.
`density: 'huge' is not one of plain… → low | medium | full`. `isValidSpec(r): r is {ok:true…}`
narrower mirrors `isStop`.

## What I rejected globally

- **A schema library (zod).** Not in the stack; the house hand-rolls coercion (`gates.ts`,
  `model.ts`). Adding a dep for one small spec violates the project's dependency minimalism and
  the "no external YAML/schema" precedent.
- **Validating the `presentation:` wrapper.** That extraction is a loader concern (impure,
  reads a file). This ticket validates the spec object; keeping the wrapper out keeps the core
  pure and single-purpose, mirroring model.ts (pure) ↔ load.ts (impure).
- **Cross-checking `preset` against knob values.** `custom` means hand-tuned; a `designer`
  preset with one knob changed is still valid. `preset` is an origin label, validated only for
  set-membership.
