# T-050-02 — Design: thread fundingEnvelope into the cast funding path

Enumerate the viable approaches per seam, decide, justify against the research. The shape of the
decision; the file-level blueprint is `structure.md`.

## The decision in one line

Thread `fundingEnvelope` at BOTH seams as a strict post-processor of the per-step `RecalibrateResult`:
the **price** keeps gating authorization (the honest p90), the **funding** envelope is what each cast
RUNS under. Seam A (work.ts) computes funding inline (already recalibrates). Seam B (the bare-chain
default rung) gets a new PURE core helper `fundedStepDefault` so the composition is unit-tested, with
the ledger READ in the impure shell and skipped when overrides already cover both steps.

## Seam A — work.ts (the `vend work` macro loop)

### Options

- **A1 — Fund the per-step override, keep `price` honest (CHOSEN).** Keep the full per-step
  `RecalibrateResult`; `price = sumBudgets(proposeResult.envelope, decomposeResult.envelope)` gates
  the wallet UNCHANGED; compute `proposeFunding = fundingEnvelope(name, records, proposeResult).envelope`
  (and decompose) and thread THOSE as `proposeBudget`/`decomposeBudget` into the cast. `priceOf`
  stays `() => price`.
- **A2 — Fund the price too (authorize on funding).** Make `price` the funding sum so the wallet
  authorizes on the widened number. REJECTED: violates IA-8 (the quote would lie — the user is shown
  a price inflated by a runaway-guard) and breaks the deterministic-proof AC ("the quoted price for
  that cast is unchanged"). It also over-reserves the wallet, clearing fewer signals.
- **A3 — Push funding into the chain shell (let Seam B handle work.ts too).** Drop work.ts's per-step
  overrides and let the chain default rung fund. REJECTED: work.ts must keep AUTHORIZING on the
  honest price (its whole P7 contract is "the price gates; the wallet debits actuals") — it needs the
  price and the funding as TWO distinct values at the same site. Folding them loses the split.

**Why A1.** It is the literal expression of guard ≠ price at the one site that owns both numbers.
The data is already in scope (`records`, per-step `RecalibrateResult`). It is exactly E-038's
`timeoutMsFor` split lifted to tokens: authorize at `price`, run under `× headroom`. spendDown's P7
is untouched — it still debits ACTUALS and hard-stops; a well-calibrated play funds == price (A1 is
a no-op there, back-compat). The change is ~4 lines + threading two names.

## Seam B — the bare `vend chain` / `vend run` default rung

This is where E-049 actually censored (120k decompose default). work.ts never reaches it (it always
overrides). The default rung must become measurement-funded over the ledger.

### Options

- **B1 — `recalibrate` + `fundingEnvelope` inline in the impure shell only.** REJECTED: the
  composition (recalibrate → fundingEnvelope → pick envelope) would live in the untested shell. The
  house pattern + the ticket's "apply fundingEnvelope there" + the deterministic-proof AC all want a
  PURE, unit-tested seam. `fundingEnvelope`/`recalibrate` are individually tested, but the
  cold-start-prior-as-`play.budget` composition and the old-vs-new contrast are this ticket's proof.
- **B2 — Fold funding INTO `resolveStepBudgets` (thread records/names/priors/tier through it).**
  REJECTED: conflates rung-resolution with funding-derivation and bloats a 3-arg pure fn into a
  7-arg one. `resolveStepBudgets`'s job is the `per-step ?? uniform ?? default` precedence; the
  default's PROVENANCE (static vs funded) is a separate concern. Keeping them separate preserves the
  existing tests verbatim.
- **B3 — New PURE core helper `fundedStepDefault(records, play, prior, tier?, opts?) → Budget`;
  shell loads the ledger ONCE and passes the funded defaults INTO the unchanged `resolveStepBudgets`
  (CHOSEN).** The helper is `fundingEnvelope(play, records, recalibrate(play, records, tier, prior)).envelope`.
  The shell computes funded defaults only when a default will actually be used; otherwise it skips
  the ledger and returns the static play budgets (so the `vend work` path is byte-for-byte unchanged).

**Why B3.**
- The funded-default composition becomes a one-line pure function, unit-tested in the addon-free
  `chain-propose-decompose-core.test.ts` with the same `recordOf` fixtures — the home for the
  deterministic E-049 proof (AC#4).
- `resolveStepBudgets` is UNCHANGED — its existing tests and rung precedence hold verbatim, so an
  explicit `--budget`/per-step override still wins (the human's ceiling is the human's, AC#1).
- The default's `priced` is the play's own static `.budget` used as the recalibrate PRIOR: a
  well-calibrated play recalibrates to its measured p90 and funds == that (no headroom); a cold-start
  play funds at `prior × headroom` (room to record); an under-calibrated play funds over its censored
  lower bound. "Funding == priced" back-compat (AC#3) holds in the funding sense.
- The shell's `bothOverridden` guard keeps `vend work` (and any explicit `--budget`) off the ledger:
  no wasted fs read, no behavior change where a default is never consulted.

### The tier for the bare-chain default

The bare chain has no value-tier in scope (no board row). Use `"standard"` — the same neutral middle
work.ts's `PRICE_TIER` uses (the `envelope`/`audit` arms' default). Exposed as a named const
`CHAIN_DEFAULT_TIER` so the choice is legible and overridable in tests. The tier only selects the
percentile WHEN there is measured history; on cold-start recalibrate returns the prior regardless.

## Cross-seam invariants (both)

- **Price honest (IA-8).** Neither seam changes `sumBudgets`, `priceOf`, `budgetForTier`,
  `formatEnvelopeLabel`, or affordability. Proven by asserting `recalibrate(...).envelope` is
  unchanged alongside a `fundedStepDefault`/`fundingEnvelope` call.
- **P7 finite + hard-stop.** `MEASUREMENT_HEADROOM = 2` is finite; `spendDown` debits actuals and
  stops. Unchanged — confirmed in review, not added.
- **Back-compat.** Well-calibrated `measured` + low censored rate ⇒ funding == priced at both seams.
- **No live model.** All proofs are pure: `recordOf` fixtures → `recalibrate` → `fundedStepDefault`/
  `fundingEnvelope`. The impure shells (work.ts, chain shell) are proven by composition of the tested
  pure core (their stated house pattern).

## What is deliberately NOT changed

- `resolveStepBudgets` signature/body (B2 rejected) — defaults flow in pre-funded.
- `recalibrate` / `fundingEnvelope` / `budget.ts` — consumed as-is (T-050-01 is the core).
- `spendDown` / wallet / `sumBudgets` / `priceOf` — the price still gates; actuals still debit.
- The shelf, affordability, and label surfaces — the quote stays the measured p90.

## Risk ledger

- **Bare-chain cold-start now defaults to `play.budget × 2`.** Intended (room to record, T-050-01
  spec). Only the bare `vend chain`/`vend run` single cast — no macro wallet to overspend. Documented.
- **Shell gains an fs read on the bare-chain path.** Cheap vs an LLM cast; ENOENT-safe (cold project
  ⇒ empty records ⇒ cold-start funding). Skipped entirely when overrides cover both steps.
- **Play-name/ledger mismatch.** Uses `proposeEpicPlay.name`/`decomposeEpicPlay.name` exactly as
  work.ts already does for `recalibrate`, so no new coupling.
