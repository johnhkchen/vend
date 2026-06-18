# T-002-04 — Research: live-dispense-proof

Map of the slice as it exists *just before its first live round-trip*. Descriptive:
what runs, where, and what every live precondition actually is. This ticket is a
**spike** — there is almost no new product code to write; the work is *running the
already-wired play against a live model* and recording what comes back. So this map
focuses on (a) the exact call graph a live run traverses, (b) the preconditions that
must hold for `claude -p` and `lisa validate` to work, and (c) the hazards the prior
reviews handed forward as "unproven until T-002-04."

## What is already built (the convergence is done)

The whole spine landed in T-002-03 (commit `608e648`) and is green: `bun run check`
= **114 pass / 0 fail / 0 TS errors**, deterministic across 3 runs. Nothing in
`src/` needs to change for this spike. The modules a live run touches:

| Module | Role on the live path |
|---|---|
| `src/play/decompose-epic.ts` | `runDecomposeEpic(opts)` — the single impure orchestrator |
| `src/play/decompose-epic-core.ts` | pure `classify` (outcome), `makeStreamSink`, `gateRowsFor` |
| `src/play/project-context.ts` | `assembleInputs` — reads epic + **real charter** + thin snapshot |
| `src/baml/decompose-bridge.ts` | `extractPromptText(b.request…)` — render the prompt text |
| `src/executor/claude.ts` | `dispense` — spawn `claude -p --output-format stream-json --verbose` |
| `src/budget/budget.ts` | `timeoutMsFor` (wall-clock) + `check` (tokens) — P7 both ways |
| `src/gate/gates.ts` | `clear` — four value-ordered gates, first-fail andon |
| `src/play/materialize.ts` | WorkPlan → lisa story/ticket files (member→alias) |
| `src/log/run-log.ts` | `appendRunLog` — one JSONL record per run |

## The exact call graph of one live run

`runDecomposeEpic(opts)` (decompose-epic.ts:106) does, in order:

1. `assembleInputs({epicPath, projectRoot})` — reads `epicPath`, reads
   `<root>/docs/knowledge/charter.md` (the **real** charter; the bounds gate greps
   it for live `P#`/`N#`), walks `<root>/src/**` + lists story/ticket ids for a thin
   go-and-see `project` snapshot.
2. `b.request.DecomposeEpic(epic, charter, project)` → `extractPromptText(req)` —
   render-only; BAML is never the transport (it builds the prompt string).
3. transcript sink wired: `makeStreamSink({ write: stdout, sink: appendFile })` →
   every stream-json message fans to **both** live stdout and
   `<transcriptDir>/<runId>.jsonl` (default `<root>/.vend/transcripts`).
4. `dispense({ prompt, model?, onMessage, timeoutMs: timeoutMsFor(budget) })` —
   **the live `claude -p` call**. Returns the terminal `result` message, or throws
   `ClaudeTimeoutError` if the wall-clock latch fires.
5. if not timed out: `check(budget, result.usage)`; if `ok`,
   `plan = b.parse.DecomposeEpic(result.result)` then `clear(plan, {epic, charter})`.
6. `classify({timedOut, budgetOutcome, gateResult})` — first-match priority
   **timeout > budget > gate > success**. Materialize **only** on `success`.
7. on success: `materialize(plan, {storiesDir, ticketsDir})` then
   `lisaValidate(root)` (`lisa validate --path <root>`). On any stop: write nothing
   but the log + an andon line to stdout.
8. `appendRunLog({...})` — exactly one record to `.vend/runs.jsonl` (cwd-relative
   default; the runner passes no path override).

## Live preconditions — all verified during this research (go-and-see)

- **`bun` 1.3.9**, **`claude` 2.1.181**, **`lisa`** all on PATH. ✓
- **`baml_client/` is generated** (gitignored; `bun run baml:gen` regenerates 14
  files). ✓ The runner value-imports `baml_client/sync_client` — a plain `bun`
  process (not `bun test`) makes many native calls fine (the addon's one-call limit
  is test-runner-specific, memory 20232). The driver is a plain `bun` process.
- **`claude -p` auth is the subscription**, not a metered API key (seam header
  comment). A live run spends real subscription credits — kept small here.
- **`lisa validate` checks project STRUCTURE, not just tickets.** Probed: a bare
  board (valid tickets, copied `.lisa-layout.kdl`) FAILS with 7 structure errors —
  it requires `CLAUDE.md`, `docs/knowledge/rdspi-workflow.md`,
  `.claude/settings.local.json`, and `.lisa/hooks/{on-idle,on-stop,on-clear,on-heartbeat}.sh`.
- **`lisa init --path <dir>` scaffolds all of it** (dirs + `CLAUDE.md` +
  `rdspi-workflow.md` + hooks + `.lisa.toml` + `.claude/settings.local.json`).
  Probed: an init'd sandbox + the real charter copied in + one ticket →
  `lisa validate` = **"All checks passed."** This is the AC1 harness, proven.

## The isolation problem (why a live run cannot just hit the live board)

`materialize` writes to `<root>/docs/active/{stories,tickets}` (decompose-epic.ts:161).
The live board already holds S-001/S-002 and T-001-*/T-002-* (8 tickets, `lisa
validate` green today). A success run on E-001 would emit those same ids and
**clobber the live board** — T-002-03 review concern #5 flags exactly this, and #2
flags that gate uniqueness is *within-plan only*, not cross-board. Therefore every
live run in this spike must target an **isolated, `lisa init`-ed sandbox** as its
`projectRoot`, with the real charter copied in so the bounds gate stays honest. The
run log (cwd-relative `.vend/runs.jsonl`) still lands in the repo, giving one
countable ledger while materialization stays sandboxed. `.vend/` is gitignored, so
sandboxes leave the working tree clean.

## Hazards handed forward (T-002-03 review → this ticket)

1. **First real round-trip is unproven.** Render→dispense→parse has only run against
   canned text + fabricated verdicts. Watch for prompt / `--output-format
   stream-json` / SAP-parse mismatches (review concern #1).
2. **SAP empty-degradation** (decompose.baml:14, gates.ts:20): `WorkPlan` is an
   all-array class, so a malformed/refusal reply degrades to an **empty** plan, not a
   throw. The value gate classifies empty as malformed → `gate-failed`. This is the
   mechanism the **under-specified-epic** scenario (AC3) will most likely exercise.
3. **`model` logged is a sentinel.** No `--model` ⇒ seam uses CLI default but the log
   records `claude-cli-default`, not the true model id (review concern #4). The
   actual id rides on the terminal `result` message — readable from the transcript
   for the AC4 note even though the runner does not thread it through.
4. **Budget check is post-completion.** `check(budget, usage)` runs *after* the seam
   returns — so a tiny **token** budget still makes a full live call, then trips
   `budget-exhausted`. A tiny **time** budget (`timeoutMs`) SIGKILLs the child almost
   immediately → `timed-out` (near-free). These are the two P7 dimensions for AC2.

## The AC4 baseline (kaizen)

E-001.md carries the **by-hand** decomposition (E-001.md:66): 2 stories, 8 tickets,
critical path 5 — S-001 (scaffold → seam/budget/log) + S-002 (BAML fn → gates →
runner → live proof). E-001.md:75 explicitly says "T-002-04 will run it by machine
and compare against this decomposition (the first kaizen signal)." So the canonical
AC1+AC4 live input is **E-001 itself**: run the machine over the same epic the human
cleared by hand, diff the two WorkPlans, record the gap.

## Constraints / assumptions

- No new `src/` code is required or wanted; the spike's apparatus (driver + fixtures)
  belongs in `docs/active/work/T-002-04/` per the directory conventions.
- Live model output is non-deterministic — scenario outcomes are *expected*, not
  guaranteed; the spike records what actually happened, including any surprise.
- Cost is real; fixtures are kept small and the wasted-call scenarios (AC2/timeout)
  use the smallest viable inputs.
