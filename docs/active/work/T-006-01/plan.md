# T-006-01 — Plan: steps to produce the roadmap plan

Ordered, independently-verifiable steps that turn the Structure blueprint into
`roadmap-plan.md` + the `decisions.jsonl` record. For a code ticket this phase
defines the test strategy; for a planning sorcery the "tests" are the **AC checks**
applied to the artifact (friction F4 again — there is no `bun test` for a plan). Each
step names its verification.

---

## Step 0 — freeze the inputs (done in Research)

Inputs are read and pinned: KB §1, board §2, value model §3, frictions §4. No new
reads required to write the plan; if a number is needed (a budget envelope) it comes
from `demand.md` verbatim.
- **Verify:** Research + Design + Structure artifacts exist and agree on the spine
  (E-004→E-005→fork→E-007) and the id scheme (epic-scoped). ✓ (all three written)

## Step 1 — write the ranked pull order (the headline)

Author `## The recommended pull order` + `## The fork` first, top of the doc.
- Content: the 4-rung spine from Design Decision 1; E-004 named recommended-next with
  the one-sentence "why now" (enabler + F1 already biting); the fork escalated with
  recommendation (E-003) + alternative (E-002) from Decision 3.
- **Verify (AC3 "names the recommended next pull and why"):** the doc states exactly
  one recommended next pull with a leverage+readiness rationale, and the fork is
  presented as a human decision, not silently resolved.

## Step 2 — write the per-track planned-story records

Fill the five `### E-…` subsections using the Structure schema, in pull order. Per
story: outcome, value tier, budget envelope, readiness, **cites**, advances,
known-done-by.
- Pull each value tier + envelope from `demand.md` (don't invent): E-004 High/~1h ·
  E-005 Standard/tiny · E-003 High/~1 block (split across 2 stories ≈ ~1h each) ·
  E-002 High/~1 block · E-007 spike/~1 block, readiness-gated.
- Cite the *specific* driving doc per story (Structure table): E-004→`E-004.md` +
  `playbook-decompose-epic.md` (structural gate) + `runs.jsonl`/proof kaizen#4;
  E-005→`E-005.md` + kaizen#3; E-003→`E-003.md` + `vision.md` P2 + `card-model.md`
  (counter); E-002→`ci-strategy.md` + `ci-structural-gate.md`; E-007→`card-model.md`
  (sorcery axis) + `E-006.md` notes + this survey's F4.
- **Verify (AC2 "each cites the KB doc(s) … value tier + budget"):** every story
  record has a non-empty `Cites:` naming a real `docs/knowledge/**` file, a value
  tier, and an envelope. Grep the finished doc: 6 story blocks, 6 `Cites:` lines.

## Step 3 — write the bounds check (F1–F4)

Author `## Bounds check` stating each contradiction/gap found, or "no contradictions
found" if none survive scrutiny. F1 (id-scheme self-contradiction) and F2 (demand.md
internal staleness) are genuine contradictions; F3 (missing E-002 card) is a gap; F4
(RDSPI mismatch) is process friction → it belongs in **Review**, cross-referenced
here.
- **Verify (AC4 "flags any contradiction … or states none found"):** the section
  exists and is non-empty; each flagged item names the two docs/refs that disagree
  and what the disagreement is.

## Step 4 — write framing + future signals + provenance

- `## How to read this` (legend, stories-only, cite-don't-invent).
- `## Future signals (not planned)` — one-liners only (bound-dispense-exploration,
  the value/budget shelf surface, design-language session, additional CI gates).
  Deliberately un-elaborated (anti-rot; `demand.md` opening, Design D4).
- `## Provenance` — docs cited + the `decisions.jsonl` record id.
- **Verify (scope / over-build andon):** future signals are *one line each*; no story
  records exist outside the planned wave. If any future signal grew a sub-plan, that's
  the over-build defect — cut it back.

## Step 5 — id-collision check (the structural poka-yoke)

Before declaring the deliverable done, run the Structure §"id-collision guard" check:
diff every minted id against the live set.
- **Verify (AC5 "no id collisions with the live board"):** `grep -hoE 'S-[0-9]{3}(-[0-9]+)?'`
  over the deliverable yields only `S-NNN-nn` shapes ∉ {S-001,S-002,S-006}; no `T-`
  ticket ids are minted; `E-007` ∉ existing epic files. 0 collisions.

## Step 6 — log the steering decision

Append one record to `.vend/decisions.jsonl` per `steering-data-model.md`: `move:
"queue"` (ranked the demand), the fork in `options` (E-003 vs E-002, recommended
flag), `choice` = the spine + recommended next pull, `humanVerdict: "pending"`
(autonomous cast — the human hasn't ruled on the fork yet), `provenance.produced:
["roadmap-plan.md"]`.
- **Verify:** the appended line is valid JSON (`tail -1 … | jq .`) and carries the
  unrecoverable fields (move, question, options, choice, rationale, humanVerdict).

## Step 7 — Review (next phase)

Self-assess against all five ACs; record the F4 RDSPI-mismatch friction explicitly
(the ticket Notes require it); flag open concerns (the fork awaiting a human verdict;
F2/F3 needing later cleanup pulls). Produced as `review.md`.

---

## Verification strategy summary (AC → check)

| AC | Checked in | How |
|---|---|---|
| AC1 — `roadmap-plan.md` exists, sequences the next wave | Steps 1–2 | file present; 6 story records across 5 tracks |
| AC2 — each story cites KB doc(s) + value tier + budget | Step 2 | grep: 6 `Cites:` lines naming real KB files; tier+envelope each |
| AC3 — sequenced by leverage+readiness; names next pull + why | Step 1 | one recommended pull w/ rationale; fork escalated |
| AC4 — flags contradictions (or none found) | Step 3 | bounds-check section non-empty; F1/F2 named |
| AC5 — stories only; no id collisions | Steps 0,5 | no `tickets/`/`stories/` writes; collision grep = 0 |

**No code, no `bun test`** — every check above is a *document* check. That this
ticket's "Plan" produces a test strategy with nothing to execute is the cleanest
single illustration of friction F4. Carried to Review.
