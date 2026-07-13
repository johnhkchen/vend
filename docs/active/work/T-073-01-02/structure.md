# T-073-01-02 — Structure

## Files created

### `src/cross-review/resolve-complement.ts`

Owns complement routing policy for S-073-01.

Imports:

- `resolveSeatOfExecution` from `src/engine/cast-core.ts` as the authoritative projection.
- `builtinExecutors`, `executorFor`, and `ExecutorRegistry` from `src/executor/select.ts`.
- `Executor` as a type from `src/executor/executor.ts`.
- `AgentSeat` as a type from `src/play/agent-seat.ts`.

Exports:

- `ComplementExecutor`: readonly `seat` plus readonly `executor`.
- `resolveComplementExecutor(seatOfExecution, registry?)`.

Internal organization:

- Build a local map keyed by `AgentSeat`, storing the executor id that projected to that seat.
- Unknown executor ids do not enter the map.
- Check that the input run seat is itself a configured map key.
- Collect all entries with a different seat.
- Proceed only for exactly one entry.
- Construct with explicit selection and an empty env object so environment cannot override or
  participate in complement policy.
- Return the stored projected seat paired with the executor.

No filesystem, clock, network, model call, mutable global, or environment read is introduced.

### `src/cross-review/resolve-complement.test.ts`

Owns the acceptance matrix.

Test fixture:

- A local stub factory returns `Executor` objects with the supplied stable id.
- A two-seat registry uses keys `claude` and `openai-compat`.
- Object identity makes executor selection visible without dispense.

Required cases:

1. Run seat `claude` resolves seat `codex` and the openai-compat stub.
2. Run seat `codex` resolves seat `claude` and the Claude stub.
3. Run seat `claude` with only the Claude registry entry resolves `null`.

Defensive boundary cases:

- absent/unknown run seat resolves `null`;
- opposite-only registry resolves `null`, proving “second seat” rather than merely “different
  available entry.”

## Files not modified

- `src/engine/cast-core.ts`: existing projection is reused as-is.
- `src/executor/select.ts`: existing selection and injection API is sufficient.
- `src/executor/executor.ts`: no new interface method.
- `src/play/agent-seat.ts`: no seat vocabulary change.
- `src/engine/cast.ts`: orchestration belongs to dependent ticket T-073-01-03.
- `src/log/run-log.ts`: verdict schema/persistence belongs to T-073-01-04.
- Ticket/story frontmatter: Lisa owns phase/status transitions.
- `docs/active/work/T-073-01-02/`: Lisa publishes attempt artifacts later.

## Public boundary

The resolver accepts a loose run-log-facing seat type:

```ts
seatOfExecution: string | undefined
```

This is deliberate because historical/foreign run records may omit the field or contain a value
outside the current `AgentSeat` union. The operation is total and returns `null` for those values.

The result tightens the seat to `AgentSeat` because it came from the authoritative projection:

```ts
export interface ComplementExecutor {
  readonly seat: AgentSeat;
  readonly executor: Executor;
}
```

The optional registry defaults to `builtinExecutors`, making the production call one gesture while
preserving free, deterministic test injection:

```ts
export function resolveComplementExecutor(
  seatOfExecution: string | undefined,
  registry: ExecutorRegistry = builtinExecutors,
): ComplementExecutor | null
```

## Dependency graph

```text
cross-review/resolve-complement.ts
  -> engine/cast-core.ts          (executor id -> AgentSeat)
  -> executor/select.ts           (configured factories + executorFor)
  -> executor/executor.ts         (Executor type only)
  -> play/agent-seat.ts           (AgentSeat type only)
```

No dependency points from the engine, executor, or play layers back to cross-review.

## Change ordering

1. Create production resolver and its types.
2. Create the adjacent unit test fixture and acceptance cases.
3. Run the focused test and typecheck.
4. Run full `bun run check`.
5. Commit exactly the two source paths through `lisa commit-ticket`.
6. Confirm ticket-owned paths are clean and orchestration-owned ticket edits remain untouched.

## Commit unit

The resolver and its adjacent tests form one meaningful ticket-owned source unit: neither offers a
complete, gated change alone. Commit them together with two exact `--include` arguments. Private
RDSPI artifacts are not repository source and are not part of that commit transaction.
