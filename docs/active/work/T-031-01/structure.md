# T-031-01 — Structure: home-composite-core

The blueprint: file-level changes, public interfaces, internal organization, and the ordering of
changes. Two new files, one one-keyword edit to an existing file. No deletions.

## Files

### CREATE `src/shelf/home.ts` — the pure DL-6 Home composite
The whole deliverable. Module header in the house style (purity contract + boundaries), then:

**Imports (all type-only except `renderShelf` and `pct`):**
```ts
import { renderShelf, type ShelfRow } from "./shelf-row.ts";
import { pct, type WalkAwayReport, type InterventionSubStat } from "../ledger/walk-away.ts";
```

**Public interface — `HomeRegions`:**
```ts
export interface HomeRegions {
  /** Board region: the already-rendered `renderMenu` string (leads, column 0, unchanged). */
  readonly boardMenu: string;
  /** Shelf region: structured rows (T-030-01); `renderHome` renders them receding beneath. */
  readonly shelfRows: readonly ShelfRow[];
  /** Ledger region: the already-rendered `homeLedgerLine` string (the foot). */
  readonly ledger: string;
}
```

**Public function — `homeLedgerLine(report: WalkAwayReport): string`:**
- Reads `report.total` and `report.intervention` (`iv`).
- `report.total === 0` → `"ledger   E1 walk-away — no runs yet"`.
- `iv.reported === 0` (but total > 0) → `"ledger   E1 walk-away — no self-reports yet (${total} runs)"`.
- else → `"ledger   E1 walk-away ${pct(1−iv.rate)} (${iv.reported−iv.intervened}/${iv.reported})" +
  "   └ forward ${subPct(iv.forward)} · attested ${subPct(iv.attested)}"`.

**Public function — `renderHome(regions: HomeRegions): string`:**
- `return `${regions.boardMenu}\n\n${renderShelf(regions.shelfRows)}\n\n${regions.ledger}`;`
- Pure concatenation; the three regions blank-line divided, board → shelf → ledger.

**Private helper — `subPct(s: InterventionSubStat): string`:**
```ts
// "none yet" when the partition is empty (mirrors walk-away.ts subWalk's honest label — never a
// fabricated 0%); else the walk-away percent (1 − rate) via the shared `pct` formatter.
function subPct(s: InterventionSubStat): string {
  return s.reported === 0 ? "none yet" : pct(s.rate === null ? null : 1 - s.rate);
}
```

Internal organization mirrors the sibling modules: doc-commented exports, the one private helper last,
each function carrying a `PURE/TOTAL` note and a one-line rationale tying it to its DL/IA/E reference.

### MODIFY `src/ledger/walk-away.ts` — export the `pct` rounding seam
One change: `function pct(...)` → `export function pct(...)` (walk-away.ts:214). Add one line of doc to
the existing comment marking it the shared Home/audit rounding seam (so the foot and `vend audit` can
never round differently). **No behavior change**; all existing call sites (`subWalk`,
`formatWalkAwayFindings`) keep working unchanged. No other edits to this file.

### CREATE `src/shelf/home.test.ts` — pure unit tests
Pure, addon-free (the shelf-row.test.ts / menu.test.ts discipline). Fixtures:
- `reportOf(records, opts?)` — thin wrapper over `auditWalkAway` (pure) to get a real `WalkAwayReport`.
- `recordOf(...)` — copy the shelf-row.test.ts helper: builds a `RunRecord` via the exported pure
  `buildRunRecord`, with overridable `intervened` / `intervenedAttested` bits to exercise the split.
- `ShelfRow` literals built inline (measured + default) for the `renderHome` region-order tests.

Test groups (→ ACs):
1. `homeLedgerLine — populated split` (AC #1): forward·attested rendered; combined `pct`/`(k/n)`;
   matches `formatWalkAwayFindings` percentages (no drift); `none yet` for an empty partition.
2. `homeLedgerLine — honest-empty, no fabricated number` (AC #1): `auditWalkAway([])` → "no runs yet"
   and the line contains **no `%`**; `total>0, reported===0` → "no self-reports yet (N runs)".
3. `renderHome — three regions in order` (AC #2/#3): populated fixture → board, then shelf, then ledger
   (index ordering); empty board passes the `renderMenu` guidance through; empty ledger → honest foot;
   no box-drawing characters (DL-9 regex, reused from shelf-row.test.ts).

## Public surface delta (what other code can now import)

| Symbol | Module | Kind | Consumer |
|---|---|---|---|
| `HomeRegions` | `src/shelf/home.ts` | interface (new) | T-031-02 (`vend` browse arm) |
| `homeLedgerLine` | `src/shelf/home.ts` | function (new) | T-031-02 |
| `renderHome` | `src/shelf/home.ts` | function (new) | T-031-02 |
| `pct` | `src/ledger/walk-away.ts` | function (newly exported) | `src/shelf/home.ts` |

Nothing imports `home.ts` back yet — T-031-02 (wire bare `vend`) is the first consumer. Leaf module.

## Boundaries preserved (what is NOT touched)
- `renderMenu` / `menu.ts` — unchanged (board model stays leaf; no ledger dependency).
- `renderShelf` / `shelfRows` / `shelf-row.ts` — unchanged (composed via import, not edited).
- `recalibrate.ts` — untouched.
- `walk-away.ts` audit math + `formatWalkAwayFindings` — unchanged behavior (only `pct` gains `export`).
- No I/O, no `cli.ts`, no `.vend/` cache, no press path — all of that is T-031-02.

## Ordering of changes (so each step type-checks on its own)
1. **Export `pct`** in `walk-away.ts` (prerequisite import for `home.ts`). `tsc` stays green.
2. **Create `home.ts`** (the two functions + helper + interface). `tsc` green (imports now resolve).
3. **Create `home.test.ts`** and run `bun run check:*` — all green.

Two commits (see plan.md): (1) export `pct` + `home.ts` core; (2) `home.test.ts`. Or one feature commit
if the seam-export is trivial enough to ride with the core — decided in the plan.
