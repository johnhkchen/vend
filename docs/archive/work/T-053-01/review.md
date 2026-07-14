# T-053-01 — Review

Handoff for a human reviewer. What changed, how it's tested, what to watch.

## Summary

`fundingEnvelope` (`src/ledger/recalibrate.ts`) now clamps its **token** funding output to a rational
band `[350_000, 700_000]` — the outermost bound, applied after the existing E-050 headroom `max()`.
The **floor** stops a too-tight p90 from starving a real cast on a tail draw (the `vend chain`
propose that budget-exhausted at 176k against a ~170k envelope); the **ceiling** caps runaway
self-funding (E-051's decompose ran to ~733k). The band is on the FUNDING GUARD only — price,
percentile math, the confidence label, and the `canAfford`/`fitNext` authorization gates are
untouched (IA-8, charter P7). One atomic commit: `2311b53`.

## Files changed

| File | Change |
|------|--------|
| `src/ledger/recalibrate.ts` | **(production)** `FUNDING_FLOOR_TOKENS`/`FUNDING_CEILING_TOKENS` consts; `floorTokens?`/`ceilingTokens?` on `FundingOptions`; `bandTokens` helper; clamp the token dimension at both `fundingEnvelope` return paths. |
| `src/ledger/recalibrate.test.ts` | `WIDE_BAND` const; 4 T-050-01 headroom calls widened to isolate the headroom contract; new `describe("… rational band (T-053-01)")` — 7 cases. |
| `src/play/chain-propose-decompose-core.test.ts` | `WIDE_BAND` const; 2 T-050-02 back-compat calls widened (they route through `fundingEnvelope` and now floor). |

The production change is **one file, ~15 lines**. The rest is tests.

## How the clamp works

- `bandTokens(t, floor, ceiling) = positiveInt(min(ceiling, max(floor, t)))` — pure, total, reuses
  the existing `positiveInt` budget-dimension contract.
- Applied at **both** exits of `fundingEnvelope`:
  - measured-clean early return — so a well-calibrated p90 below 350k (the propose case, which has
    `source: "measured"`) is still floored. This was the load-bearing subtlety: clamping only the
    widened path would miss the exact dogfood failure.
  - under-calibrated widened return — so a runaway (`maxCensoredActual × headroom`) is capped.
- `widened` is computed on the **un-banded** tokens, preserving its E-050 meaning ("headroom lifted a
  dimension above price"). Flooring/capping never flips it — the band is a bound, not the headroom
  signal (per ticket).
- Wall-clock (`timeMs`) is never banded — it keeps its E-038 headroom on both paths.

## Test coverage

New `recalibrate.test.ts` band suite (7 tests, all green) maps 1:1 to the acceptance criteria:

- below-floor measured-clean → `tokens === 350_000`, `widened === false`, time untouched (the AC's
  "~170k p90 ⇒ funded 350k").
- above-ceiling self-fund → `tokens === 700_000`, `widened === true` (the AC's "~733k ⇒ capped 700k").
- in-band (measured p90 = 450k) → `450_000`, unchanged.
- price/quote untouched → snapshots `result.envelope` and `formatEnvelopeLabel(result)` across the
  call; byte-identical (IA-8).
- wall-clock untouched → token capped to 700k while `timeMs` stays at its headroom value.
- opts override → `{ floorTokens: 10_000, ceilingTokens: 20_000 }` floors/caps a synthetic band.
- constants P7 → finite, positive integers, floor < ceiling, exact 350k/700k.

Full gate: `bun run check` → **1198 pass, 0 fail**; `tsc --noEmit` clean; precommit green.

## Open concerns / notes for the reviewer

1. **The two pre-existing test files were edited, not just the new suite.** Four T-050-01 calls and
   two T-050-02 calls now pass an explicit `WIDE_BAND` so they keep asserting the *headroom* contract
   in isolation rather than silently flipping to band values. This is deliberate — it keeps each test
   focused on one contract and preserves the headroom regression signal. Reviewer should confirm they
   agree with this isolation choice vs. rewriting those assertions to expect the floored/capped
   values. (Rationale in `plan.md` Risk section / `progress.md` deviation 1.)

2. **`widened` does NOT flag a floor-lift.** When the measured-clean path floors 170k → 350k,
   `widened` stays `false`. If a downstream consumer wants an honest "this cast was floored" funding
   label, that is a *separate* signal not added here (the ticket scoped `widened` to stay the headroom
   signal). No current consumer needs it; flagged in case a future label wants it.

3. **End-to-end is NOT proven here — that's T-053-02.** This ticket proves the pure clamp only. The
   claim that propose now funds at 350k *through the real cast path* (`work.ts` /
   `resolveStepBudgets`) and decompose caps at 700k, with the wallet still authorizing on price and
   debiting actuals, is the next ticket's deterministic end-to-end proof. The fact that the two
   T-050-02 tests broke and were fixed is incidental evidence the threading is already in place (no
   new wiring needed, as the epic predicted).

4. **No play's honest p90 exceeds 700k today.** If one ever does, banding the *funding* guard down to
   700k while the *price* quotes higher is, per the epic, a separate "this play is too expensive to
   fund rationally" signal — out of scope here. Worth a watch as plays grow.

## Verdict

Scope held exactly to the ticket: tokens-only band, price/label/auth untouched, PURE/TOTAL, P7-finite
constants, unit-tested with no live model, gate green. Ready for T-053-02.
