# T-031-02 Review — vend-home-surface

Handoff for a human reviewer: what changed, how it's covered, and the open concerns. Bare `vend` now
prints the fused DL-6 Home (board + shelf + ledger) while the press contract is preserved exactly.

## What changed

| File | Δ | Summary |
|---|---|---|
| `src/shelf/shelf.ts` | modified (2 lines) | `SHELF_PLAYS` promoted to `export`; doc-comment notes it now feeds both `vend shelf` and the fused Home (one catalog, no drift). |
| `src/shelf/home-shell.ts` | **new (~70 lines)** | `homeText(opts)` — the impure Home orchestrator: `browseShelf` (board + single cache write) → one `loadRunLog` fanned to `shelfRows` + the walk-away ledger → `renderHome`. |
| `src/cli.ts` | modified (browse arm) | Bare `vend` lazy-imports `homeText` instead of `browseShelf`; prints the composed Home. `--all` passthrough + exit 0 unchanged. |
| `src/shelf/home.test.ts` | modified (+1 test) | Pure "cache-stability proxy": `renderHome` frames `boardMenu` byte-for-byte. |

Commits: `38eb3a6` (shell + catalog + test), `806c60f` (wire). **Net new product logic is one small
impure shell**; everything else is composition of existing pure cores (T-031-01 `renderHome` /
`homeLedgerLine`, E-030 `shelfRows`, E-028 `auditWalkAway`, T-003 `browseShelf`).

## How the acceptance criteria are met

- **AC#1 — fused screen, `--all`, instant/no-LLM.** Live: `bun run src/cli.ts` prints board (leads) ·
  `shelf — 6 playbooks` (recedes) · `ledger … walk-away 93% (14/15) └ forward 50% · attested 100%`
  (foot). `--all` threads into `browseShelf` (board only). No play is cast — all reads → instant. ✅
- **AC#2 — press preserved.** `browseShelf` (writer) and `pressShelf` (reader) are **untouched**;
  `homeText` reuses `browseShelf`'s `.menu` and never re-persists. Proven three ways: (a) the cache
  contract (`version`/`stateHash`/`all`/`actions`) is byte-for-byte identical after a Home render vs. a
  plain `browseShelf` write (same sha); (b) `bun run src/cli.ts 99` hard-errors `index 99 is not in
  1..4` — resolution still runs against the persisted board length; (c) the green `gather.test.ts` +
  `press-core.test.ts` suites (cache shape + index resolution) + the new pure passthrough test. ✅
- **AC#3 — live proof + `check:*` green.** Captured above; `bun run check` (baml:gen + tsc + bun test)
  → **883 pass / 0 fail / 58 files**. ✅

## Test coverage

- **Added:** 1 pure test in `home.test.ts` (board byte-for-byte passthrough). Full suite 882 → 883.
- **Leaned on (unchanged, green):** `home.test.ts` (renderHome composition + honest-empty foot),
  `shelf-row.test.ts` (`shelfRows`/`renderShelf`), `walk-away.test.ts` (audit math),
  `gather.test.ts` (cache shape / `stateHash`), `press-core.test.ts` (index resolution / staleness).
- **Deliberately not unit-tested:** `home-shell.ts` (impure, smoke-only) — consistent with the house
  rule that play-pulling shells (`shelfText`, `browseShelf`, `pressShelf`) stay off the BAML test path.
  It is exercised end-to-end by the AC#3 live proof, which is the codebase's standard for shells.

## Coverage gaps / open concerns

1. **`home-shell.ts` has no automated test — by design, but it is real I/O.** Its logic is thin
   (compose four already-tested functions), and an integration test would import the six plays (BAML)
   onto the `bun test` path — the one thing the codebase never does. The live proof covers the happy
   path; the degrade paths (no demand.md → board guidance line; no run log → all-`default` shelf +
   "no runs yet" foot) are covered at the *pure* level (`gather`/`shelf-row`/`home` tests) but not
   end-to-end through `homeText`. Low risk (pure delegation), but flagged for the reviewer.
2. **`projectRoot` / `runLogPath` seams are unused by the CLI.** `homeText` accepts both for symmetry
   with `shelfText` and future testability; the CLI calls `homeText({ all })`. If a future ticket wants
   a non-BAML integration test of the shell, these seams are the entry point (the board would still pull
   plays via `SHELF_PLAYS`, so a true unit test would require a play-injection seam — out of scope here).
3. **`vend shelf` and the Home shelf now share `SHELF_PLAYS` but read the run log separately.** That is
   correct (two independent verbs), but a reviewer should note the catalog is the *only* shared state;
   the shelf rendering itself is identical (both call `renderShelf(shelfRows(SHELF_PLAYS, records))`), so
   the two surfaces cannot drift in content, only in freshness of their separate reads.
4. **USAGE string unchanged.** Bare `vend` is the implicit default verb (no subcommand), so the usage
   text needed no edit. If product later wants Home documented explicitly in `--help`, that's a follow-up.

## Risk assessment

Low. The headline risk (press regression) is structurally foreclosed — the writer/reader are untouched,
the board reaches the composer as an immutable `string`, and the cache contract is verified byte-for-byte
identical. The change is additive (a richer print) over a frozen contract.

## Nothing requires human intervention before merge.
All ACs met, full gate green, no deviations. Ready for review.
