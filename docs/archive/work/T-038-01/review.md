# Review — T-038-01 timeout-headroom-lever

Handoff for a human reviewer. What changed, how it's proven, what to know.

## What changed

Two files, both pure, both in `src/budget/`. The whole change is one constant + one function body
+ the tests that pin them.

### `src/budget/budget.ts` (modified)
- **Added** `export const TIMEOUT_HEADROOM = 2;` with a doc-comment that *is* the AC #4 deliverable:
  it documents the censoring ratchet (p90-as-timeout excludes the killed run from the sample that
  would raise it), why raising `TIER_PERCENTILE` alone can't fix it (the tail is censored out of its
  own sample — successes at 66.9–72.8 s, kills at ~72–73 s), the 2× justification from E-037's
  ~1%-over censored margin, and the **IA-14-deferred** fuller rung (auto-widen on censored rate).
- **Changed** `timeoutMsFor` body: `assertPositiveInt(budget.timeMs, "timeMs")` (unchanged) then
  `return Math.ceil(budget.timeMs * TIMEOUT_HEADROOM)`. Signature unchanged. `Math.ceil` keeps the
  result a positive integer (budget-dimension contract) and is robust to a future fractional factor.
- **Rewrote** the `timeoutMsFor` doc-comment to describe the headroom (was "identity-with-validation").

### `src/budget/budget.test.ts` (modified)
- Imports `TIMEOUT_HEADROOM` from `./budget.ts` and `allocate, canAfford` from `./wallet.ts`.
- Verbatim test updated → `timeoutMsFor(budget(30_000,1)) === 30_000 * TIMEOUT_HEADROOM`.
- `test.each([0,-1,NaN,1.5])` RangeError test unchanged (input contract preserved).
- New: `TIMEOUT_HEADROOM` is an integer ≥ 2 (pins the warranted constant against silent drift).
- New: the E-037 mapping (AC #3) — `T = 72_785`; both censored actuals `[72_792, 72_805]` finish
  under `timeoutMsFor(budget(T,1))` (= `T × HEADROOM`); affordability via real `canAfford`/`allocate`
  gates on the bare `T` (`T` fits in `T`, `T+1` does not).

### Files deliberately NOT changed
`cast.ts`, `run-equivalence-judge.ts` (the two `timeoutMsFor` callers — they get headroom for free,
correctly), `wallet.ts`, `spend-core.ts`, `recalibrate.ts`. The price path is untouched **by
construction** — isolation is enforced by not editing it.

## Acceptance criteria — all met

| AC | Status | Evidence |
|---|---|---|
| 1. `timeoutMsFor` returns `timeMs × HEADROOM`, documented constant, `assertPositiveInt` preserved | ✅ | `budget.ts` `timeoutMsFor` + `TIMEOUT_HEADROOM`; verbatim test + RangeError test |
| 2. Only the kill-switch changes; affordability/shelf read bare `budget.timeMs` (IA-8) | ✅ | `git status` = only `budget.ts`/`budget.test.ts`; mapping test pins `canAfford` on `T`; no edit to wallet/spend-core/recalibrate |
| 3. Deterministic proof incl. E-037 ~72–73 s mapping, no live model | ✅ | the mapping test (T=72_785, actuals 72_792/72_805 < 2× wall) — pure, no `dispense` |
| 4. Ratchet + IA-14-deferred rationale documented at the definition | ✅ | `TIMEOUT_HEADROOM` doc-comment in `budget.ts` |
| 5. Gate green | ✅ | `bun run check` → tsc clean, 1000 pass / 0 fail / 2447 expects |

(Note on AC #5: the ticket literally says `bun run check:*`; that's a zsh glob that no-ops. The real
aggregate gate is `bun run check` — run and green.)

## Test coverage

- The changed branch of `timeoutMsFor` is fully unit-covered: headroomed return, preserved input
  contract (`RangeError` on `0/-1/NaN/1.5`), the pinned constant, and the E-037 deterministic
  mapping including the affordability-stays-on-price half.
- All 1000 tests across 66 files pass — no regression in the two downstream callers' suites
  (`cast` / `run-equivalence-judge` tests still green with the now-2× timeout, confirming nothing
  depended on the bare-value identity).
- The module stays PURE (no fs/clock/network/process/seam). No integration test added — correct per
  the honest boundary (no live model in this ticket).

## Open concerns / known limitations

1. **This does not prove the heavy signal clears live.** The honest boundary (stated in design,
   progress, and the verdict it descends from): removing the guillotine ≠ demonstrating
   `propose-epic` now mints under the 2× wall. That live re-run is **Frontier 1's next pull (now
   unblocked)**, not this ticket. A reviewer should not read green tests as "the sweep now clears."
2. **`HEADROOM = 2` is a warranted constant, not a tuned one.** It is justified from E-037's
   censored margin and chosen for class-level slack, but it is a judgment call. The principled,
   data-driven successor is **IA-14** (auto-widen on a high censored rate, possibly per-tier),
   documented as the deferred rung at the definition — out of scope here.
3. **Both callers now run at 2× wall-clock before SIGKILL.** Intended (both are runaway-guards), and
   bounded above by the macro wallet's real-actuals debit, so **P7 holds** — no unbounded-spend
   risk. Worth a reviewer's glance only to confirm they agree the equivalence-judge also wants
   headroom (it does — it's a live+metered dispense like any cast).

## Critical issues needing human attention

None. Lowest-risk change class (single-factor arithmetic in a pure, fully-tested module). Not
committed — left in the working tree per the workflow (Lisa handles commit/phase transitions).

## Handoff

Working tree: `src/budget/budget.ts`, `src/budget/budget.test.ts` (the change) + the six
`docs/active/work/T-038-01/*.md` artifacts. Next real-world step is owned by Frontier 1: re-run the
E-037 live sweep on the heavy signal now that the per-cast guillotine has headroom.
