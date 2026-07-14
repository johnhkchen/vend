# T-053-02 — Research

**Confirm the rational band `[350k, 700k]` makes the budget rational end-to-end — through the real
cast-funding path, not just the pure core.** Descriptive map of what already exists; no solution here.

## What T-053-01 shipped (the band — the dependency)

`fundingEnvelope` (`src/ledger/recalibrate.ts:279-328`) now clamps its **TOKEN** output to a rational
band via the private `bandTokens(tokens, floor, ceiling) = positiveInt(min(ceiling, max(floor, tokens)))`
helper (`:264-266`), applied at **both** return paths:

- **Measured-clean early return** (`:303-305`): `{ timeMs: priced.timeMs, tokens: bandTokens(priced.tokens, …) }`.
- **Under-calibrated widened return** (`:326`): `{ timeMs, tokens: bandTokens(tokens, …) }`.

Constants (`:221`, `:227`): `FUNDING_FLOOR_TOKENS = 350_000`, `FUNDING_CEILING_TOKENS = 700_000`,
both exported, finite positive ints (P7). Overridable per call via `FundingOptions.floorTokens` /
`ceilingTokens` (`:238-241`). Wall-clock is **never** banded — `timeMs` passes through verbatim on both
paths. `widened` is computed on the **un-banded** tokens (`:323`), so flooring/capping never flips the
headroom signal. T-053-01's progress.md confirms `bun run check` green at commit `2311b53` (1198 pass).

## The cast-funding path (carries the band — already wired, E-050/T-050-02)

Two pure composition points already route through `fundingEnvelope`, so the band flows automatically —
**no new wiring is needed for this ticket**:

1. **`fundedStepDefault`** (`src/play/chain-propose-decompose-core.ts:84-93`). Composes the two pure
   cores: `recalibrate(play, records, tier, prior, opts.recalibrate)` → `fundingEnvelope(play, records,
   result, opts.funding).envelope`. This is the default rung a bare `vend chain` / `vend run` step RUNS
   under. With the **default** band (no `opts.funding` override), its token output is clamped to
   `[350k, 700k]`.

2. **`resolveStepBudgets`** (`:57-66`). Rung order per step: `per-step override ?? uniform budget ??
   play default`. The "play default" slot is fed `fundedStepDefault(...)` by the shell, so a bare chain
   casts each step under the **banded funded** envelope.

3. **`work.ts` macro loop** (`src/play/work.ts:202-206`). Recalibrates propose + decompose separately,
   then `fundingEnvelope(...).envelope` per step → `proposeFunding` / `decomposeFunding`, threaded as
   `proposeBudget` / `decomposeBudget` into the cast (`:213-218`). The band rides this path too.

`work.ts` value-imports the BAML native addon (`castProposeDecomposeChain`), so **no `bun test` can
import `work.ts`** — its funding/price composition is only unit-testable by reconstructing it from the
pure pieces it calls (`recalibrate`, `fundingEnvelope`, `sumBudgets`, `fitNext`, `canAfford`).

## The price path (must stay UNBANDED — GUARD ≠ PRICE, IA-8 / P7)

The macro-wallet authorizes on the **honest price**, not the banded funding. The seam in `work.ts`:

- `price = sumBudgets(proposeResult.envelope, decomposeResult.envelope)` (`:204`) — the per-denomination
  sum of the two **`recalibrate`** envelopes (the honest p90 per step). `sumBudgets` is a private
  one-liner in `work.ts:99-101` (`{ timeMs: a+b, tokens: a+b }`).
- `priceOf: () => price` (`:211`) feeds the spend loop.
- **`fitNext`** (`src/engine/spend-core.ts:93-102`) and **`canAfford`** (`src/budget/wallet.ts:117-122`)
  gate on that `price`. `canAfford` is per-denomination `<=` on both tokens and timeMs.
- The wallet still **debits actuals** (`debit`, `wallet.ts:130`), never the prediction.

So the band changed only what a cast **RUNS** under (`fundingEnvelope`); it must NOT have moved what the
shelf **QUOTES** (`recalibrate.envelope` / `formatEnvelopeLabel`, `recalibrate.ts:173-180`) nor what the
wallet **AUTHORIZES** on (`price` → `canAfford` / `fitNext`). T-053-01 left all three untouched by
construction (it post-processes only `fundingEnvelope`'s token output); this ticket must PROVE it.

## Existing coverage and the gap this ticket fills

- **`recalibrate.test.ts:537-…`** — `describe("fundingEnvelope — rational band (T-053-01)")`: 7 cases
  proving the band on `fundingEnvelope` **directly** (below-floor→350k, above-ceiling→700k, in-band
  unchanged, price/label untouched, wall-clock untouched, opts override, constants P7).
- **`chain-propose-decompose-core.test.ts:94-169`** — `fundedStepDefault` T-050-02 cases, but all the
  sub-floor ones pass an explicit `WIDE_BAND` (`{ funding: { floorTokens: 1, ceilingTokens:
  MAX_SAFE_INTEGER } }`, `:101`) precisely so the band does **not** bind — they assert the headroom math
  in isolation.

**The gap:** no test proves the band binds **through the cast-funding path under the DEFAULT band**
(`fundedStepDefault` / `resolveStepBudgets` with no override), nor that the price/authorization path
stays unbanded end-to-end. T-053-01 proved the band on the unit; T-053-02 proves it on the composition.

## Fixtures available (pure, addon-free)

- `recordOf(over)` writer in both `recalibrate.test.ts:31` and `chain-propose-decompose-core.test.ts:75`
  — builds a `RunRecord` with chosen `tokens` / `durationMs` / `outcome` / `play` via `buildRunRecord`.
  No fs/clock/spawn.
- `recalibrate` nearest-rank p90 (`standard` tier): for `n=10`, `idx = ceil(0.9·10)−1 = 8` → the 9th
  ascending value IS the p90. Lets a fixture pin an exact p90 (e.g. the `169_873` propose envelope).
- `MEASUREMENT_HEADROOM = 2`: a censored actual of `366_500` funds to `733_000` (the E-051 ~733k shape),
  which the `700k` ceiling caps.

## Constraints / assumptions

- **No `src` change beyond T-053-01.** The band auto-flows; this ticket is assertions (+ a test-only
  helper to drive `resolveStepBudgets` / the price path with a stub ledger, explicitly in scope).
- **No live model.** Deterministic fabricated `RunRecord` fixtures only.
- Tests must be **addon-free** (no value-import of `work.ts` / the chain shell) — reconstruct the
  work.ts composition from the pure cores.
- `bun run check:*` (baml:gen + tsc --noEmit + full `bun test`) must stay green.
