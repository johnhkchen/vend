# T-014-02 — Research

*Descriptive map of the codebase the variance probe + `--no-gates` mode plug into. What
exists, where, how it connects. No solutions proposed here.*

## The ticket in one line

The **E2 / consistency** arm (PRD KR3): add a **minimal `--no-gates` run mode** (skip the
gate phase), then a **variance harness** that casts one play **5× with gates and 5× without**
on a fixed input, **diffs the materialized output**, and emits a **single gate-driven
variance-reduction number** plus the raw per-run diffs. The pure diff/variance is
unit-tested on fixtures; the live 5×2 run is the human step at sweep (≤ the PRD cast budget).

---

## The cast spine — where gates run, and how to skip them

`src/engine/cast.ts` → `castPlay<I,O>(play, inputs, budget, opts)` is the single impure
orchestrator. The fixed spine: `render → dispense → meter (budget.check) → parse → gates →
classify → effect → appendRunLog`. The gate phase is **exactly two lines** (cast.ts:124–130):

```ts
if (budgetOutcome.status === "ok") {
  output = play.parse(result.result ?? "");
  gateVerdict = play.gates(output, ctx);   // ← the only call to skip
}
```

`gateVerdict` then flows into `classify({ timedOut, budgetOutcome, gateVerdict })`
(cast-core.ts:84–94). The decision is **first-match priority**: timeout → budget-exhausted
→ `gateVerdict?.status === "stop"` → else `success` (materialize). Crucially, **a `null`
`gateVerdict` is treated as "no stop" → `success` → materialize**. So *not calling*
`play.gates` is already, mechanically, the no-gates path: the output parses and
materializes regardless of whether it would have cleared. `castGateRows(null)` returns `[]`,
so an ungated run logs no per-gate rows — honest about no gates having run.

`CastOptions` (cast.ts:33–55) is the per-cast bag: `subject`, `projectRoot?`, `project?`,
`model?`, `runId?`, `transcriptDir?`, `runLogPath?`. There is **no `skipGates` flag today** —
this is the one field the run mode adds.

`RunSummary` (cast.ts:57–70) returns only `{ runId, outcome, materialized, produced? }`. It
does **not** surface the parsed output or the materialized content — relevant to how the
probe collects outputs (it must read them back from disk, not from the summary).

## The gates being toggled off

`src/gate/gates.ts` → `clear(plan, ctx): GateResult` runs four value-ordered gates
(value → allocation → bounds → structural), andon on first failure. Pure. DecomposeEpic
wires it as `gates: (plan, ctx) => clear(plan, { epic, charter })` (decompose-epic.ts:163).
A STOP → `gate-failed` outcome, **no materialize**. This is the gates' *only* consistency
mechanism: they do not transform the output, they **censor** divergent outputs (a
gate-failed run materializes nothing). So gated-vs-ungated variance is driven by *which
runs are censored*, not by content rewriting.

## What "materialized output" is, and the collision hazard

`src/play/materialize.ts` → `materialize(plan, targets)` writes one `*.md` per story/ticket
under `targets.storiesDir` / `targets.ticketsDir`. The render pair (`renderTicketFile`,
`renderStoryFile`) is **PURE and deterministic** — the file body is a pure function of the
`WorkPlan` (no timestamps, no run ids embedded). So **any line difference between two runs'
materialized files reflects real content divergence** (different ticket ids/titles/counts),
which is exactly what a variance metric should measure.

**Collision hazard:** `materialize` runs a cross-board collision guard FIRST
(`detectCollisions` over `listIdsIn(target dirs)`) and throws `IdCollisionError` before any
write if the plan re-mints an id already on the board (materialize.ts:188–195). DecomposeEpic's
effect (decompose-epic.ts:121–140) catches it → relabels outcome to `id-collision`,
`materialized:false`. **Consequence for the probe:** casting the same play repeatedly into the
**same** output dir collides after the first materialize. Each probe run therefore needs a
**fresh/cleared output dir** so a clearing run actually materializes (not collides).

## The play, its inputs, and the run-log write path

`src/play/decompose-epic.ts`: `decomposeEpicPlay` (the only registered play), plus
`assembleAndCast(play, opts)` and `runDecomposeEpic(opts)`. `RunOptions` (decompose-epic.ts:
56–69) is `{ epicPath, budget, projectRoot?, model?, runId?, transcriptDir? }` — **no
`skipGates`, no `runLogPath`**. `assembleAndCast` calls `assembleInputs` then `castPlay`,
passing `{ subject, projectRoot, model, runId, transcriptDir }` — note it does **not** pass
`runLogPath`, so the ledger defaults to `DEFAULT_RUN_LOG_PATH = ".vend/runs.jsonl"` **relative
to cwd** (run-log.ts:30). A probe driving `assembleAndCast` against the live repo would
therefore **pollute the real ledger** — so the probe must drive `castPlay` directly with an
explicit `runLogPath` pointing into its temp root.

`src/play/project-context.ts` → `assembleInputs({ epicPath, charterPath?, projectRoot? })`
reads the epic file + the charter (`docs/knowledge/charter.md` under root) + a `src/`/board
snapshot, returning `{ epic, charter, project }`. The bounds gate greps the **real** charter
for live `P#`/`N#` ids, so a meaningful gated run needs the real charter present.

## The dispatch + CLI surface

`src/play/dispatch.ts` → `runPlay(name, opts)` resolves the play from the registry and calls
`assembleAndCast`. `src/cli.ts`: `parseArgs` (pure) routes `run <play> <epic.md> --budget …`
via `parseRunArgs` (cli.ts:178–195), which returns `{ cmd:"run", play, epicPath, budget }`.
The `import.meta.main` dispatch (cli.ts:341–349) lazy-imports `runPlay` and casts. Adding a
`--no-gates` run mode threads a flag here → `RunOptions.skipGates` → `CastOptions.skipGates`.

`ParsedCommand` (cli.ts:27–39) is a discriminated union; the codebase idiom **spreads
optional fields only when present** (`...(estimate ? { estimate } : {})`), so existing
`toEqual` parse tests that omit a field keep passing — relevant to keeping
`src/cli.test.ts` green when adding `skipGates`.

## The run-log read face (for context, not directly used here)

`src/log/run-log.ts` carries the two-faced log; `forPlay` / `readRuns` / `loadRunLog` are
the read seam. T-014-02 does **not** read the ledger to compute variance — variance is over
**materialized output**, not log records. (E1/T-014-01 is the ledger-reading arm; this arm
is independent — PRD §7.1.) The probe *writes* records (one per cast) via the normal spine,
redirected to a temp ledger.

## Test conventions (the house pattern)

- Pure cores get ordinary `bun test` files (no fs, clock, or BAML addon). Examples:
  `gates.test.ts`, `cast-core.test.ts`, `recalibrate.test.ts`, `materialize.test.ts` (the
  PURE render pair only — `materialize` the fs verb is **not** unit-tested).
- Impure verbs (`castPlay`, `assembleAndCast`, `dispense`, `appendRunLog`, `materialize`)
  are **not** unit-tested — their logic lives in the tested pure core; they are proven live.
- `bun run check` = `baml:gen → check:typecheck → check:test`; CI also runs `check:committed`
  and `check:head`. `bun run check:*` must be green and the source committed.

## Constraints & assumptions surfaced

- **Minimal, a switch not a framework** (PRD §7, ticket anti-scope-creep): ≤ one run flag +
  one paired experiment. No benchmarking harness, no generalization.
- The gates' consistency effect is **censoring**, so the gated materialized set may have
  **fewer than 5 members** (censored runs drop out). The count of censored runs is itself
  signal and must be surfaced (honesty / IA-8), or a "reduction" of 1.0 achieved by
  censoring everything would read as a false win.
- Materialized output is **deterministic given the WorkPlan**, so a line-level set diff
  cleanly measures content divergence (no volatile fields to strip).
- Independent of E1 (T-014-01); runs in parallel; touches disjoint files.
