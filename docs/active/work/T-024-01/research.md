# T-024-01 Research — depleting-wallet

Descriptive map of what exists and how the wallet must connect. No solutions here.

## 1. What the ticket asks for

A **pure** `Wallet` value type over the **two denominations** (IA-8) — wall-clock ms
and tokens — with pure operations: `allocate`, `canAfford`, `debit`, `remaining`,
`formatWallet`. Immutable (debit returns a new wallet), floors at zero, surfaces the
token overshoot honestly (detect-after), treats wall-clock as a hard wall. No I/O.
Unit-tested. `bun run check:*` green.

This is the **foundation** of S-024-01 (the macro-wallet epic E-024): T-024-02 (spend
loop) and T-024-03 (`vend work` gesture) compose it. It builds **nothing impure** — it
is the depleting-budget algebra and only that.

## 2. The types it must reuse (do NOT duplicate)

`src/budget/budget.ts` is the per-cast budget module and the direct shape to mirror.
Relevant exports:

- **`Budget`** (lines 17–22): `{ readonly timeMs: number; readonly tokens: number }`.
  The two-denomination allocation. The wallet is funded with one of these (`allocate`)
  and `remaining(wallet)` returns one.
- **`Usage`** (lines 30–35): structural duck-type of the seam's `result.usage` —
  `input_tokens? / output_tokens? / cache_read_input_tokens? /
  cache_creation_input_tokens?`, all optional, coerced `undefined → 0`. The `debit`
  actual-cost path takes `Usage | Budget` per the ticket.
- **`countTokens(usage: Usage): number`** (lines 89–96): the single definition of
  "spent" — sum of all four sub-counts. Reuse for the `Usage` debit path so the wallet
  counts tokens exactly as the per-cast meter does (one source of truth).
- **`check(budget, usage): BudgetOutcome`** (lines 103–117): the per-cast token check.
  Instructive precedent, NOT reused directly — it carries `overage` on exhaustion and
  treats `spent === ceiling` as `ok`. The wallet's overshoot semantics echo this.
- **`BUDGET_EXHAUSTED`** andon code (line 39): the per-cast token-wall code. The wallet
  is a *macro* budget; whether it mints its own depletion marker is a Design question.

Key purity precedent from budget.ts header (lines 1–14): **no network, no fs, no clock,
no child process; does not import the executor seam.** `assertPositiveInt` (lines 66–70)
guards each dimension as a positive finite integer and throws `RangeError` loudly at the
boundary. `num` (lines 60–62) coerces non-finite → 0.

## 3. The house pattern to mirror

`src/ledger/recalibrate.ts` is the canonical pure-core sibling. Observed conventions:

- Every export takes plain values, returns fresh ones — no fs/clock/network/process.
- **Type-only imports** of `Budget`/`ValueTier` so zero-coupling holds (`run-log ⊥
  budget`); the wallet should likewise import `Budget`/`Usage` type-only where it can,
  and `countTokens` as a value (it is pure).
- `positiveInt(n) = Math.max(1, Math.ceil(n))` (lines 94–96) — the conservative coercion
  to a valid budget dimension. Relevant if the wallet ever computes a dimension.
- Dimensions handled **independently** (tokens and wall-clock are separate samples,
  separate bounds — lines 152–161). The wallet's `canAfford` must be honest *per
  denomination*: a cast that fits on tokens but not on wall-clock does **not** fit.
- A dedicated `format*Label` / readout function that "must not lie" (IA-8) renders both
  dimensions — never collapses them to one bar (lines 166–180). `formatWallet` is the
  analogue.

## 4. Test pattern to mirror

`src/budget/budget.test.ts` (the gate for `check:test`):

- `import { describe, expect, test } from "bun:test";`
- A tiny fixture builder: `const budget = (timeMs, tokens): Budget => ({...})`.
- One `describe` per function; **every function and branch covered** — the file states
  it is the gate. Boundary cases explicit (spent-exactly-at-ceiling is its own test).
- `test.each([...])` for the invalid-input RangeError sweep.
- "Fake inputs only — no spawn, no fs, no clock." Fabricated values throughout.
- `recalibrate.test.ts` and `walk-away.test.ts` follow the same shape in `src/ledger/`.

## 5. IA-8 — the constraint that shapes the algebra

`docs/knowledge/information-architecture.md` lines 99–104:

> **The meter must not lie about its two denominations.** Wall-clock is a **hard wall**
> (halts mid-flight). Tokens are **detect-after** (the run can overshoot its envelope;
> the andon catches it afterward — proven live at 108.9k/60k). Drawing the two bars
> identically would be a lie: ⏱ is a countdown to a hard stop; ◇ is a
> burn-rate-vs-envelope that *can* trip the andon late.

Consequences for the wallet:

- **Wall-clock**: a hard wall. `canAfford` must refuse a cast whose predicted time does
  not fit the remaining time, because once started a cast that exceeds the wall halts
  mid-flight (no partial value). The remaining-time denomination never goes negative in
  normal operation — but `debit` must still floor defensively.
- **Tokens**: detect-after. A cleared cast's *actual* token cost can overshoot what
  remained (the cast already ran; the burn is sunk). So `debit` on tokens must **floor
  at zero** AND **surface the overshoot** (the amount by which actual exceeded the
  remaining tokens) — the detect-after andon signal, echoing `check`'s `overage`.

IA-9/IA-10 context (lines 110–127): a stop is a *successful refusal* (amber, not red);
an andon rate is not a defect rate. The wallet's "can't afford the next cast" is the
healthy terminal state of a depleting budget, not an error — relevant to how T-024-02
will read the wallet, and to the *vocabulary* of any depletion marker minted here.

## 6. The forward consumers (context, not built here)

- **T-024-02 (spend loop)**: a pure decision core (`fitNext` + `shouldContinue`) plus an
  impure loop driver. It will call `canAfford(wallet, predictedEnvelope)` to gate the
  next cast and `debit(wallet, actual)` after each cleared cast. The *predicted
  envelope* it passes comes from E-013 `recalibrate()` (`RecalibrateResult.envelope`) —
  the measured price. The wallet **consumes** that envelope; it does not compute it.
- **T-024-03 (`vend work --budget <ms>,<tokens>`)**: the CLI gesture (IA-6
  Confirm→Run→Settle) that calls `allocate(macro)` once and renders `formatWallet`
  in the IA-7 production-line readout. Andon rendered amber (IA-9).
- **RunSummary actuals seam** (`src/engine/cast.ts` lines 74–99 per prior survey):
  `castPlay` currently computes usage/cost for the log but does **not** return it.
  T-024-02 must extend `RunSummary` to carry the cast's actual `Usage`/wall-clock so the
  loop can `debit` precisely. **Out of scope for T-024-01** — but it is *why* `debit`
  accepts `Usage` as well as `Budget`: the actual cost arrives as the seam's usage shape.

## 7. Assumptions & constraints surfaced

- **Where it lives**: `src/budget/` is the natural home (mirrors `budget.ts`, reuses its
  types) — confirmed in Design.
- **Integer dimensions**: budget dimensions are positive finite integers
  (`assertPositiveInt`). Tokens are naturally integral; ms are integral. The wallet
  should honor the same contract for `allocate`. *Remaining* values after debit are also
  integers (sums/differences of integers).
- **No clock**: the wallet cannot measure elapsed time (budget.ts header). It only
  subtracts the *actual* wall-clock ms it is *told* a cast cost. The loop/seam measures;
  the wallet does algebra.
- **Immutability**: `Budget`/`Usage` fields are `readonly`. `debit` returns a *new*
  wallet; the input is never mutated (mirrors recalibrate returning fresh values).
- **Two denominations never conflated**: every operation handles tokens and ms
  separately; `formatWallet` shows both, never one bar.
- **Overshoot is per-denomination and asymmetric**: tokens can overshoot (detect-after);
  wall-clock is a hard wall that, in honest operation, should not overshoot — but the
  algebra must floor defensively on both and only the token overshoot is the *expected*
  surfaced signal.
