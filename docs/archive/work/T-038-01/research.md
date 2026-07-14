# Research — T-038-01 timeout-headroom-lever

Descriptive map of the seam this ticket touches. No solutions here — see `design.md`.

## The finding that motivates this ticket

E-037's live macro-wallet sweep (`work/T-037-02/sweep-log.md`, settled in
`work/T-037-03/verdict.md`) cleared **0**. Not on price, not on tokens — on a per-cast
**wall-clock guillotine**. The board's heaviest signal, `propose-epic`, was killed at
**~72,785 ms** (its p90 time envelope), **twice**, before it could mint any
epic/story/ticket. `0 tokens debited`, wallet barely moved, `lisa validate` green (no partial
mint). Two casts dying at the *same* ~72.8 s wall ⇒ a reproducible structural cap, not a fluke.

The data (`sweep-log.md`):
- `propose-epic` measured p90 envelope (price): **72,785 ms**.
- Run #27: `timed-out`, ~72,792 ms spent (`3,527,208 ms left` of 3,600,000).
- Run #28: `timed-out`, ~72,805 ms spent (`3,527,195 ms left`).
- Both censored runs sit **within ~1%** of the envelope.
- `propose-epic` successes cluster at **66.9–72.8 s** (`verdict.md`).

## The censoring ratchet (the mechanism)

This is the core constraint the ticket names. Trace it through three files:

1. **The kill-switch** — `src/budget/budget.ts:78` `timeoutMsFor(budget)`. Today it is an
   identity-with-validation: `assertPositiveInt(budget.timeMs, "timeMs"); return budget.timeMs;`.
   Its own doc-comment already anticipates growth: *"the named seam gives time-policy one home if
   it ever grows (e.g. reserving a shutdown margin)."* The runner hands its return value to the
   executor seam as `timeoutMs`.

2. **Where it's applied** — `src/engine/cast.ts:216` `timeoutMs: timeoutMsFor(budget)` inside the
   `executor.dispense({...})` call. The seam enforces the stop via SIGKILL → `ExecutorTimeoutError`;
   the `catch` at `cast.ts:221` keys on `ExecutorTimeoutError` and sets `timedOut = true`.
   `classify({ timedOut, ... })` (cast.ts:244) turns that into the `timed-out` outcome.

3. **Why it caps itself** — `src/ledger/recalibrate.ts:60`
   `CENSORED_OUTCOMES = ["budget-exhausted", "timed-out"]`. The envelope is the **tier percentile
   over SUCCESSFUL runs** (`recalibrate`, recalibrate.ts:124); censored runs are right-censored —
   **counted but excluded from the percentile sample** (recalibrate.ts:139–140). So a run killed
   at the envelope can never enter the sample that would *raise* the envelope. The p90 caps itself:
   the tail it would need to observe is exactly the tail it censors. **A censoring ratchet.**

**Why raising the percentile alone cannot fix it.** `TIER_PERCENTILE` (recalibrate.ts:39) already
puts keystone at p95. But the successes all sit at 66.9–72.8 s and the killed runs at ~72–73 s — the
true tail is *censored out of its own sample*. Pushing p90→p95 only re-reads the same truncated
sample; there is no observation above ~72.8 s to bind a higher percentile to. The cap is structural,
not a percentile-choice problem.

## The seam to change, and its callers

`timeoutMsFor` has exactly **two** callers (confirmed via `grep -rn "timeoutMsFor" src/`):
- `src/engine/cast.ts:216` — the autonomous-spend runner (the E-037 path).
- `src/probe/run-equivalence-judge.ts:317` — the equivalence-judge dispense (`judgeEquivalence`),
  another live+metered runner seam.

Both are **runner kill-switches** (the "hand the seam a `timeoutMs`" role). Changing the function
body applies headroom uniformly to both — which is correct: both are per-cast runaway guards, and
both want slack above the price for the same reason. There is no third caller that wants the bare
value as a *timeout*.

## Affordability is isolated from the kill-switch (the critical invariant)

The ticket's load-bearing constraint: **only the kill-switch may change; the price must stay honest
(IA-8, the meter must not lie).** Confirmed by reading the affordability path:

- `src/budget/wallet.ts:113` `canAfford(wallet, predicted)` reads
  `predicted.tokens <= wallet.remaining.tokens && predicted.timeMs <= wallet.remaining.timeMs`.
  It takes the **predicted Budget directly** (`predicted.timeMs`) — it does **not** call
  `timeoutMsFor`. No import of `timeoutMsFor` in wallet.ts.
- `src/engine/spend-core.ts:93` `fitNext(wallet, candidates, priceOf)` walks the ranked board and
  returns the first `c` where `canAfford(wallet, priceOf(c))`. `priceOf(c)` is the recalibrated
  **envelope** (the p90 price). Again, no `timeoutMsFor`.
- The shelf/`envelope` surfaces (`recalibrate.ts` → `formatEnvelopeLabel`) report the bare measured
  `budget.timeMs` p90 as the price. Unchanged by this ticket.

So affordability gates on the **bare measured envelope (the price)**; only the runner's runaway-guard
reads the headroomed value. The change is structurally isolated to `timeoutMsFor`'s body.

## P7 (no overspend past the wall) still holds

`src/budget/wallet.ts` `spendDown`/`debit` (wallet.ts:128–140) debits **real actuals** against the
macro wallet — `timeSpent = f.timeMs - r.timeMs` is the measured elapsed, not the headroomed
allowance. The macro wallet still hard-stops on total actuals; loosening the per-cast guard only
lets an individual cast run longer *up to* what the macro wallet can still afford. The macro total
remains the real ceiling.

## The `assertPositiveInt` contract

`budget.ts:66` `assertPositiveInt(n, label)` throws `RangeError` unless `n` is a positive finite
integer. `timeoutMsFor` calls it on `budget.timeMs` today. `recalibrate.ts:94` `positiveInt(n)` =
`Math.max(1, Math.ceil(n))` is the house pattern for coercing a computed number back to a valid
budget dimension. Any headroomed product must remain a positive integer.

## Existing test surface

`src/budget/budget.test.ts:47` `describe("timeoutMsFor")` has two tests:
- returns the wall-clock allowance verbatim (`30_000` → `30_000`) — **this assertion will change**.
- `test.each([0, -1, NaN, 1.5])` throws `RangeError` for invalid `timeMs` — **stays valid** (input
  validation is unchanged).

This file is pure (no spawn/fs/clock) and is the gate for `check:test`.

## Gate command

`package.json` scripts: the aggregate gate is **`bun run check`** (= `baml:gen && check:typecheck &&
check:test`). Note: `bun run check:*` is a shell glob that fails to expand in zsh (a no-op exit 0) —
the ticket's literal `check:*` should be read as "the check suite", i.e. `bun run check`.

## Open sub-question (call recorded in design.md)

Should affordability gate on the **price** (p90 envelope) or the **headroomed timeout**? The current
code already gates on the price (`canAfford(predicted)` where `predicted` is the envelope). The
recommendation is to **keep gating on the price**: the macro wallet debits real actuals and the macro
total still bounds, so gating on the headroomed (inflated) value would make the wallet refuse
affordable casts for no benefit. This is the status quo — the ticket's change must *not* disturb it.
