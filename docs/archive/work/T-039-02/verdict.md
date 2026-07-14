# Verdict — macro-wallet live clear: **WATCHED CLEARING** — go stays *provisional + forward-leaning (8/10 sample · 4 cleared)*, NOT forward-confirmed

> Settles `work/T-039-01/sweep-log.md` (the live, metered re-sweep of 2026-06-20, E-038's censor fix
> in flight) against the E-014/E-026 standard: **don't dress an unverified claim as measured.** Forward
> read sourced from `bun run src/cli.ts audit`, re-read verbatim this session (reproducible — an
> append-only ledger, not a one-shot capture) and cross-checked against `.vend/runs.jsonl` records
> 28–33 directly. Ledger state stamped **2026-06-20** (33 runs).

## The headline — two claims, kept separate

1. **WATCHED CLEARING (earned, new).** This is the graduation T-037-03 could **not** claim. Where the
   E-037 sweep watched the wallet *refuse cleanly* (an honest 0-clear, time-censored), this re-sweep —
   **same budget, only E-038's 2× timeout headroom added** — watched the macro-wallet **clear 2 real
   pulls** of grounded product work to a clean P7 stop. `propose-epic` **FINISHED** (93 s / 83 s),
   *past* the 72,785 ms wall that censored E-037 twice. **E-038 is proven live, in flight** — not just
   deterministically. The loop now *clears*, not merely *refuses*.
2. **NOT forward-confirmed (the load-bearing non-goal, held).** 2 cleared pulls / **4 cleared
   forward-E1 records** is the **first** cleared evidence — but it is **not** the ≥10-genuine-forward
   bar. **No "forward-confirmed" claim is made.** Declaring confirmation off one bounded sweep is the
   exact E-026/T-026-04 over-claim this project already corrected once. The go **hardens** (off
   *cleared*, not censored, records) but stays **provisional + forward-leaning.**

These are independent. "Clearing" is about the *machinery clearing sound work live*; "confirmed" is
about the *trust sample reaching ≥10*. The first graduated this sweep; the second accrued its **first
cleared installment** and stays open.

## 1. Cleared vs censored — forward-only, never the combined pool

`vend audit`, 2026-06-20, the forward-only line (the road a verdict cites — E-028 split):

```
    └ forward (live): 88% (7/8 untouched) · attested back-fill: 100% (13/13 untouched)
```

But **"untouched" ≠ "cleared."** The forward walk-away (88%) counts records where the author didn't
step in — which *includes* the 2 censored T-037 priors (`timed-out`, `intervened:false`). The
**cleared** read intersects `intervened:false` **with** `outcome:success`. Reading
`.vend/runs.jsonl` directly:

| # | play | outcome | intervened | attested | the read |
|---|---|---|---|---|---|
| 28 | propose-epic | **timed-out** | false | — | **censored prior** (T-037 self-ref signal) — untouched, NOT cleared |
| 30 | propose-epic | **success** | false | — | **★ FIRST CLEARED forward-E1 record** — "Author `vend init`" |
| 31 | decompose-epic | **success** | false | — | cleared — E-040 |
| 32 | propose-epic | **success** | false | — | cleared — "Author `vend doctor`" |
| 33 | decompose-epic | **success** | false | — | cleared — E-042 |

**The first CLEARED forward record is #30** (propose-epic, `vend init`, `success`, `intervened:false`,
no attestation). Records **30–33 are the 4 cleared forward-E1 records** — the first in the project's
history. At the pull level that is **2 cleared pulls** (init, doctor), each a propose + decompose chain.

| | Authoring baseline (post-E-037) | Post-sweep (now) | Delta |
|---|---|---|---|
| forward (live) walk-away | 75% (3/4) | **88% (7/8)** | +4 forward records, all untouched |
| forward **cleared** (success∧untouched) | **0 (all 4 censored)** | **4** | **+4 — the first clears** |
| forward sample vs ≥10 bar | 4/10 | **8/10** | +4, accruing |

> **The combined ledger reads `95% (20/21)`. Cited here once, only to be excluded.** 20/21 pools the
> **13 attested back-fill** records with the 8 forward ones — it is **not** a forward read. Citing
> 20/21 (or "95%") as forward is **precisely** the T-026-04 over-count this project corrected
> (`work/T-026-04/verdict.md`: *"of the 15 carriers, 13 are the back-fill … only 2 are genuine
> forward records"*). The verdict cites **forward 88% / 8 reports**, of which **4 cleared** — nothing
> else.

## 2. Clear quality + the E-038 effect — and the answer is now "sound, grounded" (no longer "undemonstrated")

T-037-03 had to record clear-quality as **undemonstrated** — the cast time-censored before it
materialized any card. E-039 minted two cards we can actually inspect:

- **E-040 `vend-init-scaffold`** and **E-042 `vend-doctor-preflight`** — both **concrete Frontier-7
  product demand** (straight from the PRD), each fully decomposed (**2 stories + 4 tickets**), DAG
  valid, `lisa validate` **green**. These are **sound, grounded** epic cards for a real frontier —
  **not** thin or self-referential meta-epics.
- The sweep's *board #1* was again self-referential ("run the sweep"), but T-039-01 **re-pointed** it
  at concrete demand before casting — so **what cleared is grounded.** The degeneracy is a
  ranker-input finding (carried below), not a property of the cleared output.

**propose FINISHED (the E-038 live effect).** Records 30 & 32: `propose-epic outcome=success`, elapsed
**93 s / 83 s** — both *past* the **72,785 ms** envelope that timed-out E-037, surviving only because
E-038 gave the kill-switch a **145,570 ms** wall (`price × 2`). These successes now *enter* the
recalibration sample — exactly the data E-038's headroom was built to let in. **The old named blocker
from T-037-03 — "`propose-epic` time-censors before it can mint" — is cleared.**

**P7 held.** Clean **wallet-exhausted** stop (367 k tokens left, < the next pull's price ⇒ `canAfford`
false ⇒ the loop refused to authorize an unaffordable cast), a **truthful receipt** (`Cast 2, cleared
2`), and **zero partial state** — *save one flagged wart, now cleaned* (below).

**auth==exec held (E-025).** Each propose ran under its authorized 72,785 ms *price* envelope with the
145,570 ms E-038 *kill-wall*; each decompose under its 160,745 ms envelope. No 227k→150k mismatch —
the casts ran under exactly what was authorized.

**The E-041 orphan — adjudicated (deleted).** The `vend doctor` clear minted the epic **twice**: E-042
(decomposed, logged, ledger-targeted) and **E-041** (childless duplicate title, not in the ledger, not
in the sweep's effect log). Verified no story/ticket referenced it; **deleted `docs/active/epic/
E-041.md`** this settle, and **`lisa validate` stays green** (105 tickets, DAG valid) — the board now
reflects *exactly what cleared*. **Carry-forward (not built here):** an **idempotent-mint guard** in
`propose-epic` so an id double-allocation can't leave a stray card again.

## 3. The call — provisional + forward-leaning, watched CLEARING, with a named cadence to ≥10

**The go stays provisional + forward-leaning — now upgraded from "watched refusing" to "watched
clearing".** One bounded session that cleared 2 pulls does **not** meet the ≥10-genuine-forward bar.
It is explicitly **not** graduated and explicitly **not** "forward-confirmed." But unlike T-037-03,
the records it added are **cleared**, not censored — the cadence now accrues the *right kind* of
evidence.

**Named cadence — two honest denominations** (don't collapse them into one misleading number):

- **Forward sample → ≥10 reports** (the KR1 count T-037-03 tracked): **4/10 → 8/10** this sweep.
  **+2 reports to the bar** (≈ 1 more cleared pull, since each pull = 2 forward records).
- **Cleared forward records** (the quality bar the prior 4 censored records never met): **0 → 4.**
  Because the standard is ≥10 *genuine* and the older forward records were censored, the deeper cadence
  is **4 → 10 cleared ≈ +3 more cleared `--no-intervened` pulls.**

This sweep is the **first cleared installment**, not the finish line. Each future bounded sweep that
*clears* a pull adds cleared forward records; the go graduates to "forward-confirmed" **only when
genuinely earned** at ≥10 — not before, and not off these two pulls.

**Two follow-ups the live run surfaced** (board-hygiene / steer-quality, not blockers):
1. **Idempotent-mint guard** for `propose-epic` (the E-041 double-mint root cause).
2. **Steer ranker demotes self-referential targets** — two sweeps (E-037, E-039) both surfaced "run
   the sweep" as #1. The re-point handled it, but it's friction every sweep and a foot-gun for an
   unattended operator.

## Bottom line

The keystone gesture is **watched CLEARING** — `propose-epic` finished past the wall that censored
E-037 (**E-038 proven live**), 2 real pulls cleared into 2 sound, grounded, fully-decomposed epics,
P7 and auth==exec held, the board cleaned to reflect exactly what cleared. The forward-E1 gate
**moved on real, *cleared* evidence for the first time** (0 → **4 cleared**; sample 4/10 → **8/10**) —
but 2 pulls is **not** the ≥10 bar, so the go stays **provisional + forward-leaning, NOT
forward-confirmed.** What remains to fully ungate: accrue **cleared** forward records to **≥10**
(+2 reports / ≈3 more cleared pulls), with the propose time-censor now off the critical path. An
honest settlement of a real run — the machinery proven *clearing*, the trust claim unembellished.
