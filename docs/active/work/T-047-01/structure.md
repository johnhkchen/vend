# T-047-01 — Structure: file-level blueprint

Three new files, zero modifications to existing code. Engine ⊥ play holds: the new shell depends UP
onto `castGraph` + the three plays; nothing depends down on it.

## File 1 — `src/play/graph-real-play-core.ts` (NEW, PURE, addon-free, tested)

The adapter judgment + node identity. Type-only imports only (no `b`, no `castPlay`, no fs).

```ts
import { parseBoardSignals } from "./work-core.ts"; // PURE value import (no addon)

/** Stable node ids for the real-play graph — the test and the shell agree on these. */
export const SURVEY_NODE = "survey";
export const PROPOSE_1_NODE = "propose-1";
export const PROPOSE_2_NODE = "propose-2";
export const NOTE_NODE = "capture-note";

/** The diamond edges, in declaration order (fan-out then join). Exported so shell + test share. */
export const REAL_PLAY_EDGES; // DagEdge[]: survey→propose-1, survey→propose-2,
                              //            propose-1→capture-note, propose-2→capture-note

/** Selecting signal #index off the staged board: a hit, or an honest degrade reason. */
export type SignalSelection =
  | { readonly ok: true; readonly signal: string }
  | { readonly ok: false; readonly reason: string };

/** pickSignal(boardMd, index) — parseBoardSignals then bounds-check. < index+1 signals ⇒ degrade. */
export function pickSignal(boardMd: string, index: number): SignalSelection;

/** epicIdFromPath(path) — basename minus `.md` (the epicSubjectFromPath rule, lifted pure). */
export function epicIdFromPath(epicPath: string): string;

/** buildConsolidationTopic(epicPaths) — a deterministic note topic naming BOTH minted epics
 *  (derived ids), the join's text. */
export function buildConsolidationTopic(epicPaths: readonly string[]): string;

/** subjectForProposeSignal(signal) / subjectForJoin(epicPaths) — non-empty run-log subjects. */
export function subjectForProposeSignal(signal: string): string;
export function subjectForJoin(epicPaths: readonly string[]): string;
```

`REAL_PLAY_EDGES` imports `DagEdge` TYPE-ONLY from `../engine/dag-core.ts`. Everything here is pure
and total — the unit-tested surface.

## File 2 — `src/play/graph-real-play.ts` (NEW, IMPURE shell, NOT unit-tested)

The concrete `castGraph` caller — the graph-scale analog of `chain-propose-decompose.ts`.

Value imports: `castGraph`, `type PlayNode`, `type GraphResult` (`../engine/graph.ts`); `surveyPlay`,
`assembleSurveyInputs` (`./survey.ts`); `proposeEpicPlay`, `assembleProposeEpicInputs`
(`./propose-epic.ts`); `captureNotePlay`, `assembleNoteInputs` (`./note.ts`); the pure core (File 1);
`readFile` from `node:fs/promises`; `type Budget`.

```ts
export interface GraphRealPlayOptions {
  readonly projectRoot?: string;
  readonly model?: string;
  readonly transcriptDir?: string;
  readonly intervened?: boolean;
  readonly surveyBudget?: Budget;   // ?? surveyPlay.budget
  readonly proposeBudget?: Budget;  // ?? proposeEpicPlay.budget (both proposes)
  readonly noteBudget?: Budget;     // ?? captureNotePlay.budget
}

/** Build the real-play DagSpec — the four PlayNodes + REAL_PLAY_EDGES. Each adapt pulls its
 *  upstream produced ref(s) and feeds the play's assemble helper (D3/D5). PURE-ish builder (no
 *  cast yet), but value-imports the plays so it stays in the shell. */
export function buildRealPlayGraph(opts: GraphRealPlayOptions): {
  nodes: PlayNode<any, any>[]; edges: typeof REAL_PLAY_EDGES;
};

/** Cast the real-play graph LIVE through castGraph — the metered verb (~4 casts, 2 concurrent). */
export async function castRealPlayGraph(opts?: GraphRealPlayOptions): Promise<GraphResult>;
```

### Node construction (the load-bearing wiring)

- **survey** `{ id: SURVEY_NODE, play: surveyPlay, budget: surveyBudget, opts: { subject:
  "survey of <root>", projectRoot, model, intervened, transcriptDir }, adapt: () =>
  assembleSurveyInputs({ budget: surveyBudget, projectRoot, model, transcriptDir }) }`.
- **propose-1 / propose-2** (built by a shared local `proposeNode(id, index)`):
  - `adapt: async (upstreams) => { const boardPath = upstreams.get(SURVEY_NODE); const md = await
    readFile(boardPath, "utf8"); const sel = pickSignal(md, index); const signal = sel.ok ?
    sel.signal : ""; return assembleProposeEpicInputs({ signal, budget: proposeBudget, projectRoot,
    model, transcriptDir }); }` — degrade (D4): empty signal ⇒ propose value gate STOPs.
  - `opts: (upstreams) => ({ subject: subjectForProposeSignal(<picked or id>), projectRoot, model,
    intervened, transcriptDir })`.
- **capture-note** (JOIN):
  - `adapt: async (upstreams) => { const epicPaths = [upstreams.get(PROPOSE_1_NODE),
    upstreams.get(PROPOSE_2_NODE)].filter(Boolean); const topic = buildConsolidationTopic(epicPaths);
    return assembleNoteInputs({ topic, budget: noteBudget, projectRoot, model, transcriptDir }); }`.
  - `opts: (upstreams) => ({ subject: subjectForJoin([...]), projectRoot, model, intervened,
    transcriptDir })`.

### Live entry (`import.meta.main`)

```ts
if (import.meta.main) {
  const result = await castRealPlayGraph({ projectRoot: process.cwd() });
  // print: per-node runId/outcome/produced (result.nodes), result.skipped, result.produced (sinks),
  //        result.halted/haltReason. exit(result.outcome === "success" && !result.halted ? 0 : 1).
}
```

Module header documents: the `castGraph`/`chain.ts` purity discipline (value-imports the plays ⇒ no
`bun test` value-imports this), the E-007 dependency direction, and the honest-degrade contract.

## File 3 — `src/play/graph-real-play-core.test.ts` (NEW, addon-free unit test)

Imports ONLY: `bun:test`; the pure core (File 1); `runGraph` + `type GraphResult`
(`../engine/graph-core.ts`); `type DagSpec`/`NodeUpstreams`/`DagNode` (`../engine/dag-core.ts`);
`type RunSummary` (`../engine/cast.ts`, type-only); `node:fs/promises` + `node:os` for the fixture
board temp file. NEVER imports `graph-real-play.ts` (addon) or `graph.ts` (spawns).

Tests (D9):
1. `pickSignal` — fixture board with ≥2 signals → #0 and #1 are the ranked signals; a 1-signal board
   → `pickSignal(md,1)` is `{ ok:false }`; an empty board → `{ ok:false }`.
2. `buildConsolidationTopic` — `["…/E-010.md","…/E-011.md"]` → topic contains `E-010` AND `E-011`.
3. `epicIdFromPath` — `…/E-010.md` → `E-010`.
4. **Stub-node wiring proof** — a `DagSpec` with the real node ids + `REAL_PLAY_EDGES`, stub casts
   wrapping the REAL pure adapters over fixtures (survey → board-path summary; propose stubs read
   upstream board, `pickSignal`, record signal, summary(`…/E-01N.md`); note stub reads BOTH epic
   paths, `buildConsolidationTopic`, record topic, summary). Driven through pure `runGraph`. Assert:
   propose-1 saw signal #1, propose-2 saw signal #2, the note saw BOTH epic paths and its topic names
   both ids; `result.halted === false`, sink `produced` = the note path.

## Ordering of changes (Plan sequences these)

1. File 1 (pure core) + File 3 (test) — red→green in isolation, no addon.
2. File 2 (shell) — typecheck-only proof (`tsc --noEmit`); not unit-tested.
3. Full gate green (`bun test` + `tsc`).
4. Live cast via the entry → `graph-cast-log.md` (or honest degraded record). `lisa validate`.

## What is NOT touched

`cli.ts` (D7 — no verb), the engine, the plays, the pure cores. No new deps. No edits to existing
tests. The board mutation at live-cast time (minted epics + a note) is data, not code, and is the
ticket's authorized metered spend.
