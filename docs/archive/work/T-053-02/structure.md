# T-053-02 — Structure

The blueprint: one new test file, no `src` change. The band already flows; this is the proof layer.

## Files

| File | Action | Why |
|------|--------|-----|
| `src/play/chain-funding-band-e2e.test.ts` | **create** | The end-to-end confirmation: the band through the cast-funding path + the unbanded price/authorization path. |
| `src/**` | **none** | The band auto-flows (T-050-02 threading × T-053-01 clamp). No production change. |

## `src/play/chain-funding-band-e2e.test.ts` — internal organization

Addon-free imports (every one is pure — no `work.ts` / chain BAML shell):

```ts
import { describe, expect, test } from "bun:test";
import type { Budget } from "../budget/budget.ts";
import { buildRunRecord, type RunOutcome, type RunRecord, type RunRecordInput } from "../log/run-log.ts";
import {
  FUNDING_CEILING_TOKENS,
  FUNDING_FLOOR_TOKENS,
  formatEnvelopeLabel,
  recalibrate,
} from "../ledger/recalibrate.ts";
import { fundedStepDefault, resolveStepBudgets } from "./chain-propose-decompose-core.ts";
import { allocate, canAfford } from "../budget/wallet.ts";
import { fitNext } from "../engine/spend-core.ts";
```

### Module-local helpers (top of file)

- **`recordOf(over)`** — the same `RunRecord` writer used in the sibling test files
  (`recalibrate.test.ts:31`, `chain-propose-decompose-core.test.ts:75`): `{ tokens, durationMs, outcome,
  play, ...rest }` → `buildRunRecord(...)`. Copied (not imported — test files don't export it), kept
  byte-identical so the fixture semantics match the proven unit tests.
- **`sumPrice(a, b)`** — the test-only mirror of `work.ts`'s private `sumBudgets`
  (`{ timeMs: a.timeMs + b.timeMs, tokens: a.tokens + b.tokens }`). This is the "test-only helper to drive
  the price path with a stub ledger" the ticket scopes in. Documents that it reconstructs the work.ts
  price seam, not a new behavior.
- **Fixture constants:**
  - `PROPOSE_PRIOR: Budget` — the propose-epic static default (`{ timeMs: 1_800_000, tokens: 150_000 }`).
  - `DECOMPOSE_PRIOR: Budget` — the decompose-epic static default (`{ timeMs: 7_200_000, tokens: 120_000 }`).
  - `PROPOSE_P90 = 169_873` — the real envelope that budget-exhausted.
  - `PROPOSE_EXHAUSTED_ACTUAL = 176_101` — the tail draw that halted the chain.
  - `DECOMPOSE_CENSORED = 366_500` — the censored actual; `× MEASUREMENT_HEADROOM(2) = 733_000` (the
    E-051 ~733k self-fund), capped by the 700k ceiling.

### `describe("T-053-02 — rational band, end-to-end through the cast-funding path")`

Three nested groups, one per AC:

#### `describe("AC#1 — the floor fixes the vend chain halt")`
- `proposeRecords()` — 10 ascending successes, 0 censored, p90 pinned to `PROPOSE_P90`.
- **test** "well-calibrated propose p90 ~170k funds at the 350k floor through fundedStepDefault":
  assert `recalibrate(...).source === "measured"`, `recalibrate(...).envelope.tokens === PROPOSE_P90`
  (price is the bare p90), then `fundedStepDefault(records, "propose-epic", PROPOSE_PRIOR).tokens ===
  FUNDING_FLOOR_TOKENS` and `>= 350_000`, and `PROPOSE_EXHAUSTED_ACTUAL < funded.tokens` (the 176k tail
  no longer exhausts).
- **test** "the banded funded default is what resolveStepBudgets casts the step under":
  `resolveStepBudgets({}, fundedPropose, fundedDecompose).proposeBudget === fundedPropose` (the band
  flows through the rung, not just the helper).

#### `describe("AC#2 — the ceiling caps the runaway")`
- `decomposeRecords()` — 2 successes (`source: "prior"`) + 1 censored at `DECOMPOSE_CENSORED`.
- **test** "under-calibrated decompose funding ~733k is capped at the 700k ceiling":
  assert `recalibrate(...).source === "prior"`, then `fundedStepDefault(records, "decompose-epic",
  DECOMPOSE_PRIOR).tokens === FUNDING_CEILING_TOKENS`, and `funded.tokens < DECOMPOSE_CENSORED ×
  MEASUREMENT_HEADROOM` (i.e. `< 733_000` — the runaway is strictly capped).

#### `describe("AC#3 — GUARD ≠ PRICE: authorize on the honest price, not the banded funding")`
Reconstruct the `work.ts:202-218` composition from the two fixtures:
- `proposeResult = recalibrate("propose-epic", proposeRecords(), "standard", PROPOSE_PRIOR)`
- `decomposeResult = recalibrate("decompose-epic", decomposeRecords(), "standard", DECOMPOSE_PRIOR)`
- `price = sumPrice(proposeResult.envelope, decomposeResult.envelope)`
- **test** "price is the unbanded p90 sum, not the banded funding sum":
  `price.tokens === PROPOSE_P90 + DECOMPOSE_PRIOR.tokens` (`289_873`), and strictly `< 350_000 +
  700_000` (the banded funding sum) — the authorization base never inherited the band.
- **test** "a wallet between price and funding still affords (gates on price)":
  `allocate({ timeMs: MAX, tokens: 300_000 })` ⇒ `canAfford(wallet, price) === true` and
  `fitNext(wallet, ["signal"], () => price) === "signal"`.
- **test** "a wallet below price is refused (gates on the real price magnitude)":
  `allocate({ timeMs: MAX, tokens: 250_000 })` ⇒ `canAfford(wallet, price) === false` and
  `fitNext(...) === null`.
- **test** "the quoted estimate / label is untouched by funding (IA-8)":
  snapshot `formatEnvelopeLabel(proposeResult)` + `proposeResult.envelope`, run `fundedStepDefault` for
  both steps, assert the label + envelope are byte-identical after (funding never mutates the quote).

## Ordering

1. Write the file (helpers → fixtures → three `describe`s).
2. `bun test src/play/chain-funding-band-e2e.test.ts` — local green.
3. `bun run check` — full gate (baml:gen + tsc + all tests).
4. Commit atomically. No `src` change ⇒ a single test-only commit.

## Interfaces touched (read-only — all already public)

- `fundedStepDefault`, `resolveStepBudgets` (exported, `chain-propose-decompose-core.ts`).
- `recalibrate`, `formatEnvelopeLabel`, `FUNDING_FLOOR_TOKENS`, `FUNDING_CEILING_TOKENS`,
  `MEASUREMENT_HEADROOM` (exported, `recalibrate.ts`).
- `allocate`, `canAfford` (exported, `wallet.ts`); `fitNext` (exported, `spend-core.ts`).
- `buildRunRecord` (exported, `run-log.ts`).

No new exports, no signature changes, no deletions.
