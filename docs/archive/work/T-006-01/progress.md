# T-006-01 — Progress

Implement phase for a planning sorcery: "implementing" means **writing the
deliverable** (`roadmap-plan.md`) + appending the decision record, then running the
AC checks. No source code, no commits-per-step (there is nothing to compile). That
inversion is friction F4 — see `review.md`.

## Completed

- [x] **Step 0** — inputs frozen in Research; spine + id-scheme agreed across
      Design/Structure. No new reads needed to write the plan.
- [x] **Step 1** — recommended pull order + the escalated fork written (headline-first).
- [x] **Step 2** — six per-track story records written (E-004, E-005, E-003×2, E-002,
      E-007), each with value tier · budget envelope · readiness · cites · advances ·
      known-done-by. Tiers/envelopes pulled verbatim from `demand.md`.
- [x] **Step 3** — bounds check written: F1 (id-scheme contradiction) + F2 (demand.md
      staleness) as genuine contradictions; F3 (missing E-002 card) as a gap; F4
      (RDSPI mismatch) cross-referenced to `review.md`.
- [x] **Step 4** — framing, future signals (one-liners), provenance written.
- [x] **Step 5** — id-collision check run: minted story ids `S-002-01/003-01/003-02/
      004-01/005-01/007-01` ∉ live `{S-001,S-002,S-006}`; **0 collisions**; no ticket
      ids minted; `E-007` ∉ existing epic files.
- [x] **Step 6** — `decisions.jsonl` record `D-2026-06-18-007` appended (`move: queue`,
      fork in options, `humanVerdict: pending`); validated with `jq`.
- [x] **AC self-check** — all five ACs verified (table in `plan.md`): file present;
      6 `Cites:` lines naming real KB docs; one recommended pull + escalated fork;
      bounds check non-empty; stories-only with no collisions.

## Deviations from plan

1. **Story-id scheme switched flat → epic-scoped (`S-<epic>-<n>`).** *Planned ambiguity
   resolved during Design (Decision 2), executed here.* Rationale: the flat scheme is
   what *created* F1 (E-001 ate `S-002`); epic-scoping is collision-free and prototypes
   E-004's namespace. Deviation from the *existing* convention, deliberate and flagged
   in the deliverable's bounds check — not a silent break.
2. **Added E-007 as a proposed epic id for the casting-engine track.** The ticket lists
   "the single-use-play / casting-engine capability" with no epic. Rather than plan
   stories against a non-existent card, assigned a free epic id (`E-007`, distinct from
   the E-002 CI signal) and flagged "author the card first" as a prerequisite. Forward
   motion without inventing an epic spec — within the survey's read→plan remit.
3. **F2/F3 reported, not fixed.** The stale `demand.md` rows (F2) and the missing
   `epic/E-002.md` (F3) are real, and fixing them was tempting — but both are *board
   mutations* outside a stories-only survey. Held the over-build andon
   (`project-steering.md` move 5): reported as findings, left as later pulls.

## Not done (correctly out of scope)

- No tickets materialized; no epic cards authored; no `demand.md` sweep. Each is a
  separate, later pulled unit — planning them here would be the overproduction
  (`tps.md`) this very survey is meant to avoid.
- No git commit performed (the user/Lisa owns commit timing for this artifact set; the
  spike produced no code requiring incremental commits).
