# T-031-02 Design — vend-home-surface

Decide how bare `vend` becomes the fused Home, grounded in Research. Two real decisions:
(1) where the new impure orchestrator lives, (2) how to honor the press-contract test without
dragging BAML onto a unit-test path.

## Decision 1 — where the gather-and-compose orchestrator lives

The Home path needs an impure shell that: calls `browseShelf({ all })` (board + the single cache
write), reads the run log **once** (`loadRunLog`), builds `shelfRows(SHELF_PLAYS, records)`, computes
`homeLedgerLine(auditWalkAway(records))`, and returns `renderHome({ boardMenu, shelfRows, ledger })`.

### Option A — new `src/shelf/home-shell.ts`, export `SHELF_PLAYS` from `shelf.ts`  ← CHOSEN
A dedicated `homeText(opts)` shell, mirroring `shelfText`. The supply catalog `SHELF_PLAYS` is promoted
from module-private to an export of `shelf.ts` so **both** `vend` and `vend shelf` draw from one list
(no drift — adding a seventh play updates one place and both surfaces gain it). `home-shell.ts`
value-imports nothing new beyond `shelf.ts` (for the catalog) + `gather.ts` (`browseShelf`) +
`run-log.ts` + `walk-away.ts` + the two pure `home.ts`/`shelf-row.ts` modules.

- **For:** one orchestrator = one responsibility (the gospel of the codebase: `browseShelf`,
  `shelfText`, `pressShelf` are each a single-surface shell). The Home shell reads clean — board, shelf,
  ledger, compose — and nothing in `shelf.ts` changes except a one-word `export`. Single catalog source.
- **Against:** a second module that transitively pulls the play imports (BAML). But it is smoke-only and
  never on a test path, so the cost is identical to `shelf.ts`'s and incurred only when bare `vend` runs.

### Option B — add `homeText` to `shelf.ts`
Reuse the file that already imports `SHELF_PLAYS`; no new module, no new export.
- **For:** zero new play-import surface; `SHELF_PLAYS` stays private.
- **Against:** widens `shelf.ts` from "the `vend shelf` supply read" to also owning board gather, the
  run-log-once fan-out, and the ledger — three concerns the file's own header disclaims ("The board
  (`vend`) is untouched: this stands beside it, not in it"). Rejected: it muddies a crisp boundary to
  save one `export` keyword.

### Option C — inline the orchestration in the `cli.ts` browse arm
Put the gather/compose directly in `import.meta.main`.
- **Against:** breaks the thin-shell discipline — every other arm lazy-imports a named shell and the
  dispatch block stays a one-liner per command. Inlining six imports + fan-out logic into `cli.ts`
  bloats the dispatcher and makes the Home flow untestable/unreadable in isolation. Rejected.

**Chosen: Option A.** It is the faithful extension of the `shelfText` precedent, keeps each shell
single-purpose, and unifies the catalog so the two supply surfaces can never diverge.

## Decision 2 — proving the press contract is preserved (AC#2)

AC#2: existing press tests stay green **+** "a test asserting the cache shape is unchanged by the Home
render." The constraint (Research §house-patterns): no unit test may import a BAML-pulling shell, so
`home-shell.ts` cannot be loaded by a `.test.ts`.

### What actually guarantees the contract
The cache is written **only** by `browseShelf`, which this ticket does **not** touch. `homeText` calls
it identically (`{ all }` passthrough) and consumes its `.menu` string; it never re-persists. The board
reaches `renderHome` as `boardMenu: string` — a type that **cannot carry or mutate a `MenuCache`**. So
the Home render is, by construction and by type, incapable of altering the cache.

### How the test coverage pins it (no BAML)
1. **`gather.test.ts` (unchanged, green)** already pins the cache shape: `stateHash` determinism +
   `visibleActions`/`signalsToActions` shape. `browseShelf` is untouched, so these remain the cache-
   shape regression guard.
2. **`press-core.test.ts` (unchanged, green)** pins index resolution + staleness against that cache.
   Bare-`vend` not changing the writer means these cannot regress.
3. **`home.test.ts` (pure, extend by one)** proves the *Home-side* half of the invariant: `renderHome`
   reuses `boardMenu` **byte-for-byte** (the board substring equals the input string) — so the rendered
   Home can never re-derive or perturb the board the cache was built from. This is the "cache shape is
   unchanged by the Home render" assertion, expressed purely: the render is a frame around the verbatim
   board, type-incapable of touching `menu.json`.
4. **AC#3 live proof** closes the loop end-to-end: `bun run src/cli.ts` then `bun run src/cli.ts <n>`
   presses the same board pick, and `.vend/menu.json` is byte-identical before/after the Home render.

This is the honest, house-consistent reading: the contract lives in `browseShelf`/`pressShelf` (both
unchanged, both covered); the new pure test guards the one new degree of freedom (Home framing the
board), and BAML stays off the test path exactly as it does for `shelfText`.

### Rejected: a temp-dir integration test importing `homeText`
Would import the six plays (BAML) onto the `bun test` path — the one thing the codebase deliberately
never does. The live-proof AC#3 already exercises the real shell end-to-end; duplicating it as a slow,
BAML-bound unit test buys nothing and breaks the discipline. Rejected.

## The resulting shape (preview of Structure)

```
shelf.ts        export SHELF_PLAYS            // promote private → export (one word)
home-shell.ts   NEW: homeText(opts) shell     // browseShelf + loadRunLog-once → renderHome
cli.ts          browse arm → import homeText   // one-line swap, --all passthrough
home.test.ts    +1 pure test: board byte-for-byte passthrough (cache-stability proxy)
```

## Why this satisfies every AC

- **AC#1** (fused screen, `--all`, instant/no-LLM): `homeText` composes board+shelf+ledger via the pure
  `renderHome`; `--all` threads into `browseShelf`; no play is cast (all reads), so it stays instant.
- **AC#2** (press preserved): `browseShelf` is the unchanged single writer; `pressShelf` unchanged;
  guarded by the green `gather`/`press-core` suites + the new pure passthrough test + live proof.
- **AC#3** (live proof): `bun run src/cli.ts` and `… <n>` exercise the real shell; `check:*` green.

## Risks / mitigations

- **Risk:** importing `SHELF_PLAYS` from `shelf.ts` into `home-shell.ts` creates a value-import cycle if
  `shelf.ts` ever imported `home-shell.ts`. **Mitigation:** it does not and will not; the dependency is
  one-way (`home-shell → shelf` for the catalog only).
- **Risk:** a second run-log read (board reads demand/lisa; ledger+shelf read runs.jsonl) looks like
  duplication. **Mitigation:** they are *different files*; within `homeText` the run log is read exactly
  once and fanned to both consumers, honoring "read once."
