# T-043-01 — Progress

Tracks execution against `plan.md`. All steps complete; no deviations from the plan.

## Recorded decision (AC#4): **ADOPT, not refuse**

When `proposeEpicEffect` sees a proposal whose **title** is already on the board, it **adopts** the
existing epic (returns `ok: true`, `produced`/`artifacts` → the existing card's path, mints nothing)
rather than raising a `duplicate-title` andon. Rationale (full argument in `design.md` D1):
idempotency means a retry yields the same observable outcome — adopt lets the retried chain proceed
on the one card and **clear**, where refuse would strand the epic undecomposed and clear 0. The
propose play is the sole minter of epic cards and the title is the proposal's stable identity, so a
same-title hit is definitionally the same proposal.

## Steps

### ✅ Step 1 — pure `findExistingByTitle` (`src/play/id-guard.ts`)
- Added private `normalizeTitle` (trim + lowercase) and exported `findExistingByTitle(title,
  existing): string | null` beside `detectCollisions`. PURE/TOTAL, no fs/addon, structural `{id,title}`
  param (no BAML import). Blank target → `null`; first-match deterministic.
- Tests: 7 cases in `id-guard.test.ts` (E-041/E-042 fixture, no-match, case/whitespace normalization,
  blank target, empty board, first-match, frozen-input purity). `bun test` → 15 pass.

### ✅ Step 2 — titled board read `listEpicIdTitlesIn` (`src/play/project-context.ts`)
- Added `EpicIdTitle` + `listEpicIdTitlesIn(dir)`: `readdir` → `*.md` filter → basename id +
  `/^\s*title:\s*(\S+)/m` title (or `""`). Missing dir → `[]`, unreadable file skipped. `node:fs`
  only. `listIdsIn` untouched (the materialize guard's dependency).
- Tests: 4 temp-dir cases in `project-context.test.ts` ({id,title} pairs + non-md exclusion,
  no-title → `""`, missing dir → `[]`, empty dir → `[]`). `bun test` → 7 pass.

### ✅ Step 3 — adopt-before-mint (`src/play/propose-effect.ts`)
- Swapped `listIdsIn` → `listEpicIdTitlesIn`; added `findExistingByTitle`. Board read once; adopt
  branch returns the existing path when the title hits; else `live = liveEpics.map(e => e.id)` feeds
  `nextEpicId`/`detectCollisions` — **byte-identical** to the old `live`, so the new-title mint is
  provably unchanged. Updated the module-header ID POLICY block with an IDEMPOTENCY paragraph.
- Verify: `tsc --noEmit` clean; existing 6 `propose-effect.test.ts` cases still green (mint /
  round-trip / disjoint regression intact).

### ✅ Step 4 — AC#3 deterministic double-run proof (`src/play/propose-effect.test.ts`)
- Added 3 end-to-end temp-dir cases (no live model): same card twice → one `E-*.md`, second adopts
  (`produced` equal, `detail` contains `idempotent`/`E-001`); two distinct titles → two epics
  (back-compat); adopt on a populated board (E-040 same title) → mints nothing. `bun test` → 9 pass.

### ✅ Step 5 — full gate
- `bun run check` (baml:gen + tsc + full suite) → **1085 pass, 0 fail** (was 1071; +14 new tests).

## Files touched
- `src/play/id-guard.ts` — +`findExistingByTitle`, +`normalizeTitle`, header note. `detectCollisions`
  unchanged.
- `src/play/project-context.ts` — +`EpicIdTitle`, +`listEpicIdTitlesIn`. `listIdsIn` unchanged.
- `src/play/propose-effect.ts` — adopt branch + import swap + header IDEMPOTENCY note. Mint path
  unchanged for a new title.
- `src/play/id-guard.test.ts`, `src/play/project-context.test.ts`, `src/play/propose-effect.test.ts`
  — new coverage only.

## Deviations
None. Plan followed step-for-step. (`project-context.test.ts` had no temp-dir helper as flagged in
plan.md's risks — added a local `mkdtemp` idiom mirroring `propose-effect.test.ts`, exactly the
fallback the plan anticipated.)

## Commit note
Phases run in one continuous pass per the RDSPI workflow; per the session instruction, Lisa handles
phase/status transitions and the commit. Working tree carries the four src/test edits + the six work
artifacts.
