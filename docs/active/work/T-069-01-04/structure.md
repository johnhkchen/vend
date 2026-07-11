# Structure — T-069-01-04

## Structural overview

The change separates the decompose play's BAML-bearing definition from its filesystem effect, then
threads the optional agent seat through the existing run/input/materialize boundaries.

```text
RunOptions.agent
  -> contextSourcesForRun(...).agent
  -> assembleInputs(...).agent
  -> CastContext<DecomposeInputs>.inputs.agent
  -> decomposeEffect(...)
  -> materialize(..., agent)
  -> ticket frontmatter `agent: codex`

UnknownSeatError
  -> decomposeEffect catch
  -> EffectResult { ok:false, outcome:"unknown-seat" }
  -> cast/run-log vocabulary
```

## Files created

### `src/play/decompose-effect.ts`

Purpose:

- Own the impure, post-gate decompose effect.
- Own the Lisa validation subprocess helper.
- Expose an addon-free production effect for direct tests.
- Translate expected materializer errors into named outcomes.

Imports:

- `join` from `node:path` as a runtime import.
- `WorkPlan` from generated BAML types as a type-only import.
- `CastContext` and `EffectResult` from `engine/play.ts` as type-only imports.
- `blockEntryTicketsAfter`, `epicIdFromDoc`, `graphIntegrityViolations`, and
  `renumberPlanToEpic` from `decompose-epic-core.ts`.
- `DecomposeInputs` as a type and `listIdsIn` as runtime behavior from `project-context.ts`.
- `materialize`, `IdCollisionError`, `BareCodeError`, and `UnknownSeatError` from
  `materialize.ts`.

Exports:

```ts
export interface ValidateResult {
  readonly ok: boolean;
  readonly output: string;
}

export type LisaValidator = (
  projectRoot: string,
) => Promise<ValidateResult>;

export async function lisaValidate(
  projectRoot: string,
): Promise<ValidateResult>;

export async function decomposeEffect(
  plan: WorkPlan,
  ctx: CastContext<DecomposeInputs>,
  validate?: LisaValidator,
): Promise<EffectResult>;
```

Internal ordering in `decomposeEffect`:

1. Resolve the project root from context.
2. Derive the epic id from the epic document.
3. Canonicalize plan ids when possible.
4. Run the fragment graph-integrity check.
5. Validate external `after` targets against the live board.
6. Apply external edges to entry tickets.
7. Enter the expected-materialization-error `try` block.
8. Call `materialize` with charter and `ctx.inputs.agent`.
9. Run the injected/default validator.
10. Return artifacts and validation result.
11. Relabel known expected errors.
12. Rethrow unknown errors.

Expected error ordering:

- `IdCollisionError` -> `id-collision`.
- `BareCodeError` -> `bare-code`.
- `UnknownSeatError` -> `unknown-seat`.
- Any other value -> throw.

The ordering of catch arms is not semantically significant because the error classes are siblings,
but keeping the seat arm next to the other materializer refusals makes the contract visible.

### `src/play/decompose-effect.test.ts`

Purpose:

- Drive the actual addon-free production effect.
- Pin direct-run source transport into assembled inputs.
- Prove a known seat reaches ticket files.
- Prove an unknown seat returns the named andon with zero writes.

Runtime imports:

- Bun test primitives.
- Temporary-directory and file-reading Node APIs.
- `decomposeEffect`.
- `assembleInputs` and `contextSourcesForRun`.

Type-only imports:

- Generated BAML plan/draft types.
- `Budget` is not needed because the effect is driven directly.
- `CastContext` may be inferred or imported type-only.

Test fixture organization:

- `tmps` tracks temporary roots.
- `afterEach` recursively removes all roots.
- `tmp()` creates one isolated project root.
- `writeContextFiles(root)` creates the epic and charter sources needed by `assembleInputs`.
- `PLAN` is one graph-valid story/ticket work plan.
- `okValidator` is a deterministic successful validator.
- `effectContext(root, agent)` assembles real inputs from run-shaped source data.

Test 1 owns the known-seat success contract.

Test 2 owns the unknown-seat refusal contract.

No BAML runtime client may be value-imported by this file.

## Files modified

### `src/play/decompose-epic.ts`

Responsibilities retained:

- BAML request/parse integration.
- Concrete `decomposeEpicPlay` definition.
- Registry registration.
- Run options.
- Input assembly and cast dispatch.

Responsibilities removed:

- `ValidateResult` definition implementation site.
- `lisaValidate` implementation.
- `decomposeEffect` implementation.
- Direct materializer/error imports.
- Direct path joining used only by the effect.

New imports:

```ts
import { decomposeEffect } from "./decompose-effect.ts";
```

Compatibility re-export:

```ts
export { lisaValidate, type ValidateResult } from "./decompose-effect.ts";
```

`RunOptions` gains:

```ts
readonly agent?: string;
```

`assembleAndCast` changes only its assembly source construction:

```ts
const inputs = await assembleInputs(
  contextSourcesForRun({
    epicPath: opts.epicPath,
    projectRoot: root,
    after: opts.after,
    agent: opts.agent,
  }),
);
```

Every cast option passed to `castPlay` remains unchanged.

### `src/play/project-context.ts`

Add a pure run-source adapter near the `ContextSources` contract.

New public interface:

```ts
export interface RunContextSourceOptions {
  readonly epicPath: string;
  readonly projectRoot: string;
  readonly after?: readonly string[];
  readonly agent?: string;
}
```

New public function:

```ts
export function contextSourcesForRun(
  opts: RunContextSourceOptions,
): ContextSources;
```

Return shape:

- Always includes `epicPath`.
- Always includes `projectRoot`.
- Includes `after` only when not `undefined`.
- Includes `agent` only when not `undefined`.

This helper does no reads and no validation.

The existing `ContextSources`, `DecomposeInputs`, snapshot helpers, and `assembleInputs` behavior
remain otherwise unchanged.

### `src/log/run-log.ts`

Add `unknown-seat` to the materialization-andons portion of `RUN_OUTCOMES`.

Update the terminal-state documentation to state:

- it comes from the materializer's routing-seat guard;
- it refuses before any file write.

No record shape, normalization, serialization, read path, schema version, or query helper changes.

### `src/log/run-log.test.ts`

Add one ticket-specific assertion:

```ts
expect(RUN_OUTCOMES).toContain("unknown-seat");
```

The existing `test.each([...RUN_OUTCOMES])` continues to prove the new outcome passes record
validation and freezing.

## Files not modified

### `src/play/materialize.ts`

- Already validates unknown seats before reads/writes.
- Already stamps known seats on every ticket.
- Already exports the typed error.
- No duplicate validation is added.

### `src/play/agent-seat.ts`

- The known-seat vocabulary is settled by the dependency.
- No new seats or normalization behavior are introduced.

### `src/play/chain-propose-decompose.ts`

- Sibling ticket work is already committed.
- This ticket does not alter the chain gesture.

### `src/cli.ts`

- Downstream `T-069-01-05` owns parse and dispatch.

### Ticket/story/epic frontmatter

- Lisa owns phase/status transitions.
- No manual phase or status edits are made.

## Public boundary changes

| Boundary | Before | After |
|---|---|---|
| Direct run options | no `agent` | optional raw `agent?: string` |
| Input source adapter | inline object | pure `contextSourcesForRun` |
| Decompose effect | private in BAML module | exported from addon-free module |
| Effect validator | fixed helper call | optional injected function, production default unchanged |
| Materialize call | no seat | `ctx.inputs.agent` as fourth argument |
| Expected outcomes | no seat label | `unknown-seat` included |
| Legacy module export | local `lisaValidate` | re-exported from effect module |

## Dependency direction

```text
decompose-epic.ts
  -> decompose-effect.ts
  -> decompose-epic-core.ts
  -> project-context.ts
  -> materialize.ts

decompose-effect.test.ts
  -> decompose-effect.ts
  -> project-context.ts
```

There is no reverse dependency from the engine into the concrete play.

There is no dependency from the addon-free effect module into the BAML runtime client.

The generated `WorkPlan` import is type-only and erased.

## State and effect boundaries

- Pure seat membership remains in `agent-seat.ts`.
- Pure source-object mapping lives in `project-context.ts`.
- Filesystem reads for input assembly remain in `assembleInputs`.
- Filesystem writes remain in `materialize`.
- Subprocess validation remains in `lisaValidate`.
- Error-to-outcome translation remains at the concrete play effect boundary.
- Engine code remains generic and consumes only `EffectResult`.
- Run-log code remains a validating sink.

## Ordering constraints

1. Add the run-log outcome before compiling the new effect catch arm.
2. Add the pure assembly-source helper before switching `assembleAndCast` to it.
3. Create the effect module with the existing behavior plus seat handling.
4. Switch the concrete play to import the extracted effect.
5. Remove the old effect implementation only after the new import is wired.
6. Add tests after the production seam is importable.
7. Run focused tests before the full gate.

## Verification boundaries

- Typecheck proves the extracted function still satisfies `Play.effect`.
- The success test proves the complete optional seat transport after input assembly.
- The refusal test proves typed error translation and zero filesystem output.
- Existing materializer tests retain byte-exact omission and adjacency coverage.
- Existing run-log iteration proves the new literal is accepted.
- Full `bun run check` covers all downstream outcome-map consumers.

## Structural risks

- Accidental runtime import of generated BAML code in the new test.
- Losing a re-export of `lisaValidate` during extraction.
- Duplicating effect code instead of removing the old implementation.
- Passing `opts.agent` directly to cast options rather than assembled play inputs.
- Always creating an `agent: undefined` property in the new adapter.
- Running Lisa in the unit test if the validator seam is not used.
- Staging unrelated Lisa-managed worktree changes.

## Structure conclusion

The final shape gives the world-touching effect a single addon-free home, keeps the concrete play
definition focused on BAML and orchestration wiring, and creates direct test seams exactly at the
two links introduced by this ticket: run-source mapping and effect materialization/relabeling.
