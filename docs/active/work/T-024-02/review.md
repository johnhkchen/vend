# T-024-02 Review — autonomous-spend-loop

Handoff. What changed, test coverage, open concerns. Read this instead of the diff.

## Summary

Built the walk-away spend engine (E-024 P4): given a funded `Wallet` (T-024-01) and the
board's ranked work, spend the wallet down — predict each pull's price, check `canAfford`,
cast it, debit by the cast's **actuals**, repeat until a clean stop. Three pieces, on the
house pure-core / impure-shell split:

1. **The actuals seam** on `RunSummary` (`cast.ts`) — the cast now surfaces what it actually
   cost, so the wallet debits the real burn, not the predicted envelope.
2. **The pure decision core** (`spend-core.ts`) — `fitNext` + `shouldContinue`, unit-tested.
3. **The impure loop** (`spend.ts`) — `spendDown`, driving the core + an injected cast + the
   wallet's `debit`, returning a structured `SessionResult`.

Committed: `9784ba5` — `feat(engine): autonomous spend loop + RunSummary actuals seam (T-024-02)`.

## Files changed

| File | Action | Notes |
|------|--------|-------|
| `src/engine/cast.ts` | **modified** | `CastActuals` type + optional `actuals?` on `RunSummary`; `castPlay` lifts `endedAt` and returns actuals. |
| `src/engine/spend-core.ts` | **created** (~135 lines) | Pure `fitNext` + `shouldContinue` + the session/board/step types. |
| `src/engine/spend-core.test.ts` | **created** (~108 lines) | 16 unit tests; every branch. |
| `src/engine/spend.ts` | **created** (~150 lines) | Impure `spendDown` loop + `sumActuals`; re-exports the core. |
| `docs/active/work/T-024-02/*.md` | created | RDSPI artifacts. |

The `cast.ts` change is additive: behavior is byte-identical (the logged record is unchanged;
`endedAt` is just computed once and reused). The full pre-existing suite (789) stays green.

## Public surface

- `interface CastActuals { usage: Usage; wallMs: number }` + `RunSummary.actuals?` — the
  cast's measured cost (tokens + wall-clock ms), kept IA-8-separate.
- `fitNext<C>(wallet, candidates, priceOf): C | null` — highest-leverage candidate that fits,
  over the pre-ranked board; null when nothing fits. Generic; never re-ranks (IA-1).
- `shouldContinue(wallet, board: BoardState, lastOutcome): Continuation` — the three clean
  stops (`andon` → `board-cleared` → `wallet-exhausted`), each with a reason + detail.
- Types: `StopReason`, `Continuation`, `BoardState`, `SpendStep`, `SessionResult`, `StepSignal`.
- `spendDown<C>(params: SpendLoopParams<C>): Promise<SessionResult>` — the loop. Takes the
  wallet, the ranked candidates, and injected `priceOf` / `castOne` / `labelOf` / `onStep`.

## How the acceptance criteria are met

1. **Pure `fitNext` + `shouldContinue`, unit-tested on each stop + the fits/doesn't-fit
   boundary.** ✅ `spend-core.ts` is pure (type-only imports + the pure `canAfford`);
   `spend-core.test.ts` covers fits / skips-an-unaffordable-head / null / empty / exact-fit /
   per-denomination for `fitNext`, and all three stops + precedence + continue for
   `shouldContinue`.
2. **`RunSummary` surfaces actuals; existing cast path + tests unaffected.** ✅ Additive
   optional field; `castPlay` populates it without changing the logged record; 789 prior tests
   still pass; no test asserted `RunSummary`'s full shape.
3. **Impure loop funds→fits→casts→debits→repeats→stops cleanly with a structured result; never
   authorizes an unaffordable cast (P7); andon ends the session.** ✅ `spendDown` casts ONLY a
   `fitNext` result (affordable on predicted price → P7 by construction), debits actuals every
   iteration (incl. andon'd casts), and `shouldContinue` ends on andon (IA-9) — returning a
   `SessionResult` (cleared count, per-cast cost, remaining, stop reason), never throwing.
4. **`bun run check:*` green.** ✅ `bun run check` = baml:gen + typecheck + 805 tests, all green.

## Test coverage

- **Unit (the gate):** `spend-core.test.ts`, 16 tests — the only load-bearing branching logic
  is the pure core, and every branch is covered with fabricated wallets and `priceOf` fixtures
  (no spawn, no fs, no addon). This is where a reviewer's time pays off.
- **Not unit-tested — `spend.ts` (by design, the `castChain` stance).** Its decision logic IS
  the tested core, its debit IS the tested wallet (`wallet.test.ts`, 28 tests), and its cast IS
  the tested chain. The loop itself is mechanical wiring (select → cast → debit → repeat),
  proven LIVE when T-024-03 injects the real `castProposeDecomposeChain` + `recalibrate`.

## Open concerns / notes for the reviewer

1. **`spendDown` is unit-test-shaped but left untested (per ticket).** Because `castOne` is
   injected, `spendDown` is actually "pure given injected casts" — it *could* be tested with
   fake `ChainResult`s exactly as `chain-core.test.ts` tests `runChain`. The ticket explicitly
   frames it as the impure shell "not unit-tested, like `castChain`", so it is left to the live
   proof. **If a reviewer prefers belt-and-suspenders, a fake-cast test of the loop's
   accumulate/stop/debit sequencing is a cheap, high-value future add** — flagging it as the one
   place the house "untested impure wiring" rule leaves real loop logic (board-drop, cleared
   count, sumActuals) unexercised until T-024-03.
2. **`fitNext` skips an unaffordable head to a cheaper tail.** Deliberate (the ticket: "the
   highest-leverage candidate that *still fits*"; "spend the wallet down"). The consequence: a
   wallet too small for a top keystone but big enough for several leaves will spend on the
   leaves. If the intended policy were strict head-of-line (stop if the top doesn't fit), this
   would need to change — confirmed against the ticket wording as the greedy first-fit intent.
   Documented in `design.md` D4.
3. **`sumActuals` debits 0 for a step recoverable by neither the seam nor the ledger.** Today
   `castPlay` always populates `actuals`, so the fallback is defensive (a future executor). A
   step measurable by neither contributes 0 — the wallet simply doesn't move on what we couldn't
   measure (honest, never a phantom charge), but it does mean an unmeasured cast is "free" against
   the wallet. Acceptable given the seam always fires today; worth revisiting if a non-`castPlay`
   executor lands without actuals.
4. **`canAfford`/`debit` denomination asymmetry carries through.** The predicted price gates
   authorization (P7); the actual can still overshoot tokens (IA-8 detect-after), surfaced as
   `SpendStep.overshoot`. The session does not *stop* on a token overshoot alone (it's sunk
   cost, already debited and floored) — it stops on the next `fitNext`/`shouldContinue` pass.
   This is the intended IA-8 behavior, noted so it isn't read as a missing guard.

## Downstream readiness (not in scope, for context)

- **T-024-03 (`vend work` gesture)** composes this: fund a `Wallet` (`allocate`), build the
  ranked `candidates` (survey/menu board), inject `priceOf` (`recalibrate` + `loadRunLog` +
  `budgetForTier`, per `cli.ts`'s `envelope` arm), inject `castOne` (`castProposeDecomposeChain`),
  inject `labelOf`, and render `onStep` (IA-7) + the `SessionResult` (Settle summary). All seams
  are in place; nothing in the engine blocks it.

No blocking issues. The gate is green; ready for human review and for T-024-03 to build on.
