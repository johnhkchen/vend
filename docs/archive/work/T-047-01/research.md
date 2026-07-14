# T-047-01 — Research: build & cast the real-play graph

Descriptive map of the substrate this ticket builds on. No solutions here — that is Design.

## The shape the ticket asks for

```
survey (project → board) ──┬─→ propose-epic (signal #1 → epic)  ──┐
                           └─→ propose-epic (signal #2 → epic)  ──┴─→ capture-note (both epics → note)
        FAN-OUT (2 proposes run CONCURRENTLY)                       JOIN (multi-upstream)
```

The graph substrate (E-046) already exists and is proven with **stub** nodes. What is missing is a
**real-play** `castGraph` caller — the graph analog of `chain-propose-decompose.ts` (which is to
`castChain` what this ticket's new module is to `castGraph`).

## The graph substrate (E-046 — what we wire onto)

- **`castGraph(nodes, edges)`** — `src/engine/graph.ts:89-105`. The impure shell. Maps each
  `PlayNode` → a `DagNode` whose `cast` is `adapt(upstreams) → resolve opts → castPlay(play, inputs,
  budget, opts)` (the `castChain` thunk, generalized to the join map), then runs
  `runGraphConcurrent`.
- **`runGraphConcurrent`** — `src/engine/graph.ts:115-246`. PRIVATE wave dispatcher: each pass
  `Promise.all`s every currently-runnable ready node, settles, threads `produced` to downstreams,
  skips the dependent subgraph of any non-proceeding node. Reuses `topoSort` (ordering) +
  `decideThread` (per-edge halt gate). Assembles `GraphResult` in **topo order** so the result is
  deterministic despite concurrent settle. **This is where the two proposes run concurrently.**
- **`PlayNode<I,O>`** — `src/engine/graph.ts:68-74`: `{ id: NodeId; play: Play<I,O>; budget: Budget;
  opts: NodeOptions; adapt: (upstreams: NodeUpstreams) => I | Promise<I> }`.
  - `NodeOptions` (`graph.ts:55`) = `CastOptions | ((upstreams: NodeUpstreams) => CastOptions)` —
    static, or derived from upstreams (a join node names its run-log `subject` from a threaded ref).
- **`NodeUpstreams`** — `src/engine/dag-core.ts:36` = `ReadonlyMap<NodeId, string>`: upstream
  `produced` refs **keyed by from-node id**. Source ⇒ empty; linear ⇒ 1 entry; **JOIN ⇒ many**.
- **`GraphResult`** — `src/engine/graph-core.ts:61-68`: `{ nodes: Map<id,RunSummary>; skipped:
  SkippedNode[]; outcome; halted; produced: Map<id,string>; haltReason? }`. `produced` = the SINK
  (out-degree-0) nodes' refs. `castGraph` re-exports the whole pure surface (`graph.ts:46`).
- **`validateDag` / `topoSort`** — `src/engine/dag-core.ts:174 / :110`. Total, pure. The cycle gate.

**Purity rule (load-bearing):** `graph.ts` value-imports `castPlay`, so **no `bun test` may
value-import it** (the `chain.ts` discipline). A real-play caller that value-imports the plays
inherits the same rule.

## The four plays we wire as nodes

All four are registered `Play<I,O>` entries cast through the one generic `castPlay`
(`src/engine/cast.ts:128`). Each play module value-imports `b` (the BAML addon), so each is
addon-loading. Their assemble helpers + effects are addon-free.

| Node | Play | Inputs | Assemble helper | Effect `produced` |
|---|---|---|---|---|
| survey | `surveyPlay` `survey.ts:79` | `SurveyInputs {project, charter}` `survey-effect.ts:45` | `assembleSurveyInputs(opts)` `survey.ts:120` | staged board path `docs/active/pm/staged/survey-board.md` (`surveyBoardEffect` `survey-effect.ts:116`, fixed stem `BOARD_STEM`) |
| propose-1 / propose-2 | `proposeEpicPlay` `propose-epic.ts:94` | `ProposeEpicInputs {signal, charter, project, existingEpicIds}` `propose-effect.ts:56` | `assembleProposeEpicInputs(opts)` `propose-epic.ts:139` | minted epic path `docs/active/epic/E-0XX.md` (`proposeEpicEffect` `propose-effect.ts:75`) |
| capture-note | `captureNotePlay` `note.ts:68` | `NoteInputs {topic, project}` `note-core.ts:21` | `assembleNoteInputs(opts)` `note.ts:106` | note path `docs/active/notes/<slug>.md` (`captureNoteEffect`) |

Budgets (the play defaults, the live-spend envelope, P7): survey `30m / 300k`; propose `30m / 150k`
each; note `10m / 8k`. Worst-case ≈ `608k` tokens, the two proposes overlapping in wall-clock.

## The thread handles (how nodes connect)

- `RunSummary.produced` (`cast.ts:101-120`) is lifted off `EffectResult.produced` only when the
  effect lands (`cast.ts:260`). A STOP/halt threads nothing → `decideThread` halts the downstream.
- **Fan-out source:** survey's `produced` = the staged board path. Both propose nodes read it from
  their `NodeUpstreams` (keyed `survey`), open the file, and `parseBoardSignals` it.
- **`parseBoardSignals(md)`** — `src/play/work-core.ts:65`. PURE/TOTAL. Scans for `vend chain
  "<signal>"` lines (the `## Pull these` block the staged board emits, `survey-effect.ts:78-97`),
  returns the quoted signals **in file order = ranked order** (IA-1). `< 2` signals ⇒ the honest
  degrade case named in the ticket.
- **Join:** capture-note reads BOTH propose nodes' `produced` (epic paths) from its multi-entry
  `NodeUpstreams` and builds a topic referencing both minted epics.
- `epicSubjectFromPath` (`chain-propose-decompose.ts:65`) = `basename(path).replace(/\.md$/,"")` —
  the path → epic-id derivation a join topic / run-log subject reuses.

## The template caller — `chain-propose-decompose.ts`

`src/play/chain-propose-decompose.ts:81-128`. The CONCRETE `castChain` caller. Each `PlayStep` is
`{ play, budget, opts, adapt }`; source `opts` is static `CastOptions`, downstream `opts` is the
function form deriving `subject` from `upstream`; `adapt` pulls the upstream ref and calls the play's
`assemble*` helper. Budget precedence via `resolveStepBudgets` (`per-step ?? uniform ?? play
default`). It value-imports the plays — the one site the concrete plays depend UP onto the primitive
(E-007 acyclic). **The real-play graph module is the exact graph-scale analog.**

## Test discipline (how wiring is proven without a live model)

- **Pure-core tests inject fake casts, never `castPlay`.** `chain-core.test.ts` /
  `graph-example.test.ts` import only the pure cores + a stub `DagSpec`; `castGraph`/`castChain` are
  never exercised (they'd spawn). `summary(outcome, produced?)` builds a canned `RunSummary`
  (`actuals?` optional ⇒ omittable); `recordingStub(id, produced)` (`graph-example.ts:28`) records
  the `NodeUpstreams` a node saw.
- **`graph-example.test.ts:20-39`** proves the diamond fan-out/join: `upstreamsSeen.D ===
  {B:"pb",C:"pc"}` (the two-upstream JOIN) via the pure `runGraph`.
- **Offline real-link test** (`chain-propose-decompose.test.ts`) does NOT import the addon-loading
  caller; it drives the addon-free links (`proposeEpicEffect`, `assembleInputs`) against a temp-dir
  root and re-implements `epicSubjectFromPath` inline. The template for proving a real-play graph's
  edges offline.
- **The impure shells are deliberately untested** (`chain.ts:14`, `graph.ts:24`).

## Entry point

No `src/bin`/`src/cli` dir; `src/cli.ts` is the one CLI, each verb a lazy-imported dispatch arm
under `import.meta.main` (`cli.ts:558`). `package.json` has no per-verb bin scripts. The probes
(`src/probe/run-*.ts:143` etc.) and `attest-intervention.ts:96` show the established **standalone
`import.meta.main` runnable** pattern — `bun run <file>.ts` — which the ticket's "small entry"
matches without touching `cli.ts`.

## Constraints / assumptions surfaced

- Two propose nodes share ONE play but need DISTINCT `NodeId`s (`castGraph` keys by node id).
- The LIVE cast mutates the real board (real minted epics + a real note) and spends real tokens —
  authorized by the human running `lisa loop`, bounded by the per-node budgets (P7). `lisa validate`
  must be clean after (E-043 idempotent-mint guard means a retry adopts, never orphans).
- An `adapt` that throws makes `Promise.all` reject → `castGraph` throws (not an honest degrade). The
  `< 2 signals` degrade must therefore route through the gate machinery, not an exception.
- The unit test must be addon-free: it cannot value-import the real-play caller. The pure adapter
  logic must be extractable into an addon-free core to be tested deterministically.
