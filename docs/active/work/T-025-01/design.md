# T-025-01 — Design: per-step wallet-priced chain

*Phase: Design. Options weighed against the research, one chosen with rationale.*

## The decision in one line

Add **per-step** `proposeBudget?` / `decomposeBudget?` to `ChainProposeDecomposeOptions`, resolve each
step's budget via a **pure, addon-free helper** (`resolveStepBudgets`) with the rung order
`per-step → uniform budget → play default`, and have `castWork` pass the two recalibrated envelopes it
already computes (and currently discards). Authorization becomes execution. No new pricing, no bumped
defaults, no `spend.ts` change.

---

## D1 — Per-step vs. uniform budget threading

**Options**

- **(A) Uniform `budget` only** — `castWork` passes `sumBudgets(...)` (the 455k total) as the single
  `opts.budget`. Both steps run under 455k.
- **(B) Per-step `proposeBudget` / `decomposeBudget`** *(chosen)* — each step runs under its own
  recalibrated envelope (227k / 227k).

**Rationale.** The ticket and research are explicit: propose and decompose recalibrate *separately*
and can diverge. Option A over-authorizes every step to the *sum* — a decompose step that only needs
120k would be handed 455k, defeating the per-play metering E-013 exists to provide, and masking a
future regression where one step balloons. Option B threads exactly what the wallet authorized
*per play*, so "authorization == execution" holds at the granularity the price was measured at. The
two envelopes already exist in `work.ts` — B is not more work to *produce*, only to *not discard*.
The uniform `budget` field is **kept** as the middle fallback rung (back-compat + a legitimate
"one envelope for both" caller).

## D2 — The fallback rung order

Chosen precedence, per step:

```
proposeBudget   ?? budget ?? proposeEpicPlay.budget
decomposeBudget ?? budget ?? decomposeEpicPlay.budget
```

**Rationale.** This is purely additive over today's `opts.budget ?? play.budget` (research §1, lines
72–73): the existing two rungs are preserved verbatim as the lower two, and the per-step value slots
in as a new highest-priority rung. Therefore:

- **No per-step, no uniform** → play default → *bare `vend chain` is byte-for-byte unchanged* (AC#1).
- **Uniform only** → both steps take it → existing `--budget` behavior unchanged.
- **Per-step given** → it wins → `vend work` runs each step at its reservation (AC#2).

Rejected: making per-step *override* a sum, or splitting a uniform total in half — both re-derive
prices the ticket forbids and break the clean "additive rung" story.

## D3 — Where the selection logic lives (the testability decision)

**Options**

- **(A) Inline in `castProposeDecomposeChain`** — three `?? ??` expressions at the call site.
- **(B) Exported pure helper inside `chain-propose-decompose.ts`** — but the module value-imports the
  addon, so a test importing the helper loads the addon. AC#3 ("pure-testable") fails; only a *mirror*
  test (no real coverage) is possible, exactly the un-covered state the existing `derive` test shows.
- **(C) Pure core module `chain-propose-decompose-core.ts`** *(chosen)* — `resolveStepBudgets(opts,
  proposeDefault, decomposeDefault)` in a new module importing only `type Budget`. No addon.
  `chain-propose-decompose.ts` imports it; a new `chain-propose-decompose-core.test.ts` covers it for
  real.

**Rationale.** This is the **house pattern** the codebase already uses twice for exactly this reason:
`work.ts` → `work-core.ts` and `chain.ts` → `chain-core.ts` (pure core + impure shell, so the logic
is unit-tested addon-free while the shell stays untested). AC#3 explicitly wants the per-step selection
*pure-testable*; only C delivers genuine coverage of the **shipped** function rather than a hand-copied
mirror. The helper is small, but the project's discipline (every module header documents its purity
stance) makes a 3-line pure module the idiomatic, not over-engineered, choice — it is the same call
T-024-03 made with `work-core.ts`.

**Scope guard.** Only the new `resolveStepBudgets` moves into the core. `epicSubjectFromPath` stays in
`chain-propose-decompose.ts` (it is out of this ticket's scope; moving it churns the existing test for
no AC). The core module imports **nothing** addon-bearing.

## D4 — Should `spend.ts` / `priceOf` change?

**No.** The loop already prices for fitting (`priceOf`) and debits actuals; the mismatch is entirely
in what `castOne` forwards. Threading the budget through `castOne` → `castProposeDecomposeChain` is the
**minimal** correct seam. Changing `spend.ts` would widen blast radius with zero benefit. Rejected.

## D5 — Should `work.ts` keep predicting price once, or per-signal?

**Keep once.** The chain casts the same two plays for *every* signal, so the recalibrated envelopes
are signal-independent (research §2; `work.ts:114` comment). The fix retains the existing
predict-once structure and simply *names and keeps* the two envelopes (`proposeEnvelope`,
`decomposeEnvelope`) instead of inlining them into `sumBudgets`. `price = sumBudgets(proposeEnvelope,
decomposeEnvelope)` is unchanged for `canAfford`; the two envelopes additionally flow into `castOne`.
This is the smallest edit that stops the discard.

## D6 — Do the timeMs dimensions matter?

The andon that fired was **token** exhaustion (`EBUDGET_EXHAUSTED`). But `Budget` carries both
denominations and `recalibrate` produces both, so threading the *whole* envelope (not just tokens)
keeps time and tokens consistent with what was authorized — no reason to split a denomination out.
Pass the full `Budget` per step.

---

## What this design explicitly does NOT do

- Does **not** bump `proposeEpicPlay.budget` (150k) — it stays the cold-start fallback (third rung).
- Does **not** re-derive or change `recalibrate` / per-play envelopes (E-013 owns them).
- Does **not** touch `spend.ts`, `budget.ts`, or the live-cast purity stance.
- Does **not** move `epicSubjectFromPath` or alter the offline thread test's structure.

## Acceptance-criteria trace

- **AC#1** (per-step w/ fallbacks; bare chain unchanged) → D1 + D2 + D3.
- **AC#2** (`castWork` passes the two envelopes; fitted pull casts at 227k) → D1 + D5.
- **AC#3** (pure-testable selection; `check:*` green) → D3 (core module + test).
- **AC#4** (live re-sweep clears ≥1) → human step; this design makes the cast run at the reservation
  so the 175k propose fits under 227k.
