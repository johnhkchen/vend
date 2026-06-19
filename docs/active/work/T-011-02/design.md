# T-011-02 Design — propose-decompose-chain-and-gesture

Decisions for assembling the concrete propose→decompose chain over `castChain` and exposing a
single-gesture entry. Each grounded in the research; rejected options noted.

## D1 — Where the concrete chain lives: a new `src/play/chain-propose-decompose.ts`

**Decision.** A new module `src/play/chain-propose-decompose.ts` exporting
`castProposeDecomposeChain(opts): Promise<ChainResult>`. It value-imports `castChain`/`PlayStep`
(engine), `proposeEpicPlay` + `assembleProposeEpicInputs` (propose), and `decomposeEpicPlay` +
`assembleInputs` (decompose/project-context), builds the two `PlayStep`s, and delegates to
`castChain`.

**Why.** This is the one site where the two concrete plays depend UP onto the chain primitive —
exactly the seam chain.ts's doc-comments reserve for T-011-02. It is a `src/play/` citizen
(allowed to import the engine + plays); the engine stays acyclic. It mirrors the existing
single-play impure verbs (`castProposeEpic`, `runDecomposeEpic`).

**Rejected.** (a) Adding the chain to `propose-epic.ts` or `decompose-epic.ts` — couples the two
plays to each other through whichever file hosts it; a dedicated module keeps each play
independent. (b) Putting it in the engine — would force the engine to import `src/play/`, breaking
the E-007 acyclic keystone.

## D2 — The adapter: `upstream` epic path → `DecomposeInputs`

**Decision.** Step 2's `adapt` is `async (upstream) => assembleInputs({ epicPath: upstream!,
projectRoot: root })`. Step 1's `adapt` is `() => assembleProposeEpicInputs({ signal, budget,
projectRoot, model, ... })` (ignores upstream — it has none).

**Why.** ProposeEpic's `produced` IS an epic path and `assembleInputs` wants exactly an
`epicPath`; the adapter is the identity thread `upstream → { epicPath: upstream }` plus the
existing impure read. No new transformation logic — we reuse the two real, already-shipped
assemblers. The `upstream!` non-null is safe: `runChain` only calls a non-first step's `cast`
when `decideThread` proved the prior step surfaced a non-empty `produced` (chain-core.ts:53), so
`upstream` is a present, non-empty string by the time step 2's adapt runs. Documented at the call
site rather than re-guarded.

**Rejected.** A bespoke `adaptEpicPath` helper — it would be a one-line wrapper over
`assembleInputs`; inlining the thunk is clearer and the thread is self-evident.

## D3 — Run-log subject for the decompose step: derive from `upstream` (extend `PlayStep.opts`)

The decompose run-log record's `subject` (the `epic` field) should be the **minted epic id**, for
ledger traceability — but that id is only known at runtime (it is the `produced` upstream). Today
`PlayStep.opts: CastOptions` is static, fixed at step construction, before the id exists.

**Decision.** Extend `PlayStep.opts` to `CastOptions | ((upstream: string | undefined) =>
CastOptions)` and resolve it in `castChain` (`typeof s.opts === "function" ? s.opts(upstream) :
s.opts`). The decompose step passes a function that derives `subject` = basename-without-`.md`
of the upstream path (e.g. `…/E-012.md` → `E-012`), which IS the epic id by construction
(`proposeEpicEffect` writes `<minted-id>.md`).

**Why.** It is the *correct* run-log: the two records read `propose-epic`/subject=`<signal>` and
`decompose-epic`/subject=`<minted epic id>` — each play stamped with its true subject. The change
is minimal and safe: `chain.ts` is the untested impure shell with **no existing callers** of
`PlayStep` (T-011-02 is the first), so extending its options type breaks nothing. One ternary in
`castChain`. The function form is purely additive — a static `CastOptions` still works unchanged.

**Rejected.** (a) Setting decompose's `subject = signal` statically — wrong/confusing: the ledger
would label the decompose record with the proposal's signal text, not the epic it decomposed.
(b) Reading the epic file to call `epicIdOf` for the id — unnecessary I/O; the basename of the
minted path is the id deterministically. (c) Threading subject through `adapt`'s return — `adapt`
returns the play's typed inputs `I`, not cast options; conflating them muddies the seam.

## D4 — The gesture: a `vend chain <signal> [--budget <ms>,<tokens>]` CLI subcommand

**Decision.** Add a `chain` command to `cli.ts`: `ParsedCommand` gains `{ cmd: "chain"; signal:
string; budget?: Budget }`; `parseArgs` routes `argv[0] === "chain"` to a new pure `parseChainArgs`.
The signal is the remaining positional token(s) joined with spaces; `--budget` is OPTIONAL. The
`import.meta.main` dispatch lazily imports `castProposeDecomposeChain`, prints one line per cast
step (runId + outcome), prints the halt reason if halted, and exits non-zero on any non-success.

**Why.** The CLI is the established gesture home and its parser is pure + unit-testable
(cli.test.ts). A dedicated subcommand keeps PE-1 pull-discipline structural: **one explicit
signal in, never a board drain** — unlike the shelf press, which resolves a `.vend/menu.json`
selection (a board-shaped gesture). `--budget` optional mirrors the press arm (defaults to the
plays' warranted envelopes); `run` requires budget but `chain` reasonably defaults.

**Rejected.** (a) Wiring the chain into the shelf press — the press is a multi-pick board-drain
shape; forcing a single-signal chain through it fights PE-1 and the menu-cache machinery. The
ticket says "and/or the shelf"; the CLI subcommand satisfies the gesture AC cleanly and is the
lower-risk surface. (Shelf integration can be a later signal.) (b) Reusing `run` with a sentinel
play name — overloads `run`'s `<play> <epic.md>` positional shape confusingly.

## D5 — Budget allocation: optional single `--budget`, else each play's default

**Decision.** If `--budget` is supplied, apply it to BOTH steps. If omitted, each step uses its
play's own inlined default (`proposeEpicPlay.budget` = 30m/16k; `decomposeEpicPlay.budget` =
2h/50k). `castProposeDecomposeChain` takes an optional `budget?: Budget` override.

**Why.** Simple and honest. The plays already carry warranted per-play envelopes; defaulting to
them is the right behavior and needs no per-step flag parsing. A single override covers the common
"cap the whole transaction" intent. The propose step's budget also flows to
`assembleProposeEpicInputs` (its `ProposeEpicOptions.budget` field), satisfied either way.

**Rejected.** Two separate `--budget-propose` / `--budget-decompose` flags — over-engineered for
v1; the per-play defaults already differentiate the envelopes.

## D6 — Proving AC#3 offline: reconstruct the thread from addon-free constituents

The chain module value-imports both plays (BAML addon) → it cannot be `bun test`-imported. So the
test proves the **data thread** end-to-end using only the addon-free pieces the chain composes:

**Decision.** `src/play/chain-propose-decompose.test.ts` (a real-temp-dir test, the
propose-effect.test.ts discipline) proves, with NO model and NO addon:
1. `proposeEpicEffect(card, ctx)` writes `E-0XX.md` and returns `produced` = that path
   (signal→epic).
2. Feeding that exact `produced` into `assembleInputs({ epicPath: produced, projectRoot })` yields
   `DecomposeInputs` whose `.epic` is the **exact minted card content** — "the threaded epic is the
   exact one ProposeEpic minted" (the thread).
3. `materialize(cannedWorkPlan, { storiesDir, ticketsDir })` writes the ticket/story files
   (epic→tickets).
4. The subject-derivation helper maps the minted path → the minted epic id (D3).

**Why.** This proves every real link in signal→epic→tickets offline. The `castChain` glue itself
is already proven by chain-core.test.ts (threading + halt) + the type-checked construction; the
STOP-halts-before-decompose path is `decideThread`/`runChain`, unit-proven in T-011-01 and
re-asserted here at the chain-core level for this ticket's AC. The live signal-in/tickets-out cast
is the human sweep verification (AC#4).

**Rejected.** Mocking `castPlay` to run the real chain module — `castChain` hardwires the real
`castPlay`; faking it would require importing the addon-loading module anyway. The
reconstruction test is the house-pattern-faithful proof.

## Summary of changes

- **Modify** `src/engine/chain.ts`: `PlayStep.opts` accepts a function of `upstream`; resolve in
  `castChain`. (Backward-compatible, no existing callers.)
- **Create** `src/play/chain-propose-decompose.ts`: `castProposeDecomposeChain` + the
  subject-derivation helper.
- **Create** `src/play/chain-propose-decompose.test.ts`: the offline thread proof.
- **Modify** `src/cli.ts`: the `chain` command (pure parse + impure dispatch).
- **Modify** `src/cli.test.ts`: `parseChainArgs` cases.
- **Possibly add** a chain-core test case for "STOP halts before decompose" framed to this ticket.
