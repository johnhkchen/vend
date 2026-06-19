# T-020-03 — Progress: recalibrate-survey-honest-empty

> Tracks Implement against `plan.md`. Updated as steps complete; deviations recorded with rationale.

## Status: implementation complete; live-probe verification in progress

| Step | State | Notes |
|---|---|---|
| 1 — rewrite `## Honest-empty (IA-4)` prompt section | ✅ done | `baml_src/survey.baml` — rare/source-gated reframe + board-scale calibrated example pair |
| 2 — tighten `Board.signals` `@description` | ✅ done | empty clause now "EMPTY ONLY when the project is complete/frozen and grounds NO demand … a project with ANY open work or vision-distance stages a ranked board" |
| 3 — `bun run baml:gen` | ✅ done | 14 files written; new prompt text verified in `baml_client/inlinedbaml.ts` (`complete/frozen` present) |
| 4 — `bun run check` (deterministic gate) | ✅ **green** | **639 pass / 0 fail**, `tsc` clean, `baml:gen` clean — no shape regression |
| 5 — commit (atomic, gate-green) | ✅ done | `6fed23e` — `baml_src/survey.baml` only (`baml_client/` is gitignored) |
| 6 — live probe (AC directional evidence) | ⏳ running | `survey` + `survey-thin`, N=2, background → `sweep-logs/` |

## What changed

**`baml_src/survey.baml`** (prompt-only, the only authored surface — `baml_client/` is a gitignored
`baml:gen` artifact):

1. **`## Honest-empty (IA-4)` section** rewritten from a co-equal "If the project grounds NO real
   demand gradient … ABSTAIN / Otherwise author" branch into a **rare, source-gated exception**: a
   concrete "can you read even ONE real demand off the project — an open item, a TODO, a run-log fact,
   a vision-distance not yet closed?" test (read → stage, name the source in `grounding`; nothing to
   read → abstain), plus a **board-scale calibrated example pair** (complete/frozen all-`done` project
   → ABSTAIN empty board; project with open work / vision-distance → STAGE the ranked board), and an
   explicit "do NOT abstain because the board is large, partly-captured, or saturated."
2. **`Board.signals` `@description`** tightened so the type-level instruction the model sees via
   `{{ ctx.output_format }}` matches the prose ("EMPTY ONLY when the project is complete/frozen and
   grounds NO demand … a project with ANY open work or vision-distance stages a ranked board").

**Unchanged (as designed):** `src/play/survey-core.ts` (+ test), `src/play/survey.ts`,
`src/probe/run-consistency-probe.ts`, `baml_src/expand.baml`. No field names/types/enum touched — the
generated `Board`/`Signal`/`SignalTier` shape is byte-stable, which `bun run check`'s 639 green tests
confirm.

## Deviations from plan

- **No Edit 3 (Signal field descriptions) — by design.** Unlike T-020-02, survey does not touch
  `Signal.what`/`.why`: those live in `baml_src/expand.baml` and were already recalibrated by the
  merged T-020-02. Survey reuses the type, inheriting the tightened per-signal blank instruction for
  free. This was anticipated in `structure.md` §"Why no Edit 3" — recording here for the audit trail.
- **`baml_client/` is gitignored** (matches T-020-02's observed deviation), so Step 5's commit is
  `baml_src/survey.baml` *only*; the regenerated client is never tracked. The prompt edit fully
  propagates via `baml:gen` at build/check time.
- **Concurrent threads on-branch.** `git status` shows unrelated changes (T-021-02, sibling sweep
  logs) from other Lisa threads. The commit was scoped to `baml_src/survey.baml` only — no
  cross-thread capture.

## Step 6 — live probe (directional, the AC)

Running in background (live BAML/Claude casts, minutes each; N=2 = directional per E-014):

```bash
bun run src/probe/run-consistency-probe.ts survey 2
bun run src/probe/run-consistency-probe.ts survey-thin 2
```

**Expected (AC):**
- `survey.log` — `honest-empty rate ~0` across casts (was 67%, T-019-02). Read the **headline mix**
  directly: survey's honest-empty is a CLEAR+marker `success`, so it shows correctly in the mix (no D4
  fold, unlike expand). The run-to-run *flip* on the demand-rich board should disappear.
- `survey-thin.log` — **≥1 `honest-empty` marker** persists (the negative control: tightened, not
  disabled).

Results are recorded in `review.md` once the casts land. If they are still running at session end,
the logs under `sweep-logs/` + the reproduction commands above are the insurance (RDSPI rule 5); the
deterministic gate (Step 4, green) is the blocking bar.
