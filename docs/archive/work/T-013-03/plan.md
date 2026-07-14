# T-013-03 — Plan

*Ordered, independently-verifiable steps. Testing strategy per step. Each step commits
atomically (the loop commits; this sequences).*

Baseline: **383 tests, tsc clean.** Each step ends green before the next begins.

---

## Step 1 — `run-log.ts`: the project field + reader grouping (AC1)

**Change.** Add `DEFAULT_PROJECT`; add `project?: string` to `RunRecordInput` and
`RunRecord`; add private `normalizeProject`; spread `project` in `buildRunRecord` (after the
envelope spread) and `reviveRecord`; add exported `projectOf(r)`; widen `forPlay`'s opts
with `project?` and filter on `projectOf`.

**Verify.** `tsc` clean. New `run-log.test.ts` blocks:
- build with `project: "vend"` → record carries it; serialize→revive round-trips it.
- build with **no** project → field **absent** on the record (`"project" in rec === false`);
  `projectOf(rec) === DEFAULT_PROJECT`.
- a legacy JSONL line (no project) revives unchanged; `projectOf` → default.
- a malformed project (`project: 42` / `""`) is dropped on revive, record still valid.
- `forPlay(recs, play, { project })` selects only that project; legacy records group under
  `DEFAULT_PROJECT`; `{ outcome, project }` compose.

**AC trace:** AC1 (field carried, back-compat default, reader groups by project).

## Step 2 — `recalibrate.ts`: `learnBiasFactor` (AC2 substrate)

**Change.** Add `BiasFactor`, `BiasPrior`, `IDENTITY_FACTOR`, `DEFAULT_SHRINKAGE`. Add
`learnBiasFactor(records, opts?) → BiasPrior`: filter to `success` + has-`envelope`; window
to last `window`; per dim, ratio = actual/allocated (tokens always; time only when
`wallClockMs` non-null and `envelope.timeMs > 0` and tokens-allocated `> 0`); factor dim =
`percentile(sortedAsc, 0.5)` or `1` if empty; `n` = token-pair count; empty ⇒
`{ factor: IDENTITY_FACTOR, n: 0 }`. Import `projectOf` from run-log.

**Verify.** `tsc` clean. New tests:
- ratios `[0.2,0.3,0.4]` (actual vs envelope) → factor.tokens = median 0.3, `n=3`.
- a no-envelope success contributes **no** pair (n unchanged); a censored run excluded.
- null-stamp success drops from the **time** factor only; tokens factor intact.
- empty / all-no-envelope → `{ factor: {1,1}, n: 0 }`.
- direction: ratios `> 1` → factor `> 1` (under-estimate learned).

**AC trace:** AC2 (empirical bias factor from successful (allocated, actual) pairs,
censored excluded, direction data-driven).

## Step 3 — `recalibrate.ts`: `calibrate` + partial pooling (AC2/AC3)

**Change.** Add `CalibrateResult` and `calibrate(estimate, key, projectRecords,
genericPrior, opts?)`: filter `projectRecords` to key (play+project), `proj =
learnBiasFactor(…)`, `w = projectN/(projectN+K)`, per-dim `pooled = w·proj +
(1−w)·generic`, `corrected = positiveInt(estimate·pooled)`; return
`{ corrected, factor: pooled, confidence: { projectN, genericN } }`.

**Verify.** `tsc` clean. New tests (fix a generic prior, e.g. `factor {tokens:0.5}`, `n:40`):
- **N=0** project pairs → `corrected = estimate × generic` (pure prior); `projectN:0`.
- **small-N** (e.g. 2 project pairs, factor 0.2, K=5) → pooled between 0.5 and 0.2, nearer
  generic; `corrected` between the two.
- **large-N** (e.g. 50 pairs) → pooled ≈ project factor 0.2; `corrected` ≈ project value.
- **monotonic**: build records for projectN ∈ {0,1,5,20,100} with a fixed project ratio
  **below** generic; assert `corrected.tokens` **strictly decreases** as N grows (moves
  prior→project monotonically).
- **authored default**: empty project **and** `genericPrior = {factor:{1,1}, n:0}` ⇒
  `corrected === estimate` (no correction), `confidence {0,0}`.
- `corrected` dims are **positive integers** (budget contract); over- and under-estimate
  both round-trip (factor <1 shrinks, >1 grows).
- `opts.shrinkage` override changes the blend weight as expected.

**AC trace:** AC2 (return shape, confidence), AC3 (three regimes + monotonic prior→project).

## Step 4 — `recalibrate.ts`: `formatCorrectionLabel` (honest label)

**Change.** Add `formatCorrectionLabel(result)` → `"× t<f>/m<f> · N project / M generic"`,
2dp; `"uncorrected (no data)"` when both N are 0.

**Verify.** Tests: measured label string exact; no-data label exact.

**AC trace:** AC4/AC5 (the corrected figure is "tagged with how much data backs it").

## Step 5 — `cast.ts`: stamp the project (AC1 write side)

**Change.** Add `CastOptions.project?`; import `basename`; `const project = opts.project ??
basename(root)`; add `project` to the `appendRunLog` input beside `envelope: budget`.

**Verify.** `tsc` clean; full suite still 383+ green (cast.ts is the untested impure verb —
no new unit test; covered by the live smoke in Step 7). Confirm no existing cast/engine test
regresses.

**AC trace:** AC1 (records now carry a real, stable project id).

## Step 6 — `cli.ts`: `--estimate` / `--project` + correction line (AC4/AC5)

**Change.** Extend the `envelope` `ParsedCommand` variant + `parseEnvelopeArgs`
(`--estimate` via `parseBudgetArg`, `--project` token); extend `USAGE`; in the dispatch arm
compute `genericPrior`/`projectRecords`, call `calibrate` (estimate = `--estimate` ?? the
recalibrate envelope), print the `↳ corrected …` line; still exit 0.

**Verify.** `tsc` clean. New `cli.test.ts` parse tests:
- `envelope p --estimate 7200000,5000` → `estimate: { timeMs:7200000, tokens:5000 }`.
- `envelope p --project foo` → `project: "foo"`.
- `--estimate` with a bad value → `cmd: "usage"`.
- `--tier` + `--estimate` + `--project` compose; the bare two-arg form is unchanged
  (`estimate`/`project` absent).

**AC trace:** AC4 (measured default / raw estimate feeds through correction on the surface).

## Step 7 — Full gate + live smoke (AC5)

**Verify.**
- `bun run check` — baml:gen → `tsc --noEmit` → `bun test`, all green (target ≈ 383 + ~30
  new).
- **Live (AC5):** append a few synthetic successful records (with envelopes + a project) to
  a temp ledger, then `vend envelope <play> --estimate <ms>,<tokens>` against it and confirm
  the `↳ corrected` line shows a bias-corrected figure tagged `N project / M generic`. Also
  confirm the no-data path prints `uncorrected (no data)`.
- Write `progress.md` (deviations, if any), then `review.md`.

**AC trace:** AC5 (`bun run check:*` green; live corrected readout).

---

## Testing strategy summary
- **Pure cores unit-tested to the branch** (Steps 1–4, 6-parse): `run-log.test.ts`,
  `recalibrate.test.ts`, `cli.test.ts` — fabricated frozen records, no fs/clock/spawn.
- **Impure verbs (cast.ts, the cli dispatch shell) not unit-tested** — proven by the Step-7
  live smoke, per the house pattern (`appendRunLog`/`dispense`/the dispatch arm are all
  untested-by-design).

## Risks & mitigations
- **Divide-by-zero / NaN in a ratio** — guard: skip a pair whose allocated dim ≤ 0; `num`
  any non-finite to drop it. Tested with a zero-envelope fixture.
- **Monotonicity test flakiness** — hold the project ratio **fixed** across N (identical
  per-record ratio), vary only the count, so only `w` moves; assert strict direction.
- **Back-compat regression** — the absent-project round-trip test (Step 1) is the guard; the
  field is omitted-when-absent exactly like `envelope`.
- **Surface changing existing output** — the correction is an **added** line; the existing
  recalibrate line is untouched, so T-013-02's smoke/behavior is preserved.
