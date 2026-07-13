# T-076-01-01 — Design

## Decision

Give cross-review its own one-seat default registry containing only the default Claude execution
seat. Keep `builtinExecutors` unchanged as the catalog used by ordinary author-executor selection.
Continue accepting an explicit `ExecutorRegistry`; a caller provisions cross-review by supplying a
registry containing both the author and reviewer seats.

Conceptually:

```ts
const defaultCrossReviewRegistry: ExecutorRegistry = {
  [DEFAULT_EXECUTOR_ID]: () =>
    executorFor({ executor: DEFAULT_EXECUTOR_ID }, {}, builtinExecutors),
};

resolveComplementExecutor(seat, registry = defaultCrossReviewRegistry)
```

The existing algorithm remains unchanged. Its established one-seat rule now applies to the actual
default instead of a catalog that happens to contain two shipped adapters.

## Why this is the chosen design

### Default configuration becomes honest

- Vend's default execution seat is Claude.
- No complement reviewer is configured by a fresh install.
- A one-seat Claude registry expresses exactly those facts.
- A Claude-authored run finds itself but no complement and returns `null`.
- A Codex-authored run is absent from the default configured set and returns `null`.
- No OpenAI-compatible factory is reachable through default complement resolution.
- The gate is therefore inert until configuration explicitly expands the capability set.

### Installed adapters stay distinct from provisioned reviewers

- `builtinExecutors` answers “which adapters can Vend construct when selected?”
- The cross-review registry answers “which seats did this caller provision for this workflow?”
- Those questions were accidentally treated as identical in rc.4.
- Separating only the defaults restores the distinction without redesigning either interface.
- Explicit `VEND_EXECUTOR=openai-compat` author execution remains supported.
- The OpenAI adapter's local-first default remains available on that explicit execution path.

### Existing configuration convention is preserved

- `ExecutorRegistry` already represents injected executor capability.
- `resolveComplementExecutor` already accepts it.
- `CastOptions.crossReviewRegistry` already threads it through settlement.
- Existing tests already build explicit two-seat registries.
- No new environment variable, config-file schema, CLI option, or secret convention is needed.
- The story explicitly excludes a provisioning UI.

### Pure core and lazy construction remain intact

- The default is a plain registry value.
- Resolver policy still depends only on a seat string and registry factories.
- No endpoint health or environment inspection is added.
- Factories remain lazy.
- A default resolution invokes no factory because no complement exists.
- An explicit resolution constructs only the chosen complement through `executorFor`.
- No network request occurs until the later dispense shell.

## Detailed behavior

### Default registry, Claude author

1. Registry keys contain only `claude`.
2. Seat projection yields only the Claude seat.
3. The author seat is present.
4. Filtering out the author leaves zero complements.
5. Resolver returns `null`.
6. No executor factory is invoked.

### Default registry, Codex author

1. Registry keys contain only `claude`.
2. Seat projection yields only the Claude seat.
3. The Codex author seat is not configured.
4. Resolver returns `null` before complement construction.
5. No executor factory is invoked.

### Explicit two-seat registry, Claude author

1. Caller supplies `claude` and `openai-compat` factories.
2. Projection yields Claude and Codex seats.
3. Claude is the authoring seat.
4. Codex is the sole complement.
5. `executorFor` explicitly constructs the caller's `openai-compat` factory.
6. Resolver returns the Codex seat and provisioned executor.

### Explicit two-seat registry, Codex author

1. Caller supplies `claude` and `openai-compat` factories.
2. Codex is the authoring seat.
3. Claude is the sole complement.
4. `executorFor` explicitly constructs the caller's Claude factory.
5. Resolver returns the Claude seat and provisioned executor.

## Public API choice

Keep the existing function signature:

```ts
resolveComplementExecutor(
  seatOfExecution: string | undefined,
  registry?: ExecutorRegistry,
): ComplementExecutor | null
```

The optional parameter's meaning becomes honest: omitted means default one-seat capability;
present means explicitly provisioned capability. No caller changes are required.

The default registry does not need to be public. It is workflow policy local to the resolver, not
a general executor catalog or a configuration API. Keeping it module-private prevents other code
from treating it as another global source of truth.

## Factory shape

The Claude factory will use the established selector instead of importing `ClaudeExecutor`
directly:

```ts
() => executorFor({ executor: DEFAULT_EXECUTOR_ID }, {}, builtinExecutors)
```

Reasons:

- preserves the selector as the construction seam;
- avoids a concrete transport import in cross-review policy;
- makes the selected id explicit;
- passes empty environment so process-wide selection cannot redirect the keyed Claude factory;
- retains lazy construction;
- uses the existing catalog only after explicit selection of its one default entry.

Although this factory is structurally complete, default resolution never calls it because the
default registry cannot have a complement. It exists so the configured set honestly includes the
default author seat and continues to satisfy the existing resolver invariant that an author must
be configured.

## Options considered

### A. Default to an empty registry

Advantages:

- Smallest possible inert capability set.
- Makes construction impossible.

Rejected because default Vend does have one configured execution seat: Claude. An empty registry
would produce the correct `null` result but misstate why. The existing resolver deliberately
requires the author seat to be represented; a one-seat registry preserves that model and matches
the cast comment that already describes the intended inert condition.

### B. Remove `openai-compat` from `builtinExecutors`

Advantages:

- The current resolver default would become one-seat automatically.

Rejected because `builtinExecutors` is also the ordinary executor-selector catalog. Removing the
entry would break explicit `VEND_EXECUTOR=openai-compat`, regress the executor-agnostic seam, and
change behavior unrelated to cross-review provisioning.

### C. Treat `VEND_OPENAI_BASE_URL` presence as reviewer provisioning

Advantages:

- Reuses an existing endpoint setting.
- Gives operators an environment-only route to enable review.

Rejected for this slice because endpoint configuration and workflow authorization are different
facts. A base URL may exist for author execution or BAML rendering without authorizing every cast
to spend a second review call. It would also make the resolver environment-dependent and bypass
the already-established `crossReviewRegistry` capability seam.

### D. Treat `VEND_EXECUTOR=openai-compat` as reviewer provisioning

Advantages:

- Reuses the main executor selector.

Rejected because it selects the author executor, not a complement reviewer. One scalar selector
cannot honestly declare a two-seat configured capability set.

### E. Require explicit registry with no default parameter

Advantages:

- Every caller must confront provisioning.

Rejected because it would force unrelated callers and the cast shell to manufacture a default,
expanding the change without adding safety. An honest local default preserves compatibility and
keeps policy in its owning module.

### F. Add a new reviewer environment variable or config key

Advantages:

- Direct user-facing declaration.

Rejected because no reviewer provisioning UI/config surface exists, the story excludes creating
one, and the injected registry already supplies the needed mechanism.

## Tests

- Add a test named around the exact rc.4 regression: Claude author plus omitted default registry.
- Assert the result is `null`.
- Cover the other known author seat with the same omitted registry.
- Retain the explicit two-seat tests unchanged; they prove provisioned reviewers still resolve.
- Retain one-seat, unknown-seat, and incomplete-registry defensive coverage.
- Optionally count default factory calls only if behavior cannot otherwise prove laziness; the
  module-private registry makes direct spying unnecessary.
- Run selector tests to ensure the built-in adapter catalog remains unchanged.
- Run the full repository gate.

## Scope boundaries

- Do not change `cast.ts`; T-076-01-02 owns skip-marker settlement wiring.
- Do not change `run-log.ts`; T-076-01-02 owns schema and round-trip behavior.
- Do not catch reviewer failures; S-076-02 owns provisioned-but-unreachable handling.
- Do not change doctor checks; S-076-03 owns them.
- Do not change OpenAI transport defaults globally.
- Do not add UI or persisted configuration.

## Acceptance mapping

- Default resolver null for every author seat: direct no-registry tests.
- Exact rc.4 shape: explicit Claude-author/default-registry test.
- Explicit reviewer resolves: existing injected two-seat tests.
- Existing convention documented: `ExecutorRegistry`/`crossReviewRegistry` in Research and Review.
- No default OpenAI-compatible construction: default registry has no such entry.
- Full quality gate: `bun run check` before the Lisa commit.
