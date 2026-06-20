# T-031-01 — Design: home-composite-core

Two pure functions close the DL-6 `renderHome` gap: `homeLedgerLine(report)` (the trust foot) and
`renderHome({ boardMenu, shelfRows, ledger })` (the three-region composer). The design choices are
mostly about **where reuse happens** so nothing drifts from `vend audit` / `vend shelf`.

## Decision 1 — Module location: a new `src/shelf/home.ts`

**Options:**
- (A) New `src/shelf/home.ts` (+ `home.test.ts`).
- (B) Add the two functions to `shelf-row.ts`.
- (C) Put them in `menu.ts`.

**Chosen: (A).** `home.ts` is the natural home for a composite that imports from all three regions
(`menu.ts`, `shelf-row.ts`, `walk-away.ts`). Adding to `shelf-row.ts` (B) would make it import
`walk-away.ts`, breaking its tidy "shelf supply core" scope and adding a cross-package edge it does not
have today. `menu.ts` (C) is the board model and is deliberately leaf — it must not depend on the
ledger. A dedicated `home.ts` keeps each existing module's boundaries intact and gives the composite a
single obvious place. Sits in `src/shelf/` because Home is a shelf-surface composition (DL-6); it is
the SUPPLY-side screen the shelf package owns.

## Decision 2 — `homeLedgerLine`: reuse `pct`, mirror the split labels

**The format (populated):**
```
ledger   E1 walk-away 87% (13/15)   └ forward 50% · attested 92%
```
- `87%` = combined walk-away = `pct(1 − iv.rate)`; `(13/15)` = `(reported − intervened)/reported`.
- `forward 50%` = `pct(1 − forward.rate)`; `attested 92%` = `pct(1 − attested.rate)`.

**The label-mirror seam.** `formatWalkAwayFindings` derives these same numbers with a private
`pct(r)` (walk-away.ts:214) and renders walk-away as `1 − intervention rate`. To guarantee Home and
`vend audit` round **identically** (the charter's no-drift rule), the cleanest move is to **export
`pct` from walk-away.ts** and reuse it — a purely additive change (add the `export` keyword), it alters
no behavior and touches none of the forbidden modules (`renderMenu` / `renderShelf` / recalibration).

- *Rejected:* re-implement the `Math.round(r*100)` rounding in `home.ts`. Works, but duplicates the
  rounding rule the charter explicitly forbids drifting — a future change to one would silently diverge.
- *Rejected:* export the whole `subWalk` helper and reuse it verbatim. `subWalk` emits the FULL
  fragment `87% (13/15 untouched)` — too verbose for the compact one-line glance, which shows the
  percent only for forward/attested. We want the *number* shared, not the verbose phrasing.

**Honest-empty (two branches, no fabricated number):**
- `report.total === 0` → `ledger   E1 walk-away — no runs yet` (the AC's empty-ledger line).
- `report.total > 0` but `intervention.reported === 0` → `ledger   E1 walk-away — no self-reports yet
  (N runs)` — mirrors `formatWalkAwayFindings`' "no self-reports yet" label; honest, no rate invented.
- For per-partition emptiness inside a populated line, `forward`/`attested` read `none yet` (mirroring
  `subWalk`'s empty label) rather than a fabricated `0%`.

This keeps the read-never-invent discipline (E-026 / IA-8): the E1 bit is never synthesized.

## Decision 3 — `renderHome`: compose strings, render the shelf via `renderShelf`

**Signature** (exactly as the ticket dictates):
```ts
export interface HomeRegions {
  readonly boardMenu: string;          // already-rendered renderMenu output (board leads)
  readonly shelfRows: readonly ShelfRow[];  // structured — renderHome renders them receding
  readonly ledger: string;             // already-rendered homeLedgerLine output (the foot)
}
export function renderHome(regions: HomeRegions): string
```

**Layout:** three regions divided by a blank line, board → shelf → ledger, no boxes/rules (DL-1/DL-9):
```ts
return `${boardMenu}\n\n${renderShelf(shelfRows)}\n\n${ledger}`;
```

**Why `renderShelf` for the shelf region (not a re-implementation).** The ticket says *compose them; do
not change `renderShelf`* and *reuse `renderShelf`'s clean-typographic key*. Calling `renderShelf`
directly is the literal composition and gives a **zero-drift** guarantee: the shelf reads byte-for-byte
identically in `vend shelf` and in Home. The "does not read as the press namespace" requirement is
satisfied by **format divergence, not by dropping numbers**: `renderMenu` rows look like
`1. E-002 ci-backstop [High] · 2h/50k · ready` (the press namespace look); `renderShelf` rows look like
`  1. survey   read the project…   ~2h/50k (default — no runs yet)` — worth-leads, parenthetical
confidence, indented. The renderShelf *key* IS the distinguishing signal. Functionally, the press
contract (T-031-02) resolves `vend <sel>` by index against the board-only `.vend/menu.json`, so the
shelf's numbers are inert regardless of text.

- *Rejected:* `renderHome` re-renders the shelf rows un-numbered (drop the `N.`) to avoid any visual
  number overlap with the board. This would fork `renderShelf`'s column-sizing + `confidenceLabel` +
  `~` cold-start logic into `home.ts` (or force exporting those privates), risking exactly the display
  drift the charter forbids — for a concern already neutralized functionally by the board-only press
  cache. The format key, not the absence of numbers, is the honest separator.
- *Rejected:* `renderHome` also takes the board + ledger as structured inputs and renders them. The
  board needs `--all`/cache coordination that lives upstream (T-031-02), and the ledger is a trivial
  one-liner; forcing `renderHome` to own them would pull I/O-adjacent concerns into a pure composer.
  The ticket's asymmetric signature (shelf structured, board+ledger pre-rendered) is deliberate and we
  honor it.

**Honest-empty pass-through (free, by construction):** because `renderHome` only concatenates,
- empty board → `boardMenu` is whatever `renderMenu([])` produced (`"(no actions)"`) — passes through;
- empty shelf → `renderShelf([])` → `"(no playbooks)"`;
- empty ledger → caller passes `homeLedgerLine(auditWalkAway([]))` → `"ledger   E1 walk-away — no runs
  yet"`.
No region can error or fabricate; each region's own honest-empty path is preserved verbatim.

## Decision 4 — Purity & test strategy

`home.ts` is PURE/TOTAL like its three dependencies: no fs/clock/network/process/addon, fresh strings,
never throws, never mutates inputs. `home.test.ts` is an ordinary pure test (the menu.test.ts /
shelf-row.test.ts discipline) — it fabricates `WalkAwayReport`s by calling the pure `auditWalkAway`
over fixture `RunRecord`s (built with the exported pure `buildRunRecord`, the recalibrate.test.ts
precedent) and builds `ShelfRow[]` literals directly. **No BAML, no I/O.**

Coverage targets (map to the three ACs):
1. `homeLedgerLine` populated: forward·attested split rendered, percentages equal what `pct` yields and
   what `formatWalkAwayFindings` would show (no drift); singular/plural and `(k/n)` correct.
2. `homeLedgerLine` honest-empty: `auditWalkAway([])` → "no runs yet", **asserts no `%`** in the line
   (proving no fabricated number); and the `reported === 0, total > 0` → "no self-reports yet".
3. `renderHome`: a populated fixture renders all three regions **in order**; empty board passes the
   `renderMenu` guidance line through; empty ledger renders the honest foot; no box-drawing chars
   (DL-9); board text precedes shelf text precedes ledger text (index ordering assertion).

## Risks & mitigations

- **Exporting `pct` widens walk-away.ts's surface.** Low risk — it is a pure cosmetic helper; the
  export documents the deliberate Home/audit shared-rounding seam. Mitigated by a comment at the export.
- **Number-overlap confusion (board `1.` vs shelf `1.`).** Accepted and documented: resolved by format
  divergence + the board-only press cache (T-031-02). No code mitigation needed in this pure slice.
- **`renderShelf` heading `shelf — N playbooks` vs the mock's bare `shelf`.** The mock is reference,
  not a pixel spec; reusing `renderShelf` wholesale (no-drift) outweighs matching the heading glyph-for-
  glyph. Noted as a possible later charter reconciliation, out of scope here.
