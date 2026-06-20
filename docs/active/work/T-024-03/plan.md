# T-024-03 Plan — `vend work` counter gesture

Ordered, independently-verifiable steps. Each commit is atomic and leaves the gate green.

## Testing strategy

- **Unit (the gate):** `work-core.test.ts` covers the pure load-bearing logic — `parseBoardSignals`
  (real board fixtures + edge cases), `labelForSignal`, `formatStepSignal`, `renderReceipt` (each
  stop reason, with/without color). `cli.test.ts` covers `parseWorkArgs` (defaults / valid /
  malformed / `--board` / errors). This is where review time pays off.
- **Not unit-tested (by design, the `castChain`/`spendDown` stance):** `work.ts:castWork` is impure
  wiring — its parse/render is the tested core, its loop is the tested `spendDown` + wallet, its cast
  is the tested chain. Proven LIVE (AC#3).
- **Verification per step:** `bun run check:typecheck && bun test` green after each code step.
- **AC#4 gate:** `bun run check` (baml:gen + typecheck + full suite) green before the final commit.
- **AC#3 live:** one real `vend work --budget <small>` against the staged board — clears ≥1 cast,
  Settles truthfully — captured in `progress.md`.

## Step 1 — pure core + tests (`work-core.ts`, `work-core.test.ts`)

Write `parseBoardSignals`, `labelForSignal`, `formatStepSignal`, `renderReceipt` (+ private `amber`,
`fmtCost`). Then the test:

- `parseBoardSignals`: a fixture of a few `vend chain "…"` lines (incl. the recommended-comment
  trailing `# …` on line 1) → the ordered signal strings; a board with no such lines → `[]`; lines
  with inner backticks/single-quotes round-trip intact; surrounding table/prose lines are ignored.
- `labelForSignal`: `"<what> — <why>"` → `"<what>"`; over-long → truncated with `…`; no ` — ` → the
  whole signal (truncated).
- `formatStepSignal`: a `start` and a `done` signal → arrow + label + a `formatWallet` meter
  substring (`◇` and `⏱` present); assert the funded/remaining math shows through the meter.
- `renderReceipt`: a fabricated `SessionResult` (no engine spawn) for each `StopReason` — assert the
  cleared count, a per-cast cost line, the final-wallet meter, and the stop line; `andon` with
  `color:false` shows a plain `⚠`/andon marker, with `color:true` wraps it in the ANSI amber code
  (`\x1b[33m`) and NEVER a red code (`\x1b[31m`).

**Verify:** `bun test src/play/work-core.test.ts` green; `bun run check:typecheck` green.
**Commit:** `feat(work): pure board-parse + receipt/stream renderers (T-024-03)`.

## Step 2 — impure shell (`work.ts`)

Write `DEFAULT_MACRO_BUDGET`, `DEFAULT_BOARDS`, `WorkOptions`, `WorkResult`, `castWork`, private
`sumBudgets`. Wire the board resolution (explicit `--board` → single try; else `DEFAULT_BOARDS`
fallback, ENOENT-tolerant), `allocate`, the `recalibrate`-summed `priceOf`, the injected `castOne` /
`labelOf` / `onStep`, and `spendDown`. Return the tagged `WorkResult`.

No new test file (impure shell). Type-check is the gate here.

**Verify:** `bun run check:typecheck` green (confirms every injected edge's type lines up with
`SpendLoopParams<string>`); `bun test` still green (nothing else touched).
**Commit:** `feat(work): castWork impure shell — board → spendDown → session (T-024-03)`.

## Step 3 — CLI parser + tests (`cli.ts` parser, `cli.test.ts`)

Add the USAGE line, the `work` `ParsedCommand` member, the `parseArgs` route, and `parseWorkArgs`.
Add the `cli.test.ts` `work` block (per structure.md). This step touches ONLY pure parsing — no
dispatch, no addon.

**Verify:** `bun test src/cli.test.ts` green; `bun run check:typecheck` green.
**Commit:** `feat(cli): vend work arg parsing (T-024-03)`.

## Step 4 — CLI dispatch arm (`cli.ts`)

Add the `if (parsed.cmd === "work")` arm: lazy-import `castWork` + `DEFAULT_MACRO_BUDGET` +
`renderReceipt`/`formatStepSignal`, resolve `funded`, stream `onStep`, branch on `WorkResult.kind`
(no-board / empty-board → stderr + exit 1; spent → receipt + exit 0). This is the untested impure
shell (the `import.meta.main` block, like every other arm).

**Verify:** `bun run check` (full suite) green. Then the AC#3 live cast:
`bun run src/cli.ts work --budget 600000,120000` (a small wallet — a block or two, not the 2h
default) against the live `docs/active/pm/staged/steer.md`. Confirm: the production-line streams per
cast, ≥1 cast clears, the receipt prints with both denominations + a truthful stop reason. Capture
the transcript in `progress.md`.
**Commit:** `feat(cli): wire vend work dispatch — fund→spend→settle (T-024-03)`.

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| The greedy `"(.*)"` regex over-captures if a board ever puts a `"` inside a signal. | Today's boards never do (backticks + single quotes only — confirmed in research). Documented as a parse precondition; a future fix is a non-greedy variant if the contract changes. |
| A live cast burns real tokens / wall-clock for AC#3. | Use a SMALL `--budget` so the wallet exhausts after a cast or two (P7 stops it); never the 2h default for the verification run. |
| `recalibrate` cold-starts (few successes for propose/decompose) → the price is the hand prior. | Honest by design (E-013): the prior IS the price until the log has tails. The wallet still gates on it (P7) and debits actuals. No special-casing. |
| Andon exit-0 (D7) surprises a CI reader expecting non-zero. | Deliberate (IA-9 — amber, not red); the receipt names the stop loudly. Documented in `review.md` as the one intentional divergence from `chain`/`run`. |
| The default board is `steer.md` but a user staged only `survey-board.md`. | `DEFAULT_BOARDS` falls back steer→survey; `--board` overrides explicitly. |

## Definition of done (maps to AC)

- **AC#1** `vend work --budget` parses + allocates, unit-tested (valid/invalid/defaults), malformed
  budget → clean usage error → Steps 3 + 2 (`allocate`).
- **AC#2** Run streams the node-level production line (IA-7/8), Settle prints the receipt
  (cleared / per-cast cost / remaining / stop reason, andon amber IA-9) → Steps 1 + 4.
- **AC#3** End-to-end honest: funds once, spends down, hard-stops hold (P7), live cast clears ≥1 and
  Settles truthfully → Step 4 live cast.
- **AC#4** `bun run check:*` green → verified each step; full `check` at Step 4.
