# T-023-02 — Design: converge-or-accept-the-head

> Options, tradeoffs, decisions — grounded in Research. The spine of this ticket is a **measurement
> that picks the branch**, so the central design work is (a) the sweep protocol, (b) the decision
> rule that maps the verdict to a warranted path, and (c) the shape of each branch. Honest about the
> sample (IA-8): the verdict decides, but the decision rule and both branches are designed *up front*
> so the path is taken on evidence, not improvised after seeing the number.

## D1 — Use the shipped instrument as-is; do not modify the head read to measure

**Decision:** Run `run-equivalence-judge.ts survey` unchanged to obtain the head verdict. Do **not**
add new measurement code.

**Why:** T-023-01 already wired `surveyTarget.extractHead = topPick` and the head block in `main()`,
which prints both the `[lexical exact-match]` and `[semantic judge]` head reads beside the whole-board
dispersion. The measurement is a *run*, not a *build*. Rejected: adding a survey-specific head CLI or
re-deriving the parse — that would duplicate a tested, committed instrument (the self-contained
instrument idiom; AC#3 of T-023-01 kept the consistency path byte-for-byte). The only place code is
written is the head-flips branch's lever.

## D2 — The sweep protocol: N=3, survey budget, logged, disposable

**Decision:** `bun run src/probe/run-equivalence-judge.ts survey 3 2>&1 | tee
docs/active/work/T-023-02/sweep-logs/survey-head.log`. N=3 (the ticket's lower bound), survey's
default 300k/cast budget, teed to the work dir (no silent caps — IA-8).

**Why N=3, not 5:** the ticket says N≈3–5, cost-aware. N=3 matches the E-022 precedent (so the head
read is directly comparable to the 0.00 whole-board datum from the *same* sample size), costs ~5 min,
and 3 boards already yield 3 head-pairs — enough to read stable (3/3) vs flips (0/3) vs mixed. A
larger N buys precision the small-sample caveat says we cannot honestly claim anyway. The **re-sweep
for lever verification** (AC#3, only on head-flips) is a second N=3 run on the converged board.

**Tradeoff accepted:** N=3 is a small sample. Mitigated by reading **both** the lexical and semantic
head lines (agreement across the two raises confidence; divergence is itself informative) and by
recording the verdict as directional (IA-8), exactly as the E-022 findings did.

## D3 — The decision rule (the heart of the ticket)

The two head reads the harness prints (`[lexical exact-match]`, `[semantic judge]`) classify into
`head-stable | head-flips | mixed`. The **semantic** read is authoritative (two #1 picks worded
differently can be the same pull — IA-17); the lexical line corroborates. Decision rule:

| Semantic head verdict | Warranted path | IA-17 amendment | Build? |
|---|---|---|---|
| **head-stable** | **accept** | survey divergence is *tail-re-ordering by design*; the **#1 pull is consistent**; "converge" downgraded with evidence | none |
| **head-flips** | **converge** | survey *converged at the head* — judge-as-gate, the lever's measured effect | consensus-cast lever (bounded) |
| **mixed** | **directional accept-lean** (see D6) | record the partial split honestly; recommend (IA-5) accept unless the human judges the instability load-bearing | none by default |

The rule is fixed **before** the run so the path is warranted by the measurement, not chosen to suit
it (the E-022 fork discipline). Both branches are designed below; only one is executed.

## D4 — head-stable branch: accept (amend IA-17, write findings, no build)

**What:** Amend IA-17's survey clause from "converge" to *tail-divergence-by-design — the #1 pull is
consistent run-to-run; the ranking below it is not promised.* The whole-board `genuine-disagreement`
0.00 stays true (boards do differ as full rankings) but is **re-scoped**: it measured the tail, not
the load-bearing head. The contract gets *more precise*. Record the verdict (both head lines + the
whole-board context) in `findings.md`. No lever — you don't converge what isn't moving (the findings'
own warning: "Don't converge what isn't actually moving").

**Why this is the likely path:** the E-022 findings already noted the one surviving board's #1 was
the obvious keystone scaffold pull — a project with `src/**` empty against 62 tickets has one
overwhelmingly correct #1. But "likely" is not "measured"; D3 holds whatever the run says.

## D5 — head-flips branch: converge (the consensus-cast lever, bounded)

**What (only if the head flips):** Build the **consensus-cast convergence**, split per the house
pattern:
- **PURE core** (`src/probe/consensus.ts` or `src/play/survey-consensus-core.ts`, name fixed in
  Structure): given N boards' extracted heads + the per-pair head-equivalence verdicts, select the
  **agreed top-ranked signal** (the modal/plurality head among equivalent clusters) and return the
  consensus #1 + a confidence. Unit-tested on fixtures (unanimous → that head; plurality → the modal
  cluster's head; no majority → honest "no consensus"). Reuses `EquivalenceVerdict` clustering.
- **Impure harness** (extend `run-equivalence-judge.ts` or a sibling `run-consensus.ts`): cast survey
  N×, use the equivalence judge as a **gate** (not just a meter) to cluster the heads, select the
  consensus, and **stage a single consensus board** whose #1 is the agreed pull. Not unit-tested.
- **Measure the lever's effect** (AC#3): re-sweep the consensus board's head N× and confirm it is now
  stable — no unmeasured claim of success. Amend IA-17 to "survey converged at the head" with the
  measured before/after.

**Why deferred to the branch:** the lever is real work (~a ticket's worth). Building it before the
head is known to move would violate measure-then-decide and the E-022 non-goal ("minting waits on the
converge assent"). The instrument exists precisely so we build the lever only if warranted.

## D6 — `mixed` and abstention edges

- **mixed** (some head-pairs agree, some flip, or all-agree-but-short-of-coverage): the honest read
  is "the head is *partially* unstable." Per IA-5 (recommend-never-auto) and the small-N caveat, the
  **recommendation** is accept-lean (record tail-divergence-by-design *with* the mixed caveat,
  flagging the head as not-fully-settled) rather than auto-building a lever on a partial N=3 signal —
  but surface it recommendation-first so the human can call for the lever if they judge the
  instability load-bearing. This keeps the ticket honest without over-building on a weak sample.
- **abstention / `n<2`** (casts abstain or budget-exhaust, leaving <2 signal boards): the head read
  is vacuously `head-stable` and the formatter caveats it. This is **not** a real stability result;
  findings must say so and the path is "re-run with more budget," not "accept." The harness's
  `verdictsSeen < totalPairs` caveat surfaces a short judge reply the same way.

## D7 — Output is recommendation-first (IA-5), honest about the sample (IA-8)

`findings.md` leads with the **measured verdict + the warranted path as a recommendation**, the
deciding framing left to the human (IA-5 / E-018 fork-genuineness). It carries the honest-sample
block verbatim in spirit from `work/T-022-02/findings.md`: N=3 → directional, one model, one repo,
run-to-date. No unmeasured claim of success; if a lever is built, its before/after re-sweep is the
only basis for "it worked."

## Rejected alternatives

- **Skip the run; accept on the E-022 anecdote.** Rejected: AC#1 requires the sweep to *run* and the
  verdict to land in a findings note. The anecdote is a hint, not a measurement.
- **Build the consensus lever unconditionally** (so the ticket "ships a feature"). Rejected:
  violates measure-then-decide and the IA-17 "isolate before building" instruction; wastes a ticket
  if the head is stable.
- **N=5 for a stronger sample.** Rejected as the default: cost-aware lower bound first; the honest
  caveat dominates either way, and N=3 is directly comparable to the E-022 whole-board datum. (N=5 is
  available as a follow-up if the read is borderline.)
