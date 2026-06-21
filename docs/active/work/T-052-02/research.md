# T-052-02 — Research

_Map of the substrate this ticket casts LIVE. Descriptive only — what exists, where, and the
constraints that bound the live cast. The decision (cast target, envelope sizing) is Design's._

## The ticket in one line

Cast the `survey → [propose ×2] → capture-note` diamond **LIVE** through the now-wallet-threaded
`castRealPlayGraph` (T-052-01) and settle an **honest verdict + cast log** proving the 2-upstream JOIN
actually ran end-to-end — the single property on the E-046/E-047/E-048 substrate still proven by stubs
only. This is a **settlement** ticket: its "implementation" is a metered live cast plus the artifact
that reads its evidence, not new product code.

## What already exists (the substrate is complete)

The code path is **fully wired** — nothing in `src/` needs to change for this ticket:

- **`src/play/graph-real-play.ts`** — `castRealPlayGraph(opts)` (the live entry). After T-052-01 it:
  - builds the four `PlayNode`s + `REAL_PLAY_EDGES` via `buildRealPlayGraph`;
  - sizes ONE shared envelope `macro = opts.macroBudget ?? realPlayMacro(survey, propose, note)`;
  - `return castGraph(nodes, edges, allocate(macro))` (graph-real-play.ts:180–188) — the third arg
    is the shared `Wallet`. This is the fix E-052 turns on; T-052-01 proved it pure, T-052-02 proves
    it live.
  - `GraphRealPlayOptions` (graph-real-play.ts:51–70) carries `projectRoot`, `model`, `transcriptDir`,
    `intervened`, per-node budget overrides, **and `macroBudget`** (the envelope override).
  - An `import.meta.main` block (graph-real-play.ts:193–207) casts against `process.cwd()` and prints
    each node's outcome / skips / sinks — the runnable entry the cast can reuse or wrap.

- **`src/engine/graph.ts`** — `castGraph(nodes, edges, wallet?)`. With a wallet it builds a per-node
  price map (`priceOf = node.budget`) and delegates to `runGraphConcurrent({nodes,edges}, {wallet, priceOf})`.

- **`src/engine/graph-core.ts`** — `runGraphConcurrent`. The wave dispatcher (graph-core.ts:291–498):
  per topological ready-set it `authorizeWave(wallet, runnable, priceOf)` → `dispatch | stopped`, runs
  `dispatch` concurrently via `Promise.all`, `debitWave`s the settled actuals into the one wallet
  (tokens **SUM**, wall-clock **MAX**), and threads the fresh wallet to the next wave. The returned
  `GraphResult` carries the evidence the verdict reads (below).

- **`src/play/graph-real-play-core.ts`** — the pure core. `realPlayMacro(survey, propose, note)`
  (core:143–148) sizes the envelope: `tokens = survey + 2×propose + note`, `timeMs = survey + propose
  + note` (proposes overlap → one propose's wall). `pickSignal(boardMd, index)` (core:69–79) selects
  the ranked fan-out signal; `buildConsolidationTopic` / `subjectForJoin` name the JOIN over both epics.
  Node ids: `survey`, `propose-1`, `propose-2`, `capture-note` (core:30–36).

- **`src/budget/wallet.ts`** — `allocate(macro)` (guards positive ints), `debitWave` (SUM/MAX),
  `formatWallet` (the two-denomination readout).

## The `GraphResult` fields the verdict cites

From `graph-core.ts:80–92`. The settlement reads exactly these off the live cast:

| field | what it proves for this ticket |
|---|---|
| `nodes: Map<NodeId, RunSummary>` | `capture-note` **present** ⇒ the JOIN node was CAST (materialized), not skipped. Each `RunSummary` carries `outcome`, `produced`, `actuals` (usage + wallMs). |
| `produced: Map<NodeId, string>` | the SINK output — `capture-note`'s produced note path (the net graph output). |
| `skipped: SkippedNode[]` | must be **empty** (or at least not contain `capture-note`) for AC#1. In E-047 it held `capture-note` with `blockedBy: [propose-1]`. |
| `halted` / `haltReason` | must be **false** for a clean join run. |
| `walletRemaining: Budget` | **present only on the wallet path** — proves ONE envelope: `funded − remaining` is the total cross-branch spend, not a per-branch tally. The AC's "one envelope, not a per-branch leak." |

The **2-entry `NodeUpstreams` map** the AC names is internal to the cast (`capture-note`'s `adapt`
receives `{propose-1: epicA, propose-2: epicB}` — graph-real-play.ts:131–132, `epicPathsFrom`). Live
evidence that both entries were present: `capture-note` ran AND `buildConsolidationTopic` named **two**
epic ids (subject `consolidate <id1> + <id2>`, run-log `subject`), plus both proposes appear in
`produced`/`nodes` with epic paths.

## The evidence trail a live cast leaves

- **`.vend/runs.jsonl`** — one JSON record per cast (append-only, **gitignored**). Fields seen in the
  E-047 records (read for T-047-02): `play`, `opts.subject`, `startedAt`, `endedAt`, `outcome`,
  `gates`, cost/usage, `runId` (proposes in one wave share a `runId`). This is the primary settlement
  source — concurrency is read off the two proposes' overlapping `startedAt`/`endedAt`.
- **`.vend/transcripts/`** — per-cast transcripts (gitignored).
- **The minted artifacts** — proposes mint `docs/active/epic/<id>.md`; the note writes
  `docs/active/notes/<slug>.md` (note.ts:62). **Path resolution:** every play does `root =
  opts.projectRoot ?? process.cwd()` and reads/writes under `<root>/docs/active/...`
  (survey.ts:121, propose-epic.ts:148/170, note.ts:107/123). ⇒ a non-cwd `projectRoot` **redirects
  ALL mutation** into that root.

## Constraints & assumptions

1. **This is a LIVE METERED cast** (~4 real `claude -p`, ~a couple dollars). The ticket + epic +
   `.vend/next-signal.txt` state the human running `lisa loop` authorizes the spend — the durable
   authorization for this specific action. E-050 (self-funding) + E-051 (no AskUserQuestion hang) made
   the autonomous cast robust enough to run unattended.
2. **Environment is cast-capable:** `claude` CLI on PATH with `~/.claude/.credentials.json` present
   (no `ANTHROPIC_API_KEY` needed — OAuth), `node_modules` installed, typecheck green.
3. **Blast radius:** `docs/active/epic/` and `docs/active/notes/` are **git-TRACKED**; `.vend/` is
   **gitignored**. Casting against `cwd` would mint tracked files into the live repo board mid-loop;
   casting against a sandbox `projectRoot` under `.vend/` keeps every mutation out of git.
4. **The tight envelope risk (flagged by T-052-01 review):** `realPlayMacro` is the *honest p90*
   size, drawn to exactly `{0,0}` on costed stubs. Live actuals vary — in **E-047 a single propose
   burned ~180k tokens** (cache-heavy, overshot its 150k per-node). Two real proposes + survey could
   approach 608k, leaving `< 8k` for the note wave ⇒ `authorizeWave` budget-STOPS `capture-note` ⇒ the
   JOIN skips even under one wallet. The `macroBudget` override (T-052-01) is the documented lever to
   widen the envelope so the note wave authorizes. Design must decide the size.
5. **Signal richness:** both proposes need a ranked signal, so the survey board must carry **≥ 2**
   `vend chain "<signal>"` lines (`parseBoardSignals`, work-core.ts:65; `CHAIN_LINE` regex :22). The
   survey GENERATES the board from the project, so a *rich* survey target (the vend repo's own docs,
   123 tickets) reliably yields ≥2; a thin sandbox might degrade (< 2 signals ⇒ a clean propose STOP ⇒
   join skips). The `.vend/live-proof/A1–A4` sandboxes exist (8 tickets each) but their signal yield
   is unproven.
6. **Honest-on-outcome stance (the house contract):** a degraded run (a propose andon, a budget stop,
   < 2 signals) is **recorded with its cause**, not hidden — exactly as T-047-02 recorded E-047's
   skipped join. The settlement must not over-claim.

## The pattern to mirror

`docs/active/work/T-047-02/graph-cast-log.md` — the E-047 settlement. Structure: raw run-log records
(verbatim table) → Read 1 Concurrency → Read 2 Join → Read 3 Minted-epic quality → Read 4 P7/verdict →
AC checklist. T-052-02's cast log mirrors this but with the **opposite** Read 2 outcome (join RUNS),
and adds the `walletRemaining` one-envelope readout as the P7 evidence.

## Open questions for Design

- Cast target: `cwd` (rich, reliable signals, but mutates tracked board) vs a `.vend/` sandbox
  (git-clean, but signal yield uncertain)?
- Envelope: tight `realPlayMacro` (honest, risks note budget-stop) vs a widened `macroBudget`
  (guarantees the join runs — the AC headline)?
- Runner: reuse `import.meta.main` (casts cwd) vs a small dedicated runner under `work/T-052-02/`
  that pins `projectRoot` + `macroBudget` + dumps the `GraphResult` as JSON evidence?
