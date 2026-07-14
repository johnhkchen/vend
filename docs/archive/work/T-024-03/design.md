# T-024-03 Design — `vend work` counter gesture

One decision per section: the option chosen, the alternatives, why. Grounded in `research.md`.

## D1 — Module layout: a pure core + an impure shell (the three-file discipline)

**Decision.** Two new modules + a CLI edit, mirroring `steer-core` / `steer` / `cli.ts`:

- `src/play/work-core.ts` — **PURE, addon-free, unit-tested.** The board parse and the rendering:
  `parseBoardSignals`, `labelForSignal`, `formatStepSignal`, `renderReceipt`. Type-only imports of
  the engine/wallet types + a value import of `formatWallet` (pure).
- `src/play/work.ts` — **IMPURE shell, not unit-tested.** `castWork` — reads the board file, builds
  the four injected edges (`priceOf` via recalibrate, `castOne` via the chain, `labelOf`, `onStep`),
  drives `spendDown`, returns a tagged result. Value-imports the chain (BAML addon) + the plays.
- `src/cli.ts` — add `parseWorkArgs` (PURE, tested in `cli.test.ts`) + the `work` dispatch arm.

**Rejected — one file.** A single `work.ts` holding parse + render + cast cannot be `bun test`-ed
(it value-imports the addon via the chain). The pure logic — board parsing, receipt rendering — is
exactly the load-bearing branching a reviewer's time should land on; it must be testable. This is
the house rule that produced `steer-core`/`steer-effect`/`steer`, not a new invention.

**Rejected — put the render in `cli.ts`.** The other arms render inline (a `process.stdout.write`
template). But the receipt (IA-6) and the production-line line (IA-7) are richer than a one-liner and
are the AC's headline deliverable — they deserve a tested pure function, not an untested template.

## D2 — Candidate source: parse the staged board's `vend chain "…"` lines

**Decision.** `candidates: string[]` = the quoted signal strings parsed from the staged board's
`vend chain "<what> — <why>"` lines, in file order (already ranked highest-leverage-first, IA-1).
Default board path resolves `docs/active/pm/staged/steer.md`, falling back to `survey-board.md`;
`--board <path>` overrides. `castOne(signal) = castProposeDecomposeChain({ signal })`.

**Why.** The staged board IS "the ranked board" the ticket names, and its `## Pull these` block is
literally the per-signal `vend chain` gesture — the canonical, ranked, machine-emitted list. The
signal string is exactly `castProposeDecomposeChain`'s input. No new data format, no re-ranking
(the loop honors IA-1 rank as policy). Parsing `vend chain "…"` lines is robust: the inner text
never contains a literal `"`, so the wrapper is unambiguous, and the lines are emitted by both
steer-effect and survey-effect identically.

**Rejected — parse the markdown table rows.** The `| Signal | … |` table carries the same signals
but bolded, with appended `— why` prose and pipe-delimited cells to disentangle. The `## Pull these`
block already gives the clean, quoted, ready-to-cast form — parse the easy artifact, not the table.

**Rejected — re-run `vend steer`/`survey` inside `work`.** That would re-pay a costly board read
every `work` (against "author once / the board is already staged") and couple `work` to two plays'
casts. `work` spends down a board that already exists; staging it is the separate upstream gesture.

**Rejected — a candidate object `{ signal, tier }`.** Per-row tier would let `priceOf` price each
pull at its own tier. But the table tier is prose (`**Keystone**`) and the chain's price doesn't
actually vary by the signal today (same two plays). A flat `string` candidate is honest and simplest;
per-tier pricing is a future refinement noted in §D4.

## D3 — `priceOf`: the chain's predicted envelope = sum of its two plays, at `standard`

**Decision.** Compute ONE price (the chain casts the same two plays for every signal):

```ts
price = sum(recalibrate("propose-epic", records, "standard", budgetForTier("standard")).envelope,
            recalibrate("decompose-epic", records, "standard", budgetForTier("standard")).envelope)
priceOf = () => price
```

`records` from one `loadRunLog()` at the top of `castWork`. `priceOf` is constant across candidates.

**Why.** A `castProposeDecomposeChain` runs BOTH plays, so its predicted cost is the per-denomination
sum of the two recalibrated envelopes — the exact seam `cli.ts`'s `envelope` arm uses (E-013),
reused not reinvented. `standard` is the neutral-middle tier the `envelope`/`audit` arms already
default to. Computing once is correct (the price is signal-independent today) and keeps the ledger
read off the per-candidate path.

**Consequence (intended).** With a constant price, `fitNext` is effectively head-of-line: it casts
signals top-down until the wallet can't afford one more chain, then stops `wallet-exhausted` — the
"spend it down" behavior the ticket describes. `fitNext`'s skip-an-unaffordable-head generality (T-
024-02 §2) is simply unexercised when every price is equal; correct, not wasted.

**Rejected — pass the predicted budget into `castOne`.** The chain's `budget` override applies ONE
budget to BOTH steps; passing the summed price would over-allocate each step. Per T-024-02's design,
`priceOf` *predicts* (gates P7 authorization) and `debit` *measures* (actuals). Let each step use its
warranted default; the wallet debits the real burn. Keeps prediction and payment correctly separate.

## D4 — `labelOf`: the signal's "what", truncated

**Decision.** `labelForSignal(signal, max=80)` = the text before the first ` — ` (the "what" half),
trimmed, truncated with `…` past `max`. The signal format is `"<what> — <why>"`; the "what" is the
legible production-line label (IA-7). If there is no ` — `, label the whole signal (truncated).

**Why.** The full signal is a paragraph; the production line and the receipt need a glanceable name
of "which pull is running" (IA-7), not the rationale. The `—` split is the staged board's own
what/why contract. Truncation keeps the stream and receipt to one line per cast.

## D5 — Render: `formatStepSignal` (IA-7) reuses `formatWallet`; `renderReceipt` (IA-6) is the Settle

**Decision (production line, IA-7/8).** `formatStepSignal(s: StepSignal, funded: Budget): string`
renders one stream line: an arrow (`▶` start / `✓` done), the label, and the two-denomination meter
via `formatWallet({ funded, remaining: s.remaining })` — reusing the tested wallet readout so the
meter cannot lie (IA-8). `funded` is threaded from the caller (it's not on `StepSignal`).

**Decision (receipt, IA-6/9).** `renderReceipt(result: SessionResult, wallet: Wallet, opts?: {
color?: boolean }): string` — the Settle: a header, one line per `SpendStep` (✓ cleared with its
per-cast cost, or an amber `⚠` andon line with the outcome), the final wallet via `formatWallet`,
and the **stop reason** rendered amber when `stop === "andon"` (IA-9 — a successful refusal, amber,
never red). `color` defaults FALSE so the renderer's text is asserted plainly in tests; the CLI
passes `color: true` for ANSI (a local `amber()` = `\x1b[33m…\x1b[0m`, since no shared helper
exists). Clean stops (`board-cleared`, `wallet-exhausted`) render plain — they are not refusals.

**Why.** Reusing `formatWallet` for both the stream meter and the receipt balance is the single
source of two-denomination truth (IA-8). Gating color keeps the pure renderer deterministic and
testable while still honoring IA-9 at the surface. The receipt answers exactly the AC's four
questions: what cleared, what each cost, what's left, why it stopped.

## D6 — `--budget` is optional; defaults to the "two-hour" macro budget

**Decision.** `vend work [--budget <ms>,<tokens>] [--board <path>]`. `--budget` is OPTIONAL; omitted
⇒ `DEFAULT_MACRO_BUDGET = { timeMs: 7_200_000 /* 2h */, tokens: 2_000_000 }` (exported from
`work.ts`). A malformed `--budget` is a clean usage error (reuse `parseBudgetArg`). `--board` points
at a specific staged board; omitted ⇒ the steer→survey fallback.

**Why.** The vision's literal framing is "fund it, walk away for **two hours**" — 7.2M ms IS the
default, the pre-filled tier the ticket asks for (IA-6: "default the budget … adjust is the
exception"). The AC explicitly tests "defaults", so a default must exist. A flat macro constant is
honest and simple; deriving a default from summing the board's per-row tiers is more machinery than
the gesture warrants and is noted as a future refinement. `--budget` stays available for the adjust
case. Making it optional matches `survey`/`steer` (which default to the play budget); `run` requires
`--budget` because it has no sensible default — `work` does.

## D7 — Exit code: a settled session exits 0 (an andon is a successful refusal)

**Decision.** Any session that SETTLES (`spendDown` returned, any `StopReason`) exits **0**. Only a
setup failure exits non-zero: no board found / board has no signals → stderr + exit 1.

**Why.** IA-9 is explicit: an andon is amber, a *successful* refusal, not red — the wallet honored
its hard contract (P7), which is the gesture working as designed, not failing. Exiting 1 on andon
would paint the macro-wallet's core safety behavior as an error. This diverges from `chain`/`run`
(non-success → exit 1) deliberately, because at macro scale stopping IS success; documented in
`review.md` as the one intentional contract divergence. A genuinely broken precondition (no board)
is the real error and exits 1.
