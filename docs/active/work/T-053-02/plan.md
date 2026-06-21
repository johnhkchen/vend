# T-053-02 — Plan

One test-only deliverable, one commit. Each step is verifiable; the whole thing is green-before-merge.

## Testing strategy

- **Unit vs. integration:** these are *integration / composition* tests — they exercise the real pure
  cores (`recalibrate` → `fundingEnvelope` via `fundedStepDefault`, and `recalibrate` → `sumPrice` →
  `fitNext`/`canAfford`) composed exactly as `work.ts` composes them. No mocks, no stubs of the units —
  only fabricated `RunRecord` input (a stub *ledger*, which is the real input shape).
- **No live model, no fs, no spawn.** Deterministic fixtures only.
- **Verification criteria:** the three ACs each become explicit assertions on real composed output;
  `bun run check:*` green is the gate.

## Steps

### Step 1 — scaffold the file + helpers
Create `src/play/chain-funding-band-e2e.test.ts` with the imports (per structure.md), the local
`recordOf` writer (byte-identical to the sibling test files), the `sumPrice` mirror of work.ts's
private `sumBudgets`, and the fixture constants (`PROPOSE_PRIOR`, `DECOMPOSE_PRIOR`, `PROPOSE_P90 =
169_873`, `PROPOSE_EXHAUSTED_ACTUAL = 176_101`, `DECOMPOSE_CENSORED = 366_500`).
- **Verify:** `tsc --noEmit` clean (imports resolve, no unused).

### Step 2 — AC#1 (floor fixes the chain halt)
Add `describe("AC#1 …")`:
- `proposeRecords()`: 10 ascending successes (0 censored) with the 9th value = `PROPOSE_P90`, so the
  standard-tier nearest-rank p90 (`idx = ceil(0.9·10)−1 = 8`) is exactly `169_873`.
- test 1: `recalibrate(...).source === "measured"`, `.envelope.tokens === PROPOSE_P90`;
  `fundedStepDefault(records, "propose-epic", PROPOSE_PRIOR).tokens === FUNDING_FLOOR_TOKENS` and
  `>= 350_000`; `PROPOSE_EXHAUSTED_ACTUAL < funded.tokens`.
- test 2: `resolveStepBudgets({}, fundedPropose, fundedDecompose).proposeBudget === fundedPropose`.
- **Verify:** `bun test src/play/chain-funding-band-e2e.test.ts` — AC#1 green.

### Step 3 — AC#2 (ceiling caps the runaway)
Add `describe("AC#2 …")`:
- `decomposeRecords()`: 2 successes (`source: "prior"`) + 1 censored at `DECOMPOSE_CENSORED` (`budget-
  exhausted`).
- test: `recalibrate(...).source === "prior"`; `fundedStepDefault(records, "decompose-epic",
  DECOMPOSE_PRIOR).tokens === FUNDING_CEILING_TOKENS`; `funded.tokens < DECOMPOSE_CENSORED ×
  MEASUREMENT_HEADROOM` (`< 733_000`).
- **Verify:** AC#2 green.

### Step 4 — AC#3 (GUARD ≠ PRICE)
Add `describe("AC#3 …")`, reconstructing the work.ts price seam from the two fixtures:
- test "price is the unbanded p90 sum": `price.tokens === 289_873`, `< 1_050_000`.
- test "wallet between price and funding affords": `canAfford` true, `fitNext` returns the signal.
- test "wallet below price refused": `canAfford` false, `fitNext` null.
- test "label/envelope untouched by funding": snapshot before, `fundedStepDefault` both steps, assert
  byte-identical after.
- **Verify:** AC#3 green.

### Step 5 — full gate + commit
- `bun run check` (baml:gen + tsc --noEmit + full `bun test`) — must be green, no regressions in the
  existing 1198+ tests.
- Commit atomically: `test(T-053-02): confirm rational band [350k,700k] end-to-end through cast-funding +
  authorization paths`.

## Expected fixture arithmetic (pinned, so a drift fails loudly)

| Quantity | Value | Derivation |
|----------|-------|-----------|
| propose price (p90) | `169_873` | nearest-rank p90 of the 10-record fixture |
| propose funding | `350_000` | `bandTokens(169_873, 350k, 700k)` — floored |
| decompose price | `120_000` | cold-start prior (2 < 3 successes) |
| decompose funding | `700_000` | `bandTokens(max(120k, 366_500×2=733_000), …)` — capped |
| `price.tokens` (sum) | `289_873` | `169_873 + 120_000` (unbanded) |
| banded funding sum | `1_050_000` | `350_000 + 700_000` (NOT the authorization base) |

## Risks & mitigations

- **p90 drift / off-by-one in nearest-rank:** each test asserts `recalibrate(...).envelope.tokens`
  explicitly *before* the funded assertion → a drift fails at the price step with a clear value.
- **time confounds the wallet in AC#3:** wallet `timeMs` set to `Number.MAX_SAFE_INTEGER` so only tokens
  gate `canAfford`.
- **No `src` change is itself a claim:** if any existing test breaks under `bun run check`, that would
  mean the band did *not* auto-flow as designed — surface it in progress.md rather than patch around it.

## Rollback

Single test-only commit; revert restores the prior tree with zero production impact.
