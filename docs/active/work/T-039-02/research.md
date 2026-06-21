# T-039-02 — Research (settle the clear; refuse to over-claim it)

Descriptive map of the terrain this settle reads. T-039-01 ran the live, metered re-sweep with
E-038's censor fix in flight; this ticket reads the result **honestly** against the E-014/E-026
standard and crystallizes the board. **No source code changes** — this is an evidence operation
(audit read + verdict + board update + one board-hygiene deletion), mirroring T-037-03's shape.

## The question the ticket asks

Three reads, all over the **forward (live)** partition of the run ledger — never the combined pool:

1. **Cleared vs censored forward-E1.** Did the macro-wallet move from *refusing cleanly* (T-037's
   honest 0-clear) to actually **clearing**? Distinguish the first `intervened:false`+`success`
   forward record from the censored priors (the 4/10 that were `timed-out`).
2. **Clear quality + the E-038 effect.** Is what minted **sound/grounded** or thin/degenerate? Did
   `propose-epic` **FINISH** where E-037's timed out (E-038's live effect)? Did **P7** and
   **auth==exec** (E-025) hold?
3. **The honest verdict + cadence.** Write `verdict.md`: watched **clearing** (not just refusing),
   the forward cleared count, go stays **provisional + forward-leaning** with a **named cadence to
   ≥10** — no "forward-confirmed" off one sweep.

## The instrument — `auditWalkAway` (`src/ledger/walk-away.ts:160`)

PURE function over `RunRecord[]`. The verdict's numbers come from `bun run src/cli.ts audit`, which
composes `auditWalkAway` + `formatWalkAwayFindings`. Relevant structure:

- **Provenance split (E-028 / T-028-01), lines 198–208.** Reported records (those carrying the
  `intervened` bit) partition on `intervenedAttested`:
  - **`forward` (live)** = `intervenedAttested !== true` — the road a verdict cites. The live
    instrument; the self-report captured at run time.
  - **`attested` back-fill** = `intervenedAttested === true` — post-hoc human attestation. Real
    evidence, different KIND. **Conflating the two is the E-026 over-count** the project corrected.
- **`subStat` (line 147)** reduces a partition to `{reported, intervened, rate}` — `rate: null` when
  empty, never a fabricated 0 (IA-8).
- **Walk-away rate** rendered as `1 − intervention rate` = "ran untouched". **Crucially, "untouched"
  ≠ "cleared":** a `timed-out` record with `intervened:false` counts as *untouched* (the author
  didn't step in) but is **censored, not a cleared success.** The cleared read must intersect
  `intervened:false` **with** `outcome:success`.
- **Outcome mix (lines 166–171)** seeds every `RunOutcome` to 0; `CENSORED_OUTCOMES` =
  `["budget-exhausted","timed-out"]` (right-censored, IA-13). `success` is the cleared count.

## Ground truth this session (verified, not quoted)

**`bun run src/cli.ts audit`** (re-read live, reproducible — append-only ledger):

```
E1 — walk-away trust · all plays · 33 runs [standard]
  walk-away rate: 95% (20/21 ran untouched) · trend 100% → 91%
    └ forward (live): 88% (7/8 untouched) · attested back-fill: 100% (13/13 untouched)
  andon rate: 36% vs 10% budget — ⚠ over (gates working, not defects)
  outcome mix: 21 success · 9 censored (budget/timeout) · 3 gate-failed · 0 id-collision
  cost vs envelope: tokens ×0.64 · time ×0.12 (median over 15 successful runs)
```

**Ledger tail (`.vend/runs.jsonl`), records 28–33 — read directly:**

| # | play | outcome | intervened | attested | target |
|---|---|---|---|---|---|
| 28 | propose-epic | **timed-out** | false | — | T-037 self-referential "run the sweep" |
| 29 | steer | success | _(none)_ | — | steer of vend (no intervention bit ⇒ not a carrier) |
| 30 | propose-epic | **success** | false | — | "Author `vend init`" |
| 31 | decompose-epic | **success** | false | — | E-040 |
| 32 | propose-epic | **success** | false | — | "Author `vend doctor`" |
| 33 | decompose-epic | **success** | false | — | E-042 |

**Reconciliation (all numbers tie out):**
- Forward sample = **8** reports. 7 untouched + 1 intervened (the lone E-026 real `intervened:true`).
- Of the 8 forward: records **30–33 are `intervened:false`+`success` = 4 CLEARED** forward-E1
  records (the first ever). The other 4 (priors) are **not cleared** — censored (`timed-out`) or the
  one intervention. Entering E-039 the forward baseline was **4/10, all censored** (T-037-03).
- Combined carriers = 8 forward + 13 attested = **21**; 20 untouched ⇒ `95% (20/21)`. **This combined
  figure is NOT a forward read** — citing it as forward is exactly the T-026-04 trap.

## What T-039-01 produced (the run this settles)

`work/T-039-01/sweep-log.md` + `review.md`: **cleared 2 pulls** — E-040 (`vend-init-scaffold`) and
E-042 (`vend-doctor-preflight`), each 2 stories + 4 tickets, `lisa validate` green. Propose casts
ran **93 s / 83 s**, past the **72,785 ms** wall that timed-out E-037 (×2). Clean P7
**wallet-exhausted** stop (367 k left, < next pull's price). Budget byte-identical to E-037
(`3600000,1000000`) so the 0→2 clear delta is attributable to E-038 alone.

**Two flagged warts (handed to this settle):**
1. **E-041 duplicate orphan** — `vend doctor` minted twice: E-041 (childless; verified **no**
   stories/tickets reference it, not in ledger) and E-042 (the decomposed, logged one). Overproduction.
2. **Self-referential #1** — the fresh steer board's top signal was again "run the sweep"; re-pointed
   at concrete demand. A ranker-quality follow-up, not a blocker.

## The standard to hold (E-014/E-026)

- `work/T-026-04/verdict.md` — the **over-count correction**: "of the 15 carriers, 13 are the
  back-fill … only 2 are genuine forward." Never dress the combined pool as forward.
- `work/T-037-03/verdict.md` — the immediate predecessor: **WATCHED, not confirmed**; 0-clear honest;
  go provisional + forward-leaning (4/10); named cadence + the named blocker (propose time-censor).
  E-039 is the test of whether E-038 cleared that exact blocker.

## Constraints

- **Read-only on source.** Gates already green this session (typecheck clean; 1020 pass / 0 fail).
- **`lisa` is on PATH** — `lisa validate` re-runnable after the E-041 deletion.
- **Do not over-claim.** The load-bearing non-goal: **no "forward-confirmed" off 2 cleared pulls.**
- **Forward-only citation discipline** — the verdict cites 88%/8 and the 4 cleared; the 95%/21 only
  to exclude it.
