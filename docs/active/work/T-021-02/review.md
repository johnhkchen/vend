# T-021-02 — Review: presentation-spec-schema-and-validator

_Handoff document. What changed, test coverage, open concerns — enough to review without
reading every diff._

## What this ticket delivered

The typed **presentation-spec** (code-as-config) and a **validator** for it — the first piece of
E-021's presentation side. The seven knobs of `linear-surface-prep.md` §2a/§2b are now a TS
type with closed-set enums; a pure validator accepts a well-formed spec and rejects a malformed
one (`density:'huge'`) with a clear, value-and-allowed-set-naming error, collecting *all*
violations. The §2c designer/dev presets ship as exported, frozen constants.

## Files

| File | Change | Notes |
|---|---|---|
| `src/present/spec.ts` | **new** (~250 lines) | The pure module: 8 knob tuples + unions, `PresentationSpec`/`SpecLabels`/`SpecViolation`/`SpecResult`, `PresentationSpecError`, `DESIGNER_PRESET`/`DEV_PRESET`, `validateSpec`/`parseSpec`/`isValidSpec`. |
| `src/present/spec.test.ts` | **new** (~210 lines) | Pure-function suite, the model.test.ts/gates.test.ts mould. |
| `docs/active/work/T-021-02/*.md` | **new** | RDSPI artifacts (research, design, structure, plan, progress, this review). |

New `src/present/` directory — names the presentation side of the data/presentation split
(`src/graph/` is the data side). No existing file modified; no new dependency; no fs/BAML/clock
touched. Committed as `1ca2da9`.

## Acceptance criterion — met

> The spec type from §2b parses and validates; a test feeds a valid spec (accepted) and an
> out-of-range knob value, e.g. `density:'huge'` (rejected with a clear error).

- **Accepted:** `validateSpec(DESIGNER_PRESET).ok === true` and `validateSpec(DEV_PRESET).ok ===
  true`; an untyped object also validates into the frozen typed shape.
- **Rejected with a clear error:** `validateSpec({...valid, density:'huge'})` → `ok:false`, one
  violation, `field:"density"`, reason contains `"huge"` and `"low | medium | full"`. Test:
  `spec.test.ts` "validateSpec — the AC reject case".

## Test coverage

639 tests pass (0 fail), +29 over the 610 baseline. The new suite covers every branch:

- **Accept** — both presets; untyped-object → typed/frozen round-trip.
- **Reject (AC)** — `density:'huge'`, exactly-one-violation assertion on field + message.
- **Per-knob out-of-set** — vocabulary, density, groupBy, metaphor, colorLanguage, preset
  (table-driven).
- **Collect-all** — two bad knobs → ≥2 violations (the design D3 contract).
- **Token arrays** — unknown token, duplicate token, non-array, empty-is-valid.
- **Labels** — non-object, missing `status`, non-string value (→ `labels.status` violation),
  empty-status-is-valid.
- **Non-object input** — `null`/number/string/array → one `<spec>` violation.
- **`parseSpec`** — throws `PresentationSpecError` carrying all violations; returns typed spec
  on valid input.
- **Immutability** — mutating a knob, the `labels.status` sub-map, or a frozen preset throws.
- **`isValidSpec`** — narrows both branches.

**Gaps (intentional):** no test feeds §2b's literal snake_case YAML — by design that key-casing
is the future loader's job (see deviation below), so there is nothing in this module to test it
against. No property-based/fuzz testing; the closed-set domains are small and table-covered.

## Deviation from plan (carried from progress.md)

`validateSpec` reads the **canonical camelCase shape** (`groupBy`, `colorLanguage`), not §2b's
snake_case keys as design D5 sketched. Reason: the typed presets are camelCase, the AC's natural
valid fixtures, so a snake-reading validator would reject its own presets — a contradiction. The
fix makes `validateSpec` a true validator (no key renaming) and pushes §2b's snake→camel YAML
mapping to the same out-of-scope loader that extracts the `presentation:` wrapper. Fidelity to
§2b is preserved (the loader will honor it); the pure core is simpler. No reviewer action needed
— flagged for visibility.

## Open concerns / notes for the reviewer

1. **All-knobs-required (design D4).** A spec must fully specify all seven knobs + `preset`;
   there is no partial-spec-with-defaults merge. This is deliberate (the §2c loop copies a full
   preset then edits) but means a future calibration UI must seed from a preset, not from `{}`.
   If partial specs are later wanted, that merge belongs in a loader, not this validator.
2. **`preset` is an origin label only** — not cross-checked against knob values (`custom` =
   hand-tuned, and a `designer` preset with one knob changed is still valid). Confirm this
   matches product intent for E-021.
3. **`face`/`details` empty arrays are valid** (a deliberately bare card). If the product wants
   "a card must show *something*," that's a one-line tightening + test.
4. **No semantic cross-knob rules** (e.g. "color_language:leverage requires leverage data on the
   graph"). The validator is structural only; semantic coherence against a `WorkGraph` is the
   renderer's concern, not in scope here.

## Downstream enablement

This unblocks (out of scope, named in plan.md): a YAML config **loader** (wrapper extraction +
snake→camel), the spec→`WorkGraph` **projection/renderer**, and calibration-loop **persistence**
of a saved preset — the rest of E-021's presentation surface.
