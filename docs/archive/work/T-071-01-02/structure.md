# T-071-01-02 Structure — cast stamps seat of execution

## File-level change set

| File | Action | Responsibility |
| --- | --- | --- |
| `src/engine/cast-core.ts` | modify | Pure executor-id to known-seat projection |
| `src/engine/cast-core.test.ts` | modify | Unit policy proof for both mappings and unknown |
| `src/engine/cast.ts` | modify | Resolve lane from selected executor and forward to log |
| `src/engine/cast.test.ts` | modify | Stub cast persistence and lane-less omission proof |

No files are created or deleted. `src/log/run-log.ts`, executor adapters, selector, materialize,
decompose effect, and reader remain unchanged.

## `src/engine/cast-core.ts`

### Import boundary

Add one type-only import:

```ts
import type { AgentSeat } from "../play/agent-seat.ts";
```

This preserves the module header's invariant that all imports are erased at runtime.

### Public interface

Add:

```ts
export function resolveSeatOfExecution(executorId: string): AgentSeat | undefined
```

The function is public through `cast.ts`'s existing `export * from "./cast-core.ts"`.

### Internal organization

Place the resolver near other factual metadata resolvers, after `resolveLoggedModel` and before
turn/tool policy sections. Document:

- exact id matching;
- Claude executor → Claude lane;
- OpenAI-compatible executor → Codex lane;
- unknown → undefined for conditional omission;
- purity and lack of env/registry access.

Use a switch or equivalent explicit branches. Do not export a mutable mapping object.

## `src/engine/cast-core.test.ts`

### Import change

Add `resolveSeatOfExecution` to the existing named import from `cast-core.ts`.

### Test group

Add `describe("resolveSeatOfExecution ...")` near `resolveLoggedModel` because both translate
runtime identity into ledger metadata.

Assertions:

1. `resolveSeatOfExecution("claude") === "claude"`.
2. `resolveSeatOfExecution("openai-compat") === "codex"`.
3. `resolveSeatOfExecution("stub") === undefined`.
4. Optionally empty/near-match identity also remains undefined if useful to pin exact matching.

The first two assertions are the ticket's explicit mapping contract. The third is the omission
precondition used by the shell.

## `src/engine/cast.ts`

### Import change

Add `resolveSeatOfExecution` to the existing `cast-core.ts` named import. Reformat the long import
in the repository's existing multiline TypeScript style if needed.

### Resolution point

Immediately after resolving the executor instance, compute the lane from `executor.id`.

This point has both explicit-instance and selector-resolved paths unified. It also occurs before
dispense, so timeout records retain the attempted executor lane.

### Record projection

In the final `appendRunLog` object, place a conditional `seatOfExecution` spread near other
optional execution facts, preferably after `turnsUsed`.

The shape is:

```ts
...(seatOfExecution !== undefined ? { seatOfExecution } : {}),
```

Its comment must state that the pure resolver owns mapping and unknown ids omit the key.

### Unchanged paths

- Missing-capability early record: unchanged and lane-less because no executor resolves/runs.
- Dispense arguments: unchanged.
- Classification/effect order: unchanged.
- Return summary: unchanged; the lane is ledger provenance, not a new caller contract.

## `src/engine/cast.test.ts`

### Stub helper

Change the helper signature to accept an optional third `id` argument defaulting to `"stub"`:

```ts
function stubExecutor(seen, resultText = "hello from stub", id = "stub"): Executor
```

Use the parameter for the returned executor's `id`. Existing call sites remain unchanged unless
they need a known lane, preserving their lane-less fixture semantics.

### Existing end-to-end test extension

In the primary executor-seam test, inject `stubExecutor(seen, ..., "claude")`. Add an assertion
that the one parsed record has `seatOfExecution === "claude"`.

This proves a stub executor, not a concrete adapter class, drives the mapping and ledger write.

### New omission test

Add a focused test that casts the echo play through the default `"stub"` id, reads the single
record, and asserts:

```ts
expect("seatOfExecution" in rec).toBe(false);
expect(rec.seatOfExecution).toBeUndefined();
```

The test uses a fresh temp root/log, no external services, and existing cleanup.

## Dependency graph

```text
agent-seat.ts (type only)
       ↓
cast-core.ts ← cast-core.test.ts
       ↓
cast.ts      ← cast.test.ts
       ↓
run-log.ts (existing optional field)
```

No runtime `cast-core → play/agent-seat` edge is emitted. No dependency cycle is introduced.

## Ordering

1. Add the resolver and its pure tests.
2. Run the focused pure test file.
3. Thread the resolver through the cast shell and integration fixtures.
4. Run both focused test files.
5. Run the full repository gate.
6. Commit the four exact ticket-owned paths with Lisa.

## Ownership and commit boundary

The meaningful source unit is the four-file implementation/test slice above. Attempt artifacts
remain in Lisa's private attempt directory for publication. Existing modified `.lisa*`, Codex
hook, provenance, and ticket files are not included or altered by the ticket commit.
