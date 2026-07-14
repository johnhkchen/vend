# T-056-01 — Progress: flip-designer-default-to-coarse-axis

_Phase: Implement. What was done, deviations, and verification evidence._

## Completed

- **Step 1 — flip the default axis.** `src/present/spec.ts:125`:
  `DESIGNER_PRESET.groupBy: "story" → "status"`. `DEV_PRESET.groupBy: "epic"` left unchanged.
- **Step 2 — pin the values.** Added to `src/present/presets.test.ts`
  (`"seat / preset table (pure)"` block) a test asserting
  `defaultPresetForSeat("designer").groupBy === "status"`, `DESIGNER_PRESET.groupBy === "status"`,
  and `DEV_PRESET.groupBy === "epic"`. No new imports needed.
- **Step 3 — pin the observable collapse + fix the stale name.** In `src/present/svg-file.test.ts`:
  - Added `import { loadWorkGraph } from "../graph/load.ts";`.
  - Added a live-board test: default seam → `groupCount ≤ 6`, and the same live board under
    `{ ...DESIGNER_PRESET, groupBy: "story" }` yields `> 6` groups with
    `status groupCount < story groupCount`; artifact file exists.
  - Renamed the line-171 test `"... designer (groupBy story)"` → `"... designer (groupBy status)"`
    (assertion unchanged; it still passes since `status` vs `epic` differ).

## Verification

- **Ticket's own files green:** `bun test spec.test.ts presets.test.ts svg-file.test.ts`
  → **54 pass, 0 fail**. The two new tests pass.
- **Typecheck:** `bun run build` (`tsc --noEmit`) → clean.
- **Go-and-see (live board):** regenerated `.vend/work-graph.svg` via the default seam:
  - `DESIGNER_PRESET.groupBy` = `status`.
  - **status groupCount = 2** (labels: `To do | Done`) — a glanceable handful.
  - **story groupCount = 64** — the old fine-axis strip the epic flagged (~62).
  - written artifact: `.vend/work-graph.svg`, `groupCount: 2`, `cardCount: 136`.
  - The collapse 64 → 2 is the AC's "≈ a handful (≤~6), not ~62," observed directly.

## Deviation — concurrent thread, NOT this ticket

Running the **full** suite (`bun test`) shows **1 failing test**:
`project.test.ts:117 — "the one cross-story depends_on edge appears once, (from→to)-correct"`,
which now receives a link carrying `blocked: true` where the test still expects no `blocked` field.

This failure is **not caused by T-056-01**:
- The `blocked` field is emitted by `src/present/project.ts` `buildLinks`, which a **concurrent
  lisa thread (T-056-02, the edges-as-payload sibling under E-056)** has modified mid-flight
  (`git diff --stat` shows `project.ts` +11/-3 and `project.test.ts` +49 — neither touched by this
  ticket). T-056-02 added the `blocked` flag but has not yet updated its own existing line-117 test.
- T-056-01 touches only `spec.ts`, `presets.test.ts`, and `svg-file.test.ts` — disjoint from the
  failing files. CLAUDE.md §Concurrency: threads share the branch; the failure is T-056-02's
  transient in-progress state and will resolve when that thread finishes.

No action taken on `project.ts`/`project.test.ts` — they are another ticket's territory; editing
them here would collide with that thread's work.

## Remaining

- Nothing for T-056-01's implementation. Review artifact next.
- (Out of scope, noted for the human/Lisa: the full-suite green floor is currently held down by
  T-056-02's unfinished test, not by this change.)
