# T-026-03 — Progress

## Status: complete (read-only ticket; no code, no ledger writes)

## What was done

Followed the plan exactly. This ticket reads a number off the existing instrument; there was
no implementation to commit incrementally — the "work" is the read + the write-up.

| Step | Action | Result |
|---|---|---|
| 1 | Confirmed `vend audit` arm + ledger read-ready | 25 records, 0 skipped; window 100 = no-op |
| 2 | Captured `vend audit` verbatim (4 slices) → `audit-output.txt` | All four fragments + provenance block captured |
| 3 | Verified sample-size trace to T-026-02 | 15 carriers ≥ 10; genuine, diverse plays, not padded |
| 4 | Wrote `findings.md` (the report) | Headline rate, trend, andon-vs-budget, trace, E-014 read |
| 5 | Wrote this `progress.md` | — |
| 6 | Wrote `review.md` | (Review phase) |

## The numbers captured (verbatim from `audit-output.txt`)

- **Walk-away rate: 93%** (14/15 carriers ran untouched), all plays.
- **Trend: 100% → 88%** — single-intervention-driven, noise-dominated (see findings).
- **Andon: 40%** vs 10% standard (⚠ over) and vs 5% keystone (⚠ over) — 7 censored + 3
  gate-failed of 25; gates working, different denominator than walk-away.
- **Forward arm (decompose-epic): 83%** (5/6), where the one intervention lives.
- **Sample: 15 carriers ≥ 10**, traced to T-026-02 commit `4bd90d3` + sweep-protocol.

## Deviations from plan

None. The only judgment exercised beyond the plan: reporting the `propose-epic` arm (100%,
4/4) alongside `decompose-epic` so the "two carriers per signal" structure is visible — this
was Design Decision 2, carried through.

## Notable finding worth flagging upward

T-026-02's review handoff recorded only **2** genuine forward carriers and treated reaching
≥10 as a future multi-sitting sweep. By read time the ledger already held **15** — genuine
sessions accrued between that handoff and this read. So the AC's ≥10 clause is satisfied by
real data today, with no padding required. The remaining soft spot is not the *count* but the
*mix*: 14 of 15 carriers are clean walk-aways, so the trend rests on a single intervention.

## Verification

- No unit tests added (no code). `auditWalkAway` is already suite-covered (T-014-01).
- Reproducibility: re-running the four `bun run src/cli.ts audit …` commands against the same
  ledger reproduces every reported figure. `audit-output.txt` is the frozen evidence.
- Honesty check: every number in `findings.md` traces to captured stdout — no recomputed or
  remembered figures.
