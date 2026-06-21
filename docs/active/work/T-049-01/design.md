# T-049-01 — Design

Goal: an optional predicate on `DagEdge` over the upstream's `produced`; `runGraph` fires only edges
whose predicate holds; a not-taken edge leaves its `to`-node's in-edge unsatisfied so that node — and
its dependent subgraph — cascade-skip, with the *direct* not-taken node carrying a distinct
"branch not taken" andon.

## Decision 1 — Where the predicate lives and its shape

**Chosen:** an optional `when?: (produced: string) => boolean` field on `DagEdge`, with a named alias
`EdgePredicate = (produced: string) => boolean`.

- The predicate reads the **`from` node's `produced` string** — the exact edge payload (`RunSummary.
  produced`) the runner already threads. It returns `true` ⇒ this edge fires; `false` ⇒ it does not.
- Optional, so every existing `{from,to}` edge is unchanged (back-compat) and `validateDag`/`topoSort`,
  which read only `from`/`to`, are structurally unaffected.

**Rejected — predicate over the whole `RunSummary`:** would couple the edge model to the cast result
shape and let a predicate branch on `outcome`/`actuals`. But a non-success upstream already *halts* (it
never proceeds, so there is no `produced` to branch on) — branching is only meaningful over a
*successful* upstream's payload. `produced: string` is the minimal, honest input and matches
`NodeUpstreams`' value type.

**Rejected — predicate on the node (out-edge selector returning a set of to-ids):** centralizes the
decision on the upstream, but the epic's model is per-edge ("only out-edges whose predicate holds"),
and a per-edge predicate composes naturally with the existing per-in-edge halt check (Decision 3). A
node-level selector would be new infrastructure, not reuse.

**Rejected — a separate parallel `predicates` map on `DagSpec`:** splits an edge's identity across two
collections; an inline optional field keeps the edge self-describing.

## Decision 2 — Predicate semantics: downstream-driven, not upstream-driven

The epic phrases it as "fire only the out-edges whose predicate holds." The runner already decides each
node by inspecting its **in-edges** (the halt check). These are equivalent: out-edge `from→to` fires
iff `from` proceeded AND `when(from.produced)`; node `to` runs iff **all** its in-edges fired. The
downstream-driven formulation is exactly the existing halt machinery, so the predicate becomes a
*refinement of in-edge satisfaction* rather than a new dispatch pass — the reuse the epic demands.

An in-edge is now classified into three states (was two):

| upstream proceeded? | `when` present & holds? | in-edge state |
|---|---|---|
| no | — | **halted** (upstream failed / produced nothing / was skipped) |
| yes | no `when`, or `when` true | **fired** (satisfied) |
| yes | `when` false | **not-taken** |

A node casts iff every in-edge is **fired**. Any halted or not-taken in-edge ⇒ skip.

## Decision 3 — Two distinct skip reasons, with halt precedence

A skipped node's andon depends on *why* its in-edges were unsatisfied:

- **any halted in-edge** ⇒ the existing reason `skipped — dependent on halted upstream <causes>`
  (unchanged — reuses `haltReasonOf` enrichment).
- **no halted in-edge, ≥1 not-taken** ⇒ the new reason
  `skipped — branch not taken: upstream '<id>' produced a result this edge's predicate rejected`.

**Precedence (halt > not-taken):** if a node has *both* a halted and a not-taken in-edge, the halt wins
the reason. Rationale: a halt is the louder andon (something upstream actually failed); a not-taken is a
*successful* branch decision. The primary AC case (mutually-exclusive fan-out) has exactly one not-taken
in-edge and no halts, so it always gets the branch-not-taken reason. Documented in code.

`blockedBy` becomes the union of halted + not-taken upstreams (the from-nodes of every unsatisfied
in-edge) — its doc widens from "did not proceed" to "in-edge did not fire (halted or not-taken)".

**Rejected — a third top-level enum/kind on `SkippedNode`:** the AC asks only for a *textually distinct
reason*, and every existing consumer reads `reason` as a string (the cyclic/halt paths do). A new
structured field is scope the epic explicitly defers ("reuse … not new infrastructure"). The distinct
*string* is the contract; a typed kind can come later if a consumer needs to switch on it.

## Decision 4 — The cascade below a not-taken node reuses the halt path verbatim

A not-taken node is pushed to `skipped` and **never added to `proceeded`**. Its downstreams therefore
see an upstream not in `proceeded` ⇒ classified **halted** ⇒ they cascade-skip with the existing
"dependent on halted upstream '<id>' (upstream skipped)" reason — byte-identical to the current
failed-upstream cascade. I deliberately do **not** add not-taken nodes to `haltReasonOf` (parity: the
current code does not add *halted-upstream-skipped* nodes there either; both fall back to
"(upstream skipped)"). This keeps the change to one localized classification, no new cascade plumbing.

## Decision 5 — A throwing predicate is not caught (parity with `cast`)

`runGraph` awaits injected `cast` thunks without try/catch; a throw propagates (the totality guarantee
is about the *pure logic* given well-behaved thunks). A predicate is an injected thunk of identical
character, so it is **not** wrapped either — consistency over a bespoke catch, and it keeps the change
minimal. A defensive `producedAll.get(from) === undefined` guard (proceeded ⇒ produced present, so
unreachable) treats a missing produced as not-firing rather than throwing — staying total on the one
branch the type system cannot rule out.

## Decision 6 — `topoSort` and `validateDag` unchanged

A predicated edge still imposes the structural ordering `from` before `to` (we cannot know statically
which branch runs), so `topoSort` must keep counting it as a dependency — no change. `validateDag` reads
only `from`/`to`, so a predicated spec validates `ok` automatically; the AC's "validateDag still ok" is
secured by a test, not a code change.

## Net change surface

- `dag-core.ts`: add `EdgePredicate` type + optional `when?` on `DagEdge` (+ doc). No logic change.
- `graph-core.ts` `runGraph` only: `inEdges` stores `DagEdge[]` (not `NodeId[]`); the halt check becomes
  the three-way classification + dual reason. ~20 lines, localized.
- `graph-core.test.ts`: a new `describe` block for conditional edges; import `validateDag`.
- **Untouched:** `runGraphConcurrent`, `topoSort`, `validateDag`, `decideThread`, `castPlay`, `graph.ts`.
</content>
