# T-053-02 — Progress

Status: **complete**. Single commit `e945bde`. `bun run check` green (**1205 pass, 0 fail**, up from
1198 — the 7 new e2e tests, no regressions). Precommit hook: "ok — tests green".

## Steps executed (per plan.md)

- **Step 1 — scaffold + helpers:** ✅ created `src/play/chain-funding-band-e2e.test.ts`, addon-free
  imports (ledger `recalibrate`/`formatEnvelopeLabel`/band constants, play `fundedStepDefault`/
  `resolveStepBudgets`, budget `allocate`/`canAfford`, engine `fitNext`). Local `recordOf` writer (byte-
  identical to the sibling test files) + `sumPrice` (the test-only mirror of work.ts's private
  `sumBudgets` — the "stub-ledger price-path driver" the ticket scoped in) + the fixture constants.
- **Step 2 — AC#1 (floor fixes the halt):** ✅ `proposeRecords()` = 10 ascending successes, p90 pinned
  to `169_873`. Two tests: (a) `fundedStepDefault` floors the bare p90 to `350k` and the `176_101` tail
  draw now fits; (b) `resolveStepBudgets({}, …).proposeBudget` equals that banded funded default (the
  band rode the rung, not a side path).
- **Step 3 — AC#2 (ceiling caps the runaway):** ✅ `decomposeRecords()` = 2 successes (`source:
  "prior"`) + 1 censored at `366_500`; `fundedStepDefault` funds `366_500 × 2 = 733_000` capped to
  exactly `700k`, strictly `< 733_000`.
- **Step 4 — AC#3 (GUARD ≠ PRICE):** ✅ reconstructed the `work.ts:202-218` price seam from the two
  fixtures. Four tests: price is the unbanded p90 sum `289_873` (not `1_050_000`); a wallet between price
  and funding affords (`canAfford` true, `fitNext` returns the signal); a wallet below price is refused
  (`canAfford` false, `fitNext` null); `formatEnvelopeLabel` + the priced envelope are byte-identical
  before/after the funding path runs.
- **Step 5 — gate + commit:** ✅ `bun run check` (baml:gen + tsc --noEmit + full `bun test`) green;
  committed atomically (one test-only commit).

## Deviations from plan

**None.** The plan held exactly. In particular, the central design claim was confirmed: **no `src`
change was needed** — the band auto-flowed through the existing E-050/T-050-02 threading
(`recalibrate` → `fundingEnvelope` inside `fundedStepDefault`/`resolveStepBudgets`/`work.ts`), and not a
single one of the existing 1198 tests broke. (Contrast T-053-01, where introducing the band *did* break
sub-floor back-compat assertions in two files — those were the unit-level cases; the composition path
was already band-aware by construction.)

## Fixture arithmetic (as pinned in plan.md — all confirmed by green assertions)

| Quantity | Value | Confirmed by |
|----------|-------|--------------|
| propose price (p90) | `169_873` | `recalibrate(...).envelope.tokens` |
| propose funding | `350_000` | `fundedStepDefault(...).tokens === FUNDING_FLOOR_TOKENS` |
| decompose price | `120_000` | cold-start prior (`source: "prior"`) |
| decompose funding | `700_000` | `fundedStepDefault(...).tokens === FUNDING_CEILING_TOKENS` |
| `price.tokens` (sum) | `289_873` | `sumPrice(...).tokens` |
| banded funding sum | `1_050_000` | asserted `>` price (band never leaked into the gate base) |

## Files touched

- `src/play/chain-funding-band-e2e.test.ts` — **new**, the only change. 7 tests across 3 `describe`s
  (AC#1 ×2, AC#2 ×1, AC#3 ×4), 20 `expect` calls. No `src/**` production change.

## Verification

- `bun test src/play/chain-funding-band-e2e.test.ts` → 7 pass, 0 fail, 20 expect calls.
- `bun run check` → 1205 pass, 0 fail, 3303 expect calls across 78 files.
- precommit hook → "ok — tests green".

## Scope held

No production change (the band auto-flows). No live model, fs, clock, or spawn — pure fabricated
`RunRecord` fixtures. Wall-clock kept generously inside the wallet in AC#3 so only tokens decide
`canAfford`. The T-053-01 unit band tests and T-050-02 `WIDE_BAND` headroom-isolation tests are
untouched — this file adds the composition layer they intentionally left to T-053-02.
