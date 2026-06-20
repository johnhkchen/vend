# Verdict — macro-wallet live proof: **WATCHED, not confirmed** — go stays *provisional + forward-leaning (4/10)*

> Settles `work/T-037-02/sweep-log.md` (the watched, metered spend of 2026-06-20) against the
> E-014/E-026 standard: **don't dress an unverified claim as measured.** Forward read sourced from
> `bun run src/cli.ts audit`, re-read verbatim this session (reproducible — an append-only ledger,
> not a one-shot capture). Ledger state stamped **2026-06-20**.

## The headline — two claims, kept separate

1. **WATCHED (earned, new).** The headline gesture is no longer *coded-green but never demonstrated*.
   It ran **live and metered**: a real `claude -p` cast, under an operator-authorized budget, spent
   down to a **clean P7 stop** — twice. **P4/P7 are demonstrated live, not just wired.** That is the
   real graduation this epic existed to produce.
2. **NOT confirmed (the load-bearing non-goal, held).** The forward-E1 trust gate moved on real
   evidence but remains **provisional + forward-leaning at 4/10** — it does **not** meet the
   ≥10-genuine-forward bar, and this session **did not clear a pull**. **No "forward-confirmed"
   claim is made.** A 0-clear dressed as confirmation would be the exact E-026/T-026-04 trap.

These are independent. "Watched" is about the *machinery running live*; "confirmed" is about the
*trust sample*. The first graduated; the second accrued two points and stays open.

## 1. Forward-E1 moved — forward-only, never the combined pool

`vend audit`, 2026-06-20, the forward-only line (the road a verdict cites — E-028 split):

```
    └ forward (live): 75% (3/4 untouched) · attested back-fill: 100% (13/13 untouched)
```

| | Authoring baseline | Post-sweep (now) | Delta |
|---|---|---|---|
| forward (live) walk-away | **50% (1/2)** | **75% (3/4)** | +2 records, both untouched |
| forward sample vs ≥10 bar | **2/10** | **4/10** | +2, accruing |

The sweep appended **2 genuine forward records** — `.vend/runs.jsonl` #27 and #28, both
`propose-epic outcome=timed-out intervened=false` with **no** `intervenedAttestation` marker, so
`auditWalkAway` (`src/ledger/walk-away.ts:160`) files them as **forward (live)**. They moved the
walk-away from 1/2 to 3/4.

> **The honest caveat that makes this NOT a clearance.** Both new records are **right-censored
> (`timed-out`)** — not cleared successes. The walk-away rate measures *the author didn't step in*,
> which is true (clean P7 stops, the andon fired and the author let it). It does **not** measure
> *work cleared* — and **0 work cleared** this session. The +2 enlarge the forward *sample* and the
> walk-away numerator; they are **not** the "≥1 cleared pull" the headline AC wanted.

**The combined ledger reads `94% (16/17)`. That figure is cited here once, only to be excluded:**
16/17 pools the **13 attested back-fill** records with the 4 forward ones — it is **not** a forward
read. Citing 16/17 (or the old "14/15") as forward is **precisely** the T-026-04 over-count this
project already corrected (`work/T-026-04/verdict.md`: *"of the 15 carriers, 13 are the back-fill …
only 2 are genuine forward records"*). The verdict cites **3/4 forward**, sample **4/10** — nothing
else.

## 2. Quality, not just quantity — and the honest answer is "nothing to assess yet"

The ticket asks whether what cleared is **sound/grounded vs thin/junk** — because *a walk-away that
clears junk is not trust*. The honest answer: **nothing was minted, so there is no card to assess.**
The `propose-epic` cast time-censored **before** it materialized any epic/story/ticket
(`lisa validate` → board green, **no partial mint**). So **clear-quality stays UNDEMONSTRATED** — we
have not yet watched the loop clear *sound* work; we have only watched it *refuse cleanly*.

What **was** demonstrated, with integrity:

- **P7 held.** Clean stop (`andon: timed-out`, IA-9 amber — a successful refusal, never red), a
  **truthful receipt** (`cleared 0`, wallet barely moved), and **zero partial state** (no half-minted
  epic). Reproduced twice → structural, not a fluke.
- **auth==exec held (E-025).** The cast ran under **exactly** its authorized envelope: ~72.8 s spent
  ≈ `propose-epic`'s measured **72,785 ms** per-step budget, **0 tokens debited** under the price.
  This is **not** the E-024 price-mismatch no-op T-037-01 ruled out — it is per-cast censoring at its
  *correct* envelope. The wallet was bounded and honest.

So: the **machinery** earns high marks (bounded, truthful, clean, no partial state); the **clearance
quality** earns *no marks yet* — honestly, because nothing cleared.

## 3. The call — provisional + forward-leaning, with a named cadence to ≥10

**The go stays provisional + forward-leaning (4/10).** One bounded session does **not** meet the
≥10-genuine-forward bar, and it added **censored**, not cleared, records. The macro-wallet (E-024/
E-025) stays as shipped; **zero remediation triggered** (the reroute branch is "author keeps
intervening" — 0 interventions this session is its inverse). But this is explicitly **not**
graduated and explicitly **not** "forward-confirmed."

**Named cadence to ≥10** (each future `--no-intervened` sweep accrues forward records — 4/10 now,
+6 to go), **gated by one real, newly-surfaced blocker:**

> **`propose-epic` time-censors the board's top signal before it can mint.** The two timeouts are
> not a price problem (E-025 holds) — `propose-epic` needs **more than its 72,785 ms p90 envelope**
> on the board's heaviest signal and is censored before materializing. The cadence cannot accrue
> *cleared* forward records until this is cleared. Two routes:
> - **Widen the envelope** — let `recalibrate` set a larger per-step time budget for heavy
>   `propose-epic` signals (the p90 is fit from lighter history; this signal is an outlier).
> - **Lighter top signal** — stage a board whose #1 is a smaller pull the current envelope can mint,
>   then accrue cleared forward records off it.
>
> This is a real finding the live sweep *produced* — exactly the kind of evidence a watched run is
> for. It belongs to Frontier 1's remaining work (and rhymes with Frontier 6's recalibration levers).

## Bottom line

The keystone gesture is **watched** — P4/P7 proven live, the wallet bounded and truthful, auth==exec
held. The forward-E1 gate **moved on real evidence (1/2 → 3/4, sample 2/10 → 4/10)** but on
**censored** records, so the go stays **provisional + forward-leaning**, **not forward-confirmed**.
What remains to fully ungate: clear the `propose-epic` time-censor, then accrue **cleared** forward
records to **≥10**. An honest settlement of a real run — the machinery proven, the trust claim
unembellished.
