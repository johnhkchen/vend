# T-031-01 — Review: home-composite-core

Handoff for a human reviewer. The pure DL-6 Home composite (`homeLedgerLine` + `renderHome`) is
implemented, tested, and committed. Full suite green: **882 pass / 0 fail** (+11 over the 871 baseline).

## What changed

| File | Change | Commit |
|---|---|---|
| `src/shelf/home.ts` | **NEW** — `HomeRegions`, `homeLedgerLine(report)`, `renderHome(regions)`, private `subPct` | 3dfb95f |
| `src/ledger/walk-away.ts` | `pct` made `export` + one doc line (shared Home/audit rounding seam); **no behavior change** | 3dfb95f |
| `src/shelf/home.test.ts` | **NEW** — 11 pure unit tests (3 groups) | 7f37f3c |

No files deleted. No I/O, no `cli.ts`, no `.vend/` cache, no press path touched (all T-031-02). The
forbidden modules (`renderMenu`, `renderShelf`, recalibration) are unchanged — composed, not edited.

### Behavior delivered
- **`homeLedgerLine(report)`** — the compact DL-6 trust foot:
  - populated: `ledger   E1 walk-away 63% (5/8)   └ forward 50% · attested 75%` — the E-028 provenance
    split (forward·attested), **not** a conflated rate; walk-away = `1 − intervention rate`.
  - no runs at all → `ledger   E1 walk-away — no runs yet`.
  - runs but no intervention bit → `ledger   E1 walk-away — no self-reports yet (N runs)`.
  - empty provenance partition → `none yet` (never a fabricated `0%`).
- **`renderHome({ boardMenu, shelfRows, ledger })`** — board (leads) + `renderShelf(shelfRows)`
  (recedes beneath) + ledger (foot), blank-line divided, no boxes/rules/cards. Each region's
  honest-empty path passes through by construction (pure concatenation).

## Test coverage

11 tests, all pure (no fs/clock/spawn, no BAML) — the menu/shelf-row test discipline. Fixtures
fabricate `RunRecord`s via the exported pure `buildRunRecord` and derive real `WalkAwayReport`s via the
pure `auditWalkAway`; `ShelfRow`s are literals.

- **Group A — provenance-split foot (AC #1):** combined rate + `(k/n)`; forward·attested split;
  `none yet` for an empty partition; **no-drift** test asserts the foot's percentages appear identically
  in `formatWalkAwayFindings` (the charter's "must not drift" rule made executable).
- **Group B — honest-empty (AC #1):** `no runs yet` and `no self-reports yet (N runs)` each assert the
  line carries **no `%`** — proving no fabricated trust number (E-026 / IA-8). Singular `1 run` covered.
- **Group C — `renderHome` composition (AC #2/#3):** three regions in order (index assertion); empty
  board passes the `renderMenu` guidance through; empty ledger renders the honest foot; empty shelf →
  `(no playbooks)`; DL-9 no-chrome (box-drawing glyphs).

### Coverage gaps / notes
- **No live/integration proof here, by design.** There is no I/O in this slice; the fused-screen proof
  over the real run log (and press-unchanged) is **T-031-02's** AC. Keeping it out honors the DAG edge.
- The DL-9 no-chrome assertion is scoped to the region **above** the ledger line, because the foot uses
  `└` as a textual continuation glyph (mirroring `formatWalkAwayFindings`), not box chrome. The
  character class deliberately omits `[` `]` (renderMenu's legitimate `[High]` tier brackets) — this
  was the one red test caught and fixed in 7f37f3c (see progress.md deviation 2).

## Open concerns for the reviewer

1. **Shelf numbers vs the press namespace (design call — please sanity-check).** `renderHome` calls
   `renderShelf` wholesale, so the shelf renders as a numbered `1. … 2. …` list under a `shelf — N
   playbooks` heading — visually it carries the same `N.` numbers as the board. The ticket asked the
   shelf to "not read as the press namespace." This is resolved by **format divergence** (renderShelf's
   worth-leads/parenthetical-confidence key looks unlike renderMenu's `[Tier] · budget · readiness`)
   plus the **functional** contract in T-031-02 (the press cache holds board actions only; `vend <sel>`
   resolves by index against it, independent of printed text). The alternative — re-rendering the shelf
   un-numbered — was rejected to avoid forking renderShelf's row format and risking display drift (see
   design.md Decision 3). If the team prefers an un-numbered Home shelf, that is a small follow-up that
   would mean exporting `confidenceLabel`/extracting a row helper from `shelf-row.ts`.

2. **`renderShelf` heading `shelf — N playbooks` vs the DL-6 mock's bare `shelf`.** Reusing
   `renderShelf` wholesale (zero drift) was chosen over matching the mock glyph-for-glyph. The mock is
   "reference, not pixel spec"; if the charter wants the bare `shelf` heading, that is a renderShelf-
   level change (out of this ticket's "do not change renderShelf" scope) to reconcile later.

3. **Exporting `pct` widens `walk-away.ts`'s public surface.** Deliberate — it is the documented shared
   rounding seam so Home and `vend audit` can never diverge. Pure cosmetic helper; low risk.

## Verification
- `bun run check` (baml:gen + `tsc --noEmit` + `bun test`): **green, 882 pass / 0 fail**.
- `walk-away.test.ts`: 17/17 unchanged (confirms the `pct` export is behavior-neutral).

## Downstream handoff (T-031-02)
`HomeRegions`, `homeLedgerLine`, `renderHome` are exported from `src/shelf/home.ts` and ready to wire
into the bare-`vend` browse arm: gather board (keep `browseShelf` persistence — the press contract) →
`shelfRows(plays, readRuns(...))` → `homeLedgerLine(auditWalkAway(records))` → `renderHome(...)` →
print. Read the run log once and share the records between the shelf and the ledger.
