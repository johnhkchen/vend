# Structure — T-038-01 timeout-headroom-lever

The shape of the change. Two files touched, both in `src/budget/`. No new files, no deletions.
No changes to `cast.ts`, `wallet.ts`, `spend-core.ts`, or `recalibrate.ts` — the isolation is
enforced by *not editing them*.

## Files modified

### 1. `src/budget/budget.ts` (the seam)

**Add** an exported constant above `timeoutMsFor`:

```ts
/**
 * Headroom the per-cast wall-clock kill-switch gets ABOVE the measured price. The price
 * (`budget.timeMs`, the tier p90) is what affordability and the shelf read (IA-8 — the
 * meter must not lie); the kill-switch is only a runaway-guard, so it runs at the price
 * × this factor. Set to 2 (double the envelope) from E-037's censored-margin data: the
 * censored `propose-epic` runs were within ~1% of their 72,785 ms p90, so any slack clears
 * THEM, but 2× is chosen so the next heavier signal isn't immediately re-censored.
 *
 * WHY THIS EXISTS — the censoring ratchet: the price is the tier percentile over SUCCESSFUL
 * runs (`recalibrate.ts`); a `timed-out` run is right-CENSORED (`CENSORED_OUTCOMES`,
 * recalibrate.ts:60) — counted but excluded from the percentile sample. So a cast killed AT
 * the envelope can never enter the sample that would RAISE the envelope: the p90 caps itself
 * and prevents the data that would lift it. Raising `TIER_PERCENTILE` alone cannot fix this —
 * the tail is censored out of its own sample (the successes sit at 66.9–72.8 s, the killed
 * runs at ~72–73 s), so a higher percentile just re-reads the same truncated sample.
 *
 * Giving the kill-switch headroom lets a heavy cast FINISH and land a SUCCESS, which enters
 * the sample honestly. The price stays the honest measured p90; only the runaway-guard loosens.
 *
 * DEFERRED (IA-14, the fuller rung this sits beneath): auto-widen the envelope when the
 * censored rate is high (data-driven, possibly per-tier), rather than one warranted constant.
 */
export const TIMEOUT_HEADROOM = 2;
```

**Modify** `timeoutMsFor`'s body (signature unchanged — `(budget: Budget): number`):

```ts
export function timeoutMsFor(budget: Budget): number {
  assertPositiveInt(budget.timeMs, "timeMs");          // contract on the PRICE — unchanged
  return Math.ceil(budget.timeMs * TIMEOUT_HEADROOM);  // runaway-guard: price × headroom, positive int
}
```

Update the existing doc-comment on `timeoutMsFor` (lines 72–77) from "identity-with-validation"
to reflect that it now applies headroom, pointing at `TIMEOUT_HEADROOM` for the rationale (avoid
duplicating the full ratchet explanation — that lives on the constant).

**Public interface delta**: one new export `TIMEOUT_HEADROOM: number`. `timeoutMsFor`'s
signature and validation behavior are unchanged; only its return value scales.

### 2. `src/budget/budget.test.ts` (the proof)

The `describe("timeoutMsFor")` block (lines 47–55) is updated and extended. Import
`TIMEOUT_HEADROOM` (and `timeoutMsFor`, already imported).

- **Update** the verbatim test: `timeoutMsFor(budget(30_000, 1))` now expects
  `30_000 * TIMEOUT_HEADROOM` (asserted against the constant, not a hard-coded number).
- **Keep** the `test.each([0, -1, NaN, 1.5])` RangeError test as-is (input contract unchanged).
- **Add** a test that `TIMEOUT_HEADROOM` is a documented factor with real margin
  (`>= 2`, an integer) — pins the warranted constant so a silent drift to ~1.0 fails the gate.
- **Add** the E-037 mapping test (the deterministic clearance stand-in): with `T = 72_785`,
  assert both censored actuals (72_792, 72_805) are `< timeoutMsFor({ timeMs: T, tokens })`
  — i.e. would finish under the headroomed wall — while `canAfford` on the bare `T` still gates
  affordability (price unchanged). This is the AC #3 proof, no live model.

**Where `canAfford` comes from**: `src/budget/wallet.ts`. The mapping test imports `canAfford`
and `Wallet`/`spendDown` (or constructs a `Wallet`) to demonstrate affordability gates on the
bare `T`. If wiring a real `Wallet` is heavier than the assertion warrants, the test instead
asserts the two halves directly: (a) `timeoutMsFor({timeMs: T})` === `T * HEADROOM` and both
actuals `< that`; (b) the price the wallet would see is `T` (the bare envelope), shown by passing
`{ timeMs: T }` as the predicted budget to `canAfford` against a wallet with exactly `T` ms left
and asserting it fits. Decide concretely in Plan/Implement based on wallet.ts's actual surface.

## Files explicitly NOT changed (the isolation, structurally)

| File | Why untouched |
|---|---|
| `src/engine/cast.ts` | Calls `timeoutMsFor(budget)` at :216 — picks up headroom automatically; the call site is correct as-is. |
| `src/probe/run-equivalence-judge.ts` | Second caller at :317 — also a runner kill-switch, also correctly gets headroom. |
| `src/budget/wallet.ts` | `canAfford` reads `predicted.timeMs` directly — affordability must stay on the price. |
| `src/engine/spend-core.ts` | `fitNext` passes `priceOf(c)` (envelope) to `canAfford` — price path, untouched. |
| `src/ledger/recalibrate.ts` | Computes the p90 price + defines `CENSORED_OUTCOMES` — the ratchet we document, not change. |

## Ordering of changes

1. `budget.ts`: add `TIMEOUT_HEADROOM`, update `timeoutMsFor` body + doc-comment. (Compiles; the
   existing verbatim test now fails — expected, fixed in step 2.)
2. `budget.test.ts`: update the verbatim assertion, add the constant test + the E-037 mapping test.
3. Run `bun run check` → green.

Steps 1 and 2 are one logical change (code + its test) and commit together.

## Module boundaries preserved

`budget.ts` stays PURE (no fs/clock/network/process/seam import) — the change is arithmetic on a
plain value. The new export is a `number` constant. No new dependency edges; nothing imports the
constant except the test (and any future caller that wants to cite the factor).
