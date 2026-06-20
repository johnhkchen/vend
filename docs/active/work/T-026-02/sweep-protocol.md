# T-026-02 — Forward-E1 sweep protocol (the bounded multi-sitting accumulation)

How the run ledger reaches **≥10 genuine forward E1 carriers** now that `vend work` records the `intervened` bit. This is the AC's explicit case: *"if run latency forces a bounded multi-sitting background sweep, that is flagged … rather than the sample padded."* It is flagged here. The records accrue from **real product use**, not fabrication.

## The instrument (after commit `4bd90d3`)

`vend work --no-intervened` (or `--intervened`) — fund the macro-wallet, walk away (or report you stepped in), and let the sweep spend down the staged ranked board. Each cleared signal casts the propose→decompose chain, writing **two** genuine bit-carrying records (`propose-epic` + `decompose-epic`). `vend audit` reads them back as walk-away self-reports.

```
# A genuine walk-away session (the common case): fund, walk away.
vend work --no-intervened                 # default macro budget (~2h / 2M tokens)
# Or a bounded sitting affording ~1–2 cleared signals:
vend work --no-intervened --budget 1800000,500000
# If the staged board is stale (E-027 gate), refresh first, else override knowingly:
vend survey   # or: vend steer    → restages a fresh board
vend work --no-intervened
# A session where you DID step in mid-run:
vend work --intervened

# Read the accumulating rate + trend:
vend audit                 # all plays
vend audit decompose-epic  # the decompose arm only
```

## Accrual math (2 → ≥10)

| Source | Genuine forward carriers |
|---|---|
| T-026-01 probes (already in ledger) | 2 (`intervened:true`/`false`, andon-outcome) |
| Each cleared `vend work` signal | +2 (propose + decompose, success-outcome) |

Four cleared signals across one or more sweeps ⇒ +8 ⇒ **≥10 genuine carriers**, the majority now real **successes** against the live wallet (the genuine behaviour E-014's verdict needs), not forced andons. A single default-budget `vend work` sweep typically clears several signals, so ≥10 is reachable in **one to a few sittings**.

## Mixing the bits

E-014's KR2 wants the walk-away rate and its → 100% trend read from a mix. Run the **majority `--no-intervened`** (genuine walk-aways — the target behaviour) and a **minority `--intervened`** (sessions where you actually stepped in). Self-report honestly per session; never set the bit to manufacture a number — an unreported sweep correctly stays `unknown` (the audit shows "no self-reports yet" rather than a fabricated rate).

## Notes / caveats (carried to review)

- **Two carriers per signal.** One sweep that clears N signals adds 2N carriers from one self-report. They are all genuine observations (each is a real "did the author intervene" data point for that session), so the rate is honest; just read "≥10 sessions" as ≥10 genuine carrier records, not 10 separate invocations.
- **Board output is the product, not pollution.** A genuine `vend work` success mints a real epic + stories/tickets (as it minted E-026). That is the gesture working; review it like any autonomous output (IA-5). This is the key difference from the rejected throwaway-epic option — the work is real.
- **Andon records also count.** A `vend work` cast that budget-exhausts/times-out still records the bit (proven on `castPlay`). Those are honest censored observations; the rate stays meaningful because the audit reports the outcome mix alongside it.
- **Environment.** Verified-reachable SDK assumed (this repo/session). A headless/cron sweep needs its own readiness check (T-026-01 #4).

## Why not just pad to 10 now

Casting 8 more 1-token `vend run` andons would hit the count today but every record would be a degenerate run the author never had a chance to walk away from — exactly what the AC ("rather than the sample padded") and T-026-01 review #2 forbid. The walk-away rate over forced andons would mislead E-014. The honest path is to capture genuine behaviour, which this protocol now makes possible.
