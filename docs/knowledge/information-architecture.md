# Vend — Information Architecture

The durable anchor for **what a user sees and how they move** through Vend. Like
`charter.md`, this is small by design and slow by design: principle-level, capped,
anti-stale. It is the spine the eventual TUI epics anchor to, so they implement a
settled shape instead of re-litigating it. Where a future surface and this file
disagree, fix one — they are not allowed to drift.

`charter.md` says *what work is worth clearing*; this file says *how the clearing
house presents itself*. Read `vision.md` for the narrative; this is the indexed
spine. Decisions here were converged in a go-and-see design session (`go-and-see.md`)
walking the literal new-user first run.

The two lenses carry over: **TPS** — the run surface is an assembly line with an
**andon** cord; a gate-stop stops the line. **MTG** — the shelf holds cards, the
budget is **mana** tapped from the subscription land pool, casting is the
transaction. See `card-model.md`, `tps.md`, `mana-economics.md`.

---

## The governing decision: recommendation-first, not browse-first

**IA-1 — The home leads with demand, not supply.** The top of the screen is *the
one thing worth doing now, and why* (the pull board, ranked by leverage). The shelf
of plays sits beneath as the inventory that *serves* the recommendation. A
browse-first catalog (scan all plays, pick one) would betray the pull principle and
turn Vend into a store you shop instead of a clearing house that tells you what to
clear. Supply is visible; demand leads.

This single decision sets the information hierarchy everywhere: context drives, the
shelf serves.

---

## The regions and how you move

**IA-2 — Four objects, three places.** The clearing house's object graph —
**Shelf** (supply: authored plays), **Board** (demand: ranked signals), **Counter**
(the transaction: a live cast), **Ledger** (the record: run history) — resolves to
*three* navigable places, not four:

```
Home  =  Board (pull-ranked)  +  Shelf (inventory beneath)
  │
  ├── pick ──▶  Counter   the live cast — full-screen, it earns its own mode
  ├──  L  ──▶  Ledger    run history; actuals feed envelope recalibration
  └──  a  ──▶  Author    the play's source — it's yours (shadcn-style), a side-door
```

Shelf and Board are the two halves of **Home** (supply beneath demand), not separate
destinations. Counter and Ledger are **drill-downs**. A terminal is narrow and a
live run wants full width, so the Counter is a focused mode, not a pane.

---

## The cold start: onboarding *is* the core loop

**IA-3 — A new user's first move is a cast, not a tour.** Vend ships with the plays
that stock Vend (`ProposeEpic`, `DecomposeEpic`, `Chain`, and the project survey).
So run-0 — a fresh install in an arbitrary repo, no charter, no board — has exactly
one honest recommended move: **cast Survey** (read this project → propose a demand
board). That move *is* the two-gesture transaction (pick + budget + run); its output
is the user's stocked board. The newcomer learns Vend by running it on itself, and
meets the budget model at second one (Survey states its envelope up front).

**IA-4 — The empty state is honest, not seeded.** The board is *truthfully* empty on
run-0; we do not manufacture fake starter signals (overproduction — `tps.md`). There
is exactly one honest thing to do, and doing it is the real product.

**IA-5 — Recommend, never auto.** Run-0 *offers* Survey and waits for the gesture; it
never auto-casts. The whole product is "you allocate the budget" — auto-spending the
user's mana on first launch would undercut the founding gesture (P2), and the cost of
honoring it is one keystroke. Pull-discipline (PE-1) holds even at onboarding.

The home screen has three states along this arc, same regions filling in:
**State 0** bare repo → orient + the Survey bootstrap · **State 1** surveyed → a board
with a recommended pull · **State 2** steady → full board + shelf + ledger feedback.

---

## The Counter — where the charter becomes visible behavior

The Counter is the only region where the invariants become *runtime behavior*: P2
(the second gesture happens here), P3 (the gate-stop renders here), P4 (you walk away
from here), P7 (the meter lives here).

**IA-6 — The spine is Confirm → Run → Settle.** Point-of-sale → the assembly line →
the receipt. At **Confirm**, the budget is pre-filled from the board's leverage tier
(Keystone → fat envelope), so the common case is *accept the default*; adjust is the
exception. At **Settle**, the actuals (what it cost, what materialized, where it
landed) feed back to recalibrate the envelope.

**IA-7 — Never tail the raw stream; show a production line.** The executor emits
low-level noise (`assistant`, `thinking_tokens`, `rate_limit_event`…). A play is a
typed graph, so node-level progress is structurally available for free: show *which
node is running* against the budget burn, plus a single distilled "what it's doing
now" line. The node list is the andon board in miniature.

**IA-8 — The meter must not lie about its two denominations.** Wall-clock is a **hard
wall** (halts mid-flight). Tokens are **detect-after** (the run can overshoot its
envelope; the andon catches it afterward — proven live at 108.9k/60k). Drawing the
two bars identically would be a lie: ⏱ is a countdown to a hard stop; ◇ is a
burn-rate-vs-envelope that *can* trip the andon late. (Bounding token exploration —
`--max-turns` — is what would eventually make ◇ a real wall.)

---

## The andon — the product's stance toward its own stops

**IA-9 — A gate-stop is a successful refusal, not a failure.** When a gate halts the
line, the user must feel *the tool just earned its keep* — it refused to hand over
garbage — **not** that something broke. This is the product's core promise made
visible (P3: gates are the contract), and it dictates the visual language:

- **Amber, not red.** "Stopped at the gate," never "ERROR/aborted/failed." The andon
  family is amber *everywhere* it appears — Counter, the Home in-flight board, the
  Ledger, notifications.
- **Voice is protective and calm.** "The budget gate held the line." "Nothing
  materialized — no half-output." Reassurance (P7), not apology.
- **Every andon carries four things:** which gate fired (the contract clause, named) ·
  what survived (nothing partial — P7) · why, in the user's terms · **the next pull**
  (the andon hands you the move — TPS: the cord stops the line *and* summons the fix).

**IA-10 — Vend has two success states.** Materialized-work *and* honest-refusal are
both wins. So an **andon rate is not a defect rate** — it is the "gates doing their
job" rate. A 0% andon rate is *suspicious* (are the gates real?), not ideal. The
Ledger counts andons as the system working; no surface red-flags that number.

**IA-11 — Andon summons; success stays quiet.** Vend is built to be left (P4). A
gate-stop is exactly the event worth interrupting the user for — it pushes a
notification; a clean Settle waits in the Ledger. (This anticipates the fleet/DAG
future: many lines running, only the stops light up.)

---

## The Ledger — recalibration as an error-budget control loop

The Ledger turns actuals into measured envelopes so the Confirm default (IA-6) is
*earned*, not guessed. Without it the user re-specifies budget every cast — a
specification cost paid every run, which breaks the founding promise (spec is paid
once, at authoring). The design is a recombination of three mature practices: an
**error-budget control loop** (SRE), **asymmetric-hysteresis actuation**
(autoscaling), over **streaming tail estimates** (t-digest), honest about
**informative censoring** (survival analysis).

**IA-12 — The setpoint is an andon budget; value sets it; the percentile spends it.**
Each play-node has an **andon budget** — the tolerable stop rate, exactly an SRE
error budget. Value tier sets it (Keystone ~5% / Standard ~10% / Leaf ~25%): work
that matters tolerates less interruption, so it gets a fatter envelope. The envelope
is the percentile of measured cost that *spends* that budget (Keystone→~p95,
Leaf→~p75). This reconciles "budget ∝ value" with "calibrate from data": **value
picks the percentile, data provides the value at it.** An andon rate at budget is the
gates working (IA-10), not a defect — a 0% rate is suspicious, not ideal.

**IA-13 — Bound the fat tail from successes; track the stop rate separately.** Agent
runs are fat-tailed — bound, never mean+stddev (the average is dominated by the fast
majority and hides the tail). Recalibrate the envelope from **successful** runs (what
finishing actually costs) and weight recent runs more (drift tracking). The catch is
**informative censoring**: andon'd runs are right-censored at the envelope — we never
see their true cost, and we censor *precisely* the expensive tail, so even
Kaplan–Meier (which assumes random censoring) stays biased. Consequences: the andon
budget **caps how much tail you can ever observe**; treat andons as `≥ envelope`
lower bounds; and run an occasional **uncensored probe cast** to learn the true tail.
(Mechanism: t-digest per node for online quantiles; an exact percentile over a
JSONL window is fine until scale demands the digest.)

**IA-14 — Actuate with asymmetric hysteresis: auto-widen, slow-tighten, deadband.**
Borrowed from autoscaling's flapping fix. A **deadband** (~10%): don't move the
envelope if the new percentile is within 10% of the current — kills churn on noise.
**Asymmetry:** widen **fast and automatically** (a starved play that andons is the
expensive failure — react now), but tighten **slowly and conservatively** (reclaiming
budget is low-stakes; don't surprise-starve a play whose tail just hasn't appeared).
This resolves auto-vs-recommend by stakes: autonomy (P4) where waiting is costly,
caution where it is cheap — consistent with recommend-never-auto (IA-5).

**IA-15 — The Ledger generates demand.** Recalibration's second output, for free: a
node whose **andon rate spikes** or whose **cost trends up** signals the play rotted
or the project outgrew it → a pull signal surfaced to the demand board. Runs → Ledger
→ signals → board. The kaizen signal-generation done by hand becomes automatic.
Recalibration is otherwise **invisible** (it auto-tunes the Confirm default — *Vend
structures the budget, not the author*, `mana-economics.md`); the Ledger view is the
inspectable record (per-node p50/p90, andon-rate-vs-budget, trend, total mana).

**IA-16 — Estimate via reference class: hierarchical, bias-corrected.** A raw estimate
(a human's gut, a play's authored guess, an allocated envelope) carries systematic bias
— *"we usually overestimate by ~80%."* Learn it from the **(estimated, actual)** pairs
the run log accumulates and correct future estimates by the empirical ratio
(reference-class forecasting — the outside view; the direction is data-driven, over- or
under-). Structure the dataset **two ways**: a **generic play level** (the play's cost
pooled across all projects — its intrinsic behaviour) and a **project level** (this
codebase's deviation — big epics here run decompose long). Combine by **partial pooling**
— lean on the generic play prior when project data is thin, shift to the project-specific
estimate as it accumulates (empirical-Bayes shrinkage; the two-level form of IA-13's
cold-start). The run log is thereby a durable **calibration dataset** (play × project ×
estimated × actual) — the asset a future tuning regime would want thousands of hours of.

The macro **"work for 2 hours" envelope** (the human-scale feature block) is spent
*down* by individual casts whose micro-envelopes come from this loop — so measured
envelopes are the prerequisite that makes the 2-hour gesture spend intelligently
(fit the next cast into the remaining macro budget) instead of against guesses.

---

## The consistency contract — what repeatability is over

The vision sells *repeatability over a natively probabilistic process* (`vision.md`). That
raises a question the gates alone don't answer: repeatability of **what**? Run the same play
twice on the same input and the wording differs (articulation dispersion 0.50–0.72, E-019/
E-020). This principle names what Vend actually promises — settled by the E-022 measure-then-
decide (the equivalence judge over the consistency probe).

**IA-17 — Consistency is gated validity, not lexical identity.** Vend promises that *every
cast yields a valid, grounded, gated output* — the gates are the contract (P3). It does **not**
promise the same *wording* twice; the vision concedes "the same prompt does not give you the
same result twice." Two axes, and only the first is the promise:

- **Validity consistency** — every cast is valid/grounded/non-garbage/honestly-non-empty. The
  gates' job, and **measured**: E-014 cut decompose variance ~21%, E-020 eliminated the
  honest-empty over-fire. This is the contract.
- **Lexical/content consistency** — repeated casts yield the *same* proposed work. Where the
  0.50–0.72 dispersion lives. **Not promised globally**; adjudicated per play as
  *equivalent-diversity* (acceptable — say so) or *genuine-disagreement* (a defect — converge).

The per-play verdict, **measured by the E-022 equivalence sweep (N=3, 2026-06-19)**: **expand →
by-design** (`equivalent-diversity`, 1.00 — the grounded fragment pins intent; divergence is
rewording, Jaccard 0.50); **survey → tail-divergence-by-design** (the **load-bearing #1 pull is
consistent run-to-run** — semantic `head-stable`, 1.00, the head-isolating re-sweep below; only the
*tail* ranking re-orders); **steer → by-design** (`equivalent-diversity`, 1.00 *despite* the highest
dispersion, 0.80 — many valid framings of one direction, not flip-flopping). The decisive lesson:
**dispersion magnitude does not predict meaning** — steer's 0.80 is pure diversity, so the *meaning*
axis (the judge), not Jaccard, adjudicates the contract. A "converge" verdict would pull a
**downstream** convergence lever (canonical-form gate / consensus cast / temperature) — never
re-litigating the validity axis, which the gates already own. Evidence + the resolved fork:
`docs/active/work/T-022-02/findings.md`.

**Survey's head, isolated (E-023, N=3, 2026-06-19).** E-022's whole-board judge scored survey's
*full ranking* as different run-to-run, but IA-1's contract is narrower — does the **#1 recommended
pull** flip, or only the tail? The head-isolating probe (T-023-01) answered it: **semantic
`head-stable` (1.00)** — all 3 casts' #1 pick the *same* pull (the keystone "scaffold the
Bun/TypeScript project," reworded each time), while the **lexical** baseline flips (0.00 — the head
is reworded, not re-chosen). The lexical-flip / semantic-stable split *is this principle in
miniature*: the load-bearing recommendation is the same proposed work, not the same wording. So
survey's "converge" verdict is **honestly downgraded to tail-divergence-by-design — no lever built**:
you don't converge a head that doesn't move (the whole-board judge itself swung between two N=3
sweeps — `genuine-disagreement` 0.00 → `equivalent-diversity` 1.00 — while the head held, which is
exactly why the contract rests on the head, not the volatile tail). Re-measure once `src/**` is no
longer empty and the keystone resolves. Evidence: `docs/active/work/T-023-02/findings.md`.

---

## Open threads (honestly unresolved)

Named so they don't masquerade as settled. Pull one when it's worth designing.

- **The detached/notify mechanism.** *That* andon summons you is settled (IA-11);
  *how* (terminal bell, OS notification, an andon board on next launch) is not.
- **The fleet/DAG andon board.** Multiple concurrent casts → Home's "in-flight"
  becomes an andon board where only stops light up. Anticipated, not designed.
- **Confirm's budget-adjust interaction.** Slider, presets, or pure
  accept-the-default — the adjust gesture's shape is open.

---

## Index

IA-1 recommendation-first · IA-2 four-objects-three-places · IA-3 onboarding-is-the-
core-loop · IA-4 honest-empty-state · IA-5 recommend-never-auto · IA-6 Confirm→Run→
Settle · IA-7 production-line-not-raw-stream · IA-8 meter-cannot-lie · IA-9
andon-is-successful-refusal · IA-10 two-success-states · IA-11 andon-summons-success-
quiet · IA-12 andon-budget-sets-the-percentile · IA-13 bound-from-successes-informative-
censoring · IA-14 asymmetric-hysteresis-auto-widen-slow-tighten · IA-15 ledger-generates-
demand · IA-16 reference-class-hierarchical-bias-corrected-estimate · IA-17 consistency-
gated-validity-not-lexical-identity.
