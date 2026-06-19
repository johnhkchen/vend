# T-014-03 — Plan

Ordered, independently verifiable steps to produce the findings note and the demand bridge.
No code change, so the testing strategy is documentary verification + the `check:*`
regression guard, not new unit tests.

## Step 1 — Capture the live E1 fragment (done in Research)
Run `vend audit` (all plays) and `vend audit decompose-epic`; record both fragments
verbatim for the note. **Verify:** output captured in research.md.
- Result: all-plays = 10 runs, andon 40% vs 10%, no self-reports; decompose-epic = 6 runs,
  andon 50%. Both show `walk-away rate: no self-reports yet`. ✓ already captured.

## Step 2 — Write `findings.md` (the deliverable)
Author the note per structure.md §findings.md: TL;DR verdict → two numbers (one paragraph
each, E1 fragment fenced) → the decision (verdict HOLD + the rule table + the measurement-
sprint next pull) → sample limits → how-to-produce → citations.
**Verify against the ACs:**
- AC1 — both numbers stated with a one-paragraph read each (E1 unrecorded + andon caveat;
  E2 not-yet-measured + censoring caveat). ✓ checklist before moving on.
- AC2 — explicit go/reroute returned (**HOLD/not-go**), the rule per branch, and the
  concrete next pull each branch names. ✓
- AC3 — the sample-limits paragraph (one user, ≤5 casts, one epic, contaminated andon). ✓
Keep it ~one page (≤~110 lines) — it is a *note*, not a report.

## Step 3 — Add the one-line bridge to `demand.md`
Append the **Status (T-014-03): HOLD …** line to the macro-wallet entry's existing
"⚠ Gated by E-014" note, linking `work/T-014-03/findings.md`.
**Verify:** the line resolves to the now-existing findings.md; no other signal re-ranked
(none is promoted until numbers come back weak); the edit is exactly one line (demand.md's
anti-inventory discipline).

## Step 4 — Regression guard: `bun run check:*` (AC4)
Re-run the full suite. Expected: green, unchanged (no source touched).
**Verify:** typecheck clean + tests pass at the same count as the dependency baseline
(467 pass). Already confirmed green this cycle; re-confirm after the doc edits as the final
gate. Any failure here would mean a doc edit somehow broke a path that reads these files —
not expected, but the guard catches it.

## Step 5 — Write `progress.md` then `review.md`
`progress.md` — record what was produced, any deviations. `review.md` — the handoff:
files changed, "test coverage" (n/a — doc ticket; the verification is AC-mapping +
`check:*`), and open concerns (chiefly: **the numbers are still uncollected; the decision is
HOLD pending the human measurement sprint** — the single most important thing a reviewer
must know).

## Testing strategy
- **No new unit tests.** This ticket adds no code; the instruments it reads
  (`walk-away.ts`, `variance.ts`) are already exhaustively unit-tested in their own tickets
  (T-014-01: 13 cases; T-014-02: 68 assertions). Re-testing them here would duplicate.
- **The verification is AC-mapping** (Steps 2–3) **+ the `check:*` regression guard**
  (Step 4). The "live measurement" AC4 refers to is the human sweep step, explicitly
  downstream and out of scope (Design rejected-scope).
- **Honesty check (IA-8):** before finalizing, re-read findings.md asking "does any line
  read as an earned number when it is actually unmeasured?" — the single failure mode this
  note must avoid.

## Risk / deviation notes
- **Risk: a reviewer expects real numbers.** Mitigation: the TL;DR and both number-
  paragraphs state *up front* that the instruments are built but unfed, and why that is the
  correct state (forward-looking E1; human-gated E2). The note's job is the decision *rule*
  + the verdict given current evidence, which is HOLD.
- **Risk: HOLD reads as indecisive.** Mitigation: frame it as the active, safe default —
  the macro-wallet is *already* gated; HOLD keeps it gated and names the exact unblock
  (the measurement sprint). That is a decision, not a deferral.
- **Deviation policy:** if Step 4 surprises with a red check, stop and document in
  progress.md before any fix; do not silently edit source in a doc ticket.
