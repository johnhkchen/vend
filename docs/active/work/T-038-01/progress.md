# Progress — T-038-01 timeout-headroom-lever

## Status: implementation complete, gate green (1000 pass / 0 fail).

## Steps

- [x] **Step 1 — Add `TIMEOUT_HEADROOM` + apply in `timeoutMsFor`** (`src/budget/budget.ts`).
  Added `export const TIMEOUT_HEADROOM = 2;` with the full ratchet rationale doc-comment
  (why p90-as-timeout self-censors, why raising the percentile alone can't fix it, the 2×
  justification from E-037's censored margin, the IA-14-deferred note). Changed `timeoutMsFor`
  body to `Math.ceil(budget.timeMs * TIMEOUT_HEADROOM)` and rewrote its doc-comment to point at
  the constant. `assertPositiveInt(budget.timeMs, "timeMs")` preserved (contract on the price).

- [x] **Step 2 — Update + extend the proof** (`src/budget/budget.test.ts`).
  - Updated the verbatim test → expects `30_000 * TIMEOUT_HEADROOM`.
  - Kept the `test.each([0,-1,NaN,1.5])` RangeError test unchanged.
  - Added `TIMEOUT_HEADROOM is a warranted factor with real margin (≥2, integer)`.
  - Added the E-037 mapping test (AC #3): `T = 72_785`, both censored actuals `[72_792, 72_805]`
    asserted `< timeoutMsFor(budget(T,1))`, and the headroomed value `=== T * TIMEOUT_HEADROOM`.

- [x] **Step 3 — Affordability assertion shape: chose option (a), the real `canAfford`.**
  `allocate(macro): Wallet` (wallet.ts:100) is a one-line pure constructor and `canAfford`
  (wallet.ts:113) is pure, so the stronger proof was cheap. The mapping test funds a wallet with
  exactly `T` ms and asserts `canAfford(wallet, budget(T,1)) === true` and
  `canAfford(wallet, budget(T+1,1)) === false` — proving affordability gates on the **bare price
  T**, never the 2× headroomed value. `budget.test.ts` now imports `allocate, canAfford` from
  `./wallet.ts` (both pure — no impure deps dragged in).

- [x] **Step 4 — Isolation confirmed.** `git status --short src/` shows ONLY `budget.ts` and
  `budget.test.ts` modified. `grep -rn "timeoutMsFor" src/` confirms the two callers
  (`cast.ts:216`, `run-equivalence-judge.ts:317`) are unchanged and pick up the headroom
  automatically; no new call sites. `wallet.ts`/`spend-core.ts`/`recalibrate.ts`/`cast.ts` not
  edited — the price path is untouched by construction.

- [x] **Step 5 — Full gate green.** `bun run check` (= `baml:gen && check:typecheck && check:test`):
  `tsc --noEmit` clean, `bun test` → **1000 pass, 0 fail, 2447 expect() calls** across 66 files.

- [ ] **Step 6 — Commit.** Not committed (per the workflow instruction to stop after Review and let
  Lisa handle the rest). Working tree holds the two `src/` edits plus the work artifacts.

## Deviations from the plan

None material. The only decision deferred to Implement (the affordability assertion shape, Step 3)
resolved to option (a) — the real `canAfford` + `allocate` — because the wallet surface is pure and
one-line, making the stronger proof the cheaper one. No plan step was skipped or reordered.

## Decisions recorded

- **`HEADROOM = 2`** — double the envelope. Censored runs were within ~1% (so any slack clears
  them); 2× gives the next heavier signal a full envelope of room before re-censoring. One warranted
  constant for the class, not a per-data-point patch.
- **Open sub-question — affordability gates on the price (p90), not the headroomed timeout.** This
  is the status quo (`canAfford` reads `predicted.timeMs` = the envelope) and is now explicitly
  pinned by the mapping test. Rationale: the macro wallet debits real actuals (`spendDown`) and the
  macro total still bounds (P7), so gating on the inflated value would refuse affordable casts for
  no safety gain.
- **Both `timeoutMsFor` callers get headroom** — intended: `cast.ts` (the spend runner) and
  `run-equivalence-judge.ts` (the equivalence judge) are both runner kill-switches.

## Honest boundary (unchanged from design)

This removes the guillotine deterministically and proves it with a no-live-model unit test. It does
**not** prove the heavy `propose-epic` signal now *clears* live — that re-run is Frontier 1's next
pull (now unblocked), not this ticket. P7 holds: the macro wallet still hard-stops on total actuals.
