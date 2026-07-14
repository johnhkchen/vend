# T-047-01 — Design: build & cast the real-play graph

Options weighed against the research, one chosen per decision with rationale.

## D1 — Module split: pure core + impure shell (CHOSEN: split)

The real-play caller value-imports the three plays (the BAML addon), so — like
`chain-propose-decompose.ts` — **no `bun test` may value-import it**. But the ticket requires the
wiring be **unit-tested deterministically**. The only way both hold is the house pure-core/impure-
shell split (the `chain-propose-decompose.ts` + `chain-propose-decompose-core.ts` precedent, the
`survey-core`/`survey` precedent):

- **`src/play/graph-real-play-core.ts`** — PURE, addon-free, type-only imports. Holds the
  load-bearing adapter JUDGMENT (signal selection + the join topic) and the node-id constants.
  Unit-tested.
- **`src/play/graph-real-play.ts`** — IMPURE shell. Value-imports the three plays + `castGraph`;
  wires the `PlayNode`s using the pure core; carries the live `import.meta.main` entry. NOT
  unit-tested (the `castGraph`/`chain.ts` discipline) — its logic is the pure core + the live cast.

**Rejected — one file:** can't be unit-tested (it loads the addon). **Rejected — adapters inline in
the shell:** same; the judgment would be unreachable by `bun test`.

## D2 — Node identity (CHOSEN: `survey`, `propose-1`, `propose-2`, `capture-note`)

`castGraph` keys upstreams by from-node id, so the two propose nodes — same `proposeEpicPlay`, two
distinct purposes — need DISTINCT ids. Stable kebab ids, exported as `REAL_PLAY_NODES` constants so
the test and the shell agree byte-for-byte. Edges:
`survey→propose-1, survey→propose-2, propose-1→capture-note, propose-2→capture-note` — the diamond
(`graph-example.ts`) made real.

## D3 — Fan-out adapter: select signal #N from the survey board (CHOSEN: pure `pickSignal`)

The propose adapter receives `upstreams = Map{ survey: boardPath }`. The IMPURE part (read the board
file) lives in the shell adapter; the PURE part is extracted:

```ts
// graph-real-play-core.ts
export type SignalSelection =
  | { readonly ok: true; readonly signal: string }
  | { readonly ok: false; readonly reason: string };

export function pickSignal(boardMd: string, index: number): SignalSelection;
```

`pickSignal` = `parseBoardSignals(boardMd)[index]` with the honest-degrade guard: fewer than
`index+1` signals ⇒ `{ ok: false, reason: "board has N signals; need ≥ index+1" }`. Reuses
`parseBoardSignals` (`work-core.ts:65`) — itself pure — so signal extraction is the single source of
truth, not re-grepped. The shell adapter: read the upstream board path → `readFile` →
`pickSignal(md, 0|1)` → `assembleProposeEpicInputs({ signal, projectRoot, ... })`.

**Rejected — adapter re-greps the board:** duplicates `parseBoardSignals`, two regexes to drift.

## D4 — The `< 2 signals` honest degrade (CHOSEN: empty-signal → gate STOP, recorded)

An `adapt` that throws makes `castGraph`'s `Promise.all` reject and the whole cast throw — NOT an
honest degrade. There is no pre-cast skip hook from an adapter. So a degraded propose must route
through the **existing gate machinery**: on `pickSignal` failure the shell adapter builds
`assembleProposeEpicInputs({ signal: "" })`. An empty signal yields a card whose `serves`/value is
blank, which the propose **value gate STOPs** (`propose-core` `clear`) — a clean `gate-failed` andon.
That node does not `proceed`, so `decideThread` threads nothing, the join `capture-note` **skips**
(cascade), and `GraphResult.skipped` records it with the cause. The honest degraded-run the ticket
names — surfaced, never silently dropped.

Caveat (documented): a degraded propose still spends one (gate-stopped) cast — the STOP is post-cast
in `castPlay`. On the real vend board (a ranked, multi-signal survey) `≥ 2` signals is effectively
guaranteed, so this is a record-correctness path, not a live-cost path. **Rejected — throw on
degrade:** crashes the graph (loses the other branch's result + the honest record). **Rejected — a
pre-cast count guard in the shell:** the board does not exist until survey runs.

## D5 — Join adapter: consolidate BOTH epics (CHOSEN: pure `buildConsolidationTopic`)

`capture-note` receives `upstreams = Map{ propose-1: epicPathA, propose-2: epicPathB }`. The pure
core builds the note topic that **references both** minted epics:

```ts
export function buildConsolidationTopic(epicPaths: readonly string[]): string;
```

Derives each epic id from its path (`basename` minus `.md`, the `epicSubjectFromPath` rule, lifted
pure) and returns a deterministic topic naming both — e.g.
`"Consolidate the two freshly-proposed epics E-0XX and E-0YY: ..."`. The shell adapter pulls the two
refs **in declared edge order** (`propose-1` then `propose-2`) out of the `NodeUpstreams` map, calls
`buildConsolidationTopic`, then `assembleNoteInputs({ topic, projectRoot })`.

`NodeUpstreams` is an unordered map; the adapter reads it by the KNOWN node ids (`propose-1`,
`propose-2`) — not by iteration order — so the topic is deterministic. The unit test asserts the
topic contains BOTH epic ids.

## D6 — Run-log subjects (CHOSEN: function-form `opts` for join; static for the rest)

- survey: static `{ subject: "survey of <root>", projectRoot, ... }`.
- propose-1/2: function-form `opts(upstreams)` — derive `subject` from the picked signal (its label),
  so each propose record names which signal it ran. Falls back to a node-id subject on degrade
  (`appendRunLog` asserts non-empty).
- capture-note (join): function-form `opts(upstreams)` — derive `subject` from the two epic ids
  (`"consolidate E-0XX + E-0YY"`), the `chain-propose-decompose.ts` downstream-`opts` precedent.

## D7 — Live entry (CHOSEN: `import.meta.main` in the shell; no `cli.ts` change)

The ticket allows "`bun run …` a small entry, or `vend`-verb if wired". A standalone
`import.meta.main` block in `graph-real-play.ts` (the `src/probe/run-*.ts` + `attest-intervention.ts`
pattern) is the minimal, non-invasive choice — runnable as `bun run src/play/graph-real-play.ts`. It
casts `castRealPlayGraph({ projectRoot: cwd })`, prints each cast's `runId`/`outcome`/`produced`, the
skip list, and the sink `produced` (the note path), then `process.exit(outcome === "success" &&
!halted ? 0 : 1)`.

**Rejected — a `graph` CLI verb in `cli.ts`:** touches a reviewed file and adds a `ParsedCommand`
member + `parseGraphArgs` + dispatch arm for a single demonstration cast — more surface than the
ticket needs. The `import.meta.main` runnable is the established lighter path. (Promoting to a CLI
verb is a clean follow-up if the real-play graph becomes a recurring gesture.)

## D8 — Budgets / options (CHOSEN: play defaults, per-node override optional)

`GraphRealPlayOptions { projectRoot?; model?; transcriptDir?; intervened?; surveyBudget?;
proposeBudget?; noteBudget? }`. Each node casts under `its-override ?? play.budget` (the
`resolveStepBudgets` precedence, kept inline — only three nodes, no shared core needed). Defaults =
the recalibrated play budgets (survey 300k, propose 150k×2, note 8k), the measured P7 floor.

## D9 — Test strategy (CHOSEN: pure-adapter unit tests + a stub-node `runGraph` wiring proof)

The addon-free `graph-real-play-core.test.ts` proves the wiring two ways (the `graph-example.test.ts`
+ `chain-propose-decompose.test.ts` disciplines fused):

1. **Direct pure tests** — `pickSignal(fixtureBoard, 0/1)` returns signal #1/#2; `pickSignal` on a
   `< 2`-signal board returns `{ ok: false }`; `buildConsolidationTopic([E-010, E-011 paths])`
   contains both ids.
2. **Stub-node wiring proof** — build a `DagSpec` with the SAME node ids + edges as the real graph
   but **stub `cast` thunks** that invoke the REAL pure adapters over fixtures: the survey stub
   produces a temp board path (a written fixture board), each propose stub reads its upstream board +
   `pickSignal`s (recording the signal it saw) and produces `…/E-01N.md`, the note stub reads BOTH
   epic paths + `buildConsolidationTopic` (recording the topic). Drive through the **pure `runGraph`**
   (importable — spawns nothing). Assert: propose-1 saw signal #1, propose-2 saw signal #2, the note
   saw BOTH epic paths and its topic references both. **No live model.**

This proves exactly the AC#2 claims (fan-out extracts #1/#2; join receives both, builds a note
referencing both) without importing the addon-loading shell. The live cast (AC#3) is proven by the
metered `import.meta.main` sweep, captured in `graph-cast-log.md`.

## Honest-outcome stance (ticket headline)

The headline is the **concurrency** (two real casts overlapping) + the **join receiving both** — not
the artifacts. The cast log records the wave structure + overlapping `startedAt`/`endedAt` from
`.vend/runs.jsonl` as the concurrency evidence. A degraded live run (a propose andon, or no live
executor available in-environment) is recorded with its cause — an explicitly permitted AC#3
outcome. P7 holds: bounded by the per-node budgets, clean by `lisa validate` after.
