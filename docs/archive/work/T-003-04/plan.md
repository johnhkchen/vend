# Plan — T-003-04 vend-select-resolve-and-dispatch

Ordered, independently-verifiable steps. Each step is a clean commit boundary. Testing
strategy is inline per step. Verification gates: `bun run check:typecheck` (tsc exit 0)
and `bun run check:test` (currently **212 pass / 0 fail** — the regression floor).

## Step 1 — pure core: `press-core.ts` + `press-core.test.ts`  *(commit 1)*

**Build.** `src/shelf/press-core.ts` with `EPIC_DIR`, `epicPathFor`, `isMenuStale`,
`planRuns`, and the `PlannedRun` / `PressOpts` / `PressResult` types. Every cross-module
symbol that touches the BAML addon enters via `import type` (critically `RunSummary`).

**Test (`press-core.test.ts`, imports only `press-core.ts`):**
- `epicPathFor("/r", "E-003")` → `/r/docs/active/epic/E-003.md`; nested root.
- `isMenuStale`:
  - fresh inputs reproducing `cache.stateHash` (same demand/lisa/all) → `false`.
  - changed demand → `true`; changed lisa → `true`.
  - mode mismatch: cache stamped `all:false`, press `all:true` → `true` (the fold).
  - `cache.version` ≠ `MENU_CACHE_VERSION` → `true` regardless of hash.
  - Build the fixture `cache.stateHash` by calling the real `stateHash(...)` so the
    test asserts the *contract* (rehash-and-compare), not a frozen hex literal.
- `planRuns`:
  - indices `[1,3]` over a 3-action cache → ids/epicPaths in order; `budget` =
    `action.budget` when no override.
  - `override` budget → every planned run carries the override, not the action budget.
  - input arrays not mutated (frozen-input purity, house pattern).

**Verify.** `bun test src/shelf/press-core.test.ts` green; `tsc --noEmit` clean. No
addon loaded (no `runDecomposeEpic` value import anywhere on this path).

**Risk watch.** Accidentally `import { RunSummary }` (value) instead of `import type` —
would silently load the addon into the test process. Guard: the test file imports
nothing from `decompose-epic.ts`; `press-core.ts` uses `import type` only.

## Step 2 — CLI parse: `cli.ts` parseArgs + `cli.test.ts`  *(commit 2)*

**Build.** Add the `select` arm to `ParsedCommand`; add `parseSelectOrBrowse(argv)` and
route the non-`run`, non-empty tail through it (subsuming the old browse-all line).

**Test (`cli.test.ts`, still addon-free — no `press.ts` import):**
- `["1,2,4-6"]` → `{cmd:"select", selection:"1,2,4-6", all:false}`.
- `["1","2","4-6"]` → `selection:"1,2,4-6"` (token join).
- `["1","--all"]` → `{cmd:"select", selection:"1", all:true}` *(replaces the old
  usage assertion at line 47)*.
- `["1,2"]` → `cmd:"select"` *(replaces the old usage assertion at line 46)*.
- `["1,2","--budget","100,200"]` → select with `budget:{timeMs:100,tokens:200}`.
- `["frobnicate"]` → `{cmd:"usage", error:"unknown command: frobnicate"}` *(unchanged —
  shape gate rejects)*.
- `["--all"]` → `{cmd:"browse", all:true}` *(unchanged — now via the new helper)*.
- `["1,2","--budget","nope"]` → `cmd:"usage"` (malformed budget surfaces).
- `["--budget","1,2"]` (no selection) → `cmd:"usage"` (missing selection).

**Verify.** `bun test src/cli.test.ts` green; tsc clean. Confirm the existing
`run`/`browse`/`parseBudgetArg` cases all still pass (no regression to those arms).

## Step 3 — impure shell: `press.ts`  *(commit 3, with step 4)*

**Build.** `src/shelf/press.ts` per structure.md: read+parse cache (→ `no-menu` on
throw or non-array `actions`), `gather` for fresh inputs, `isMenuStale` (→ `stale`),
`parseSelection` (→ `bad-selection` on `SelectionError`, re-throw otherwise),
`planRuns`, sequential `runDecomposeEpic` loop, `dispatched`. `export *` the core.

**Test.** None added — `pressShelf` is the untested impure shell (house pattern: its
logic *is* the pure core + thin I/O, exactly as `browseShelf`/`dispense` are untested).
Proven by the Step 5 smoke.

## Step 4 — CLI dispatch arm: `cli.ts` `import.meta.main`  *(commit 3, with step 3)*

**Build.** Add the `select` arm after the `browse` arm: lazy `await
import("./shelf/press.ts")`, `switch (r.kind)` → stderr andon + exit code per D6.

Steps 3 & 4 commit together: the shell and its sole caller are one functional unit, and
the lazy import means neither is exercised by any test — they are only meaningful
together at runtime.

## Step 5 — smoke + full gate  *(no commit; validation only)*

Run against the live board (deterministic, no LLM for browse/parse/staleness):
1. `bun run src/cli.ts` → prints the menu, writes `.vend/menu.json`.
2. `bun run src/cli.ts 99` → out-of-range → stderr `SelectionError` message, exit 2,
   **no dispatch** (AC#3).
3. `bun run src/cli.ts 1` immediately after (1) → not stale → dispatches
   `runDecomposeEpic` on the resolved epic (this spawns `claude`; for the smoke,
   confirm it *reaches* dispatch — i.e. resolves + begins a run / logs — rather than
   completing a full LLM run; a `bad epicPath` would surface here).
4. Edit `demand.md` (or rely on the time-independent hash) then `vend 1` → `stale` →
   stderr "re-run vend", exit 1, no dispatch (AC#1).
5. Remove `.vend/menu.json`, `vend 1` → `no-menu`, exit 1.

Then the **full gate**: `bun run check:typecheck` (exit 0) and `bun run check:test`
(≥ 212 + new tests pass, 0 fail). Record counts in `progress.md`.

## Testing strategy summary

| Unit | How tested | Why |
|---|---|---|
| `epicPathFor`, `isMenuStale`, `planRuns` | unit (press-core.test.ts) | pure, addon-free; the leverage point |
| `parseArgs` select routing | unit (cli.test.ts) | pure; the user-facing contract |
| `pressShelf` orchestration | smoke only | impure shell = pure core + thin I/O (house pattern) |
| `import.meta.main` select arm | smoke only | process-level effects (exit/stderr), untested by convention |

## Rollback / blast radius

All new code is additive behind a new `select` command; the `run` and `browse` arms are
untouched except for the parseArgs restructure (covered by their existing + updated
tests). The only behavioral change to existing surface is the two placeholder
cli.test.ts assertions (intended, D2). No runtime dependency added; `.vend/menu.json`
stays gitignored.
