# T-031-02 Structure — vend-home-surface

The blueprint: exact files, signatures, and ordering. Not code — the shape of the code.

## Change set (4 files: 1 new, 3 modified)

| File | Change | Why |
|---|---|---|
| `src/shelf/shelf.ts` | **MODIFY** — `const SHELF_PLAYS` → `export const SHELF_PLAYS` | one supply catalog, shared by `vend` + `vend shelf` (no drift) |
| `src/shelf/home-shell.ts` | **CREATE** — `homeText(opts)` impure orchestrator | the gather-and-compose shell behind bare `vend` |
| `src/cli.ts` | **MODIFY** — browse arm (`:533–540`) → lazy-import `homeText` | wire bare `vend` to the fused Home |
| `src/shelf/home.test.ts` | **MODIFY** — +1 pure test (board byte-for-byte passthrough) | AC#2 Home-side cache-stability proxy |

No deletions. `gather.ts`, `press.ts`, `press-core.ts`, `shelf-row.ts`, `walk-away.ts`, `run-log.ts`,
`home.ts`, `menu.ts` are **unchanged** (the press contract + pure cores stay frozen).

## 1. `src/shelf/shelf.ts` — promote the catalog

One-word change. `const SHELF_PLAYS: readonly AnyPlay[] = [...]` becomes
`export const SHELF_PLAYS: readonly AnyPlay[] = [...]`. The doc-comment already calls it "the single
place a new play joins the supply catalog" — exporting makes that literally true across both surfaces.
`shelfText` keeps using it verbatim; nothing else in `shelf.ts` moves.

## 2. `src/shelf/home-shell.ts` — NEW impure shell (the only new logic)

Header (house style): a short comment stating it is the impure, smoke-only Home orchestrator (cf.
`shelfText` / `browseShelf`), that it reads the run log **once** and value-imports plays (BAML
transitively), and that it is therefore kept off every pure-test path — all real work is the pure
`browseShelf` / `shelfRows` / `homeLedgerLine` / `renderHome` it wires together.

```ts
import { browseShelf, type BrowseOpts } from "./gather.ts";
import { loadRunLog } from "../log/run-log.ts";
import { auditWalkAway } from "../ledger/walk-away.ts";
import { shelfRows } from "./shelf-row.ts";
import { homeLedgerLine, renderHome } from "./home.ts";
import { SHELF_PLAYS } from "./shelf.ts";

/** Options for {@link homeText}. `all` reveals hidden board rows (board only); `projectRoot`
 *  + `runLogPath` are the I/O seams (CLI calls with none). Mirrors BrowseOpts + shelfText's path. */
export interface HomeTextOptions {
  readonly all?: boolean;
  readonly projectRoot?: string;
  /** Override the run-log location (the loadRunLog testability seam). Default `.vend/runs.jsonl`. */
  readonly runLogPath?: string;
}

/**
 * Gather the three DL-6 Home regions and compose them. The IMPURE orchestrator bare `vend` calls:
 *  - BOARD: browseShelf({ all }) — ranks, persists `.vend/menu.json` (THE single writer; the press
 *    contract), returns the rendered menu reused verbatim as boardMenu.
 *  - SHELF + LEDGER: read the run log ONCE (loadRunLog) and fan the records to shelfRows(SHELF_PLAYS,…)
 *    and auditWalkAway(…) → homeLedgerLine(…).
 * Then renderHome({ boardMenu, shelfRows, ledger }). Returns the ready-to-print string; printing/exit
 * is the CLI shell's job. Degrades: no demand.md → board guidance line; no run log → all `default`
 * rows + honest "no runs yet" foot. Instant, deterministic, no LLM.
 */
export async function homeText(opts: HomeTextOptions = {}): Promise<string> {
  const browseOpts: BrowseOpts = {
    all: opts.all ?? false,
    ...(opts.projectRoot ? { projectRoot: opts.projectRoot } : {}),
  };
  const { menu: boardMenu } = await browseShelf(browseOpts);
  const { records } = await loadRunLog(opts.runLogPath ? { path: opts.runLogPath } : {});
  const ledger = homeLedgerLine(auditWalkAway(records));
  return renderHome({ boardMenu, shelfRows: shelfRows(SHELF_PLAYS, records), ledger });
}
```

Notes:
- **Single writer preserved:** the cache is written only inside `browseShelf`; `homeText` never touches
  `menu.json`. The board reaches `renderHome` as a string — type-incapable of mutating the cache.
- **Read once:** one `loadRunLog`, fanned to `shelfRows` and `auditWalkAway`.
- **`--all`:** flows into `browseShelf` only (board). Shelf/ledger are informational, unaffected.
- **`projectRoot` passthrough:** browse honors it; `loadRunLog` default path is cwd-relative
  `.vend/runs.jsonl`. The CLI calls `homeText({ all })` with no root, so default cwd applies (matches
  today's `browseShelf({ all })`). `runLogPath` exists only as a future test/override seam, symmetric
  with `shelfText`'s `path`.

## 3. `src/cli.ts` — the browse arm (one-line swap)

Replace `:533–540`:

```ts
if (parsed.cmd === "browse") {
  // Bare `vend`: the fused DL-6 Home — board (ranked pull, persisted to `.vend/menu.json`) + shelf
  // (authored supply) + ledger foot, composed by renderHome. browseShelf stays the single cache
  // writer (the press contract); `--all` reveals hidden board rows. Instant, deterministic, no LLM.
  // Lazy import keeps the Home deps (and their transitive BAML addon) off the pure-parse path.
  const { homeText } = await import("./shelf/home-shell.ts");
  process.stdout.write(`${await homeText({ all: parsed.all })}\n`);
  process.exit(0);
}
```

`parsed.all` is unchanged (`parseSelectOrBrowse` still yields `{ cmd: "browse", all }`). The `select`
arm and every other arm are untouched. USAGE string unchanged (bare `vend` is already the implicit
default verb).

## 4. `src/shelf/home.test.ts` — +1 pure test

Inside `describe("renderHome — composes the three DL-6 regions …")`, add a test that pins the board
passthrough byte-for-byte (the AC#2 Home-side cache-stability proxy):

```ts
test("cache-stability proxy: the board substring equals boardMenu byte-for-byte (no re-derivation)", () => {
  const out = renderHome({ boardMenu: board, shelfRows: rows, ledger });
  // renderHome FRAMES the already-persisted board; it never re-renders or mutates it. So whatever
  // browseShelf wrote to `.vend/menu.json` cannot be perturbed by the Home render — the board region
  // is the input string verbatim. (HomeRegions.boardMenu is a string: a MenuCache is unrepresentable.)
  expect(out.startsWith(board)).toBe(true);
  expect(out).toContain(`${board}\n\n`);
});
```

This needs no new imports and pulls no BAML — it exercises the pure `renderHome` already imported.

## Ordering (for atomic commits — detailed in Plan)

1. **Commit 1 — pure + shell:** export `SHELF_PLAYS`; add `home-shell.ts`; add the `home.test.ts`
   passthrough test. Gate: `tsc` + `bun test` green (no CLI behavior change yet — `homeText` exists,
   unused).
2. **Commit 2 — wire:** swap the `cli.ts` browse arm to `homeText`. Gate: `tsc` + `bun test` + live
   proof (`bun run src/cli.ts`, `… <n>`, `.vend/menu.json` unchanged).

Splitting this way means Commit 1 is fully gated before any user-visible behavior changes, and Commit 2
is a reviewable one-line wiring diff.

## Interfaces touched (summary)

- **New public:** `homeText(opts?: HomeTextOptions): Promise<string>`, `HomeTextOptions`,
  `export SHELF_PLAYS`.
- **Unchanged public (relied upon):** `browseShelf`/`BrowseOpts`, `loadRunLog`/`ReadResult`,
  `shelfRows`, `auditWalkAway`/`WalkAwayReport`, `homeLedgerLine`/`renderHome`/`HomeRegions`.
- **Unchanged contract (must not regress):** `MenuCache` shape + `stateHash` (writer `browseShelf`),
  `pressShelf` index resolution.
