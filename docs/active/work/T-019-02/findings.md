# Findings — Articulation Consistency Probe (E-019, the *validate* half)

> One-page synthesis of a bounded, cost-aware sweep (T-019-02). The consistency probe
> (`src/probe/run-consistency-probe.ts`, T-019-01) cast **expand / survey / steer** N=3× each on a
> **fixed, grounded** input at the plays' **real recalibrated budgets**, gates ON. Evidence, not a
> roadmap. Small N → **directional, not proof** (the E-014 discipline). Live logs:
> `sweep-logs/{expand,survey,steer}.log`.

## TL;DR — the verdict

**Articulation-play consistency is NOT yet acceptable — tune the gates. E-016 finding (2) is
confirmed and generalized: all three plays are run-to-run inconsistent on a fixed grounded input,
in two distinct failure modes.** (1) The **honest-empty gate over-fires** — survey abstained on
**2 of 3** casts of a demand-rich board (67%) and expand abstained on **1 of 3** casts of a real,
evidenced fragment (33%); both are **false negatives on grounded input** (over-eagerness, exactly
as E-016 flagged). (2) The **signal content diverges run-to-run** — the signals that *did* land
disagree at dispersion **0.50** (expand) and **0.72** (steer); the gates censor but do not bound
output dispersion. **Budgets are vindicated**, not implicated: **zero** genuine budget-exhaustion
across all 9 casts — the E-018 recalibration held. *Unmeasured is not weak — but this is measured,
and it is inconsistent.*

## The numbers (one fenced report + raw tally per play)

**expand** — fixed grounded fragment (`fixtures/grounded-fragment.txt`, a real observability gap):
```
run-to-run signal dispersion: 0.50 over 2 (signal 2 · honest-empty 0 · budget-exhausted 1 (of 3); honest-empty rate 0%)
raw run-log outcomes: gate-failed 1 · success 2
  1/3: gate-failed → budget-exhausted   (andon: gate 'honest-empty' — "the fragment grounds no demand … (IA-4)")
  2/3: success → signal
  3/3: success → signal
```
*Read per design D4:* expand abstains by **STOPPING** (honest-empty ⇒ `gate-failed`), so the
classifier folds it into `budget-exhausted` — the headline mix's `honest-empty 0%` is an artifact.
The **true** read off the raw tally: **honest-empty (over-eager) = 1/3 (33%)**, signal = 2/3,
genuine budget-exhaustion = **0**. The honest-empty *looked over-eager* in the literal E-016 sense:
the gate declared "the fragment grounds no demand" about a fragment that **demonstrably grounds real
demand**. And the two signals that landed **disagree at 0.50** — same topic-slug, divergent content.

**survey** — fixed live board snapshot (21 stories / 49 open tickets / 4 staged signals — grounded):
```
run-to-run signal dispersion: 0.00 over 1 (signal 1 · honest-empty 2 · budget-exhausted 0 (of 3); honest-empty rate 67%) — ⚠ signal arm too small to disperse
raw run-log outcomes: success 3
  1/3: success → honest-empty   (staged the "# Survey — no demand staged" marker)
  2/3: success → signal
  3/3: success → honest-empty
```
**honest-empty rate = 67%** read directly off the mix (survey abstains by CLEAR+marker, a
`success`). On a demand-rich board the correct outcome is to stage signals, so 2/3 abstentions are
false negatives. The outcome **flips run-to-run** (HE / signal / HE) on the *identical* board — the
inconsistency itself, independent of which polarity is "right." The signal arm (n=1) is too small to
read content dispersion — its consistency is **unmeasured**, not clean.

**steer** — fixed live board snapshot (same grounded board):
```
run-to-run signal dispersion: 0.72 over 3 (signal 3 · honest-empty 0 · budget-exhausted 0 (of 3); honest-empty rate 0%)
raw run-log outcomes: success 3
  1/3: success → signal   2/3: success → signal   3/3: success → signal
```
Steer is **outcome-stable** (always staged a signal — no over-eager abstention, 0% honest-empty)
but **content-unstable**: the staged `steer.md` diverges at dispersion **0.72**, the *highest* of
the three. A different failure mode from survey/expand: not over-eagerness, but high run-to-run
content variance — the read changes a lot cast to cast.

## The decision

**Verdict: tune the gates / not-acceptable.** The 3-branch rule (per play, design D5):

| Play | Signal state | Verdict | Concrete next pull |
|---|---|---|---|
| **survey** | honest-empty **67%** on grounded board | **gates over-fire** | mint demand.md signal: *tune the honest-empty gate — it abstains on demand-rich input* |
| **expand** | honest-empty **33%** + signal dispersion **0.50** | **gates over-fire AND under-bind** | same honest-empty tune + *bound expand's signal dispersion* |
| **steer** | signal dispersion **0.72**, 0% honest-empty | **gates under-bind** | mint demand.md signal: *strengthen the steer consistency gate (or accept divergence as by-design and say so)* |
| _budgets (all)_ | **0** budget-exhaustion in 9 casts | **acceptable** | none — the E-018 recalibration is **validated**; do not re-tune budgets |

**Next pull now (the demand.md bridge, AC#3).** Two sibling signals for `demand.md` (the
`pm/staged/` row shape), each with its pull string:

1. **Honest-empty gate over-fires on grounded input** — survey 67% / expand 33% false-negative
   abstention on real demand. *Value: High (the consistency promise, P3; honest-empty is the IA-4
   gate the whole shelf leans on). ~1 block. ready (advances [P3] · grounded in demand.md E-016
   finding (2) + T-019-02 sweep).*
   `vend chain "honest-empty gate over-fires on grounded input — survey 67%/expand 33% false-negative abstention; tighten the abstention threshold so it fires only on genuinely thin input"`

2. **Articulation signal dispersion unbounded run-to-run** — expand 0.50, steer 0.72; the gates
   censor but don't converge content. *Value: High (consistency IS the value prop). ~1 block.
   ready (advances [P3] · grounded in T-019-02 sweep).*
   `vend chain "bound run-to-run signal dispersion for articulation plays — steer 0.72/expand 0.50 content variance; decide whether the consistency gate should converge output or whether divergence is by-design, and gate accordingly"`

A **third, instrument-level** kaizen signal (design D4, self-referentially *also* what the expand
fragment described): **thread the structured stop-reason onto `RunSummary`/the run record** so the
probe and `vend audit` can split honest-empty from budget-exhausted for STOP-style plays
(expand/decompose) — today it is stdout-only and the probe had to recover it from the raw tally.

The macro-level E-019 row in `demand.md` updates with: `Status (T-019-02): sweep done — articulation
consistency NOT yet acceptable; honest-empty gate over-fires (survey 67%/expand 33% on grounded
input) + signal dispersion unbounded (steer 0.72/expand 0.50); budgets vindicated (0/9 exhausted).
Tune-the-gates branch → 2 staged signals above.`

## Honest about the sample

This is a **directional steer, not a proof.** **N=3 casts per play**, **one fixed input per play**,
**one environment** (this repo, subscription auth), **one model**, run once. Specific limits:
- **expand's honest-empty is read from the raw `gate-failed` tally, not the headline mix** (the D4
  instrument blind spot for STOP-style plays) — so its 33% is a hand-folded number, not a clean
  bucket. Kaizen signal #3 above fixes this.
- **survey's signal arm is n=1** — its content dispersion is **unmeasured**; we know its *outcome*
  is unstable (HE/signal/HE) but not whether its rare signals agree.
- **Groundedness is crisp for expand** (an authored, evidently-grounded fragment) but **fuzzier for
  survey/steer**: a 49-ticket board *could* legitimately read as "saturated → nothing new to
  stage," so survey's 67% honest-empty is partly an over-eagerness signal and partly a defensible
  "the board is well-captured" read. The **run-to-run flip** on identical input is inconsistency
  *regardless* of which polarity is correct — that part is unambiguous.
- A directional steer from one honest sweep beats a confident guess from none (charter P-rationale)
  — but it is a steer. Read the verdict as "the gates did **not** hold consistency on this input,"
  not "the gates are proven broken." The next pull is the **gate-tuning** signals, then a re-sweep.

## How to produce the numbers

```bash
# expand — N=3 on the fixed grounded fragment (its real 250k/cast budget):
bun run src/probe/run-consistency-probe.ts expand docs/active/work/T-019-02/fixtures/grounded-fragment.txt 3
# survey — N=3 on the live board snapshot (300k/cast):
bun run src/probe/run-consistency-probe.ts survey 3
# steer — N=3 on the live board snapshot (400k/cast):
bun run src/probe/run-consistency-probe.ts steer 3
```
Each seeds a disposable temp root (`mkdtemp` → `lisa init`), copies the live charter + board in, casts
into a temp ledger (no real `.vend/runs.jsonl` or board pollution), and prints the
`formatConsistencyReport` line + the raw `RunOutcome` tally. To raise N or cap tokens:
`… <play> [input] [N] [tokenBudget]`.

## Citations

- Harness + pure core: `src/probe/run-consistency-probe.ts`, `src/probe/consistency.ts` (T-019-01,
  commit `f8146f5`); reuses `src/probe/variance.ts`'s `dispersion`.
- Prior tested: **E-016 finding (2)** — `docs/active/demand.md:71` (3 casts → 3 outcomes; honest-empty
  looked over-eager). Confirmed + generalized here.
- Findings-note shape + honest-sample discipline: `docs/active/work/T-014-03/findings.md` (E-014).
- IA-4 honest-empty: `docs/knowledge/information-architecture.md:66-68`; fork-genuineness gate:
  `docs/active/epic/E-018.md:90`; IA-8 no-silent-caps: `…/information-architecture.md:99-104`.
- The demand.md bridge: `docs/active/demand.md:74` (E-019 row); staged-signal shape:
  `docs/active/pm/staged/steer.md:11`.
- Sweep evidence: `docs/active/work/T-019-02/sweep-logs/{expand,survey,steer}.log`.
