# Structure — T-022-02: consistency-contract-and-fork

The blueprint. This ticket touches **no `src/` code** — the T-022-01 instrument is run as-is,
and the deliverables are three documents. Below: every file created/modified, its shape, and
the ordering constraints between them.

## Files

### CREATE — `docs/active/work/T-022-02/findings.md` (the sweep findings note, AC#1/#3/#4)

The primary product. ~1 page, modeled on `docs/active/work/T-019-02/findings.md` (the E-019
findings note) so it reads as the same instrument's next entry. Sections, in order:

1. **Header blockquote** — what the sweep is, the instrument (`run-equivalence-judge.ts`),
   N≈3, "directional, not proof," and the one structural caveat: **the live judge sweep is
   the human step** (Design D1) — so the equivalence *reads* below are recommendations the
   human sweep confirms, while the *contract spine* is already evidenced.
2. **TL;DR — the contract in one paragraph.** Vend promises **gated validity, not lexical
   identity**; the per-play fork is expand→by-design / survey→converge / steer→human-call
   (directional).
3. **The two axes** — validity consistency (gates' job; measured: E-014 ~21%, E-020
   honest-empty eliminated) vs lexical/content consistency (the 0.50–0.72 dispersion). A small
   table tying each axis to its evidence + its owner.
4. **Per-play diagnosis + recommendation** — one block per play (expand 0.50 / survey 0.69 /
   steer 0.72): the dispersion, what the output drives, the equivalence-class *recommendation*
   (by-design / converge / mixed-lean), and the one question the sweep answers. The D3 table,
   expanded with rationale.
5. **The fork (recommendation-first)** — per play: our recommendation, the human's question,
   what assent triggers. The converge branch **names the downstream lever** (canonical-form
   gate / consensus cast / temperature) as a *future* epic, unbuilt (AC#3).
6. **The sweep protocol (the human step)** — the runnable command block (below), N, budgets,
   where logs land, how to read the output line. So the human can execute AC#1 in one paste.
7. **Honest about the sample** — small N, one repo/model/env, the equivalence reads pending
   the sweep, the by-design recommendations being the *less* certain ones (Design D1 tiers).
8. **Citations** — T-022-01 (`8edb71f`), E-019 findings, E-020 proof, E-014, vision.md,
   information-architecture.md, demand.md row 77.

The protocol block (verbatim, for §6):
```bash
# expand — N=3 on the fixed grounded fragment (250k/cast default):
bun run src/probe/run-equivalence-judge.ts expand docs/active/work/T-019-02/fixtures/grounded-fragment.txt 3
# survey — N=3 on the live board snapshot (300k/cast):
bun run src/probe/run-equivalence-judge.ts survey 3
# steer — N=3 on the live board snapshot (400k/cast):
bun run src/probe/run-equivalence-judge.ts steer 3
# Each prints: the consistency dispersion line, then `semantic equivalence: <class> (score)`
# beside it. Tee to docs/active/work/T-022-02/sweep-logs/<play>.log (no silent caps — IA-8).
```

### MODIFY — `docs/knowledge/information-architecture.md` (the contract principle, AC#2)

Add **one new principle, IA-17 — consistency-is-gated-validity-not-lexical-identity**, plus
its Index entry. Placement and shape:

- **Section.** A new top-level section after "The Ledger …" and before "Open threads
  (honestly unresolved)" — titled e.g. `## The consistency contract — what repeatability is
  over`. It is a settled principle, so it belongs in the body, not Open-threads.
- **Body (IA-17).** Bold lead `**IA-17 — Consistency is gated validity, not lexical
  identity.**` then: the two axes; the promise (every cast valid/grounded/gated — the gates
  are the contract, P3); the explicit concession that lexical divergence among valid outputs
  is *not* a broken promise; the **per-play verdict** (expand by-design / survey converge-lean
  / steer human-call) marked as the E-022 recommendation with its evidence (0.50/0.69/0.72 +
  E-014/E-020); and the rule that a "converge" verdict pulls a *downstream* lever, never
  re-litigates the validity axis. ~22–28 lines to match neighbors (IA-12…IA-16 are dense).
- **Index.** Append `· IA-17 consistency-gated-validity-not-lexical` to the Index block at the
  file's end, extending the existing IA-16 line.
- **Invariant:** additive only — IA-1…IA-16 untouched. The file's "small/slow/capped, never
  drift" discipline means one principle, no edits to settled ones.

### MODIFY — `docs/active/demand.md` (the bridge, AC#3)

Update the **E-022 row** (row ~77, "Articulation signal dispersion unbounded … active →
E-022") Status field to record the outcome: *contract captured (IA-17); fork surfaced
recommendation-first — expand by-design / survey converge(lean) / steer human-call; the live
equivalence sweep is the human step; the convergence lever is a named-but-unbuilt downstream
pull, minted only on assent to converge.* No new row is minted yet (the downstream converge
epic is the human's gesture, Design D4) — the bridge **records the pending fork**, it does not
pre-decide it.

### CREATE (on execution of the human step only) — `docs/active/work/T-022-02/sweep-logs/`

Not created by this ticket's agent pass (the sweep is the human step). The findings note's
protocol block names this as the tee target so the human's run lands logged evidence beside
the synthesis (no silent caps, IA-8). Listed here so the directory's purpose is on record.

## Ordering

1. `findings.md` first — it is the reasoning that the IA principle distills. Writing it forces
   the per-play verdicts to be concrete before they're carved into the durable IA doc.
2. `information-architecture.md` (IA-17) second — distills findings §2–4 into the settled
   principle; cite the findings note.
3. `demand.md` bridge third — one-line Status update pointing at IA-17 + the findings note.
4. `progress.md` tracks 1–3; Review (`review.md`) verifies `check:*` green after.

## Non-changes (explicit)

- **No `src/` edits.** `equivalence.ts`, `run-equivalence-judge.ts`, the consistency-probe
  path: untouched. AC#1's "extend, don't break" was T-022-01's job and holds.
- **No new test files.** The pure core's 12 tests already cover the classifier; this ticket
  adds no code to test. `check:*` green is asserted, not newly earned.
- **No downstream convergence epic minted.** Named in findings + demand.md as the lever; its
  creation waits on the human's converge assent (Design D4; E-022 non-goal).
