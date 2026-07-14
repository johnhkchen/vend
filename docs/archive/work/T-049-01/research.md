# T-049-01 — Research

**Ticket:** predicate-on-dagedge-sequential-rungraph (story S-049-01, epic E-049 conditional-dag-edges)
**Phase scope:** the SEQUENTIAL `runGraph` only. The concurrent `runGraphConcurrent` is T-049-02; the
end-to-end worked example through `castGraph` is T-049-03. This ticket is the reference semantics the
other two mirror.

## What exists today (descriptive)

### The edge model — `src/engine/dag-core.ts`

- `DagEdge` is purely structural: `{ readonly from: NodeId; readonly to: NodeId }` (lines 60–63). A
  directed dependency `from → to`; a node's IN-edges define its upstreams (≥2 = JOIN), its OUT-edges
  its downstreams (≥2 = FAN-OUT). **There is no predicate today — every declared edge fires
  unconditionally.**
- `DagSpec` = `{ nodes, edges }` (lines 66–69). `NodeId` is a transparent `string` alias.
- `NodeUpstreams = ReadonlyMap<NodeId, string>` (line 36) — a node's upstreams' `produced` refs keyed
  by from-node, threaded into its `cast`.
- `validateDag(spec)` (lines 174–219) accumulates three named offense kinds — `duplicate-node`,
  `dangling-edge`, `cycle` — and **only ever reads `edge.from` / `edge.to`**. It is total (returns
  offenses, never throws). It does not look at any other edge field, so an added optional field is
  invisible to it.
- `topoSort(spec)` (lines 110–162) — pure/total/deterministic Kahn's algorithm; an edge contributes a
  structural dependency from `from`→`to` **regardless of any runtime branch selection**. Declaration
  order is the tie-break (byte-identical result per spec).

### The sequential runner — `src/engine/graph-core.ts` `runGraph` (lines 107–211)

The exact spine this ticket extends. Current control flow:

1. `topoSort` → on `{cycle}`, total refusal (nothing cast, every node skipped, `gate-failed`). Else
   `order`.
2. Build `byId` (first-declared per id), and **`inEdges: Map<NodeId, NodeId[]>`** (line 134) — this
   stores **only the from-node id per in-edge, discarding edge identity** — plus `outDegree`.
3. Walk `order`. For each node:
   - **HALT check** (lines 158–165): `blockedBy = upstreamIds.filter(from => !proceeded.has(from))`.
     If any upstream did not proceed → push a `SkippedNode` with reason
     `skipped — dependent on halted upstream <causes>` and `continue` (never cast). This is the cascade
     root reuse the epic calls for.
   - **JOIN** (lines 169–174): gather every upstream's `produced` into a `NodeUpstreams` map.
   - **CAST** (line 178), record summary, track `firstFail`.
   - **FAN-OUT + thread gate** (lines 184–190): `decideThread(summary)` (reused from chain-core.ts) —
     on proceed, add to `proceeded` and record `producedAll.set(id, produced)`; else record
     `haltReasonOf.set(id, reason)` for downstream andons.
4. **SINKS** (lines 195–200): out-degree-0 nodes' `produced` = the graph's net output(s).
5. Return `GraphResult` (lines 203–210).

### The skip record — `SkippedNode` (lines 54–61)

`{ id, blockedBy: readonly NodeId[], reason: string }`. `blockedBy` is documented as "the in-edge
upstream(s) that did not proceed". `reason` is the human andon. The cascade enriches each cause with
`haltReasonOf` when the upstream was a cast node that did not proceed, else `'X' (upstream skipped)`.

### The thread gate — `src/engine/chain-core.ts` `decideThread` (lines 49–57)

Pure. A node *proceeds* iff (a) `outcome === "success"` AND (b) it surfaced a non-empty `produced`.
Two distinct non-proceed andons (non-success outcome; success-but-no-produced). **Reused verbatim** by
both graph executors — proceeded ⇒ a threadable `produced` exists in `producedAll`.

### The cast result — `src/engine/cast.ts` `RunSummary` (lines 100–120)

`{ runId, outcome, materialized, produced?, actuals? }`. `produced` is the **string** edge payload a
predicate will read. A hand-built fake (no `actuals`) is valid — the test discipline below relies on it.

### The concurrent twin (OUT of scope here, context for T-049-02)

`runGraphConcurrent` (lines 260–429) is the wave dispatcher: same `inEdges`/`proceeded`/`producedAll`/
`haltReasonOf`/`skipped` machinery, plus E-048's shared-wallet `authorizeWave`/`debitWave` and a
budget-stop skip kind. It already re-keys `skipped` to topo order (line 417). T-049-02 mirrors this
ticket's predicate firing there; **I must not touch it in T-049-01** beyond leaving it correct.

## Test discipline (the house pattern)

- `src/engine/graph-core.test.ts` imports **only** `./graph-core.ts` + `./dag-core.ts` (both
  type-only-import the impure `cast.ts`), so the test process loads no native addon and spawns
  nothing — an ordinary pure-function test. **NO live model.**
- Helpers already present: `summary(outcome, produced?)`, `recordingNode(id, result)` (captures each
  `NodeUpstreams` it was cast with as a plain object), `neverNode(id)` (throws if cast — proves a halt
  skipped it), `edge(from,to)`, `spec(nodes,edges)`. The existing fan-out / diamond / halt-cascade /
  cyclic / determinism cases (lines 49–209) all construct edges via `edge(from,to)` returning
  `{from,to}` — an added **optional** field keeps every one valid.
- `src/engine/dag-core.test.ts` proves `topoSort`/`validateDag` purely; it constructs edges the same
  way. Adding an optional field cannot regress it.

## Constraints & assumptions

- **Purity/totality:** the pure core must stay total on malformed/cyclic specs. Injected thunks
  (`cast`) may throw and `runGraph` does **not** catch them — a throw propagates (totality is about the
  pure logic given well-behaved thunks). A predicate is an injected thunk of the same character.
- **Determinism:** all ordering is declaration-order via `topoSort`. Predicate evaluation must not
  introduce nondeterminism (it is a pure read over an already-deterministic `produced`).
- **Back-compat:** an edge with no predicate must behave byte-for-byte as today (unconditional fire).
- **Reuse, not reinvent (epic spine):** the branch-not-taken skip must reuse the existing
  `skipped` + dependent-subgraph cascade — only the *direct* not-taken node needs a new, distinct andon.
- **Distinct andon (AC):** the not-taken reason must contain "branch not taken" and be textually
  distinct from "dependent on halted upstream".
</content>
</invoke>
