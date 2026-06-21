# T-050-02 — Progress

Tracks execution against `plan.md`. Status: **implementation complete, full gate green.**

## Completed

### Step 1 — Pure core: `fundedStepDefault` + `CHAIN_DEFAULT_TIER` ✓
`src/play/chain-propose-decompose-core.ts`:
- Added imports `recalibrate`, `fundingEnvelope`, `FundingOptions`, `RecalibrateOptions`
  (`../ledger/recalibrate.ts`); `RunRecord` (`../log/run-log.ts`); `ValueTier` (`../shelf/menu.ts`).
  All addon-free — the core test still loads under `bun test`.
- `export const CHAIN_DEFAULT_TIER: ValueTier = "standard"` (the neutral middle, mirrors work.ts
  `PRICE_TIER`).
- `export function fundedStepDefault(records, play, prior, tier?, opts?) → Budget` =
  `fundingEnvelope(play, records, recalibrate(play, records, tier, prior, …), …).envelope`.
  `resolveStepBudgets` left untouched.

### Step 2 — Core test: deterministic E-049 proof ✓
`src/play/chain-propose-decompose-core.test.ts`: a `describe("fundedStepDefault …")` with 6 cases —
the E-049 contrast (`recalibrate` envelope `=== 120_000` OLD vs `fundedStepDefault` tokens
`=== 264_866 × MEASUREMENT_HEADROOM` NEW), price-honesty (sibling envelope unchanged), cold-start
`prior × headroom`, well-calibrated funding == price, override-still-wins, and totality + tier.
Local `recordOf` fixture (mirrors recalibrate.test.ts). **11 pass** in the core file.

### Step 3 — Chain shell: ledger-read funded defaults ✓
`src/play/chain-propose-decompose.ts`:
- Imports `join` (node:path), `loadRunLog`/`DEFAULT_RUN_LOG_PATH` (run-log), `fundedStepDefault`.
- Private `async stepDefaults(root, opts)`: `defaultUnused` short-circuit (uniform `--budget` OR both
  per-step set ⇒ static play budgets, NO ledger read — the `vend work` path stays byte-for-byte);
  else `loadRunLog` once and fund both step defaults.
- `castProposeDecomposeChain` now computes `root` then `[proposeDefault, decomposeDefault] = await
  stepDefaults(root, opts)` and feeds them to `resolveStepBudgets`. Comment updated.

### Step 4 — work.ts: price/funding split ✓
`src/play/work.ts`:
- Added `fundingEnvelope` to the `recalibrate` import.
- Keep full per-step `RecalibrateResult`s; `price = sumBudgets(proposeResult.envelope,
  decomposeResult.envelope)` (honest, gates the wallet — UNCHANGED). `proposeFunding`/`decomposeFunding`
  via `fundingEnvelope`.
- Threaded `proposeBudget: proposeFunding` / `decomposeBudget: decomposeFunding` into the cast;
  `priceOf: () => price` unchanged. Comment block updated to name the guard≠price split.

### Step 5 — Full gate ✓
`bun run check` (baml:gen + `tsc --noEmit` + `bun test`): **1176 pass, 0 fail, typecheck clean**
(was 1170 — +6 new core cases). No `lint`/`format` script exists in this repo (aspirational in
CLAUDE.md); the meaningful `check:*` gates (typecheck + test) are green.

## Deviations from plan

- **None of substance.** The plan's two-commit cadence is preserved (core+proof, then the two
  impure-shell threadings). The `defaultUnused` guard name was used (plan called it `bothOverridden`
  in prose) — same logic: skip the ledger when a default will never be consulted.

## Invariant audit (for Review)

- **IA-8 (price honest):** `price`, `sumBudgets`, `priceOf`, `budgetForTier`, `formatEnvelopeLabel`,
  affordability — all textually UNCHANGED. Only the cast's per-step run-guard widened. The core test
  asserts the sibling `recalibrate(...).envelope` is unchanged after a funding call.
- **P7 (finite + hard-stop):** `MEASUREMENT_HEADROOM = 2` finite; `spendDown`/wallet/`debit`
  untouched — still authorizes on `price`, debits ACTUALS, hard-stops on depletion.
- **Back-compat:** well-calibrated ⇒ funding == price (core test); the `vend work` path never reads
  the ledger for an unused default (the `defaultUnused` short-circuit).
