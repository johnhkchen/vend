# T-026-03 — Plan: ordered steps to read and report

This is a read ticket, so the steps are *run → capture → verify → write*, not *code →
test → commit*. Each step is independently verifiable. No step writes to the ledger or `src/`.

## Step 1 — Confirm the instrument and ledger are read-ready ✅ (done in Research)

- `vend audit` arm exists in `src/cli.ts` (~L682), backed by pure `auditWalkAway` /
  `formatWalkAwayFindings` in `src/ledger/walk-away.ts`.
- `.vend/runs.jsonl` present, 25 records, 0 skipped on load.
- **Verify:** `wc -l < .vend/runs.jsonl` = 25; window (100) does not truncate.

## Step 2 — Capture the audit output verbatim ✅ (done)

Run and capture into `docs/active/work/T-026-03/audit-output.txt`:
- `bun run src/cli.ts audit` (all plays, standard — the headline).
- `bun run src/cli.ts audit --tier keystone` (the strictest budget, E-014's target tier).
- `bun run src/cli.ts audit decompose-epic` (the forward `vend work` arm).
- `bun run src/cli.ts audit propose-epic` (the other chain arm).

**Verify:** the file contains the four findings fragments + the provenance block. Done.

## Step 3 — Verify sample-size traceability to T-026-02

- Confirm carrier count ≥ 10: `jq -s '[.[]|select(.intervened!=null)]|length'` → **15**. ✅
- Confirm the carriers are genuine (not padded 1-token andons): diverse plays, real
  envelopes (cost block shows ×0.65 over 9 successes), only 1 `intervened=true`. ✅
- Cross-link to T-026-02 commit `4bd90d3` (wired `vend work`) and its `sweep-protocol.md`
  (the accrual path 2 → ≥10). ✅
- **Verify:** the provenance list in `audit-output.txt` shows each carrier's timestamp/play/
  outcome, line-traceable to `.vend/runs.jsonl`.

## Step 4 — Write `findings.md` (the Implement artifact)

The human-facing report. Must contain, each quoted from captured output:
1. **The headline number:** walk-away rate 93% (14/15 carriers ran untouched), all plays.
2. **The trend:** 100% → 88%, with the honest annotation (single-intervention, noise-
   dominated, not a regression).
3. **The rate against the IA-12 budget:** andon 40% vs 10% standard (⚠ over) and vs 5%
   keystone (⚠ over); the censored-subset explanation (7 of 25 are envelope/timeout walls,
   3 gate-failed — gates working, not delivered-work defects).
4. **The forward-arm slice:** decompose-epic 83% (5/6), the `vend work` arm specifically.
5. **Sample-size trace:** 15 carriers ≥ 10, traced to T-026-02, with the "carrier records ≠
   invocations" caveat.
6. **The bottom line for E-014:** the rate is now readable from genuine data (HOLD's
   precondition met); the trend needs more `--intervened` sessions before "→ 100%" can be
   confirmed or denied.

**Verify:** every number in `findings.md` appears in `audit-output.txt`; no recomputed or
remembered figures.

## Step 5 — Write `progress.md`

Record: commands run, numbers captured, that no ledger/src writes occurred, any deviation.

## Step 6 — Write `review.md` (the Review artifact)

Handoff: AC line-item satisfaction, test/verification status (N/A code; reproducibility is
the verification), and open concerns (thin trend, andon over budget, homogeneous self-reports,
two-carriers-per-signal).

## Testing / verification strategy

- **No unit tests** — this ticket adds no code. `auditWalkAway` is already suite-covered
  (T-014-01) including the thin/empty-data degradation paths.
- **Verification = reproducibility.** The reported numbers are reproducible by re-running the
  Step-2 commands against the same ledger; `audit-output.txt` is the frozen evidence.
- **Honesty gate (the real check):** every reported figure must trace to captured stdout, and
  the trend must be characterized without inflation or suppression (Design Decision 4).

## Out of scope (explicit)

- Casting any `vend run`/`vend work` to grow the sample — not needed (≥10 met) and would be
  padding.
- Any change to `walk-away.ts` formatting or the budget table — that is T-014 territory, not
  this read.
- Rendering E-014's verdict — this ticket reads the number; the verdict is E-014's call.
