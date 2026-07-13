# Structure — T-074-01-01

## Modified production files

### `src/executor/executor.ts`

- Export `ExecutorProbeResult` beside the shared executor contract.
- Add required `probe(): Promise<ExecutorProbeResult>` to `Executor`.
- Document that probe is shallow, unmetered, and returns expected failures as data.
- Keep the module's existing runtime dependency graph unchanged.

### `src/executor/claude.ts`

Add a probe section before the existing dispense implementation:

- `ClaudeProbeFacts`: readable/authenticated/detail facts.
- `ClaudeProbeFactsReader`: injectable async fact source.
- shared Claude probe hint constants.
- `classifyClaudeProbe(facts)`: pure total fact-to-result mapping.
- `readClaudeProbeFacts(cli?)`: thin `Bun.spawn` shell for `auth status --json`.
- safe error-message normalization without credential output.

Extend `ClaudeExecutor`:

- constructor accepts a reader defaulting to `readClaudeProbeFacts`;
- `probe()` reads/classifies and degrades reader throws to structured failure;
- `dispense()` remains the existing direct delegate.

### `src/executor/openai-compat.ts`

Add a probe section near config/request helpers:

- `OpenAICompatProbeFacts`: reachable/status/detail facts.
- `OpenAICompatProbeFactsReader`: injectable async fact source.
- `buildOpenAICompatProbeRequest(env)`: pure URL/header construction for `/models`.
- `classifyOpenAICompatProbe(facts, endpoint)`: pure total result mapping.
- `readOpenAICompatProbeFacts(env?, fetcher?)`: thin GET effect.

Extend `OpenAICompatExecutor`:

- constructor accepts a reader with a production default;
- `probe()` returns classified facts and catches reader failures;
- `dispense()` remains the existing delegate.

## Modified primary tests

### `src/executor/claude.test.ts`

- import Claude executor/probe classifier symbols.
- prove readable + authenticated facts return `{ ok: true }`.
- prove config-store denied facts return `ok: false`, named reason, and required hint.
- prove logged-out readable state is distinct and actionable.
- prove `ClaudeExecutor.probe()` uses injected facts and performs no real spawn.

### `src/executor/openai-compat.test.ts`

- test pure `/models` URL and bearer-header construction.
- prove reachable facts succeed.
- prove HTTP/auth and connection facts fail with structured reason/hint.
- prove `OpenAICompatExecutor.probe()` uses injected facts and performs no fetch.

## Structural fixture updates

Every object/class declared as `Executor` must implement the new required method. Add
`probe(): Promise<ExecutorProbeResult>` returning `{ ok: true }` to fake executors in:

- `src/executor/select.test.ts`
- `src/engine/cast.test.ts`
- `src/engine/cross-review-refusal.e2e.test.ts`
- `src/cross-review/resolve-complement.test.ts`
- `src/cross-review/review.test.ts`
- `src/kitchen/kitchen-degrade.test.ts`
- `src/play/bare-code-cast.test.ts`
- `src/play/story-gate-cast.test.ts`

The exact list is confirmed by typecheck after the interface edit. These methods model available
fake environments and are not called by existing tests, preserving current behavior.

## Dependency direction

```text
select.ts -> claude.ts -> executor.ts
          -> openai-compat.ts -> executor.ts

executor.ts --type-only--> claude.ts transport types
```

The new shared result is defined locally in `executor.ts`, so no new cycle is introduced.
Claude's reader uses Bun subprocess APIs only inside `claude.ts`. OpenAI's reader uses global
fetch only inside `openai-compat.ts`.

## Public interfaces

```ts
export interface ExecutorProbeResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly hint?: string;
}

export interface Executor {
  readonly id: string;
  probe(): Promise<ExecutorProbeResult>;
  dispense(opts: DispenseOptions): Promise<ResultMessage>;
}
```

Fact types/classifiers are exported for deterministic unit tests and future composition. The
reader dependency types are exported so callers can construct hermetic executors if needed.

## Ordering

1. Expand the shared interface/result.
2. Add Claude facts, reader, classifier, and class method.
3. Add OpenAI facts, reader, classifier, and class method.
4. Add primary probe tests.
5. Run typecheck and mechanically update every structural fake.
6. Run focused executor tests, full typecheck, and full repository gate.
7. Commit all exact ticket-owned source/test paths through Lisa.

## Unchanged boundaries

- No doctor consumer yet.
- No cast-time refusal yet.
- No live dispense or probe in tests.
- No run-log, budget, shelf, funding, or TIER_BUDGET changes.
- No new environment variables, dependencies, or persisted state.
- No change to terminal result synthesis or stream behavior.
