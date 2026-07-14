# Plan — T-003-02 gather-persist-and-vend-entry

Ordered, independently-verifiable steps with a testing strategy. Each step is small
enough to commit atomically. Verification criteria are explicit.

## Testing strategy

- **Pure surface = unit tests** (`gather.test.ts`), house discipline: plain fixtures,
  `toEqual` for exact arrays, frozen-input purity, golden hashes. Every pure branch
  covered (tiers, done/blocked/ready, no-epic drop, empty input).
- **Impure verbs** (`gather`, `browseShelf`, `writeMenuCache`) = NOT unit-tested
  (precedent: `assembleInputs`, `runDecomposeEpic`). Proven by a manual smoke (step 5)
  against the real `demand.md` + `lisa status`, inspecting the written `.vend/menu.json`.
- **CLI parse** = unit tests for the new `browse` branch; the `import.meta.main` shell
  stays the thin untested boundary.
- **Gate (AC#4):** `bun run check:typecheck` exit 0 and `bun run check:test` all-green
  after every code step; no regressions in the existing suite (~185 tests).

## Step 1 — Pure surface of `gather.ts` (TDD)

Write `gather.test.ts` first, then `gather.ts`'s constants + pure functions:
`TIER_BUDGET`, `kebab`, `epicOf`, `fnv1a`, `budgetForTier`, `deriveReadiness`,
`parseDemandSignals`, `parseLisaDoneEpics`, `signalsToActions`, `stateHash`. No
imports of `node:fs` yet — pure only.

- **Verify:** `bun test src/shelf/gather.test.ts` green; `tsc --noEmit` clean.
- **Commit:** `T-003-02: pure gather surface — demand/lisa parsers, tier→budget, stateHash`.
- **Risk watch:** the `parseDemandSignals` row filter — pin with a fixture that
  includes the header row, a `|---|` separator, a tier-less prose line, and a
  no-epic kaizen row, asserting exactly which rows survive.

## Step 2 — Impure verbs of `gather.ts`

Add `gather`, `writeMenuCache`, `browseShelf` and the `node:fs/promises` +
`Bun.spawn` code. `gather` tolerates a missing `demand.md` (→ `""`) and a failed
`lisa` spawn (→ `""`). `browseShelf` stamps `generatedAt`/`stateHash`, persists
`visibleActions(ranked, all)`, renders from the same `ranked`.

- **Verify:** `tsc --noEmit` clean; existing suite still green (no new tests here).
- **Commit:** `T-003-02: impure gather/browseShelf/writeMenuCache — persist .vend/menu.json`.
- **Risk watch:** `Bun.spawn` stdout capture + non-throwing failure path — wrap in
  try/catch; a missing/erroring `lisa` must yield `""`, never reject `gather`.

## Step 3 — `cli.ts` browse branch

Extend `ParsedCommand` with `browse`; add the empty-argv and `--all` cases to
`parseArgs` ahead of the usage fallthrough; dispatch `browse` in `import.meta.main`
via a lazy `import("./shelf/gather.ts")`, printing `menu` and exiting 0. Add
`cli.test.ts` cases for the parse branch.

- **Verify:** `bun test src/cli.test.ts` green (new + existing); `tsc` clean. Confirm
  `run decompose-epic …` parsing is byte-for-byte unchanged.
- **Commit:** `T-003-02: bare \`vend\` browse entry — gather → render → persist → print`.
- **Risk watch:** don't shadow the `run` path or the future selection path — `browse`
  matches ONLY empty argv or all-`--all`; everything else falls through unchanged.

## Step 4 — Manual smoke against the live board

Run `bun src/cli.ts` and `bun src/cli.ts --all` from the repo root. Confirm: a
numbered menu prints instantly (no LLM/network); `.vend/menu.json` exists with
`version`, an ISO `generatedAt`, a non-empty `stateHash`, the right `all`, and
`actions` matching the printed rows 1:1; `--all` reveals hidden rows and renumbers.
Re-run and confirm `stateHash` is stable across runs (board unchanged) and
`generatedAt` advances.

- **Verify:** observed output matches; `.vend/menu.json` is well-formed JSON.
- **No commit** (telemetry is gitignored); note results in `progress.md`.

## Step 5 — Full gate + progress

`bun run check:typecheck` and `bun run check:test` from clean. Update `progress.md`
with completion + any deviations.

- **Verify:** typecheck exit 0; full suite green. AC#1–AC#4 satisfied.
- **Commit:** fold the `progress.md`/artifacts in with step 3, or a trailing docs commit.

## Atomic-commit map

| Commit | Contents | Green gate |
|---|---|---|
| 1 | `gather.ts` pure + `gather.test.ts` | unit + typecheck |
| 2 | `gather.ts` impure verbs | typecheck + suite |
| 3 | `cli.ts` browse + `cli.test.ts` | unit + typecheck + suite + smoke |

## Verification criteria (done = all true)

- `src/shelf/gather.ts` reads `demand.md` + `lisa status` into `Action[]`, pure
  shaping fully unit-tested (**AC#1**).
- Bare `vend` does gather → `rankActions` → `renderMenu` → write `.vend/menu.json` →
  print, no LLM, instant (**AC#2**).
- `MenuCache` carries `generatedAt` + `stateHash` so T-003-04 can detect staleness
  (**AC#3**).
- `bun run check:test` / `check:typecheck` green; **P2** advanced (**AC#4**).
- Index contract honored: `MenuCache.actions === visibleActions(ranked, all)`, the
  same filter+mode `renderMenu` used (T-003-01 review note 1).

## Risks & mitigations

- **demand.md prose drift** breaks row parsing → tolerant parser (skip bad rows,
  never throw) + a fixture pinning the filter. Menu degrades, `vend` never crashes.
- **`lisa` absent/changed output** → `gather` swallows spawn failure to `""`;
  `parseLisaDoneEpics("")` is `[]`, so the menu still renders from demand alone.
- **cli.ts overlap with T-003-04** (R4 edge) → keep the `browse` branch additive and
  narrow so T-003-04's selection branch slots in beside it without conflict.
- **Budget defaults are guesses** → centralized `TIER_BUDGET` const with a
  calibration note; one edit when run-log data lands (demand.md's stated plan).
