# T-021-02 — Plan: presentation-spec-schema-and-validator

_Ordered, independently-verifiable steps + the testing strategy. Small enough to commit
atomically._

## Testing strategy

One pure-function test file (`src/present/spec.test.ts`), the `model.test.ts` / `gates.test.ts`
mould — no fs, no BAML, so it runs free of bun-test's one-call limit. **Unit** coverage only;
no integration test is warranted (the module touches nothing external). The verification gate
is `bun run check` (`baml:gen && tsc --noEmit && bun test`) green with zero regressions against
the 610-test baseline.

**AC mapping** — "a valid spec is accepted; `density: 'huge'` is rejected with a clear error":
- *accepted* → `validateSpec(DESIGNER_PRESET).ok === true` **and** `validateSpec(DEV_PRESET).ok
  === true` (the real deliverable presets are the valid fixtures).
- *rejected with a clear error* → `validateSpec({...DESIGNER_PRESET, density:"huge"})` returns
  `ok:false` with exactly one violation whose `field === "density"` and whose `reason` names
  `"huge"` and the allowed set `low | medium | full`.

## Steps

### Step 1 — Type skeleton: closed sets, unions, interfaces (no logic yet)

Create `src/present/spec.ts` with the module header, the eight `as const` knob tuples + derived
union types, and the interfaces (`SpecLabels`, `PresentationSpec`, `SpecViolation`,
`SpecResult`, `PresentationSpecError`). No validator body yet.
*Verify:* `tsc --noEmit` passes (types compile, nothing references the unwritten validator).

### Step 2 — Presets

Add `DESIGNER_PRESET` and `DEV_PRESET` typed as `PresentationSpec`, authored from §2b/§2c,
`Object.freeze`-d (and their `labels.status` sub-maps). Designer = `vocabulary:plain,
density:low, metaphor:tree, group_by:story, color_language:leverage, preset:designer`, face =
intent tokens, details = dev tokens. Dev = `vocabulary:technical, density:full, preset:dev`,
with cites/internals promoted to the face per §2c.
*Verify:* `tsc --noEmit` passes — any drift from the `PresentationSpec` type is a compile error
(the code-as-config guarantee).

### Step 3 — Coercion helpers + `validateSpec`

Add `isRecord`, `enumField`, `tokenArray`, `labelMap`, then `validateSpec(input): SpecResult`
that runs them into one `violations[]` accumulator, returns `{ok:false, violations}` on any
violation, else assembles + freezes the camelCase `PresentationSpec` and returns `{ok:true,
spec}`. Each helper's violation `reason` names the bad value and the allowed set.
*Verify:* `tsc --noEmit` passes.

### Step 4 — Convenience surface

Add `parseSpec` (throws `PresentationSpecError` on `ok:false`) and `isValidSpec` narrower.
*Verify:* `tsc --noEmit` passes.

### Step 5 — Test suite

Create `src/present/spec.test.ts` covering the structure.md blueprint: presets validate; the AC
reject case; per-knob out-of-set rejection (table-driven); collect-all (≥2 violations);
tokenArray (unknown/duplicate/non-array); labels (non-object, non-string value, empty-ok);
non-object input; `parseSpec` throws + returns; read-only/frozen; `isValidSpec` narrowing.
*Verify:* `bun test src/present/spec.test.ts` green.

### Step 6 — Full gate + commit

Run `bun run check` (full suite). Confirm green with no regression off the 610 baseline.
Commit: `feat(present): typed presentation-spec + validator (T-021-02)`.
*Verify:* `bun run check` exits 0.

## Risks & mitigations

- **Snake↔camel drift** — input keys are `group_by`/`color_language`; output fields are
  `groupBy`/`colorLanguage`. Mitigation: the mapping happens in exactly one place
  (`validateSpec`'s assembly), and a test feeds snake-keyed input and asserts camel-keyed
  output, mirroring model.ts's `depends_on → dependsOn` coverage.
- **Preset drifting from §2b** — mitigation: presets are typed `PresentationSpec` (compile
  guard) and round-trip through `validateSpec` in the test (runtime guard).
- **Over-strictness rejecting a legitimately bare spec** — empty `labels.status`, empty
  `face`/`details` are valid by D4; tests pin this so a later tightening is a conscious change.
- **Scope creep into a YAML loader** — explicitly out of scope (D2/research); `validateSpec`
  takes a plain object, leaving the `presentation:`-wrapper extraction to a future impure verb.

## Out of scope (named, so the boundary is a decision not an omission)

- Reading/parsing a YAML config file (`presentation:` wrapper extraction) — a future loader.
- Applying the spec to a `WorkGraph` to produce a projection — the renderer ticket.
- The calibration loop / persistence of a saved preset — downstream S-021 tickets.
