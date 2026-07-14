# Structure — T-077-02-04 degrade-on-run-record

## File-level change set

| Path | Operation | Responsibility |
|---|---|---|
| `src/play/decompose-epic-core.ts` | modify | Return normalized plan plus ordered advances dispositions; retain plan-only wrapper |
| `src/play/decompose-epic.test.ts` | modify | Pin report ordering, duplicates, empty report, and compatibility |
| `src/play/decompose-epic.ts` | modify | Carry concrete parse report through gates/effect and merge inline dispositions |
| `src/engine/play.ts` | modify | Add optional generic effect degradation data using ledger-owned structural type |
| `src/engine/cast.ts` | modify | Forward effect dispositions to terminal record and returned summary |
| `src/log/run-log.ts` | modify | Define durable disposition contract and normalize/revive optional arrays |
| `src/log/run-log.test.ts` | modify | Prove round-trip, compatibility, canonicalization, and malformed behavior |
| `src/play/bare-code-cast.test.ts` | modify | Token-free end-to-end proof across both cite sources and `loadRunLog` |
| `src/cli.ts` | modify | Centralize and use final run-summary formatting with degradation count |
| `src/cli.test.ts` | modify | Pin exact degraded and unchanged clean/refusal summary lines |

No files are deleted. No BAML source or generated client changes are expected.

## Pure advances report

### New exported interface

In `src/play/decompose-epic-core.ts`:

```ts
export interface AdvanceNormalization {
  readonly plan: WorkPlan;
  readonly degrades: readonly DegradeDisposition[];
}
```

The type remains concrete-play policy and imports the already-canonical play disposition type.

### New exported function

```ts
export function stripNonGoalAdvancesWithDispositions(
  plan: WorkPlan,
  charter?: string,
): AdvanceNormalization;
```

Internal organization:

1. Snapshot the charter once when present.
2. Allocate one local `DegradeDisposition[]`.
3. Map tickets in existing order.
4. For each advances entry, classify the current disposition:
   - `N\d+` → strip and push exact record;
   - no charter → keep any non-N entry;
   - charter classification degradable → strip and push its record;
   - otherwise → keep.
5. Clone only a ticket that lost at least one entry.
6. Return a new top-level plan with mapped tickets plus the report array.

### Existing wrapper

```ts
export function stripNonGoalAdvances(plan: WorkPlan, charter?: string): WorkPlan {
  return stripNonGoalAdvancesWithDispositions(plan, charter).plan;
}
```

This is the compatibility surface for all current direct callers.

## Concrete decompose output

In `src/play/decompose-epic.ts`, add a local/exported interface only if tests or comments benefit:

```ts
interface DecomposeOutput {
  readonly plan: WorkPlan;
  readonly degrades: readonly DegradeDisposition[];
}
```

Change the play declaration to `Play<DecomposeInputs, DecomposeOutput>`.

Closure boundaries:

- `parse`: BAML parse once, then `stripNonGoalAdvancesWithDispositions`.
- `gates`: call `clear(output.plan, context)`.
- `effect`: call `decomposeEffect(output.plan, context)`; if the effect succeeded, merge
  `output.degrades` before `effectResult.degrades`; omit the optional key when merged length is zero.

The effect closure returns the generic `EffectResult` shape. Inline materialization policy remains
inside `decomposeEffect`.

## Generic effect contract

In `src/engine/play.ts`:

- extend the existing type-only run-log import to include `DegradeDisposition`;
- add `readonly degrades?: readonly DegradeDisposition[]` to `EffectResult`;
- document that the effect owns occurrence data and clean effects omit the key.

No runtime import and no concrete play import are added.

## Cast state and public summary

In `src/engine/cast.ts`:

- import the durable `DegradeDisposition` type from `src/log/run-log.ts`;
- add optional `degrades` to `RunSummary`;
- declare `let degrades: readonly DegradeDisposition[] | undefined` beside other effect facts;
- capture `reported.degrades` immediately after the effect report is observed;
- preserve only a nonempty list for public/durable one-way marker behavior;
- spread it into the single terminal `appendRunLog` input;
- spread it into the returned `RunSummary`.

No early-return branch changes because those branches cannot observe an effect.

## Durable ledger contract

### New types/constants

In `src/log/run-log.ts`:

```ts
export const DEGRADE_ACTIONS = ["strip", "annotate"] as const;
export type DegradeAction = (typeof DEGRADE_ACTIONS)[number];
export interface DegradeDisposition {
  readonly code: string;
  readonly location: string;
  readonly action: DegradeAction;
}
```

The name matches the concrete policy record through structural typing. The ledger does not import
the play module.

### Record fields

Add optional `degrades` to both `RunRecordInput` and `RunRecord`, near other degradation markers.

### Normalizer

```ts
function normalizeDegrades(value: unknown): readonly DegradeDisposition[] | undefined;
```

Behavior:

- reject non-arrays and empty arrays to absence;
- validate every element as a non-null object;
- require nonblank string `code` and `location`;
- require action membership in `DEGRADE_ACTIONS`;
- return freshly allocated canonical objects with only three keys;
- if any element fails, return `undefined` for the whole array.

Call it in both `buildRunRecord(input.degrades)` and `reviveRecord(r.degrades)`, then conditionally
spread the result into the frozen record.

## CLI formatting boundary

In `src/cli.ts`, type-import `RunSummary` from the engine cast module. This module is addon-free and
already part of the CLI dependency graph.

Add:

```ts
export function formatRunSummaryLine(summary: RunSummary): string;
```

Rules:

- success plus a nonempty degradation list → `cleared; N cite(s) degraded`;
- otherwise use `summary.outcome`;
- always retain run id, materialized marker, and trailing newline.

Replace every repeated direct summary template in the `import.meta.main` shell with the helper.

## Test organization

### `src/play/decompose-epic.test.ts`

Extend the advances-normalization describe block:

- exact `plan` and `degrades` for mixed input;
- non-goal record even with no charter;
- dangling custom/invariant record with charter;
- duplicate cite occurrences keep separate indexed locations;
- clean report is empty;
- source arrays remain unchanged.

### `src/log/run-log.test.ts`

Add one focused describe block adjacent to optional structured marker tests:

- strip plus annotate list round-trips through `readRuns`;
- serializing revived record is byte-stable;
- absent/empty marker matches baseline bytes;
- extra nested keys are removed;
- one malformed entry omits the whole field;
- non-array raw metadata is omitted without skipping the row.

### `src/play/bare-code-cast.test.ts`

Refactor the fixture output to carry `{ plan, degrades }`:

- parse with `stripNonGoalAdvancesWithDispositions`;
- gates use `.plan`;
- effect materializes `.plan` and returns merged advances/inline `degrades`;
- modify editorial fixture to include one dangling advance alongside a valid advance;
- use `loadRunLog({path})`, not only raw JSON, for the acceptance assertion;
- assert summary and loaded record contain the same ordered list;
- assert the structural contrast has neither field.

### `src/cli.test.ts`

Import `formatRunSummaryLine` and test:

- exact degraded success phrase;
- clean success keeps `success`;
- gate failure keeps `gate-failed`.

## Commit units

1. Pure advances report and concrete play wiring:
   `src/play/decompose-epic-core.ts`, `src/play/decompose-epic.test.ts`,
   `src/play/decompose-epic.ts`.
2. Ledger and generic effect/cast transport:
   `src/log/run-log.ts`, `src/log/run-log.test.ts`, `src/engine/play.ts`,
   `src/engine/cast.ts`.
3. End-to-end story fixture and operator summary:
   `src/play/bare-code-cast.test.ts`, `src/cli.ts`, `src/cli.test.ts`.

If exact commit grouping must shift due to type dependencies, each Lisa commit will still list only
the ticket-owned paths and will follow a green relevant check.

## No-change boundaries

- `src/play/degrade-disposition.ts`: canonical play policy stays unchanged.
- `src/play/materialize.ts`: inline applier is already complete.
- `src/play/decompose-effect.ts`: inline forwarding is already complete.
- `src/gate/gates.ts`: structural/value/bounds judgments stay unchanged.
- `RUN_OUTCOMES`: no new terminal state.
- ticket frontmatter and public work artifacts: Lisa-owned.

## Structure conclusion

The blueprint adds one explicit concrete-play report wrapper, then uses existing generic optional
metadata patterns to reach the terminal row and summary. Pure decisions remain in core/log helpers;
filesystem and stdout effects remain in their existing thin shells.
