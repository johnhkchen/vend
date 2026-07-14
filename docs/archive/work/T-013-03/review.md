# T-013-03 — Review

*The handoff: what changed, test coverage, open concerns. Enough to review without reading
every diff.*

Reference-class bias correction (IA-16): the run log becomes a calibration dataset that
learns the systematic estimate-vs-actual ratio per {play, project} and corrects a raw
estimate, with hierarchical partial pooling (project → generic play prior → authored
default). The third and final rung of E-013 (after T-013-01's readable log + envelope and
T-013-02's percentile recalibrate).

## Files changed

| File | Change |
|------|--------|
| `src/log/run-log.ts` | **+** `DEFAULT_PROJECT`, `project?` on `RunRecordInput`/`RunRecord`, private `normalizeProject`, `project` spread in `buildRunRecord`/`reviveRecord`, exported `projectOf(r)`, `project?` opt on `forPlay`. |
| `src/ledger/recalibrate.ts` | **+** `BiasFactor`, `BiasPrior`, `CalibrateResult`, `CalibrateOptions`, `DEFAULT_SHRINKAGE`, `IDENTITY_FACTOR`, private `medianOrNull`, `learnBiasFactor`, `calibrate`, `formatCorrectionLabel`. |
| `src/engine/cast.ts` | **+** `CastOptions.project?`; stamps `project = opts.project ?? basename(root)` on the run-log record. |
| `src/cli.ts` | **+** `--estimate`/`--project` on `vend envelope` (parser + `ParsedCommand` variant + `USAGE`); dispatch arm prints a bias-corrected second line. |
| `src/log/run-log.test.ts` | **+** project round-trip / default / malformed / `forPlay`-by-project blocks. |
| `src/ledger/recalibrate.test.ts` | **+** `learnBiasFactor`, `calibrate` (3 regimes + monotonicity + direction + budget contract), `formatCorrectionLabel` blocks. |
| `src/cli.test.ts` | **+** envelope `--estimate`/`--project`/compose/error parse tests. |

No files deleted; no public signatures changed (all additions are optional fields / new
exports). The existing `recalibrate`, `forPlay({outcome})`, and the bare `vend envelope`
output are untouched.

## Acceptance criteria — all met

- **AC1 — stable project id, back-compat, groupable.** `project?` added with the exact
  `envelope?` idiom: omitted-when-absent on write, dropped-if-malformed on read, so legacy
  records round-trip byte-identical (tested). `projectOf(r)` derives `DEFAULT_PROJECT` for
  absent. `forPlay(recs, play, { project })` groups a play's runs by project (tested,
  composes with `outcome`). `cast.ts` stamps the repo-root basename so real runs are tagged.
- **AC2 — pure `calibrate`, empirical bias factor, direction data-driven.** `calibrate(estimate,
  {play, project}, projectRecords, genericPrior)` → `{ corrected, factor, confidence: {
  projectN, genericN } }`. The factor is the median actual/allocated ratio over **successful**
  runs that carry an envelope (censored excluded — IA-13; no-envelope runs skipped). A factor
  `< 1` shrinks, `> 1` grows — no over/under branch (tested both directions).
- **AC3 — partial pooling, three regimes, monotonic.** Empirical-Bayes shrinkage
  `w = projectN/(projectN+K)`, `K=5`. Tested at N=0 (pure generic), small-N (shrunk toward
  generic), large-N (project-dominant), and a dedicated monotonicity test asserting the
  corrected estimate strictly moves prior→project as project-N grows.
- **AC4 — measured default feeds through.** The `vend envelope` arm corrects the recalibrate
  measured default by default, or a supplied `--estimate`; both print a confidence-tagged
  corrected figure (live-smoked: `2h → 36 min` corrected).
- **AC5 — `bun run check:*` green + live check.** `bun run check` = baml:gen → tsc → test, all
  green (415 tests). Live smoke fed a raw estimate and saw it corrected against the play's
  measured history, tagged `N project / M generic`.

## Test coverage

- **+32 tests** (383 → **415**), all green; tsc clean.
- **Pure cores covered to the branch** on fabricated frozen records (no fs/clock/spawn), per
  the house pattern: the project field (round-trip, default, malformed, grouping),
  `learnBiasFactor` (median per dim, no-envelope skip, censored exclusion, null-time drop,
  identity on empty, direction), `calibrate` (the three pooling regimes, monotonicity,
  authored default, key-filtering, positive-int contract, tunable K), `formatCorrectionLabel`,
  and the CLI flag parsing.
- **Impure verbs untested-by-design** (house pattern): `cast.ts`'s project stamp and the
  `cli.ts` dispatch arm are proven by the **live smoke**, exactly as `appendRunLog`/`dispense`
  and every other dispatch arm are.

### Gaps / things a reviewer should weigh

1. **`learnBiasFactor` uses a true median, deviating from the design's "reuse
   `percentile(·,0.5)`."** Rationale in progress.md §Deviations: nearest-rank is conservative
   for a fat *tail*; the bias factor is a *centre*, so the textbook median is honest and matches
   expectation. Low-risk, but it is a deliberate divergence from the written design.
2. **`confidence.projectN` / `genericN` count TOKEN pairs only.** The time sample may be smaller
   (null-stamp records drop from time). The headline N is the token-pair count (tokens are always
   present when an envelope is); the time factor silently uses its own (possibly smaller) sample.
   Honest but not separately surfaced — acceptable for a display-only rung.
3. **Shrinkage `K=5` and the median-of-ratios estimator are unvalidated against real data.** They
   are principled defaults (Beta-Binomial-shaped posterior mean; robust centre), not tuned. `K`
   is an `opts` knob; tuning is a follow-up once the log accrues real {play, project} history.

## Open concerns / follow-ups (all out of scope by design)

- **Actuation deferred (IA-14).** This rung *displays* the corrected envelope; it does not change
  the budget a real cast dispatches under. Wiring it into the press/chain default needs
  deadband + asymmetric hysteresis (anti-flap) — a later rung. The `vend envelope` arm exits 0
  unconditionally to make the read-only contract explicit.
- **Cross-project generic corpus (charter P5).** The generic prior pools only *this* local log's
  other projects. A true outside view across repos needs a user-global store — a documented
  follow-up, deliberately not this local-first slice.
- **Ticket cites `src/budget/recalibrate.ts`; the module actually lives at
  `src/ledger/recalibrate.ts`** (T-013-02 Decision A). The new code correctly extends the real
  `src/ledger/` location; the ticket's path reference is stale, not the code.

## Risk assessment: **low.**

All changes are additive (optional fields, new pure exports, additive CLI flags); no existing
signature, record shape, or output line changed; legacy records round-trip byte-identical
(tested); the new behavior is display-only with no actuation. The one design divergence (true
median) is documented and low-risk.
