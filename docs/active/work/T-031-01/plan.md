# T-031-01 — Plan: home-composite-core

Ordered, independently-verifiable steps. Two atomic commits. Each step ends green
(`tsc --noEmit` + `bun test`). Pure module — no I/O, no live proof needed (that is T-031-02's).

## Step 1 — Export the `pct` rounding seam (`walk-away.ts`)
- Change `function pct(` → `export function pct(` (walk-away.ts:214).
- Extend its doc comment one line: mark it the **shared Home/`vend audit` rounding seam** so the DL-6
  foot and the DL-8 readout can never round percentages differently.
- **Verify:** `bun run check:typecheck` green; `bun test` still green (no behavior change — `subWalk` /
  `formatWalkAwayFindings` call sites unchanged). Walk-away tests must remain byte-identical.

## Step 2 — Create `src/shelf/home.ts` (the two pure functions)
- Module header in the house style: purity contract (no fs/clock/network/process/addon, fresh strings,
  TOTAL), boundaries (composes `renderShelf` + reuses `pct`; changes none of them), DL-6/DL-1/DL-9/E-028
  groundings, "first consumer is T-031-02" note.
- Imports: `{ renderShelf, type ShelfRow }` from `./shelf-row.ts`; `{ pct, type WalkAwayReport, type
  InterventionSubStat }` from `../ledger/walk-away.ts`.
- `export interface HomeRegions { boardMenu: string; shelfRows: readonly ShelfRow[]; ledger: string }`.
- `subPct(s)` private helper: `s.reported === 0 ? "none yet" : pct(s.rate === null ? null : 1 - s.rate)`.
- `homeLedgerLine(report)`:
  - `total === 0` → `"ledger   E1 walk-away — no runs yet"`.
  - `iv.reported === 0` → `` `ledger   E1 walk-away — no self-reports yet (${total} runs)` ``.
  - else → `` `ledger   E1 walk-away ${pct(iv.rate === null ? null : 1 - iv.rate)} (${iv.reported - iv.intervened}/${iv.reported})   └ forward ${subPct(iv.forward)} · attested ${subPct(iv.attested)}` ``.
- `renderHome(regions)` → `` `${regions.boardMenu}\n\n${renderShelf(regions.shelfRows)}\n\n${regions.ledger}` ``.
- **Verify:** `bun run check:typecheck` green (imports resolve, exhaustive).
- **Commit 1:** `feat(home): pure homeLedgerLine + renderHome composite core (T-031-01)` — Steps 1+2
  together (the `pct` export is the prerequisite seam for `home.ts`; they belong in one logical change).

## Step 3 — Create `src/shelf/home.test.ts` (pure unit tests)
Reuse the shelf-row.test.ts fixtures (`recordOf` via `buildRunRecord`; `ShelfRow` literals). Add a
`reportOf = (records, opts?) => auditWalkAway(records, opts)` wrapper.

**Test cases:**

*Group A — `homeLedgerLine` populated split (AC #1):*
- A1: a report with mixed forward/attested self-reports → line contains
  `"E1 walk-away"`, the combined `pct` + `(k/n)`, and `"└ forward "` + `"· attested "` with each
  partition's percent. Assert the combined percent equals `pct(1 − iv.rate)` computed from the report
  (proves the `pct` reuse, no drift).
- A2: an empty partition (e.g. only forward reports, no attested) → that side reads `none yet`, the
  other a real `%` — never a fabricated `0%`.
- A3: percentages match `formatWalkAwayFindings(report)` — extract the same numbers and assert the foot
  uses identical `%` strings (the explicit no-drift / label-mirror AC).

*Group B — `homeLedgerLine` honest-empty (AC #1, no fabricated number):*
- B1: `homeLedgerLine(reportOf([]))` → exactly `"ledger   E1 walk-away — no runs yet"`; assert the line
  contains **no `%`** (proves no fabricated trust number).
- B2: runs present but no `intervened` bit anywhere → `"… no self-reports yet (N runs)"`; assert no `%`.

*Group C — `renderHome` composition (AC #2 / #3):*
- C1: populated fixture (`boardMenu` = a `renderMenu(...)` string, two `ShelfRow`s, `ledger` =
  `homeLedgerLine(...)`) → `out.indexOf(board) < out.indexOf("shelf —") < out.indexOf("ledger")`
  (all three regions, in order).
- C2: empty board → `renderHome({ boardMenu: renderMenu([]), ... })` contains `"(no actions)"` (the
  `renderMenu` guidance line passes through untouched).
- C3: empty ledger → `ledger: homeLedgerLine(reportOf([]))` → output contains `"— no runs yet"` and no
  `%` in the foot (the honest empty foot, no fabricated number).
- C4: no card chrome (DL-9) → `expect(out).not.toMatch(/[|┌┐└┘├┤┬┴┼─│[\]]/u)` — but note the foot uses
  `└` intentionally as a textual split marker (mirrors `formatWalkAwayFindings`), so the DL-9 regex
  must **exclude `└`** (it is a continuation glyph in the trust line, not box chrome). Scope the chrome
  assertion to the board+shelf regions, or use a regex without `└`. Document this in the test.
- C5: empty shelf → `shelfRows: []` → output contains `"(no playbooks)"`.

- **Verify:** `bun run check` (baml:gen + typecheck + test) fully green; new tests counted.
- **Commit 2:** `test(home): pure unit tests for homeLedgerLine + renderHome (T-031-01)`.

## Testing strategy
- **All unit, all pure.** No integration test here — there is no I/O to integrate. The live fused-screen
  proof (board + shelf + ledger over the real run log, press unchanged) is **T-031-02's** AC, not this
  ticket's. Keeping it out honors the dependency edge.
- **No BAML / no addon** — fixtures build Plays/Records directly (the established pattern), so the suite
  stays addon-free and fast.
- **Drift guards are first-class tests** (A3): the foot's percentages are asserted equal to
  `formatWalkAwayFindings`' — the charter's "must not drift" made executable.

## Risk register
| Risk | Likelihood | Mitigation |
|---|---|---|
| DL-9 chrome regex false-positives on the foot's `└` | med | Exclude `└` from the chrome assertion; it is a trust-line continuation glyph, not box chrome (C4). |
| `pct` export accidentally changes audit output | low | Step 1 verify: walk-away tests must stay byte-identical; export adds no behavior. |
| Shelf `1.` reads as press namespace | low | Out of code scope here (format-divergence + board-only cache, T-031-02); documented in design.md. |
| Combined vs split rate confusion | low | A1/A3 pin combined = `1 − iv.rate` and split = `1 − sub.rate`, mirroring `formatWalkAwayFindings`. |

## Definition of done
- `homeLedgerLine` + `renderHome` + `HomeRegions` exported from `src/shelf/home.ts`, pure/total.
- `pct` exported from `walk-away.ts`, audit behavior unchanged.
- All three ACs covered by pure tests; `bun run check:*` green.
- Two clean commits; `progress.md` records any deviation; `review.md` hands off.
