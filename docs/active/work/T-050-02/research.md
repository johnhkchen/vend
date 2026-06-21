# T-050-02 — Research: thread fundingEnvelope into the cast funding path

Descriptive map of the funding/pricing seam this ticket threads `fundingEnvelope` (T-050-01) into.
What exists, where, how it connects. No solutions here.

## The thing being threaded (from T-050-01, already landed at 05c3460)

`src/ledger/recalibrate.ts` now exports the PURE funding core:
- `fundingEnvelope(play, records, result: RecalibrateResult, opts?) → { envelope: Budget; widened: boolean }`
  — per dimension, `max(priced, maxCensoredActual × MEASUREMENT_HEADROOM)` when under-calibrated
  (`result.source === "prior"` OR windowed censored-rate ≥ `CENSORED_WIDEN_RATE`); `priced` verbatim
  when trusted-measured. `priced = result.envelope`. Reads the windowed CENSORED runs' logged
  `totalTokens`/`wallClockMs` as lower bounds; cold-start-no-history falls back to `priced × headroom`.
- `MEASUREMENT_HEADROOM = 2` (≥2, finite — P7 bounded guard), `CENSORED_WIDEN_RATE = 1/3`.
- It is a strict POST-PROCESSOR of `recalibrate` — it NEVER mutates `result.envelope`, the percentile
  math, or `formatEnvelopeLabel` (guard ≠ price, IA-8). Proven by the T-050-01 test block
  (`recalibrate.test.ts:412–522`), including the E-049 shape (120k prior + 265k censored ⇒ 265k×2).

## The two seams to thread (per ticket)

### Seam A — `src/play/work.ts` (the macro `vend work` loop), L192–200

The price path today (impure shell, NOT unit-tested per its header):
```
const { records } = await loadRunLog();
const prior = budgetForTier(PRICE_TIER);          // PRICE_TIER = "standard"
const proposeEnvelope   = recalibrate(proposeEpicPlay.name,   records, PRICE_TIER, prior).envelope;
const decomposeEnvelope = recalibrate(decomposeEpicPlay.name, records, PRICE_TIER, prior).envelope;
const price = sumBudgets(proposeEnvelope, decomposeEnvelope);
```
Then `spendDown` is driven with:
- `priceOf: () => price` — gates P7 authorization (`fitNext`/`canAfford` against the wallet).
- `castOne: (signal) => castProposeDecomposeChain({ signal, proposeBudget: proposeEnvelope,
  decomposeBudget: decomposeEnvelope, … })` — the chain RUNS under exactly the per-step envelopes
  (E-025: authorization == execution).

Key facts:
- `recalibrate(...)` already returns a full `RecalibrateResult` — work.ts currently discards everything
  but `.envelope`. `fundingEnvelope` needs that same `result` (+ `records`, already in scope). No new
  data to gather; the `records`, `prior`, and per-step `RecalibrateResult`s are all already here.
- work.ts ALWAYS passes BOTH `proposeBudget` and `decomposeBudget` per-step — so the chain's
  `resolveStepBudgets` default rung (Seam B) is never reached from `vend work`. The two seams are
  independent code paths.
- `sumBudgets` (L99) sums the two PRICED envelopes denomination-separate — this is the honest quote
  that gates the wallet. It must keep summing the PRICE, never the funding.

### Seam B — `src/play/chain-propose-decompose-core.ts` (`resolveStepBudgets`) + its shell

`resolveStepBudgets(overrides, proposeDefault, decomposeDefault)` (PURE, addon-free, unit-tested):
```
proposeBudget:   overrides.proposeBudget   ?? overrides.budget ?? proposeDefault,
decomposeBudget: overrides.decomposeBudget ?? overrides.budget ?? decomposeDefault,
```
Rung order per step: `per-step ?? uniform --budget ?? play default`. The DEFAULT rung is the
cold-start thin prior the ticket targets.

The shell `src/play/chain-propose-decompose.ts` (`castProposeDecomposeChain`, impure, value-imports
the BAML addon, NOT unit-tested) calls:
```
const { proposeBudget, decomposeBudget } =
  resolveStepBudgets(opts, proposeEpicPlay.budget, decomposeEpicPlay.budget);
```
So today the default rung = each play's STATIC `.budget`:
- `proposeEpicPlay.budget`   = `{ timeMs: 1_800_000, tokens: 150_000 }` (propose-epic.ts:106)
- `decomposeEpicPlay.budget` = `{ timeMs: 7_200_000, tokens: 120_000 }` (decompose-epic.ts:197)

The decompose default token ceiling is **120k** — exactly the E-049 "120k prior" that censored the
265k decompose. This is the bare `vend chain "signal"` / `vend run` path (no `vend work` loop, no
overrides), where the ratchet bites and was dogfood-observed in E-049.

## Supporting cast (read, unchanged)

- `src/log/run-log.ts` — `loadRunLog({ path? })` (ENOENT ⇒ empty, cold-start safe),
  `DEFAULT_RUN_LOG_PATH = ".vend/runs.jsonl"`, `forPlay`/`totalTokens`/`wallClockMs`, `RunRecord`.
  `recalibrate`/`fundingEnvelope` already consume these. Play names recorded in the ledger are the
  `PLAY` consts: `"propose-epic"`, `"decompose-epic"` (match `proposeEpicPlay.name`).
- `src/engine/spend.ts` — `spendDown<C>` is the macro wallet. It AUTHORIZES the next cast on
  `priceOf` (`fitNext`), then DEBITS the wallet by ACTUALS (`sumActuals`), and `shouldContinue` stops
  on depletion/andon. P7 = the wallet is the hard wall; `debit` floors at 0 and surfaces overshoot.
  Funding the cast above the price is exactly E-038's pattern (authorize at price, run under a
  bounded ×headroom guard) — spendDown already hard-stops on actuals regardless of the cast's guard.
- `src/budget/budget.ts` — `TIMEOUT_HEADROOM = 2` / `timeoutMsFor` is the wall-clock precedent
  `fundingEnvelope` generalizes to tokens. The cast's threaded `Budget` becomes both the token
  ceiling (`check`) and the timeout source (`timeoutMsFor`), so a larger funding envelope is what
  lets a heavy cast FINISH and RECORD.
- `src/shelf/gather.ts` — `budgetForTier(tier)` = `TIER_BUDGET[tier]`, the hand prior work.ts
  cold-starts from. `formatEnvelopeLabel`/affordability are the price surfaces that MUST stay honest.
- `src/play/chain-propose-decompose.ts` — the chain shell. No test imports it (`grep` confirms).
  The offline `chain-propose-decompose.test.ts` exercises `runChain`/effects with fakes, never the
  shell, so a shell change cannot break it.

## Test conventions (recalibrate.test.ts / chain-propose-decompose-core.test.ts)

- `recordOf({ tokens, durationMs, outcome, play, …RunRecordInput })` builds a real frozen `RunRecord`
  via the pure writer; tokens land in `input_tokens`, durationMs encodes `endedAt − startedAt`.
- The funding tests feed REAL `recalibrate(...)` output into `fundingEnvelope` (never a hand-faked
  `RecalibrateResult`), so the price→funding seam is exercised as production wires it.
- `chain-propose-decompose-core.test.ts` is ADDON-FREE — it imports only the pure core (+ `Budget`),
  so it runs under `bun test` without the BAML addon. New pure helpers added to that core are
  unit-testable there with the same `recordOf` fixture style.

## Constraints / assumptions surfaced

1. **Guard ≠ price (IA-8, load-bearing).** `price`/`sumBudgets`/`formatEnvelopeLabel`/affordability
   stay the measured p90. Only what the cast RUNS under (the threaded per-step `Budget`) is widened.
2. **P7 (no overspend past the wall).** The funding headroom is finite (`MEASUREMENT_HEADROOM = 2`),
   and `spendDown` debits ACTUALS and hard-stops — confirmed structurally, not added.
3. **Back-compat.** A well-calibrated play (`measured`, low censored rate) ⇒ `fundingEnvelope`
   returns `priced` verbatim ⇒ funding == price ⇒ identical to today.
4. **Purity discipline.** New funding-composition logic for Seam B must live in the addon-free PURE
   core (`chain-propose-decompose-core.ts`) so it is unit-tested; only the ledger READ is impure
   (the shell), mirroring work.ts's `loadRunLog` + pure `recalibrate`.
5. **Deterministic proof, no live model.** The E-049-shaped proof must target a PURE seam (the new
   core helper); work.ts is the impure shell, proven by composition of the tested core (house pattern).
6. **No wasted fs in the `vend work` path.** When both steps are overridden (work.ts), the chain
   shell must not read the ledger for an unused default — keep that path byte-for-byte.
