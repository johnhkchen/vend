# T-031-02 Research — vend-home-surface

Descriptive map of the code this ticket touches. No solutions here — those are Design.

## The ticket in one line

Make bare `vend` print the fused DL-6 Home (board + shelf + ledger via T-031-01's `renderHome`)
**without changing the press contract** (`.vend/menu.json` writer/reader). Instant, no LLM.

## The seam to preserve: browse → persist → press

The two-gesture transaction is the load-bearing invariant. Three coordinates:

- **Writer — `browseShelf`** (`src/shelf/gather.ts:289`). Bare-`vend` flow: `gather` (read `demand.md`
  + `lisa status`) → `rankActions` → builds a `MenuCache` and persists it via `writeMenuCache`
  (`gather.ts:273`) → returns `{ menu, cache, cachePath }`. The cache stores
  `visibleActions(ranked, all)` (the exact filter `renderMenu` uses) plus a `stateHash({demand, lisa,
  all})` freshness marker and an ISO `generatedAt` (the lone clock read). It is the **single writer**
  of `.vend/menu.json`.
- **Reader — `pressShelf`** (`src/shelf/press.ts:44`). `vend <sel>`: reads `.vend/menu.json`,
  re-gathers demand+lisa to rehash for staleness, then `parseSelection` resolves the selection
  **by index** against `cache.actions.length` and dispatches each pick by name through `runPlay`.
  The printed text is irrelevant to resolution — only the persisted `actions` array and `stateHash`
  matter.
- **Current browse arm** — `src/cli.ts:533–540`. Lazy-imports `browseShelf`, prints `menu`, exits 0.
  `parsed.all` (from `parseSelectOrBrowse`, `cli.ts:485`) threads `--all` through. The `select` arm
  (`cli.ts:541`) lazy-imports `pressShelf`.

**Codebase-memory confirmation (per ticket):** the MCP server was not reachable this session, so I
confirmed the coordinates by direct read instead of `search_code`/`query_graph`. All four authoring
coordinates verified exact: `browseShelf` `gather.ts:289`, `writeMenuCache` `gather.ts:273`,
`pressShelf` `press.ts:44`, browse arm `cli.ts:533`. The only caller of the browse/persist seam is the
`import.meta.main` dispatch in `cli.ts`; `writeMenuCache` is called only by `browseShelf`. So the
bare-`vend` arm is the sole edit site and nothing else reads/writes the cache.

## The three Home regions and their suppliers

T-031-01 landed the **pure composer** `renderHome({ boardMenu, shelfRows, ledger })` and the foot
`homeLedgerLine(report)` in `src/shelf/home.ts` (committed `3dfb95f`, unit-tested in `home.test.ts`).
`HomeRegions` is deliberately asymmetric:

- `boardMenu: string` — an **already-rendered** `renderMenu` string. The board owns its `--all`/cache
  coordination upstream (i.e., `browseShelf` produces it). Home only frames it.
- `shelfRows: readonly ShelfRow[]` — **structured** rows; `renderHome` renders them via `renderShelf`.
- `ledger: string` — an already-rendered `homeLedgerLine` string.

`renderHome` is a pure concatenation: `` `${boardMenu}\n\n${renderShelf(shelfRows)}\n\n${ledger}` ``.
By type, it can neither read nor mutate the cache (it never sees a `MenuCache`).

### Board supplier
`browseShelf({ all }).menu` — the same string the current arm prints, and the same call that persists
the cache. **Reusing it as `boardMenu` keeps a single writer** (no double-write).

### Shelf supplier
`shelfRows(plays, records)` (`src/shelf/shelf-row.ts:86`, E-030/T-030-01) — pure; pairs each play's
worth with a recalibrated (or cold-start `default`) envelope. The authored catalog is `SHELF_PLAYS`
(`src/shelf/shelf.ts:33`) — the six registered play literals, leverage-descending, **currently
module-private** to `shelf.ts`. `renderShelf` (`shelf-row.ts:130`) renders them.

### Ledger supplier
`auditWalkAway(records)` (`src/ledger/walk-away.ts:160`) → `WalkAwayReport` → `homeLedgerLine(report)`
(`home.ts:70`). E-028 provenance split (forward·attested); honest-empty on no runs / no self-reports.

### The run log — read once
Both shelf and ledger consume `RunRecord[]`. `loadRunLog(opts)` (`src/log/run-log.ts:535`) reads
`.vend/runs.jsonl` (ENOENT → `{ records: [], skipped: 0 }`, the cold-start path) and returns
`ReadResult { records, skipped }`. `readRuns(jsonl)` (`run-log.ts:436`) is the pure parser beneath it.
The ticket says "reuse the same records (read once)" — one `loadRunLog` feeds both `shelfRows` and
`auditWalkAway`.

## The existing `vend shelf` shell — the closest precedent

`shelfText` (`src/shelf/shelf.ts:54`) is the impure, smoke-only shell for `vend shelf`: `loadRunLog`
→ `renderShelf(shelfRows(SHELF_PLAYS, records))`. It value-imports the six play modules (pulling the
BAML addon transitively) and is therefore kept **off every pure-test path**. The CLI `shelf` arm
(`cli.ts:665`) lazy-imports it. This is the exact template for the Home shell: same catalog, same
run-log read, plus the board (`browseShelf`) and the ledger (`auditWalkAway` → `homeLedgerLine`).

## House patterns / constraints that bind this work

1. **Pure core / impure shell split.** Every decision is a pure fixtured function; only the thin
   orchestrator does I/O (`browseShelf`, `shelfText`, `pressShelf` — all smoke-only, never unit-tested).
   `renderHome`/`homeLedgerLine` are already pure + tested. The new gather-and-compose orchestrator
   belongs in a smoke-only shell.
2. **BAML stays off test paths.** No `.test.ts` imports a play-pulling shell (verified: nothing imports
   `shelf/shelf.ts`, `shelf/gather.ts` `browseShelf`, or `play/dispatch`). So the new shell must not be
   imported by a unit test — its logic is the pure helpers (already tested) plus thin I/O.
3. **Single writer of the cache.** `browseShelf` must remain the only thing that writes `menu.json`.
   The Home path reuses its `.menu` and never re-persists.
4. **`--all` passthrough.** Only the board honors `--all` (reveals hidden rows). The shelf/ledger are
   informational and unaffected. Thread `parsed.all` straight into `browseShelf`.
5. **Degrade gracefully.** No run log → shelf rows all `default`, ledger foot "no runs yet"; no
   demand.md → board prints its `(no actions)` guidance line. `renderHome` concatenates regardless.

## Gates

`bun run check` = `baml:gen && check:typecheck (tsc --noEmit) && check:test (bun test)`. Plus the live
proof: `bun run src/cli.ts` (fused screen), `bun run src/cli.ts <n>` (press still works), and
`.vend/menu.json` unchanged by the Home render. Current suite: 882 tests / 58 files green at HEAD.

## Open questions for Design

- Where does the new shell live — a new `home-shell.ts`, or `homeText` added to `shelf.ts` (already
  imports the catalog)? Tradeoff: separation vs. avoiding a second play-import surface.
- How to honor AC#2's "a test asserting the cache shape is unchanged by the Home render" without
  importing a BAML-pulling shell into a unit test.
