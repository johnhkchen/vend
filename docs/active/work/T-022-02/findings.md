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

## Live sweep results (2026-06-19) — the human step, run

The equivalence sweep ran (`run-equivalence-judge.ts <play> 3`, disposable temp ledgers, logs in
`sweep-logs/`). It **resolves the fork with data** — and overturns two of the three recommendations:

| Play | Jaccard dispersion | Judge class | Score | Recommendation was | **Measured verdict** |
|---|---|---|---|---|---|
| **expand** | 0.50 | **equivalent-diversity** | 1.00 (3/3 pairs equiv) | by-design | **by-design ✓ confirmed** |
| **survey** | 0.68 | **genuine-disagreement** | 0.00 (0/3 pairs equiv) | converge-lean | **converge — confirmed, hard** |
| **steer** | 0.80 | **equivalent-diversity** | 1.00 (3/3 pairs equiv) | human's call | **by-design ← surprise** |

**The headline: dispersion magnitude did not predict meaning.** Steer — the *highest* lexical
dispersion (0.80) — is *pure equivalent-diversity*: three valid framings of the same direction.
Survey — *lower* dispersion (0.68) — is *pure genuine-disagreement*: 0/3 pairs agree. The Jaccard
number is necessary but **not sufficient**; the meaning axis (the judge) is what the contract
needed — which is exactly the case for having built T-022-01. The findings' own asymmetry
prediction ("steer's 0.72 may be *more* tolerable than survey's 0.69") is vindicated emphatically.

Corroborations worth noting: expand staged the **identical filename** on casts 1 and 3
(`thread-castplay-s-structured-stop-reason-gate-name-unit-or-s.md`) — same intent, near-verbatim;
strong independent support for the judge's 1.00.

**Honest nuance on survey (the sharp sub-question the whole-board judge does *not* isolate).** The
judge compared **whole boards** and found them genuinely different rankings (0/3). But the
contract's *specific* concern is narrower: **does the #1 recommended pull flip?** A board can
disagree in the *tail* while agreeing on the *head*. The one surviving board's #1 was the obvious
keystone ("Scaffold the Bun/TS project — src/** is empty against 62 tickets"), which a reasonable
survey would pick every time. So the live read establishes **survey boards disagree as full
rankings**; whether the *load-bearing #1 pull* itself is unstable is a sharper question — and the
first job of any downstream survey-convergence epic is to **measure head-vs-tail disagreement
before building a lever** (you converge what's actually unstable, not the whole board).

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
E-018 fork-genuineness). **The sweep has now run, so each fork carries its live datum:**

- **expand — by-design, confirmed.** Sweep: `equivalent-diversity` (1.00). Record "expand
  divergence is equivalent-diversity, accepted; no convergence lever." *Fork closed by evidence.*
- **survey — converge, confirmed (hard).** Sweep: `genuine-disagreement` (0.00) — the boards
  genuinely differ run-to-run. The recommended human gesture: **assent ⇒ mint the downstream
  survey-convergence epic** (the lever, below), whose *first* slice measures head-vs-tail (does the
  #1 pull flip, or just the tail order?) before building anything. **The load-bearing call** —
  survey feeds the home's single recommendation (IA-1).
- **steer — by-design, resolved by surprise.** Sweep: `equivalent-diversity` (1.00) *despite* the
  highest dispersion (0.80). The open fork the contract left for the human **closes toward
  by-design with live evidence**: many valid framings of one direction are legitimate diversity,
  not flip-flopping. No convergence lever for steer.

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

- **The equivalence reads are now measured (N=3), not just reasoned.** The live sweep ran
  (`sweep-logs/`); each per-play class is a logged judge classification over 3 casts on a fixed
  input. Still **N=3 → directional, not proof**: three casts is a small sample, one judge, one
  model. A 9-cast or 5×-judge re-run could shift a borderline read — though 1.00 / 0.00 / 1.00 are
  unambiguous, not borderline.
- **The whole-board judge over-counts survey's problem for the contract's purpose.** It scored
  *full-ranking* disagreement; the contract cares about *#1-pull* stability. So "survey → converge"
  is sound for board-ranking, but the lever's first job is to isolate whether the head or only the
  tail is unstable (above). Don't converge what isn't actually moving.
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
