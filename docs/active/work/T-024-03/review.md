# T-024-03 Review — `vend work` counter gesture

Handoff. What changed, test coverage, open concerns. Read this instead of the diff.

## Summary

Wired the macro-wallet (T-024-01) + the autonomous spend loop (T-024-02) behind the `vend work`
CLI verb — the founding gesture made a real command (E-024, charter P2/P4/P7): fund a macro-wallet
once, walk away, and let Vend spend it down across casts on the staged ranked board until a clean
stop. The Confirm→Run→Settle spine (IA-6) at macro scale. This is the **composition layer** — it
writes no engine logic; it injects the four play-specific edges `spendDown` needs, drives the loop,
and renders the production line (IA-7) and the receipt (IA-6). On the house pure-core / impure-shell
split:

1. **`work-core.ts`** (PURE) — the board parse (`parseBoardSignals`) + the renderers
   (`labelForSignal`, `formatStepSignal`, `renderReceipt`). Unit-tested; the meter reuses
   `formatWallet` (one source of two-denomination truth, IA-8).
2. **`work.ts`** (IMPURE shell) — `castWork`: read the board → fund → price (recalibrate) → drive
   `spendDown` → return a tagged `WorkResult`. The one site that imports both the engine and the
   plays (E-007 composition layer); value-imports the chain (addon), so not `bun test`-imported.
3. **`cli.ts`** — `parseWorkArgs` (PURE, tested) + the dispatch arm (lazy-imported impure shell).

## Files changed

| File | Action | Notes |
|------|--------|-------|
| `src/play/work-core.ts` | **created** (~135 lines) | Pure parse + render; type-only engine/wallet imports + the pure `formatWallet`. |
| `src/play/work-core.test.ts` | **created** (~120 lines) | 14 unit tests; parse edge cases + every receipt stop reason / color. |
| `src/play/work.ts` | **created** (~120 lines) | Impure `castWork`; `DEFAULT_MACRO_BUDGET`, board fallback, recalibrate-priced loop. |
| `src/cli.ts` | **modified** | USAGE line, `work` `ParsedCommand`, `parseArgs` route, `parseWorkArgs`, dispatch arm. |
| `src/cli.test.ts` | **modified** (+~35 lines) | 6 `work` parser tests. |
| `docs/active/work/T-024-03/*.md` | created | RDSPI artifacts. |

Commits: `feat(work): pure board-parse + receipt/stream renderers` → `feat(work): castWork impure
shell` → `feat(cli): wire vend work — fund→spend→settle counter gesture`.

## Public surface

- `parseBoardSignals(md): string[]` — staged board → ranked signal strings (IA-1 order preserved).
- `labelForSignal(signal, max?): string` — the IA-7 "what" label.
- `formatStepSignal(s, funded): string` — one production-line line + the two-denomination meter.
- `renderReceipt(result, wallet, opts?): string` — the Settle receipt; andon amber (IA-9) gated by
  `opts.color`.
- `castWork(opts?): Promise<WorkResult>` — the gesture; `WorkResult = no-board | empty-board | spent`.
- `DEFAULT_MACRO_BUDGET = { timeMs: 7_200_000, tokens: 2_000_000 }` — the "two-hour" default.
- `ParsedCommand` gains `{ cmd: "work"; budget?; board? }`.

## How the acceptance criteria are met

1. **`vend work --budget` parses + allocates, unit-tested (valid/invalid/defaults); malformed
   budget is a clean usage error.** ✅ `parseWorkArgs` (PURE) + 6 `cli.test.ts` cases: no budget →
   `{ cmd: "work" }` (dispatch defaults the macro budget), valid budget, `--board`, malformed/dangling
   `--budget` → usage, dangling `--board` → usage, unexpected positional → usage. Allocation is
   `allocate(funded)` in `castWork` (the tested wallet). A malformed budget reuses `parseBudgetArg`'s
   RangeError → caught → usage; no crash.
2. **Run streams the node-level production line (IA-7/8); Settle prints the receipt (cleared /
   per-cast cost / remaining / stop reason, andon amber IA-9).** ✅ `onStep` → `formatStepSignal`
   streams which pull runs against the two-denomination burn (via `formatWallet`), NOT the raw
   executor stream. `renderReceipt` prints the cast/cleared count, per-cast cost (both denominations),
   final wallet, and the stop reason — amber on andon, never red. Covered by `work-core.test.ts`.
3. **End-to-end honest: funds once, spends down, hard-stops hold (P7); live cast clears ≥1 and
   Settles truthfully.** ◐ **Partially live, partially deferred.** The wiring is proven through the
   real CLI: no-board → exit 1, empty-board → exit 1, the live `steer.md` parses to its 9 ranked
   candidates, usage banner updated (see `progress.md`). P7 holds by construction — `spendDown` only
   casts a `fitNext` result (affordable on its predicted price). The **full live LLM cast** (an
   actual cleared pull) is **deferred to a human sweep** — see Open concern #1.
4. **`bun run check:*` green.** ✅ `bun run check` = baml:gen + typecheck + 825 tests, all green.

## Test coverage

- **Unit (the gate):** `work-core.test.ts` (14) — the load-bearing pure logic: board parse (ranked
  order, comment-drop, inner backticks/quotes, honest-empty → `[]`, prose ignored), label what/why
  split + truncation, the stream line, and `renderReceipt` for all three stop reasons with color
  on/off (amber on andon, never red, plain on clean stops). `cli.test.ts` (+6) — `parseWorkArgs`.
  This is where a reviewer's time pays off.
- **Not unit-tested — `work.ts` (by design, the `castChain`/`spendDown` stance).** Its parse/render
  is the tested core, its loop is the tested `spendDown` + `wallet` (`spend-core.test.ts` /
  `wallet.test.ts`), its cast is the tested chain. The shell is mechanical wiring (read → fund →
  price → drive → return), proven live except the LLM cast itself.

## Open concerns / notes for the reviewer

1. **The full live cast (AC#3 "clears at least one cast") is deferred to a human sweep.** A real
   `castProposeDecomposeChain` materializes real epic/story/ticket artifacts onto the board and burns
   real API tokens — hard-to-reverse and costly, so it was NOT run autonomously. This matches the
   established project pattern (T-017-02 Survey, T-018-02 Steer both deferred their live-cast AC).
   **Recommended sweep:** `bun run src/cli.ts work --budget 600000,120000` (a SMALL wallet — a block
   or two, so P7 exhausts it after a cast or two, never the 2h default) against the live `steer.md`.
   Expect: the production line streams per cast, ≥1 cast clears (materializing an epic + its
   stories/tickets), and the receipt prints both denominations + a truthful stop reason. Everything
   up to the cast is verified; no code blocks it.
2. **`priceOf` is constant across candidates (the chain casts the same two plays).** So `fitNext` is
   effectively head-of-line: cast top-down until the wallet can't afford one more chain, then stop
   `wallet-exhausted`. This is the "spend it down" behavior the ticket describes; `fitNext`'s
   skip-an-unaffordable-head generality is simply unexercised when every price is equal. If a future
   board prices pulls per-row (per-tier), `priceOf` would need the candidate's tier — noted in
   `design.md` D2/D3 as a future refinement (the candidate is a flat `string` today).
3. **Andon exits 0 (deliberate, the one divergence from `chain`/`run`).** IA-9 frames an andon as a
   *successful refusal* (amber, not red) — the wallet honored its hard contract (P7), which is the
   gesture working. So a settled session (any stop reason) exits 0; only a broken precondition (no
   board / empty board) exits 1. A CI reader expecting non-zero on a failed cast should know the
   receipt names the stop loudly and the per-step outcome is in the `SessionResult`. Documented in
   `design.md` D7.
4. **Board parse precondition: the greedy `"(.*)"` regex.** Robust today because staged boards never
   put a literal `"` inside a signal (backticks + single quotes only — verified live). If that
   contract ever changes, the regex over-captures; a non-greedy variant is the fix. Stated as a parse
   precondition, not a latent bug.
5. **`DEFAULT_MACRO_BUDGET` is a flat constant, not board-derived.** The ticket suggests pre-filling
   from the board's tier (IA-6); the "two-hour" framing (7.2M ms / 2M tokens) is the honest literal
   default. Summing the board's per-row tier envelopes for a smarter default is a future refinement
   (would require parsing the table tiers, which D2 deferred). `--budget` covers the adjust case.

## Downstream readiness

E-024's three pieces are now composed into one command. The macro-wallet feature itself remains
**gated by E-014** (the walk-away evidence gate, HOLD pending forward E1 data — the top board
signal). `vend work` is built and green; whether it ships un-parked is the E-014 verdict's call, not
this ticket's. No blocking issues; the gate is green and ready for human review + the live sweep.
