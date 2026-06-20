# T-031-02 Progress — vend-home-surface

Status: **complete**. Two commits, full gate green, live proof captured. Zero deviations from the plan.

## Commits

| # | SHA | Title | Files |
|---|---|---|---|
| 1 | `38eb3a6` | `feat(home): homeText gather-and-compose shell + shared SHELF_PLAYS catalog (T-031-02)` | `shelf.ts`, `home-shell.ts` (new), `home.test.ts` |
| 2 | `806c60f` | `feat(home): bare \`vend\` renders the fused DL-6 Home (T-031-02)` | `cli.ts` |

## Steps executed (vs. plan.md)

- **Step 1 — promote `SHELF_PLAYS`** ✅ `const` → `export const` in `shelf.ts`; doc-comment updated to
  note the catalog is now shared by `vend shelf` + the fused Home (no drift).
- **Step 2 — `home-shell.ts`** ✅ `homeText(opts)` + `HomeTextOptions` exactly per Structure §2:
  `browseShelf({ all, projectRoot? })` (single cache writer) → `loadRunLog({ path? })` once →
  `shelfRows(SHELF_PLAYS, records)` + `homeLedgerLine(auditWalkAway(records))` → `renderHome(...)`.
  House-style header documenting impurity / read-once / single-writer / smoke-only.
- **Step 3 — pure passthrough test** ✅ added the "cache-stability proxy" test to `home.test.ts`
  (board byte-for-byte, no new imports, no BAML). Suite: 882 → **883** pass.
- **Commit 1 gate** ✅ `tsc --noEmit` clean; `bun test` 883/0.
- **Step 4 — wire `cli.ts` browse arm** ✅ lazy-import `homeText`, print `homeText({ all: parsed.all })`.
  `tsc` clean.
- **Step 5 — live proof** ✅ (below).
- **Commit 2 gate** ✅ `bun run check` = `baml:gen + tsc + bun test` → 883/0 green.

## Live proof (AC#3)

`bun run src/cli.ts` printed the fused Home:
```
1. E-007 casting-engine  [Keystone] · 2h/80k · ready
... (board leads)

shelf — 6 playbooks
  1. decompose-epic  ...  161s/227k (measured · 6 runs)
  ... (shelf recedes beneath)

ledger   E1 walk-away 93% (14/15)   └ forward 50% · attested 100%
```
Board leads · six-play shelf receding beneath · provenance-split ledger foot (forward·attested,
E-028) — the DL-6 fusion, instant, no LLM.

**Press contract — byte-for-byte unchanged.** Captured the cache contract (`version` + `stateHash` +
`all` + `actions`, excluding the always-changing `generatedAt`) after the Home render vs. after a plain
`browseShelf({ all:false })` write: identical sha (`907c4db9…`). Home reuses browseShelf's persistence
and never re-writes.

**Press resolution — no regression.** `bun run src/cli.ts 99` → `invalid selection "99": index 99 is
not in 1..4` (validated against the persisted 4-action board before any cast); `bun run src/cli.ts
notanumber` → `unknown command` usage andon. `pressShelf` resolves against the cache `homeText` wrote,
exactly as before.

## Deviations

None. The plan held verbatim.

## Notes for review

- The codebase-memory-mcp the ticket suggested was unreachable this session; coordinates were confirmed
  by direct read instead (all four authoring line numbers verified exact). Documented in research.md.
- `.vend/menu.json` is gitignored runtime telemetry (regenerated each browse) — not committed.
- Ticket frontmatter (`phase`) left untouched per the workflow rule — Lisa advances it from the
  artifacts.
