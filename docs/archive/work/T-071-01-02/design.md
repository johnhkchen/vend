# T-071-01-02 Design — cast stamps seat of execution

## Decision summary

Add a pure `resolveSeatOfExecution(executorId)` projection to `cast-core.ts`. It returns
the `AgentSeat` lane for the two built-in executor identities and `undefined` for every
unmapped executor. In `castPlay`, resolve this once from the already-selected
`executor.id`, then conditionally spread `seatOfExecution` into the terminal run record.

The mapping is:

| Executor id | Execution lane |
| --- | --- |
| `claude` | `claude` |
| `openai-compat` | `codex` |
| any other id | unknown / omitted |

## Goals

- Make known per-lane burn durable on normal and timed-out cast records.
- Pin executor-to-lane policy in an addon-free pure unit test.
- Prove a token-free injected executor writes the known lane end to end.
- Preserve absence for lane-less executors.
- Keep storage, routing-seat validation, and executor selection responsibilities separate.

## Option A — pure resolver in `cast-core.ts` (chosen)

Define a total resolver accepting the executor's stable id and returning
`AgentSeat | undefined`. Use explicit cases for the two acceptance mappings.

Advantages:

- Follows existing `resolveLoggedModel`/`resolveTurnsUsed` pure-core patterns.
- Keeps the mapping independently testable without fs, spawn, native addons, or env.
- Makes unknown ids an explicit state rather than an accidental fallback.
- Uses the `AgentSeat` type derived from `KNOWN_SEATS`, constraining outputs at compile time.
- Leaves the executor interface stable and does not conflate execution with routing.
- Gives `cast.ts` a simple pass-through responsibility.

Tradeoff:

- The id literals exist in the resolver as mapping keys.
- A new built-in executor requires an explicit mapping decision before its burn is attributed.
- That explicit maintenance is desirable: guessing a financial/provenance lane would be dishonest.

## Option B — add `seatOfExecution` to `Executor`

Extend every executor implementation and stub with an optional lane property.

Advantages:

- Each adapter declares its own accounting lane.
- The cast shell would only forward the property.

Rejected because:

- It expands a general executor interface for a two-entry project allocation vocabulary.
- Every external/injected stub would need to understand Lisa's `KNOWN_SEATS` concept.
- It couples executor adapters to play routing metadata in `src/play/`.
- It is larger than the ticket's requested executor→lane mapping in `cast-core`.
- The acceptance explicitly asks for a `cast-core` unit test pinning the mapping.

## Option C — map in `src/executor/select.ts`

Export a registry or helper alongside executor factories.

Advantages:

- Built-in identities and factories are already visible there.
- Could colocate executor registration with lane registration.

Rejected because:

- Explicit executor instances bypass selection but still need attribution.
- Selector tests do not prove cast settlement behavior.
- `select.ts` value-imports concrete executors, so using it for a pure test loads more shell code.
- It moves cast judgment away from the established cast core.

## Option D — infer from model/provider output

Map `result.model`, the configured model, or API provider to a lane.

Rejected because:

- Models and lanes are different identities.
- Both executors can report arbitrary model names.
- Timeouts may produce no result/model but still burn on a known executor lane.
- String heuristics would silently misattribute cost, violating the ledger's factual contract.

## Option E — default unknown executors to Claude

Treat every unmapped id as `claude`.

Rejected because:

- The acceptance explicitly requires lane-less casts to omit the field.
- Absence means unknown; a default would convert missing knowledge into false provenance.
- It would break executor-agnostic extension by charging future adapters to Claude.

## Type and dependency decision

`cast-core.ts` will type-import `AgentSeat` from `src/play/agent-seat.ts`.
The import is erased at runtime, preserving the core's current no-value-import discipline.
The resolver returns only literals admitted by that union.

The function will not value-import `KNOWN_SEATS`. The storage ticket deliberately kept the
ledger independent of that runtime policy, and a switch is clearer than positional tuple
indexing. Compile-time membership plus tests pin the required relationship.

## Mapping semantics

- Matching is exact on stable executor ids.
- No case folding, trimming, aliasing, or environment lookup occurs.
- `claude` means the built-in Claude executor lane.
- `openai-compat` means the codex lane named by story acceptance.
- Unknown and empty ids return `undefined`.
- The function is total and does not throw.

## Shell threading

After `const executor = ...`, compute:

```ts
const seatOfExecution = resolveSeatOfExecution(executor.id);
```

At the final `appendRunLog` input, add:

```ts
...(seatOfExecution !== undefined ? { seatOfExecution } : {}),
```

This mirrors `turnsUsed`: resolve factual metadata once and spread only when known.

## Early and exceptional paths

The missing-capability andon occurs before executor resolution or dispense. It does not burn
on an executor, so it remains lane-less. Moving executor resolution earlier would create an
adapter on a path that deliberately never executes and could alter error precedence.

Timeout occurs after executor resolution and attempted execution. Its terminal record should
carry a known mapped lane even though there is no result message. Mapping from executor id,
rather than result data, naturally supports this.

Unexpected executor failures still throw before settlement, matching current behavior; this
ticket does not introduce a new record for uncontracted failures.

## Test design

### Pure mapping test

Add a resolver group in `cast-core.test.ts` that asserts both known mappings and the unknown
state. This is the direct acceptance proof for executor→lane policy.

### Known-lane integration proof

Allow the existing stub helper to accept an executor id. Cast the primary end-to-end fixture
through a stub whose id is `claude`. Assert the single JSONL record has
`seatOfExecution: "claude"`.

This uses no tokens and proves the production cast shell consumes executor identity rather
than relying on concrete executor class identity.

### Lane-less omission proof

Add a focused cast using the default generic stub id `stub`. Assert the record has no
`seatOfExecution` own key and its property reads `undefined`. This matches `turnsUsed` omission
semantics and prevents a future fallback from silently appearing.

## Compatibility

- No run-log schema change.
- No executor interface change.
- No selector behavior change.
- No change to serialized records for unknown executors.
- Known built-in execution paths gain one optional JSON key as intended.
- Historical records remain untouched and revive exactly as established by T-071-01-01.

## Scope guard

This design does not read lane heat, choose routing seats, modify materialization, capture 429
signals, change Lisa dispatch, or add lanes. Those remain in the story's named later slices.
