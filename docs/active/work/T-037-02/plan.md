# T-037-02 — Plan

## Strategy

An operation, not a code change: no atomic-commit sequence of source. The "steps" are run actions,
each independently checkable, that culminate in the verbatim evidence `sweep-log.md` records. The
testing strategy is **the existing unit coverage** (the seams are already tested — T-037-01 §7) plus
**the live run itself as the integration proof** (the watched spend IS the test). Ticket-level
verification: a clean P7 stop with ≥1 real pull cleared and `lisa validate` green (or an honest
0-clear/withheld outcome with its reason), captured verbatim.

## Steps

### Step 0 — Produce the planning artifacts (free, unconditional) ✅
`research.md`, `design.md`, `structure.md`, `plan.md`. No spend; these de-risk and document the run.
**Done when:** all four written (this artifact completes Step 0).

### Step 1 — Operator authorization for the bounded spend (the counter gesture, P2/P7)
Before any live cast, surface the go/no-go: the recommended budget (`--budget 3600000,1000000`),
the expected cost (~2 chains × ~455k ≈ ~0.9M tokens + the staging cast), and what gets minted (real
epics+tickets onto `docs/active/**`). Proceed only on an explicit **go**.
- **Verify:** the operator authorized the spend (or declined).
- **Done when:** a go/no-go is recorded. On **no-go**, skip to Step 6 (record prepared-not-cast).

### Step 2 — Stage a fresh board (live cast) [on go]
`bun run src/cli.ts steer` → `docs/active/pm/staged/steer.md`.
- **Verify:** the board file is written *now* (mtime newer than every `docs/active/**`); it carries
  **≥2** ranked `vend chain "…"` lines (`grep -c '^vend chain' …/steer.md`). ≥1 still clears the
  floor; ≥2 enables the 2-chain spend-down.
- **Done when:** a fresh board with ≥1 (ideally ≥2) signals exists. Capture the staging output.

### Step 3 — Run the metered sweep with full capture [on go]
`bun run src/cli.ts work --no-intervened --budget 3600000,1000000` — capturing **all** stdout+stderr
verbatim (`… 2>&1 | tee docs/active/work/T-037-02/_sweep-raw.txt`).
- **Verify:** the freshness gate passes (fresh board) → the wallet funds → `spendDown` casts the
  highest-leverage affordable signal, debits actuals, repeats → a **clean P7 stop**
  (`board-cleared` / `wallet-exhausted`, or an honest `andon`). Nothing partial.
- **Done when:** the run exits on a clean stop and the raw transcript is captured.

### Step 4 — Verify the cleared pulls + auth==exec [on go]
- `lisa validate` (or `bun run src/cli.ts validate` if that is the local arm) on the minted ids.
- Confirm each cast ran under the authorized p90 envelope (the receipt's per-cast cost ≤ the
  envelope; no 150k-default budget-exhausted → the E-024 no-op did not recur).
- **Verify:** `lisa validate` green on the minted epic+tickets; auth==exec held.
- **Done when:** validation result captured (green, or the honest failure with the reason).

### Step 5 — Read back the ledger delta [on go]
- `wc -l .vend/runs.jsonl` (expect 25 → 25 + 2N for N cleared chains); inspect the appended records
  carry `intervened:false`, no `intervenedAttestation` marker (⇒ forward), and the right play names.
- Optionally run `auditWalkAway` over the new ledger to show the forward sub-stat moved.
- **Verify:** `2N` forward `intervened:false` records appended; existing 25 untouched.
- **Done when:** the ledger delta is captured.

### Step 6 — Write `sweep-log.md` (the deliverable)
Compose from the captured verbatim output: header/scope, stage, run (production line), receipt,
cleared pulls + `lisa validate`, ledger delta, auth==exec attestation, honest outcome. **Paste actual
output, not paraphrase.** On a withheld spend (Step 1 no-go): record prepared-not-cast — the staged
command, the T-037-01 GO, and that the spend awaits the counter gesture.
- **Done when:** `sweep-log.md` is complete and truthful to whatever happened.

### Step 7 — Clean up + close out
- Remove the transient `_sweep-raw.txt` capture (its content is frozen into `sweep-log.md`); confirm
  `git status` shows only intended artifacts + the authorized run side effects (staged board, minted
  ids, ledger append).
- Write `progress.md` (per-step outcome + deviations) and `review.md` (handoff + open concerns).
- **Done when:** the work dir carries the full artifact set and no stray capture file.

## Testing strategy

- **Unit (existing, relied upon):** `spend-core.test.ts`, `wallet.test.ts`, `work-core.test.ts`
  (incl. `renderReceipt`/`isBoardStale`), `walk-away.test.ts`, `chain-propose-decompose-core.test.ts`.
  These prove the seams the run drives; the sweep does not re-test them, it exercises them live.
- **Integration (this ticket):** the live run is the integration proof — a real spend-down to a clean
  P7 stop with real minted ids. Not a committed automated test (it spends real tokens + mutates the
  board); its evidence is frozen into `sweep-log.md`.
- **No new automated test.** Justified: an operation ticket with no production-code change; a test
  that casts the live executor would spend real money on every CI run. Flagged in Review.
- **Validation gate:** `lisa validate` green on the minted ids (the AC's correctness check).

## Risks & mitigations

- **R1 — the spend is real + irreversible** (tokens + minted board state). Mitigated: Step 1 operator
  authorization (the counter gesture); the budget bounds the spend (P7).
- **R2 — board has <2 signals** ⇒ only 1 chain (or 0 if empty). Mitigated: Step 2 confirms ≥1;
  records the count honestly; ≥1 still satisfies the "≥1 real pull cleared" AC.
- **R3 — a cast andons at its p90 envelope** (`budget-exhausted`). Mitigated: that is an honest P7
  stop distinct from the E-024 no-op; recorded truthfully, not hidden (Design's outcome matrix).
- **R4 — minted markdown malformed** ⇒ `lisa validate` red. Mitigated: Step 4 runs validate and
  records the result; a red is an honest finding for the human, not concealed.
- **R5 — transient capture file left in tree** trips `check:committed`. Mitigated: Step 7 removes it.

## Verification criteria (ticket-level)

All AC checkboxes: a fresh board staged that clears the freshness gate; `vend work --no-intervened
--budget <bounded>` run live to a clean P7 stop; ≥1 real pull cleared with `lisa validate` green and
auth==exec held; forward-E1 records appended carrying `intervened:false`; `sweep-log.md` captures the
verbatim steps + receipt + cleared ids + ledger delta, honest on outcome.
