# Review — T-074-02-01 underfunding decision core

## Verdict

PASS. The ticket acceptance criterion is met in full.

The committed unit provides a pure `underfundingWarning(funded, floor)` decision, catches
the field-report 12.5k-versus-400k mismatch, stays silent for adequate and near-floor
funding, names both quantities in its advisory message, performs no I/O, and has no native
addon runtime edge. Focused tests and the full repository gate are green.

## What changed

Commit:

```text
fc838e4b613e43375ac51a22bbd7d4e7b2db2f01
feat(shelf): add underfunding warning decision
```

Commit scope:

```text
src/shelf/underfunding-core.ts       new, 39 lines
src/shelf/underfunding-core.test.ts  new, 47 lines
2 files changed, 86 insertions
```

No existing source file was modified or deleted.

## Public contract

`src/shelf/underfunding-core.ts` exports:

```ts
export const UNDERFUNDING_FACTOR = 2;
export function underfundingWarning(funded: Budget, floor: Budget): string | null;
```

The decision is:

```text
warn iff funded.tokens < floor.tokens / 2
```

Boundary behavior:

- less than half: warning string;
- exactly half: `null`;
- between half and floor: `null`;
- exactly floor: `null`;
- above floor: `null`.

This settles “far enough below” as a 2× factor. The factor matches the repository's
existing warranted class-level headroom magnitude and avoids warning on modest deliberate
overrides.

## Warning face

The field-report fixture produces exactly:

```text
⚠ underfunded: 12.5k tokens funded vs 400k measured floor; proceeding with funded budget
```

This satisfies the face requirements:

- visible warning marker;
- funded amount named;
- floor amount named;
- floor identified as measured;
- warn-don't-block behavior made explicit;
- no claim about the independent wall-clock dimension.

The formatter preserves one decimal in fractional thousands, so the reported 12.5k does
not become an imprecise 13k.

## Purity and dependency review

The production core contains one import:

```ts
import type { Budget } from "../budget/budget.ts";
```

That import is erased at runtime. The core has:

- no filesystem call;
- no clock call;
- no process/environment call;
- no network call;
- no stdout/stderr call;
- no ledger/recalibration import;
- no press/dispatch import;
- no executor import;
- no BAML import.

It takes plain values, returns a fresh string or `null`, and does not mutate its inputs.
The focused test imports this module directly, so it executes without loading the addon.

## Scope review

Correctly included:

- reusable token-underfunding arithmetic;
- named threshold policy;
- warning text generation;
- human token formatting needed by that text;
- fixture coverage of warning/silent boundaries.

Correctly excluded for dependent T-074-02-02:

- reading the run log;
- recalibrating the play envelope;
- discriminating measured versus prior/cold-start floors;
- finding the current play at the counter;
- printing before dispatch;
- proving continued dispatch through the real shells.

Correctly excluded by story boundary:

- changing `TIER_BUDGET`;
- automatically raising funding;
- blocking a thin probe;
- wall-clock underfunding policy;
- executor dispensability/andon work.

## Test coverage

`src/shelf/underfunding-core.test.ts` has eight pure fixtures:

1. threshold factor is exactly 2;
2. 12.5k funded versus 400k floor warns;
3. warning string pins both values, measured provenance language, and proceeding behavior;
4. one token below half-floor warns;
5. exact floor is silent;
6. above floor is silent;
7. near floor is silent;
8. exact half-floor is silent;
9. tokens adequate/time severely below floor remains silent.

The field-report test accounts for multiple assertions within one of the eight Bun test
cases, hence nine listed coverage properties.

Focused result:

```text
8 pass
0 fail
8 expect() calls
```

The strict factor boundary has coverage on both sides (`199,999` warns, `200,000` is
silent for a `400,000` floor), preventing accidental `<`/`<=` drift.

## Repository verification

Final command:

```bash
bun run check
```

Final result:

```text
BAML generation: passed
TypeScript typecheck: passed
1709 tests passed
1 test skipped
0 tests failed
5273 assertions
115 test files
```

The skip is the existing release-acceptance integration that requires local `dist/`
artifacts; it is unrelated to this ticket.

`git diff --check` over the ticket commit passed with no whitespace errors.

## Acceptance assessment

Ticket clause: pure `underfundingWarning(funded, floor)`.

- PASS — exported from standalone pure core with the exact two-budget signature.

Ticket clause: warning iff funded tokens fall below measured floor by chosen factor.

- PASS — exported factor 2, strict below-half comparison, both boundary sides pinned.

Ticket clause: warning names funded versus floor.

- PASS — exact message test names `12.5k` and `400k measured floor`.

Ticket clause: none when funded at or near floor.

- PASS — near, exact, above, and exact factor boundary return `null`.

Ticket clause: field-report ratio and adequate case tested.

- PASS — 12.5k/400k warns; multiple adequate/near cases are silent.

Ticket clause: no I/O and no addon load.

- PASS — type-only sole production import; focused addon-free test passes.

## Open concerns and limitations

No critical issue requires human attention.

Known, intentional boundaries:

- The function assumes callers supply a genuinely measured floor. Cold-start suppression
  is structurally deferred to T-074-02-02, matching the story and requested API.
- The function relies on the existing `Budget` positive-finite-integer contract rather
  than duplicating runtime validation.
- Token display rounds fractional thousands to one decimal. Decision arithmetic always
  uses raw integers, so display rounding cannot affect warn/silent behavior.
- This ticket does not prove the warning is printed before a real dispatch; that is the
  dependent wiring ticket's acceptance contract.
- Live proof against the real steer ledger remains the story's explicitly deferred field
  verification.

## Working-tree ownership

Both ticket-owned source files are committed and clean. The remaining modified/untracked
paths belong to Lisa state, published work artifacts, and concurrent T-074-01-01 work.
They were not staged, reverted, or included by this ticket.

The ticket was committed only through `lisa commit-ticket` with exact includes. No
ordinary `git add` or `git commit` was used.

## Handoff

T-074-02-02 can import `underfundingWarning` from
`src/shelf/underfunding-core.ts`, call it only when the recalibrated/shelf floor is
measured, print a non-null result before dispatch, and continue unchanged. No threshold or
message policy needs to be re-derived in that ticket.
