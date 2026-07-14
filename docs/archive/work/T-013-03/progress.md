# T-013-03 — Progress

*What was completed, what remains, deviations from the plan.*

## Status: implementation complete — all 7 steps done, `bun run check` green (415 tests).

| Step | Plan | Status |
|------|------|--------|
| 1 | `run-log.ts`: `project?` field + `projectOf` + `DEFAULT_PROJECT` + `forPlay` project opt | ✅ done, 51/51 run-log tests green |
| 2 | `recalibrate.ts`: `learnBiasFactor` + `BiasFactor`/`BiasPrior` | ✅ done |
| 3 | `recalibrate.ts`: `calibrate` + partial-pooling shrinkage | ✅ done |
| 4 | `recalibrate.ts`: `formatCorrectionLabel` | ✅ done (38/38 ledger tests green) |
| 5 | `cast.ts`: stamp `project = basename(root)` on the record | ✅ done |
| 6 | `cli.ts`: `--estimate` / `--project` + correction line | ✅ done (cli parse tests green) |
| 7 | full gate + live smoke | ✅ `bun run check` green; live smoke confirmed all 3 AC scenarios |

## Deviations from the plan

1. **`learnBiasFactor` uses a TRUE median, not `percentile(·, 0.5)`.** The plan/structure/design
   said to reuse T-013-02's nearest-rank `percentile` at 0.5. During Step 2 the tests showed
   nearest-rank returns the *lower* of the two central values for even-sized samples (median of
   `[0.2, 0.4]` → `0.2`, not `0.3`). `recalibrate`'s nearest-rank is deliberately conservative
   because it bounds a fat **tail**; the bias factor is a **central-tendency** estimate, where the
   textbook median (average the two central order statistics for even n) is the honest centre and
   matches expectation. Added a small private `medianOrNull` instead. It is still robust to
   outliers (one extreme ratio can't drag it — IA-13). Documented inline; the percentile primitive
   is still reused by `recalibrate` unchanged.

2. **Two `calibrate` test assertions corrected for pooling semantics (test-only).** Initial tests
   asserted `result.factor` equalled the *raw* project ratio; `factor` is the *pooled* blend
   (project shrunk toward the prior), so with a single project pair and an empty/identity prior the
   pooled factor is ~0.98, not 0.9. Tests updated to assert the pooled value and to use
   `projectN` for the filtering check. No source change — the behavior was correct; the test
   expectations were.

No other deviations. Signatures, return shapes, the three-level hierarchy
(project → generic → authored default), the surface, and the file set all match the
structure/plan.

## Verification performed

- **`bun run check`** (baml:gen → `tsc --noEmit` → `bun test`): **415 pass, 0 fail** (baseline
  was 383; +32 new tests across run-log/ledger/cli).
- **Live smoke** against a synthetic 11-record ledger (8 successful smokeproj runs with
  envelopes at ~0.25–0.32 token ratio, 2 censored, 1 other-project):
  - measured default `9000 tok / 180000 ms` fed through → `2583 tok / 54000 ms`, labelled
    `× t0.29 / m0.30 · 8 project / 9 generic` (generic pools the other project too — the
    hierarchy is visible);
  - a raw `--estimate 7200000,10000` → `2870 tok / 2160000 ms` (overestimate corrected down,
    direction data-driven);
  - a play with no history → `uncorrected (no data)`, the estimate passing through verbatim,
    exit 0 (read-only — no actuation).

## Not done (out of scope by design — see design.md "defers")

- Actuation of the corrected budget into a live dispatch (IA-14 — deadband/hysteresis).
- A cross-project user-global generic corpus (charter P5 follow-up; the generic prior here pools
  only the local log's other projects).
- Variance-weighted shrinkage (`N/(N+K)` is the honest minimal form).
