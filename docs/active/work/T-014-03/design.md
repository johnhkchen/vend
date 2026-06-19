# T-014-03 — Design

The deliverable is a one-page findings note that returns the epic's go / reroute decision.
Research established the hard reality: **both instruments are built and green, but neither
number is populated yet** — the ledger carries zero `intervened` self-reports and no E2
sweep has run. The central design question is therefore not "how to format two numbers" but
**"what does an evidence gate honestly return when the evidence has not yet been
collected?"**

## The tension

AC2 demands an **explicit go / reroute recommendation**. AC1 demands the **two numbers**.
AC3 demands **honesty about limits**. Today the numbers don't exist. A naive note would
either (a) fabricate a green by over-reading the contaminated andon rate, or (b) refuse to
recommend anything. Both fail the charter's IA-8 ("the meter must not lie") and the PRD's
purpose ("decide on evidence, not assumption"). The design must thread between them.

## Options for the recommendation

### Option A — Force a verdict from current data
Read the observable andon rate (40–50% vs 10% budget, "over") as E1-weak and recommend
reroute to andon UX now. **Rejected.** The andon rate is contaminated by deliberate
failure-test epics (E-900/E-901); reading it as a trust signal is precisely the "confident
guess" the PRD exists to prevent. The walk-away rate — the actual A2 signal — is
*unmeasured*, not weak. Calling unmeasured "weak" is dishonest.

### Option B — Decline to recommend until data exists
Write "insufficient data, come back after the sweep." **Rejected.** AC2 is explicit, and a
gate that returns nothing is not a gate. The decision rule is knowable now even if the
numbers aren't; the note must still *return* something actionable.

### Option C — Return "HOLD" as the honest verdict, with a populated decision rule (CHOSEN)
The fourth state the rule implicitly has: **not-yet-green**. The note returns an explicit
recommendation — **HOLD the macro-wallet; do not green-light**; the gate is *not satisfied*
because the evidence has not been collected — and names the concrete next pull: **run the
measurement sprint** (cast ≥10 runs with `--intervened`/`--no-intervened`; run the 5×2
`run-probe.ts` sweep), then re-apply the rule. This is a real go/reroute output (it is "not
go"), it is honest about *why* (unmeasured ≠ weak), and it keeps the decision rule wired so
the next session reads green/weak directly off populated instruments.

**Why C is correct, not a cop-out:** the PRD's whole thesis is "don't build on unproven
assumptions." The macro-wallet is *already gated* in demand.md pending a **go** verdict.
"Not go" is the safe default and the correct one until measured — HOLD *is* the evidence-
based decision when the evidence says "not yet collected." The note's value is making that
explicit and pre-wiring the rule so the sprint's output is a two-line read, not another
synthesis cycle.

## What the note states (mapping to ACs)

1. **Two numbers, one paragraph each (AC1):** state each number *and its current state*.
   - E1 walk-away/intervention trend: **unrecorded** — instrument live, 0/10 records carry
     the bit; quote the `vend audit` fragment verbatim; note the andon rate is observable
     but contaminated and not a trust read.
   - E2 gate-driven variance reduction: **not yet measured** — `run-probe.ts` ready, sweep
     not run; explain what it will report and its censoring caveat (T-014-02 concern #1).
2. **Explicit go / reroute (AC2):** **HOLD / not-go.** Then the rule for each branch *once
   the numbers land*, and the concrete next pull each implies:
   - E1+E2 green → un-gate the macro-wallet (demand.md) — *trust capitalized*.
   - E1 weak → promote andon-UX / design-language signal above the wallet.
   - E2 weak → promote the core consistency-promise fix above all autonomy.
   - **Now (unmeasured)** → the next pull is the **measurement sprint itself** (the human
     sweep gestures), not any build.
3. **Honesty about the sample (AC3):** one self-reporting user, ≤5 casts/arm, one epic,
   contaminated andon sample — a directional signal, never a proof. State it plainly.
4. **`check:*` green (AC4):** no code change; the suite is green (467 pass, typecheck
   clean — confirmed this phase). The note records that producing the numbers is the human
   sweep step, exactly as AC4 frames it.

## The bridge (design decision: edit demand.md or not?)

`demand.md` already gates the macro-wallet on "E-014's go verdict." Two choices:
- **Edit demand.md now** to record "HOLD — measurement sprint is the next pull."
- **Reference it from findings.md only**, leaving demand.md's existing gate line intact.

**Chosen: a light touch on demand.md** — append a one-line status to the macro-wallet's
"⚠ Gated by E-014" note pointing at the findings and the measurement-sprint next pull. The
ticket Context says the note "bridges back to demand.md — the decision re-ranks the next
pull," so the bridge must be visible on the board, not buried in a work artifact. Kept to
one line to avoid overproducing inventory (demand.md's own discipline).

## Rejected scope (anti-creep)

- **Running the sweep inside this ticket.** It spawns `claude` live (cost, fat-tailed),
  which is the *human* sweep gesture by PRD design — not an autonomous step. The note
  documents the rule; it does not perform the measurement.
- **Casting 10 `--intervened` runs to populate E1.** Same reason — the measurement sprint
  is downstream, human-gated work, explicitly out of this ticket's ≤5-cast envelope.
- **Any new analysis code.** The formatters already produce honest fragments; the note
  composes them.
