# T-002-04 — Plan: live-dispense-proof

Ordered, independently-verifiable steps. This is a **spike**: the "implementation" is
building the apparatus and then *running it live* and recording the result. Steps 1–3
are deterministic and committable; step 4 is the live run (non-deterministic, real
credits); steps 5–7 turn evidence into the deliverable.

## Step 1 — Fixtures

Create `fixtures/tiny.md` (small groundable epic) and `fixtures/underspecified.md`
(contentless, to trip the value gate). 
**Verify:** both have valid frontmatter (`id:` present so `epicIdOf` logs a real id);
`underspecified.md` names nothing groundable.
**Commit:** "T-002-04: live-proof fixtures (tiny + under-specified epics)".

## Step 2 — The driver `live-proof.ts`

Write the driver per structure.md: `prepSandbox` (lisa init + copy charter),
`runScenario` (wall-clock-wrapped `runDecomposeEpic` with `projectRoot`/`runId`/
`transcriptDir`; reads true model id + usage from the transcript), `main` (sequential
run of the 4 scenarios → `results/summary.json` + `results/e001-machine-plan.md`).
**Verify (no live call yet):** `bun run check:typecheck` clean (driver typechecks
against the real `RunSummary`/`Budget` types); `bun run check` stays **114 pass**.
**Commit:** "T-002-04: live-proof driver (4 sandboxed scenarios)".

## Step 3 — `.gitignore` sanity

Confirm `.vend/` is ignored (it is) so sandboxes/transcripts/ledger never stage.
**Verify:** after a dry run, `git status` shows no `.vend/` entries.

## Step 4 — The live run (the spike's core)

`bun docs/active/work/T-002-04/live-proof.ts` from the repo root.
Each scenario, sequentially:
- **A1** (E-001, generous budget, sandbox): expect `success` + `materialized:true` +
  `· lisa validate ✓`. If it stops on a gate or returns malformed output, re-attempt
  (design D4); if still stopping, record it as the headline kaizen finding (do **not**
  weaken a gate).
- **A2** (tiny epic, `tokens:1`): expect `budget-exhausted`, `materialized:false`.
- **A3** (under-specified epic, generous budget): expect `gate-failed` with a **named**
  gate/unit/reason on stdout + in the log; `materialized:false`.
- **A4** (tiny epic, `timeMs:1`): expect `timed-out`, near-zero cost,
  `materialized:false`.

**Verify (the ACs):**
- `wc -l .vend/runs.jsonl` == 4 (AC1 — countable log; one record per run).
- A1 sandbox: `lisa validate --path .vend/live-proof/A1` == "All checks passed"
  (AC1 — lisa-valid materialized files). Re-run independently of the runner's own
  validate to double-confirm.
- A2 + A4: no files under the sandbox `docs/active/{stories,tickets}` (AC2 — no
  partial materialization); outcomes are the two P7 dimensions.
- A3: the run-log record's `gateResults` carries one `passed:false` row naming the
  gate + reason; no materialized files (AC3 — named stop, no garbage).
- `jq` the ledger to confirm every record has `usage`, `costUsd`, `outcome`.

## Step 5 — Capture the AC4 numbers

From `results/summary.json` + the transcripts + the ledger, assemble the
tokens / cost / wall-clock figures and the **true model id** (read off each
transcript's terminal `result`, not the `claude-cli-default` sentinel).
**Verify:** numbers in `summary.json` reconcile with `jq` over `.vend/runs.jsonl`.

## Step 6 — `proof.md` (the deliverable)

Write the human note: results table; the **E-001 by-hand vs machine** diff
(`results/e001-machine-plan.md` vs E-001.md's 2-stories/8-tickets/critical-path-5);
per-AC confirmation; the first kaizen signals (prompt fidelity, gate behavior,
sentinel-model gap, cross-board id collision). Quote the recorded evidence.
**Verify:** every AC in the ticket is explicitly addressed with evidence.
**Commit:** "T-002-04: live-proof results + kaizen note (proof.md + summary)".

## Step 7 — `progress.md` then `review.md`

`progress.md`: what was built/run, deviations from this plan, actual outcomes.
`review.md`: the RDSPI handoff — what changed, AC status, test coverage (this spike
adds no unit tests by design; it adds *live evidence*), open concerns, critical issues.

## Testing strategy

- **No new unit tests.** Every pure unit on the live path is already tested (114
  green); the driver is impure apparatus composed of tested verbs (house rule: an
  impure verb whose logic lives in tested cores is untested — same as the CLI
  dispatch). The spike's "test" is the **live run itself** + the AC verifications in
  step 4.
- **Regression safety:** `bun run check` before and after (must stay 114 pass / 0
  TS errors); the only `src/`-adjacent addition is the driver, which `tsc` covers.
- **Determinism caveat:** the live outcomes are not asserted in CI — they are recorded.
  The driver is re-runnable for manual re-proof.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| A1 trips a gate / malformed parse (first live round-trip) | Re-attempt; if persistent, record as kaizen #1 — never weaken a gate |
| Under-specified epic unexpectedly clears (A3) | Sandbox isolation ⇒ harmless; record as a finding (gate too lax / model too generous) |
| `claude -p` not logged in / launch failure | Surfaces as a thrown launch error; precondition checked in Research (claude 2.1.181 on PATH) |
| Live board mutation | Structurally impossible — every run uses a sandbox `projectRoot` (D2) |
| Credit spend | Fixtures small; A2/A4 use tiny epic; sequential run keeps spend visible |
