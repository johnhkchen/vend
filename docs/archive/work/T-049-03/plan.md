# T-049-03 — Plan

**Ticket:** branching-worked-example-through-castgraph (S-049-01, E-049)
Ordered, independently-verifiable steps. Testing strategy + verification criteria below.

## Step 1 — Add the router fixture + runner to `graph-example.ts`

Append after the shared-wallet section (graph-example.ts:162):
1. Section banner comment (house style): this is the E-049 conditional-edges worked example; it drives
   the pure `runGraphConcurrent` (the dispatcher `castGraph` delegates to) with recording stubs;
   `castGraph` is predicate-transparent so this proves the end-to-end author path; NO LIVE MODEL.
2. `branchingExample(route: "go" | "stop")` — five `recordingStub`s (R produces `route`; T/"pt",
   TD/"ptd", N/"pn", ND/"pnd"); nodes `[R,T,TD,N,ND]`; edges `R→T when p==="go"`, `R→N when p==="stop"`,
   `T→TD`, `N→ND`. Returns `{ spec, seen }`.
3. `BranchingTrace` interface (`upstreamsSeen` allows `undefined` for never-cast nodes; `result`).
4. `runBranchingExample(route)` — runs `runGraphConcurrent(spec)`, maps `seen[id][0] ?? undefined`,
   returns the trace.

**Verify:** `bun run build` typechecks clean (no unused symbols, types line up). No test yet — the
example must compile before the test references it.

## Step 2 — Add the proof to `graph-example.test.ts`

1. Extend the `./graph-example.ts` import to include `runBranchingExample`.
2. Add `describe("AC (E-049): an authored edge predicate routes the branch; the not-taken subgraph
   skips")` with three tests:
   - **go-route:** cast set `{R,T,TD}`; `T` saw `{R:"go"}`, `TD` saw `{T:"pt"}`; `N`/`ND` undefined +
     in `skipped`; `N` reason `/branch not taken/` & not `/dependent on halted upstream/`; `ND` reason
     `/dependent on halted upstream/`; `outcome==="success"`, `halted===true`; `produced==={TD:"ptd"}`.
   - **stop-route (mirror):** cast set `{N,ND,R}`; `N` saw `{R:"stop"}`, `ND` saw `{N:"pn"}`; `T`/`TD`
     skipped; reasons mirror; `produced==={ND:"pnd"}`.
   - **one declared graph:** `branchingExample("go").spec.edges` and `("stop").spec.edges` have
     identical `from`/`to` topology — only R's produced data differs (declare-once / route-by-data).

**Verify:** `bun test src/engine/graph-example.test.ts` — the new block passes; existing diamond +
shared-wallet blocks still green.

## Step 3 — Full gate

1. `bun run build` — typecheck + bundle clean.
2. `bun test` — FULL suite green (baseline 1159 from T-049-02; expect +3 new ⇒ 1162, exact count
   confirmed at run, not asserted).
3. Confirm the import discipline by inspection: neither graph-example.ts nor graph-example.test.ts
   contains `from "./graph.ts"` (only graph-core.ts / type-only cast.ts).

**Verify:** both commands exit 0; no `graph.ts` value-import anywhere in the two files.

## Testing strategy

- **Unit / deterministic worked example.** Pure stub nodes, no live model, no spawn, no addon — the
  house discipline. The whole proof is a `runGraphConcurrent` run over a predicated stub spec.
- **Oracle-style contract.** Assertions key on the EXISTING reason strings from T-049-01/02
  (`branch not taken`, `dependent on halted upstream`), so the example is pinned to the reference
  semantics and cannot silently drift.
- **Two-direction coverage.** Both `route` values are exercised, proving the predicate is a pure
  data-driven read and the identical graph routes either way — not a hard-coded path.
- **Cascade coverage.** Each branch has a downstream node, so the proof covers the not-taken
  *dependent subgraph* skip (the cascade), not merely the immediate handler.

## Verification criteria (done = all true)

1. `graph-example.ts` exports `branchingExample`, `BranchingTrace`, `runBranchingExample`.
2. `graph-example.test.ts` proves: taken branch cast with routed data; not-taken branch + its subgraph
   in `skipped` with the distinct andons; net output is the taken sink; clean success+halted; mirror
   route; one declared graph.
3. No test value-imports `graph.ts` (discipline holds).
4. `bun run build` + `bun test` both green.

## Risks & mitigations

- **R1 — `recordingStub` records via a closure pushed during cast; under `runGraphConcurrent` casts run
  in `Promise.all`.** Low risk: each stub pushes to its OWN `calls` array (no shared state), and in this
  fixture every node is cast at most once, so there is no ordering hazard. The diamond + shared-wallet
  examples already rely on this under concurrency.
- **R2 — asserting an exact `nodes.size`/skip count couples the test to fixture shape.** Mitigation:
  assert the SET of cast ids and the SET of skipped ids (sorted), not bare counts — reads intentionally
  and survives an incidental node rename.
- **R3 — the "through castGraph" wording invites someone to import graph.ts later.** Mitigation: the
  section banner comment states explicitly WHY the example drives `runGraphConcurrent` (predicate-
  transparency of `castGraph` + the import discipline), so the rationale is on the page, not just here.
- **R4 — reason-string drift in a future refactor.** Out of scope to fix here; the cross-executor
  equality tests in graph-core.test.ts (T-049-02) already guard the strings, and this example adds a
  third consumer that fails loudly if either string changes.

## Out of scope (explicit)

- Any change to `dag-core.ts` / `graph-core.ts` / `graph.ts` — the feature is built.
- A live `castGraph` cast (a metered, spawning proof) — forbidden by the import discipline and an E-046
  out-of-scope concern; the live concurrent shell is proven downstream as the comments note.
- A `SkippedNode.kind` typed discriminant — T-049-01 open concern, deliberately deferred by the epic.
