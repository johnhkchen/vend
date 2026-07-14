# Design — T-074-02-01 underfunding decision core

## Decision summary

Add an addon-free `src/shelf/underfunding-core.ts` exporting:

```ts
export const UNDERFUNDING_FACTOR = 2;
export function underfundingWarning(funded: Budget, floor: Budget): string | null;
```

Warn only when:

```text
funded.tokens < floor.tokens / UNDERFUNDING_FACTOR
```

The warning will name both token allocations in human-scale form and state that dispatch
will continue. Otherwise the function returns `null`.

## D1 — Module location

### Option A: add the function to `press-core.ts`

Advantages:

- Existing addon-free counter decision module.
- One fewer source file.

Disadvantages:

- The story names a shared decision used by press and `dispatch.runPlay`.
- Putting shared funding policy inside the menu-press core gives named dispatch an
  unnatural dependency on press selection/staleness machinery.
- `press-core.ts` is already specifically the pure heart of `vend <sel>`.

### Option B: add the function to `ledger/recalibrate.ts`

Advantages:

- The floor originates from recalibration.
- The module is pure.

Disadvantages:

- Recalibration owns measurement, not counter policy or warning language.
- It would couple a presentation decision to percentile and funding-envelope policy.
- The requested function consumes plain funded/floor values and does not need records,
  tiers, provenance, or confidence.

### Option C: standalone shelf decision core

Advantages:

- The funding counter is a shelf/counter concern.
- Both future shells can import it without depending on one another.
- It can import `Budget` type-only and remain trivially addon-free.
- Tests pin exactly the reusable contract the dependent ticket needs.

Decision: Option C, `src/shelf/underfunding-core.ts`.

## D2 — Provenance boundary

### Option A: accept `RecalibrateResult`

This would let the function suppress prior-source floors internally, but changes the
ticket's explicit `underfundingWarning(funded, floor)` API and imports ledger concepts.

### Option B: accept an optional floor

`underfundingWarning(funded, floor | null)` could represent cold start, but again expands
the requested contract and blurs “no measured floor” with the arithmetic decision.

### Option C: accept two budgets only

The dependent wiring already has to inspect recalibration/shelf confidence. It calls the
decision only for a measured row and emits nothing for a default row.

Decision: Option C. This core answers one question: given a funded budget and a legitimate
measured floor, is the mismatch severe enough to warn? T-074-02-02 owns whether such a
floor exists.

## D3 — Threshold policy

### Option A: warn whenever funded is below floor

This is literal but violates “far enough below” and “near the floor → silent.” Minor
operator overrides would become noisy.

### Option B: fixed absolute token gap

An absolute gap behaves inconsistently across small and large play envelopes. A 25k gap
is enormous for a 40k play and negligible for a 400k play.

### Option C: ratio factor of 2

Warn below half the measured floor. This:

- catches 12.5k versus 400k decisively;
- treats allocations between half and the floor as “near” for this advisory check;
- reuses the repository's warranted class-level headroom magnitude;
- is simple to explain and test;
- stays conservative enough not to warn on ordinary modest overrides.

### Option D: ratio factor larger than 2

A 4× or 10× threshold also catches the report but has no repository-grounded warrant and
would miss materially underfunded allocations such as 100k versus 300k.

Decision: Option C. Export `UNDERFUNDING_FACTOR = 2` so the dependent contract and tests
make the policy visible.

## D4 — Boundary semantics

Use a strict comparison:

```text
funded.tokens < floor.tokens / 2
```

Exactly half is silent. Rationale:

- “falls below ... by the chosen factor” makes the factor boundary inclusive on the safe
  side;
- the ticket requires near-floor silence, and equality is the unambiguous edge;
- strictness avoids warning due solely to threshold equality;
- division avoids multiplying funded tokens and any overflow concern.

Adequate funding (`funded.tokens >= floor.tokens`) is naturally silent. Funding between
half and the full floor is also silent by the chosen advisory band.

## D5 — Return shape

### Option A: boolean

Insufficient: the acceptance criterion requires the core to produce the warning text.

### Option B: discriminated union

`{kind:"warn", message} | {kind:"silent"}` is explicit but heavier than the named
function's optional-message role and inconsistent with nearby optional pure decisions.

### Option C: `string | null`

The return directly represents message versus none. It is ergonomic for a future shell:
`const warning = ...; if (warning !== null) write(warning)`.

Decision: Option C.

## D6 — Message shape

The warning must:

- begin with a visible warning marker;
- name funded tokens;
- name the measured floor tokens;
- make advisory/proceed semantics clear;
- avoid claiming that time is underfunded;
- avoid suggesting automatic escalation.

Chosen shape:

```text
⚠ underfunded: 12.5k tokens funded vs 400k measured floor; proceeding with funded budget
```

The text is one line so either future counter can print it before dispatch. “Measured
floor” preserves provenance at the face. “Proceeding” prevents the warning from reading
like a refusal.

## D7 — Token formatting

### Option A: raw integers

Exact, but hostile at the counter and inconsistent with the existing human-scale shelf.

### Option B: `formatBudget`

Public and existing, but includes time and rounds 12.5k to 13k. The decision/message is
token-only, so that output is both noisy and less faithful to the report.

### Option C: private local human-token formatter

Use raw integers below 1,000; otherwise render `k`, preserving at most one decimal. This
matches the wallet surface and correctly produces 12.5k/400k.

Decision: Option C. Keep it private because it is message implementation, not a new
cross-project formatting API.

## D8 — Input validation

The function accepts `Budget`, whose construction/allocation boundary already requires
positive finite integers. Adding runtime validation would introduce an exception path not
requested by the ticket and duplicate budget policy.

Decision: rely on the typed budget contract, as `planRuns` and other pure consumers do.
The arithmetic remains deterministic and non-mutating.

## D9 — Tests

Create `src/shelf/underfunding-core.test.ts` with plain budget fixtures. Pin:

1. field-report ratio 12,500 versus 400,000 warns;
2. exact full-floor funding is silent;
3. above-floor funding is silent;
4. a near-floor allocation is silent;
5. exact factor boundary (half floor) is silent;
6. one token below the boundary warns;
7. warning text contains funded and floor values and proceeding semantics;
8. time dimensions do not affect the token-only decision.

The test imports only the new core. Static inspection plus the core's type-only import
proves no addon path; the targeted Bun test proves it executes independently.

## Rejected scope

- No cold-start/provenance input in this API.
- No `recalibrate` call.
- No run-log read.
- No stdout/stderr write.
- No press or dispatch modification.
- No TIER_BUDGET change.
- No auto-funding.
- No blocking result.
- No wall-clock warning.
