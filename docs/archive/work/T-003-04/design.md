# Design — T-003-04 vend-select-resolve-and-dispatch

Decisions, with rationale, grounded in Research. Each carries the rejected
alternatives and why.

## D1 — Module placement: a new `press.ts` + `press-core.ts`, not all in `cli.ts`

**Decision.** The resolve+dispatch logic lands in a new `src/shelf/press.ts` (the
impure orchestrator) with its pure helpers split into `src/shelf/press-core.ts`.
`cli.ts` gains only a `select` command in `parseArgs` and a thin dispatch arm in
`import.meta.main` that **lazily** `await import("./shelf/press.ts")`.

**Why.** This mirrors the browse half exactly: `cli.ts`'s `browse` arm lazily imports
`gather.ts`. Two forces make it mandatory rather than stylistic:
1. **BAML addon test-poison** (Research §4). `press.ts` must value-import
   `runDecomposeEpic`, which loads the native addon. Any test importing it would load
   the addon into the `bun test` process (flaky, memory 20213). The
   `decompose-epic` / `decompose-epic-core` split is the established remedy — repeat it:
   pure helpers in `press-core.ts` (BAML-free, unit-tested), impure shell in `press.ts`.
2. **`cli.test.ts` must stay addon-free.** Because the `select` arm only *lazily*
   imports `press.ts` inside `import.meta.main`, importing `cli.ts` in its test never
   pulls the addon — identical to how `browse` keeps `gather.ts` off the parse path.

**Rejected.** (a) *All in `cli.ts`* — would force `cli.ts` to top-level value-import
`runDecomposeEpic`, poisoning `cli.test.ts`. (b) *Only `press.ts`, no core split* —
`press.test.ts` would load the addon. The split is the only way to fixture the pure
logic.

## D2 — `parseArgs` recognizes `select` by selection-shape, preserving `unknown command`

**Decision.** Add `{ cmd: "select"; selection: string; all: boolean; budget?: Budget }`
to `ParsedCommand`. After the empty/`run` branches, a helper parses the remaining argv:
strips `--all` (boolean) and `--budget <v>` (reusing `parseBudgetArg`), collecting the
rest as positional tokens. A token is a selection only if it matches
`/^[\d\s,-]+$/`; positional tokens are **joined with `,`** into the selection string.

**Why.**
- The shape gate keeps the existing contract: `vend frobnicate` → `usage{error:"unknown
  command: frobnicate"}` (cli.test.ts:35 still passes), while `vend 1,2,4-6` → select.
  The gate is deliberately cheap — full validation (range, order, malformed) stays in
  `parseSelection` against `menuLength`, which `parseArgs` does not have.
- Joining positional tokens with `,` makes both `vend 1,2,4-6` (one token) and
  `vend 1 2 4` (shell-split) resolve to `"1,2,4"`. `parseSelection` splits on `,` and
  trims, so both round-trip; dedup/sort already absorb the friendliness.
- `--budget` is optional for select (unlike `run`, where it is required) — the press
  defaults to the action's warranted envelope.

**Rejected.** (a) *Any non-`run` first token → select* — turns `frobnicate` into a
non-integer `SelectionError`, losing the clearer "unknown command" and breaking the
test. (b) *Single-token selection only* — needlessly rejects `vend 1 2 4`.

This **updates** cli.test.ts:44-48 (the placeholder "falls through to usage") to assert
the new select behavior — an intended contract change this ticket owns.

## D3 — Staleness = recompute `stateHash` with the **press's** `all`, compare to cache

**Decision.** `pressShelf` re-runs `gather()` for fresh `{demand, lisa}`, then computes
`stateHash({demand, lisa, all: pressAll})` and compares to `cache.stateHash`. Any
mismatch → `stale` → warn "re-run vend" and stop. A `cache.version !==
MENU_CACHE_VERSION` is likewise treated as stale.

**Why.** `browseShelf` stamped `cache.stateHash = stateHash({demand, lisa, cache.all})`.
Recomputing from freshly-read inputs is the honest "is the menu I'm about to act on
still the menu you saw?" check (AC#1). Using the **press's** `all` (not the cache's) is
deliberate and elegant: because `all` is folded into the hash, pressing in a *different*
mode than you browsed (`vend --all` then `vend 1`, whose numberings differ) also yields
a mismatch → "re-run vend". One comparison catches **both** failure modes — a board
change *and* a mode mismatch — and always errs toward re-running, never toward acting
on a stale/mis-numbered list (T-003-02 review concern #2). `gather` returns the raw
strings exactly for this rehash-without-re-derive use.

**Cost.** An extra `lisa status` spawn + `demand.md` read on every press. Accepted: it
is the price of an honest freshness guarantee; trusting the cache would defeat AC#1.

**Rejected.** (a) *Recompute with `cache.all`* — would silently allow pressing the
all:true menu with all:false numbering. (b) *Compare `generatedAt` age / mtime* — time
is not staleness; a 1-second-old menu can be stale and an hour-old one fresh. The hash
is the only sound signal. (c) *Trust the cache, no re-gather* — violates AC#1.

## D4 — Resolve as a direct `cache.actions[i-1]`; dispatch every pick via `runDecomposeEpic`

**Decision.** After `parseSelection(selection, cache.actions.length)` returns validated
ascending indices, a pure `planRuns(cache, indices, root, override?)` maps each `i` to
`{ id, epicPath: <root>/docs/active/epic/<id>.md, budget: override ?? action.budget }`.
The impure loop calls `runDecomposeEpic` once per planned run, **in order**, collecting
the `RunSummary[]`.

**Why.**
- Direct `actions[i-1]` honors the index contract (Research §3) — no re-rank/re-filter;
  the persisted list *is* the numbering the user saw.
- The only play today is `DecomposeEpic` (ticket + epic), and its target is an epic
  file, so `epicPathFor(root, id)` is the whole mapping. Pure and trivially fixtured.
- `runDecomposeEpic` already streams live and appends one log record per call, so
  AC#2's "each run appended to the run log" is structural — the press adds no log code.
- `parseSelection` validating all indices first means an out-of-range pick throws
  *before* `planRuns`/dispatch — AC#3's "hard-errors before any dispatch" for free.

**Rejected.** A play registry / dispatch table — premature; the epic scopes "today:
`DecomposeEpic`". One mapping, documented as the extension seam.

## D5 — `--budget` overrides every pick; run-all (no stop-on-first-failure)

**Decision.** A single `--budget` overrides the envelope for **all** picks in the press
(`override ?? action.budget` for each). A non-success outcome on one pick does **not**
abort the remaining picks; every pick runs, each logged. Process exits 0 iff *all* picks
succeed, else 1.

**Why.** The epic phrases override as "the default envelope for **this pick**" — one
override per press gesture, not per-index syntax. Each pick is "its own budgeted run,
each appended to the log" (AC#2) — independent, so a gate-fail on pick 1 shouldn't
silently swallow picks 2-3. Exit semantics mirror the existing single-run arm
(success→0, else→1), generalized with "every".

**Rejected.** Stop-on-first-failure — would make a multi-select non-deterministic in
what gets logged and contradicts "each its own run". Per-index budget syntax — not in
the mini-language (T-003-03) and out of scope.

## D6 — A discriminated `PressResult` carries the outcome; `cli.ts` maps it to exit codes

**Decision.** `pressShelf` returns
`{kind:"no-menu", cachePath} | {kind:"stale"} | {kind:"bad-selection", error} |
{kind:"dispatched", runs}`. `cli.ts`'s arm switches: `no-menu`/`stale` → stderr andon +
exit 1; `bad-selection` → stderr `error.message` + exit 2 (a caller input error, like
`usage`); `dispatched` → print one recap line per run, exit 0 iff all success.

**Why.** Keeps `pressShelf` returning data (testable shape, no `process.exit` buried in
it) and concentrates the process-level effects (stderr, exit codes) in the one untested
shell — the house split. `bad-selection` → exit 2 aligns a malformed/out-of-range
selection with the existing `usage` exit code (both are "you typed it wrong"); `stale`
and `no-menu` → exit 1 are andons ("the world isn't ready; re-run vend").

**Rejected.** Throwing from `pressShelf` for stale/no-menu — control flow by exception
for *expected* terminal states; the codebase models expected terminals as values
(budget's `exhausted`, gates' STOP), thrown only for genuine bugs.

## Decision summary

| # | Decision | Key reason |
|---|---|---|
| D1 | `press.ts` + `press-core.ts`, lazy import from `cli.ts` | BAML addon test-poison; mirror browse |
| D2 | `select` by `/^[\d\s,-]+$/` shape, join tokens with `,` | keep `unknown command`; friendly multi-token |
| D3 | staleness = rehash with press's `all` vs `cache.stateHash` | one check catches board-change AND mode-mismatch |
| D4 | direct `actions[i-1]`, pure `planRuns`, per-pick dispatch | index contract; validate-before-dispatch free |
| D5 | one `--budget` for all picks; run-all; exit 0 iff all ok | epic's "this pick"; independent runs |
| D6 | discriminated `PressResult`, `cli.ts` maps to exit codes | data out of the shell; expected terminals are values |
