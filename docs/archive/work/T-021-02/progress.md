# T-021-02 — Progress

_What's done, what remains, deviations from plan._

## Status: implementation complete, all gates green

`bun run check` (baml:gen → tsc --noEmit → bun test) passes: **639 tests, 0 fail** (up 29 from
the 610-test baseline; +1534th expect call). No regressions.

## Steps (per plan.md)

- [x] **Step 1 — type skeleton.** `src/present/spec.ts`: header, eight `as const` knob tuples +
  derived unions, `PresentationSpec` / `SpecLabels` / `SpecViolation` / `SpecResult` interfaces,
  `PresentationSpecError`.
- [x] **Step 2 — presets.** `DESIGNER_PRESET` / `DEV_PRESET` typed `PresentationSpec`, authored
  from §2b/§2c, `Object.freeze`-d (incl. `labels.status`).
- [x] **Step 3 — coercers + `validateSpec`.** `isRecord`, `enumField`, `tokenArray`, `labelMap`;
  total/pure `validateSpec(input): SpecResult` collecting all violations, freezing the result.
- [x] **Step 4 — convenience.** `parseSpec` (throws `PresentationSpecError`), `isValidSpec`.
- [x] **Step 5 — tests.** `src/present/spec.test.ts`: presets validate (AC accept), the AC
  reject case (`density:'huge'`), per-knob out-of-set, collect-all, token arrays
  (unknown/duplicate/non-array/empty-ok), labels (non-object/missing-status/non-string/empty-ok),
  non-object input, `parseSpec` throws+returns, frozen/read-only, `isValidSpec` narrowing.
- [x] **Step 6 — full gate green.**

## Deviation from design.md / plan.md — field casing (D5 / "snake→camel bridge")

**Planned:** `validateSpec` would read §2b's snake_case keys (`group_by`, `color_language`) and
emit camelCase, mirroring model.ts's `depends_on → dependsOn`.

**Actual:** `validateSpec` validates the **canonical camelCase shape** (`groupBy`,
`colorLanguage`) — input keys == output keys.

**Why:** the exported presets (D6) are typed `PresentationSpec` values, i.e. camelCase. The AC
requires "a valid spec is accepted," and the natural valid fixtures are those presets. With the
planned snake-reading validator, `validateSpec(DESIGNER_PRESET)` *failed* (the snake keys were
absent) — a contradiction between D5's bridge and D6's round-trippable presets. Resolving in
favour of round-tripping presets makes `validateSpec` a true *validator* (it doesn't rename
keys) rather than a transformer, and keeps it symmetric with the rest of the surface. The
snake→camel mapping that §2b's YAML notation implies is now explicitly assigned to the **future
YAML loader** — the same out-of-scope impure verb that does the `presentation:` wrapper
extraction (D2 / research §Constraints). Net effect: one fewer responsibility in the pure core,
no loss of fidelity to §2b (the loader will honor it). Module header and tests updated to match;
design intent otherwise unchanged.

## Commits

- `feat(present): typed presentation-spec + validator (T-021-02)` — `src/present/spec.ts`,
  `src/present/spec.test.ts`, and the T-021-02 RDSPI artifacts.

## Remaining

Nothing in scope. Out-of-scope follow-ups (named in plan.md): a YAML config loader (wrapper +
snake→camel), spec→`WorkGraph` projection/renderer, calibration-loop persistence.
