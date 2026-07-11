# Structure — T-069-01-03

## Change inventory

### Modified production file

- `src/play/chain-propose-decompose.ts`

### Modified test file

- `src/play/chain-propose-decompose.test.ts`

### Created workflow artifacts

- `docs/active/work/T-069-01-03/research.md`
- `docs/active/work/T-069-01-03/design.md`
- `docs/active/work/T-069-01-03/structure.md`
- `docs/active/work/T-069-01-03/plan.md`
- `docs/active/work/T-069-01-03/progress.md`
- `docs/active/work/T-069-01-03/review.md`

### Files not changed

- `docs/active/tickets/T-069-01-03.md`
- `src/cli.ts`
- `src/play/project-context.ts`
- `src/play/agent-seat.ts`
- `src/play/decompose-epic.ts`
- `src/play/materialize.ts`
- `src/engine/chain.ts`
- `src/engine/chain-core.ts`
- `src/log/run-log.ts`

## Production module boundary

`src/play/chain-propose-decompose.ts` remains the impure composition root for the concrete
propose-to-decompose chain. It continues to own:

- the public chain invocation option shape;
- project-root resolution;
- funded default lookup;
- per-step budget resolution;
- construction of the two heterogeneous play steps;
- adaptation of the proposal's produced path into decompose inputs;
- invocation of the generic chain engine.

No responsibility moves between modules.

## Public interface change

`ChainProposeDecomposeOptions` gains one optional property:

```ts
readonly agent?: string;
```

### Meaning

- One Lisa executor-routing seat for all tickets minted by this chain gesture.
- Transported only to the decompose step.
- Applied and validated by downstream effect/write logic.
- Omitted means no routing metadata.

### Compatibility

- Existing object literals remain valid because the field is optional.
- No return type changes.
- No overload changes.
- No exported function name changes.
- No default value is introduced.
- No compile-time union is introduced.

## Interface placement

Place `agent` directly after `after` in `ChainProposeDecomposeOptions`.

Rationale:

- Both are effect-only metadata consumed by decompose.
- Both affect ticket materialization rather than proposal rendering.
- Both are optional gesture-level values.
- Their adjacency makes the chain's transport surface reviewable.

The documentation comment should distinguish executor routing from the unrelated projection-seat
concept elsewhere in the repository.

## Step-one boundary

The first `PlayStep` remains unchanged:

```text
signal
  → assembleProposeEpicInputs
  → proposeEpicPlay
  → produced epic path
```

It must not receive `agent` because:

- an epic card has no ticket-routing frontmatter;
- the story routes tickets, not proposal execution;
- only the decompose effect materializes tickets;
- keeping it absent prevents unrelated prompt and logging changes.

## Step-two boundary

The second `PlayStep` remains the sole consumer of the new option.

Before:

```ts
assembleInputs({
  epicPath: upstream as string,
  projectRoot: root,
  after: opts.after,
})
```

After:

```ts
assembleInputs({
  epicPath: upstream as string,
  projectRoot: root,
  after: opts.after,
  agent: opts.agent,
})
```

The callback remains asynchronous. The upstream cast remains unchanged. No wrapper or new helper is
introduced.

## Data flow

```text
castProposeDecomposeChain options
  ├─ signal ────────────────> propose input assembly
  ├─ budgets ───────────────> step budget resolution
  ├─ model/intervened/etc. ─> step cast options
  ├─ after ─────────────────> decompose ContextSources
  └─ agent ─────────────────> decompose ContextSources
                                  │
                                  v
                              assembleInputs
                                  │
                                  v
                             DecomposeInputs.agent?
```

The chain engine remains unaware of the added field.

## Presence semantics

The chain shell passes `opts.agent` as a source value. `assembleInputs` owns output normalization:

```ts
...(src.agent !== undefined ? { agent: src.agent } : {})
```

Therefore:

| Chain option | Source value | Assembled own key | Assembled value |
|---|---|---:|---|
| `agent: "codex"` | `"codex"` | yes | `"codex"` |
| omitted | `undefined` | no | property access yields `undefined` |

This ticket does not alter the distinction between a missing value and an explicitly supplied empty
string. Downstream validation owns invalid-value handling.

## Chain topology

The `steps` array remains structurally identical:

```text
index 0: ProposeEpic
  upstream: none
  output thread: minted epic path

index 1: DecomposeEpic
  upstream: minted epic path
  assembled inputs: epic + charter + project + optional after + optional agent
```

No step is inserted, removed, or reordered.

## Test module boundary

`src/play/chain-propose-decompose.test.ts` remains the addon-free offline link proof. It continues to
avoid importing `src/play/chain-propose-decompose.ts` because that module loads the concrete plays and
BAML runtime.

The test file already owns:

- temporary project setup;
- charter seeding;
- proposal effect execution;
- produced-path threading into `assembleInputs`;
- materialization proof;
- mirrored run-log subject derivation.

The new proof belongs beside the existing produced-path thread test.

## New test case structure

Add one test with two subcases inside the existing describe block.

### Fixture setup

1. Call `seedRoot([])`.
2. Create an epic file in that root.
3. Use the existing `CHARTER` seeded by `seedRoot`.
4. Clean the root in `finally`.

The epic can be a small static markdown string because this test exercises only assembly transport.

### Supplied option subcase

Construct:

```ts
const opts = { signal: "route this work", agent: "codex" };
```

Mirror the real decompose adapter:

```ts
const inputs = await assembleInputs({
  epicPath,
  projectRoot: root,
  agent: opts.agent,
});
```

Assert:

- `inputs.agent` is `"codex"`;
- `Object.hasOwn(inputs, "agent")` is true;
- the epic content is still assembled.

### Omitted option subcase

Construct an option value without `agent`, while preserving a typed optional access suitable for
mirroring production. This can use a small local structural type:

```ts
const opts: { signal: string; agent?: string } = { signal: "route this work" };
```

Call the same adapter-shaped assembly and assert:

- `inputs.agent` is `undefined`;
- `Object.hasOwn(inputs, "agent")` is false;
- the common assembled content remains unchanged.

## Test imports

No runtime imports are added from native-addon-bearing modules.

Existing imports are sufficient for:

- filesystem setup and cleanup;
- `join` path construction;
- `assembleInputs` and `CHARTER_PATH`;
- existing constants and fixture helpers.

If an exported production option type were imported with `import type`, TypeScript would erase it,
but resolving the module boundary is unnecessary. A local structural type keeps the addon-free test
self-contained and mirrors the existing file's documented convention.

## Documentation updates in code

Update the production option comment. Optionally extend the test file's header enumeration to name
the new proof:

- the exact produced path remains the thread handle;
- the chain's optional agent is carried to assembled decompose inputs;
- omission leaves the assembled shape bare.

No user-facing help text changes in this ticket.

## Ordering of edits

1. Add the option field and documentation.
2. Thread it into the second adapter.
3. Add the addon-free supplied/omitted test.
4. Run the focused test.
5. Run the dependency regression test.
6. Run the full repository gate.
7. Record progress and review artifacts.
8. Commit only ticket-owned files.

## Architectural invariants

- Pure core / impure shell remains intact.
- The engine remains play-agnostic.
- The chain shell remains the concrete composition root.
- Routing data stays in play inputs, not executor dispatch.
- Vend writes allocation metadata; Lisa remains the executor.
- Optional metadata does not perturb the bare path.
- The addon-free test boundary remains intact.

## Expected final diff shape

- One optional interface property with documentation.
- One additional property in one assembly call.
- One focused offline test covering both presence states.
- Six workflow artifacts.
- No ticket frontmatter diff authored by this work.
