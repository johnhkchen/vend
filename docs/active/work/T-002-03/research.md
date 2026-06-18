# T-002-03 — Research: decompose-epic-runner

The convergence node of E-001. Everything S-001/S-002 built is a part on the
bench; this ticket wires the spine that runs them end to end: assemble inputs →
render (BAML) → dispense (`claude -p` seam, under a budget) → SAP-parse → clear
(gates) → on **pass** materialize lisa files → `lisa validate`; on any **stop**
write nothing but the run log. Descriptive map of what exists and how it connects.

## The parts already on the bench

| Module | Export surface | Purity | Role here |
|---|---|---|---|
| `src/executor/claude.ts` | `dispense(opts)`, `ResultMessage`, `ClaudeTimeoutError`, pure stream helpers | impure verb + pure helpers | the single metered seam |
| `src/budget/budget.ts` | `Budget`, `timeoutMsFor`, `check`, `countTokens`, `BudgetOutcome`, `BUDGET_EXHAUSTED` | PURE | time→seam, tokens→verdict |
| `src/log/run-log.ts` | `appendRunLog`, `buildRunRecord`, `serializeRunRecord`, `RunOutcome`, `RunRecordInput`, `GateResult` | impure verb + pure pair | one countable record / run |
| `src/gate/gates.ts` | `clear(plan, ctx)`, `isStop`, `GateResult`, `ClearContext`, `GATE_NAMES` | PURE | stop-the-line clearing |
| `baml_src/decompose.baml` → `baml_client/` | `b.request.DecomposeEpic`, `b.parse.DecomposeEpic`, `WorkPlan`/`StoryDraft`/`TicketDraft`, `Draft*` enums | native addon | render + SAP parse |
| `src/baml/decompose-bridge.ts` | `extractPromptText(req)`, `runOp`, `BridgeOp` | pure helper + impure entry | prompt-text extraction reused |

The wiring targets — `src/play/project-context.ts`, `src/play/decompose-epic.ts`,
`src/play/materialize.ts`, `src/cli.ts` — do **not** exist yet. `src/play/` holds
only `.gitkeep`. There is no `src/cli.ts`.

## How the seam wants to be driven

`dispense({ prompt, model?, effort?, system?, onMessage?, timeoutMs? })` →
`Promise<ResultMessage>`. It spawns `claude -p --output-format stream-json
--verbose`, writes `prompt` to stdin, calls `onMessage(msg)` **once per stream-json
message in order**, and returns the terminal `result` (carrying `usage`,
`total_cost_usd`, `subtype`). Two ways it can end:

- **Timeout** → throws `ClaudeTimeoutError` (`code === "ETIMEDOUT_CLAUDE"`,
  carries `timeoutMs`). The child is SIGKILLed; there is **no** `ResultMessage`.
- **Returns** for ANY `subtype` (incl. error subtypes) so the caller meters and
  branches. Only a genuinely absent terminal result throws a plain `Error`.

The seam owns wall-clock (its one guard) and **owns no token budget** — that is the
runner's to compose (T-001-02 AC#4 / T-001-03 design). `onMessage` is the hook the
ticket's "stream every message to both surfaces" rides on.

## How budget composes onto the seam

`timeoutMsFor(budget)` → the number handed to the seam as `timeoutMs` (today
identity-with-validation; budget has no clock). After the seam returns,
`check(budget, result.usage)` → `BudgetOutcome`: `ok { spent, ceiling, remaining }`
or `exhausted { code, spent, ceiling, overage }`. `countTokens` sums all four
sub-counts. Token exhaustion is a **returned andon**, not a throw — the run
completed but blew its allocation. `assertPositiveInt` throws on a non-positive
allocation (caller/CLI-parse error). `Usage` is structural — the seam's
`result.usage` satisfies it by duck-typing; budget imports nothing from the seam.

## How the gates want to be called

`clear(plan, { epic, charter })` → `GateResult`: `clear { cleared }` or `stop {
gate, unit, reason }`. `isStop(r)` narrows. Runs the four gates value-first and
returns the **first** STOP. Critically (T-002-02 handoff #2): the **empty plan is a
`value` STOP**, not an exception — so the runner must **not** special-case empty
before calling `clear()`; it just calls `clear()` and honors the verdict. The
SAP-leniency hazard (a malformed model reply degrades to an empty `WorkPlan`
instead of throwing — pinned in `decompose.baml` and `decompose.test.ts`) is
therefore absorbed cleanly by the value gate. `ClearContext.epic`/`charter` must be
the **real** strings (the bounds gate greps `charter` for live `P#`/`N#` ids).

## How the log wants the run handed to it

`appendRunLog(input, { path? })` composes `buildRunRecord` + one append; default
path `.vend/runs.jsonl` (gitignored). `RunRecordInput` wants: `runId`, `play`,
`epic`, `model`, `outcome`, `usage?`, `costUsd?`, `gateResults?`, `startedAt`,
`endedAt` (ISO strings — **the log keeps no clock**, the runner stamps time).
`RunOutcome` ∈ `success | gate-failed | timed-out | budget-exhausted` — one label
for each terminal state the other modules already produce. **Two distinct
`GateResult` types exist** (T-002-02 handoff #1): the gates' whole-plan verdict vs.
run-log's per-gate `{ gate; passed; detail? }`. The runner is the translator. A
failed run still writes a record (outcome is just a field) — `appendRunLog` is the
single append for every outcome.

## The BAML calls and the one-call hazard

The play needs **two** native calls: `b.request.DecomposeEpic(epic, charter,
project)` (render the prompt) and `b.parse.DecomposeEpic(text)` (SAP-parse the
reply). `decompose-bridge.ts` already does both via `sync_client` and exposes
`extractPromptText(req)` to pull rendered text out of `req.body.json().messages`.

**Key constraint (memory 20232, 20211–20232):** the BAML native addon's
"one successful native call per process" failure is **`bun test`-runner-specific** —
a plain `bun` process (which the runner and CLI are) runs many BAML calls fine. So
the runner calls `b.request`/`b.parse` **directly in-process**; the subprocess
bridge is a *test-only* workaround and is not on the runner's path.

## Enum member → alias gap (materializer's job)

`b.parse` returns the enum **MEMBER** name (`"Task"`, `"InProgress"`, `"Ready"`),
while lisa frontmatter wants the **alias** (`"task"`, `"in-progress"`, `"ready"`).
T-002-01 review flagged the member→alias mapping as **the materializer's job**. The
maps are fixed by `decompose.baml`: DraftType/DraftStatus/DraftPriority/DraftPhase.
`StoryDraft` carries a `type` (a DraftType) but lisa renders stories as
`type: story` (see `S-001.md`) — the materializer hardcodes that, not the alias.

## The lisa file shapes to emit (from existing files)

Ticket (`T-002-01.md`): YAML frontmatter `id, story, title, type, status,
priority, phase, depends_on` then `## Context` + `## Acceptance Criteria` body.
`TicketDraft` has no prose fields — body is generated from `purpose` (Context) and
`doneSignal` (an AC checkbox), with `advances` noted. `depends_on` renders as a
flow array `[T-…, T-…]` or `[]`.

Story (`S-001.md`): frontmatter `id, title, type: story, status, priority,
tickets: [..]` then prose. `StoryDraft` has no body field → minimal generated body.

## `lisa validate` — the final poka-yoke

`lisa` is a real CLI (`/opt/homebrew/bin/lisa`). `lisa validate --path <root>`
validates the ticket DAG + project setup; `--check-tools` also checks PATH for
zellij/claude. It reads `ticket_dir`/`story_dir`/`work_dir` from `.lisa-layout.kdl`
(present at repo root). Running it is an impure spawn — same class as `dispense`
and `appendRunLog` (the house "single untested impure verb" pattern).

## Constraints / assumptions surfaced (not solved here)

- **Don't clobber the live project.** Materializing the canned `S-009`/`T-009-xx`
  ids into the real `docs/active/` would collide with the running `lisa loop`.
  The live run is **T-002-04**, not this ticket — so materialize must take a
  configurable output root, defaulting to `docs/active/` but redirectable for tests.
- **Budget vs. gate ordering** is a design choice (next phase): a token-exhausted
  run is a P7 contract breach → it should stop the line even if the plan is sound.
- **"Both surfaces"** = live stdout + a durable per-message sink, distinct from the
  one countable outcome record. The seam's `onMessage` is the single tap for both.
- **House purity pattern** governs testability: extract a PURE decision/render core
  (outcome classification, member→alias, frontmatter rendering) that is unit-tested;
  the orchestration that spawns `claude`/`lisa` and touches fs is the thin untested
  verb, exactly as `dispense`/`appendRunLog` are.
