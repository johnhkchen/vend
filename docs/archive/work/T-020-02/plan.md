# T-020-02 — Plan: recalibrate-expand-honest-empty

> Ordered, independently-verifiable steps + the testing strategy. Implements `structure.md`. Each
> step is small enough to commit atomically; the deterministic gate (`bun run check`) is the hard
> bar, the live probe is the AC's directional evidence.

## Testing strategy (what proves what)

| Claim | How it's verified | Determinism |
|---|---|---|
| Prompt edit didn't break the typed shape | `bun run check` (`baml:gen` → `tsc` → `bun test`) green; `expand-core.test.ts` unchanged & passing | **deterministic** — hard gate |
| Grounded fragment stops abstaining (~0, was 33%) | probe `expand` on `grounded-fragment.txt`, read raw `gate-failed` tally (D4 asymmetry) | directional (live cast) |
| Thin fragment still abstains (negative control) | probe `expand-thin`, expect ≥1 `gate-failed` honest-empty STOP | directional (live cast) |

No new unit tests: the change is prompt prose + field `@description`s, which are not unit-testable
(house rule — `run-consistency-probe.ts` and BAML prompts are sweep/authoring surfaces, not tested;
their tested core is `expand-core.ts`, which is unchanged). The existing `expand-core.test.ts` is the
regression guard that the `Signal` shape and gate semantics are intact.

## Step 1 — Rewrite the `## Honest-empty` prompt section

Edit `baml_src/expand.baml` lines 68–72 per `structure.md` Edit 1: reframe abstention as the rare,
source-gated exception; add the concrete "cite ONE real source?" test; add the calibrated
thin-vs-grounded example pair; retain the no-fabrication / overproduction warning.

**Verify:** section reads as "extract by default, abstain only on nothing-to-read"; `{{ fragment }}`
/ `{{ charter }}` / `{{ project }}` / `{{ ctx.output_format }}` interpolations intact; the adjacent
Read-never-invent and Otherwise-author sections untouched.

## Step 2 — Tighten the `what` / `why` field `@description`s

Edit `baml_src/expand.baml` lines 43–44 per `structure.md` Edit 2: the blank clause becomes "ONLY
when the fragment grounds NOTHING at all … a rough-but-grounded fragment is a SIGNAL, not an
abstention." Field **names/types/order** and the `SignalTier` enum unchanged.

**Verify:** diff shows only description-string text changed inside the `Signal` class; no structural
token (`class`, field name, type, `@alias`) touched.

## Step 3 — Regenerate the BAML client

`bun run baml:gen`. The new prompt + descriptions are embedded in the generated request-builders.

**Verify:** command exits 0; `git status` shows changes only under `baml_client/` (regenerated) +
`baml_src/expand.baml` (the edits) — nothing else.

## Step 4 — Run the deterministic gate

`bun run check` (`baml:gen` idempotent → `tsc --noEmit` → `bun test`).

**Verify (the hard bar):** exits 0, all tests pass (expect the same count as before the change —
~610 per the T-021-01 session note; expand-core tests green). If `tsc` or any test fails, the prompt
edit altered the shape — fix before proceeding. This step is the AC's "`bun run check` stays green"
(inherited from the story-level discipline).

## Step 5 — Commit the recalibration (atomic, gate-green)

Commit `baml_src/expand.baml` + the regenerated `baml_client/**` together:
`feat(expand): tighten honest-empty abstention to fire only on ungroundable fragments (T-020-02)`.

**Verify:** `git status` clean for source; `bun run check` still green at HEAD.

## Step 6 — Live probe: the AC's directional evidence

Run both sweeps (N=2, the T-020-01 precedent; small N = directional, E-014), capture to
`docs/active/work/T-020-02/sweep-logs/`:

```bash
mkdir -p docs/active/work/T-020-02/sweep-logs
bun run src/probe/run-consistency-probe.ts expand docs/active/work/T-019-02/fixtures/grounded-fragment.txt 2 \
  | tee docs/active/work/T-020-02/sweep-logs/expand.log
bun run src/probe/run-consistency-probe.ts expand-thin 2 \
  | tee docs/active/work/T-020-02/sweep-logs/expand-thin.log
```

**Verify (AC, directional):**
- `expand.log`: raw `gate-failed` count ~0 across casts (the honest-empty over-fire is gone). Read
  the **raw run-log outcomes** line, NOT the headline mix (D4: expand's honest-empty folds into
  `budget-exhausted` in the mix).
- `expand-thin.log`: ≥1 `gate-failed` honest-empty STOP — the negative control still fires.
- If a single outlier dominates the tiny N (e.g. one budget-exhausted churn), note it honestly
  (IA-8) in `progress.md`/`review.md`; the AC is the gate-failed *rate*, distinct from
  budget-exhaustion.

These are live, non-deterministic casts (minutes each, real tokens). They are run in the background
and may not all complete within the session; the deterministic gate (Step 4) is the blocking bar, the
probe is the documented directional evidence. If casts are still running at Review time, record the
partial result and the exact reproduction command (above) — artifacts are insurance (RDSPI rule 5).

## Commit boundary

- Steps 1–5: one atomic commit (source + regenerated client), gate-green.
- Step 6 logs: committed as probe artifacts after capture (the `chore(probe)` precedent from
  T-020-01), separate from the source change.

## Rollback

Single-file source change — `git revert` of the Step 5 commit restores the prior prompt and
regenerated client. No data migration, no schema change, no cross-file coupling.
