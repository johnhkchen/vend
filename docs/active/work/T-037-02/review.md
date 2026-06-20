# T-037-02 — Review

## What this ticket did

Performed the **watched, metered macro-wallet spend** deferred since T-024-03: operator-authorized a
bounded live run, staged a fresh board (`vend steer`), and cast `vend work --no-intervened --budget
3600000,1000000` for real — **twice**. Both runs reached a **clean P7 stop with cleared 0**: the
first cast (`propose-epic` on the board's top signal) hit a reproducible `andon: timed-out` at its
per-step time envelope. The deliverable `sweep-log.md` records the verbatim evidence. **The
wallet/andon machinery is proven; the headline live proof of a *cleared* pull is not yet landed.**

## Changes

### Files created
- `docs/active/work/T-037-02/sweep-log.md` — **the deliverable**: verbatim staging + both run
  receipts, the receipt analysis, the (empty) cleared-pulls section, the ledger delta, and an honest
  AC scorecard.
- `docs/active/work/T-037-02/{research,design,structure,plan,progress,review}.md` — RDSPI artifacts.

### Files modified / deleted (source)
- **No `src/` change. No test change. No deletion.** This is an operation ticket.
- `docs/active/tickets/T-037-01.md` / `T-037-02.md` show modified — **Lisa's automatic phase
  advances**, not manual edits (per the workflow contract).

### Authorized run side effects (real, intended — not source edits)
- `docs/active/pm/staged/steer.md` — staged fresh (9 ranked signals).
- `.vend/runs.jsonl` 25 → 28 (+3): `steer success`; two `propose-epic timed-out` forward-censored.
- **No epic/story/ticket minted** — the andon fired before materialization; **zero partial state**.

### Transient
- Raw stdout captures (`_sweep-raw.txt`, `_sweep-raw-2.txt`, `_steer-raw.txt`) created, frozen into
  `sweep-log.md`, and removed.

## The acceptance criteria — verdicts

| AC | Verdict | Basis |
|----|---------|-------|
| Fresh board clears the E-027 gate | ✅ | `steer.md` @16:02:44 > live 15:51:24; 9 signals; `isBoardStale` false |
| `vend work` to a clean P7 stop | ✅ | `andon 'timed-out'` — successful refusal, nothing partial (reproduced ×2) |
| ≥1 real pull cleared + `lisa validate` green + auth==exec | **❌ cleared 0** · ✅ validate green · ✅ auth==exec | cast censored on **time** before minting; repo green; ran under its authorized 72,785 ms envelope |
| forward-E1 records `intervened:false` appended | ✅ (censored) | records 27, 28 forward/unattested — but `timed-out`, not cleared |
| `sweep-log.md` verbatim + honest | ✅ | this work dir |

**Net: 3 of 5 fully met; the headline "≥1 cleared" is honestly unmet (0-clear).**

## Test coverage

- **No new tests** — deliberate. The seams the run drives (`spendDown`/`fitNext`/`shouldContinue`,
  `wallet` allocate/canAfford/debit, `renderReceipt`/`isBoardStale`, the forward/attested split) are
  already covered by pure unit tests (T-037-01 §7). The live run **exercised** them, it did not
  re-test them. A test that casts the live executor would spend real money on every CI run.
- **Deterministic gate this ticket:** `tsc --noEmit` clean; `lisa validate` "All checks passed".
- **Coverage gap (acknowledged, not a defect):** there is no automated test asserting that
  `propose-epic` completes within its recalibrated time envelope — which is precisely the failure
  observed live. That is hard to unit-test (it depends on live model latency), but see Concern #1 for
  the systemic fix it points to.

## Open concerns / flags for the human reviewer

1. **🔴 The live proof of a *cleared* pull did not land — `propose-epic` per-step TIME censoring.**
   Both casts timed out at ~72.8 s = the `propose-epic` p90 time envelope (72,785 ms). The model
   emits ~45 thinking events on the board's self-referential top signal and exceeds the wall before
   materializing. This is **reproducible** and is the binding blocker. It is **not** the E-024
   price no-op (E-025 holds; auth==exec confirmed). Two plausible (non-exclusive) root causes:
   - **The time envelope is too tight.** The p90 over past successes (72,785 ms) is shorter than the
     current cast needs. `recalibrate` bounds time *independently* of tokens (IA-13); with the wallet
     token-rich (1 M) but the per-step *time* tight, every cast time-andons regardless of budget.
     There is **no CLI knob** to widen the per-step time budget — `--budget` sets the wallet, not the
     envelope. A fix likely lives in `recalibrate`/the prior, or a per-step time floor.
   - **The top signal is pathologically meta** ("Run and settle the E-037 live macro sweep…") — a
     self-referential prompt that induces excess thinking. A board whose #1 is a concrete domain
     signal might clear within the envelope. Untested here (the loop pulls in board order).

2. **🟠 The forward records are *censored*, not cleared.** Records 27 & 28 carry `intervened:false`
   (forward) but `outcome:timed-out` — they enlarge the forward *reported* sample without adding a
   cleared "untouched" success. **Do not** count this session toward the ≥10-genuine-forward bar —
   that would be the exact E-026 over-claim trap. T-037-03 must read the forward delta honestly.

3. **🟢 What the run *did* prove (record it as a real positive).** The bounded-wallet autonomy loop
   works end-to-end live: it priced from the live ledger, authorized only an affordable cast (P7),
   ran it under exactly the authorized envelope (auth==exec), debited honestly, hit the time wall,
   refused cleanly (amber andon, IA-9), left **zero partial state**, and emitted a **truthful
   receipt**. The "step out of the loop and trust the receipt" gesture is real — it just refused.

4. **🟠 Token spend was near-zero on the wallet, but real API usage occurred.** Both work casts
   debited ◇ 0 tokens (timed out pre-materialization); the steer cast spent real tokens (it
   materialized). The 1 M budget was never the binding limit — so re-running after a time-envelope
   fix is cheap and safe.

5. **🟢 No board pollution.** The andon minted nothing; `lisa validate` is green; the only board
   change is the (intended) staged `steer.md`. The repo is clean to hand off.

## Recommendation for T-037-03 (the downstream verdict ticket)

Settle the verdict **honestly on a 0-clear**: the machinery is proven, the *cleared-pull* proof is
**pending a per-step-time fix** (Concern #1). T-037-03 likely should either (a) gate on a small
follow-up that widens/floors the `propose-epic` time envelope (or re-stages a board with a concrete
top signal) and then re-runs this sweep, or (b) record the verdict as "machinery green, live
cleared-pull proof deferred" with the forward sample unchanged in *success* terms. Either way: **no
over-claim** — this session did not clear a pull and did not move the genuine-forward bar.

## Bottom line

The watched metered sweep ran honestly and stopped cleanly — **but cleared 0**, blocked by
`propose-epic` timing out at its (correctly authorized) per-step time envelope, not by any price
mismatch. The wallet/andon contract (P7, auth==exec, truthful receipt, no partial state) is **proven
live**; the headline proof of a **minted, cleared pull** is **not yet achieved** and needs the
time-envelope follow-up flagged above. Recorded truthfully, with every number reproducible from
`sweep-log.md` and the ledger.
