# T-031-01 — Progress: home-composite-core

## Status: complete — all steps done, `bun run check` green (882 tests, +11)

## Steps executed (per plan.md)

### Step 1 — Export `pct` from `walk-away.ts` ✓
- `function pct` → `export function pct` (walk-away.ts:214), doc extended to mark it the shared
  Home/`vend audit` rounding seam.
- Verified: `check:typecheck` green; `walk-away.test.ts` still 17/17 (no behavior change).

### Step 2 — Create `src/shelf/home.ts` ✓
- `HomeRegions` interface, `homeLedgerLine(report)`, `renderHome(regions)`, private `subPct(s)`.
- House-style module header (purity contract + boundaries + DL/E groundings).
- Verified: `check:typecheck` green.
- **Commit 1:** `3dfb95f feat(home): pure homeLedgerLine + renderHome composite core (T-031-01)`
  (Steps 1+2 together, as planned — the `pct` export is the prerequisite seam for `home.ts`).

### Step 3 — Create `src/shelf/home.test.ts` ✓
- 11 pure tests across 3 groups (provenance-split foot, honest-empty, renderHome composition).
- Verified: `bun run check` fully green — 882 pass / 0 fail (was 871; +11 new).
- **Commit:** `7f37f3c fix(home): scope the DL-9 no-chrome assertion to real box-drawing glyphs` —
  contains `home.test.ts`. (See deviation 2.)

## Deviations from plan

1. **Two test expectations corrected to the true rounding (not a plan change, a fixture-math fix).**
   The combined walk-away for 3-of-8 intervened is `1 − 3/8 = 0.625 → 63%` (not 62% as first drafted);
   `Math.round(62.5) = 63`. Test updated to `63% (5/8)`. This confirms the `pct` reuse is exact — the
   draft arithmetic was wrong, the code (and `formatWalkAwayFindings`) was right.

2. **The DL-9 no-chrome regex was narrowed, and the final test commit was made by the on-stop commit
   gate, not by hand.** The first draft of the chrome assertion reused shelf-row.test.ts's regex
   `/[|┌┐└┘├┤┬┴┼─│[\]]/` verbatim — but that set includes `[` `]` and `|`, which wrongly rejects
   `renderMenu`'s legitimate `[High]` tier brackets (renderShelf has no brackets, so the original test
   never hit this). Narrowed to actual box-drawing glyphs only, scoped above the ledger line (so the
   foot's `└` continuation glyph is excluded). The fix was committed by the E-008/D-005 on-stop commit
   gate as `7f37f3c` rather than a hand-run `git commit` — net effect identical: `home.test.ts` is
   committed and green.

## What was NOT changed (boundaries held)
- `renderMenu` / `menu.ts` — untouched.
- `renderShelf` / `shelfRows` / `shelf-row.ts` — untouched (composed via import).
- `recalibrate.ts` — untouched.
- `walk-away.ts` — only `pct` gained `export` + a doc line; audit math and `formatWalkAwayFindings`
  behavior byte-identical (17/17 tests unchanged).
- No I/O, no `cli.ts`, no `.vend/` cache, no press path — all T-031-02.

## Acceptance criteria → evidence
- **AC #1 (`homeLedgerLine`, split + honest-empty, no fabricated number):** Group A (split rendered,
  `none yet` for empty partition) + Group B (`no runs yet` / `no self-reports yet (N runs)`, asserts no
  `%`) + the no-drift test (percentages == `formatWalkAwayFindings`). ✓
- **AC #2 (`renderHome` composes the three regions, no chrome):** Group C region-order test + DL-9
  no-chrome test. ✓
- **AC #3 (unit-tested: populated, empty board passthrough, empty ledger honest foot; `check:*`
  green):** Group C C1/C2/C3 + full suite 882 green. ✓
