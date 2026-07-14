# T-024-03 Progress — `vend work` counter gesture

What got built, in order, against `plan.md`. Deviations noted.

## Status: implementation complete

All four plan steps landed, each committed atomically with the gate green. The full suite is at
**825 pass / 0 fail** (805 before T-024-03 + 14 `work-core` + 6 `work` CLI parser tests).

## Steps completed

### Step 1 — pure core + tests ✅ `feat(work): pure board-parse + receipt/stream renderers`
`src/play/work-core.ts` + `work-core.test.ts`. `parseBoardSignals`, `labelForSignal`,
`formatStepSignal`, `renderReceipt` (+ private `amber`, `fmtTok`, `fmtDur`, `fmtCost`). 14 tests:
board parse (real-shaped fixtures, edge cases, prose-ignored), label what/why split + truncation,
stream line (arrow + meter), and the receipt for every `StopReason` with/without color (amber on
andon, never red). Green; typecheck clean.

### Step 2 — impure shell ✅ `feat(work): castWork impure shell — board → spendDown → session`
`src/play/work.ts`. `DEFAULT_MACRO_BUDGET` (the "two-hour" default), `DEFAULT_BOARDS`
(steer→survey fallback), `WorkOptions`, `WorkResult` (tagged: no-board / empty-board / spent),
`castWork`, private `sumBudgets` + `readBoard`. Wires `allocate`, the `recalibrate`-summed
`priceOf`, the injected `castOne`/`labelOf`/`onStep`, and `spendDown<string>`. Typecheck clean
(confirms every injected edge matches `SpendLoopParams<string>`); suite still green.

### Step 3 + 4 — CLI parser + dispatch ✅ `feat(cli): wire vend work — fund→spend→settle`
`src/cli.ts`: USAGE line, the `work` `ParsedCommand` member, the `parseArgs` route, `parseWorkArgs`,
and the dispatch arm (lazy-imports `castWork` + the renderers, streams `onStep`, branches on
`WorkResult.kind`). `cli.test.ts`: 6 `work` parser tests (defaults / valid budget / `--board` /
malformed budget / dangling `--board` / unexpected positional). **Steps 3 and 4 were committed
together** (deviation, see below). Full `bun test` green; typecheck clean.

## Deviations from the plan

1. **Steps 3 and 4 committed as one.** The plan sequenced the parser (Step 3) and the dispatch arm
   (Step 4) as separate commits. Adding the `work` member to the `ParsedCommand` union makes the
   fall-through `run` dispatch path fail typecheck until a `work` arm handles-and-exits to narrow the
   union (TS2339 on `parsed.skipGates`). So the parser cannot land typecheck-green without the
   dispatch arm. Committed together rather than leaving an intermediate red commit. No scope change.

2. **`parseBoardSignals` returns 9 candidates from the live `steer.md`, not 8.** The board's table
   has a 9th row beyond what the truncated research read showed; the parse is correct (it reads the
   whole `## Pull these` block). Noted because the count appears in the live verification below.

## Live verification (through the real CLI, AC#2/#3 wiring)

Run against the live repo, NOT a fixture:

- **no-board:** `vend work --board /tmp/does-not-exist.md` → `no staged board found (tried …) — run
  \`vend steer\` or \`vend survey\` first`, **exit 1**. ✅
- **empty-board:** `vend work --board <file with no chain lines>` → `staged board … has no signals
  to spend on`, **exit 1**. ✅
- **real board parses to its ranked candidates:** `parseBoardSignals(steer.md)` → **9** signals, in
  board order (highest-leverage first): the E1 measurement sprint, the macro-wallet, the live steer,
  the recalibration pass, the consistency probe, the design-language session, the multi-node DAG, the
  graph-view projection, the second executor. ✅
- **usage banner** includes the `vend work [--budget <ms>,<tokens>] [--board <path>]` line. ✅

## Deferred: the full live LLM cast (the rest of AC#3)

AC#3's "clears at least one cast and Settles truthfully" requires a real `castProposeDecomposeChain`
— a live LLM cast that **materializes real epic/story/ticket artifacts** onto the board and burns
real API tokens. Per the established project pattern (T-017-02 Survey, T-018-02 Steer both deferred
their live-cast AC to a human sweep), this is left as the **human go-ahead step**, not run
autonomously: it is hard-to-reverse (mints board artifacts) and costs real money.

Everything up to the cast is proven live above; the loop itself is the tested `spendDown` + wallet,
and the cast is the tested chain. The recommended sweep — a small budget so P7 stops it after a cast
or two — is in `review.md`. No code blocks it; the seams are wired and green.

## Gate

`bun run check:typecheck` clean · `bun test` 825 pass / 0 fail. `bun run check` (baml:gen +
typecheck + suite) is the final pre-merge gate (AC#4).
