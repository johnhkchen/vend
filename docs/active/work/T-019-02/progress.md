# T-019-02 — Progress: run the sweep and produce findings

## Status: harness extended + gate green; live sweep running (expand-first)

## Step-by-step

| Step | What | State |
|---|---|---|
| 1 | Extend harness — expand + steer targets, async `resolveTarget`, `SUPPORTED` | ✅ done, `tsc` clean |
| 2 | Author fixed grounded fragment (`fixtures/grounded-fragment.txt`) | ✅ done |
| 3 | `bun run check` green + CLI-guard smokes | ✅ 586 pass; guards exit 2 |
| 4 | Live sweep — all 3 plays, N=3, real budgets | ✅ **all 9 casts completed** |
| 5 | Write `findings.md` (real numbers + verdict) | ✅ done |
| 6 | `review.md` handoff | ✅ done |

## Live sweep results (all arms completed in-session)

| Play | outcomes (3 casts) | signal dispersion | honest-empty | budget-exhausted |
|---|---|---|---|---|
| expand | HE(STOP), signal, signal | 0.50 over 2 | 33% (raw `gate-failed`, D4) | 0 |
| survey | HE, signal, HE | n=1 (not meaningful) | 67% (mix) | 0 |
| steer | signal, signal, signal | 0.72 over 3 | 0% | 0 |

**Verdict: consistency NOT yet acceptable — tune the gates.** Honest-empty gate over-fires on
grounded input (survey 67% / expand 33% false negatives); signal content unbounded run-to-run
(steer 0.72 / expand 0.50). **Budgets vindicated** (0/9 exhausted — E-018 recalibration held).
E-016 finding (2) confirmed + generalized. Full write-up + the 2 demand.md bridge signals +
the kaizen instrument signal: `findings.md`.

## What was built

- **`src/probe/run-consistency-probe.ts`** extended (the only source edit):
  - value-imports `expandFragmentPlay`/`assembleExpandFragmentInputs` + `steerProjectPlay`/
    `assembleSteerInputs` (self-register + resolve their assemble verbs);
  - `seedBoardSnapshot(root)` helper (copies the live stories+tickets — the grounded id space);
  - `expandTarget(fragment)` — charter + board snapshot, `assembleExpandFragmentInputs`, default
    abstention (expand STOPs ⇒ honest-empty is non-success, read from the raw tally — D4);
  - `steerTarget()` — charter + board snapshot, `assembleSteerInputs`, marker-keyed abstention
    (`# Steer — nothing to stage` / `honest empty steer`);
  - `resolveTarget` is now `async` (expand reads its fragment file); cases for `expand` /
    `expand-fragment` (fragment required) and `steer`;
  - `SUPPORTED = [decompose-epic, survey, expand, steer]`; usage hint updated.
- **`fixtures/grounded-fragment.txt`** — the fixed grounded input for expand (a real, evidenced
  observability gap: the andon stop-reason is stdout-only, never on the run record). Charter-correct
  outcome = a clean priced signal, so any honest-empty is a false negative (over-eager abstention).

## Verifications run

- `bun run check:typecheck` — clean.
- `bun run check` — **586 pass, 0 fail**, typecheck clean (AC#4).
- CLI guards: no-args / unsupported play / `expand` without a fragment → usage + **exit 2**.
- `consistency.ts`, `consistency.test.ts`, `variance.ts`, `run-probe.ts` — untouched (T-019-01
  AC#3 carried forward; the generalization is exercised, not modified).

## Live sweep

- `bun run src/probe/run-consistency-probe.ts expand fixtures/grounded-fragment.txt 3` →
  `sweep-logs/expand.log` (background). N=3, expand's real recalibrated budget (250k/cast).
  Expand first: it is the direct confirm/refute of E-016 finding (2) and the cheapest arm.
- survey / steer (N=3 each, 300k / 400k per cast) launched next as time/quota allow; any arm not
  completed in-session is reported in `findings.md` as **pending the at-sweep human run** (AC#4)
  with its exact command — never fabricated (E-014 honest-sample discipline).

## Deviations from plan

- **Full live sweep completed in-session** (plan/AC#4 allowed deferring arms to the at-sweep human
  run). All three plays ran concurrently in the background at real budgets, N=3 — no arm deferred.
- **No-pollution invariant verified post-hoc:** the only `git status` change under
  `docs/active/pm/staged/` (`graph-view-human-projection.md`) was **pre-existing** (in the
  session-start snapshot), not sweep output; `.vend/` and the staged count (4) are untouched — every
  cast wrote to a disposable `/var/folders/.../vend-consistency-*` temp root.
- **AC#3 (T-019-01) carried forward:** `run-probe.ts` / `consistency.ts` / `variance.ts` show an
  empty `git diff` — the generalization was *exercised*, not modified.
