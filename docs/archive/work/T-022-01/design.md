# T-022-01 — Design: semantic-equivalence-judge

Decisions, grounded in `research.md`. The house split is non-negotiable (the ticket
states it): a **pure aggregation core** (unit-tested) + an **impure judge harness** (not
unit-tested). The open questions are the verdict model, the classification rule, where the
judge casting lives, and how it reaches the N outputs.

## D1 — Verdict granularity: per-pair, not per-set

**Options.** (a) Per-pair verdicts `{ i, j, equivalent }` over every unordered pair of the
N signal outputs. (b) One per-set verdict (the model reads all N and emits a single
diversity/disagreement label). (c) Per-output cluster ids (the model groups outputs into
equivalence classes).

**Decision: (a) per-pair.** It mirrors `variance.ts`'s `PairDiff { i, j, distance }` —
the dispersion the judge sits beside is *already* a mean over unordered pairs, so a per-pair
equivalence verdict aligns one-to-one with the pairs dispersion reports, and the two reads
compose ("pair (0,2) diverged on lines AND the judge calls it genuine-disagreement"). It
also makes the pure aggregation a trivial, fully-testable tally (count equivalent pairs /
total pairs) with no clustering logic to get wrong. (b) collapses the evidence the ticket
wants (which pairs disagree) into one opaque label and gives the unit test nothing to
fixture but a single boolean. (c) (clustering) is strictly more machinery — equivalence
need not be transitive as a model judges it, so a clustering core would have to resolve
contradictions, scope this ticket does not ask for. Rejected (b)/(c) as over- and
under-powered respectively.

## D2 — Classification rule + score

A play's dispersion is judged across its `P = n·(n−1)/2` pairs. Let `e` = pairs judged
equivalent, `d = P − e` divergent.

- **Score** = `e / P` ∈ [0,1] — the *equivalence rate*. 1.0 = every divergence is mere
  rewording; 0.0 = every divergence is a real disagreement. Defined as **1 for P = 0**
  (zero pairs ⇒ vacuously all-equivalent, the `ratio(clean,total)=1` discipline from
  `rubric.ts`), never NaN.
- **Classification** (the three AC#1 fixtures map directly):
  - `e === P` (all pairs equivalent) → **`equivalent-diversity`**
  - `e === 0` (all pairs divergent) → **`genuine-disagreement`**
  - otherwise → **`mixed`**
  - `P === 0` (n < 2) → vacuously `equivalent-diversity`, but the report carries `n` and a
    formatter caveat so it never reads as a real win (D4).

This is a closed `as const` union `EQUIVALENCE_CLASSES = ["equivalent-diversity",
"genuine-disagreement","mixed"]` → derived type, the `PROBE_OUTCOMES` / `RUBRIC_DIMENSIONS`
idiom. A boolean per pair is enough; no thresholds to tune (a "70% equivalent ⇒ diversity"
cutoff was considered and rejected — it would invent a magic number the AC fixtures don't
ask for, and `mixed` is the honest label for any partial split).

## D3 — Where the judge casting lives: `dispense` directly, in the harness

**Options.** (a) Cast the judge as a `Play` through `castPlay`. (b) Call `dispense`
directly from the harness. (c) Add a BAML function + bridge for the judge.

**Decision: (b) `dispense` directly.** The judge has no parse/gates/effect/materialize —
it reads N strings and returns verdicts — so the `Play<I,O>` contract (render/parse/gates/
effect/budget/card) is a poor fit; forcing it through `castPlay` would mean inventing a
no-op effect and a fake card. The ticket literally says "reuse the **dispense seam**" —
`dispense` *is* that seam (`src/executor/claude.ts`), and `castPlay` itself is just a
composition over it. (c) BAML would add a `.baml` file, a generated client surface, and the
one-native-call-per-test-process constraint, for a render the model produces fine as free
text — over-engineering against "extend, don't break". So the harness builds a judge prompt
(the N outputs, each labelled by index, asked for a per-pair equivalence JSON), `dispense`s
it under the play's budget, parses the JSON reply into `EquivalenceVerdict[]`, and hands
that to the pure core. Parsing lives in the (untested) harness; it is tolerant (extract the
first JSON array, drop malformed entries) the way `parseStreamJsonLine` tolerates stream
noise.

## D4 — Honesty: the classification must not lie (IA-8)

Inherited verbatim from `consistency.ts` / `rubric.ts`. The pure `EquivalenceReport`
carries `n` (outputs judged), `equivalentPairs`, `divergentPairs`, `totalPairs`, the
`score`, and the `classification`. The formatter:
- leads with the classification + score,
- prints the pair tally (`e equivalent · d divergent of P`),
- appends `⚠ fewer than 2 outputs — classification vacuous` when `n < 2`, and
- appends `⚠ judge saw N outputs but M verdicts` if the harness handed in fewer verdicts
  than `P` (a truncated/garbled judge reply must not silently read as agreement) — the
  `formatConsistencyReport` "signal arm too small" caveat, transposed.

So a "diversity" verdict earned by the judge only managing to score one pair, or by there
being too few outputs, reads truthfully. This keeps the meter honest the way the ticket's
cited cores do.

## D5 — Reaching the N outputs: copy the seeding, don't import it

**Options.** (a) New standalone harness that COPIES the temp-root/seed/collect helpers from
`run-consistency-probe.ts` (the house instrument idiom). (b) Modify
`run-consistency-probe.ts` to export its helpers and import them. (c) Add an opt-in `--judge`
flag *inside* `run-consistency-probe.ts`.

**Decision: (a) copy into a new harness.** `run-consistency-probe.ts`'s own header (and
`run-probe.ts` before it) establishes that probe instruments **copy** their seeding helpers
so each stays self-contained and the cited file stays byte-for-byte unchanged — AC#3's
"extend, don't break" is then satisfied *trivially* (the existing instrument is not touched
at all). (b) would convert the cited instrument into a library (the exact anti-goal its
header calls out). (c) entangles the judge's live-cast cost into the dispersion sweep's
path, breaking the "existing path unaffected" promise. The new harness
(`run-equivalence-judge.ts`) reuses the *pattern* — `seedTempRoot`, `seedCharter`,
`seedBoardSnapshot`, `collectOutput`, a per-play `JudgeTarget` (a trimmed `ProbeTarget` for
expand/survey/steer) — and additionally computes the dispersion via `consistencyReport` so
it can print the judge classification **beside the existing dispersion number** (AC#2)
within one instrument run.

## D6 — Scope: expand / survey / steer

The ticket says "classify per play (expand/survey/steer)" — the three articulation plays
whose run-to-run divergence E-019/E-020 quantified. `decompose-epic` is out of scope for
the judge (it is the gated-vs-ungated probe's subject, not an articulation play). The
harness's `SUPPORTED` is therefore `["survey","expand","steer"]`, each seeding the real
charter + live board snapshot exactly as `run-consistency-probe.ts` does.

## What this buys

The dispersion number gains a *meaning* axis: a play can now report "high dispersion but
equivalent-diversity" (acceptable — it rewords) vs "high dispersion and genuine-disagreement"
(a real inconsistency the gates must bound) — the distinction E-022's articulation-consistency
contract is built on.
