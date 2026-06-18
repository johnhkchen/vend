# T-002-03 — Structure: decompose-epic-runner

The blueprint. Four new modules in `src/play/` plus `src/cli.ts`, each split into a
pure core (unit-tested) and a thin impure shell (untested, per house style). No
existing module is modified — this ticket only *composes* them.

## File-level change set

| Action | Path | Contents |
|---|---|---|
| create | `src/play/project-context.ts` | assemble the three `DecomposeEpic` inputs |
| create | `src/play/project-context.test.ts` | pure assembly tests |
| create | `src/play/materialize.ts` | WorkPlan → lisa story/ticket files |
| create | `src/play/materialize.test.ts` | member→alias + render tests |
| create | `src/play/decompose-epic.ts` | the runner: classify (pure) + orchestrate (impure) |
| create | `src/play/decompose-epic.test.ts` | classifier + stream-sink + budget-arg tests |
| create | `src/cli.ts` | `vend run decompose-epic …` entry point |
| (none) | `package.json` | a `vend` bin/script is **not** required by AC; deferred |

`src/play/.gitkeep` may remain. No edits to `executor/`, `budget/`, `gate/`, `log/`,
`baml_src/`, `decompose-bridge.ts`.

## `src/play/project-context.ts`

Assembles the three strings `DecomposeEpic(epic, charter, project)` wants.

```
const CHARTER_PATH = "docs/knowledge/charter.md"      // default; overridable

interface ContextSources { epicPath: string; charterPath?: string; projectRoot?: string }
interface DecomposeInputs { epic: string; charter: string; project: string }

// PURE — given raw file contents + a snapshot, produce the project string.
export function buildProjectSnapshot(parts: {
  root: string; srcFiles: string[]; stories: string[]; tickets: string[];
}): string

// IMPURE verb — read epic + charter files, gather a thin snapshot, assemble.
export async function assembleInputs(src: ContextSources): Promise<DecomposeInputs>
```

- `epic` = the epic md file contents (read from `epicPath`).
- `charter` = `charter.md` contents (the REAL string — bounds gate greps it).
- `project` = `buildProjectSnapshot(...)`: a thin go-and-see snapshot — a listing of
  `src/**` files, current story/ticket ids, nothing heavy. Pure formatter so its
  shape is test-pinned; the directory walk is the impure half.
- **Public:** `assembleInputs`, `buildProjectSnapshot`, the two interfaces,
  `CHARTER_PATH`.

## `src/play/materialize.ts`

WorkPlan → lisa-valid files. The member→alias gap (T-002-01) lives here.

```
import type { WorkPlan, StoryDraft, TicketDraft } from "../../baml_client/index.ts"  // TYPE-ONLY

export const TYPE_ALIAS:     Record<string,string>  // Task→task, Bug→bug, Spike→spike
export const STATUS_ALIAS:   Record<string,string>  // Open→open, InProgress→in-progress, …
export const PRIORITY_ALIAS: Record<string,string>
export const PHASE_ALIAS:    Record<string,string>

// PURE — one ticket/story draft → file {path-relative name, contents}.
export function renderTicketFile(t: TicketDraft): { name: string; body: string }
export function renderStoryFile(s: StoryDraft): { name: string; body: string }

interface MaterializeTargets { storiesDir: string; ticketsDir: string }
interface MaterializeResult { storyFiles: string[]; ticketFiles: string[] }

// IMPURE verb — mkdir -p both dirs, write every rendered file.
export async function materialize(plan: WorkPlan, t: MaterializeTargets): Promise<MaterializeResult>
```

- `renderTicketFile`: frontmatter `id, story, title, type(alias), status(alias),
  priority(alias), phase(alias), depends_on([..])` + body `## Context\n{purpose}` +
  `## Acceptance Criteria\n- [ ] {doneSignal}` + an `_Advances:_ {advances}` line.
  `name = "{id}.md"`.
- `renderStoryFile`: frontmatter `id, title, type: story` (hardcoded, NOT the draft
  alias — see `S-001.md`), `status(alias), priority(alias), tickets([..])` + a one
  line generated body. `name = "{id}.md"`.
- An unknown member key throws (programmer error — the enum drifted vs. the map).
- TYPE-ONLY baml import (erased under `verbatimModuleSyntax`) — no native addon load,
  so `materialize.test.ts` is an ordinary pure test (the T-002-02 precedent).
- **Public:** the four alias maps, `renderTicketFile`, `renderStoryFile`,
  `materialize`, the two interfaces.

## `src/play/decompose-epic.ts`

The runner. Pure classifier + impure orchestrator + the stream sink.

```
import { dispense, ClaudeTimeoutError, type StreamMessage, type ResultMessage } from "../executor/claude.ts"
import { timeoutMsFor, check, type Budget, type BudgetOutcome } from "../budget/budget.ts"
import { clear, isStop, type GateResult } from "../gate/gates.ts"
import { appendRunLog, type RunOutcome, type GateResult as LogGate } from "../log/run-log.ts"
import { assembleInputs } from "./project-context.ts"
import { materialize } from "./materialize.ts"
import { b } from "../../baml_client/sync_client.ts"
import { extractPromptText } from "../baml/decompose-bridge.ts"

export const PLAY = "decompose-epic"
export const DEFAULT_MODEL = "claude-cli-default"

// the inputs to the pure decision
interface ClassifyInput {
  timedOut: boolean
  budgetOutcome: BudgetOutcome | null    // null when timed out (no usage)
  gateResult: GateResult | null          // null when timed out / budget-exhausted (didn't gate)
}
interface Verdict { outcome: RunOutcome; materialize: boolean; gateLog: readonly LogGate[] }

// PURE — first-match ordering: timeout > budget > gate > success (Design D2).
export function classify(i: ClassifyInput): Verdict

// PURE — one stream-json message → a human stdout line.
export function formatMessage(msg: StreamMessage): string

// returns an onMessage hook fanning to stdout (write) + transcript append (sink).
export function makeStreamSink(opts: {
  write: (line: string) => void;
  sink: (raw: string) => void;
}): (msg: StreamMessage) => void

// PURE — gate STOP/CLEAR → run-log per-gate rows (the translator, T-002-02 #1).
export function gateRowsFor(g: GateResult | null): readonly LogGate[]

interface RunOptions { epicPath: string; budget: Budget; projectRoot?: string; model?: string; runId?: string }
interface RunSummary { runId: string; outcome: RunOutcome; materialized: boolean }

// IMPURE orchestrator — the single untested verb. Composes everything.
export async function runDecomposeEpic(opts: RunOptions): Promise<RunSummary>
```

`runDecomposeEpic` flow (impure spine):
1. `runId` (caller-supplied or derived), `startedAt = new Date().toISOString()`.
2. `assembleInputs({ epicPath, projectRoot })` → `{ epic, charter, project }`.
3. `prompt = extractPromptText(b.request.DecomposeEpic(epic, charter, project))`.
4. open transcript file; `onMessage = makeStreamSink({ write: stdout, sink: append })`.
5. `try { result = await dispense({ prompt, model, onMessage, timeoutMs:
   timeoutMsFor(budget) }) } catch (e) { if e is ClaudeTimeoutError → timedOut }`.
6. if not timed out: `budgetOutcome = check(budget, result.usage ?? {})`;
   if `ok` → `plan = b.parse.DecomposeEpic(result.result ?? "")`;
   `gateResult = clear(plan, { epic, charter })`.
7. `verdict = classify({ timedOut, budgetOutcome, gateResult })`.
8. if `verdict.materialize` → `materialize(plan, dirsFrom(projectRoot))` then
   `lisaValidate({ projectRoot })`; a failed validate downgrades to a logged error.
9. `appendRunLog({ runId, play: PLAY, epic: epicId, model, outcome, usage,
   costUsd, gateResults: verdict.gateLog, startedAt, endedAt })`.
10. return `{ runId, outcome, materialized }`; CLI maps non-success → non-zero exit.

`lisaValidate({ projectRoot })` — small impure helper (may live here or in a
`src/play/lisa.ts`; kept here to avoid a one-function module): `Bun.spawn(["lisa",
"validate", "--path", projectRoot])`, return `{ ok: code === 0, output }`. Tolerates
`lisa` absent (logs, does not crash the run record).

## `src/cli.ts`

```
// PURE — "<ms>,<tokens>" → Budget (throws on malformed/non-positive).
export function parseBudgetArg(s: string): Budget
// PURE — argv → a parsed command or a usage error.
export function parseArgs(argv: string[]): { cmd: "run"; play: string; epicPath: string; budget: Budget } | { cmd: "usage"; error?: string }

if (import.meta.main) { … dispatch → runDecomposeEpic → process.exit(outcome==="success"?0:1) }
```

- Recognizes only `run decompose-epic <epic.md> --budget <ms>,<tokens>` (the one
  hardcoded play). Anything else → usage on stderr, exit 2.
- `parseBudgetArg`/`parseArgs` pure & tested; `import.meta.main` block untested.
- `--budget` accepts `<ms>,<tokens>` (two positive ints); delegates the
  positive-int contract to budget's `assertPositiveInt` via the `Budget` it builds.

## Ordering of work

1. `materialize.ts` (+ test) — pure, no deps on the others.
2. `project-context.ts` (+ test) — pure core + thin read.
3. `decompose-epic.ts` (+ test) — composes 1–2 + the four S-001/S-002 modules.
4. `src/cli.ts` — thin shell over 3.
5. `bun run check` green (baml:gen + typecheck + test) at each committable step.

## Module-boundary invariants

- baml imports are **type-only** everywhere except the runner's one in-process
  `b.request`/`b.parse` (value import of `sync_client` — runner is not a `bun test`
  process, so the addon one-call limit does not bite).
- Pure cores import no fs/clock/process; impure shells own all of it.
- The runner is the **only** module that imports more than one S-001/S-002 module —
  it is the designed convergence point; the leaf modules stay decoupled.
