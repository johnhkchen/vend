# T-037-01 — Design

## The decision

T-037-01 is a **pre-flight**, not a code change. Its deliverable is `preflight.md`: a deterministic
go/no-go that the bounded live sweep (T-037-02) **will clear**, so no live spend is burned for a
price-mismatch no-op (the E-024 lesson). The design question is therefore: **how do we prove the
four claims rigorously without a live model?** Each claim has a pure, already-tested seam; the design
is the method for exercising each and recording the numbers.

## Options considered for the method

### Option A — Read the code, assert the wiring by inspection only
Trace the four seams in source and assert the go from the structure alone.
- **Pro:** zero execution; pure reading.
- **Con:** the headline numbers (the predicted price, chains-afforded) are *computed*, not
  structural. Asserting "≈227k each" from authoring notes repeats the exact failure mode E-024 fell
  into (authorized number ≠ realized number). A preflight that quotes a stale memory of the price is
  no preflight.
- **Rejected** as the sole method — necessary (the thread/gate are structural) but not sufficient
  (the price/affordability are quantitative).

### Option B — Run the live executor once to observe a real cast
Cast one chain to see real numbers.
- **Pro:** real actuals.
- **Con:** that IS T-037-02. It burns live spend — exactly what the preflight exists to de-risk
  first. Violates the ticket's "no live model" and the epic's honest boundary.
- **Rejected.** Out of scope by construction.

### Option C — Execute the pure price/affordability/audit functions over the live ledger (CHOSEN)
Call the real `loadRunLog` → `recalibrate` → `sumBudgets` → `canAfford` / `auditWalkAway` (all
pure, addon-free) against the live `.vend/runs.jsonl`, and confirm the structural seams (the
`intervened` thread, `isBoardStale`) by inspection + the existing unit tests.
- **Pro:** the price and chains-afforded are the **same functions `castWork` runs**, over the
  **same ledger** — so the preflight number IS the authorization number, by construction. No live
  model (the executor seam is never touched; only the pure price/audit core). Deterministic and
  re-runnable.
- **Con:** requires a tiny throwaway harness to invoke the pure functions (the production caller is
  the impure `castWork`, which we must not run). Acceptable: the harness imports only pure modules.
- **Chosen.** It is the only method that produces the authorization-grade numbers the go/no-go needs
  while honoring "free + deterministic."

## Why C is sound (grounded in Research)

The price `castWork` authorizes on is `sumBudgets(recalibrate(propose…).envelope,
recalibrate(decompose…).envelope)` (work.ts:183-185). Those functions are PURE and take the ledger
records as input. Running them directly over `loadRunLog()` reproduces the authorization value
**exactly** — there is no hidden state in `castWork` between `loadRunLog` and `sumBudgets`. The
affordability gate `fitNext` calls `canAfford(wallet, price)`; simulating `canAfford` against the
recommended bounded wallet at that price reproduces the P7 authorization decision exactly. This was
executed during research and is the basis for the numbers below.

## The four claims and how each is settled

| # | Claim | Method | Verdict source |
|---|-------|--------|----------------|
| 1 | Wallet prices the chain from the LIVE ledger | Run `recalibrate` × 2 + `sumBudgets` over `loadRunLog()` | computed |
| 2 | Bounded budget affords ≥1 chain (~2) | Simulate `canAfford` over the 1h/1M wallet at the price | computed |
| 3 | `--no-intervened` threads forward-E1 | Inspect cli→work→chain→record→`reviveRecord`→`auditWalkAway` + unit tests; confirm forward 1/2 over live ledger | structural + audit |
| 4 | Freshness gate passes for a run-time board | `isBoardStale` semantics (`<`, fresh-on-tie) + unit tests; reason about run-time mtime ordering | structural |

## The numbers (from executing Option C over the live ledger)

- **propose-epic** envelope `{ timeMs: 72785, tokens: 227390 }` — `measured`, 5 successes (p90,
  2 censored).
- **decompose-epic** envelope `{ timeMs: 160745, tokens: 227464 }` — `measured`, 6 successes (p90,
  4 censored).
- **Chain price** `{ timeMs: 233530, tokens: 454854 }` = **454.9k tokens / 233.5s (~3.9 min)**.
- **Bounded budget** `{ timeMs: 3_600_000, tokens: 1_000_000 }` (1h / 1M): affords **2 chains** —
  token-bound (1M / 454.9k = 2.19 → 2); time affords 15. Tokens is the binding denomination. ≥1
  guaranteed, ~2 realized ⇒ spend-down, not a single cast.
- **Forward (live) walk-away** 50% (1/2); **attested back-fill** 13 (0 intervened). Each cleared
  `--no-intervened` chain adds **2** forward `untouched` records.

## Go/no-go rationale (the design's output contract)

**GO**, conditional on T-037-02 staging a board with **≥2 signals**. The decisive criterion is
**auth==exec** (E-025): `castWork` threads the *same* `proposeEnvelope`/`decomposeEnvelope` it priced
on into the cast PER STEP (work.ts:195-196 → `resolveStepBudgets`), so the chain runs under exactly
the budget it was authorized at. The E-024 no-op (authorized 227k, cast at the 150k static default →
budget-exhausted, cleared 0) **cannot recur**. Price (454.9k) ≤ funded (1M) ⇒ ≥1 chain authorized.

**Honest caveats to record (not blockers):**
- Per-cast andon risk is real (censored rate is non-zero) but is a clean P7 stop, NOT a
  price-mismatch no-op. Much of the historical censored sample is synthetic test epics + pre-E-025
  150k-default casts that this fix prevents.
- "2 chains" assumes actuals ≈ predicted (p90 envelope); the wallet debits actuals, so realized
  authorizations could be exactly 2 (or a 3rd if actuals run well under p90). Floor remains ≥1.
- The board must carry ≥2 ranked signals for 2 chains to clear — a T-037-02 staging precondition.

## Non-goals (deferred to T-037-02 / T-037-03)

Running the executor; staging the board; meeting the ≥10 forward bar; the trust verdict. This ticket
only proves the run is viable.
