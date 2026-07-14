# T-020-03 — Plan: recalibrate-survey-honest-empty

> Ordered, independently-verifiable steps + the testing strategy. Implements `structure.md`. Each
> step is small enough to commit atomically; the deterministic gate (`bun run check`) is the hard
> bar, the live probe is the AC's directional evidence.

## Testing strategy (what proves what)

| Claim | How it's verified | Determinism |
|---|---|---|
| Prompt edit didn't break the typed shape | `bun run check` (`baml:gen` → typecheck → `bun test`) green; `survey-core.test.ts` unchanged & passing | **deterministic** — hard gate |
| Demand-rich board stages signals (HE ~0, was 67%) | probe `survey` on the live board, read the **headline mix** `honest-empty rate` (NO D4 fold — survey HE is a `success`) | directional (live cast) |
| Complete/frozen board still abstains (negative control) | probe `survey-thin`, expect ≥1 `honest-empty` marker | directional (live cast) |

No new unit tests: the change is prompt prose + a field `@description`, which is not unit-testable
(house rule — `run-consistency-probe.ts` and BAML prompts are sweep/authoring surfaces, not tested;
their tested core is `survey-core.ts`, which is unchanged). The existing `survey-core.test.ts` is the
regression guard that the `Board`/`Signal` shape and gate semantics are intact.

## Step 1 — Rewrite the `## Honest-empty (IA-4)` prompt section

Edit `baml_src/survey.baml` lines 53–57 per `structure.md` Edit 1: reframe abstention as the rare,
source-gated exception; add the concrete "read ONE real demand off the project?" test; add the
calibrated complete/frozen-vs-has-open-work example pair at board scale; retain the no-fabrication /
overproduction warning.

**Verify:** section reads as "stage by default, abstain only on a complete/frozen project"; the
`{{ charter }}` / `{{ project }}` / `{{ ctx.output_format }}` interpolations intact; the adjacent
Read-never-invent and Otherwise-author sections untouched.

## Step 2 — Tighten the `Board.signals` `@description`

Edit `baml_src/survey.baml` line 33 per `structure.md` Edit 2: the empty clause becomes "EMPTY ONLY
when the project is complete/frozen and grounds NO demand … a project with ANY open work or
vision-distance stages a ranked board, never an empty one." Field **name/type** and the `Board` class
structure unchanged.

**Verify:** diff shows only the description-string text changed inside the `Board` class; no
structural token (`class`, `signals`, `Signal[]`) touched.

## Step 3 — Regenerate the BAML client

`bun run baml:gen`. The new prompt + description are embedded in the generated request-builders.

**Verify:** command exits 0; `git status` shows changes only in `baml_src/survey.baml` (the edits) —
`baml_client/` is gitignored, so it will not appear.

## Step 4 — Run the deterministic gate

`bun run check` (`baml:gen` idempotent → typecheck → `bun test`).

**Verify (the hard bar):** exits 0, all tests pass (expect the same count as before the change —
~639 per the T-020-02 session note; `survey-core` tests green). If typecheck or any test fails, the
prompt edit altered the shape — fix before proceeding. This step is the AC's "`bun run check` stays
green" (inherited from the story-level discipline).

## Step 5 — Commit the recalibration (atomic, gate-green)

Commit `baml_src/survey.baml` only (`baml_client/**` is gitignored, per T-020-02's observed deviation):
`feat(survey): tighten honest-empty abstention to fire only on demand-free boards (T-020-03)`.

**Verify:** `git status` shows `baml_src/survey.baml` committed; `bun run check` still green at HEAD.

## Step 6 — Live probe: the AC's directional evidence

Run both sweeps (N=2, the T-020-01 / T-020-02 precedent; small N = directional, E-014), capture to
`docs/active/work/T-020-03/sweep-logs/`:

```bash
mkdir -p docs/active/work/T-020-03/sweep-logs
bun run src/probe/run-consistency-probe.ts survey 2 \
  | tee docs/active/work/T-020-03/sweep-logs/survey.log
bun run src/probe/run-consistency-probe.ts survey-thin 2 \
  | tee docs/active/work/T-020-03/sweep-logs/survey-thin.log
```

**Verify (AC, directional):**
- `survey.log`: `honest-empty rate ~0` across casts (the over-fire is gone, was 67%). Read the
  **headline consistency-report mix** directly — survey's honest-empty is a CLEAR+marker `success`, so
  (unlike expand's D4 asymmetry) it shows correctly in the mix; the run-to-run *flip* on the
  demand-rich board should disappear.
- `survey-thin.log`: ≥1 `honest-empty` marker — the negative control still fires (tightened, not
  disabled).
- If a single outlier dominates the tiny N (e.g. one budget-exhausted churn or one defensible
  "saturated board" abstention), note it honestly (IA-8) in `progress.md`/`review.md`; the
  unambiguous target is removing the run-to-run flip on grounded input, distinct from a hard 0.

These are live, non-deterministic casts (minutes each, real tokens). They are run in the background
and may not all complete within the session; the deterministic gate (Step 4) is the blocking bar, the
probe is the documented directional evidence. If casts are still running at Review time, record the
partial result and the exact reproduction command (above) — artifacts are insurance (RDSPI rule 5).

## Commit boundary

- Steps 1–5: one atomic commit (source only), gate-green.
- Step 6 logs: committed as probe artifacts after capture (the `chore(probe)` / separate-artifact
  precedent from T-020-01 / T-020-02), separate from the source change.

## Rollback

Single-file source change — `git revert` of the Step 5 commit restores the prior prompt and
regenerated client. No data migration, no schema change, no cross-file coupling.
