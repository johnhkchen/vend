# T-056-01 — Review: flip-designer-default-to-coarse-axis

_Phase: Review. Handoff for a human reviewer — what changed, coverage, and open concerns._

## Summary

Re-aimed the single non-dev default: `DESIGNER_PRESET.groupBy` `story → status`. The default
`vend svg` (designer seat) now groups the live board by ticket state instead of by story, collapsing
a 64-column strip into 2 glanceable status columns. `DEV_PRESET.groupBy` (`epic`) is unchanged, and
every grouping axis remains available for explicit selection. No new axis, no logic change in
`projectGraph`/`projectionToSvg` — `status` grouping already worked end-to-end; only the default
selection moved. Committed as `3637141`.

## Files changed

| File | Change |
|------|--------|
| `src/present/spec.ts` | `DESIGNER_PRESET.groupBy: "story" → "status"` (one line). |
| `src/present/presets.test.ts` | +1 pure test: designer default = `status`, `DESIGNER_PRESET.groupBy = status`, `DEV_PRESET.groupBy = epic`. |
| `src/present/svg-file.test.ts` | +1 live-board test (groupCount collapse ≤6 and `< story count`); added `loadWorkGraph` import; renamed a stale test name `(groupBy story)` → `(groupBy status)`. |
| `docs/active/work/T-056-01/*.md` | The six RDSPI artifacts (this set). |

No files created/deleted in `src/`. No type-surface change (`status` was already a `Grouping`).

## Acceptance criteria — status

> A test asserts `defaultPresetForSeat('designer').groupBy` is the coarse axis and `DEV_PRESET.groupBy`
> is unchanged; `vend svg` over the live board returns groupCount ≈ a handful (≤~6), not ~62,
> observable in the written `.vend/work-graph.svg`. Full suite green.

- ✅ `defaultPresetForSeat('designer').groupBy === "status"` — `presets.test.ts`.
- ✅ `DEV_PRESET.groupBy === "epic"` unchanged — `presets.test.ts`.
- ✅ Live-board default `groupCount ≤ 6` AND `< story-axis count` (with a guard that the story count
  is `> 6`, so the comparison is non-vacuous) — `svg-file.test.ts`.
- ✅ Observable in `.vend/work-graph.svg` — regenerated via the seam; `groupCount: 2`
  (`To do | Done`), `cardCount: 136`. Story axis on the same board = 64 groups. The 64→2 collapse is
  the AC's "≈ a handful, not ~62," seen directly.
- ⚠️ **Full suite green:** held down by a *concurrent* thread, not by this change — see below.

## Test coverage

- **Added:** 2 tests (1 pure value-pin, 1 live-board integration). Both pass.
- **This ticket's files:** `bun test spec.test.ts presets.test.ts svg-file.test.ts` → **54 pass,
  0 fail**.
- **Typecheck:** `bun run build` (`tsc --noEmit`) → clean.
- **Gap:** the live-board test asserts bounds (`≤ 6`, `< story`), not an exact count, so it stays
  robust as the board evolves. It depends on the committed board having `> 6` stories — true today
  (64) and structurally durable. No unit test for `status` grouping cardinality in isolation was
  added because `project.ts` already covers `groupKeyFor`/`groupOrdinal` for `status`.

## Open concerns / flags for human attention

1. **Full-suite red is NOT from this ticket (important).** `bun test` (whole repo) shows **1
   failure**: `project.test.ts:117` receives a link with `blocked: true` where it expects none. That
   field is added by `src/present/project.ts`, which a **concurrent lisa thread (T-056-02,
   edges-as-payload under E-056)** is editing right now (`git diff --stat`: `project.ts` +11/-3,
   `project.test.ts` +49 — both untouched by T-056-01). T-056-02 added the `blocked` flag but hasn't
   finished updating its own line-117 test. T-056-01's files are disjoint from the failure; the
   floor will return to green when T-056-02 lands. **No fix attempted here** — editing another
   thread's files would collide with its work (CLAUDE.md §Concurrency).
2. **Only 2 status groups today** (`To do | Done`) because the live board's tickets are all in
   open/done states. That is still glanceable and within `≤ 6`; as in-progress/blocked tickets
   appear, more columns show, ordered by `STATUS_ORDER`. No action needed.
3. **`.vend/work-graph.svg`** was regenerated for go-and-see. It lives under `.vend` (project-state,
   not tracked), so it is not part of the commit — consistent with the seam's design.
4. **`spec.test.ts` `validInput()` fixture** keeps `groupBy: "story"` deliberately — it tests the
   validator's pass-through of a valid axis, not preset policy. Its header comment ("equivalent to
   DESIGNER_PRESET") is now a minor doc nit; left as-is to keep the validator test focused.

## Invariants preserved

- **Determinism (P5):** no clock/random in the path; same board → byte-identical SVG.
- **One-way authority (E-021):** the change is a presentation default; the frozen graph is read,
  never written. The svg-file authority-guard test still passes (no source authority change).
- **Closed-set discipline:** `status ∈ GROUPINGS`; type-safe, no signature change.

## Recommendation

T-056-01 is complete and correct in isolation; its two ACs that are within its scope are met and
green. The repo-wide suite has one unrelated failure owned by the in-flight T-056-02 — a coordination
artifact of shared-branch concurrency, expected to clear when that sibling ticket finishes. No
follow-up is required for T-056-01.
