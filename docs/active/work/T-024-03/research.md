# T-024-03 Research — `vend work` counter gesture

Descriptive map of the codebase the `vend work` gesture composes. What exists, where, how it
connects. No solutions here — that is `design.md`.

## The ticket in one line

Wire the wallet (T-024-01) + the autonomous spend loop (T-024-02) behind a `vend work --budget
<ms>,<tokens>` CLI verb: the Confirm→Run→Settle spine (IA-6) at macro scale. The two engine
pieces are built and shipped; this ticket is the **composition layer** — the missing third edge
that funds a wallet, builds the ranked board, injects the real cast, drives the loop, and renders
the receipt. It writes no new engine logic; it *wires* tested pieces and *renders* their output.

## The two pieces being wired

### The wallet — `src/budget/wallet.ts` (T-024-01, shipped `be7246d`)

Pure depleting macro-budget algebra over `Budget` (`{ timeMs, tokens }`).

- `allocate(macro: Budget): Wallet` — fund once; guards each dimension positive-int (RangeError on
  a non-positive fund). `Wallet = { funded, remaining }`, `remaining` starts equal to `funded`.
- `canAfford(wallet, predicted): boolean` — per-denomination, fits only on BOTH (IA-8).
- `debit(wallet, actual): DebitResult` — subtract actuals, floor at 0, surface overshoot.
- `remaining(wallet): Budget`, `formatWallet(wallet): string` — the honest two-denomination
  readout `◇ spent/funded · left   ⏱ spent/funded · left` (IA-8). The receipt's meter, reusable.

### The spend loop — `src/engine/spend.ts` + `spend-core.ts` (T-024-02, shipped `9784ba5`)

`spendDown<C>(params: SpendLoopParams<C>): Promise<SessionResult>` — the walk-away loop, generic
over candidate type `C` with everything play-specific INJECTED (engine ⊥ play, E-007):

```ts
interface SpendLoopParams<C> {
  wallet: Wallet;                       // funded macro-wallet
  candidates: readonly C[];             // board work, ALREADY ranked highest-leverage-first (IA-1)
  priceOf: (c: C) => Budget;            // predicted price (E-013 recalibrated envelope)
  castOne: (c: C) => Promise<ChainResult>;  // the real pull→clear (injected)
  labelOf: (c: C) => string;            // production-line label + record
  onStep?: (s: StepSignal) => void;     // IA-7 production-line emit (start/done)
}
```

Returns `SessionResult { steps: SpendStep[], stop: StopReason, stopDetail, remaining: Budget,
cleared: number }`. `StopReason = "board-cleared" | "wallet-exhausted" | "andon"`. The loop already
selects (`fitNext`), checks the three clean stops (`shouldContinue`), casts, debits ACTUALS, drops
the candidate, and emits `onStep`. **Nothing in the engine blocks T-024-03** (per T-024-02 review §
Downstream readiness). The composition layer supplies the four injected edges + renders the result.

`StepSignal = { phase: "start"|"done", candidate: string, remaining: Budget }` — what `onStep`
carries (the IA-7 signal). `SpendStep = { candidate, outcome, cost, overshoot, remainingAfter }`.

## The real cast — `src/play/chain-propose-decompose.ts` (T-011-02)

`castProposeDecomposeChain(opts: { signal, budget?, projectRoot?, model?, transcriptDir? }):
Promise<ChainResult>` — the capstone pull→clear: one demand SIGNAL → ProposeEpic → DecomposeEpic,
each gated, each logging one run-log record. This is `castOne`'s body — injected, so the engine
never imports `src/play/`. `ChainResult = { steps: RunSummary[], outcome: RunOutcome, halted,
produced? }` (chain-core.ts). With no `budget` override each step uses its play's warranted default
(`proposeEpicPlay.budget`, `decomposeEpicPlay.budget`); the wallet debits the cast's ACTUALS
regardless (`spend.ts:sumActuals` reads each `RunSummary.actuals`, ledger fallback by `runId`).

Play names for pricing: `proposeEpicPlay.name = "propose-epic"`, `decomposeEpicPlay.name =
"decompose-epic"` (both export `xxxPlay: Play<…>`).

## The board — the ranked candidates

The board `vend work` spends down is the **staged demand board** under
`docs/active/pm/staged/`, produced by `vend steer` (`steer.md`) and `vend survey`
(`survey-board.md`). Both are markdown with an identical contract (steer-effect.ts / survey-core):

- A ranked table `| Signal | Value | Budget (envelope) | Status |`, highest-leverage first (IA-1).
- A `## Pull these` fenced block listing the exact gesture per signal, **already ranked**:
  ```
  vend chain "<what> — <why>"   # recommended next pull (highest leverage)   ← row 1 only
  vend chain "<what> — <why>"
  ```
  The quoted string is the demand SIGNAL `castProposeDecomposeChain` consumes. Inner text uses
  backticks + single quotes — **never** a literal `"` — so the wrapping `"…"` is unambiguous.

Both staged files exist live today (`steer.md` 14.4kB, `survey-board.md` 10.7kB), each with a
populated `## Pull these` block of 8 ranked `vend chain "…"` lines — the AC#3 live target.

There is **no JSON board** for demand signals (`.vend/menu.json` is the *shelf* board of plays, not
demand). So the candidate source is a markdown parse of the staged board's `vend chain "…"` lines.

## The pricing seam — `src/ledger/recalibrate.ts` + `src/shelf/gather.ts`

`priceOf` predicts a pull's envelope from measured history (E-013), exactly as `cli.ts`'s `envelope`
arm does:

- `recalibrate(play, records, tier, prior, opts?): RecalibrateResult` — `{ envelope: Budget, … }`,
  cold-starts to `prior` below `minSuccesses`.
- `budgetForTier(tier: ValueTier): Budget` — the warranted hand prior (the `prior` arg).
- `loadRunLog(opts?): Promise<{ records, skipped }>` — the ledger read (ENOENT → empty, never an
  error). `cli.ts` uses `const { records } = await loadRunLog();`.

A chain casts TWO plays, so its predicted price is the per-denomination SUM of the two plays'
recalibrated envelopes. `ValueTier = "keystone"|"high"|"standard"|"leaf"`; `"standard"` is the
neutral middle the `envelope`/`audit` arms default to.

## The CLI surface — `src/cli.ts` (+ `cli.test.ts`)

The house pattern: arg parsing is PURE + unit-tested; the `import.meta.main` dispatch is the thin
untested impure shell that lazy-imports the runner.

- `parseArgs(argv)` routes the first token to a per-verb parser (`run`/`chain`/`expand`/`survey`/
  `steer`/`envelope`/`audit`), else `parseSelectOrBrowse`. Each returns a `ParsedCommand` union
  member or `{ cmd: "usage", error }`.
- `parseBudgetArg(s): Budget` — the shared `<ms>,<tokens>` parser (RangeError on malformed). Reused
  by every budget-taking verb; a malformed budget is caught and returned as a usage error.
- The flags-only verbs (`survey`/`steer`) are the closest shape: no positional subject, optional
  `--budget`, any positional token is an error. Their dispatch arm lazy-imports the play, defaults
  the budget to `play.budget`, casts, prints `run <id>: <outcome>`, exits 0/1.
- `cli.test.ts` imports ONLY the pure parsers (never the dispatch) — so a new parser is tested
  there with zero addon load.

## Constraints & assumptions surfaced

- **Purity split is mandatory.** `chain-propose-decompose.ts` value-imports the BAML addon, so any
  module that value-imports it CANNOT be `bun test`-imported (the one-call-per-process addon limit).
  New pure logic (board parse, receipt render) must live in an addon-free module to be unit-tested;
  the impure wiring (fs read, cast, ledger) lives in a separate shell — the `steer-core` /
  `steer-effect` / `steer` three-file discipline.
- **No shared ANSI/color helper exists** in `src/` (grep clean). IA-9 "andon amber, never red" must
  be implemented locally; gating it behind a `color` flag keeps the renderer's text unit-testable.
- **No reusable token/duration fmt helpers** outside wallet.ts's private `fmtTokens`/`fmtMs`
  (obs 21891). `formatWallet` is the one exported two-denomination readout — reuse it for the meter.
- **Engine ⊥ play holds** only because every play edge is INJECTED into `spendDown`. The composition
  layer is the one site allowed to import both the engine and the plays (the chain-propose-decompose
  precedent).
- **`--budget` default (AC: "defaults").** The vision frames this as "fund it, walk away for two
  hours" — a macro default exists when `--budget` is omitted; its value is a design decision.
- **Exit code for an andon stop** is a design decision: IA-9 frames an andon as a *successful
  refusal* (amber, not red), which tensions with the other arms' "non-success → exit 1".
