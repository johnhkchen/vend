# T-029-01 — Progress: visual-atoms

## Status: Implement complete

Produced the deliverable `docs/knowledge/design-language.md` (atoms layer: preamble + DL-1…DL-5 +
partial index). No `src/**` touched.

## Steps executed (vs plan)

| Step | Plan | Done | Deviation |
|---|---|---|---|
| 1 | Preamble | ✅ purpose + anti-drift + fixed-direction + lens-scoping + grounded-in pointers | none |
| 2 | DL-1 governing | ✅ clean-typographic restraint; `═` named as the one rule; restraint=legibility | none |
| 3 | DL-2 palette | ✅ 5-tone meaning→binding table, no hex; both gaps named in-table | none |
| 4 | DL-3 type hierarchy | ✅ six levers; lead-vs-recede rule; grounded in step/audit indent | none |
| 5 | DL-4 meter (IA-8) | ✅ ◇ detect-after burn vs ⏱ hard-wall countdown; today-vs-target gap named | none |
| 6 | DL-5 andon (IA-9) | ✅ amber/calm/four-payloads/non-red-non-chrome; IA-10 not-a-defect | none |
| 7 | Partial index | ✅ DL-1…DL-5 index + explicit `(DL-6… surfaces — T-029-02)` seam | none |
| 8 | Gate + commit | ✅ typecheck clean, 853/0; commit below | none |

## Verification

- `bun run check:typecheck` — clean (no `.ts` changed).
- `bun run check:test` — **853 pass / 0 fail** (unchanged; doc-only cannot regress it).
- All six `Grounds in:` function names verified present in `src/` during Research (`amber`,
  `formatWallet`, `formatStepSignal`, `renderReceipt`, `renderStaleBoard`, `formatWalkAwayFindings`).
- Final doc length: ~95 lines — within the ~115 cap (IA-doc-shaped, principle-level).

## Deviations from plan

**None.** The atom set, the meaning→binding table, and the honest gap-naming all landed as designed.
Scope held to atoms — no surface mock leaked in from T-029-02's territory.

## AC trace

- AC#1 (DL-1 + palette + type hierarchy, capped, IA-shape) → preamble + DL-1 + DL-2 + DL-3. ✅
- AC#2 (two honest rules: meter IA-8 + andon IA-9 as DL principles) → DL-4 + DL-5. ✅
- AC#3 (grounded in live surfaces; index line per principle; `check:*` green doc-only) → `Grounds in:`
  on every atom + the index + the green gate. ✅

## Handoff to T-029-02

The file ends after DL-5 with an index line explicitly marking `(DL-6… surfaces — T-029-02)`. T-029-02
appends the Home/Counter/Ledger/production-line ASCII mocks, the explicit card-as-lens-not-chrome
decision, DL-6…, and completes the index. The append seam is unambiguous; no concurrent write (DAG:
T-029-01 → T-029-02).
