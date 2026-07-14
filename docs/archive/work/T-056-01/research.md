# T-056-01 — Research: flip-designer-default-to-coarse-axis

_Phase: Research. Descriptive map of the codebase as it relates to re-aiming the non-dev
default grouping axis. No solutions proposed here._

## The ask, restated from the ticket

Change exactly one default — `DESIGNER_PRESET.groupBy` — from the fine `story` axis to a
coarse axis already present in `GROUPINGS` (the ticket and AC name `status` ≈5 columns), so the
default `vend svg` renders a board that can be taken in at a glance. `DEV_PRESET.groupBy` (`epic`)
stays unchanged. No new axis is invented; every grouping already exists.

Note a vocabulary mismatch between the parent epic and this ticket: E-056's prose says "flip from
`epic`", but the *designer* preset's current value is `story` (spec.ts:125), and `epic` is the
*dev* preset's value (spec.ts:141). The ticket text is the authority and is internally consistent
with the code: re-aim the **designer** default `story → status`; leave **dev** at `epic`.

## Where the value lives

- `src/present/spec.ts`
  - `GROUPINGS = ["epic", "story", "status", "role", "leverage"] as const` (:53) — the closed set.
    `status` is already a member, so the change is a value swap, not a set extension.
  - `DESIGNER_PRESET` (:114) is a frozen `PresentationSpec`. Its `groupBy: "story"` is at **:125**.
    This is the single line the ticket targets.
  - `DEV_PRESET` (:135) has `groupBy: "epic"` at **:141** — must remain.
  - `PresentationSpec.groupBy: Grouping` (:92) — the typed field; any `GROUPINGS` member is valid,
    so the swap is type-safe with no signature change.

## How the value is consumed

- `src/present/presets.ts`
  - `SEAT_DEFAULTS` (:45) maps `designer → DESIGNER_PRESET`, `dev → DEV_PRESET`.
  - `defaultPresetForSeat(seat)` (:55) returns that mapping — the function the AC names. It returns
    `DESIGNER_PRESET` by reference, so `defaultPresetForSeat("designer").groupBy` IS the changed
    value. No code path in presets.ts hardcodes `"story"`; it only forwards the frozen objects.
- `src/present/svg-file.ts`
  - `writeBoardSvg` (:96) resolves the spec via `opts.spec ?? defaultPresetForSeat(opts.seat ?? "designer")`
    (:98), then `projectGraph(graph, spec)` (:101) → `projectionToSvg` (:103). The default seat is
    `"designer"`, so the default `vend svg` projects under `DESIGNER_PRESET` — the seam the change
    flows through. `groupCount` in `SvgFileResult` (:115) is `projection.groups.length` — the number
    the AC wants to shrink from ~62 to ≤~6.
- `src/present/project.ts`
  - `groupKeyFor` (:107) resolves the partition key per `spec.groupBy`: `status → stateKey(ticket)`
    (:116-117). So under `status`, cards partition by ticket state (open / in-progress / done / …).
  - `groupLabelFor` (:133) for `status` uses `stateChip(sample, spec)` (:146-148) — the labeled
    status chip becomes the group header.
  - `groupOrdinal` (:158) gives `status` a natural order via `STATUS_ORDER` (:159), so status groups
    sort sensibly rather than alphabetically. (`story`/`epic` sort by `localeCompare` on the key.)
  - The number of distinct status groups is bounded by the number of distinct ticket states on the
    board — a small, fixed handful, independent of how many stories exist.

## The grouping cardinality, concretely

- Under `story`: one column per story. The live board has many stories → ~62 columns (the
  17128px-wide strip the epic flags).
- Under `status`: one column per distinct ticket *state*. The canonical states are a small closed
  set (open, in-progress, done, plus any others the board uses) → a handful of columns. This is the
  glanceability the ticket wants, achieved purely by which field `groupKeyFor` reads.

## Tests that touch the value (impact surface)

Grepped `groupBy` across `src/`:

- **Independent fixtures (no change needed)** — these set `groupBy` explicitly or build a
  projection by hand; they do not read `DESIGNER_PRESET.groupBy`:
  - `spec.test.ts:23` `validInput()` uses `groupBy: "story"` as a *generic valid spec* and asserts
    the validator passes it through (`:39`, `:158`). It is not compared to `DESIGNER_PRESET` by
    value; `"story"` remains a valid `GROUPINGS` member, so these stay green. (Its header comment
    calls the fixture "equivalent to DESIGNER_PRESET" — a now-slightly-stale doc nit, not a failure.)
  - `projection-svg.test.ts:62`, `paper.test.ts:163`, `paper.ts:352`, `project.test.ts:49`,
    `one-way-authority.test.ts:50`, `rubric.test.ts:64` — explicit `groupBy` overrides / hand-built
    projections. Unaffected.
- **Reads the preset by reference (no change needed)** — `presets.test.ts:79` uses
  `groupBy: DESIGNER_PRESET.groupBy` in a scrambled clone; it tracks whatever the preset holds.
- **Stale comment (cosmetic)** — `svg-file.test.ts:171` test name says
  "designer (groupBy story)". The assertion is only `dev.svg !== designer.svg`, which still holds
  (`status` vs `epic` differ), but the parenthetical will read wrong after the swap.

## Constraints / invariants in force

- **Determinism (P5):** no clock/random anywhere in this path; same board → byte-identical SVG.
  Changing a default value preserves this.
- **One-way authority (E-021):** the frozen graph is read, never written; `projectGraph` returns
  the graph reference-unchanged. A grouping-axis swap is pure presentation, no authority impact.
- **Closed-set discipline:** `groupBy` must be a `GROUPINGS` member. `status` is one — type-safe.
- **Frozen presets:** `DESIGNER_PRESET` is `Object.freeze`d; the change is to the literal, not a
  mutation.

## Baseline

`bun test src/present/` → 157 pass, 0 fail at research time. Full-suite green is the AC's floor.

## Open questions for Design

1. Confirm `status` over `leverage` (both coarse). The ticket and AC explicitly name `status`.
2. Where does the AC's new assertion live — `presets.test.ts` (closest to `defaultPresetForSeat`)
   or `svg-file.test.ts` (closest to the observable `groupCount`)? The AC permits either.
3. Should the live-board `groupCount ≈ a handful` claim be asserted in a test, or verified
   manually via the written `.vend/work-graph.svg`? The AC offers both as evidence.
