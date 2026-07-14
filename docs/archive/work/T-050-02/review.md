# T-050-02 — Review: thread fundingEnvelope into the cast funding path

Handoff doc. What changed, test coverage, open concerns. The work threads T-050-01's pure
`fundingEnvelope` into the two impure seams where a cast is FUNDED, breaking the censoring ratchet at
runtime while the shelf's quote stays the honest p90.

## What changed

### Source (2 files, both impure shells + 1 pure core helper)
- **`src/play/chain-propose-decompose-core.ts`** (pure core) — added `CHAIN_DEFAULT_TIER = "standard"`
  and `fundedStepDefault(records, play, prior, tier?, opts?) → Budget` =
  `fundingEnvelope(play, records, recalibrate(play, records, tier, prior, …), …).envelope`.
  `resolveStepBudgets` UNCHANGED — funded defaults flow in as its `proposeDefault`/`decomposeDefault`.
- **`src/play/chain-propose-decompose.ts`** (impure shell) — new private `stepDefaults(root, opts)`:
  a `defaultUnused` short-circuit returns the static play budgets WITHOUT reading the ledger when an
  override covers both steps (the `vend work` path — byte-for-byte unchanged); otherwise `loadRunLog`
  once and fund both step defaults. `castProposeDecomposeChain` feeds the result to `resolveStepBudgets`.
- **`src/play/work.ts`** (impure shell) — kept the full per-step `RecalibrateResult`s; `price` stays
  the priced-envelope sum (gates the wallet, UNCHANGED); added `proposeFunding`/`decomposeFunding` via
  `fundingEnvelope`; threaded those as the cast's per-step budgets. `priceOf: () => price` unchanged.

### Tests (1 file)
- **`src/play/chain-propose-decompose-core.test.ts`** — `describe("fundedStepDefault …")`, 6 cases
  (a local `recordOf` fixture). +6 suite tests (1170 → 1176).

### Work artifacts
- `docs/active/work/T-050-02/{research,design,structure,plan,progress,review}.md`.

## Acceptance criteria — status

- **AC#1 — funding threaded into the default rung AND work.ts; override wins.** ✅
  `fundedStepDefault` widens the bare-chain default; work.ts threads `fundingEnvelope` per step. The
  override-still-wins case proves `resolveStepBudgets` precedence holds through the funded default.
- **AC#2 — price stays honest (IA-8).** ✅ `price`, `sumBudgets`, `priceOf`, `budgetForTier`,
  `formatEnvelopeLabel`, and affordability are textually UNCHANGED (diff-verified). The core test
  asserts the sibling `recalibrate(...).envelope` is unchanged after a funding call.
- **AC#3 — P7 holds + back-compat.** ✅ `MEASUREMENT_HEADROOM = 2` is finite; `spendDown`/wallet/
  `debit` untouched (authorizes on `price`, debits ACTUALS, hard-stops). Well-calibrated ⇒ funding ==
  price (core test). The `vend work` path never reads the ledger for an unused default.
- **AC#4 — deterministic E-049 proof, no live model.** ✅ The headline core test: `recalibrate`'s
  envelope stays `120_000` (old path — re-censors) while `fundedStepDefault` funds
  `264_866 × MEASUREMENT_HEADROOM` (room to finish and record). Pure `recordOf` fixtures, no `claude -p`.
- **AC#5 — `bun run check:*` green.** ✅ `bun run check` (baml:gen + `tsc --noEmit` + `bun test`):
  1176 pass, 0 fail, typecheck clean. (No `lint`/`format` script exists in this repo.)

## Test coverage

- **Strong (pure, deterministic):** the bare-chain funded default — the E-049 contrast, price
  honesty, cold-start `prior × headroom`, well-calibrated funding == price, override precedence, and
  totality. This is the same recalibrate→fundingEnvelope composition work.ts uses, so the funding
  math is covered for BOTH seams by one pure proof + the T-050-01 `fundingEnvelope` block.
- **By composition (house pattern):** the two impure shells (`work.ts`, the chain shell) are NOT
  unit-tested — per their headers, their logic is the tested pure core (`fundedStepDefault`,
  `fundingEnvelope`, `recalibrate`, `resolveStepBudgets`, `spendDown`). The full suite proves the
  additive wiring broke nothing.

## Open concerns / follow-ups

1. **Bare-chain cold-start now defaults to `play.budget × 2`.** Intended (T-050-01 spec — "a first run
   gets room to record"), and only the single bare `vend chain`/`vend run` cast is affected (no macro
   wallet to overspend). Worth a live-sweep eyeball that the doubled decompose default actually lets
   the heavy first decompose FINISH and land a `success` (the ratchet break is only observable once a
   real run records above the old wall). Not blocking — the deterministic proof covers the math.
2. **No live end-to-end proof.** By design (the ticket's "no `claude -p`"). The runtime payoff —
   under-calibrated cast funded → finishes → records → recalibrate finally binds a measured envelope —
   is proven only at the unit level. A future `vend work`/`vend chain` live sweep on E-050 is the
   natural confirmation (mirrors how E-038's timeout headroom was confirmed live).
3. **Funding/price observability.** `widened` is computed inside `fundingEnvelope` but neither seam
   currently surfaces it to a log/label (the cast just runs under the wider guard). An honest "funded
   at N (price M, widened)" line is a possible IA-8/IA-10 follow-up — out of scope here (guard ≠ price
   means the *quote* must not show the widened number, but a *funding log* legitimately could).
4. **Play-name/ledger coupling.** `fundedStepDefault`/work.ts key the ledger on
   `proposeEpicPlay.name`/`decomposeEpicPlay.name` (`"propose-epic"`/`"decompose-epic"`) — the same
   names work.ts already used for `recalibrate`, so no new coupling, but a future play-rename must
   keep the registry name and the recorded name in sync (the known `capture-note` class of gotcha).

## Critical issues needing human attention

None. The change is additive, the full gate is green across two atomic commits (be92237, 49822cf),
and the load-bearing invariants (IA-8 price honesty, P7 finite hard-stop, back-compat) are held by
construction and asserted in the pure proof.
