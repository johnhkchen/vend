# T-045-01 — Plan: ordered, verifiable steps

Per design.md: two tranches split at the cost/reversibility boundary, with a human go/no-go gate
between them. Each step states its action, its cost, and its verification.

## Step 0 — Preconditions (free)
- Confirm doctor preflight would pass (or let `castWork`/`steer` surface `unfit-env` cleanly).
- Confirm the board is stale (board 17:07 < live 19:28) so a re-stage is genuinely required.
- **Verify:** `stat` mtimes already show stale (research §5). ✓ established.

## Step 1 — Tranche 1: re-stage a fresh board (≈$0.76, ~2 min, 1 live cast)
- Run: `bun run src/cli.ts steer`
- This casts the steer play (E-044 ranker active), overwriting `docs/active/pm/staged/steer.md`.
- **Verify:**
  - `staged/steer.md` mtime is now newer than the live state (freshness gate will pass).
  - A new `steer` record appended to `.vend/runs.jsonl`.
  - **Read the #1 `vend chain "…"` line** under `## Pull these`.

## Step 2 — Record the E-044 verdict (free)
- Classify the fresh #1:
  - **Concrete product demand** (e.g. `vend init`, hackathon `examples/`, multi-node DAG) ⇒ **E-044
    took.** Record verbatim.
  - **Still self-referential** ("re-run the sweep", "run Vend on itself") ⇒ **E-044 did NOT take** ⇒
    record as a **finding** (regression). Do not silently re-point.
- **Verify:** the #1 string is transcribed verbatim into `sweep-log.md` with the verdict.

## Step 3 — HUMAN GO/NO-GO GATE (the authorization boundary)
- Present the fresh #1 + E-044 verdict + the cost of Tranche 2 (~$5–10, ~1h, mints epics) and obtain
  an explicit decision (design Decision 3):
  1. **Go** — run the bounded sweep.
  2. **Defer** — bank the E-044 confirmation; pivot to a concrete pull (`vend init`) instead of
     another self-referential sweep.
  3. **Stop on finding** — if #1 is still self-referential.
- **Verify:** the decision and its authority are recorded in `progress.md`. No spend before this.

## Step 4 — Tranche 2: bounded metered sweep (~$5–10, ~1h) — ONLY on explicit GO
- Run: `bun run src/cli.ts work --no-intervened --budget 3600000,1000000`
- Let it spend down to a **clean P7 stop** (`wallet-exhausted` or `board-cleared`). Do not intervene
  (the `--no-intervened` self-report must stay honest).
- **Verify:** the receipt prints a clean stop reason; `auth==exec` held (no budget-exhausted-at-150k
  surprise); the run did not crash mid-cast.

## Step 5 — Post-sweep: confirm E-043 live (no orphan)
- `ls docs/active/epic/`; inspect titles of any newly minted epics.
- **Verify:** no two epic cards share a `title:`; every minted epic has decomposed children
  (stories/tickets). A childless duplicate of a minted title = orphan = **E-043 regression finding**.

## Step 6 — Post-sweep: confirm cleared chain(s) valid
- `lisa validate`
- **Verify:** green; the cleared epic→story→ticket chain(s) are DAG-valid. Record the real epic id(s)
  + ticket ids.

## Step 7 — Post-sweep: capture the forward-E1 ledger delta
- `tail`/`grep` `.vend/runs.jsonl` for the new `intervened:false` + `success` records.
- **Verify:** forward count moved up from the 8 baseline toward ≥10. Record the before/after.

## Step 8 — Write `sweep-log.md` (the deliverable)
- Transcribe **verbatim**: the #1 signal, the receipt, the cleared chain id(s) + `lisa validate`
  result, the ledger delta, and the E-043/E-044 confirmations (or findings).
- **Verify:** every AC bullet has a corresponding verbatim capture.

## Step 9 — Review
- Write `review.md`: what ran, what was deferred and why, seam verdicts, open concerns.

## Testing strategy
- **No unit tests** — this ticket changes no code. The seams it confirms are already unit-tested
  (`propose-effect.test.ts` AC#3 double-run for E-043; the ranker is prompt-only, E-020 shape, so
  E-044 has only the empirical board-#1 test). Verification here is *live observation*, captured
  verbatim. The test suite (`bun test`) is unaffected and is not re-run as part of the sweep.

## Branch outcomes (all honest, all logged)
- **Full sweep, ≥1 clear, no orphan, concrete #1:** ideal — forward 8 → ≥10, both seams confirmed.
- **Full sweep, 0-clear:** recorded with cause (e.g. budget exhausted on first chain, honest-empty
  board). Not a failure of the ticket — a real datum.
- **Deferred spend:** E-044 confirmed via Tranche 1; spend deferred to a concrete pull per the human
  gate. Logged with rationale.
- **Regression finding:** still-self-referential #1 (E-044) or an orphan epic (E-043) — logged as the
  hardening having regressed/not taken. The explicit point of the ticket.
