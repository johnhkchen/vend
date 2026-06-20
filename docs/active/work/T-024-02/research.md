# T-024-02 Research — autonomous-spend-loop

Map of the codebase as it bears on the walk-away spend loop (P4). Descriptive only —
what exists, where, how it connects, and the constraints the loop must honor. No
solutions here.

## What the ticket asks for

Given a funded `Wallet` (T-024-01) and the board's ranked work, **spend the wallet down**:
predict each next pull's price, check `canAfford`, cast it (`castChain`, pull→clear),
debit the wallet by the cast's **actuals**, repeat until a **clean stop** (wallet can't
afford next · board cleared · andon fired). Split into a pure decision core (`fitNext`,
`shouldContinue` — unit-tested) and an impure loop (drives the core + `castChain` + debit
— not unit-tested, like `castChain`). It requires extending `RunSummary` to surface the
cast's actuals.

## The pieces that already exist

### The wallet — `src/budget/wallet.ts` (T-024-01, done)
The depleting-budget algebra the loop draws against. Pure, immutable.
- `Wallet { funded: Budget; remaining: Budget }` — two denominations (wall-clock ms,
  tokens), never conflated (IA-8).
- `canAfford(wallet, predicted: Budget): boolean` — both-denomination `<=`; honest per
  denomination (fits-on-tokens-not-time → false). **This is the affordability gate
  `fitNext` walks against.**
- `debit(wallet, actual: Usage | Budget): DebitResult` — immutable; floors at zero;
  surfaces per-denomination `overshoot` (IA-8 detect-after for tokens). Accepts a `Usage`
  (tokens via `countTokens`, time untouched) OR a `Budget` (both denominations). **This is
  what the loop calls each iteration with the cast's actuals.**
- `remaining(wallet): Budget`, `formatWallet(wallet): string` — truthful readouts.
- All pure: no fs/clock/network/process. Imports `Budget`/`Usage`/`countTokens` from
  `budget.ts`.

### The cast surface — `src/engine/cast.ts` + `cast-core.ts`
`castPlay(play, inputs, budget, opts): Promise<RunSummary>` — the single impure cast
orchestrator. Relevant facts:
- `RunSummary { runId; outcome: RunOutcome; materialized: boolean; produced?: string }` —
  **carries NO usage/wall-clock today**. The actuals seam this ticket must add.
- Inside `castPlay`: `result.usage` (the seam's terminal `Usage`) is metered via
  `check(budget, usage)`; `startedAt`/`endedAt` are ISO stamps (`new Date().toISOString()`);
  `endedAt` is currently computed **inline** in the `appendRunLog` call (line ~218).
  Wall-clock ms is derivable as `Date.parse(endedAt) − Date.parse(startedAt)` (the same
  derivation `run-log.ts wallClockMs` does on a record). The cast already HAS both numbers;
  it simply does not RETURN them.
- `castPlay` is NOT unit-tested (its logic is the pure `cast-core.ts`). No test asserts
  `RunSummary`'s full shape — safe to extend with an optional field.

### The chain surface — `src/engine/chain.ts` + `chain-core.ts`
The pattern the loop mirrors and the cast it drives.
- `castChain(steps: PlayStep<any,any>[]): Promise<ChainResult>` — impure shell; runs a
  sequence of plays, threading `produced`, halting on non-success.
- `ChainResult { steps: readonly RunSummary[]; outcome: RunOutcome; halted: boolean;
  produced?: string; haltReason? }` — **`steps` is one `RunSummary` per cast step**, so a
  chain's total actual cost is the SUM of its steps' actuals (once the seam exists).
- `runChain` (pure core) is "pure given injected `cast` thunks" — spawns nothing; the
  impure edges are injected. `chain-core.test.ts` proves it with **fake casts returning
  canned summaries**. This is the precedent for testing a loop without spawning.
- **Architecture invariant (E-007 keystone): the engine NEVER imports `src/play/`.** A
  concrete chain (`src/play/chain-propose-decompose.ts`) depends UP onto the primitive; the
  primitive takes injected thunks. **Consequence for this ticket: a spend loop living in
  `src/engine/` cannot call `castProposeDecomposeChain` directly — the cast must be an
  injected thunk**, exactly as `castChain` injects `cast`.

### The predicted price — `src/ledger/recalibrate.ts` (E-013)
`recalibrate(play, records, tier, prior, opts): RecalibrateResult` — proposes a play's
envelope (`Budget`) from its measured percentile history, cold-starting to a hand prior.
`{ envelope: Budget; confidence; source }`. The `envelope` is the **predicted price**
`canAfford` checks against. Composed impurely with `loadRunLog` (`run-log.ts`) and
`budgetForTier` (`shelf/gather.ts`) — see `cli.ts` `envelope` arm (lines 536–566) for the
exact wiring. The loop consumes this as an injected `priceOf`; it does not build it.

### The ranked board — `src/shelf/menu.ts` + `src/shelf/gather.ts`, `src/play/survey.ts`
The candidates the loop pulls from, already leverage-ranked (IA-1):
- `Action { id; title; tier: ValueTier; readiness; budget: Budget }` — `signalsToActions`
  builds these from demand.md; `rankActions` sorts by leverage tier then readiness
  (`menu.ts`). `visibleActions` filters to salient. **The board arrives pre-ranked; the
  loop must NOT re-rank (no new optimizer) — IA-1 rank IS the policy.**
- Survey stages a ranked `Board` (`Signal[]`); the menu's `Action[]` is the dispatchable
  shape. Either way candidates are an ordered list highest-leverage-first.

### The run log — `src/log/run-log.ts`
`loadRunLog()` → `{ records, skipped }`; `RunRecord` carries `usage`, `startedAt`/`endedAt`
(so `wallClockMs(record)` recovers time), `runId`. **This is the actuals FALLBACK**: if a
cast surfaces no actuals on its summary, the loop can `loadRunLog` and find the record by
`runId`. The engine may import `src/log/` (cast.ts already does).

## Constraints the loop must honor

- **P7 — no overspend past the wall.** Never authorize a cast the wallet can't afford. The
  authorization check uses the PREDICTED price (`canAfford`), evaluated BEFORE every cast.
- **IA-8 — two denominations.** Wall-clock is a hard wall (a cast that overruns andon's
  mid-flight, `timed-out`); tokens are detect-after (an actual can overshoot what remained,
  surfaced by `debit`'s `overshoot`). The loop debits actuals regardless of outcome (an
  andon'd cast still burned cost).
- **IA-9 — andon = clean stop.** A gate/budget/timeout stop ends the session as a
  *successful refusal*, not a crash. The loop returns a structured result; it does not throw.
- **IA-1 — leverage rank is the pull policy.** `fitNext` returns the highest-leverage
  candidate that fits, walking the pre-ranked list; it introduces no scoring.
- **IA-7 — production-line signal.** The loop emits, per step, which pull is running
  against the wallet burn (T-024-03 renders it).
- **Engine ⊥ play (E-007).** A loop in `src/engine/` takes injected `castOne`/`priceOf`;
  T-024-03 (the gesture, at the composition layer) injects the real `castChain`/recalibrate.
- **House purity split.** Pure decision core (`spend-core.ts`, unit-tested) vs impure shell
  (`spend.ts`, not unit-tested) — mirrors `cast`/`cast-core`, `chain`/`chain-core`.

## Open questions for Design
- Where the decision core + loop live, and what `fitNext`/`shouldContinue`/the loop's exact
  signatures are (generic over candidate type? injected cast thunk?).
- How the three stop conditions divide between `fitNext` (returns null) and `shouldContinue`.
- The exact shape of the actuals seam on `RunSummary` and the session result.

## Verification facts
- `bun run check` = `baml:gen && tsc --noEmit && bun test` (789 tests pass at T-024-01).
- tsconfig: `strict` + `noUncheckedIndexedAccess`; **no `exactOptionalPropertyTypes`** (so
  returning `{ field: undefined }` for an optional is legal — `castPlay` already does it for
  `produced`).
