# T-048-03 — Research: Budget Invariant Coverage Audit

> Descriptive map of the macro-wallet's IA-8 two-denomination contract and the test
> surface that exercises it. No solutions proposed here — this is the lay of the land
> the audit will judge against. This ticket is **read-only** (audit; an additive
> test-only characterization is optional).

## Why this ticket exists

E-048 (`cross-branch-budget-wallet`) generalizes the per-cast macro-wallet to a
concurrent **wave** drawing from ONE shared envelope. T-048-01 builds the pure wave
core (`authorizeWave` / `debitWave`); its back-compat requirement is that a
**single-node wave behaves exactly like the current sequential `debit`**. Before that
generalization lands, this ticket pins the ground it builds on: confirm the gate is
green and the IA-8 contract the wave will inherit is actually covered by tests — not
just implied by the source comments. T-048-03 has **no `depends_on`**, so the loop runs
it concurrently with T-048-01 as a deliberate parallel check.

## The algebra under test — `src/budget/wallet.ts`

A pure module (no fs/clock/network/process; mirrors `budget.ts`). It is the
**depleting macro-budget algebra** and only that. Key types and exports:

- `Wallet` — `{ funded: Budget; remaining: Budget }`. `funded` immutable (set once at
  allocation); `remaining` is the live balance, floored at 0.
- `Budget` (from `budget.ts`) — the two-denomination pair `{ timeMs, tokens }`.
- `allocate(macro: Budget): Wallet` — guards each funded dimension as a **positive
  finite integer** (a fund of 0 is a caller error → `RangeError`); `remaining` starts
  equal to `funded`.
- `canAfford(wallet, predicted: Budget): boolean` — the **HARD WALL**. Returns true
  only if `predicted.tokens <= remaining.tokens` AND `predicted.timeMs <=
  remaining.timeMs`. Per-denomination, never conflated: fits-on-tokens-but-not-time
  does NOT fit. `<=` boundary is affordable. A non-finite predicted naturally fails the
  comparison → `false` (documented "safe-refuse").
- `debit(wallet, actual: Usage | Budget): DebitResult` — the **DETECT-AFTER**
  settlement. Subtracts the cast's actual cost from BOTH denominations, **floors each at
  0** (`floorNonNeg`), and surfaces a per-denomination `overshoot` (`overBy` =
  `max(0, actual - remaining)`). `funded` carried through unchanged; input never mutated
  (returns a fresh wallet).
- `remaining(wallet): Budget` — stable accessor.
- `formatWallet(wallet): string` — honest one-line readout, BOTH denominations as
  `spent/funded · remaining left`, never collapsed (IA-8 display side).

Internal helpers: `assertPositiveInt` (allocate guard), `floorNonNeg` (debit floor),
`overBy` (overshoot), `actualToBudget` (normalizes a `Budget` actual → both denoms; a
`Usage` actual → tokens-only via `countTokens`, leaving `timeMs` untouched), plus
format helpers `fmtTokens` / `fmtMs`.

## The IA-8 contract, stated precisely (from the source banner)

> THE METER MUST NOT LIE ABOUT ITS TWO DENOMINATIONS. The wallet honors both,
> independently, NEVER conflated:
> - ⏱ **wall-clock ms = HARD WALL** — a cast that overruns halts mid-flight, no partial
>   value; so `canAfford` refuses a cast that does not fit on time even if it fits on
>   tokens.
> - ◇ **tokens = DETECT-AFTER** — a cleared cast's actual burn can overshoot what
>   remained (the cast already ran; the burn is sunk); so `debit` FLOORS remaining at
>   zero and SURFACES the overshoot rather than going silently negative or throwing.

One deliberate divergence from `budget.ts`: `allocate` guards each dimension as a
positive integer (a fund of 0 is an error), but a DEBITED `remaining` floors at 0 — a
spent wallet is legitimately empty (IA-9/10: depletion is a successful terminal state).

## `countTokens` — the single definition of "spent" (tokens)

`budget.ts:117` — `countTokens(usage)` sums `input_tokens + output_tokens +
cache_read_input_tokens + cache_creation_input_tokens` (each via `num`, absent ⇒ 0).
The wallet's `debit` reuses this for the `Usage` branch — one source of truth, not
re-implemented.

## The test surface — `src/budget/wallet.test.ts` (180 lines)

Pure, fabricated inputs only (no spawn/fs/clock — mirrors `budget.test.ts`). Helpers
`macro(timeMs, tokens)` and `usage(u)`. `describe` blocks:

1. `allocate` — funds remaining == macro; `RangeError` for invalid timeMs and tokens
   (each `test.each([0, -1, NaN, 1.5])`).
2. `remaining` — returns live balance; reflects a debit.
3. `canAfford` — 7 cases: fits-both; over-on-tokens; over-on-wall-clock;
   fits-tokens-not-time (IA-8); fits-time-not-tokens; exact-fit `<=` boundary;
   depleted-wallet-affords-nothing.
4. `debit — fitting Budget actual` — depletes both denoms exactly, no overshoot;
   carries funded unchanged + never mutates input.
5. `debit — Usage actual` — debits tokens by `countTokens`, leaves wall-clock
   untouched; all-absent Usage debits nothing.
6. `debit — token overshoot (IA-8 detect-after)` — remaining tokens floor to 0,
   overshoot surfaced (7k), time denom independent.
7. `debit — time overshoot (defensive symmetry)` — remaining time floors to 0,
   overshoot surfaced (3k), tokens independent.
8. `debit — sequence depletes monotonically` — repeated debits decrease both, reach
   exactly zero, then floor + report full overshoot on an empty wallet.
9. `formatWallet` — 4 cases (fresh; mid-depletion spent=funded−remaining; depleted; two
   distinct bars never combined).

## Boundaries & constraints

- **No production-code edits.** Audit-only. An additive **test-only** characterization
  MAY be added if a genuine, trivial gap surfaces; default deliverable is the note.
- **No live model cast** — the wallet is pure; everything is fabricated inputs.
- The gate is `bun run check` (= `baml:gen` → `tsc --noEmit` → `bun test`).
- The back-compat anchor for T-048-01: whatever pins the current `debit` per-cast
  both-denomination behavior is what `debitWave([oneActual])` must equal for a
  single-node wave. The audit must locate that pin (or flag its absence as the top gap).

## Open questions the design phase resolves

- Are all three IA-8 facets (hard wall / detect-after / sum-both) test-pinned, or only
  implied? (Map each to a covering test or "gap".)
- Is the single-node back-compat anchor present?
- Is the documented `canAfford` non-finite "safe-refuse" actually tested? (It is a
  documented behavior — confirm or flag.)
