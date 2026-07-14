# T-031-02 Plan — vend-home-surface

Ordered, independently-verifiable steps. Two commits: pure+shell first (fully gated, no behavior
change), then the one-line wiring (gated + live proof).

## Testing strategy

- **Unit (pure, no BAML):** the +1 `home.test.ts` passthrough test. The pure cores it leans on
  (`renderHome`, `homeLedgerLine`, `shelfRows`, `auditWalkAway`, `browseShelf`'s cache helpers) are
  already covered by `home.test.ts`, `shelf-row.test.ts`, `walk-away.test.ts`, `gather.test.ts`.
- **Regression guards (must stay green):** `gather.test.ts` (cache shape / `stateHash`),
  `press-core.test.ts` (index resolution / staleness). These ARE the press-contract proof, since
  `browseShelf`/`pressShelf` are untouched.
- **Shell (`home-shell.ts`):** smoke-only, like `shelfText`/`browseShelf` — never imported by a
  `.test.ts` (keeps BAML off the test path). Exercised by the AC#3 live proof.
- **Live proof (AC#3):** `bun run src/cli.ts` (fused screen), `bun run src/cli.ts <n>` (press still
  resolves), `.vend/menu.json` byte-identical before/after the Home render.
- **Gate:** `bun run check` = `baml:gen && tsc --noEmit && bun test`.

## Step 1 — promote `SHELF_PLAYS` (commit 1)

Edit `src/shelf/shelf.ts`: `const SHELF_PLAYS` → `export const SHELF_PLAYS`. No other change.
**Verify:** `tsc --noEmit` green; `shelfText` still references it; `bun test` unchanged.

## Step 2 — create `src/shelf/home-shell.ts` (commit 1)

Author `homeText(opts)` + `HomeTextOptions` exactly per Structure §2: `browseShelf({ all, projectRoot })`
for the board (single cache writer); `loadRunLog({ path? })` once; `shelfRows(SHELF_PLAYS, records)` +
`homeLedgerLine(auditWalkAway(records))`; `renderHome({ boardMenu, shelfRows, ledger })`. House-style
header comment.
**Verify:** `tsc --noEmit` green (all imported symbols resolve: `browseShelf`/`BrowseOpts`,
`loadRunLog`, `auditWalkAway`, `shelfRows`, `homeLedgerLine`/`renderHome`, `SHELF_PLAYS`). No test
imports it. Not yet wired, so no CLI behavior change.

## Step 3 — add the pure passthrough test (commit 1)

Add to `home.test.ts` the "cache-stability proxy" test from Structure §4 (board byte-for-byte). No new
imports.
**Verify:** `bun test` green, including the new case; full suite still passes (was 882/58).

### Commit 1
`feat(home): homeText gather-and-compose shell + shared SHELF_PLAYS catalog (T-031-02)`
Contains: `shelf.ts` export, `home-shell.ts`, `home.test.ts` +1. Gate: `tsc` + `bun test` green.
No user-visible change yet (`homeText` exists, unused) — safe, fully-gated checkpoint.

## Step 4 — wire the browse arm (commit 2)

Edit `src/cli.ts` browse arm (`:533–540`) per Structure §3: lazy-import `homeText`, print
`await homeText({ all: parsed.all })`, exit 0. Update the arm comment. Nothing else in `cli.ts` moves.
**Verify:** `tsc --noEmit` green.

## Step 5 — live proof (commit 2 gate)

1. `bun run src/cli.ts` → prints the fused screen: the board (ranked pull) leading, the six-play shelf
   receding beneath (`shelf — 6 playbooks`), the ledger foot (`E1 walk-away …` with the
   forward·attested split, or the honest "no runs yet" / "no self-reports yet").
2. Capture `.vend/menu.json` (sha) before/after; confirm the Home render leaves it byte-identical
   relative to a plain `browseShelf` write (modulo the always-changing `generatedAt` timestamp — compare
   `actions` + `stateHash` + `all` + `version`).
3. `bun run src/cli.ts <n>` → presses the board pick `n`, dispatching as before (or the honest
   `bad-selection`/`no-menu`/`stale` andon for an out-of-range/absent/stale pick) — no selection
   regression.
4. `bun run check` green.

### Commit 2
`feat(home): bare \`vend\` renders the fused DL-6 Home (T-031-02)`
Contains: `cli.ts` browse-arm swap. Gate: `tsc` + `bun test` + live proof.

## Rollback / risk

- Each commit is independently green; commit 1 changes no behavior, so a problem surfaced in commit 2's
  live proof reverts to a still-working shelf-less bare `vend` by reverting one file.
- **Press regression is the headline risk.** Mitigated structurally: `browseShelf` (writer) and
  `pressShelf` (reader) are untouched; `homeText` reuses `browseShelf`'s `.menu` and never re-persists;
  the board reaches `renderHome` as a `string`. Guarded by green `gather`/`press-core` suites + the new
  pure passthrough test + the live press in Step 5.
- **BAML on the test path** — avoided by keeping `home-shell.ts` smoke-only (no `.test.ts` imports it).

## Definition of done

All three ACs: fused screen with `--all` board passthrough (AC#1); `.vend/menu.json` written exactly as
before + `vend <sel>` resolves unchanged, guarded by green press tests + the pure passthrough test
(AC#2); live proof green + `check:*` green (AC#3). `progress.md` records any deviation; `review.md`
hands off.
