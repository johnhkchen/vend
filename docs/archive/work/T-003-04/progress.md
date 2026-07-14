# Progress — T-003-04 vend-select-resolve-and-dispatch

Implementation tracking against plan.md. Status: **complete** — all steps done, gates
green, smoke-verified.

## Steps

| Step | What | Status | Commit |
|---|---|---|---|
| 1 | `press-core.ts` + `press-core.test.ts` (pure helpers) | ✅ | commit 1 |
| 2 | `cli.ts` parseArgs `select` + `cli.test.ts` | ✅ | commit 2 |
| 3 | `press.ts` (impure shell) | ✅ | commit 3 |
| 4 | `cli.ts` `import.meta.main` select arm | ✅ | commit 2 (with parse) |
| 5 | smoke + full gate | ✅ | — |

Note: the `import.meta.main` select arm (step 4) landed in commit 2 alongside the
parseArgs change rather than commit 3 — both are `cli.ts` edits and committing the file
once is cleaner. The lazy `import("./shelf/press.ts")` means the arm is inert until
`press.ts` exists, so ordering is safe either way.

## What was built

- **`src/shelf/press-core.ts`** (PURE, BAML-free): `epicPathFor(root,id)`,
  `isMenuStale(cache,fresh,pressAll)`, `planRuns(cache,indices,root,override?)`; types
  `PlannedRun`, `PressOpts`, `PressResult`; const `EPIC_DIR`. `RunSummary` imported
  type-only — the linchpin keeping the module (and its test) addon-free.
- **`src/shelf/press-core.test.ts`**: 11 fixture tests. `isMenuStale` fixtures build
  `cache.stateHash` by calling the real `stateHash(...)`, asserting the rehash-compare
  contract rather than a frozen hex literal.
- **`src/shelf/press.ts`** (IMPURE shell): `pressShelf(opts)` — read+validate cache
  (→`no-menu`), re-gather (→`stale`), `parseSelection` (→`bad-selection`), `planRuns`,
  sequential `runDecomposeEpic` loop (→`dispatched`). Re-exports the core.
- **`src/cli.ts`**: `select` arm in `ParsedCommand`; `parseSelectOrBrowse` +
  `parseRunArgs` split out of `parseArgs`; `SELECTION_SHAPE` gate; lazy-import select
  dispatch arm with the `PressResult`→exit-code map.
- **`src/cli.test.ts`**: replaced the two T-003-04 placeholder assertions with 7 select
  cases (single/multi-token, `--all`, `--budget`, unknown-command, malformed budget,
  missing selection).

## Deviations from plan

**None material.** The only adjustment is the step-4 commit grouping noted above (both
`cli.ts` edits in one commit). No design decision changed; no helper signatures moved.

## Gate results

- `bun run check:typecheck` → **exit 0** (clean).
- `bun run check:test` → **229 pass / 0 fail** / 399 expect() calls, 15 files
  (baseline was 212 — +11 press-core, +6 net new cli select cases).
- `press-core.test.ts` runs addon-free (no `decompose-epic.ts` value import on its path).

## Smoke (live board, deterministic paths)

1. `vend` → renders `1. E-002 ci-cd-structural-backstop …` + `(+1 hidden)`, writes
   `.vend/menu.json` (`stateHash: 12fad8c4`, `all:false`). exit 0.
2. `vend 99` → `invalid selection "99": index 99 is not in 1..1`, **exit 2, no
   dispatch** (AC#3 validate-before-dispatch).
3. `vend a` → `unknown command: a` + usage, exit 2 (shape gate, not a press).
4. `vend 1 --all` (cache is `all:false`) → `menu is stale … re-run \`vend --all\``,
   **exit 1, no dispatch** — the mode-mismatch staleness via the `all` fold (AC#1).
5. `vend 1` with no cache → `no menu at …/.vend/menu.json — run \`vend\` first`, exit 1.
6. Dispatch target resolution: `E-002` → `docs/active/epic/E-002.md` (confirmed to
   exist). The full `runDecomposeEpic` launch is the same seam proven live by T-002-04;
   not re-run here (it would spawn a real LLM session and materialize E-002's board) —
   resolution correctness is unit-tested (`planRuns`) + the path resolves to a real file.

`.vend/menu.json` regenerated after the smoke (gitignored; not committed).
