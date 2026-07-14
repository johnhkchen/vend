# T-053-02 — Design

Goal: prove the three rational-band outcomes the epic exists for, **through the real cast-funding +
authorization paths**, with deterministic stub-record fixtures and no `src` change beyond T-053-01.

## The three things to prove (from the ticket ACs)

1. **Floor fixes the `vend chain` halt** — a well-calibrated `propose-epic` (p90 ~170k) funds at ≥ 350k
   through `resolveStepBudgets` / `fundedStepDefault` (the cast funding path), so a 176k actual no longer
   exhausts.
2. **Ceiling caps the runaway** — an under-calibrated `decompose-epic` whose `fundingEnvelope` would
   compute ~733k is funded at exactly 700k.
3. **GUARD ≠ PRICE held** — the macro-wallet authorizes on the honest (unbanded) `price` and debits
   actuals; `canAfford` / `fitNext` see the unbanded price; `formatEnvelopeLabel` quote unchanged.

All three are **compositional** claims (the band on the *path*, not the unit — T-053-01 already proved
the unit). The design question is purely *where the tests live and how the fixtures are shaped*.

## Option A — extend `chain-propose-decompose-core.test.ts` (rejected)

Add the band-through-the-path cases to the existing T-050-02 `describe`. Pro: the funding-path home;
`fundedStepDefault` / `resolveStepBudgets` already imported. Con: AC#3 (GUARD ≠ PRICE) needs `fitNext`
/ `canAfford` / `allocate` (engine + wallet) **and** `formatEnvelopeLabel` (ledger) — imports that file
deliberately does not carry (it imports "only the pure core + the `Budget` type", per its header
comment, to stay minimal). Bolting the engine + wallet + ledger price path onto it muddies that file's
single responsibility (the per-step rung order) and mixes two distinct contracts in one `describe`.

## Option B — new dedicated end-to-end test file (CHOSEN)

`src/play/chain-funding-band-e2e.test.ts`. It is the natural home because the proof is **genuinely
cross-module** — it spans the funding path (`fundedStepDefault` / `resolveStepBudgets`, `src/play`), the
authorization path (`fitNext` / `canAfford`, `src/engine` + `src/budget`), and the price/quote
(`recalibrate` / `formatEnvelopeLabel`, `src/ledger`). All of these are **pure / addon-free**, so a
single `bun test` file can import them all and reconstruct exactly the composition `work.ts:202-218`
performs, without value-importing the BAML chain shell.

- **Pro:** one file that reads as "the band, proven end-to-end" — the handoff artifact a reviewer reads
  to believe the epic is done. Keeps each per-module test file focused on its unit.
- **Pro:** mirrors the existing precedent of a pure e2e composition test (the engine's `spend-core` +
  wallet are designed to be composed and tested without the shell).
- **Con:** a new file. Acceptable — the ticket explicitly scopes "a test-only helper to drive
  `resolveStepBudgets` with a stub ledger" as in-bounds, and a file is the cleanest home for it.

**Decision: Option B.** A dedicated `chain-funding-band-e2e.test.ts`, addon-free, reconstructing the
work.ts price + funding composition from the pure cores.

## Fixture design (deterministic, the exact epic shapes)

### AC#1 — propose floor (the `vend chain` halt fixed)
10 successes, 0 censored ⇒ `source: "measured"`, with the p90 pinned to **169 873** (the real envelope
that budget-exhausted at 176 101). `recordOf` ascending tokens with the 9th value = `169_873` (nearest-
rank p90 at `idx 8`). Then:
- `fundedStepDefault(records, "propose-epic", prior)` with **default** band ⇒ measured-clean path ⇒
  `bandTokens(169_873, 350k, 700k) = 350_000`. Assert `funded.tokens === 350_000 ≥ FUNDING_FLOOR_TOKENS`
  and `176_101 < funded.tokens` (the tail draw that exhausted now fits).
- `resolveStepBudgets({}, fundedPropose, fundedDecompose).proposeBudget === fundedPropose` — proves the
  banded funded default is what the chain casts under (the path, not just the helper).

### AC#2 — decompose ceiling (the E-051 runaway capped)
Cold-start prior (2 successes < 3) + 1 censored run logging **366 500** tokens. Under-calibrated ⇒
`fundDimension = max(prior, 366_500 × 2 = 733_000) = 733_000`; `bandTokens(733_000, …) = 700_000`.
- `fundedStepDefault(records, "decompose-epic", prior)` with **default** band ⇒ `funded.tokens ===
  700_000 === FUNDING_CEILING_TOKENS`, and strictly `< 733_000` (the runaway is capped).

### AC#3 — GUARD ≠ PRICE (the regression guard)
Reuse the two fixtures so price and funding **provably diverge**:
- propose price = `recalibrate(...).envelope.tokens = 169_873`; propose funding = `350_000`.
- decompose price = `recalibrate(...).envelope.tokens = 120_000` (the cold-start prior); funding =
  `700_000`.
- `price = sumBudgets = 169_873 + 120_000 = 289_873`; funding sum = `350_000 + 700_000 = 1_050_000`.

Assertions (mirroring `work.ts`'s `priceOf: () => price` → `fitNext`):
1. The reconstructed `price.tokens === 289_873` — the **unbanded p90 sum**, NOT `1_050_000`.
2. A wallet sized **between** price and funding (e.g. 300 000 tokens) still affords: `fitNext(wallet,
   [signal], () => price) !== null` and `canAfford(wallet, price) === true` — authorization gates on the
   honest price, not the inflated banded funding (else this wallet would be refused).
3. A wallet **below** price (e.g. 250 000) is refused: `fitNext(...) === null` — it gates on the real
   price magnitude (and not on the 350k floor either; 250k < 289_873).
4. `formatEnvelopeLabel(result)` is byte-identical before and after the `fundingEnvelope` call for each
   step — the quoted estimate never moved (IA-8).

Including a small `debit(wallet, actual)` illustration is **out of scope** — the wallet-debits-actuals
contract is owned by existing `wallet.test.ts` / `spend-core.test.ts` coverage; re-proving it here would
duplicate, not add. We assert the *authorization-on-price* half, which is what the band could regress.

## What is deliberately NOT done

- No change to `src/**` — the band auto-flows; T-053-01 is the only production change.
- No live-model / spawn / fs — pure fabricated `RunRecord`s via `recordOf`.
- No re-test of `bandTokens` on the unit (T-053-01 owns that) — only the band **through the path**.
- No assertion on wall-clock banding here (T-053-01 owns "time is never banded"); the e2e fixtures keep
  time comfortably inside the wallet so it never confounds the token assertions.

## Risk / mitigation

- **Risk:** a fixture's p90 drifts if `recordOf` defaults change. *Mitigation:* assert the
  `recalibrate(...).envelope.tokens` value explicitly in each test before asserting the funded value, so
  a drift fails loudly at the price step, not silently at the band.
- **Risk:** time dimension accidentally binds the wallet in AC#3. *Mitigation:* size the wallet's `timeMs`
  generously (`Number.MAX_SAFE_INTEGER`-ish) so only tokens decide `canAfford`.
