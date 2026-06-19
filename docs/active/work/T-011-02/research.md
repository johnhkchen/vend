# T-011-02 Research — propose-decompose-chain-and-gesture

The capstone of E-011: a demand signal → ProposeEpic → an epic card → DecomposeEpic →
stories/tickets, in **one gesture**. T-011-01 shipped the `castChain` primitive and the
`produced` thread; this ticket assembles the *concrete* propose→decompose chain over it and
exposes a gesture. Descriptive map of what exists and where it connects.

## The primitive this ticket consumes (T-011-01, committed d475851)

- `src/engine/chain-core.ts` — the PURE core. `runChain(steps)` loops `ChainStep[]`, threading
  `summary.produced` → the next step's `cast(upstream)`, halting via `decideThread` on any
  non-success OR a success that surfaced no `produced`. Returns `ChainResult { steps[], outcome,
  halted, produced?, haltReason? }`. Fully unit-tested (12 cases, chain-core.test.ts) with
  injected fake casts — no addon, no spawn.
- `src/engine/chain.ts` — the IMPURE shell. `PlayStep<I,O> { play, budget, opts, adapt }` and
  `castChain(steps)`. `castChain` maps each `PlayStep` to a `ChainStep` whose `cast(upstream)`
  does `const inputs = await s.adapt(upstream); return castPlay(s.play, inputs, s.budget, s.opts)`.
  Re-exports the core, so one import (`./chain.ts`) gives the whole surface. **Untested by
  design** — its logic is the pure `runChain`, proven live when a concrete chain is cast (this
  ticket). `adapt(upstream: string | undefined) => I | Promise<I>` is the wiring seam: the first
  step ignores `upstream`; a later step adapts the upstream `produced` into its own typed inputs.

The doc-comments in chain.ts explicitly name THIS ticket as the place the concrete steps + the
epic-path → `epicPath` adapter are assembled, and where the concrete plays depend UP onto the
primitive (the primitive never depends down on `src/play/`).

## The two plays being chained

**ProposeEpic** (`src/play/propose-epic.ts`, addon-loading):
- `proposeEpicPlay: Play<ProposeEpicInputs, EpicCard>` — registered on the shelf-wide `registry`.
- `assembleProposeEpicInputs(opts: ProposeEpicOptions): Promise<ProposeEpicInputs>` — the IMPURE
  input assembler (reads charter, lists ids, builds snapshot). `ProposeEpicOptions { signal,
  budget, projectRoot?, model?, runId?, transcriptDir? }`.
- `castProposeEpic(opts)` — `assemble → castPlay`, subject = `opts.signal`.
- Its effect (`src/play/propose-effect.ts`, **addon-free**) `proposeEpicEffect` mints the
  authoritative id, writes `docs/active/epic/E-0XX.md`, and returns
  `{ ok, detail, artifacts: [path], produced: path }`. **`produced` is the minted epic path** —
  the exact handle this chain threads. `EPIC_DIR = "docs/active/epic"`.

**DecomposeEpic** (`src/play/decompose-epic.ts`, addon-loading):
- `decomposeEpicPlay: Play<DecomposeInputs, WorkPlan>` — registered on `registry`.
- `RunOptions { epicPath, budget, projectRoot?, model?, runId?, transcriptDir? }`.
- `assembleAndCast(play, opts)` — reads the epic via `assembleInputs({epicPath, projectRoot})`,
  casts with subject = `epicIdOf(epic, epicPath)`.
- `assembleInputs` lives in `src/play/project-context.ts` (**addon-free**): `ContextSources
  { epicPath, charterPath?, projectRoot? } → DecomposeInputs { epic, charter, project }`. **This
  is the chain adapter target**: feed the upstream epic path as `epicPath`.
- `epicIdOf(epic, epicPath)` — pulls `id:` from frontmatter, else basename without `.md`.

The seam is exact: ProposeEpic's `produced` (an epic path) is precisely what DecomposeEpic's
`assembleInputs` wants as `epicPath`. No transformation needed beyond `upstream → { epicPath }`.

## The cast spine (shared, unchanged)

`src/engine/cast.ts` `castPlay(play, inputs, budget, opts: CastOptions)` → `RunSummary { runId,
outcome, materialized, produced? }`. It already lifts `eff.produced` onto the summary (T-011-01,
cast.ts:142). Appends **exactly one run-log record per cast** (`appendRunLog`), so "two run-log
records" for a two-step chain is structural, not extra wiring. `CastOptions { subject, projectRoot?,
model?, runId?, transcriptDir?, runLogPath? }`; `subject` is required + non-empty (asserted by
`appendRunLog`).

## The gesture surface

`src/cli.ts` — PURE arg parsing + an `import.meta.main` impure dispatch shell:
- `ParsedCommand` union: `run | browse | select | usage`. `parseArgs(argv)` routes: `[]`→browse,
  `run …`→`parseRunArgs`, else `parseSelectOrBrowse`.
- `parseBudgetArg(s)` parses `<ms>,<tokens>` → `Budget` (reused).
- Dispatch arms lazily import their impure deps (keeps the BAML addon off the pure-parse path)
  and map a non-success outcome to a non-zero exit.
- `cli.test.ts` tests ONLY the pure parsers (never the dispatch / addon).

The shelf press (`src/shelf/press.ts`) is the *other* gesture surface, but it resolves a
selection against `.vend/menu.json` and dispatches `decompose-epic` by name — a board-drain shape
that conflicts with **PE-1 pull-discipline** (one explicit pulled signal). The CLI `chain`
subcommand is the natural home for a single-signal gesture.

## House patterns / constraints that bind this ticket

- **Acyclic deps (E-007 keystone):** `src/play/*` depends UP onto `src/engine/*`; the engine
  never imports `src/play/*`. The concrete chain module is a `src/play/` citizen importing
  `castChain` + the two plays — allowed; the reverse is forbidden.
- **Addon / bun-test discipline (memory 20232):** the BAML native addon allows one call per
  process under `bun test`. Any module that value-imports `b` (propose-epic.ts, decompose-epic.ts)
  must NOT be value-imported by a `bun test`. So the concrete chain module (which imports both
  plays) is **untested-by-import**, exactly like `castProposeEpic` / `runDecomposeEpic` /
  `dispatch.ts` / `press.ts`. Tests prove it via its addon-free constituents + pure cores.
- **Pure-core + impure-shell:** judgment is pure + tested (`runChain`, `decideThread`); the
  impure verb (the new chain function) is thin and proven by composition + live sweep.
- **Returned-data-not-exception:** expected andons (a ProposeEpic STOP) are `ChainResult`
  fields (`halted`, `haltReason`), never throws.
- **`bun run check`** = `baml:gen → tsc --noEmit → bun test`. Plus `check:committed` /
  `check:head`. Baseline after T-011-01: **331 tests pass**. `noUncheckedIndexedAccess` is on.

## Open questions carried into Design

1. Where does the concrete chain live — a new `src/play/chain-propose-decompose.ts`?
2. The decompose step's run-log `subject`: the minted epic id is only known at runtime (it is the
   `produced` upstream). `PlayStep.opts` is static today — does it need to derive from `upstream`?
3. Budget allocation for the gesture: one `--budget` for both steps, or each play's default?
4. How to prove AC#3 offline given the chain module can't be `bun test`-imported (addon).
