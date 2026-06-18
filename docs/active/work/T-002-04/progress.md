# T-002-04 — Progress

Implement-phase log for the live-dispense-proof spike. Status: **complete** — all four
scenarios ran live and matched expectations on the first pass; all four ACs proven.

## What was built (apparatus, per structure.md)

| File | Status |
|---|---|
| `fixtures/tiny.md` | ✅ small groundable epic (E-900, run-log pretty-printer) — A2/A4 input |
| `fixtures/underspecified.md` | ✅ contentless epic (E-901) — A3 gate-trip input |
| `live-proof.ts` | ✅ driver: 4 sandboxed scenarios over the real `runDecomposeEpic` |
| `results/summary.json` | ✅ generated — per-scenario outcome/usage/cost/wallclock |
| `results/e001-machine-plan.md` | ✅ generated — A1's materialized plan for the AC4 diff |
| `proof.md` | ✅ the AC4 deliverable + kaizen note |

**No `src/` file was created, modified, or deleted** (spike). `bun run check` stayed
**114 pass / 0 fail / 0 TS errors** before and after.

## Execution (plan.md steps)

1–3. Fixtures + driver written; driver typechecked directly (tsconfig only `include`s
`src`, so the work-dir driver was checked with an explicit `tsc` invocation — clean).
`.vend/` confirmed gitignored.

4. **Live run** (`bun docs/active/work/T-002-04/live-proof.ts`, exit 0), sequential:
   - A1 → `success`, 10 files, `· lisa validate ✓`, 78,341 tok, $0.44, 76 s.
   - A2 → `budget-exhausted` (spent 119,393/1), 0 files, $0.44, 56 s.
   - A3 → `gate-failed` (`value` / `<plan>`: "plan has no tickets — … malformed/empty"),
     0 files, $0.17, 20 s.
   - A4 → `timed-out`, 0 files, $0, 3 ms.

5–6. Numbers captured into `summary.json`; true model id (`claude-opus-4-8[1m]`) read
   off the transcripts; `proof.md` written with the by-hand-vs-machine diff.

## Verification (the ACs)

- `wc -l .vend/runs.jsonl` = **4** (one countable record per run). AC1.
- `lisa validate --path .vend/live-proof/A1` = "All checks passed. 8 tickets, 1 ready,
  DAG valid." (re-run independently of the runner's own validate). AC1.
- `find …/A{2,3,4}/docs/active/{stories,tickets} -name '*.md'` = **0** each → no partial
  materialization on any stop. AC2/AC3.
- A3 run-log record carries `{"gate":"value","passed":false}` with the named reason. AC3.
- Live board untouched: no new untracked files under `docs/active/{stories,tickets}`
  (the 8 pre-existing `M` tickets predate this session). Sandboxing held.

## Deviations from plan.md

1. **No re-attempt needed for A1.** plan.md provisioned a retry if the first live
   round-trip tripped a gate or returned malformed output. It cleared on the **first
   attempt** — so the retry path was not exercised.
2. **Added a disk-level materialization check** (`countMaterialized`) to the driver,
   over and above the `RunSummary.materialized` flag, to prove AC2/AC3 "no garbage" by
   inspecting the sandbox board directly rather than trusting the runner's own report.
   Belt-and-suspenders; not in the original structure but strengthens the proof.
3. **A2 token cost was higher than A1** (119k vs 78k) — unexpected and recorded as a
   kaizen signal (the `claude -p` seam runs the full agent; cost is agentic, not
   epic-sized). Did not change any AC outcome; documented in `proof.md` #1.

## Not committed

Artifacts written, working tree left for Lisa to handle phase transitions (per the
run instruction — ticket frontmatter untouched, no manual commit). Run-time evidence
under `.vend/` is gitignored (quoted into `proof.md`); the committable apparatus +
write-ups are the durable record.
