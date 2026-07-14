# T-046-01 — Research

**Ticket:** typed-graph-model-and-toposort (story S-046-01, epic E-046)
**Phase:** Research — descriptive map of what exists, where, and how it connects. No solutions.

## The thing being generalized: the linear chain

The engine's only non-trivial composition primitive today is the LINEAR chain, split across two
files in the canonical **pure-core ⊥ impure-shell** house pattern:

- `src/engine/chain-core.ts` — the PURE core. Exports `ChainStep` (`{ cast: (upstream: string |
  undefined) => Promise<RunSummary> }`), `decideThread(summary) → ThreadDecision`, `ChainResult`,
  and `runChain(steps) → Promise<ChainResult>`. Imports are **type-only** (`RunSummary` from
  `cast.ts`, `RunOutcome` from `../log/run-log.ts`), erased under `verbatimModuleSyntax`. It spawns
  nothing — the `cast` thunks are injected; the core owns sequencing + threading + the halt gate.
- `src/engine/chain.ts` — the IMPURE shell. Exports `PlayStep<I,O>`, `StepOptions`, and
  `castChain(steps)`. Builds each step's `cast` thunk (`adapt → castPlay`) and delegates to
  `runChain`. Value-imports `castPlay` (which pulls the executor seam), so it is kept out of the
  pure core's import graph.
- `src/engine/chain-core.test.ts` — proves the pure core with FAKE casts: a `summary()` helper
  builds canned `RunSummary`s; `recordingStep` captures the `upstream` each step was cast with;
  `neverStep` throws if cast (proving a halt skipped it). No addon, no spawn — an ordinary
  `bun test` pure-function test.

### The chain's shape and why it is a *path* graph

`runChain` (`chain-core.ts:90`) walks a `ChainStep[]` sequentially: `upstream` starts `undefined`,
each step is cast with the previous step's `produced`, and `decideThread` gates the transition to
the next step. This is structurally a **path graph** — each step has exactly one upstream and one
downstream. The thread payload is a single `produced` STRING (`upstream: string | undefined`), never
a typed play or input. That single-string thread is the exact limitation T-046-02/03 will
generalize (a join needs *several* upstreams); this ticket (T-046-01) generalizes only the *shape*
— from an implicit list to an explicit typed node/edge graph.

### The halt discipline (mirrored, not reused, here)

`decideThread` (`chain-core.ts:49`) returns `{ proceed, reason? }` and keeps the two non-proceed
reasons DISTINCT (a non-success outcome vs. a success that surfaced no `produced`) so each is a loud
andon, never a silent stall. This is the discipline T-046-01's `validateDag` mirrors: distinct,
named offenses, total (never throws), refuse loudly. T-046-01 does NOT run anything, so it reuses no
halt logic — it only echoes the "distinct named refusal" style.

## What each edge carries: `RunSummary.produced`

`RunSummary` lives in `src/engine/cast.ts:101`. Relevant fields:

- `outcome: RunOutcome` — the cast's terminal outcome.
- `produced?: string` — the artifact reference a chain threads into the next play (set only on a
  materialized cast whose effect surfaced one).
- `materialized`, `runId`, `actuals?` — not relevant to the pure graph model.

`RunOutcome` (in `src/log/run-log.ts`) is the vocabulary halts key on: `success`, `gate-failed`,
`timed-out`, `budget-exhausted`, `id-collision`, `missing-capability`. T-046-01 imports
`RunSummary` **type-only** (it is referenced only in the `cast` member's signature — same as
`chain-core.ts`).

## The cast member's signature — explicitly deferred

The ticket is precise: `DagNode = { id: NodeId; cast: (...) => Promise<RunSummary> }`, and "the
cast's exact input signature — how it receives upstream `produced` refs — is **T-046-02's
concern**; here a node is `{id, cast}`." So for T-046-01 the `cast` field's parameter list is a
placeholder the model must not over-specify. The chain's `ChainStep.cast` takes `(upstream: string |
undefined)`; T-046-02 will generalize this to a *collection* of upstreams. T-046-01 needs the node
to be type-parameterizable or to use a deferred/opaque cast signature so it does not lock in the
single-upstream shape T-046-02 must replace.

## The purity discipline this module must hold

From `chain-core.ts`'s header and tsconfig (`strict`, `noUncheckedIndexedAccess`,
`verbatimModuleSyntax`):

- Every import is a TYPE (erased). No `fs`, clock, network, `process`, or native addon.
- `noUncheckedIndexedAccess` means array indexing yields `T | undefined` — every `nodes[i]` /
  `edges[i]` / map lookup must be guarded (see `chain-core.ts:96` `if (step === undefined) break;`).
- Functions are TOTAL: `validateDag` returns offenses, never throws; `topoSort` returns either an
  `order` or a `cycle`, never throws and never hangs on a cyclic graph.

## Toolchain & verification

- Bun + TypeScript. `bun test` (`check:test`), `tsc --noEmit` (`check:typecheck`). The ticket's
  bar is `bun run check:*` green — i.e. typecheck + the full test suite.
- Tests colocate as `*.test.ts` next to source (`chain-core.test.ts`), import `bun:test`
  (`describe`, `expect`, `test`).

## Naming & placement conventions observed

- Engine composition primitives live in `src/engine/`, pure core named `*-core.ts`, impure shell
  the bare name, tests `*-core.test.ts`.
- The chain established `runChain`/`castChain`, `ChainStep`/`PlayStep`, `ChainResult`. The graph's
  parallel names (per ticket + epic): `DagNode`/`DagEdge`/`DagSpec`, `validateDag`, `topoSort`;
  T-046-02 adds `runGraph`, T-046-03 adds `castGraph`. T-046-01 owns the model + validation +
  toposort ONLY.

## Constraints & assumptions surfaced

1. **No new file collision** — there is no `dag-core.ts` today; T-046-01 creates it fresh. The
   chain files are untouched (T-046-02 generalizes their *logic* into the new core, not by editing
   them).
2. **Deterministic tie-break is required** — the ticket mandates a stable order (declaration order)
   so fan-out siblings are reproducible. This rules out any toposort that depends on map iteration
   order without an explicit tie-break.
3. **Cycles detected, not run** — per E-046 out-of-scope: cycles are refused with the offending
   nodes, never executed, never hung. `topoSort` returning `{ cycle }` and `validateDag` flagging a
   cycle offense are two surfaces of the same fact (research note for Design: avoid duplicating the
   cycle algorithm — one detector, two presentations).
4. **The `cast` signature is forward-coupled to T-046-02** — over-specifying it here forces a churn
   edit in the next ticket; under-specifying loses type safety. Design must resolve this tension.
5. **Empty graph is vacuous** — like the empty chain (a vacuous success no-op), the empty `DagSpec`
   validates clean and topoSorts to an empty order.

## Test matrix the ticket mandates (for Plan)

linear path · fan-out (1→2) · join (2→1) · diamond (fan-out then join) · disconnected graph ·
cycle (rejected) · dangling edge (rejected) · duplicate node id (rejected) · empty graph (vacuous).
