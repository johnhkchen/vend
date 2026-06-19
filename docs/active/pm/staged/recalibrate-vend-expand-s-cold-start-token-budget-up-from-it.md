# Recalibrate vend expand's cold-start token budget up from its 100k ceiling to a measured envelope (~250k) using the already-observed 211k single-extraction overrun — the same measured recalibration decompose got (50k→120k).

| Signal | Value | Budget (envelope) | Status |
|---|---|---|---|
| **Recalibrate vend expand's cold-start token budget up from its 100k ceiling to a measured envelope (~250k) using the already-observed 211k single-extraction overrun — the same measured recalibration decompose got (50k→120k).** — Expand's ceiling is ~2x too thin: a 100k-budgeted run spent 211k, so every expand run silently breaches its own allocation. Fixing the demand-extraction primitive's budget to a measured floor restores P7 (budget as a hard contract) on the very play the board depends on to read demand. | **Standard** | small (~1h) | ready — unlike the broader cross-play budget audit (blocked on E-013's measurement harness), expand already has its own observed 211k data point, so a single-play recalibration can be pulled now; it can also be folded into E-013 if the board prefers one measured sweep. (advances [P7, right-sized allocation (charter criterion 3) for the expand play] · grounded in Run-log obs 21333 'expand-fragment Play Budget Severely Undersized — 100k Token Ceiling Spent 211k' and obs 21327 (this T-016 run); fragment 'vend expand itself wandered to 211k tokens on one signal extraction'; decompose precedent 50k→120k recalibration (obs 21280/21329).) |

## Pull this

A human pulls this staged signal onto the board with one gesture:

```
vend chain "Recalibrate vend expand's cold-start token budget up from its 100k ceiling to a measured envelope (~250k) using the already-observed 211k single-extraction overrun — the same measured recalibration decompose got (50k→120k). — Expand's ceiling is ~2x too thin: a 100k-budgeted run spent 211k, so every expand run silently breaches its own allocation. Fixing the demand-extraction primitive's budget to a measured floor restores P7 (budget as a hard contract) on the very play the board depends on to read demand."
```

_Staged by Vend's `expand-fragment` play — not promoted; pull to clear._
