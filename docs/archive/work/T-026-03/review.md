# T-026-03 — Review: audit-walk-away-rate-and-trend

**Verdict: AC met. The walk-away rate is read from genuine data and captured.** Running the
existing `vend audit` instrument over the live ledger yields **93% walk-away (14/15 carriers
ran untouched)**, trend **100% → 88%**, stated against the IA-12 andon budget (**40% vs 10%
standard / 5% keystone, ⚠ over**). The reported sample is **15 self-report carriers ≥ the ≥10
bar**, traceable line-by-line to the genuine sessions T-026-02 made accruable. No new
instrument was built (N2 honored), no source changed, no ledger written.

## What changed

**No source files. No ledger writes.** This is a read/report ticket. The complete change set
is documentation under `docs/active/work/T-026-03/`:

- **`audit-output.txt`** (created) — the literal AC artifact: verbatim `vend audit` stdout for
  four slices (all/standard, all/keystone, decompose-epic, propose-epic) + the ledger
  provenance block (25 records, 15 carriers listed with timestamp/play/outcome).
- **`research.md`, `design.md`, `structure.md`, `plan.md`, `progress.md`, `findings.md`,
  `review.md`** (created) — the RDSPI set. `findings.md` is the human-facing report.

No `src/` diff. No `.vend/runs.jsonl` writes. No board changes beyond Lisa's phase advance.

## AC line-item check

> `vend audit` output records a walk-away rate plus trend over the sessions and is captured
> in docs/active/work/T-026-03/ — ✅ `audit-output.txt` holds verbatim output: walk-away 93%,
> trend 100%→88%.

> the reported sample size traces to the ≥10 genuine sessions from T-026-02 — ✅ 15 carriers
> ≥ 10, each line-traceable in `.vend/runs.jsonl`, genuine plays with real envelopes (not
> padded andons), linked to T-026-02 commit `4bd90d3` + `sweep-protocol.md`.

> the rate is stated against the IA-12 andon budget — ✅ andon 40% reported against both the
> 10% standard and 5% keystone budgets, with the censored/gate-failed breakdown.

## Test coverage

- **No tests added** — this ticket writes no code. The instrument (`auditWalkAway` /
  `formatWalkAwayFindings`, `src/ledger/walk-away.ts`) is already suite-covered from T-014-01,
  including the thin/empty-data degradation paths exercised here (15 carriers, 1 intervention).
- **Verification is reproducibility:** the four captured commands re-run against the same
  ledger reproduce every figure; `audit-output.txt` is the frozen evidence. Every number in
  `findings.md` traces to that captured stdout — no recomputed or remembered figures.
- **Gap:** none specific to this ticket. The instrument's correctness is T-014's coverage, not
  this read's responsibility.

## Open concerns / handoff (what a human/E-014 must carry forward)

1. **The trend is not yet established — read it as thin, not as regression.** 100% → 88% is
   driven *entirely* by one `intervened=true` carrier landing in the recent half (n=15, single
   intervention). It cannot confirm or deny a "→ 100%" trajectory. **E-014's verdict may read
   the rate (93%) as genuine, but must not read the trend as a trust signal yet** — it needs
   more `--intervened` sessions to populate both halves with more than one data point.

2. **The self-report sample is homogeneous.** 14 of 15 carriers are clean walk-aways
   (`intervened=false`). The rate is honest, but KR2's "rate + → 100% trend from a mix" wants
   a richer spread of genuine step-ins. Today's mix is one. Follow-up: accrue a few more
   `--intervened` sessions when real step-ins genuinely occur (never fabricate the bit).

3. **Andon rate is well over budget (40% vs 5–10%) — by design here, but watch it.** 7 of the
   25 stops are censored (envelope/timeout walls), 3 gate-failed; these are gates and probe
   budgets working, not delivered-work defects, and the walk-away rate is independent (different
   denominator). Still, 40% over a 5% keystone budget is high — if it persists as the sample
   grows past the probe-heavy era, it warrants its own look (an envelope-recalibration question,
   T-013/recalibrate territory, not a trust-rate question).

4. **"≥10 sessions" = 15 carrier records, not 15 invocations.** One self-report stamps both the
   propose and decompose record of a chain (T-026-02 caveat). The count is honest as
   *observations*; do not read it as 15 independent sittings.

5. **The reading is a point-in-time snapshot (2026-06-19 22:54 PDT).** New casts append to the
   ledger and will shift the numbers. Re-run `vend audit` for a current read; this artifact
   freezes the read at the time the AC was satisfied.

## Bottom line

The "one number" is read and captured from genuine data: **93% walk-away over 15 carriers,
stated against the IA-12 budget.** The AC is fully met. The single substantive caveat for
downstream (E-014) is that the **rate** is real and favorable while the **trend** remains thin
— one intervention, not yet a trajectory.
