# Review — T-003-02 gather-persist-and-vend-entry

Handoff document. What changed, test coverage, open concerns — enough to review
without reading every diff.

## Summary

Wired the pure menu model (T-003-01) to reality: bare `vend` now reads the value
model (`demand.md`) + readiness (`lisa status`), shapes them into `Action[]`, ranks →
renders → persists `.vend/menu.json` → prints — instant, deterministic, no LLM.
`.vend/menu.json` is the index-stability seam the press gesture (`vend <sel>`,
T-003-04) resolves against, carrying a freshness marker (`generatedAt` + `stateHash`)
so a materially-stale menu can be detected. The house split holds: every nontrivial
decision is a pure, fixture-tested function; only file reads, the `lisa` spawn, the
clock, and the write are impure (untested shell, smoke-proven).

Committed in two atomic commits: **`b3e58f0`** (gather + persist) and **`e20cf26`**
(bare-`vend` browse entry). Full suite green (212 pass), typecheck clean.

## Files changed

| File | Δ | Notes |
|---|---|---|
| `src/shelf/gather.ts` | **new** (~210 ln) | Pure parsers/shaping + `stateHash`; impure `gather`/`browseShelf`/`writeMenuCache`. |
| `src/shelf/gather.test.ts` | **new** (~165 ln) | 24 fixture tests for the pure surface. |
| `src/cli.ts` | **modify** | `browse` added to `ParsedCommand`/`parseArgs`; dispatched in the `import.meta.main` shell. |
| `src/cli.test.ts` | **modify** | 3 new `parseArgs` browse cases; updated the now-`browse` empty-argv assertion. |
| `docs/active/work/T-003-02/*.md` | **new** | RDSPI artifacts. |

Deliberately **not** changed: `docs/active/tickets/*.md` (Lisa owns phase/status —
left unstaged). `.vend/menu.json` is gitignored runtime telemetry, regenerated each
browse, never committed.

## Public surface (`src/shelf/gather.ts`)

Pure (unit-tested): `parseDemandSignals(md) -> RawSignal[]`,
`parseLisaInProgressEpics(stdout) -> string[]`, `deriveReadiness(status)`,
`isDoneStatus(status)`, `budgetForTier(tier)`, `signalsToActions(signals,
inProgressEpicIds) -> Action[]`, `stateHash({demand,lisa,all}) -> string`; consts
`TIER_BUDGET`, `DEMAND_PATH`, `MENU_CACHE_FILE`. Impure (the shell):
`gather(opts)`, `browseShelf(opts) -> BrowseResult`, `writeMenuCache(root, cache)`.
`cli.ts` adds `{ cmd: "browse"; all }`.

## How the two inputs become the menu

1. `parseDemandSignals` scans demand.md's pipe tables → `RawSignal{name, tier,
   statusText, epicId}`. A signal's OWN epic is matched via the `→ E-###` / `epic/E-###`
   conventions — NOT "any E-### in the cell" (cells name prerequisite epics in prose).
2. `signalsToActions` keeps signals with a staged epic that isn't `done` (by leading
   status word); readiness = the leading word, overridden to `blocked` if `lisa` shows
   the epic in-progress.
3. `browseShelf` → `rankActions` → `MenuCache{version, generatedAt, stateHash, all,
   actions: visibleActions(ranked, all)}` → `writeMenuCache` → `renderMenu(ranked,
   {all})`. Render and cache derive from the same `ranked`+`all` (index contract).

## Acceptance criteria

- **AC#1** `gather.ts` reads demand.md + `lisa status` into `Action[]`, pure shaping
  unit-tested — ✅ (24 tests).
- **AC#2** bare `vend`: gather → `rankActions` → `renderMenu` → write `.vend/menu.json`
  → print, instant, no LLM — ✅ (smoke: `E-002` shown, `(+1 hidden)`).
- **AC#3** cache carries a freshness marker (`generatedAt` timestamp + `stateHash`) so
  T-003-04 can detect a materially-stale menu — ✅.
- **AC#4** `bun run check:test` / `check:typecheck` green; **P2** advanced — ✅
  (212 pass / 0 fail; tsc exit 0).

## Test coverage

24 tests across the pure surface: signal parsing (kept rows, tiers, own-epic
extraction, header/separator/prose skips, empty); in-progress epic parsing (mixed vs
all-done, deps/blocks refs ignored, empty); leading-word readiness + `isDoneStatus`
(incl. `done`/`blocked` in prose ignored); `budgetForTier` round-tripping via
`formatBudget`; `signalsToActions` (drop done/no-epic, board order, in-progress→blocked
override, field shape, frozen-input purity, empty); `stateHash` (determinism,
`all`-sensitivity, one-char sensitivity, hex shape). Plus 3 `cli.ts` parse cases.

**Gaps (intentional, house pattern):** `gather`/`browseShelf`/`writeMenuCache` and the
`import.meta.main` shell are not unit-tested — they are thin I/O over tested pure cores
and were verified by the manual smoke (progress.md). No test asserts a written file's
bytes (the persist path is impure); the round-trip is covered by the smoke + the pure
`MenuCache` shape test in T-003-01.

## Open concerns / notes for T-003-04 and beyond

1. **Index contract is shared discipline, honored here.** `MenuCache.actions ===
   visibleActions(rankActions(actions), all)` with the same `all` the render used.
   T-003-04 must resolve selections as a direct `actions[i-1]` against the persisted
   list/mode — never re-filter or re-rank. Bare-`vend` persists `all:false`; `--all`
   persists `all:true` with different numbering (by design).
2. **Staleness *check* is T-003-04's.** This ticket only WRITES `generatedAt` +
   `stateHash`. T-003-04 recomputes `stateHash({demand, lisa, all})` from freshly-read
   inputs and compares to warn "re-run vend". The hash folds `demand + lisa + all`, so
   it conservatively flags board changes even when the menu content (currently a
   function of demand.md + lisa-in-progress) is unchanged — errs toward re-running,
   never toward acting on a stale list. `gather` returns the raw `demand`/`lisa`
   strings precisely so the check can rehash without re-deriving the menu.
3. **`lisa` done-ness is intentionally NOT trusted (D-B).** Ticket ids don't reliably
   encode their epic (E-001 spans `T-001-*`+`T-002-*`), so an epic's done-ness is read
   from demand.md's Status cell, and only the phantom-free "has unfinished tickets →
   in-progress → blocked" signal is taken from `lisa`. **Future enrichment:** a sound
   ticket→epic map (read each active ticket's `story` frontmatter → epic) would let
   `lisa` drive done-ness directly; deferred — demand.md is authoritative today.
4. **Vendable set = epic-targeted signals only.** A signal with no staged `E-###`
   (kaizen rows that would get an id on pull) is not an action today (the only play,
   `DecomposeEpic`, targets an epic file). Current live menu: `E-002` (ready),
   `E-003` (blocked, in-progress); `E-001` dropped (done). Documented scope, not a
   permanent limit.
5. **Budget defaults are calibration-pending.** `TIER_BUDGET` is a fixed tier→envelope
   table (budget ∝ value) because demand.md envelopes are prose. demand.md's stated
   plan is to set these from the run log's measured fat tails — one `const` edit.
   T-003-04's `--budget` override supersedes them per-pick.
6. **demand.md prose drift** could change which rows parse. Parsers are TOTAL (skip
   unrecognized rows, never throw), so `vend` degrades to a thinner/empty menu rather
   than crashing; `renderMenu` renders `(no actions)`.
7. **`cli.ts` is co-edited by T-003-04** (the R4 file-overlap edge). The `browse`
   branch is additive and narrow (empty argv / all-`--all`); T-003-04's selection
   branch slots beside it without conflict.

## Risk assessment

Low–moderate. The pure core is total and fully fixtured; the impure shell is thin and
smoke-verified against the live board. No mutation of the live board or committed state
— `.vend/menu.json` is gitignored, regenerated, write-only. The two live-data
deviations (D-A leading-word status, D-B in-progress-not-done) were caught precisely
because the impure path was smoke-tested, and both make the menu strictly more correct.
The one carried-forward soundness gap (lisa done-ness) is explicitly avoided, not
relied upon, with demand.md as the authoritative fallback.
