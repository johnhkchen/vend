# Structure — T-074-02-01 underfunding decision core

## Change set

Create two ticket-owned source files:

```text
src/shelf/underfunding-core.ts
src/shelf/underfunding-core.test.ts
```

Create/update attempt-private workflow artifacts:

```text
.lisa/attempts/T-074-02-01/1/work/research.md
.lisa/attempts/T-074-02-01/1/work/design.md
.lisa/attempts/T-074-02-01/1/work/structure.md
.lisa/attempts/T-074-02-01/1/work/plan.md
.lisa/attempts/T-074-02-01/1/work/progress.md
.lisa/attempts/T-074-02-01/1/work/review.md
```

No existing source file is modified. No file is deleted.

## Module boundary

`underfunding-core.ts` is the pure, reusable policy boundary between:

- upstream counter wiring, which has already resolved a funded budget and a measured
  envelope floor; and
- downstream display, which needs either one ready-to-print warning line or no output.

It does not know:

- which play is being run;
- how its envelope was recalibrated;
- whether the source was measured or prior;
- which gesture initiated the cast;
- where the warning is printed;
- whether or how dispatch proceeds.

Those responsibilities remain in T-074-02-02.

## Dependency direction

```text
budget/budget.ts (type only)
          ↑
shelf/underfunding-core.ts
          ↑
shelf/underfunding-core.test.ts
```

Future wiring may point into `underfunding-core.ts` from `press.ts` and/or `dispatch.ts`.
The core must never point back to either shell.

The only source import is:

```ts
import type { Budget } from "../budget/budget.ts";
```

With `verbatimModuleSyntax`, this produces no runtime module edge. There is therefore no
path to play assembly, executor code, BAML bridges, filesystem, process, or network.

## Public interface

### `UNDERFUNDING_FACTOR`

```ts
export const UNDERFUNDING_FACTOR = 2;
```

Responsibilities:

- expose the threshold policy by name;
- give tests and dependent wiring a stable explanation anchor;
- prevent an unexplained numeric literal inside the decision.

It is a number constant, not a configurable option. Counter-time reconfiguration would
push authoring/policy negotiation onto the run and is not in scope.

### `underfundingWarning`

```ts
export function underfundingWarning(funded: Budget, floor: Budget): string | null;
```

Input contract:

- `funded` is the actual budget allocated at the counter;
- `floor` is a measured envelope supplied by the caller;
- both obey the existing `Budget` positive-integer contract;
- only `.tokens` participates in the decision.

Output contract:

- warning string iff `funded.tokens < floor.tokens / UNDERFUNDING_FACTOR`;
- `null` at or above that threshold;
- warning names funded tokens and measured-floor tokens;
- warning states that the funded budget proceeds;
- no mutation, throw, or side effect for valid `Budget` inputs.

## Internal organization

The module has four small sections:

1. module-level purpose/purity/boundary comment;
2. type-only `Budget` import;
3. exported factor constant;
4. private token formatter and exported decision function.

### Private formatter

```ts
function formatTokens(tokens: number): string
```

Rules:

- `< 1000`: raw integer string;
- `>= 1000`: divide by 1000;
- whole thousands: no decimal (`400k`);
- fractional thousands: at most one decimal (`12.5k`).

The formatter remains private. This ticket does not broaden shelf/menu formatting APIs.

### Decision body

The body first returns `null` for the safe/advisory-silent band:

```ts
if (funded.tokens >= floor.tokens / UNDERFUNDING_FACTOR) return null;
```

It then interpolates the two formatted token counts into the stable warning line.

The early return keeps the byte-identical/no-output path visually primary.

## Test file organization

`underfunding-core.test.ts` imports:

```ts
import { describe, expect, test } from "bun:test";
import type { Budget } from "../budget/budget.ts";
import { UNDERFUNDING_FACTOR, underfundingWarning } from "./underfunding-core.ts";
```

No barrel or impure shelf shell is imported.

Use a helper:

```ts
const budget = (tokens: number, timeMs = 60_000): Budget => ({ tokens, timeMs });
```

Test groups:

### Warning path

- field-report 12,500 versus 400,000;
- just below the 2× boundary;
- message content and advisory wording.

### Silent path

- adequately funded at floor;
- funded above floor;
- near floor;
- exactly half floor.

### Dimension separation

- extremely small funded time versus large floor time remains silent when tokens are
  adequate;
- demonstrates the function does not silently grow into wall-clock policy.

## Files explicitly untouched

- `src/shelf/press-core.ts`: planning/staleness stays unchanged.
- `src/shelf/press.ts`: no warning printing or run-log read yet.
- `src/play/dispatch.ts`: no shared counter wiring yet.
- `src/shelf/shelf-row.ts`: no provenance/API expansion yet.
- `src/ledger/recalibrate.ts`: no measurement policy change.
- `src/shelf/gather.ts`: no tier-budget change.
- `src/budget/budget.ts`: no budget contract change.
- ticket/story/epic markdown frontmatter: Lisa owns transitions.

## Commit boundary

The implementation and its unit tests form one meaningful source unit because neither is
useful as an independently admitted completion:

```text
lisa commit-ticket \
  --ticket-id T-074-02-01 \
  --message "feat(shelf): add underfunding warning decision" \
  --include src/shelf/underfunding-core.ts \
  --include src/shelf/underfunding-core.test.ts
```

Attempt-private artifacts are not included in the ticket source commit; Lisa owns their
publication path.
