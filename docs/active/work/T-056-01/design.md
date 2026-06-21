# T-056-01 — Design: flip-designer-default-to-coarse-axis

_Phase: Design. Enumerate approaches, weigh against the research, decide with rationale._

## The decision in one line

Change `DESIGNER_PRESET.groupBy` from `"story"` to `"status"` (spec.ts:125); leave everything else
— including `DEV_PRESET.groupBy: "epic"` — untouched. Add a test pinning both values, and assert the
live-board default render collapses to a handful of groups, not ~62.

## D1 — Which coarse axis: `status` vs `leverage`

Both are coarse members already in `GROUPINGS`. The ticket and AC both name `status` explicitly
("a coarse axis already in GROUPINGS ('status' ≈5)"). Beyond deference to the ticket:

- `status` partitions by ticket state (open / in-progress / done / …) — the canonical
  "where is everything" board view; `groupOrdinal` already gives it a natural `STATUS_ORDER` sort
  (project.ts:159), so columns read open→done left-to-right, not alphabetically.
- `leverage` partitions by priority (~4 columns). Also coarse and ordered (`PRIORITY_ORDER`), but
  it answers "what's important" not "what's the state of the board" — a weaker default glance for
  the non-dev seat the epic describes (Maya wants the one status-bearing picture).

**Chosen: `status`.** Matches the ticket, the AC, and the strongest glance semantics. `leverage`
rejected as a viable-but-not-prescribed alternative; it remains available as a selectable axis.

## D2 — Scope of the change: default-only vs broader

Three options:

1. **Flip only `DESIGNER_PRESET.groupBy` (chosen).** One-line value change to the frozen literal.
   `defaultPresetForSeat("designer")` forwards the preset by reference (presets.ts:55), so the new
   value propagates to `vend svg` with zero plumbing. `DEV_PRESET` keeps `epic`. Every axis stays
   available for explicit selection. Minimal blast radius; matches the epic's "flip only the
   NON-DEV default" and "every grouping stays available."
2. **Introduce a separate "default grouping" knob distinct from the preset's `groupBy`.** Rejected:
   invents config surface the ticket explicitly scopes out ("only the DEFAULT changes"), and the
   preset *is* the default mechanism. Over-engineering.
3. **Make the axis seat-derived/computed at call time.** Rejected: adds a code path and breaks the
   "presets are static typed constants" house pattern (spec.ts header). The preset is the right home
   for a static default.

**Chosen: option 1.** It is the literal ask, the smallest correct change, and preserves all
invariants.

## D3 — Where the new test lives, and what it asserts

The AC requires a test that (a) `defaultPresetForSeat('designer').groupBy` is the coarse axis,
(b) `DEV_PRESET.groupBy` is unchanged, and (c) `vend svg` over the live board returns
`groupCount` ≈ a handful (≤~6), not ~62, observable in the written `.vend/work-graph.svg`.

- **(a) + (b)** belong in `presets.test.ts` — it already imports `defaultPresetForSeat`,
  `DESIGNER_PRESET`, `DEV_PRESET`, and has the "seat / preset table (pure)" describe block. A pure,
  fast assertion of both `groupBy` values slots in there naturally.
- **(c)** belongs in `svg-file.test.ts` — it already exercises `writeBoardSvg` and the live-board
  path (the "writes the staged artifact, never docs/active" block runs the real load). A new test
  runs the default (no seat / `seat: "designer"`) over the live board into a temp dir and asserts
  `result.groupCount` is small (≤ 6) and materially smaller than the story-axis count. To make the
  "not ~62" half concrete and non-vacuous, the same test projects the *same live graph* under
  `story` and asserts the status `groupCount` is far below it (a strict `<`, and an absolute `≤ 6`).

Rationale for splitting across two files: each assertion sits next to the code it pins, matching the
existing test organization, and avoids a cross-cutting test that imports both layers for no reason.

## D4 — Handling the stale comment in svg-file.test.ts:171

The existing test `"the seat selects the spec: dev (groupBy epic) differs from designer (groupBy
story)"` still passes after the swap (its only assertion is `dev.svg !== designer.svg`; `status` vs
`epic` still differ). But the name now misdescribes the designer axis. **Update the test name** to
`"... designer (groupBy status)"` — a cosmetic edit keeping the suite honest. No assertion change.

The `spec.test.ts` `validInput()` fixture stays `"story"`: it tests the *validator's* pass-through of
a valid axis, not the preset's chosen default. `"story"` is still a valid `GROUPINGS` member, so the
fixture remains a legitimate "generic valid spec." Leaving it untouched keeps the validator test
focused on validation, not on preset policy. (Its "equivalent to DESIGNER_PRESET" header comment is a
minor doc nit; out of scope to chase — the fixture was never an equality oracle for the preset.)

## D5 — Verifying the live-board glanceability claim

The AC wants the shrink "observable in the written `.vend/work-graph.svg`." Two layers:

- **Automated (chosen as the gate):** the `svg-file.test.ts` live-board test asserts the numeric
  collapse deterministically, so CI proves it without a human opening a file.
- **Manual confirmation (recorded in Review):** run `bun run` of the seam against the live board to
  regenerate `.vend/work-graph.svg`, and record the actual `groupCount` (status) vs the prior
  `story` count in `review.md` as go-and-see evidence.

## What is explicitly NOT in this ticket

- No edge-as-payload work (`ProjectionLink` weight) — that is a sibling ticket under E-056.
- No new grouping axes, no palette/stroke changes, no `DEV_PRESET` change.
- No change to `projectGraph`/`projectionToSvg` logic — `status` grouping already works end-to-end;
  this only changes which axis the default selects.

## Risks & mitigations

- **R1: a hidden test asserts `DESIGNER_PRESET.groupBy === "story"` by value.** Research grep found
  none that read the preset's value (only independent fixtures + by-reference reads). Mitigation:
  run the full suite after the change. Low risk.
- **R2: the live board happens to have >6 distinct states.** Canonical states are a small closed
  set; even with an extra state or two it stays well under 62. Mitigation: assert `≤ 6` AND
  `< story-count`; if the absolute bound is ever too tight, the relative bound still proves the
  glanceability intent. Low risk.
