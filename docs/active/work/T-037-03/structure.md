# T-037-03 — Structure (settle-the-evidence-and-verdict)

The blueprint for settling T-037-02's watched run into honest evidence. This is a
**docs/evidence** ticket: it reads the ledger the sweep wrote and renders a verdict held to the
E-014/E-026 standard (don't dress an unverified claim as measured). **No source changes** — same
shape as T-037-01 (read the instrument, write the finding). Starting at the `structure` phase
(research + design folded in at planning, the T-037-02 pattern); the codebase facts below stand in
for Research, the chosen verdict framing for Design.

## What reality forced (the pivot the authoring frontmatter could not see)

The ticket was authored **expecting the sweep to clear ≥1 pull** — it asks for the "new forward
rate," the delta of "genuine forward records the sweep added (each `--no-intervened` chain that
cleared = one)," and a quality read of "the autonomously-minted epic+tickets." **The sweep cleared
0** (`work/T-037-02/sweep-log.md`): a clean P7 `andon: timed-out`, reproduced twice, **nothing
minted**. So the structure must settle an **honest 0-clear**, not a clearance:

- The forward count **did** move — but on **censored** records, not cleared ones.
- There is **no minted card to assess** for quality — the quality question reframes to the integrity
  of the *watched machinery*, which is the real thing that became live.
- The "no over-claim" non-goal is therefore **even more load-bearing** than at authoring: it would be
  doubly wrong to call a 0-clear "forward-confirmed."

## The numbers (measured this session — `bun run src/cli.ts audit`, 2026-06-20)

Verbatim forward-only read (NEVER the combined 16/17):

```
    └ forward (live): 75% (3/4 untouched) · attested back-fill: 100% (13/13 untouched)
```

| Quantity | Authoring baseline | Post-sweep (now) | Source |
|---|---|---|---|
| forward (live) walk-away | **50% (1/2)** | **75% (3/4)** | `auditWalkAway` forward sub-stat |
| forward sample (≥10 bar) | **2/10** | **4/10** | T-026-04 corrected base + 2 |
| genuine forward records added | — | **+2** (ledger #27, #28) | `.vend/runs.jsonl` |
| of those, *cleared* successes | — | **0** (both `timed-out`) | sweep-log receipt |

The +2 are forward (`intervened:false`, no `intervenedAttested`) so `auditWalkAway` files them as
forward — they raise the numerator/denominator (1/2 → 3/4) — **but they are right-censored
(`timed-out`)**, not cleared pulls. The walk-away rate measures *the author didn't step in*, not
*work cleared*. That distinction is the whole verdict.

## Files

| File | Action | What |
|---|---|---|
| `docs/active/work/T-037-03/verdict.md` | **create** | The honest verdict (deliverable). |
| `docs/active/work/T-037-03/{structure,plan,progress,review}.md` | create | RDSPI artifacts. |
| `docs/active/demand.md` | **modify** | Frontier 1 crystallized honestly (watched + evidence moved + what remains). |
| `src/**` | **none** | Pure read of the ledger. No code touched. |

## `verdict.md` shape (the contract it must satisfy)

1. **Headline** — the gesture is now **watched** (P4/P7 demonstrated *live*, not just wired):
   wallet bounded the spend, andon fired cleanly, receipt truthful, zero partial state. This is the
   real graduation: "coded-green but never demonstrated" → **demonstrated**.
2. **Forward-E1 moved — forward-only, with the censored caveat.** 1/2 → 3/4; sample 2/10 → 4/10;
   cite forward-only, never 16/17 (the T-026-04 trap, quoted as the standard).
3. **Quality read** — honest: **no minted card to assess** (0-clear). What *was* demonstrated with
   integrity: P7 held (clean stop, truthful receipt, nothing partial); **auth==exec held** (E-025 —
   ran under exactly its authorized time budget, 0 tokens debited under price). A walk-away that
   clears junk isn't trust — here it cleared *nothing*, honestly; clear-quality stays **undemonstrated**.
4. **The call** — **go stays provisional + forward-leaning.** 4/10, NOT ≥10. Explicit **no
   "forward-confirmed"** off a 4-sample (two of which are censored). Named cadence to ≥10 below.
5. **Named cadence + the surfaced blocker.** Each future `--no-intervened` sweep accrues forward
   records. BUT a real finding gates the cadence: `propose-epic`'s measured **72,785 ms** per-step
   envelope censors the board's top signal *before it can mint*. The cadence needs either a
   `recalibrate` widening for heavy propose signals or a lighter top signal — named, not hand-waved.

## `demand.md` Frontier 1 edit (surgical, honest)

The In-flight row + the Frontier 1 signal both say "off its 1/2 floor" / "2/10 genuine forward
records." Update to: keystone now **watched** (feature demonstrated live, P4/P7), forward moved
**1/2 → 3/4 (sample 2/10 → 4/10)** on real but **censored** evidence, and name what remains to fully
ungate (the ≥10 cadence + the `propose-epic` time-censor to clear). Do **not** mark cleared — it is
not. Keep it lean (one-line discipline of the board).

## Citation discipline (the gate this ticket is really about)

- **Always** cite forward-only (3/4, sample 4/10). **Never** the combined 16/17 / 94%.
- Quote T-026-04's correction as the standard being held, not re-litigated.
- "watched" ≠ "confirmed": live P4/P7 demonstration is real and new; it does **not** convert the
  provisional go to confirmed. Two separate claims, kept separate.
