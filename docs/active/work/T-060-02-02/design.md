# T-060-02-02 — Design

**Decision:** Replace `vend work`'s hand-picked `DEFAULT_MACRO_BUDGET` omit-default with the
**calibrated cold-start envelope** (`coldStartEnvelope().envelope`). The wallet is funded at that p90
price; the displayed quote IS that p90 price; the E-050 per-cast funding headroom stays separate and
untouched.

## The core insight (why this is small and right)

`work.ts` already computes `price = Σ recalibrate(propose) + recalibrate(decompose)` — which is
*definitionally* `coldStartEnvelope(["propose-epic","decompose-epic"], records, "standard",
budgetForTier("standard")).envelope`. So:

1. The default budget we want is a value `castWork` **already has** under a different name.
2. Funding the wallet at `price` AUTHORIZES the first pull (`canAfford` is `≥`, true at equality),
   and the per-cast funding floor (E-053, 350k tokens) carries the actual clear. So "default =
   calibrated envelope" *mechanically guarantees* "no instant budget-exhausted before a slice clears"
   — the first pull is always affordable, the clear lands, the wallet exhausts only afterward.
3. The quote = `price` (the bare p90), never the funding envelope ⇒ IA-8 stays honest for free.

The fix is therefore: **stop branching the default on a hand-picked constant; make it the price we
already derive.** We route the derivation through `coldStartEnvelope` (the T-060-02-01 unit) so the
provenance (`measured`/`prior`) rides along and the funding legs reuse its `perPlay` breakdown.

## Options considered

### A — Default = `coldStartEnvelope().envelope` (the p90 price). **CHOSEN.**
- `funded = opts.budget ?? cold.envelope`. On a measured ledger this is the real per-clear price
  (tight, fundable). On cold-start it is the summed standard prior `{2h/50k}` — still authorizes the
  first pull (equality) and the floored per-cast funding (350k) carries the clear.
- Quote = `cold.envelope` (p90). Funding-headroom stays per-cast (`fundingEnvelope`, unchanged).
- **+** Literally satisfies the AC in every regime ("default budget equals the calibrated envelope").
  **+** Uses the dependency exactly as handed off. **+** Unifies the pricing block around one
  derivation (removes the two standalone `recalibrate` calls + `sumBudgets`). **+** E-013 philosophy
  (measured, not guessed) finally applied to the work default.
- **−** Changes the GLOBAL `vend work` omit-default for all projects: it now funds the calibrated
  per-clear price (≥1 slice) rather than a 2h/2M multi-clear ceiling. Mitigation: a longer walk-away
  is one explicit `--budget` away; the change is the whole point (the hand-picked ceiling was the
  thing E-013 exists to replace). Documented as a deliberate tradeoff.

### B — Default = `cold.source === "measured" ? cold.envelope : DEFAULT_MACRO_BUDGET`.
Keep the generous 2h/2M on cold-start, tighten to the measured envelope once learned.
- **+** Preserves the exact old cold-start generosity (multi-clear walk-away until measured).
- **−** On cold-start `funded` (2M) ≠ the calibrated envelope ({50k}) — **violates the AC's literal
  "default budget equals the calibrated envelope"** in the cold-start regime. **−** Re-introduces the
  hand-picked constant the ticket is removing. **−** A 2M-token wallet does NOT change what a cast
  burns (each cast still runs under its own funding envelope) — so the extra generosity only buys
  *more* clears, which the cold-start two-gesture drive does not need. Rejected: it pays AC-fidelity
  to preserve a multi-clear behavior the epic explicitly doesn't want here.

### C — Default = Σ funding envelopes (`proposeFunding + decomposeFunding`).
Fund the wallet at the floored per-cast guard so it survives the clear with no overshoot.
- **+** The wallet never overshoots on cold-start.
- **−** **Directly contradicts the AC**: the default would then be the funding-headroom number, and
  "the displayed budget quote remains the p90 price (funding-headroom NOT folded in)" becomes a
  distinction without a difference if the *funded* default already is the funding number. The AC
  wants GUARD ≠ PRICE preserved at the default: wallet authorizes at the price, casts fund at the
  guard. Rejected.

### D — Add a per-seed budget field to the template registry / SEED.md.
- **−** No such mechanism exists; inventing one is a non-goal (N3) and far exceeds a ~one-block
  ticket. The "seed default" is the omit-`--budget` code default the seed docs already point at.
  Rejected as scope inflation (the epic right-sizes this as a single wiring change).

## Chosen shape (A), concretely

**Pure (work-core.ts):**
- `makeWorkBudgetPlan(quote, source, override?) → { funded, quote, source, usedDefault }` — the
  trivial, shared resolution logic: `funded = override ?? quote`, `usedDefault = override === undefined`.
- `planWorkBudget(records, drivePlays, tier, prior, override?) → WorkBudgetPlan` — composes
  `coldStartEnvelope(...)` + `makeWorkBudgetPlan(envelope, source, override)`. The named unit the AC
  test pins (mirrors what `castWork` does); also usable by any caller wanting the plan without the
  `perPlay` legs.
- `renderBudgetQuote(plan, { color? }) → string` — a one-line honest quote (the two IA-8
  denominations + a `measured`/`estimate (cold start)` provenance tag), rendered only when the
  default was used. Pure; tested like `renderReceipt`.

**Impure (work.ts):**
- Reorder: `loadRunLog` BEFORE the wallet allocation. Compute `cold = coldStartEnvelope(drivePlays,
  records, PRICE_TIER, prior)` once. `price = cold.envelope`; `funded = makeWorkBudgetPlan(cold.envelope,
  cold.source, opts.budget).funded`. Funding legs read `cold.perPlay[i].result` (no extra recalibrate).
- Drop `DEFAULT_MACRO_BUDGET`, `sumBudgets`, and the `recalibrate` import (now via `coldStartEnvelope`).
- New `onPlan?(plan)` option: emitted after the budget is resolved, before the loop — lets the CLI
  print the quote and capture `funded` for the streaming meter.

**CLI (cli.ts):** drop `DEFAULT_MACRO_BUDGET`; pass `budget` only when present; in `onPlan`, print
`renderBudgetQuote` (when `usedDefault`) and capture `funded` for `formatStepSignal`; use
`result.funded` for the final receipt wallet.

**Seed docs:** correct README.md / shelf-note.md's "defaults to 2h/2M" lines to "funds the calibrated
cold-start clear at the p90 quote." `EXPECTED-OUTCOME.md` is left to T-060-03-01.

## Honesty / IA-8 ledger

- **Quote = p90 price.** `plan.quote = cold.envelope`. `renderBudgetQuote` shows exactly that. The
  funding-headroom (`fundingEnvelope`, ≥ price when censored tails exist) is never in the quote.
- **Provenance never laundered.** `plan.source` ("measured"/"prior") flows to the quote label, so a
  cold-start estimate can't be mistaken for an earned one.
- **GUARD ≠ PRICE preserved.** Wallet authorizes at `price`; each cast funds at its `fundingEnvelope`;
  the wallet debits actuals. Exactly the existing E-050 split — we only changed what the *default
  wallet size* is.
