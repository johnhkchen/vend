# T-046-02 — Plan: implement `runGraph`

Four atomically-committable steps. Each is verifiable; the suite stays green throughout.

## Step 1 — Narrow `NodeCast` in `dag-core.ts` (the anticipated edit)

- Add `export type NodeUpstreams = ReadonlyMap<NodeId, string>;` with its doc.
- Narrow `export type NodeCast = (upstreams: NodeUpstreams) => Promise<RunSummary>;` and rewrite its
  doc (no longer the wide `(...args)` placeholder — it is now the real upstream-collection shape).
- Update the file-header comment line that references `NodeCast`'s wide form, if needed.

**Verify:** `tsc --noEmit` clean; `bun test src/engine/dag-core.test.ts` still 18/18 green (a
0-param fake stays assignable to the 1-param type — no test edit). `grep NodeCast src/` shows no
other consumer (confirmed: only `dag-core.ts`).

**Commit:** `refactor(engine): narrow DagNode NodeCast to its upstream-collection shape (T-046-02)`

## Step 2 — Create `graph-core.ts` (the pure executor)

- Imports: type-only `RunOutcome` (run-log), type-only `RunSummary` (cast), value `decideThread`
  (chain-core), `topoSort`/`DagSpec`/`DagNode`/`NodeId`/`NodeUpstreams` (dag-core).
- Define `SkippedNode`, `GraphResult`.
- Implement `runGraph` per structure.md §"Internal organization":
  1. `topoSort`; cyclic → total refusal (all skipped, `gate-failed`, halted).
  2. Build `inEdges` + `outDegree` over declared endpoints only.
  3. Walk `order`: skip-rule → join-gather → `cast` → `decideThread` → record.
  4. Assemble `outcome` / `halted` / `haltReason` / sink `produced`.

**Verify:** `tsc --noEmit` clean. (No behavior test yet — Step 3.)

**Commit:** `feat(engine): runGraph — the pure DAG executor core (T-046-02)`

## Step 3 — Create `graph-core.test.ts` (fakes-only proof)

Mirror `chain-core.test.ts`: a `summary(outcome, produced?)` builder, a `recordingNode(id, result)`
capturing the `NodeUpstreams` it was cast with (proves threading + join), a `neverNode(id)` that
throws if cast (proves a skip). Import **only** `./graph-core.ts` (+ types) — no spawn, no addon.

Cases:
1. **Linear A→B→C** — B cast with `{A: producedA}`, C with `{B: producedB}`; outcome success;
   `produced` = `{C: …}`; `halted` false.
2. **Fan-out A→{B,C}** — both B and C cast with `{A: producedA}`; two sinks in `produced`.
3. **Join {A,B}→C** — C cast with a **2-entry** map `{A: …, B: …}` (the load-bearing case the
   linear engine cannot express); source A and B cast with **empty** maps.
4. **Diamond A→{B,C}→D** — D joins B and C (`{B: …, C: …}`); single sink D in `produced`.
5. **Halt subgraph (the headline)** — A→B→C with A `gate-failed`: B and C both `skipped`
   (cascade), `nodes` has only A, `halted` true, `haltReason` names A, `outcome` `gate-failed`.
6. **Sibling independence** — fan-out A→{B,C}; B `gate-failed` (skips only B's closure), C still
   runs. Diamond A→{B,C}→D with B failing: D skipped (depends on B), C ran.
7. **Success-no-produced halt** — A succeeds with `produced: undefined` → B skipped; `outcome`
   `success` but `halted` true (distinct andon, mirrors `runChain`).
8. **Empty graph** — `{order:[]}` → vacuous success: empty `nodes`/`skipped`/`produced`, not halted.
9. **Single source** — one node, success+produced → it is the sole sink in `produced`.
10. **Cyclic refusal (totality)** — A↔B: every node `skipped`, `outcome` `gate-failed`, `halted`
    true, nothing cast (a `neverNode` cycle never throws → proves runGraph casts nothing).
11. **Determinism** — fan-out siblings' produced/sink order follows declaration order (topoSort).

**Verify:** `bun test src/engine/graph-core.test.ts` all green; full `bun test` green.

**Commit:** `test(engine): runGraph fan-out/join/diamond/halt-subgraph proofs (T-046-02)`

## Step 4 — Full gate + progress/review

- `bun run check` (baml:gen + `tsc --noEmit` + `bun test`) green — AC#4.
- Finalize `progress.md`; write `review.md`.

**Commit:** `docs(work): T-046-02 progress + review (runGraph)`

## Testing strategy

- **Unit, pure, fakes-only** — the entire AC is provable without a live model (AC#3). `runGraph`'s
  logic *is* the threading/join/fan-out/halt; fake casts returning canned `RunSummary`s exercise
  every branch. No integration test here — live wiring is T-046-03's `castGraph`.
- **Verification criteria per AC:**
  - AC#1 (thread/join/fan-out): cases 1–4 assert the exact `NodeUpstreams` maps captured.
  - AC#2 (per-edge halt, siblings independent, GraphResult shape): cases 5–7, 10.
  - AC#3 (pure, fakes, no live model): the whole file imports only `graph-core.ts`.
  - AC#4 (`check:*` green): Step 4.

## Risks & mitigations

- **Purity regression** — a value import of `cast.ts`/`chain.ts` would pull the executor seam.
  *Mitigation:* `RunSummary`/`RunOutcome` are `import type`; only `decideThread` (pure) is a value
  import, from `chain-core.ts` (type-only-importing). The test importing only `graph-core.ts` is
  the live proof — it would spawn/fail to load an addon otherwise.
- **Cascade correctness** — the "X runs iff all upstreams proceeded" rule must skip the full
  transitive closure, not just direct children. *Mitigation:* topo order guarantees an upstream is
  decided before its node; a skipped upstream is never in `proceeded`, so the skip propagates. Case
  5 (3-deep chain) and case 6 (diamond) prove the closure.
- **Sink mis-identification on dangling edges** — ignored-unknown out-edges could mark a node a
  sink. *Mitigation:* out-of-scope for a validated graph (`validateDag` gates dangling); documented
  as parity with `topoSort`'s unknown-endpoint handling.
