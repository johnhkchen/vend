# Progress — T-022-02: consistency-contract-and-fork

Tracking the Implement phase against `plan.md`. No `src/` code changed — the deliverables are
three documents synthesizing the E-022 contract.

## Steps

- [x] **Step 1 — baseline green.** `bun run check` → **743 pass / 0 fail** (typecheck clean).
  Matches the T-022-01 baseline; recorded for the AC#4 claim.
- [x] **Step 2 — `findings.md`** (AC#1/#3/#4). 8-section sweep findings note: header (with the
  human-step caveat) → TL;DR contract → two-axes table → per-play diagnosis+recommendation
  (expand 0.50/by-design, survey 0.69/converge-lean, steer 0.72/human-call) → recommendation-
  first fork (lever named, unbuilt) → runnable sweep protocol → honest-about-sample → citations.
- [x] **Step 3 — IA-17** (AC#2). Added `## The consistency contract — what repeatability is
  over` + `**IA-17 — Consistency is gated validity, not lexical identity.**` before "Open
  threads"; appended the Index entry. IA-1…IA-16 untouched (additive only).
- [x] **Step 4 — demand.md bridge** (AC#3). E-022 row Status updated: contract captured →
  IA-17, fork surfaced recommendation-first per play, lever named-but-unbuilt, live sweep =
  human step. No new row minted (the downstream converge epic is the human's gesture).
- [x] **Step 5 — re-run gate** (AC#4). `bun run check` → **743 pass / 0 fail**, identical to
  Step 1. Doc-only change ⇒ no regression, as expected.
- [x] **Step 6 — progress + review.** This file; `review.md` next.

## Deviations from plan

None of substance. One **deliberate, plan-sanctioned** call carried through: **the live
equivalence sweep was not executed.** E-022's decomposition designates it the human step, and
it is a ~30-min, credit-spending, non-deterministic operation (Design D1). The note delivers
the runnable protocol + the recommendation-first synthesis instead; running it (and teeing logs
to `sweep-logs/`) is the human's gesture that fills AC#1 with live equivalence reads. The
synthesis is honest that the per-play equivalence *classes* are recommendations, not
measurements, while the contract *spine* (validity-not-lexical) is already evidenced
(E-014/E-020).

## State of the ACs

- **AC#1** — findings note written with the bounded-sweep protocol (N≈3, logged target named),
  the equivalence framework, and per-play results-as-recommendations. The *live* reads are the
  human step. **Met as far as the autonomous pass can; the live sweep is the documented human
  gesture.**
- **AC#2** — IA-17 written (two axes; gated-validity-not-lexical promise; per-play verdict with
  evidence; Index). **Met.**
- **AC#3** — converge-vs-by-design fork surfaced recommendation-first; converge branch names the
  downstream lever (canonical-form gate / consensus cast / temperature), unbuilt; demand.md
  bridge updated. **Met.**
- **AC#4** — honest-about-sample section present (directional, not proof; two epistemic tiers);
  `bun run check` green (743/0). **Met.**

## Files touched

- `docs/active/work/T-022-02/{research,design,structure,plan,findings,progress}.md` (new).
- `docs/knowledge/information-architecture.md` (IA-17 + Index — additive).
- `docs/active/demand.md` (E-022 row Status — one row).
- *(No `src/` changes; no ticket frontmatter edits — Lisa owns phase/status transitions.)*
