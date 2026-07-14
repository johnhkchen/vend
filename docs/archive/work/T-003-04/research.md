# Research — T-003-04 vend-select-resolve-and-dispatch

Descriptive map of the codebase the press convergence node plugs into. What exists,
where, and the contracts T-003-04 must honor. No solutions here.

## The ticket in one line

`vend <sel>` is the press half of the two-gesture transaction: parse the selection
(T-003-03), resolve the 1-indexed picks against the **persisted** `.vend/menu.json`
(T-003-02 — the same list the user just saw), and dispatch each picked action's
playbook under its warranted budget, in order, each appended to the run log. The only
dispatchable play today is `DecomposeEpic` → `runDecomposeEpic`.

## The seams this ticket converges (all already built)

### 1. `src/cli.ts` — the entry point (co-owned with T-003-02, R4)
- `parseArgs(argv): ParsedCommand` is PURE and tested. Today `ParsedCommand` is
  `run | browse | usage`. Empty argv → `browse{all:false}`; all-`--all` →
  `browse{all:true}`; `argv[0]==="run"` → the static decompose path; everything else →
  `usage`. A bare selection (`1,2`) currently falls through to `usage` *by design,
  until this ticket* (cli.test.ts:44-48 documents the placeholder).
- `parseBudgetArg(s): Budget` is PURE/tested — splits `<ms>,<tokens>`, rejects wrong
  arity / blank / non-integer fields with `RangeError`. Reusable verbatim for the
  press's `--budget` override.
- The `import.meta.main` block is the thin **untested** impure shell: it maps the
  parsed command to an action and an exit code. `browse` lazily
  `await import("./shelf/gather.ts")` (keeps browse deps off the pure-parse path);
  `run` lazily imports `runDecomposeEpic`. Exit map: usage→2, run success→0, any
  non-success→1.

### 2. `src/shelf/select.ts` — the parser (T-003-03, PURE, no imports)
- `parseSelection(s, menuLength): number[]` — comma fields, `a-b` inclusive ranges,
  1-indexed, deduped, **sorted ascending**, whitespace-tolerant. PARTIAL: throws a
  typed `SelectionError` on empty / non-integer / out-of-range / reversed /
  malformed-range. Validates EVERY index against `1..menuLength` before returning, so
  an out-of-range pick is rejected all-or-nothing — naturally "before any dispatch".
- `SelectionError` carries `reason: SelectionErrorReason` (closed union), `field`,
  `input`, and a human `message`. The boundary can `switch` on `reason` or just print
  `.message`.
- Takes `menuLength` as a plain number — never the menu — so this ticket passes
  `cache.actions.length` at the boundary.

### 3. `src/shelf/menu.ts` + `gather.ts` — the persisted menu (T-003-01/02)
- `MenuCache` (menu.ts): `{ version, generatedAt, stateHash, all, actions: Action[] }`.
  `actions` is stored in **display order** so resolution is a direct `actions[i-1]`
  (menu numbers are 1-indexed). `MENU_CACHE_VERSION = 1`.
- `Action`: `{ id (e.g. "E-003"), title, tier, readiness, budget: Budget }`. The
  `budget` is the **warranted envelope** (`budgetForTier`, the press default).
- `gather(opts): Promise<{actions, demand, lisa}>` (gather.ts) — IMPURE: reads
  `demand.md` (absent→`""`) + `lisa status` (absent→`""`), returns the raw strings
  alongside the actions **precisely so a consumer can rehash without re-deriving**
  (T-003-02 review concern #2).
- `stateHash({demand, lisa, all}): string` — PURE FNV-1a fold of the raw inputs + the
  `all` mode. `browseShelf` stamps `cache.stateHash` with it; **this ticket recomputes
  it from freshly-read inputs and compares to detect a materially-stale menu.**
- `MENU_CACHE_FILE = ".vend/menu.json"`; `DEMAND_PATH = "docs/active/demand.md"`.
- Index contract (T-003-02 review concern #1): `cache.actions ===
  visibleActions(rankActions(actions), cache.all)`. The press MUST resolve as a direct
  `actions[i-1]` against the persisted list/mode — never re-filter or re-rank. Bare
  `vend` persists `all:false`; `vend --all` persists `all:true` with **different
  numbering**.

### 4. `src/play/decompose-epic.ts` — the dispatch target (T-002-03)
- `runDecomposeEpic(opts: RunOptions): Promise<RunSummary>` — the single IMPURE
  orchestrator. `RunOptions{ epicPath, budget, projectRoot?, model?, runId?,
  transcriptDir? }`; `RunSummary{ runId, outcome, materialized }`.
- **Streams live to `process.stdout` internally** and **appends exactly one run-log
  record per call** (`appendRunLog`). So the press's per-pick "append to the run log"
  (AC#2) is satisfied simply by calling it once per index — no extra log wiring.
- **BAML addon caveat:** this module value-imports `b` from `baml_client/sync_client`,
  which loads the BAML native addon. That addon makes a `bun test` process flaky
  (memory 20213/20218), so its pure decision core lives in `decompose-epic-core.ts`
  and is tested there. **Any new module that value-imports `decompose-epic.ts` becomes
  test-poison** — its `.test.ts` would load the addon. `import type` is erased and safe.

### 5. `src/budget/budget.ts` — `Budget{timeMs, tokens}` (PURE)
- The `--budget` override and `action.budget` are both `Budget`. `runDecomposeEpic`
  consumes it directly. No work here beyond passing it through.

### 6. `src/log/run-log.ts` — the countable ledger (T-001-04)
- `appendRunLog` is called *inside* `runDecomposeEpic`. The press does not touch it
  directly; "each run appended to the log" is structural via the per-index call.

## Epic file location (the dispatch target path)

Epic specs live at `docs/active/epic/E-###.md` (singular `epic`, confirmed:
`docs/active/epic/E-003.md`). `runDecomposeEpic` wants an `epicPath`. An `Action.id` is
the board id (`E-003`); the press must derive `docs/active/epic/<id>.md` from it.
`runDecomposeEpic` itself re-reads the epic's frontmatter `id:` (`epicIdOf`) for the
log, so the path only needs to *resolve to the file*.

## Constraints & house patterns to honor

- **Pure core / impure shell split.** Every nontrivial decision is a pure, fixtured
  function; only fs/spawn/clock live in an untested shell (cf. gather.ts, run-log.ts,
  decompose-epic.ts). New pure logic (epic-path derivation, staleness compare, run
  planning) must be testable **without loading the BAML addon**.
- **Never act on stale indices** (AC#1, epic "Done looks like"). The menu the user saw
  must equal the menu we resolve against; a board change since the browse → warn
  "re-run vend" and stop, never dispatch.
- **Out-of-range hard-errors BEFORE any dispatch** (AC#3). `parseSelection`'s
  all-or-nothing validation gives this for free if we parse before the dispatch loop.
- **Multi-select is sequential, in order; concurrency out of scope** (AC#2). Ascending
  menu order = `parseSelection`'s returned order.
- **`--all` reveals hidden rows** (AC#3) — but the persisted cache already fixes the
  visible set + numbering for its mode. Pressing in a different `all` mode than the
  browse means a different numbering → a mismatch the staleness check must catch
  (the `all` is folded into `stateHash`).

## Open questions carried into Design

1. Where does the resolve+dispatch impure logic live — extend `cli.ts`, or a new
   `src/shelf/press.ts` mirroring `gather.ts`? (BAML-addon test-poison pushes toward a
   `press-core.ts` pure split + a thin `press.ts` shell.)
2. How is "materially-stale" defined precisely — re-gather + recompute `stateHash` with
   which `all` (the press's, or the cache's)? The `all`-fold makes a mode mismatch a
   staleness too.
3. Does `--budget` override apply to every pick in a multi-select, or per-pick? (Epic:
   "override the default envelope for **this pick**" — one override for the whole press.)
4. Stop-on-first-failure vs run-all in a multi-select? (AC: "each its own budgeted run,
   each appended" — leans run-all, independent picks.)
