# T-077-02-01 — Structure

## File-level change set

| Path | Operation | Responsibility |
|---|---|---|
| `src/play/degrade-disposition.ts` | create | Pure charter-cite classification and materialization taxonomy |
| `src/play/degrade-disposition.test.ts` | create | Addon-free unit proof for all classification and fold branches |

No existing production file changes in this ticket.

## Module placement

The module lives under `src/play/` because:

- the first consumers are DecomposeEpic normalization and materialization;
- `CharterSnapshot` already lives in `src/play/charter-snapshot.ts`;
- the judgment is play policy, not a generic engine terminal outcome;
- placing it in `src/log` would make application code depend on persistence;
- placing it in `src/gate` would wrongly imply inline materialization is a gate concern.

## Dependency boundary

`src/play/degrade-disposition.ts` has one type-only import:

```ts
import type { CharterSnapshot } from "./charter-snapshot.ts";
```

It imports no runtime value and no BAML type. Runtime inputs are plain strings, a readonly map, and
readonly arrays. The module contains no fs, clock, network, process, executor, renderer, or ledger
dependency.

## Exported constants and types

### `DEGRADE_ACTIONS`

```ts
export const DEGRADE_ACTIONS = ["strip", "annotate"] as const;
```

This is the single action vocabulary for both later appliers and ledger validation.

### `DegradeAction`

```ts
export type DegradeAction = (typeof DEGRADE_ACTIONS)[number];
```

### `CharterCite`

```ts
export interface CharterCite {
  readonly code: string;
  readonly location: string;
  readonly action: DegradeAction;
}
```

The caller chooses location and proposed miss action.

### `DegradeDisposition`

```ts
export interface DegradeDisposition {
  readonly code: string;
  readonly location: string;
  readonly action: DegradeAction;
}
```

This exactly matches the story's shared record.

### `StructuralCiteReason`

```ts
export type StructuralCiteReason = "invalid-code" | "missing-location";
```

### `ResolvableCharterCite`

```ts
export interface ResolvableCharterCite {
  readonly classification: "resolvable";
  readonly code: string;
  readonly location: string;
  readonly title: string;
}
```

### `DegradableCharterCite`

```ts
export interface DegradableCharterCite {
  readonly classification: "degradable";
  readonly disposition: DegradeDisposition;
}
```

### `StructuralCharterCite`

```ts
export interface StructuralCharterCite {
  readonly classification: "structural";
  readonly code: string;
  readonly location: string;
  readonly reason: StructuralCiteReason;
}
```

### `CharterCiteClassification`

```ts
export type CharterCiteClassification =
  | ResolvableCharterCite
  | DegradableCharterCite
  | StructuralCharterCite;
```

Named branch interfaces let dependent tickets narrow or import a specific shape without restating
it.

## Single-cite function

### Signature

```ts
export function classifyCharterCite(
  cite: CharterCite,
  snapshot: CharterSnapshot,
): CharterCiteClassification;
```

### Internal order

1. Derive `code = cite.code.trim()`.
2. Derive `location = cite.location.trim()`.
3. If code fails `/^[A-Z]{1,3}\d+$/`, return structural `invalid-code`.
4. If location is empty, return structural `missing-location`.
5. Read `title = snapshot.get(code)` exactly once.
6. If title exists, return resolvable data.
7. Otherwise return degradable data with the supplied action.

The function is total for its TypeScript input domain. It does not throw expected findings.

## Materialization result types

### `Materialized`

```ts
export interface Materialized {
  readonly status: "materialized";
  readonly degrades: readonly DegradeDisposition[];
}
```

The clean branch returns an empty array. The broad readonly-array field keeps consumers simple while
tests pin it as empty.

### `MaterializedWithDegrades`

```ts
export interface MaterializedWithDegrades {
  readonly status: "materialized-with-degrades";
  readonly degrades: readonly DegradeDisposition[];
}
```

The implementation guarantees at least one record, though TypeScript does not require a variadic
tuple from every consumer.

### `StructuralRefusal`

```ts
export interface StructuralRefusal {
  readonly status: "structural-refusal";
  readonly finding: StructuralCharterCite;
}
```

### `MaterializationDisposition`

```ts
export type MaterializationDisposition =
  | Materialized
  | MaterializedWithDegrades
  | StructuralRefusal;
```

## Aggregate function

### Signature

```ts
export function materializationDisposition(
  classifications: readonly CharterCiteClassification[],
): MaterializationDisposition;
```

### Internal order

1. Allocate a fresh `DegradeDisposition[]`.
2. Iterate classifications in input order.
3. Return immediately on the first structural classification.
4. Append each degradable branch's exact disposition.
5. Ignore resolvable branches for aggregate degradation.
6. Return `materialized-with-degrades` when the collected list is nonempty.
7. Otherwise return `materialized` with an empty list.

The fold preserves occurrence order and performs no deduplication.

## Test module organization

`src/play/degrade-disposition.test.ts` imports:

```ts
import { describe, expect, test } from "bun:test";
import {
  classifyCharterCite,
  materializationDisposition,
  type CharterCite,
} from "./degrade-disposition.ts";
```

It creates snapshots directly as `ReadonlyMap<string, string>` values. It does not import the live
charter or snapshot parser because this ticket tests classification, while the existing snapshot
suite already pins parsing.

## Test groups

### `classifyCharterCite — resolvable`

- known `P3` returns exact canonical code/location/title;
- surrounding whitespace is normalized;
- requested miss action is not emitted on a hit.

### `classifyCharterCite — degradable`

- missing `N4` with `strip` returns the exact record;
- missing `N2` with `annotate` returns the exact record;
- an empty snapshot still degrades a valid code;
- prefix-generic `K7` behaves like `P`/`N`.

### `classifyCharterCite — structural`

- blank code returns `invalid-code`;
- malformed/lowercase code returns `invalid-code`;
- blank location returns `missing-location`;
- invalid code wins when both code and location are invalid.

### `materializationDisposition`

- empty or all-resolvable classifications return clean materialization;
- degradations return `materialized-with-degrades` with ordered exact records;
- a structural finding returns `structural-refusal`;
- a structural finding wins even after a prior degradation;
- resolvable entries do not create degradation records.

### `purity`

- frozen cite and frozen snapshot can be classified;
- frozen classification array can be folded;
- source objects remain exactly equal after calls;
- returned degradation array is a fresh container.

## Documentation comments

The production module header will state:

- why the story needs a shared seam;
- the difference between editorial cite degradation and structural refusal;
- the module's pure/addon-free boundary;
- later ticket ownership of mutations and ledger wiring.

Public types and functions receive short doc comments focused on contract rather than ticket history.

## No-change audit

- `src/play/charter-snapshot.ts`: unchanged; membership oracle remains stable.
- `src/play/materialize.ts`: unchanged; later inline-prose ticket owns it.
- `src/play/decompose-epic-core.ts`: unchanged; later advances ticket owns it.
- `src/gate/gates.ts`: unchanged; later advances ticket owns it.
- `src/log/run-log.ts`: unchanged; later ledger ticket owns it.
- `src/engine/cast.ts`: unchanged; later summary ticket owns it.
- `docs/active/tickets/T-077-02-01.md`: unchanged by the worker.

## Implementation order

1. Create the pure production module with all exported contracts.
2. Create the focused test module.
3. Run focused tests and typecheck.
4. Correct only the two new files if verification finds defects.
5. Run the full repository gate.
6. Commit exactly the two new source paths via Lisa.
