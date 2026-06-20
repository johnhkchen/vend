# Findings — Articulation Consistency Contract (E-022, the *decide* half)

> One-page synthesis for T-022-02. The semantic-equivalence judge (`src/probe/equivalence.ts`
> + `run-equivalence-judge.ts`, T-022-01, `8edb71f`) adds a **meaning axis** to the consistency
> probe's line-set Jaccard dispersion: for a play's N divergent-but-valid outputs on a fixed
> input, is the divergence **equivalent-diversity** (same intent, reworded — fine) or
> **genuine-disagreement** (different proposed work — a real inconsistency)? This note captures
> the **consistency contract** the diagnosis lets us write, the per-play recommendation, and the
> human fork. **Small N → directional, not proof** (the E-014 discipline).
>
> **Structural caveat — the live judge sweep is the human step** (E-022 decomposition, verbatim).
> A full sweep is 9 play casts (250–400k tokens each) + 3 judge casts: ~30 min of
> non-deterministic, subscription-credit-spending casting, explicitly reserved for the human and
> flagged unproven-end-to-end in T-022-01's review. So this note carries **two epistemic tiers**:
> the contract's *spine* (validity-not-lexical) is already **evidenced** (E-014/E-020); the
> per-play **equivalence reads** are **recommendations the human sweep confirms or refutes**.

## TL;DR — the contract

**Vend promises gated validity, not lexical identity.** Every cast yields a valid, grounded,
gated output (the gates' job — the real promise, P3); repeated casts of the same input do **not**
promise the same *wording*. Whether the lexical divergence among valid outputs is acceptable is
decided **per play**:

- **expand → by-design (lean).** The grounded fragment pins the intent; divergence is most
  likely rewording of the same demand. Lowest stakes. Verify, don't converge.
- **survey → converge (lean) — load-bearing.** Survey drives IA-1's single recommended pull; if
  the *top* signal flips run-to-run, the product's spine erodes. The one play where
  genuine-disagreement would directly hurt.
- **steer → the human's call.** Highest dispersion (0.72) but inherently open — many *valid*
  framings of one direction can be diversity, or it can be flip-flopping. The genuine fork.

## The two axes (and who owns each)

| Axis | What it means | Owner | Status / evidence |
|---|---|---|---|
| **Validity consistency** | every cast is valid, grounded, gated (no garbage, no false-empty) | **the gates** (the real promise, P3) | **evidenced** — E-014: gates cut decompose variance ~21% (0.62→0.49); E-020: honest-empty over-fire *eliminated* (expand 33%→0%, survey 67%→0%) |
| **Lexical/content consistency** | repeated casts yield the *same wording / same proposed set* | **the contract decides per play** | the **0.50–0.72** dispersion; meaning-axis read is the equivalence judge's job — **pending the human sweep** |

The contract's whole point: **the first axis is the promise; the second is adjudicated, not
assumed.** Jaccard says outputs differ; it cannot say the difference matters. The judge fills
that gap; the contract rules on the answer.

## Per-play diagnosis + recommendation

Dispersion from the E-019 sweep (`work/T-019-02/findings.md`) as sharpened by E-020's re-run
(`demand.md:77`). The equivalence column is the **recommendation** (Design D3), pending the sweep.

| Play | Dispersion | What the output drives | Recommended class → verdict | The question the sweep answers |
|---|---|---|---|---|
| **expand** | **0.50** | one signal from one grounded fragment | `equivalent-diversity` → **by-design** | Do the N expansions propose the *same demand* (same scope/value-tier), just worded differently? |
| **survey** | **0.69** | the ranked board → **IA-1's #1 pull** | `mixed`/`genuine-disagreement` → **converge (lean)** | Does the *top-ranked* signal stay the same run-to-run, or does the recommended pull flip? |
| **steer** | **0.72** | a project direction | **human call** (`equivalent-diversity` *or* `genuine-disagreement`) | Are the N steers the *same direction* reframed, or *different* directions? |

**The verdict is not "high dispersion → converge."** Stakes and the output's role decide.
Steer's 0.72 may be *more* tolerable than survey's 0.69: many valid steers of one board are
legitimate diversity, whereas a survey whose #1 pull changes is disagreement that hits IA-1
head-on. That asymmetry is the substance of the contract — and exactly what the sweep tests.

## The fork (recommendation-first — the human's call)

The deciding gesture is the human's; the evidence and recommendation are ours (IA-5 /
E-018 fork-genuineness). Per play:

- **expand — recommend by-design.** *Assent ⇒* record "expand divergence is equivalent-diversity,
  accepted; no convergence lever." *Dissent (sweep shows genuine-disagreement) ⇒* pull the lever.
- **survey — recommend converge.** *Assent ⇒* mint the downstream convergence epic for survey
  (the lever, below). *Dissent ⇒* record by-design and say so. **This is the load-bearing call** —
  survey feeds the home's single recommendation.
- **steer — no recommendation; genuinely the human's.** The sweep's `equivalent-diversity` vs
  `genuine-disagreement` read *is* the decision input; until then the contract says "steer is the
  open fork," which is itself an honest output (the E-014 andon-at-the-roadmap precedent).

**The downstream lever (named, NOT built here — E-022 non-goal).** If "converge" is chosen for
any play, the *mechanism* is a separate downstream epic. Candidates to choose among there:
- a **canonical-form / normalization gate** (converge the output's structure before staging);
- a **consensus cast** (cast N, converge to the agreed core — the equivalence judge becomes a
  gate, not just a meter);
- **lowered sampling temperature** for the convergence-critical node.
This note mints none of them — minting waits on the converge assent (the human's gesture).

## The sweep protocol (the human step — run to fill AC#1 with live reads)

```bash
# expand — N=3 on the fixed grounded fragment (250k/cast default):
bun run src/probe/run-equivalence-judge.ts expand docs/active/work/T-019-02/fixtures/grounded-fragment.txt 3
# survey — N=3 on the live board snapshot (300k/cast):
bun run src/probe/run-equivalence-judge.ts survey 3
# steer — N=3 on the live board snapshot (400k/cast):
bun run src/probe/run-equivalence-judge.ts steer 3
```
Each seeds a disposable temp root (`mkdtemp` → `lisa init`), copies the live charter + board in,
casts N× into a temp ledger (no real `.vend/runs.jsonl` or board pollution), prints the
`formatConsistencyReport` dispersion line, then casts the judge and prints
`semantic equivalence: <class> (score X.XX)` **beside** it. **Tee each to
`docs/active/work/T-022-02/sweep-logs/<play>.log`** so the live reads land logged beside this
synthesis (no silent caps — IA-8). Read each `<class>` against the recommendation above:
agreement confirms the contract; a surprise (e.g., expand → genuine-disagreement, or steer →
clean equivalent-diversity) re-opens that play's fork with the live datum.

## Honest about the sample

- **The equivalence reads are recommendations, not measurements.** Per Design D1, the live sweep
  is the human step; nothing in this note is a logged judge classification. The reasoning is from
  *what each play's output drives*, not from a run.
- **The by-design recommendations are the *less* certain ones.** "Accept the divergence" is a
  claim the sweep could refute with a single genuine-disagreement pair; "converge" is the safer
  default under uncertainty. Survey's converge-lean and steer's open-fork reflect this.
- **The contract spine is solid; the per-play leaves are directional.** *Validity-not-lexical* is
  grounded in E-014 + E-020 (measured) and `vision.md` (the stated promise). The per-play
  converge/by-design split rests on N=3 dispersion + reasoning about stakes — directional.
- **One repo, one model, one environment, run-to-date.** Same limits as E-019. A directional
  steer from honest evidence beats a confident guess from none — but it is a steer (charter
  P-rationale).

## Citations

- Instrument: `src/probe/equivalence.ts` + `run-equivalence-judge.ts` + `equivalence.test.ts`
  (T-022-01, `8edb71f`); its handoff `work/T-022-01/review.md`.
- Dispersion evidence: `work/T-019-02/findings.md` (E-019 sweep, expand 0.50 / steer 0.72);
  E-020 proof (`demand.md:75,77` — survey 0.69 measurable post-over-abstention-fix).
- Validity axis: E-014 (`demand.md:70`, ~21% variance cut) + E-020 (honest-empty eliminated).
- The promise: `vision.md` §"The deeper promise: consistency" (lines 64–73).
- The contract lands: `information-architecture.md` **IA-17** (this ticket); the bridge:
  `demand.md` E-022 row (~77).
- Discipline: findings-note shape + honest-sample from `work/T-014-03/findings.md` (E-014).
