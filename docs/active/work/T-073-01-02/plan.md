# T-073-01-02 — Plan

## Step 1 — Implement complement routing core

- Create `src/cross-review/resolve-complement.ts`.
- Define the readonly result type carrying an `AgentSeat` and `Executor`.
- Accept the run's loose optional seat plus an injectable registry.
- Derive configured seats only through `resolveSeatOfExecution`.
- Require that the run seat is among the recognized configured seats.
- Require exactly one distinct different seat.
- Resolve its executor through explicit `executorFor` selection.
- Return `null` for incomplete/unknown/ambiguous configurations.

Verification:

- TypeScript accepts all imports and the map narrowing.
- No concrete executor implementation is imported by cross-review.
- No environment or transport operation appears in the resolver.

## Step 2 — Add free unit acceptance proof

- Create `src/cross-review/resolve-complement.test.ts`.
- Build two inert stub `Executor` instances.
- Inject a registry under the real mapped ids.
- Assert Claude → Codex/openai-compat by both seat and object identity.
- Assert Codex → Claude by both seat and object identity.
- Assert a one-seat Claude registry yields `null`.
- Assert absent/unknown seats and opposite-only incomplete configuration are inert.
- Do not call `dispense`.

Focused verification:

```bash
bun test src/cross-review/resolve-complement.test.ts
bun run check:typecheck
```

## Step 3 — Full repository gate

Run:

```bash
bun run check
```

Acceptance interpretation:

- Green focused cases prove the exact ticket matrix.
- Green typecheck proves the new public boundary composes with strict/noUncheckedIndexedAccess.
- Green full suite proves the new module does not regress existing cast/executor behavior.
- No live model, endpoint, credential, or token spend is permitted or needed.

## Step 4 — Commit the source unit

Use only:

```bash
lisa commit-ticket \
  --ticket-id T-073-01-02 \
  --message "feat(cross-review): resolve complement executor seat (T-073-01-02)" \
  --include src/cross-review/resolve-complement.ts \
  --include src/cross-review/resolve-complement.test.ts
```

Do not stage with ordinary Git commands. Do not include Lisa's ticket-frontmatter edits or the
parallel worker's files.

## Step 5 — Progress and review handoff

- Write `progress.md` with implemented behavior, verification results, commit id, and deviations.
- Inspect the committed diff and repository status.
- Write `review.md` with:
  - exact files and public API;
  - acceptance evidence;
  - test coverage and any gaps;
  - open concerns/limitations;
  - explicit story-boundary exclusions.
- Remain on T-073-01-02 and stop after review; Lisa owns publication/completion.

## Atomicity

One source commit is planned because the public resolver and its acceptance test are one coherent,
meaningful unit. Splitting production from its only gate would temporarily violate P3 and would not
improve reviewability for two small adjacent files.

## Expected outcome

Dependent ticket T-073-01-03 can call one provider-neutral operation and either receive the other
configured seat plus an invokable executor or receive `null` and leave cross-review inert. It does
not need to know concrete transports, reverse-map executor ids, or interpret environment variables.
