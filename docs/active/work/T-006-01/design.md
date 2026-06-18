# T-006-01 — Design: how to sequence the next wave

The Research phase mapped the terrain. This phase **decides the sequencing method**
and resolves the open design choices the deliverable (`roadmap-plan.md`) depends on.
Grounded in `demand.md`'s value+budget model and the frictions F1–F4 — not invented.

The "design" of a planning sorcery is the *ranking function and the id scheme*, not
an architecture. (That this phase has to be bent this way is friction F4 — noted for
Review.)

---

## Decision 1 — the sequencing function

**Question.** By what rule do the five tracks (E-002 CI, E-003 shelf, E-004 id-guard,
E-005 model-id, casting-engine sorcery) get ordered into a recommended next pull?

**Options.**

- **(A) Effort-ascending** — smallest first. *Rejected.* Directly violates
  `demand.md`: "Rank by leverage, never by estimated effort … agent-run effort is
  fat-tailed and unestimable." Effort isn't even a legal input.
- **(B) ID order** — E-002→E-007. *Rejected.* `demand.md`: "Pull order is by value +
  readiness, **not** ID order. IDs are assigned on pull." Following ID order would
  reproduce exactly the push/overproduction antipattern `tps.md` warns against.
- **(C) Leverage × readiness, with the genuine fork escalated** — rank by
  `demand.md`'s tier, break ties by what's *ready now*, and where two items are
  co-equal and pull in opposite directions, **surface it as an andon fork rather than
  fabricate a winner.** **Chosen.**

**Why C.** It is `demand.md`'s instrument applied verbatim, and it honors the
`project-steering.md` andon: "Surface the real forks … ask on real forks,
decide-and-proceed on defaults. Never survey what you can just choose." The
shelf-vs-CI trade (Research §3) is a *real* fork the board itself refuses to resolve;
the right output is a recommendation **plus** an escalation, not a false certainty.
Everything cheaper-and-ready than the fork is decided and ordered ahead of it.

**The resulting spine.**
1. **E-004 id-guard** — *recommended next pull.* High leverage (enabler), ready, and
   the one prerequisite `demand.md` names for machine-decomposing the next epic *in
   place*. Without it, pointing `DecomposeEpic` at the populated board clobbers ids
   (F1 is the same defect, already biting at planning time). Cheapest path to
   unblocking every later epic's own cast → highest leverage-per-readiness.
2. **E-005 model-id** — tiny, ready, P3 data-fidelity; rides alongside E-004. Makes
   the ledger trustworthy so budget calibration (`demand.md`) reads truth.
3. **⟂ THE FORK: E-003 shelf ⟂ E-002 CI** — both High, opposite directions. Escalated,
   not resolved. Recommendation recorded (E-003 first; see Decision 3) with the
   CI-first alternative stated as the risk-management choice.
4. **Casting-engine sorcery** — last. Highest *future* leverage (the product's next
   leap, `card-model.md`) but **lowest readiness**: its required input is the very
   friction this survey produces (F4). Sequencing it last is itself the finding.

## Decision 2 — the story-id scheme (resolves F1)

**Question.** What ids do planned stories carry so they (a) don't collide with the
live board and (b) don't reproduce F1?

**Options.**

- **(A) Continue flat sequential** — next free `S-003, S-004, S-005, …`. *Rejected.*
  It is the scheme that *created* F1: flat numbering decouples a story from its epic,
  so E-001 silently ate `S-002`, and any future reader expects `E-002`→`S-002`. It
  reproduces the collision and reads as a landmine.
- **(B) Epic-scoped namespacing** — `S-<epic>-<n>` (e.g. `S-004-01`, `S-002-01`).
  **Chosen.** Guaranteed collision-free against the live flat ids (`S-001/002/006`);
  parentage is legible at a glance; and it **hand-prototypes exactly the namespace
  E-004 will automate** for tickets. The plan demonstrates its own remedy.

**Why B.** It satisfies the AC ("no id collisions") *by construction* rather than by
luck, and it converts F1 from a buried defect into a recommendation the roadmap
carries forward. These are planning ids on a markdown page — not materialized files —
so divergence from the flat convention costs nothing now and de-risks every later
cast. The divergence itself is flagged as a contradiction in the deliverable.

## Decision 3 — the shelf-vs-CI fork: recommend, don't resolve

**Question.** Within the escalated fork, what does the survey *recommend* (while
leaving the call to the human)?

**Recommendation: E-003 shelf first.** Rationale, charter-grounded:
- Advances the **core feature** directly (**P2** — the run is two gestures; the shelf
  is the first real counter). CI is an *enabler* (weakest check type by our own lens,
  `ci-strategy.md`) — real value, but it de-risks work that mostly **doesn't exist
  yet** (the parallel fleet). Leverage today favors the counter.
- Sequencing payoff: once **E-004** lands (step 1), the shelf can dispense
  `DecomposeEpic` against the *live* board safely — E-003's value is unlocked by the
  recommended-first pull. The two compose.

**The alternative, stated honestly (the human's to weigh):** **E-002 CI first** if
the priority is de-risking the fast-committing parallel fleet *before* it scales —
catch structural defects at the source rather than letting them travel into the next
agent's context (`ci-strategy.md` trigger model). This is a "which risk do you carry
first" call, and `demand.md` deliberately leaves it open. The survey hands it up.

## Decision 4 — scope discipline (the over-build andon)

**Question.** How many stories per epic does the plan lay out?

**Decision: one *wave* only — the minimum coherent story set per epic, no more.**
- E-004 → 1 story. E-005 → 1 story. E-002 → **1 story** (the "first gate honest"
  slice from `ci-structural-gate.md`; lint/typecheck/consistency/keep-warm are
  deferred, *not* planned now). E-003 → 2 stories (menu, then selection+dispatch).
  Casting-engine → 1 spike story.
- **Why.** `demand.md` opening ("overproduced plans are inventory that rots") +
  `project-steering.md` move 5 (resist over-building) + `decisions.jsonl` D-003 (the
  human's "it's simpler than that" correction). The recurring failure on *this* repo
  is planning past the slice (Research §5). Plan the next wave, rank it, stop. Stories
  beyond the first wave are surfaced as one-line *future signals*, not elaborated.

## Decision 5 — handling F3 (E-002 has no card)

E-002's stories presume a card. Rather than block, the plan lays out E-002's first
story **and flags the missing `epic/E-002.md` as a prerequisite step** (author the
card from `ci-strategy.md`, which already contains the full epic-worth of steering).
This keeps the survey forward-moving without silently inventing an epic spec.

---

## What this design commits the deliverable to

A `roadmap-plan.md` that: ranks the five tracks by leverage×readiness (C); names
**E-004 as the recommended next pull** and the **shelf-vs-CI fork** as the escalation;
assigns **epic-scoped story ids** (B); cites the driving KB doc(s) and a value tier +
budget envelope per story; plans **one wave** (D4); and reports F1–F4 as the bounds
check. The next phases (Structure, Plan) define that document's shape and the steps
to produce it.
