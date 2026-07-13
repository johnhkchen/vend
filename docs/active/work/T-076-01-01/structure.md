# T-076-01-01 — Structure

## Change summary

This ticket modifies exactly two repository source paths:

1. `src/cross-review/resolve-complement.ts`
2. `src/cross-review/resolve-complement.test.ts`

No source files are created or deleted. No executor selector, transport, cast orchestration,
run-log schema, CLI, doctor, or board file changes belong to this ticket.

## Module boundary

`src/cross-review/resolve-complement.ts` remains the sole owner of complement workflow policy.
It continues to sit above:

```text
cross-review/resolve-complement.ts
  ├─ engine/cast-core.ts       executor id → known seat projection
  ├─ executor/select.ts        lazy registry + selected construction
  ├─ executor/executor.ts      provider-neutral executor interface
  └─ play/agent-seat.ts        seat type
```

No lower layer gains a dependency on cross-review.

## `src/cross-review/resolve-complement.ts`

### Import changes

Current selector import:

```ts
import { builtinExecutors, executorFor, type ExecutorRegistry } from "../executor/select.ts";
```

Required selector import:

```ts
import {
  builtinExecutors,
  DEFAULT_EXECUTOR_ID,
  executorFor,
  type ExecutorRegistry,
} from "../executor/select.ts";
```

`DEFAULT_EXECUTOR_ID` avoids introducing a second literal source of truth for the default author
executor id.

### New private registry

Add a module-private constant after imports and before the public result interface:

```ts
const defaultCrossReviewRegistry: ExecutorRegistry = {
  [DEFAULT_EXECUTOR_ID]: () =>
    executorFor({ executor: DEFAULT_EXECUTOR_ID }, {}, builtinExecutors),
};
```

Properties:

- exactly one known seat under current projection;
- keyed by the selector's default id;
- factory remains nullary and lazy;
- construction reuses `executorFor`;
- selected id is explicit;
- empty env prevents `VEND_EXECUTOR` from redirecting construction;
- built-in catalog is consulted only for the explicitly selected Claude entry;
- no OpenAI-compatible factory exists in the default cross-review registry.

The constant remains unexported because it is the resolver's policy default, not a general-purpose
catalog or public provisioning surface.

### Function default change

Current:

```ts
registry: ExecutorRegistry = builtinExecutors,
```

Required:

```ts
registry: ExecutorRegistry = defaultCrossReviewRegistry,
```

No algorithmic statements below the signature change. The established implementation already
handles a one-seat registry correctly.

### Documentation changes

Update the module header to remove the stale claim that the resolver “never reads env” only if the
wording becomes misleading. The default factory passes an explicit empty env and the resolver
still does not read process environment, so the claim can remain.

Add documentation near the private registry that distinguishes:

- `builtinExecutors`: shipped adapter catalog for explicit executor selection;
- `defaultCrossReviewRegistry`: configured review capability for a fresh/default run.

Update the function doc to state:

- omitted registry means the one-seat Claude default and is inert;
- a caller explicitly provisions review by passing a registry with both author and reviewer;
- catalog availability alone is not provisioning.

Keep the existing explanation for passing `{}` to `executorFor` during complement construction.

### Unchanged public declarations

Keep:

```ts
export interface ComplementExecutor {
  readonly seat: AgentSeat;
  readonly executor: Executor;
}
```

Keep the externally visible function type:

```ts
export function resolveComplementExecutor(
  seatOfExecution: string | undefined,
  registry?: ExecutorRegistry,
): ComplementExecutor | null
```

Changing the default expression does not change its TypeScript call surface.

### Unchanged algorithm

The following logic stays byte-for-byte unless formatting requires movement:

1. Project recognized registry ids to seats.
2. Ignore ids with no known seat.
3. Require the author seat to be in the configured set.
4. Find configured seats other than the author.
5. Require exactly one complement.
6. Construct it through `executorFor` using its explicit id and the supplied registry.
7. Return the complement seat and executor.

This minimizes risk: the earlier resolver semantics remain valid when a registry is explicitly
provided; only the accidental default capability set changes.

## `src/cross-review/resolve-complement.test.ts`

### Fixture boundary

Keep `stubExecutor` unchanged. It remains an inert provider-neutral object whose identity proves
routing without dispense or network access.

Keep the explicit `bothSeats` registry unchanged. It is the positive provisioning fixture:

```ts
const bothSeats: ExecutorRegistry = {
  claude: () => claude,
  "openai-compat": () => openaiCompat,
};
```

### New regression test

Add a test before the explicit-provisioning cases so the default contract is visible first:

```ts
test("default registry is inert for every author seat", () => {
  expect(resolveComplementExecutor("claude")).toBeNull();
  expect(resolveComplementExecutor("codex")).toBeNull();
});
```

The first assertion pins the exact rc.4 failure shape named by acceptance: author `claude`, no
registry argument. The second assertion pins “every author seat.”

If test naming needs the field shape even more explicitly, split this into two tests:

- `default registry is inert for the rc.4 Claude author shape`;
- `default registry is inert for a Codex author`.

A single matrix-style test is preferred because the acceptance describes one default invariant
over both known seats and the exact Claude assertion remains directly readable.

### Existing positive tests

Retain both:

- explicit two-seat registry resolves Claude author to Codex/OpenAI-compatible reviewer;
- explicit two-seat registry resolves Codex author to Claude reviewer.

Rename test descriptions to include “explicitly provisioned” if helpful. That wording turns
existing behavior into direct evidence for the second acceptance criterion.

### Existing defensive tests

Retain:

- explicit one-seat registry is inert;
- absent/unknown author seat is inert;
- opposite-only registry is incomplete.

These establish that the default fix does not loosen the resolver's defensive contract.

## File ownership and non-changes

### `src/executor/select.ts`

No change.

- `builtinExecutors` remains the shipped adapter catalog.
- Explicit `VEND_EXECUTOR=openai-compat` remains supported.
- Selector tests continue to prove both facts.

### `src/executor/openai-compat.ts`

No change.

- `DEFAULT_OPENAI_BASE_URL` remains valid for explicitly selected OpenAI-compatible execution.
- The default cross-review path can no longer select its factory.

### `src/engine/cast.ts`

No change.

- Omitted `crossReviewRegistry` still calls the resolver with no second argument.
- That call now returns `null` under default configuration.
- T-076-01-02 will later record the reason at this seam.

### `src/log/run-log.ts`

No change. Marker schema belongs to T-076-01-02.

### Board and published work files

No change. Lisa owns ticket transitions and publication from the private attempt directory.

## Test and verification structure

### Focused unit gate

```bash
bun test src/cross-review/resolve-complement.test.ts src/executor/select.test.ts
```

This proves:

- default cross-review inertness;
- explicit provisioning still resolves;
- shipped OpenAI adapter remains selectable explicitly;
- ordinary Claude default selection is unchanged.

### Full repository gate

```bash
bun run check
```

This runs BAML code generation, strict typecheck, and the full Bun suite.

### Diff checks

- Inspect the exact two-path diff.
- Run `git diff --check` for whitespace errors before commit.
- Confirm unrelated Lisa-owned files are not included.

## Commit structure

The resolver default and its regression test are one meaningful ticket-owned unit. Commit them
together after focused and full verification:

```bash
lisa commit-ticket \
  --ticket-id T-076-01-01 \
  --message "fix(cross-review): keep default reviewer registry inert (T-076-01-01)" \
  --include src/cross-review/resolve-complement.ts \
  --include src/cross-review/resolve-complement.test.ts
```

The private RDSPI artifacts are not included; Lisa publishes them after lease verification.

## Expected final state

- Default resolution returns `null` for Claude and Codex author seats.
- Explicit two-seat registries continue to return the sole complement.
- `builtinExecutors` still contains both shipped adapters.
- No default cross-review route constructs `OpenAICompatExecutor`.
- All checks pass.
- Both ticket-owned source paths are clean after the Lisa commit.
- Review artifact honestly reports any unrelated or orchestration-owned repository state.
