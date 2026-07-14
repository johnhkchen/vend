# Review — T-069-01-03

## Outcome

T-069-01-03 is complete against its acceptance criterion.

The propose-to-decompose chain now accepts an optional `agent` seat and threads it only into the
decompose step's `assembleInputs` call. An addon-free offline thread test proves that `codex` reaches
`DecomposeInputs.agent`, while omission produces no `agent` own property. The chain remains two
steps with the same plays, budgets, upstream handle, and logging behavior.

Implementation commit:

```text
68ea098 feat(play): thread agent through chain gesture (T-069-01-03)
```

## Files modified

### `src/play/chain-propose-decompose.ts`

Added the optional public option:

```ts
readonly agent?: string;
```

Its documentation states that the value is Lisa ticket-routing metadata, is consumed only by the
decompose step, and is validated/applied downstream.

Extended the second step's adapter from:

```ts
assembleInputs({ epicPath, projectRoot, after })
```

to the equivalent source object including:

```ts
agent: opts.agent
```

No proposal-step code changed.

### `src/play/chain-propose-decompose.test.ts`

Added a type-only import of `ChainProposeDecomposeOptions`. Because it is type-only, the runtime test
continues to avoid the concrete chain module and its BAML native-addon imports.

Extended the test file's documented offline proof to name the agent transport link.

Added one fixture-backed test covering both sides of the compatibility contract:

- chain options containing `agent: "codex"`;
- chain options omitting `agent`.

The test mirrors the production step-two adapter by feeding `opts.agent` into `assembleInputs`.

## Files created

- `docs/active/work/T-069-01-03/research.md`
- `docs/active/work/T-069-01-03/design.md`
- `docs/active/work/T-069-01-03/structure.md`
- `docs/active/work/T-069-01-03/plan.md`
- `docs/active/work/T-069-01-03/progress.md`
- `docs/active/work/T-069-01-03/review.md`

The first five artifacts are included in implementation commit `68ea098`. This Review artifact is
the final workflow handoff.

## Files deliberately not modified

- `docs/active/tickets/T-069-01-03.md`
- `src/cli.ts`
- `src/play/decompose-epic.ts`
- `src/play/materialize.ts`
- `src/play/project-context.ts`
- `src/play/agent-seat.ts`
- chain engine modules
- run-log modules

The ticket's `phase` and `status` fields were not updated. Lisa owns those transitions.

## Acceptance evaluation

### Supplied chain seat

Criterion:

> `castProposeDecomposeChain({signal, agent:"codex"})`'s decompose step assembles
> `DecomposeInputs.agent === "codex"` via `assembleInputs`.

Result: pass.

Evidence:

- `ChainProposeDecomposeOptions` accepts the optional string.
- The actual decompose adapter supplies `agent: opts.agent` to `assembleInputs`.
- The addon-free test uses the public option type with `agent: "codex"`.
- The test mirrors the actual adapter expression.
- It observes `routed.agent === "codex"`.
- It observes `Object.hasOwn(routed, "agent") === true`.

### Omitted chain seat

Criterion:

> omitting `agent` leaves the field absent on the assembled inputs.

Result: pass.

Evidence:

- The option remains optional.
- The test constructs a valid option object without `agent`.
- The same adapter-shaped call supplies `undefined` to `ContextSources`.
- Dependency-provided `assembleInputs` uses an `undefined`-checked conditional spread.
- The test observes `bare.agent === undefined`.
- It observes `Object.hasOwn(bare, "agent") === false`.
- It deep-compares the object to the exact legacy `epic`, `charter`, `project` shape.

### Chain shape unchanged

Criterion:

> chain shape unchanged.

Result: pass.

Evidence:

- The `steps` array still has exactly two entries.
- Step one remains `proposeEpicPlay`.
- Step two remains `decomposeEpicPlay`.
- The minted epic path remains the upstream thread handle.
- Step budget resolution is untouched.
- Step cast options are untouched.
- Run-log subject derivation is untouched.
- Existing offline path-thread, materialize, and subject tests pass.

## Test coverage

### Focused command

```bash
bun test src/play/chain-propose-decompose.test.ts src/play/agent-seat.test.ts
```

Result:

- 7 pass;
- 0 fail;
- 34 expectations.

Coverage includes:

- canonical known-seat membership;
- direct input assembly with `codex`;
- direct omission shape;
- chain option to decompose-input transport;
- exact produced epic path threading;
- existing offline epic-to-ticket materialization;
- existing decompose subject derivation.

### Full repository gate

```bash
bun run check
```

Result:

- BAML code generation passed;
- TypeScript `--noEmit` passed;
- 1,604 tests passed;
- 1 test skipped under its documented missing-`dist/` precondition;
- 0 tests failed;
- 4,822 expectations ran across 109 test files.

### Diff hygiene

`git diff --check` passed for every ticket-owned path before commit.

## Addon-free proof quality

The new test does not invoke the full `castProposeDecomposeChain` runtime because that module
value-imports both concrete plays and the generated BAML runtime. This is the existing documented
boundary of `chain-propose-decompose.test.ts`, not a new test gap introduced by this ticket.

The proof instead combines:

1. a production diff showing the second-step adapter passes `opts.agent`;
2. a type-checked option fixture using the production public interface;
3. the exact adapter-shaped `assembleInputs` call;
4. direct assertions on the assembled `DecomposeInputs` value and own-property shape.

This is consistent with the file's existing offline proof of the minted epic-path thread.

## Architectural review

### Pure core / impure shell

No new decision logic was added. The chain remains an impure composition shell, while the optional
output-shape decision remains in the already-tested `assembleInputs` seam. A new helper would have
added indirection without a reusable domain decision.

### Executor boundary

The field is routing metadata carried toward ticket materialization. Vend does not dispatch to
Codex or Claude here. Lisa remains the executor, preserving N4 and the story's honest boundary.

### Compatibility

- Existing callers need no changes.
- Omission produces the legacy assembled object shape.
- Proposal inputs remain unchanged.
- Prompt rendering and gates remain unchanged.
- No new default seat is invented.
- Unknown strings remain transportable to the later named write-side andon.

## Open concerns and limitations

No critical issue is open for this ticket.

Story-level work intentionally remains:

- materialize must stamp and validate the seat (`T-069-01-02`);
- direct decompose-run options and effect relabeling remain (`T-069-01-04`);
- CLI parsing and dispatch to both gestures remain (`T-069-01-05`);
- the deferred live metered routing cast remains human-authorized and outside this story's fixture
  proof.

Until those dependent tickets land, the public CLI does not expose this option and no ticket file is
stamped by this change alone. That is the planned DAG boundary, not incomplete acceptance here.

The addon-free test mirrors the production adapter rather than invoking its native-addon-bearing
module. A future dependency-injection redesign could make a literal full-shell unit possible, but
that would be disproportionate to this transport-only ticket and is not required by current house
patterns.

## Concurrent-work boundary

The worktree contained Lisa-managed and parallel-ticket changes throughout execution, including
active ticket files, provenance, E-069 story/epic files, and T-069-01-02 artifacts. None were staged
or committed by this ticket. Commit `68ea098` contains only the two scoped source files and this
ticket's first five workflow artifacts.

## Final assessment

Green. The implementation is narrow, source-compatible, addon-free in its proof, fully gated, and
inside the story contract. No human attention is required for a defect in T-069-01-03; review should
focus on the explicit mirrored-adapter test boundary and then allow Lisa to advance the artifact.
