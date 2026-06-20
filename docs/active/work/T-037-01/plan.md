# T-037-01 — Plan

## Strategy

An analysis ticket: no source change, no atomic-commit sequence of code. The "steps" are
verification actions, each independently checkable, that produce the numbers and confirmations
`preflight.md` records. The testing strategy is **reuse the existing pure-unit coverage** (the four
seams are already unit-tested) plus **execute the live pure path once** to get authorization-grade
numbers. Verification criterion for the whole ticket: a defensible GO/NO-GO with every number
reproducible, and `bun run check:*` green.

## Steps

### Step 1 — Price the chain from the live ledger (Claim 1)
- Invoke (throwaway harness, pure modules only): `loadRunLog()` →
  `recalibrate("propose-epic", records, "standard", budgetForTier("standard"))` and the same for
  `decompose-epic` → `sumBudgets`.
- **Verify:** both `source === "measured"` (≥3 successes), record each envelope + confidence
  (successes/censored/percentile) and the summed price.
- **Done when:** the price is captured with its provenance. ✅ (executed:
  `{233530 ms, 454854 tok}` = 454.9k/233.5s; propose 5 succ, decompose 6 succ, both p90.)

### Step 2 — Confirm the bounded budget affords ≥1 (~2) chains (Claim 2)
- Simulate `canAfford(allocate({3600000,1000000}), price)` iteratively until it fails.
- **Verify:** ≥1 chain (price ≤ funded), count chains afforded, identify the binding denomination.
- **Done when:** chains-afforded recorded. ✅ (executed: 2 chains; token-bound 2, time-bound 15;
  tokens binding.)

### Step 3 — Confirm the forward-E1 thread (Claim 3)
- Trace `--no-intervened` cli→work→chain→record→`reviveRecord`→`auditWalkAway` against source.
- Run `auditWalkAway(records)` over the live ledger to confirm the forward sub-stat reads 1/2.
- Cross-check the unit tests that lock the split (`walk-away.test.ts:162-168`) and the per-step
  budget rung (`chain-propose-decompose-core.test.ts`).
- **Verify:** every edge present; `false` survives read-back; no attestation marker ⇒ forward.
- **Done when:** the thread is asserted end-to-end + the live forward reading captured. ✅
  (executed: forward 2 reported / 1 intervened / 50%; attested 13/0.)

### Step 4 — Confirm the freshness gate passes for a run-time board (Claim 4)
- Confirm `isBoardStale(boardMtime, liveMtime) = boardMtime < liveMtime` (fresh-on-tie) and that a
  board staged AFTER all `docs/active/**` edits has `boardMtime ≥ liveMtime`.
- Cross-check `work-core.test.ts:134-145` (older⇒stale, newer⇒fresh, tie⇒fresh, zero⇒fresh).
- **Verify:** a run-time board is fresh; `--stale-ok` is the documented override.
- **Done when:** the freshness math is recorded with the run-time ordering argument. ✅

### Step 5 — Settle auth==exec (E-025) and write the go/no-go
- Confirm `castWork` threads the SAME priced envelopes into the cast per step (work.ts:183-185 vs
  195-196 → `resolveStepBudgets`), so the E-024 no-op cannot recur.
- Compose the GO with its precondition (board ≥2 signals) and honest caveats (per-cast andon is a
  clean P7 stop; actuals-vs-predicted; two records per chain).
- **Done when:** `preflight.md` is complete.

### Step 6 — Run the deterministic gate
- `bun run check:typecheck` (tsc --noEmit) and `bun test`.
- **Verify:** green (no regression from reading the ledger; no source touched).
- **Done when:** results pasted into the verification log.

### Step 7 — Clean up
- Remove the transient harness file; confirm `git status` shows only `docs/active/work/T-037-01/**`
  (+ the pre-existing untracked E-037/story/ticket files).
- **Done when:** tree carries no stray runtime file.

## Testing strategy

- **Unit (existing, relied upon):** `spend-core.test.ts`, `wallet.test.ts`, `work-core.test.ts`,
  `walk-away.test.ts`, `chain-propose-decompose-core.test.ts`, `chain-propose-decompose.test.ts`.
  These ARE the proof that the four seams behave as asserted; the preflight cites them rather than
  duplicating them.
- **Live-pure execution (this ticket):** the one-shot harness over `.vend/runs.jsonl` — the
  authorization-grade numbers. Not a committed test (it reads mutable runtime state); its output is
  frozen into `preflight.md`.
- **No new automated test.** Justified: an analysis ticket with no production code change. Adding a
  test that pins today's ledger numbers would be brittle (the ledger grows). Flagged in Review.
- **Gate:** `bun run check:typecheck` + `bun test` must be green (the ticket's AC).

## Risks & mitigations

- **R1 — the ledger changed since authoring** (price drift). Mitigated: we compute from the *current*
  ledger, not authoring notes; the number is whatever `castWork` would authorize today.
- **R2 — board has <2 signals at run time** ⇒ only 1 chain (or 0). Mitigated: recorded as the
  GO precondition for T-037-02 (stage a board with ≥2 ranked pulls).
- **R3 — a real cast andons at its envelope** (budget-exhausted at p90). Mitigated: that is an
  honest P7 stop distinct from the E-024 price-mismatch no-op; called out, not hidden.
- **R4 — transient harness left in tree** trips `check:committed`. Mitigated: Step 7 removes it.

## Verification criteria (ticket-level)

All four AC checkboxes satisfied: price recorded with provenance; ≥1 (ideally 2) chains afforded at
the bounded budget; forward-E1 thread confirmed via the pure path (no live cast); freshness gate
passes for a run-time board; a go/no-go that auth==exec holds; `check:*` green.
