# T-020-01 — Plan: ordered, verifiable steps

> Small steps, each independently checkable; commit at meaningful units. Testing strategy + the AC#1
> verification criteria. Grounded in `structure.md`.

## Testing strategy

- **No new unit tests** (house rule): the probe harness is a sweep instrument, proven live; its
  judgment is the already-tested pure core (`consistency.ts` + `consistency.test.ts`, unchanged here).
- **`bun run check`** (`baml:gen` → `tsc --noEmit` → `bun test`) is the deterministic regression gate —
  it must stay green after the harness edit (the new target must typecheck; existing tests unaffected).
- **The verifying probe run** is the behavioral check for AC#1: a live sweep of `survey-thin` and
  `expand-thin` recording **honest-empty**, distinct from the grounded arms. Small N (directional).

## Steps

### Step 1 — Author the thin expand fragment

Create `docs/active/work/T-020-01/fixtures/thin-fragment.txt`: one short, grammatical-but-empty
imperative that grounds no demand and cites nothing (design D3). Verify: file exists, single line,
non-empty after trim.
*Commit unit:* with Step 2 (fixtures together).

### Step 2 — Author the thin survey board (saturated tiny project)

Create the `fixtures/thin-board/` tree (design D4):
- `docs/knowledge/charter.md` — thin charter: one purpose, scope **complete & frozen**, no open
  problems, no `P#`/`N#` ids that read as unmet demand.
- `docs/active/stories/S-900-01.md` — one `status: done` story.
- `docs/active/tickets/T-900-01.md` — one `status: done` ticket under it.

Verify: tree matches the paths the harness constants point at; charter reads as a complete/frozen
product. *Commit unit:* Steps 1+2 — "fixtures: thin negative-control inputs (survey board + expand
fragment)".

### Step 3 — Extend the harness

Edit `src/probe/run-consistency-probe.ts` (structure §MODIFIED), in order:
1. Add `THIN_BOARD_DIR` + `THIN_FRAGMENT_PATH` constants.
2. Parameterize `seedCharter` / `seedBoardSnapshot` with `srcRoot = process.cwd()`; refactor
   `surveyTarget`'s inline board copy to call `seedBoardSnapshot(root)`.
3. Add `surveyThinTarget()` (mirrors `surveyTarget`, seeds from `THIN_BOARD_DIR`).
4. Add `resolveTarget` cases `survey-thin` and `expand-thin` (the latter reuses `expandTarget` with the
   thin fragment read from `THIN_FRAGMENT_PATH`).
5. Append both names to `SUPPORTED`.

Verify: the diff is additive; `survey`/`expand`/`steer`/`decompose-epic` behavior unchanged;
`run-probe.ts` untouched. *Commit unit:* "feat(probe): survey-thin + expand-thin negative-control
targets (T-020-01)".

### Step 4 — `bun run check` green

Run `bun run check`. Must pass: baml:gen clean, `tsc --noEmit` clean (new target typechecks), all
tests green (no regressions — the harness is not imported by any test). Fix any typecheck fallout
before proceeding. *This satisfies the second half of AC#1.*

### Step 5 — Verifying probe run (the behavioral half of AC#1)

Run the negative-control sweep (small N), grounded arms for the distinctness comparison:
```bash
# negative control — must record honest-empty:
bun run src/probe/run-consistency-probe.ts survey-thin 2
bun run src/probe/run-consistency-probe.ts expand-thin 2
# grounded baseline (distinctness) — recorded for comparison, reuses T-019-02's grounded fixture:
bun run src/probe/run-consistency-probe.ts survey 2
bun run src/probe/run-consistency-probe.ts expand docs/active/work/T-019-02/fixtures/grounded-fragment.txt 2
```
**Pass criteria (AC#1):**
- `survey-thin` records **`honest-empty`** in the headline mix (≥1 cast staging the
  `"no demand staged"` marker), and **distinct** from `survey` on the grounded board.
- `expand-thin` records **`honest-empty`** read off the **raw `gate-failed` tally + the per-cast
  andon** (design D5), and **distinct** from grounded `expand` (which lands `signal`).

Capture the fenced reports + raw tallies into `progress.md` (and summarized in `review.md`), the
T-019-02 evidence pattern.

**Contingency:** if live casts are unavailable/too slow in the run environment, record the exact
reproduction commands + the expected polarity (honest-empty for both, distinct from grounded), and
note `bun run check` as the satisfied hard gate — honestly flagged (IA-8), not silently skipped. The
fixtures + targets (the deliverable) ship either way.

### Step 6 — Review

Write `review.md`: files changed, test coverage, the probe-run evidence (or the honest contingency),
open concerns. Stop — Lisa handles transitions.

## Risk table

| Risk | Likelihood | Mitigation |
|---|---|---|
| Thin survey board still stages a signal (cold-start eagerness) | Medium | Fixture is frozen/complete/saturated, not blank (D4). If it signals, record it as a finding (IA-8) — do not force the fixture; the negative control is *designed* to catch this. |
| `lisa init` clobbers the seeded thin charter | Low | Seed runs after init (existing `surveyTarget` proves the order works); verify the charter landed during the run. |
| Thin-board ids collide with live board | Very low | `9xx` id block; temp root is disposable anyway. |
| Live casts unavailable in run env | Medium | Step 5 contingency: record reproduction + expected polarity; `bun run check` is the hard gate. |
| Harness edit regresses an existing target | Low | Additive edits; `seedBoardSnapshot` refactor is behavior-preserving (same copy loop); `bun run check`. |

## What "done" looks like

- Two thin fixtures committed; harness exposes `survey-thin` + `expand-thin`.
- `bun run check` green.
- A probe run (or its honestly-flagged contingency) shows honest-empty for both, distinct from
  grounded — the negative control is now **measurable** and re-runnable after E-020 recalibration.
