# T-075-03-01 Structure — cold-start confidence count

## File set

This ticket owns one production module and one colocated test module:

- modify `src/shelf/shelf-row.ts`;
- modify `src/shelf/shelf-row.test.ts`.

No files are created or deleted in `src/`.

The following related files remain unchanged:

- `src/ledger/recalibrate.ts` — owns the count, threshold, and window;
- `src/shelf/menu.ts` — owned by sibling ticket `T-075-03-02`;
- `src/shelf/home.ts` — composition is outside this ticket;
- `src/shelf/home.test.ts` — already modified by another worker;
- all run-log and budget modules — inputs remain unchanged;
- ticket frontmatter — Lisa owns phase/status updates.

Attempt artifacts are written only to:

- `.lisa/attempts/T-075-03-01/1/work/research.md`;
- `.lisa/attempts/T-075-03-01/1/work/design.md`;
- `.lisa/attempts/T-075-03-01/1/work/structure.md`;
- `.lisa/attempts/T-075-03-01/1/work/plan.md`;
- `.lisa/attempts/T-075-03-01/1/work/progress.md`;
- `.lisa/attempts/T-075-03-01/1/work/review.md`.

Lisa, not this worker, publishes those artifacts to the shared work directory.

## `src/shelf/shelf-row.ts` import boundary

Replace the single named ledger import:

```ts
import { recalibrate } from "../ledger/recalibrate.ts";
```

with a grouped value import of:

```ts
import {
  COLD_START_MIN_SUCCESSES,
  DEFAULT_WINDOW,
  recalibrate,
} from "../ledger/recalibrate.ts";
```

All three values already belong to the same established pure dependency.
No new module edge is introduced.

## Type-level integer range helpers

Add private recursive type helpers near `ShelfConfidence`:

```ts
type Enumerate<N extends number, Acc extends number[] = []> =
  Acc["length"] extends N
    ? Acc[number]
    : Enumerate<N, [...Acc, Acc["length"]]>;

type IntegerRange<From extends number, Through extends number> =
  Exclude<Enumerate<Through>, Enumerate<From>> | Through;
```

`Enumerate<N>` produces integer literals from zero through `N - 1`.
`IntegerRange<From, Through>` produces an inclusive bounded range.

Expose two semantic aliases because they are part of the public confidence shape:

```ts
export type ColdStartRunCount = IntegerRange<1, typeof COLD_START_MIN_SUCCESSES> ...
export type MeasuredRunCount = IntegerRange<
  typeof COLD_START_MIN_SUCCESSES,
  typeof DEFAULT_WINDOW
>;
```

The cold-start upper bound must exclude the threshold, whereas the measured lower bound
must include it. The exact helper expression will reflect that distinction:

- cold start: positive members of `Enumerate<COLD_START_MIN_SUCCESSES>`;
- measured: inclusive threshold through default window.

With current ledger constants, the public meanings are:

```ts
type ColdStartRunCount = 1 | 2;
type MeasuredRunCount = 3 | 4 | ... | 100;
```

These aliases document the shelf contract and make tests readable. The recursive mechanics
remain internal implementation detail.

## `ShelfConfidence` public interface

Change the union from two shapes to three structural states:

```ts
export type ShelfConfidence =
  | { readonly kind: "measured"; readonly runs: MeasuredRunCount }
  | { readonly kind: "default" }
  | { readonly kind: "default"; readonly runs: ColdStartRunCount };
```

Semantic interpretation:

- `measured` + valid count: envelope came from a measured percentile;
- count-free `default`: zero successful runs in the ledger window;
- runs-bearing `default`: real successes exist, but not enough to measure a percentile.

The `kind` discriminator remains the source/provenance discriminator.
Property presence refines the two default evidence levels.

The structure deliberately does not use `runs?: ...` so explicit undefined is not part of
the contract and the renderer can narrow with `"runs" in confidence`.

## Runtime narrowing helpers

Add two private pure predicates:

```ts
function isColdStartRunCount(runs: number): runs is ColdStartRunCount
function isMeasuredRunCount(runs: number): runs is MeasuredRunCount
```

The cold-start predicate checks:

- integer;
- at least one;
- strictly below `COLD_START_MIN_SUCCESSES`.

The measured predicate checks:

- integer;
- at least `COLD_START_MIN_SUCCESSES`;

- no greater than `DEFAULT_WINDOW`.

Integer checks match the fact that counts come from array lengths. Explicit checks keep the
predicates valid even if called independently later.

Add one private mapping helper:

```ts
function shelfConfidence(result: RecalibrateResult): ShelfConfidence
```

If importing `RecalibrateResult` solely for this helper, import it type-only from the same
module. Alternatively accept the minimal structural fields needed. Prefer the exported type
to pin the integration boundary directly.

Mapping rules:

1. measured source + measured range => measured confidence;
2. prior source + zero => count-free default;
3. prior source + cold-start range => runs-bearing default;
4. any other source/count pair => throw an invariant error.

The error should name source, count, threshold, and window so any future ledger-contract drift
is immediately diagnosable. The branch is unreachable for the current `recalibrate` function.

## `shelfRows` composition

Keep the existing play map, tier lookup, recalibration call, and returned row structure.

Replace the inline conditional:

```ts
result.source === "measured"
  ? { kind: "measured", runs: result.confidence.successes }
  : { kind: "default" }
```

with the private `shelfConfidence(result)` helper.

No other shelf-row field changes:

- name remains `play.name`;
- summary remains `play.summary`;
- envelope remains `result.envelope`;
- input order remains stable;
- inputs remain unmodified.

## `confidenceLabel` rendering

Keep the exhaustive switch on `kind`.

Measured arm:

```ts
`(measured · ${runs} runs)`
```

The measured range starts at 3, so singular grammar is unreachable on production and typed
fixtures. The generic plural expression can remain harmlessly if preferred, but removing the
unreachable singular branch makes the threshold contract visible.

Default arm:

```ts
if (!("runs" in c)) return "(default — no runs yet)";
return `(default — ${c.runs} run${...}, measured at ${COLD_START_MIN_SUCCESSES})`;
```

The threshold is interpolated from the ledger export.

No changes are made to:

- the `~` default-envelope prefix;
- budget formatting;
- column sizing;
- shelf header;
- empty-shelf guidance;
- row ordering.

## Comment updates

Update module comments that currently say a default carries no `runs` field.
The new documentation must distinguish:

- no-run default carries no count;
- thin default carries 1–2 real successes;
- measured carries a range that excludes zero.

Update the `shelfRows` documentation so “too little history” no longer implies the count is
discarded. Update the rendering documentation to mention both default labels.

Do not expand comments into ledger implementation details beyond the imported threshold/window.

## `src/shelf/shelf-row.test.ts` fixture structure

Keep `makeStubPlay` and `recordOf` unchanged.

Update the cold-start mapping suite:

- zero records expects `{ kind: "default" }`;
- one success expects `{ kind: "default", runs: 1 }`;
- two successes expects `{ kind: "default", runs: 2 }`;
- both thin cases retain the authored envelope.

The existing two-success test can be expanded or split. Separate one- and two-run cases make
singular/plural behavior independently visible.

## Type-level acceptance assertions

Import `ShelfConfidence` as a type.

Add compile-only declarations inside a test or at module scope:

```ts
// @ts-expect-error — zero runs cannot support measured confidence
const measuredZero: ShelfConfidence = { kind: "measured", runs: 0 };

// @ts-expect-error — zero belongs to the count-free default arm
const defaultZero: ShelfConfidence = { kind: "default", runs: 0 };
```

Use the values in a `void` expression if lint/no-unused behavior requires it; TypeScript's
current configuration does not enable `noUnusedLocals`, but explicit use makes intent clear.

Also retain valid constructions for:

- `{ kind: "default" }`;
- `{ kind: "default", runs: 1 }`;
- `{ kind: "default", runs: 2 }`;
- `{ kind: "measured", runs: 3 }`.

These positive controls ensure the negative test is not merely rejecting the whole arm.

## Render and seam assertions

Update `defaultRow` so it remains the zero-history fixture.

Replace the invalid measured-one fixture test with default-one rendering:

- one thin run contains `(default — 1 run, measured at 3)`;
- two thin runs contains `(default — 2 runs, measured at 3)`;
- zero default contains `(default — no runs yet)` and no measured-at threshold.

Add or update seam tests so labels are exercised from real `shelfRows` mapping, not only direct
row literals. At minimum, the 1–2 successful-run acceptance should flow through both mapping and
rendering in one assertion.

Keep all existing non-label layout tests unchanged.

## Commit unit

The production type/mapping/renderer and its test are one meaningful, inseparable source unit.
Commit them together only after focused tests, typecheck, and the full gate pass:

```sh
lisa commit-ticket \
  --ticket-id T-075-03-01 \
  --message "fix(shelf): show thin cold-start run counts (T-075-03-01)" \
  --include src/shelf/shelf-row.ts \
  --include src/shelf/shelf-row.test.ts
```

No ordinary `git add` or `git commit` operation is part of this structure.
