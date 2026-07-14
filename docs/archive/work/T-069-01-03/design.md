# Design — T-069-01-03

## Decision summary

Extend `ChainProposeDecomposeOptions` with an optional `agent?: string`, then pass that option only
from the decompose step's adapter into `assembleInputs`. Extend the existing addon-free chain thread
test with a focused supplied/omitted pair that mirrors the production adapter and asserts the
assembled input's property presence. Do not change the chain engine, step count, play options, CLI,
materializer, or validation boundaries.

## Design goals

1. Carry the seat selected at the chain gesture to the decompose effect input.
2. Preserve the exact bare-chain input shape when no seat is selected.
3. Keep the propose step unaware of ticket-routing metadata.
4. Preserve the two-step chain topology and all budget behavior.
5. Prove the caller seam without loading the BAML native addon.
6. Match the existing `after` transport pattern.
7. Stay inside the ticket and story boundaries.

## Option 1 — direct option and adapter threading

Add this field to `ChainProposeDecomposeOptions`:

```ts
readonly agent?: string;
```

Extend the decompose adapter's assembly call:

```ts
assembleInputs({
  epicPath: upstream as string,
  projectRoot: root,
  after: opts.after,
  agent: opts.agent,
})
```

The dependency-provided conditional spread in `assembleInputs` owns the absence rule.

### Benefits

- Changes the one production seam named by the ticket.
- Mirrors the existing `after` path.
- Uses the already-settled `ContextSources.agent` contract.
- Adds no new runtime branch in the chain shell.
- Keeps validation at the effect/write boundary selected by the story.
- Keeps invalid text transportable to the named andon boundary.
- Leaves existing callers source-compatible.
- Leaves the chain shape unchanged.

### Costs

- The addon-free test cannot value-import the production chain module.
- The test must mirror the small adapter expression, as the file already does for epic threading.
- The production/test relationship is verified by focused source review plus the repository gate.

## Option 2 — extract a dedicated addon-free decompose adapter

Create an exported helper in an addon-free module, for example:

```ts
assembleChainDecomposeInputs(upstream, root, opts)
```

The production chain and test could both call that helper directly.

### Benefits

- The test would execute the exact helper used by production.
- It would avoid manually mirroring the adapter object.
- The native-addon boundary would remain intact.

### Costs

- Introduces a new module or expands the budget core with filesystem assembly concerns.
- Creates a public abstraction around a single direct call.
- Couples an addon-free helper to the larger chain option type or requires a second option type.
- Adds indirection without introducing reusable decision logic.
- Conflicts with the existing test convention, which already mirrors this adapter.
- Makes a two-line transport change structurally larger than the behavior warrants.

### Assessment

The exact-helper testing advantage is real, but the repository already documents and accepts the
offline link-proof pattern for this impure shell. There is no branching or transformation to isolate.
Extraction would make the module graph more complex for no independent domain concept.

## Option 3 — import and invoke the full chain in the test

Call `castProposeDecomposeChain({ signal, agent: "codex" })` directly and stub the executor/plays.

### Benefits

- Exercises the public function directly.
- Makes the acceptance wording literal at the call boundary.

### Costs

- Value-imports both concrete plays and generated BAML runtime code.
- Violates the ticket's addon-free test constraint.
- Requires substantial module mocking or dependency injection not present in the codebase.
- Risks exercising budgets, run logs, executors, and effects beyond the intended seam.
- Makes the test slower and less deterministic.
- Could write board output unless every downstream effect is intercepted.

### Assessment

Rejected because addon-free is an explicit acceptance property and an established architectural
boundary of this test file.

## Option 4 — validate and narrow the chain option to known seats

Type the option as `AgentSeat` or call `findUnknownSeat` in the chain before assembly.

### Benefits

- Rejects invalid values earlier.
- Gives known literal values to TypeScript callers.

### Costs

- Moves validation away from the story's named pre-write/effect boundary.
- Would require CLI casts or duplicate runtime validation because CLI text remains a string.
- Risks different behavior between `vend chain` and `vend run decompose-epic`.
- Duplicates the guard use assigned to later tickets.
- Expands this ticket beyond transport.

### Assessment

Rejected. The dependency deliberately defines transport fields as optional strings. A single
write-side guard should own the named unknown-seat andon for every gesture.

## Option 5 — pass the agent through play cast options

Add `agent` to the decompose `PlayStep.opts` object instead of its assembled inputs.

### Benefits

- Keeps it visibly attached to the decompose step.

### Costs

- The materialization effect reads `CastContext.inputs`, not generic cast options.
- Would require unrelated engine/play option changes.
- Would diverge from the established `after` route.
- Could leak routing metadata into logging or executor concerns.
- Does not satisfy `DecomposeInputs.agent` acceptance directly.

### Assessment

Rejected because `DecomposeInputs` is the settled effect-input contract.

## Chosen production design

Option 1 is selected.

### Public option

`ChainProposeDecomposeOptions` gains:

```ts
/** Lisa executor-routing seat ... Only the DECOMPOSE step consumes it. */
readonly agent?: string;
```

The comment will explain:

- it is routing metadata for tickets minted by the gesture;
- it is threaded into decompose input assembly;
- validation and application occur later at the effect boundary;
- omission preserves a bare mint;
- the propose step does not consume it.

### Adapter behavior

Only the second `PlayStep` changes. Its adapter supplies `agent: opts.agent` to `assembleInputs`.
The first step's `assembleProposeEpicInputs` call remains byte-for-byte unchanged.

When supplied:

```text
ChainProposeDecomposeOptions.agent
  → ContextSources.agent
  → assembleInputs conditional spread
  → DecomposeInputs.agent
```

When omitted:

```text
opts.agent === undefined
  → ContextSources contains an undefined value at the call boundary
  → assembleInputs does not spread agent
  → DecomposeInputs has no own agent property
```

The object passed to `assembleInputs` may own an undefined `agent` key, but that object is only the
source contract. The acceptance compatibility contract concerns the assembled `DecomposeInputs`,
whose shape is normalized by the dependency's conditional spread.

## Chosen test design

Add a new test under the existing offline chain describe block. It will use `seedRoot` to create a
real charter and a small epic file, avoiding any model or addon.

Within the test, define a minimal structural option value twice:

```ts
const withAgent = { signal: "route this work", agent: "codex" };
const withoutAgent = { signal: "route this work" };
```

Mirror the production decompose adapter for each:

```ts
assembleInputs({ epicPath, projectRoot: root, agent: opts.agent })
```

Assertions for the supplied case:

- `inputs.agent === "codex"`;
- `Object.hasOwn(inputs, "agent") === true`.

Assertions for the omitted case:

- `inputs.agent === undefined`;
- `Object.hasOwn(inputs, "agent") === false`.

The test will also pin the unchanged chain-relevant input shape by checking both results still carry
the same epic, charter, and project data, or by comparing the omitted keys to the established base
shape. It will not invoke materialization because frontmatter stamping belongs to another ticket.

## Why this proves the chain seam

The test file is already the repository's declared offline proof of the concrete chain links. It
cannot import the native-addon-bearing shell, so it mirrors the production adapter expression. The
new test adds the exact option-to-assembly property that was previously missing, while the source
change makes the same expression in the real second step. Focused review can compare those two
one-line shapes directly.

## Chain-shape invariants

- `steps.length` remains two.
- `steps[0].play` remains `proposeEpicPlay`.
- `steps[1].play` remains `decomposeEpicPlay`.
- The upstream value remains the minted epic path.
- `epicSubjectFromPath` remains unchanged.
- Budget resolution remains unchanged.
- Step cast options remain unchanged.
- Only the decompose adapter sees the routing seat.
- Render/gates remain unaffected because they ignore `agent`.

## Error and validation behavior

- No new error is introduced here.
- No known-seat lookup occurs here.
- An unknown value is transported unchanged.
- Later effect/materialize work must reject it before writing.
- This preserves one consistent error vocabulary across both gestures.

## Scope guard

Do not edit:

- `src/cli.ts`;
- `src/play/decompose-epic.ts`;
- `src/play/materialize.ts`;
- `src/play/agent-seat.ts`;
- engine chain primitives;
- run-log types;
- Lisa-managed ticket frontmatter.

## Verification decision

Run the focused chain test first. Run the dependency's assembly test as a regression check. Then run
`bun run check`, which performs BAML generation, TypeScript checking, and the complete test suite.
Only ticket-owned files will be staged and committed.
