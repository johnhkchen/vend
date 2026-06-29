# T-060-02-02 — Research

**Ticket:** wire-calibrated-envelope-as-hackathon-seed-default-budget (S-060-02 · E-060)
**Phase:** Research — map the territory, no solutions.
**Depends on:** T-060-02-01 (`coldStartEnvelope`, landed `f21b254`).

## The ask, restated

Set the hackathon-seed drive's default `--budget` (the budget `vend work` funds when the user omits
`--budget`) to the **calibrated cold-start envelope** that T-060-02-01 derives, so a tight two-gesture
run funds a real cold-start clear instead of colliding with the P7 hard wall. Keep IA-8 honest: the
**displayed quote stays the p90 price**, never the E-050 funding-headroom number.

## What already exists (the dependency)

`src/ledger/recalibrate.ts` now exports `coldStartEnvelope(plays, records, tier, prior, opts?)`
(lines 380–393), built by T-060-02-01 specifically for this wiring:

- Returns `{ envelope, source, perPlay }`. `envelope` = the per-denomination **Σ** of each drive
  play's `recalibrate(...)` envelope — i.e. the per-clear price of the propose→decompose chain.
- `source` is `"measured"` iff EVERY constituent recalibrate was measured; one cold-start leg ⇒
  aggregate `"prior"` (a macro budget is only as earned as its weakest leg).
- `perPlay: { play, result: RecalibrateResult }[]` — the breakdown, in `plays` order.
- The returned `envelope` is the **p90 PRICE** — funding headroom is explicitly NOT folded in
  (module header lines 348–349). Empty `plays` ⇒ the `prior` floor (TOTAL, no NaN).
- PURE/TOTAL, no addon — value-importable from a `bun test`.

Its review (`work/T-060-02-01/review.md`) hands off precisely:
> `import { coldStartEnvelope } from "src/ledger/recalibrate.ts"`, feed it `(await loadRunLog()).records`,
> `["propose-epic","decompose-epic"]`, `"standard"`, `budgetForTier("standard")`; set the hackathon-seed
> default `--budget` to `result.envelope`.

## Where the work default lives today

`src/play/work.ts` — the impure `vend work` shell (composition layer; allowed to import both engine
and plays):

- `DEFAULT_MACRO_BUDGET: Budget = { timeMs: 7_200_000, tokens: 2_000_000 }` (line 38) — the
  hand-picked "fund it, walk away for 2h" default when `--budget` is omitted.
- `castWork(opts)` flow: preflight → `readBoard` → `parseBoardSignals` → freshness gate →
  `funded = opts.budget ?? DEFAULT_MACRO_BUDGET` (185) → `allocate` → `loadRunLog` (192) →
  price/funding via `recalibrate` + `fundingEnvelope` (202–206) → `spendDown`.
- Pricing block (202–206): `price = sumBudgets(recalibrate(propose).envelope, recalibrate(decompose).envelope)`
  gates P7; `proposeFunding`/`decomposeFunding = fundingEnvelope(...).envelope` are what each cast RUNS
  under (E-050 GUARD ≠ PRICE). **`price` is already exactly `coldStartEnvelope().envelope`** — same Σ
  of the same two recalibrate calls.
- `WorkResult` "spent" variant carries `funded: Budget` (95).

`src/cli.ts` work arm (783–831): `const funded = parsed.budget ?? DEFAULT_MACRO_BUDGET` (796), passes
`budget: funded`, uses `funded` for the `onStep` meter (`formatStepSignal(s, funded)`) and the final
receipt wallet (`{ funded, remaining }`). The parser leaves `budget` undefined on bare `vend work`
(cli.test.ts:211).

`src/play/work-core.ts` — the PURE parse+render half (no addon, no fs). Already exports
`parseBoardSignals`, `labelForSignal`, `formatStepSignal`, `renderReceipt`, `isBoardStale`,
`renderStaleBoard`. The natural home for a pure budget-plan resolver + a quote renderer (it already
mirrors `recalibrate`'s `fmtTok`/`fmtDur` cost formatters locally).

## How a cast is actually funded (the key mechanism)

`fundingEnvelope` (recalibrate.ts 279–328) + `fundDimension` (252–258): a cast runs under
`max(price, maxCensoredActual × headroom)`, then TOKENS are banded to
`[FUNDING_FLOOR_TOKENS=350_000, FUNDING_CEILING_TOKENS=700_000]` (E-053). On **pure cold-start**
(`source:"prior"`, no censored history) the token dimension floors to **350k** — generous enough to
carry a real propose (~110k) / decompose clear. So:

- The **wallet** (funded budget) only gates `canAfford(price)` authorization and is DEBITED by the
  cast's actuals afterward.
- The **per-cast funding envelope** (floored to 350k) is what actually carries the clear.

Consequence: a wallet funded at exactly `price` AUTHORIZES the first pull (`canAfford` is `≥`, true at
equality), the chain CLEARS under its floored funding envelope, then the wallet is debited — the
clear lands *before* any wallet-exhausted stop is detected (the next-iteration `shouldContinue`).
This is exactly "no instant budget-exhausted before a slice clears."

## The spend loop & wallet (testable surface)

- `src/engine/spend.ts` `spendDown<C>({ wallet, candidates, priceOf, castOne, labelOf, onStep })`
  (61–112): `fitNext` (authorize the highest-leverage affordable pull) → `shouldContinue` → injected
  `castOne` → `debit` by `sumActuals` → drop candidate → repeat. **No addon import** (engine ⊥ play;
  the cast is injected) → value-importable from a test with a STUB `castOne`.
- `castOne` returns a `ChainResult` (chain-core.ts 71–77): `{ steps: RunSummary[], outcome, halted }`.
  Each `RunSummary` (cast.ts 101–120) carries `actuals?: { usage, wallMs }` that `sumActuals` debits by.
- `src/budget/wallet.ts`: `allocate`, `canAfford(wallet, predicted)`, `debit`, `remaining`,
  `formatWallet` — all pure.

## The seed surface (docs, not config)

There is **no per-seed budget config** in code. The "hackathon-seed default budget" is (a) the
omit-`--budget` code default of `vend work`, surfaced in the seed's drive docs:

- `examples/templates/hackathon-seed/README.md` (76): "Omit `--budget` … defaults to … **2 hours / 2M tokens**."
- `examples/templates/hackathon-seed/shelf-note.md` (26–27): same, names `DEFAULT_MACRO_BUDGET`.
- `EXPECTED-OUTCOME.md` — the gold master; finding #2 is the **budget-shape finding** (a tight
  `--budget …,<small-ms>` funds nothing). **OUT OF SCOPE here** — flipping the gold master is
  T-060-03-01 (the live re-drive, `depends_on: [T-060-02-02]`).

## Constraints & assumptions

- `coldStartEnvelope` is the single derivation to reuse (handoff + E-013 "measured not guessed"); do
  NOT re-implement the Σ/percentile/censoring.
- IA-8: quote = p90 price; funding-headroom is a *separate* per-cast guard, never in the quote.
- The live ledger has < `COLD_START_MIN_SUCCESSES` (=3) successes today, so against the real current
  ledger the envelope cold-starts to the prior `{2h/50k}` — by design. The measured path engages as
  the dogfood/seed ledger accumulates (and at T-060-03-01).
- `work.ts` value-imports the BAML chain ⇒ NO `bun test` may value-import it. The testable surface
  must be the PURE `work-core.ts` + the addon-free `spend.ts`/`wallet.ts`.
- Engine ⊥ play (E-007): `work-core.ts` may import the PURE `recalibrate.ts` (ledger side), not the
  reverse.
