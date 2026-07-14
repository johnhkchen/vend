# Structure — T-068-01-01 confirm-pricing-cost-weights

## Files touched

| File | Change | Why |
|------|--------|-----|
| `src/budget/budget.ts` | **modified** — add `CostWeights` type + `COST_WEIGHTS` const with doc comment | The single source every cost-weighted count reads (AC) |
| `src/budget/budget.test.ts` | **modified** — add `describe("COST_WEIGHTS")` block | The unit test asserting the confirmed values (AC) |

No files created or deleted. No other module is imported or changed. `countTokens`,
`check`, `timeoutMsFor`, and every existing export are left byte-identical.

## budget.ts — the addition

Placement: immediately **above** `countTokens` (budget.ts:111), since `countTokens` is the
first (and, after T-068-01-02, primary) consumer — the weights should read as the definition
that the counting function references.

### Public interface

```ts
/** Cost weight for one token bucket, relative to a fresh input token (= 1.0). */
export interface CostWeights {
  readonly input: number;
  readonly cache_read: number;
  readonly cache_creation: number;
  readonly output: number;
}

/**
 * Canonical cost-weight vector — every token bucket priced RELATIVE to a fresh input
 * token (the numeraire, 1.0). The single source every cost-weighted count reads
 * (`countTokens`, run-log's `totalTokens` mirror, the recalibrated ceilings).
 *
 * PRICING BASIS (confirmed against current Claude pricing, executor = Opus 4.8):
 *   input          $5.00 /MTok  → 1.0   (numeraire)
 *   output         $25.00/MTok  → 5.0   (5× input — holds lineup-wide: Opus $5/$25,
 *                                        Sonnet 5 $3/$15, Haiku 4.5 $1/$5, Fable 5 $10/$50)
 *   cache_read     $0.50 /MTok  → 0.1   (fixed API-wide 0.1× base-input read multiplier)
 *   cache_creation $6.25 /MTok  → 1.25  (fixed 1.25× base-input write multiplier @ the
 *                                        default 5-min ephemeral TTL; the ledger's single
 *                                        cache_creation bucket does not distinguish TTL)
 *
 * MODEL-INVARIANT: expressed as ratios to input, and the whole current lineup shares the
 * 1:5 input:output ratio and the fixed cache multipliers, so an executor swap does not
 * move this vector. If a future model breaks that, it is a new ticket with data behind it.
 */
export const COST_WEIGHTS: CostWeights = Object.freeze({
  input: 1.0,
  cache_read: 0.1,
  cache_creation: 1.25,
  output: 5.0,
});
```

### Contracts / invariants

- **Numeraire fixed:** `input === 1.0`. Every other weight is a ratio to it.
- **Ordering (economics):** `cache_read < input < cache_creation < output`.
- **Exact confirmed values:** `{1.0, 0.1, 1.25, 5.0}` — pinned by test against drift.
- **Frozen singleton:** shared read-only; `Object.freeze` blocks runtime mutation, the
  `CostWeights` readonly type blocks compile-time reassignment.
- **Purity preserved:** a plain literal, no import/fs/clock/net added — budget.ts stays pure.

### Key naming

Keys are the bucket *stems* (`input`, `cache_read`, `cache_creation`, `output`), matching the
AC's vector spelling. A consumer maps stem → `Usage` field
(`cache_read` → `cache_read_input_tokens`) at the call site (T-068-01-02's concern, not this
ticket's).

## budget.test.ts — the addition

New import: add `COST_WEIGHTS` (and optionally the `CostWeights` type) to the existing named
import from `./budget.ts` (budget.test.ts:2-9).

New suite, placed after the `countTokens` describe block (so the weights sit next to the
function that will consume them):

```ts
describe("COST_WEIGHTS", () => {
  test("pins the confirmed cost-weight vector (guards against parity drift)", () => {
    expect(COST_WEIGHTS).toEqual({
      input: 1.0,
      cache_read: 0.1,
      cache_creation: 1.25,
      output: 5.0,
    });
  });

  test("input is the numeraire (1.0)", () => {
    expect(COST_WEIGHTS.input).toBe(1.0);
  });

  test("the load-bearing price relationships hold", () => {
    // output is 5× input (lineup-wide ratio)
    expect(COST_WEIGHTS.output).toBe(5 * COST_WEIGHTS.input);
    // cached context is CHEAP — the whole reason for the reweight
    expect(COST_WEIGHTS.cache_read).toBeLessThan(COST_WEIGHTS.input);
    expect(COST_WEIGHTS.cache_read).toBeCloseTo(0.1 * COST_WEIGHTS.input);
    // a cache write costs just above a fresh input token
    expect(COST_WEIGHTS.cache_creation).toBeGreaterThan(COST_WEIGHTS.input);
  });

  test("is frozen (shared read-only singleton)", () => {
    expect(Object.isFrozen(COST_WEIGHTS)).toBe(true);
  });
});
```

## Ordering of changes

1. Add `CostWeights` + `COST_WEIGHTS` to budget.ts.
2. Extend the test import and add the `COST_WEIGHTS` describe block.
3. `bun run check` (typecheck + lint + test) — the gate.

Single atomic commit; the two edits are one logical unit (a constant and its pin) and there
is no meaningful intermediate state to commit separately.

## Blast radius

Additive only. No existing symbol changes signature or value, so no other module can break.
The three DAG-sibling consumers (T-068-01-02/-03/-04) depend on this ticket but are not
edited here — they will import `COST_WEIGHTS` once merged.
