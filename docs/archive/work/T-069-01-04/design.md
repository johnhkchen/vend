# Design — T-069-01-04

## Decision summary

Add the optional `agent` field to `RunOptions`, pass it through `assembleAndCast` into
`assembleInputs`, and pass the resulting `ctx.inputs.agent` into `materialize`.

Extract the existing world-touching decompose effect and Lisa validation helper from the
BAML-bearing `decompose-epic.ts` into an addon-free `decompose-effect.ts`. Export the real
`decomposeEffect` from that module and give it an optional validator dependency whose default is
the production `lisaValidate`. Catch `UnknownSeatError` beside the existing materialization
andons and return `{ ok: false, outcome: "unknown-seat" }` with the offending seat in the detail.

Add `unknown-seat` to `RUN_OUTCOMES`. Test the actual exported effect with temp filesystem
fixtures: a known `codex` seat writes ticket files stamped `agent: codex`, and an unknown seat
returns the named outcome without creating either target directory. Keep a direct run-option
assembly assertion in the same addon-free test through a small exported assembly-source adapter.

## Design goals

- Complete every missing transport link from `RunOptions` to materialization.
- Preserve the canonical seat vocabulary and validation authority.
- Make the expected refusal returned data, not an uncaught exception.
- Prove the actual production effect rather than a copied fixture arm.
- Keep BAML native code out of the Bun test process.
- Preserve omission behavior for existing callers.
- Keep CLI parsing and chain behavior outside this ticket.
- Avoid any write or cleanup requirement on an unknown seat.

## D1 — optional run option

Extend `RunOptions` with:

```ts
readonly agent?: string;
```

The type remains `string`, matching `ContextSources` and `DecomposeInputs`.

Rationale:

- Parsing has not happened at this boundary yet.
- The write-side guard remains the canonical validation authority.
- An unknown string must reach that guard to produce the named andon.
- Narrowing the option to `AgentSeat` would make runtime refusal untestable and falsely imply
  arbitrary CLI input is already valid.
- Optionality keeps every current call source-compatible.

The field documentation will distinguish Lisa routing seats from Vend executor selection.

## D2 — one assembly-source adapter

Add an addon-free helper to `project-context.ts`:

```ts
export function contextSourcesForRun(opts: {
  epicPath: string;
  projectRoot: string;
  after?: readonly string[];
  agent?: string;
}): ContextSources
```

It returns the source object passed to `assembleInputs`, conditionally including optional fields.
`assembleAndCast` uses the helper rather than constructing the object inline.

Rationale:

- The ticket explicitly requires a test driven from `RunOptions`-shaped input.
- `RunOptions` itself lives in the BAML-bearing module and cannot be value-imported safely.
- A pure adapter in the existing input-boundary module makes the production transport link
  directly testable without moving the entire run surface.
- Conditional spreads preserve absence rather than creating own properties with `undefined`.
- The helper is a pure core for a thin filesystem assembly shell, matching the house pattern.

Rejected variant: simply inline `agent: opts.agent` in `assembleAndCast` and rely only on the
existing `assembleInputs` test. That implements behavior but does not pin the newly added direct-run
adapter, the exact link most likely to regress when the downstream CLI ticket lands.

Rejected variant: export `RunOptions` from another module solely for tests. A type-only contract
would not test the runtime object mapping and would add a module without owning behavior.

## D3 — addon-free effect module

Create `src/play/decompose-effect.ts` and move these existing members into it:

- `ValidateResult`;
- `lisaValidate`;
- `decomposeEffect`.

The module imports:

- Node path joining;
- `WorkPlan` as a type-only import;
- `CastContext` and `EffectResult` as type-only imports;
- graph canonicalization helpers from `decompose-epic-core.ts`;
- `DecomposeInputs` as a type plus `listIdsIn`;
- materialization and its named errors.

It does not import the BAML sync client, renderer, executor, cast loop, or play registry.

`decompose-epic.ts` imports `decomposeEffect` for the play definition and re-exports
`lisaValidate`/`ValidateResult` to avoid needlessly breaking the module's existing public surface.

Rationale:

- The effect is already described as the one impure member of the play.
- Extraction makes the pure/BAML-heavy play description and effectful filesystem shell more
  explicit without altering orchestration.
- The actual production function becomes directly testable.
- Existing `decompose-epic.test.ts` can retain its no-addon discipline.
- This avoids a subprocess test and avoids duplicating production error handling.

Rejected option: value-import `decompose-epic.ts` in a new Bun test. Repository comments document a
native BAML reactor limitation; adding another addon-bearing test risks suite hangs and violates an
established boundary.

Rejected option: duplicate the catch arm in a decompose-shaped fixture play. This is the current
precedent for older bare-code coverage, but the ticket explicitly asks to drive `decomposeEffect`.
A copied arm can pass while production forgets the new branch.

Rejected option: move only an error-to-result classifier into a pure module. That would test the
classification but not prove `ctx.inputs.agent` reaches `materialize` or that the refusal precedes
all writes.

## D4 — validator dependency seam

Define a small function type:

```ts
export type LisaValidator = (projectRoot: string) => Promise<ValidateResult>;
```

Give the real effect an optional third argument:

```ts
export async function decomposeEffect(
  plan: WorkPlan,
  ctx: CastContext<DecomposeInputs>,
  validate: LisaValidator = lisaValidate,
): Promise<EffectResult>
```

The optional third parameter keeps the function assignable to `Play.effect`, which calls it with
two arguments. Production therefore uses the real subprocess helper. Tests inject a deterministic
validator returning `{ ok: true, output: "" }`.

Rationale:

- The success-side acceptance must reach materialization and then validation.
- Spawning the external Lisa binary is not part of the unit under test.
- Dependency injection prevents environment dependence without mocking globals.
- Unknown-seat tests can also record that validation was never called.
- This is a narrow impure-shell seam rather than a new abstraction framework.

Rejected option: skip the success-side effect test and test only the failure. That would not prove
the `codex` seat reaches materialized ticket frontmatter.

Rejected option: make `lisaValidate` globally mutable. Global test state is harder to isolate and
would weaken parallel test safety.

## D5 — pass seat to materialize

Change the production call from:

```ts
materialize(finalPlan, targets, ctx.inputs.charter)
```

to:

```ts
materialize(finalPlan, targets, ctx.inputs.charter, ctx.inputs.agent)
```

No prevalidation belongs in the effect.

Rationale:

- `materialize` owns the first-operation write guard.
- Passing raw optional input maintains a single source of truth.
- Omitted values preserve the old rendering path.
- The effect remains responsible only for translating expected errors to run outcomes.

## D6 — named error relabel

Import `UnknownSeatError` and add a catch arm before the generic rethrow:

```ts
if (e instanceof UnknownSeatError) {
  return {
    ok: false,
    outcome: "unknown-seat",
    detail: `unknown-seat — unknown agent seat ${JSON.stringify(e.seat)}`,
  };
}
```

The exact detail may also name known seats by reusing the error message, but it must at least carry
the offending value. The outcome and `ok` fields are the acceptance-critical contract.

Rationale:

- This mirrors `IdCollisionError` and `BareCodeError` handling.
- Expected input refusal is a countable andon.
- The error type prevents unrelated exceptions with similar messages from being swallowed.
- Since the guard throws before reads or writes, no rollback branch is necessary.

Rejected option: catch all errors and label them `unknown-seat`. Filesystem and programming errors
must still propagate honestly.

Rejected option: validate in `assembleAndCast` and return a run summary directly. That bypasses the
effect/result contract, duplicates seat logic, and prevents the normal cast loop from logging the
named outcome.

## D7 — run-log outcome

Insert `unknown-seat` into `RUN_OUTCOMES` near the other expected pre-write materialization
refusals. Update the tuple's narrative comment.

No schema-version bump is planned.

Rationale:

- The log schema already models outcomes as an extensible literal vocabulary.
- Existing readers build outcome maps from the tuple.
- Historical records remain valid.
- `buildRunRecord` must recognize the relabel before `castPlay` can append it.

Add an explicit test assertion that `RUN_OUTCOMES` contains `unknown-seat`, even though the existing
parameterized test already accepts every tuple member. This makes the ticket-specific contract
visible and prevents removal from being hidden by tuple-driven coverage.

## D8 — effect-level acceptance test

Create `src/play/decompose-effect.test.ts` with type-only BAML imports and temp-root cleanup.

Build a minimal valid nested plan with:

- one complete story;
- one ticket;
- known charter citation(s);
- an epic input containing its matching id;
- no `after` targets.

Success case:

1. Build run-source data carrying `agent: "codex"`.
2. Assemble `DecomposeInputs` through the production adapter and `assembleInputs`.
3. Call the actual `decomposeEffect` with the plan and a stub validator.
4. Assert `ok === true`.
5. Read the written ticket.
6. Assert it contains `priority: high\nagent: codex\nphase: ready`.
7. Assert exactly one agent line exists.
8. Assert the story does not contain an agent line.

Refusal case:

1. Assemble inputs carrying `agent: "gpt"`.
2. Call the actual effect with a validator spy.
3. Assert the exact `{ ok: false, outcome: "unknown-seat" }` fields.
4. Assert detail names `gpt`.
5. Assert neither stories nor tickets directories exist.
6. Assert validation was not called.

The plan uses already canonical nested ids so graph normalization is deterministic and valid.

## D9 — compatibility and boundaries

- Omitted `agent` still produces no input property and no frontmatter key.
- Existing `after` behavior is unchanged.
- Existing collision and bare-code relabels move modules but retain exact behavior.
- The validator remains the same production subprocess call.
- `decomposeEpicPlay.effect` remains the same function semantically.
- `RunOptions` remains the direct and dispatch-facing option type.
- CLI changes wait for `T-069-01-05`.
- No executor selection code changes.
- No Lisa files or ticket frontmatter are manually edited.

## Verification design

- Focused: `bun test src/play/decompose-effect.test.ts src/log/run-log.test.ts`.
- Regression: relevant agent, materializer, and decompose core tests.
- Type boundary: `bun run build`.
- Full repository gate: `bun run check`.
- Inspect the final diff for accidental board/provenance inclusion.
- Commit implementation and artifacts without staging Lisa-managed changes.

## Design conclusion

The chosen design adds only one small behavior module and one pure input adapter, but it closes the
entire run-to-write path with direct production-function coverage. Validation remains centralized at
the write boundary, expected refusal becomes a typed and countable andon, and the BAML addon remains
outside the unit-test process.
