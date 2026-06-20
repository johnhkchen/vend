# T-025-01 — Research: per-step wallet-priced chain

*Phase: Research. Descriptive map of the seam the budget-threading fix touches. No solutions here.*

## The defect, in one sentence

`vend work` **authorizes** a pull at the wallet-recalibrated price (propose 227k + decompose 227k)
but **executes** it under each play's *static* default (propose-epic 150k, decompose-epic 120k),
because `castWork` calls `castProposeDecomposeChain` with **no budget**. A pull whose propose step
needs 175k clears the wallet's 227k reservation, then `budget-exhausted` andons under the 150k
default and the chain halts before staging. Authorization ≠ execution. (Diagnosis:
`work/T-024-03/sweep-logs/findings.md`.)

## The four modules in the seam

### 1. `src/play/chain-propose-decompose.ts` — the capstone chain (E-011, T-011-02)

The one site that wires the two concrete plays onto the `castChain` primitive. Relevant shape:

- `ChainProposeDecomposeOptions` (lines 33–44): `signal`, optional `budget` (**uniform** — "applied
  to BOTH steps"), `projectRoot`, `model`, `transcriptDir`.
- `castProposeDecomposeChain(opts)` (lines 68–109): the IMPURE verb. At lines **72–73** it computes
  the two per-step budgets *today already*:
  ```ts
  const proposeBudget   = opts.budget ?? proposeEpicPlay.budget;     // 150k default
  const decomposeBudget = opts.budget ?? decomposeEpicPlay.budget;   // 120k default
  ```
  These already feed BOTH the `PlayStep.budget` field and the `adapt`/`assembleProposeEpicInputs`
  budget (lines 79, 84–87, 97). **The two-variable structure the fix needs already exists** — there
  is one fallback rung (`opts.budget`), and the fix inserts a higher-priority per-step rung above it.
- `epicSubjectFromPath` (lines 52–55): the module's one pure helper. PURE (string split).

**Purity stance (header, lines 20–24):** this module value-imports both plays (the BAML native
addon), so **no `bun test` may value-import it**. Its logic is the pure `runChain` + the addon-free
offline thread proof (`chain-propose-decompose.test.ts`) + the live sweep. The offline test
**deliberately does not import this module** (test header lines 24–26) and *mirrors* the pure helpers
with local copies (e.g. `derive` at line 160 mirrors `epicSubjectFromPath`) precisely because
importing would load the addon. **This is the central constraint on where new pure logic may live to
be unit-tested.**

### 2. `src/play/work.ts` — the `vend work` composition shell (E-024, T-024-03)

The composition layer that wires wallet + spendDown + chain. Relevant shape:

- Lines 118–123 — the price is predicted **once** (the chain casts the same two plays for every
  signal): it loads the run log, then sums two recalibrated envelopes:
  ```ts
  const price = sumBudgets(
    recalibrate(proposeEpicPlay.name,   records, PRICE_TIER, prior).envelope,   // ← discarded
    recalibrate(decomposeEpicPlay.name, records, PRICE_TIER, prior).envelope,   // ← discarded
  );
  ```
  **The two individual envelopes already exist — they are computed, summed into `price`, and then
  thrown away.** `price` is used only by `priceOf: () => price` (line 128) for `canAfford`.
- Line 129 — the `castOne` thunk, the defect site:
  ```ts
  castOne: (signal) => castProposeDecomposeChain({ signal, projectRoot: root, ...model }),
  //                                              ^ no budget → static defaults
  ```
- `sumBudgets` (lines 73–75): pure, per-denomination sum. Kept.
- Purity stance (header, lines 15–19): IMPURE; value-imports the chain (addon); its parse+render is
  the tested pure `work-core.ts`. **Same `-core` split precedent** that the fix can follow.

### 3. `src/engine/spend.ts` — the autonomous spend loop (E-024, T-024-02)

`spendDown<C>(params)` takes `priceOf: (c) => Budget` (gates `canAfford`/`fitNext`) and
`castOne: (c) => Promise<ChainResult>` (the actual cast, debited by ACTUALS). The loop is agnostic to
*what* budget the cast runs under — it only knows the price for fitting and the actuals for debiting.
**The fix does not touch `spend.ts`**: it changes only what `castOne` passes downstream. The
authorization/execution mismatch is entirely upstream of the loop.

### 4. `src/budget/budget.ts` — `Budget` (T-001-03)

`Budget = { timeMs, tokens }`. PURE module. `check()` returns the `exhausted` andon (`EBUDGET_EXHAUSTED`)
when `spent > ceiling` — this is the andon that fired in the sweep. No change needed; the fix raises
the ceiling the cast runs under to match what was authorized.

## The play defaults (the cold-start fallbacks — NOT to be bumped)

- `proposeEpicPlay.budget` = `{ timeMs: 1_800_000, tokens: 150_000 }` (`propose-epic.ts:105`). The
  comment notes a live chain cast spent ~109k; 150k was the hand-set clearance. The sweep's pull
  needed 175k — *above* this default, *below* the wallet's 227k.
- `decomposeEpicPlay.budget` = `{ timeMs: 7_200_000, tokens: 120_000 }` (`decompose-epic.ts:178`).

These stay as the **cold-start fallback** (the third rung). The ticket is explicit: do not bump them,
do not re-derive per-play envelopes (E-013 `recalibrate.ts` owns that).

## The pricing source (E-013)

`recalibrate(playName, records, tier, prior).envelope` returns a `Budget` fitted from the play's
measured run-log history, cold-starting to `prior` (`budgetForTier(PRICE_TIER)`). `work.ts` already
calls it twice — once per play — at the `standard` tier. These two `.envelope` results ARE the
per-step budgets the wallet authorized on. The fix's job is to stop discarding them.

## Constraints surfaced

1. **Back-compat is a hard AC.** A bare `vend run` / `vend chain` must cast exactly as today: when
   no per-step and no uniform `budget` is given, both steps still fall to the play default. The fix is
   purely additive — a new highest-priority rung above the existing `opts.budget` rung.
2. **Per-step, not uniform.** Propose and decompose recalibrate *separately* and can diverge, so the
   threaded values must be two budgets, not one summed total split in half.
3. **Addon-free testability.** AC#3 wants the per-step budget *selection* unit-tested. Selection logic
   placed inside `chain-propose-decompose.ts` cannot be imported by a test (addon). It must live in a
   pure module (the `work-core.ts` precedent) to get real coverage — mirroring it like the existing
   `derive` test gives no real coverage of the shipped code.
4. **The live cast stays untested** (like `castChain`); AC#4 is the human live re-sweep, proving the
   fitted pull now clears under its 227k reservation.

## Existing test assets

- `chain-propose-decompose.test.ts` — addon-free offline thread proof; mirrors pure helpers locally.
- `work-core.test.ts` — the pure-core precedent for the `vend work` parse/render seam.
- `bun run check:*` is the green gate (typecheck + test + lint).
