# T-048-01 Plan — ordered, verifiable steps

Sequence the implementation. Each step is small enough to commit atomically and verifiable on its own.
No live model anywhere — pure functions + `bun test`.

## Testing strategy

- **Unit only** (the ticket: "Unit-tested — no live model"). The whole algebra is pure, so it is exercised
  as ordinary pure functions in `bun:test`, matching `wallet.test.ts` / `spend-core.test.ts` discipline
  (fabricated inputs, no spawn/fs/clock).
- **Coverage target = the AC enumeration:** all-fit · partial (token-stop) · partial (time-stop) ·
  tokens-sum / time-max · overshoot-once · single == debit · empty. Plus the back-compat assertion
  (single-element wave deep-equals `debit`) and the continue-after-stop case (Design Decision 3).
- **Verification gate:** `bun run check:typecheck` (tsc `--noEmit`, enforces `noUncheckedIndexedAccess` +
  `verbatimModuleSyntax`) then `bun run check:test`. Both green = ticket's `bun run check:*`.
- No integration test here — threading into `castGraph` and the worked example are T-048-02's gate.

## Step 1 — `debitWave` in `src/budget/wallet.ts`

- Add the `debitWave` export after `debit` (Structure §1): fold actuals to one combined `Budget` (tokens
  `+=`, timeMs `Math.max`) via the in-file `actualToBudget`, then `return debit(wallet, combined)`.
- Extend the IA-8 module-doc note with one line: the wave fold = MAX wall-clock / SUM tokens.
- **Verify:** `bun run check:typecheck` green (no new imports needed). Self-review: empty-actuals path
  yields `{0,0}` delta; single-element path is exactly `actualToBudget(a)` ⇒ equals `debit`.
- **Commit:** `feat(budget): debitWave — fold a concurrent wave into the wallet (Σ tokens, max wall-clock)`.

## Step 2 — `debitWave` unit tests in `src/budget/wallet.test.ts`

- Add `describe("debitWave", …)` with the six cases (Structure §3): all-fit (time = funded − MAX),
  single==debit for Budget AND Usage actuals, empty no-op, overshoot-once (collective, floored), mixed
  Usage+Budget.
- **Verify:** `bun run check:test` green; confirm the time-MAX assertion would FAIL under a naive sum
  (sanity that the test actually pins MAX, not sum).
- **Commit:** `test(budget): debitWave — tokens-sum / time-max / overshoot-once / single==debit / empty`.

## Step 3 — `authorizeWave` + `WaveAuthorization` in `src/engine/spend-core.ts`

- Add the `WaveAuthorization<C>` interface and `authorizeWave` export after `fitNext` (Structure §2): greedy
  walk in given order; per-node virtual wallet (remaining tokens − cumulative, time whole) → `canAfford`;
  fit ⇒ dispatch + `cumulativeTokens += price.tokens`; else ⇒ stopped; continue.
- **Verify:** `bun run check:typecheck` green (reuses existing `canAfford` / `Wallet` / `Budget` imports).
- **Commit:** `feat(engine): authorizeWave — fitNext generalized to a ready-set on one shared wallet`.

## Step 4 — `authorizeWave` unit tests in `src/engine/spend-core.test.ts`

- Add `describe("authorizeWave", …)` with the seven cases (Structure §4): all-fit · token-stop (cumulative)
  · time-stop (each-fits) · continue-after-stop (non-monotone) · none-fit · empty set · exact-fit boundary.
- **Verify:** `bun run check:test` green.
- **Commit:** `test(engine): authorizeWave — all-fit / token-stop / time-stop / skip-continue / empty`.

## Step 5 — Full gate + Review

- Run `bun run check` (baml:gen + typecheck + full test suite) to confirm **no regression** in the existing
  wallet/spend/graph tests — the changes are strictly additive, so the single-chain path must stay green.
- Write `review.md`: files changed, test coverage vs AC, open concerns, the T-048-02 handoff.
- **Commit:** the review artifact (and any work-dir artifacts) with the ticket.

## Risk / deviation watch

- **Single==debit must hold for Usage too** (not just Budget). If `debitWave(w, [usage])` diverged from
  `debit(w, usage)`, the fold normalization is wrong — pinned by an explicit test (Step 2).
- **Continue-after-stop** is a deliberate choice over stop-all (Design Decision 3). If a reviewer prefers
  stop-all semantics it is a one-line change (break instead of continue) — flagged in review, not assumed.
- **`noUncheckedIndexedAccess`:** the loops use `for…of` (no indexed access) so no `?? `-guards needed; the
  fold reads `actualToBudget(a)` returns, not array indices. Confirm typecheck stays clean.
- Keep each artifact ~200 lines; commit incrementally so a crash reseeds at the last green step.
