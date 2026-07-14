# Design — T-022-02: consistency-contract-and-fork

Four decisions, each grounded in Research. The ticket's product is a *decision + a captured
contract + a surfaced fork*, not a mechanism — so the design space is mostly about how to be
honest under a small sample and where the human's call sits.

## D1 — How the sweep runs: human step, not autonomous burn

**Options.**
- (a) Run the full live sweep now (9 play casts + 3 judge casts) and report real
  equivalence reads.
- (b) Run a scaled-down live sweep (one play, N=2, capped tokens) for one real datapoint.
- (c) **Treat the live sweep as the human step** (per E-022's decomposition): document the
  exact protocol, and synthesize the contract + per-play recommendation from the existing
  measured evidence, honest that the equivalence *classification* is the recommendation the
  human sweep confirms.

**Decision: (c).** E-022's decomposition names this verbatim — *"the live judge sweep is the
human step."* The sweep is ~30 min of non-deterministic, subscription-credit-spending agent
casts; T-022-01's review independently flagged the harness as unproven end-to-end and out of
CI. Autonomously burning it would also pre-empt the very gesture the epic reserves for the
human. (b) is rejected because a single capped datapoint is *less* honest than no datapoint —
a too-small token budget forces budget-exhaustion and contaminates the read, and one play's
N=2 can't ground a three-play contract. (a) is rejected on cost discipline + the explicit
human-step carve-out. The findings note therefore carries the protocol as a runnable block
and labels every per-play equivalence call a **recommendation pending the sweep**, never a
measured class.

**Consequence for honesty:** the contract's *validity-not-lexical* spine is already proven
(E-014/E-020); only the per-play **converge-vs-by-design** calls are pending. The note must
keep those two epistemic tiers visibly separate.

## D2 — What the contract actually promises

**Options.** (a) Promise lexical/content consistency (converge everything). (b) Promise
nothing about consistency (pure diversity). (c) **Promise gated validity, not lexical
identity** — every cast is valid/grounded/gated; lexical divergence among valid outputs is
ruled per play as acceptable diversity or a defect.

**Decision: (c).** It is the only option faithful to `vision.md` ("the same prompt does not
give you the same result twice … the gates are the contract"). (a) contradicts the vision and
would over-promise on a probabilistic process; (b) abandons the value prop (P3). (c) makes the
two axes explicit — **validity consistency** (the gates' job; the real promise; measured:
E-014 ~21% variance cut, E-020 honest-empty eliminated) vs **lexical/content consistency**
(where 0.50–0.72 lives) — and says the promise is the first, with the second adjudicated
per play. This *is* the contract; it becomes IA-17.

## D3 — The per-play verdict rule (converge vs by-design)

The judge classifies dispersion as `equivalent-diversity` (→ **by-design**: say so, gate
nothing) or `genuine-disagreement` (→ **converge**: name the downstream lever). `mixed` →
lean converge on the divergent fraction. Pending the sweep, the recommendation is reasoned
from *what each play's output drives*:

| Play | Disp. | What the output drives | Directional recommendation | Why |
|---|---|---|---|---|
| **expand** | 0.50 | one signal from one **grounded fragment** | **by-design (lean)** | the fragment pins the intent; divergence is most likely wording/scoping of the *same* demand. Lowest stakes — verify. |
| **survey** | 0.69 | the **ranked board** → IA-1's single recommended pull | **converge (lean) — load-bearing** | if the *top* signal changes run-to-run, IA-1 ("home leads with demand") is undermined. The one play where genuine-disagreement would directly erode the product's spine. |
| **steer** | 0.72 | a project **direction** | **the genuine fork** | highest dispersion, but steer is inherently open (many *valid* framings of one direction). Could be legitimate equivalent-diversity OR flip-flopping. The call the human most owns. |

**Rationale.** The verdict is not "high dispersion → converge." Stakes and the output's role
decide: steer's 0.72 may be *more* acceptable than survey's 0.69 because many valid steers of
one board are diversity, whereas a survey whose #1 pull flips is disagreement that hits IA-1
directly. This asymmetry is the design's substance and is exactly what the sweep tests.

Rejected: a single global verdict for all three plays (loses the per-play structure the AC
demands) and a numeric dispersion threshold mapping straight to converge/by-design (a magic
number the evidence doesn't support — `equivalence.ts` already refused a `mixed` threshold
knob for the same reason).

## D4 — Where the fork is surfaced, and how the lever is named

**Options.** (a) Decide inside the IA principle. (b) Surface the fork in the findings note
only. (c) **Findings note carries the recommendation-first fork; `demand.md` carries the
bridge** — the E-022 row's Status records the contract + the per-play recommendation, and any
**converge** branch is named as a *downstream* demand signal (the lever), not built here.

**Decision: (c).** Recommendation-first means the human assents in the findings note (a clear
"Fork" section: per play, our recommendation + the one question the sweep answers + what
assent triggers). The IA principle (IA-17) states the *settled* spine (validity-not-lexical)
plus the per-play verdict **as recommendations**, so the durable doc doesn't overclaim a
decision the human hasn't made. The convergence lever — the downstream epic, if chosen — is
*named but unbuilt* (E-022 non-goal: "building a convergence mechanism … is a downstream
epic"). Candidate levers to name, not implement: a canonical-form/normalization gate, a
consensus cast (cast N, converge to the agreed core), or lowered sampling temperature.

**The demand.md bridge:** update the E-022 row Status to "contract captured (IA-17) + fork
surfaced; recommendation: expand by-design / survey converge / steer human-call," and (only
if the human later assents to converge) a new staged signal names the lever. Since the human
hasn't assented yet, the bridge **records the recommendation and the pending fork**, and does
not yet mint the downstream converge epic — that is the human's gesture.

## What "done" looks like (maps to the ACs)

1. **AC#1** — findings note at `docs/active/work/T-022-02/findings.md`: the bounded-sweep
   protocol (runnable, N≈3, logged), the equivalence read framework, and the per-play
   recommendation; honest that the sweep is the human step (D1).
2. **AC#2** — **IA-17** written into `information-architecture.md`: two axes, the promise
   (gated validity, not lexical identity), the per-play verdict with its evidence + Index line.
3. **AC#3** — the converge-vs-by-design **fork**, recommendation-first, in the findings note;
   the converge branch names the downstream lever (unbuilt); demand.md bridge updated.
4. **AC#4** — honest sample section (small N → directional); `bun run check:*` green (doc-only
   change; verified in Review).
