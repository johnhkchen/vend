# T-024-02 Design — autonomous-spend-loop

Options, tradeoffs, decisions — grounded in Research. The walk-away engine: a pure decision
core + an impure loop + the `RunSummary` actuals seam.

## D1 — Module placement & purity split

**Decision.** Three source changes, mirroring the `cast`/`cast-core` and `chain`/`chain-core`
house pattern:
- `src/engine/spend-core.ts` — **PURE** decision core (`fitNext`, `shouldContinue`, the pure
  data types). Unit-tested in `spend-core.test.ts`.
- `src/engine/spend.ts` — **IMPURE** loop (`spendDown`). Drives the core + the injected cast +
  `debit`. Re-exports the core (the `cast.ts`/`chain.ts` re-export-the-core idiom). NOT
  unit-tested.
- `src/engine/cast.ts` — extend `RunSummary` with the actuals seam (+ populate it in
  `castPlay`).

**Why `src/engine/` (not `src/budget/`):** the loop drives `castChain` (an engine concept)
and consumes `RunSummary`/`ChainResult` (engine types). The wallet algebra stays in
`src/budget/`; the loop that *spends* it is engine orchestration, exactly as `castPlay`
spends a per-cast `Budget`.

**Rejected — one impure module, no core.** Folding `fitNext`/`shouldContinue` inline into the
loop would leave the only branching logic (selection + the three stops) untestable without
spawning. The ticket explicitly wants them pure and unit-tested. Rejected.

## D2 — The engine ⊥ play boundary forces an injected cast (load-bearing)

The E-007 keystone: **`src/engine/` must never import `src/play/`.** `castProposeDecomposeChain`
(the real pull→clear) lives in `src/play/`. So `spendDown`, living in `src/engine/`, **cannot
call it directly** — it would create an engine→play edge and a cycle.

**Decision.** `spendDown` takes an **injected `castOne: (c) => Promise<ChainResult>`** thunk,
precisely as `castChain` takes injected `cast` thunks and `runChain` takes injected `ChainStep`s.
T-024-03 (the `vend work` gesture, at the composition layer that may import both engine and
play) injects the real `castProposeDecomposeChain`. Same for the predicted price: an injected
`priceOf: (c) => Budget` (the gesture wires `recalibrate`), and `labelOf: (c) => string` for the
production-line signal / session result.

This also makes the loop **generic over the candidate type `C`** — it never inspects a
candidate, only ranks-order, prices, casts, and labels it. The board can be `Action[]`,
`Signal[]`, or signal strings; the loop is agnostic. Clean, and it keeps the engine decoupled
from the board's concrete shape (which is `src/shelf`/`src/play` territory).

**Rejected — `spendDown` calls `castProposeDecomposeChain` directly.** Breaks the acyclic
invariant the whole codebase is organized around. Non-starter.

## D3 — The actuals seam on `RunSummary`

The wallet debits by what a cast ACTUALLY cost. `castPlay` already has the numbers (`result.usage`,
`startedAt`/`endedAt`) but does not return them.

**Decision.** Add an **optional** `actuals?: CastActuals` to `RunSummary`, where
`CastActuals { usage: Usage; wallMs: number }`. `castPlay` populates it on every cast:
`usage = (result?.usage ?? {}) as Usage` (the same value it already meters), `wallMs =
max(0, Date.parse(endedAt) − Date.parse(startedAt))`. To do this, `endedAt` is lifted into a
`const` (today it is computed inline in the `appendRunLog` call) and reused in both the log
append and the `wallMs` derivation — a one-line refactor, the logged record is byte-identical.

- **Optional, not required:** keeps "extend, don't break". The `chain-core.test.ts` fake
  (`summary(outcome, produced?)`) and any hand-built `RunSummary` literal stay valid. The
  field is *always present on a real cast*; optionality is purely for back-compat of fakes and
  for the documented log-read fallback.
- **`Usage` + separate `wallMs`** (not a pre-summed `Budget`): keeps the two denominations
  IA-8-separate at the seam and lets `debit` consume the `Usage` directly. The loop sums a
  chain's steps into a single `Budget` actual before debiting (D5).

**Rejected — a new return type / breaking change to `RunSummary`.** Every `castPlay` caller
and the chain would need updating, and the chain-core fakes would break. An additive optional
field is the minimal, safe extension (the same move T-013-01/T-014-01/T-015-02 made on
`RunRecord`).

**Rejected — surface actuals only via the run log (no seam).** The ticket names the seam as
required and the log read as the *fallback*. A log round-trip per cast is slower and couples the
loop to ledger I/O for the common path. The seam is primary; the log is the safety net.

## D4 — How the three stops divide between `fitNext` and `shouldContinue`

The two pure primitives the ticket names.

`fitNext(wallet, candidates, priceOf) → C | null` — walks the **pre-ranked** candidates and
returns the **first one that `canAfford`s its predicted price** (= highest-leverage that fits),
else `null`. First-fit in rank order; no scoring, no re-sort (IA-1; "no new optimizer").

**Decision on the skip question.** If the top candidate is unaffordable but a lower one fits,
`fitNext` **skips down** to the affordable one (the ticket: "the highest-leverage candidate that
*still fits*"). Only when NOTHING fits does it return `null` (→ the wallet-exhausted stop).
*Rejected — strict head-of-line (stop if the top doesn't fit):* it would strand a still-spendable
wallet on a cheaper tail of ready work, contradicting "spend the wallet down". Documented as the
deliberate greedy policy.

`shouldContinue(wallet, boardState, lastOutcome) → Continuation` owns **all three stop
reasons**, rendering each with a reason. To do so purely (without itself calling `fitNext`/
`priceOf`), it takes a distilled `boardState`:
```
BoardState { remaining: number;  // candidates left on the board (0 ⇒ cleared)
             fits: boolean }      // did fitNext find an affordable next? (next !== null)
```
Precedence (checked in order):
1. `lastOutcome` is a non-success andon → **stop "andon"** (IA-9; a fired wall ends the session).
2. `remaining === 0` → **stop "board-cleared"**.
3. `!fits` → **stop "wallet-exhausted"** (candidates remain but none is affordable).
4. else → **continue**.

`wallet` is passed (per the ticket signature) and used in the stop `detail` string (the
remaining readout), so the parameter is real, not vestigial.

**Why `fits: boolean` over passing `next: C`:** `shouldContinue` never uses the candidate
itself, only whether one fits — a boolean keeps it non-generic and trivially testable. The loop
runs `fitNext` once per iteration and feeds `next !== null` in as `fits`.

**Rejected — `fitNext` owns the can't-afford stop, `shouldContinue` owns the other two.** It
reads cleaner to have ALL three reasons (and their precedence) in one pure function the tests
pin, exactly as the ticket frames `shouldContinue` as "the three stop conditions".

## D5 — The loop & the session result

`spendDown<C>(params): Promise<SessionResult>` — the impure shell, structured like `runChain`:
```
let lastOutcome: RunOutcome | null = null
loop:
  next = fitNext(wallet, board, priceOf)
  cont = shouldContinue(wallet, { remaining: board.length, fits: next !== null }, lastOutcome)
  if cont.action === "stop": break          // next is non-null past this point
  onStep?({ phase: "start", candidate: labelOf(next), … })
  result = await castOne(next)              // the injected castChain (pull→clear)
  lastOutcome = result.outcome
  actual = sumActuals(result)               // Σ steps' actuals → one Budget {tokens,timeMs}
  { wallet, overshoot } = debit(wallet, actual)
  board = board without next
  steps.push({ candidate, outcome, cost: actual, overshoot, remainingAfter: remaining(wallet) })
  onStep?({ phase: "done", … })
return { steps, stop: cont.reason, stopDetail, remaining: remaining(wallet), cleared }
```
- **P7 holds by construction:** the only cast authorized is `next`, which `fitNext` proved
  affordable on the PREDICTED price. We never cast an unaffordable cast.
- **Debit regardless of outcome:** an andon'd cast still burned cost (detect-after tokens /
  hard-wall time); we debit, *then* `shouldContinue` sees the andon and stops next iteration.
- **`sumActuals(result)`** (private, pure helper in `spend.ts`): sums each step's
  `actuals.usage` tokens (via the run-log/budget token sum) and `actuals.wallMs` into one
  `Budget`. **Fallback:** if a step surfaces no `actuals` (a future executor), the loop reads
  the record by `runId` via `loadRunLog` (`wallClockMs` + `totalTokens`) — the documented
  log-read fallback. With the D3 seam, the common path never needs it.

`SessionResult` (pure type in `spend-core.ts`): `{ steps: SpendStep[]; stop: StopReason;
stopDetail: string; remaining: Budget; cleared: number }`, and `SpendStep { candidate; outcome;
cost: Budget; overshoot: Budget; remainingAfter: Budget }`. This is exactly the ticket's "what
cleared, per-cast cost, remaining, stop reason" for the Settle summary. `StepSignal`/`onStep`
carry the IA-7 production-line emit.

## D6 — Testing strategy (Plan elaborates)
- **`spend-core.test.ts` (unit, the gate):** `fitNext` — fits / doesn't-fit boundary, skips an
  unaffordable head to an affordable tail, empty board → null, all-unaffordable → null. Pure
  `priceOf` fixtures + a fixture wallet. `shouldContinue` — each of the three stops with its
  reason + precedence (andon over cleared over exhausted), and the continue case.
- **`spend.ts`:** NOT unit-tested (impure shell, like `castChain`); proven live in T-024-03.
  Its decision logic is the tested core; its debit is the tested wallet. `sumActuals` is simple
  enough to leave to the live proof, consistent with `castChain`'s untested wiring.
