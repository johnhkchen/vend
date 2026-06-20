# Progress — T-028-01 split-audit-by-provenance

Implement phase. Followed `plan.md` step by step; no deviations.

## Step 1 — Reader: surface provenance ✅ (commit `feat(run-log): surface intervenedAttested…`)

`src/log/run-log.ts`:
- Added `readonly intervenedAttested?: boolean` to `RunRecordInput` and `RunRecord`
  (absence-is-meaningful JSDoc, mirroring `intervened`).
- Added `normalizeIntervenedAttested(v)` — one-way: returns `true` only for `v === true`,
  else `undefined` (so `false` is never written; forward records stay byte-identical).
- `buildRunRecord`: computes + spreads `...(intervenedAttested ? { intervenedAttested } : {})`.
- `reviveRecord` (the root-cause fix): derives the flag from a **truthy-object**
  `intervenedAttestation` marker OR an explicit `intervenedAttested === true`; spreads when
  present. No ledger rewrite — existing back-fill records reclassify on their existing marker.

`src/log/run-log.test.ts`: new describe "intervention provenance" — 6 tests (marker→attested;
plain forward → omitted; explicit flag; non-object marker doesn't trip; no-bit record stays
valid; build round-trip with `false` omitted). **69 pass / 0 fail.**

## Step 2 — Stat: split intervention ✅ (commit `feat(walk-away): split intervention stat…`)

`src/ledger/walk-away.ts`:
- Added `InterventionSubStat { reported, intervened, rate }` (no trend, by design).
- Added `forward` + `attested: InterventionSubStat` to `InterventionStat`; combined
  `reported`/`intervened`/`rate`/`trend` left exactly as-is.
- Added pure `subStat(records)` helper (reuses `rateOrNull`).
- `auditWalkAway`: partitions `reportedRecs` on `r.intervenedAttested === true`; attaches
  `forward`/`attested`.

## Step 3 — Render: show the split ✅ (same commit as Step 2)

- `formatWalkAwayFindings`: appended a provenance sub-line inside the `iv.reported > 0`
  branch — `└ forward (live): … · attested back-fill: …`.
- Added pure `subWalk(sub)` formatter: walk-away = `1 − rate`, "none yet" for an empty
  partition (honest label, never a fabricated 0%).

`src/ledger/walk-away.test.ts`: new describe "intervention provenance split" — 4 tests
(partition + combined-invariance on a mixed fixture; forward-only ⇒ attested empty/null;
fragment renders both labels with right counts; "none yet" path). **17 pass / 0 fail.**

## Step 4 — Live proof + full check ✅ (verification only, no new code)

`bun run src/cli.ts audit` over the real `.vend/runs.jsonl`:
```
E1 — walk-away trust · all plays · 25 runs [standard]
  walk-away rate: 93% (14/15 ran untouched) · trend 100% → 88% (target → 100%)
    └ forward (live): 50% (1/2 untouched) · attested back-fill: 100% (13/13 untouched)
  andon rate: 40% vs 10% budget — ⚠ over (gates working, not defects)
  outcome mix: 15 success · 7 censored (budget/timeout) · 3 gate-failed · 0 id-collision
  cost vs envelope: tokens ×0.65 · time ×0.12 (median over 9 successful runs)
```
Matches the AC's exact target: **forward (live): 2 (1 intervention), attested back-fill:
13/13, combined 14/15 (93%)**. `cli.ts` needed **no edit** — the new sub-line flows through
the already-wired `formatWalkAwayFindings`, as Structure predicted.

- `bun run check:typecheck` → clean (no `tsc` errors).
- `bun test` → **853 pass / 0 fail** across 56 files.

## Deviations from plan

None. The plan's prediction that cli.ts would need no change held. Step ordering and test
shapes matched the plan as written.

## Commits

1. `feat(run-log): surface intervenedAttested provenance flag on read (T-028-01)`
2. `feat(walk-away): split intervention stat into forward + attested, render it (T-028-01)`
