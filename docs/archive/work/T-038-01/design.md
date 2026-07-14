# Design — T-038-01 timeout-headroom-lever

One factor, one seam. Decide the headroom constant and where it lives, grounded in the
research. See `research.md` for the ratchet mechanism and the isolation proof.

## The decision

`timeoutMsFor(budget)` returns `budget.timeMs × HEADROOM`, where `HEADROOM` is a **named,
documented constant = 2**, coerced to a positive integer. The price (`budget.timeMs`,
read directly by `canAfford`/`fitNext` and the shelf surfaces) is untouched. Only the
runner's runaway-guard gains slack.

```ts
export const TIMEOUT_HEADROOM = 2;

export function timeoutMsFor(budget: Budget): number {
  assertPositiveInt(budget.timeMs, "timeMs");      // contract on the PRICE, unchanged
  return Math.ceil(budget.timeMs * TIMEOUT_HEADROOM); // positive int (price>0, headroom≥1)
}
```

## Why a constant factor (not the alternatives)

### Considered: raise `TIER_PERCENTILE` (do nothing to the kill-switch)
**Rejected.** This is the option the finding explicitly rules out. The successes sit at 66.9–72.8 s
and the censored runs at ~72–73 s — the true tail is *censored out of its own sample*
(`recalibrate.ts:139–140`). Re-reading a truncated sample at a higher percentile binds to the same
max-observed value (~72.8 s); there is no observation above the wall to lift the bound to. It cannot
break the ratchet. (Documented at the definition per the AC.)

### Considered: a fixed additive margin (`timeMs + 60_000`)
**Rejected.** An absolute pad doesn't scale with the play. 60 s is generous for a 5 s leaf cast and
thin for a 72 s keystone. The censoring is proportional to how heavy the signal is, so the slack
should be proportional too. A multiplicative factor scales with the envelope by construction.

### Considered: a small factor (~1.05, "just clear the observed margin")
**Rejected.** The censored runs were within ~1% of the envelope, so even 1.05× clears *these two*.
But the next heavier signal on the board would be re-censored immediately — we'd be back to filing
a ticket per signal. The lever should give the *class* of heavy signals room, not patch two data
points.

### Chosen: `HEADROOM = 2` (double the envelope)
**Selected.** Real margin: a cast may take up to **2× its measured p90** before the guard fires.
The censored runs (~1% over) clear trivially; the next heavier signal has a full envelope of slack
before it re-censors. 2 is a round, defensible "this is a runaway guard, not a tight budget" number —
the kill-switch exists to stop a *hung* process, not to enforce the price (the macro wallet does
that, on actuals). Justified at the definition from the censored-margin data.

### Considered: per-tier headroom (keystone gets more than leaf)
**Rejected for this ticket** — it's the IA-14 fuller rung (auto-widen on a high censored rate). A
single warranted constant is the surgical fix; a data-driven, per-tier or censored-rate-actuated
widen is a larger design that belongs above this. Documented as the deferred rung at the definition.

## Where the constant lives

In `budget.ts`, exported as `TIMEOUT_HEADROOM`, adjacent to `timeoutMsFor`. Rationale: budget.ts is
the PURE time-policy home (its own header: *"`timeoutMsFor` derives the wall-clock allowance"*), and
the doc-comment already names this seam as where time-policy grows. Exporting it (vs a file-local
const) lets the test assert `T × TIMEOUT_HEADROOM` without hard-coding 2, and lets any future reader
cite the one source of truth.

## Coercion: preserve the `assertPositiveInt` contract

- **Input guard unchanged**: `assertPositiveInt(budget.timeMs, "timeMs")` still runs first, so an
  invalid *price* still throws `RangeError` (the existing `test.each([0,-1,NaN,1.5])` stays green).
- **Output stays a positive int**: `budget.timeMs` is a positive integer and `TIMEOUT_HEADROOM = 2`,
  so the product is already a positive integer; `Math.ceil` is belt-and-suspenders that also keeps
  the output valid if `HEADROOM` ever becomes fractional (mirrors `recalibrate.ts:94` `positiveInt`).
  We do not need `Math.max(1, …)` because price ≥ 1 and headroom ≥ 1 guarantee ≥ 1.

## Both callers get the headroom — intended

`timeoutMsFor` is called by `cast.ts:216` (the spend runner) and
`run-equivalence-judge.ts:317` (the equivalence judge). Both are runner kill-switches; both should
have headroom for the same reason (a runaway-guard, not a price). No caller wants the bare value *as
a timeout*. So changing the function body — not threading a new parameter — is the correct, minimal
edit. (If a future caller ever needs the raw price as a timeout, it should read `budget.timeMs`
directly, which is what affordability already does.)

## The isolation guarantee (AC #2)

Confirmed in research: `canAfford` (wallet.ts:113) reads `predicted.timeMs`; `fitNext`
(spend-core.ts:93) passes `priceOf(c)` (the envelope) to it; neither imports `timeoutMsFor`. The
shelf/`formatEnvelopeLabel` surfaces report the bare p90. **The price stays the honest measured p90;
only the runaway-guard loosens.** No edit to wallet.ts, spend-core.ts, recalibrate.ts, or cast.ts is
required or made.

## The open sub-question — the call

**Affordability gates on the price (the bare p90), not the headroomed timeout.** This is already the
status quo and we preserve it. Rationale: the macro wallet debits **real actuals** (`spendDown`,
wallet.ts), and the macro total still bounds total spend (P7). Gating affordability on the inflated
2× value would make `fitNext` refuse casts the wallet can actually afford, shrinking throughput for
no safety gain — the per-cast guard already prevents a single runaway, and the wallet already
prevents aggregate overspend. So: **price for affordability, headroom for the guard.** Recorded here
per the ticket.

## Honest boundary (what this does NOT do)

This removes the guillotine **deterministically** (a unit test proves `T × HEADROOM` with
affordability on `T`, and maps E-037's ~72–73 s runs to "finishes under the headroomed wall"). It
does **not** prove the heavy `propose-epic` signal now *clears* live — that re-run is Frontier 1's
next pull (now unblocked), not this ticket. No live model is invoked here.

## Proof strategy

Pure unit tests in `budget.test.ts` (the existing gate file):
1. `timeoutMsFor` returns `T × HEADROOM` for a representative `T` (the verbatim test is updated).
2. The constant is exported and equals the documented factor.
3. **The E-037 mapping**: for `T = 72_785` (the measured envelope) and the two censored actuals
   (~72,792 / 72,805 ms), assert `actual < timeoutMsFor({timeMs: T, ...})` — i.e. both would finish
   under the headroomed wall — *while* `canAfford` on the bare `T` still gates affordability. This is
   the deterministic stand-in for the live clearance, with no model.
4. The invalid-`timeMs` `RangeError` cases stay (input contract unchanged).
