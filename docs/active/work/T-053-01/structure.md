# T-053-01 — Structure

The blueprint: exact file-level changes, interfaces, ordering. No code bodies beyond signatures.

## Files

### Modified: `src/ledger/recalibrate.ts`

Five edits, all within the funding sub-module (lines ~202–295). Nothing else in the file changes.

**E1 — Two new exported constants** (after `CENSORED_WIDEN_RATE`, ~line 214):

```ts
export const FUNDING_FLOOR_TOKENS = 350_000;   // below this we don't care; every cast funded ≥ floor
export const FUNDING_CEILING_TOKENS = 700_000; // hard P7 wall; no cast funded beyond this
```

Each with a doc-comment in the style of `MEASUREMENT_HEADROOM` (what it is, why finite/P7, the
failure it addresses — too-tight floor / runaway ceiling).

**E2 — Two new `FundingOptions` fields** (in the existing interface, ~lines 216–225):

```ts
readonly floorTokens?: number;   // default FUNDING_FLOOR_TOKENS
readonly ceilingTokens?: number; // default FUNDING_CEILING_TOKENS
```

with one-line `@link` doc-comments mirroring `widenRate` / `headroom`.

**E3 — New private helper `bandTokens`** (beside `fundDimension`, ~line 241):

```ts
/** Clamp a TOKEN funding value to the rational band [floor, ceiling] (E-053) — the outermost
 *  bound, applied AFTER the headroom max(). Floor lifts a too-tight p90 (so a tail draw never
 *  starves a real cast); ceiling caps runaway self-funding (the hard P7 wall). TOKENS only —
 *  wall-clock keeps its E-038 headroom. Reuses positiveInt for the budget-dimension contract. */
function bandTokens(tokens: number, floor: number, ceiling: number): number {
  return positiveInt(Math.min(ceiling, Math.max(floor, tokens)));
}
```

**E4 — Resolve band knobs + clamp the measured-clean early return** (~lines 260–276):

- After the existing `const headroom = …` line, add:
  `const floor = opts.floorTokens ?? FUNDING_FLOOR_TOKENS;`
  `const ceiling = opts.ceilingTokens ?? FUNDING_CEILING_TOKENS;`
- The trusted-measured early return becomes (tokens banded, time verbatim, `widened: false`):
  ```ts
  if (!underCalibrated) {
    return { envelope: { timeMs: priced.timeMs, tokens: bandTokens(priced.tokens, floor, ceiling) }, widened: false };
  }
  ```
  (Was `return { envelope: { ...priced }, widened: false };`.)

**E5 — Clamp the under-calibrated widened return** (~lines 287–294):

- Keep `fundDimension` producing the un-banded `tokens` / `timeMs`.
- Compute `widened` on the **un-banded** tokens exactly as today (preserve headroom-signal meaning).
- Band the token dimension into the returned envelope:
  ```ts
  const tokens = fundDimension(priced.tokens, censoredTokens, headroom);
  const timeMs = fundDimension(priced.timeMs, censoredTimes, headroom);
  const widened = tokens > priced.tokens || timeMs > priced.timeMs; // un-banded, headroom signal
  const envelope: Budget = { timeMs, tokens: bandTokens(tokens, floor, ceiling) };
  return { envelope, widened };
  ```

### Modified: `src/ledger/recalibrate.test.ts`

Append cases inside the existing `describe("fundingEnvelope — measurement-funding guard (T-050-01)")`
block — or a sibling `describe("fundingEnvelope — rational band (T-053-01)")`. Chosen: a **new
sibling describe** so the band cases are self-documenting and the T-050-01 block stays intact.

Add `FUNDING_FLOOR_TOKENS`, `FUNDING_CEILING_TOKENS` to the import list (line 4–19).

New cases (see plan.md for exact assertions):
1. below-floor, measured-clean → `tokens === 350_000`, `widened === false`, time untouched.
2. above-ceiling, self-fund → `tokens === 700_000`, `widened === true`.
3. in-band (measured) → tokens unchanged (e.g. 450k → 450k).
4. price/quote untouched across the call (snapshot `result.envelope` + `formatEnvelopeLabel`).
5. wall-clock untouched (band on tokens only; huge time prior passes through).
6. opts override (`floorTokens`/`ceilingTokens`) drives a small synthetic band.
7. constants finite positive ints (P7), floor < ceiling.

## Public interface delta

- **Added exports:** `FUNDING_FLOOR_TOKENS`, `FUNDING_CEILING_TOKENS` (consts).
- **Widened interface:** `FundingOptions` gains optional `floorTokens` / `ceilingTokens`.
- **Unchanged:** `FundingResult` shape, `fundingEnvelope` signature, `recalibrate`, `percentile`,
  `formatEnvelopeLabel`, `calibrate`, `learnBiasFactor`, all of `budget.ts`, `work.ts`,
  `resolveStepBudgets`. No call-site edits anywhere (E-050 threading already in place).

## Ordering

1. E1 (constants) — nothing depends on later edits.
2. E2 (opts fields).
3. E3 (`bandTokens` helper).
4. E4 + E5 (apply the clamp at both returns) — depend on E1/E3.
5. Tests — depend on the new exports.

All edits are in one file (plus its test); a single atomic commit is appropriate. `bandTokens` and
the constants are dead until E4/E5 wire them, so intermediate states are still type-clean.

## Invariants preserved (checklist for Review)

- Tokens-only band; `timeMs` never clamped.
- `result.envelope` / percentile / `formatEnvelopeLabel` byte-identical (IA-8).
- `canAfford` / `fitNext` untouched (gate on price).
- `widened` keeps headroom-signal meaning (computed pre-band).
- PURE/TOTAL; constants finite positive ints (P7).
