# T-056-01 — Plan: flip-designer-default-to-coarse-axis

_Phase: Plan. Ordered, independently verifiable steps + testing strategy + verification criteria._

## Testing strategy

- **Unit (pure):** `presets.test.ts` pins `defaultPresetForSeat("designer").groupBy === "status"`
  and `DEV_PRESET.groupBy === "epic"`. Fast, deterministic, no fs — covers AC clauses (a)+(b).
- **Integration (live-board, hermetic write):** `svg-file.test.ts` runs the default seam over the
  real board into a temp dir and asserts the `groupCount` collapse (`≤ 6` AND `< story-axis count`,
  with a guard that the story count is itself `> 6` so the comparison is non-vacuous) — AC clause
  (c), the observable shrink. Read-only on the board, writes only a temp dir (authority-safe).
- **Regression:** full `bun test` must stay green (the AC's floor). `bun run build` must typecheck.
- **Go-and-see:** regenerate `.vend/work-graph.svg` from the live board and record the actual
  status `groupCount` vs the prior `story` count in `review.md`.

## Steps

### Step 1 — Flip the default axis (the behavioral change)
- Edit `src/present/spec.ts:125`: `groupBy: "story"` → `groupBy: "status"` inside `DESIGNER_PRESET`.
- Leave `DEV_PRESET.groupBy: "epic"` (:141) untouched.
- **Verify:** `bun run build` typechecks (the value is a valid `Grouping`). The existing suite may
  show the new test absent but no failures from the value swap alone (no test asserts the preset's
  value by equality — confirmed in Research).
- Atomic: yes.

### Step 2 — Pin the values (AC clauses a + b)
- In `src/present/presets.test.ts`, add to the `"seat / preset table (pure)"` describe a test
  asserting `defaultPresetForSeat("designer").groupBy === "status"`, `DESIGNER_PRESET.groupBy ===
  "status"`, and `DEV_PRESET.groupBy === "epic"`.
- No new imports (all three symbols already imported).
- **Verify:** `bun test src/present/presets.test.ts` green.
- Atomic: yes.

### Step 3 — Pin the observable collapse + fix the stale name (AC clause c)
- In `src/present/svg-file.test.ts`:
  - Add `import { loadWorkGraph } from "../graph/load.ts";` at the top.
  - Add the live-board test: default seam → `groupCount ≤ 6`; same live board under
    `{ ...DESIGNER_PRESET, groupBy: "story" }` yields more groups; assert `status < story` and
    `story > 6`; assert the artifact file exists.
  - Rename the line-171 test name `"... designer (groupBy story)"` → `"... designer (groupBy
    status)"` (assertion unchanged).
- **Verify:** `bun test src/present/svg-file.test.ts` green; the new test prints (via assertion) a
  small status count.
- Atomic: yes.

### Step 4 — Full-suite + typecheck gate
- `bun test` (whole repo) → expect all green.
- `bun run build` → typecheck + bundle clean.
- **Verify:** zero failures; no authority-guard regressions (the svg-file authority test still
  passes — no source authority change was made).
- Atomic: this is the gate, not a code step.

### Step 5 — Go-and-see + commit
- Regenerate the live `.vend/work-graph.svg` via the seam (default seat) and read back the actual
  status `groupCount`; capture the number and the prior `story` count for `review.md`.
- Commit all changes (source + tests) as one atomic commit referencing T-056-01.

## Commit plan

One commit — the source edit and its tests are a single coherent unit and small. Message:
`feat(present): flip designer default groupBy story→status for a glanceable board (T-056-01)`.

## Verification criteria (maps to AC)

- [ ] `defaultPresetForSeat("designer").groupBy === "status"` (test, Step 2).
- [ ] `DEV_PRESET.groupBy === "epic"` unchanged (test, Step 2).
- [ ] Live-board default `vend svg` `groupCount` is a handful (≤ 6) and `< story-axis count`
      (test, Step 3); observable in the written `.vend/work-graph.svg` (go-and-see, Step 5).
- [ ] Full suite green; build typechecks (Step 4).

## Rollback

The change is one literal value plus additive tests. Reverting `spec.ts:125` to `"story"` and
dropping the new tests fully restores prior behavior. No data migration, no persisted-state impact
(saved seat specs, if any, are unaffected — they carry their own `groupBy`).

## Risk register (carried from Design)

- **R1 hidden value assertion** → mitigated by Step 4 full suite. Low.
- **R2 board has >6 states** → relative bound (`status < story`) still proves intent even if the
  absolute `≤ 6` ever needed loosening; canonical states are few. Low.
- **R3 live-board test flakiness** (depends on real board content) → the assertions are bounds, not
  exact counts, and the board is a committed fixture in `docs/active`, so it is stable. Low.
