# Plan — T-022-02: consistency-contract-and-fork

Ordered, independently-verifiable steps. No `src/` changes, so the testing strategy is
"don't regress + the docs are internally consistent," not new unit tests. Each step is a
single atomic commit-sized unit.

## Step 1 — Capture baseline green

- **Do:** run `bun run check` (typecheck + test) once to record the baseline (expected: 743
  pass, the T-022-01 number).
- **Verify:** exit 0; 743/0. Record the number for Review (AC#4).
- **Why first:** establishes that any later red is the doc change's fault — and since the doc
  change touches no code, it proves the AC#4 "green" claim is honestly inherited, not asserted.

## Step 2 — Write the findings note (`findings.md`) — AC#1, AC#3, AC#4

- **Do:** author the 8-section note per Structure (header → TL;DR → two axes → per-play
  diagnosis+recommendation → fork → protocol → honest-sample → citations). The per-play
  recommendations come from Design D3; the fork from D4; the protocol block verbatim from
  Structure.
- **Verify:** all three plays present with dispersion + recommendation; the fork is
  recommendation-first and names the downstream lever as unbuilt; the protocol block is
  copy-pasteable; the human-step framing (D1) is explicit; the honest-sample section separates
  the *proven spine* from the *pending equivalence reads* (Design D1 two-tier honesty).
- **Atomic:** yes — the note stands alone.

## Step 3 — Write the IA-17 principle (`information-architecture.md`) — AC#2

- **Do:** add the `## The consistency contract …` section + `**IA-17 — …**` body before
  "Open threads," distilling findings §2–4. Append the Index entry. IA-1…IA-16 untouched.
- **Verify:** IA-17 states both axes, the promise (gated validity not lexical identity), the
  per-play verdict *as the E-022 recommendation* with evidence, and the "converge pulls a
  downstream lever, never re-litigates validity" rule. Index line extended. `grep -c "IA-17"`
  ≥ 2 (body + index). No diff to IA-1…IA-16 (confirm via `git diff` — only additions).
- **Atomic:** yes, after Step 2 (it distills the note).

## Step 4 — Update the demand.md bridge — AC#3

- **Do:** edit the E-022 row Status to record the captured contract (IA-17) + the surfaced
  fork + the recommendation per play + "the convergence lever is a named-but-unbuilt
  downstream pull, minted on converge assent." No new row.
- **Verify:** the E-022 row points at IA-17 and the findings note; no downstream converge epic
  is minted (the human's gesture); `git diff docs/active/demand.md` shows one row's Status
  changed, nothing else.
- **Atomic:** yes.

## Step 5 — Re-run the gate and confirm green — AC#4

- **Do:** `bun run check` again (and, if cheap, `bun run check:committed`/`check:head` per the
  repo's CI scripts). Doc-only change ⇒ identical pass count expected.
- **Verify:** exit 0; 743/0, unchanged from Step 1. This is the AC#4 "green" evidence Review
  cites.

## Step 6 — Progress + Review

- **Do:** keep `progress.md` updated across Steps 2–5 (what's done, deviations); then write
  `review.md` (handoff: files changed, the check result, the two-tier honesty caveat, the open
  concern that the equivalence reads await the human sweep).
- **Verify:** review.md names every changed file, the check number, and the single critical
  open item (the human-step sweep) flagged for the reviewer.

## Testing strategy

- **No new unit tests.** The classifier (`equivalence.ts`) is already covered by 12 pure tests
  (T-022-01). This ticket adds no executable code, so the verification is (a) `check:*` stays
  green and (b) the docs are internally consistent (cross-references resolve, numbers match
  E-019/E-020: expand 0.50 / survey 0.69 / steer 0.72).
- **The live equivalence sweep is intentionally NOT in this plan's execution** (Design D1 — the
  human step). The plan delivers the protocol + synthesis; running it is the human's gesture,
  and its logs land under `sweep-logs/` per Structure.
- **Integration check that matters:** the IA-17 per-play verdicts must match the findings
  note's per-play recommendations exactly (no drift between the durable principle and its
  evidence note) — verified by eye in Step 3 and again in Review.

## Risk / deviation policy

- If `bun run check` is *not* green at Step 1 (pre-existing red unrelated to this ticket),
  document it in progress.md as inherited, do not attempt to fix it here (out of scope), and
  flag it in Review — the AC#4 claim becomes "no regression from baseline" with the baseline
  stated honestly.
- If writing IA-17 surfaces that the per-play recommendation is genuinely unknowable without
  the sweep (e.g., steer), keep it as a *recommendation with the fork open* rather than forcing
  a verdict — the contract is allowed to say "this one is the human's call," which is itself the
  honest output (E-018 fork-genuineness; the andon-at-the-roadmap-level precedent from E-014).
