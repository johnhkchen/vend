# T-052-01 — Research

_Thread ONE shared Wallet (E-048) through `castRealPlayGraph` so both proposes draw from a single
envelope. This ticket is the PURE WIRING half of E-052 (no live spend); T-052-02 does the live cast._

## The gap, exactly

`src/play/graph-real-play.ts:168` — `castRealPlayGraph` ends with:

```ts
const { nodes, edges } = buildRealPlayGraph(opts);
return castGraph(nodes, edges);   // ← NO third arg → legacy per-node path
```

`castGraph(nodes, edges, wallet?)` (`src/engine/graph.ts:98–121`) already accepts an optional
`wallet?: Wallet` (E-048, T-048-02). When `wallet === undefined` it takes the legacy path
(`runGraphConcurrent({nodes,edges})`, graph.ts:114) — every runnable node dispatched, no
authorization, no cross-branch debit. When a wallet IS passed it builds a per-node price map from each
`PlayNode.budget` and hands `{wallet, priceOf}` to `runGraphConcurrent` (graph.ts:118–120), which
authorizes each wave against the shared envelope before dispatch and debits after settle.

So the substrate to carry the shared wallet is **already in place**. The only missing wire is
`castRealPlayGraph` never allocating an envelope and never passing it as the third arg. That is the
whole of E-052's wiring gap, and the whole of T-052-01.

## The diamond and its per-node budgets

`buildRealPlayGraph` (graph-real-play.ts:83–157) assembles four `PlayNode`s over `REAL_PLAY_EDGES`
(graph-real-play-core.ts:42–47):

```
survey ──┬─→ propose-1 ──┐
         └─→ propose-2 ──┴─→ capture-note
   FAN-OUT (proposes concurrent)   JOIN (2 upstreams)
```

Each node carries a measured `budget` (the IA-8 honest envelope):

| node          | play             | tokens  | timeMs    | source |
|---------------|------------------|---------|-----------|--------|
| survey        | `surveyPlay`     | 300_000 | 1_800_000 | survey.ts:88 |
| propose-1/2   | `proposeEpicPlay`| 150_000 | 1_800_000 | propose-epic.ts:107 |
| capture-note  | `captureNotePlay`| 8_000   | 600_000   | note.ts:77 |

`buildRealPlayGraph` resolves each from `opts.surveyBudget ?? surveyPlay.budget` etc.
(graph-real-play.ts:88–90). These are the per-node budgets that today leak across branches — each
propose independently "affords" its own 150k against its own budget, so in E-047 propose-1 hit
budget-exhausted and the graph halted before the join.

## How the wave dispatcher consumes a shared wallet

`runGraphConcurrent(spec, {wallet, priceOf})` (graph-core.ts:291) runs the diamond as three waves and
folds the ONE wallet across them (immutably; `debitWave` returns a fresh wallet threaded into the next
wave, graph-core.ts:341):

1. **wave {survey}** — `authorizeWave` needs `survey.timeMs ≤ remaining.timeMs` and
   `survey.tokens ≤ remaining.tokens`; debit folds `{tokens: survey, timeMs: survey}`.
2. **wave {propose-1, propose-2}** (concurrent) — `authorizeWave` (spend-core.ts:132–157) treats the
   two denominations asymmetrically (IA-8 under concurrency): **tokens SUM** (a virtual wallet
   depletes by cumulative-so-far, so propose-2 must clear `2×propose ≤ remaining.tokens`), but
   **wall-clock is EACH-fits/MAX** (`propose.timeMs ≤ remaining.timeMs`, not cumulative — overlapping
   branches cost ~the longest). `debitWave` then folds `{tokens: 2×propose, timeMs: max = propose}`.
3. **wave {capture-note}** — must clear `note ≤ remaining` on both, debit `{note, note}`.

For ALL waves to authorize (the join must run), the funded envelope must therefore satisfy, per
denomination:

- **tokens** ≥ `survey + 2×propose + note` = 300k + 300k + 8k = **608_000**
- **timeMs** ≥ `survey + propose + note` = 1.8M + 1.8M + 0.6M = **4_200_000**
  (only ONE propose's time, because the two proposes overlap — the MAX, not the sum).

This per-denomination asymmetry (tokens count both proposes, wall-clock counts one) is exactly the
`debitWave`/`authorizeWave` divergence (wallet.ts:149–168, spend-core.ts:114–157). A per-node-sized
wallet (e.g. one propose's worth of tokens) would budget-STOP propose-2 at the wave boundary — which
is precisely the leak E-052 closes.

## The purity constraint (where the test must live)

`graph-real-play.ts` is **IMPURE**: it value-imports the three plays (each loads the BAML native
addon) and `castGraph` (which value-imports `castPlay` → spawns). Its header (lines 22–27) states the
rule: **no `bun test` may value-import this module**. Its WIRING judgment is proven through the pure
`graph-real-play-core.ts`, exercised by `graph-real-play-core.test.ts` — which imports ONLY the pure
core + the pure `runGraph`/`runGraphConcurrent`, never `graph-real-play.ts` and never `graph.ts`
(test header lines 21–28).

Consequence for this ticket: the envelope-sizing arithmetic (survey + 2×propose + note tokens; survey
+ propose + note time) must live as a PURE function in `graph-real-play-core.ts` so the test can pin
it WITHOUT importing the impure shell. `castRealPlayGraph` then calls that pure function + the pure
`allocate` (wallet.ts:104) and passes the result as `castGraph`'s third arg.

## Available pure ingredients

- `allocate(macro: Budget): Wallet` (wallet.ts:104) — one-line constructor; validates each dimension
  as a positive integer; `remaining` starts equal to `funded`.
- `runGraphConcurrent(spec, {wallet, priceOf})` (graph-core.ts:291) — the pure budgeted dispatcher
  the impure `castGraph` delegates to. Importable in tests (no spawn, no addon) — this is how
  `graph-example.test.ts` proves the shared wallet (`runSharedWalletFanout`, graph-example.ts:142).
- `costedStub(id, produced, price)` pattern (graph-example.ts:95–106) — a canned `RunSummary` carrying
  `actuals: {usage:{input_tokens}, wallMs}` so `debitWave` has a real delta. The template for a
  test that drives the real-play diamond under a real-play-sized wallet with no live model.
- `REAL_PLAY_EDGES`, `SURVEY_NODE`, `PROPOSE_1_NODE`, `PROPOSE_2_NODE`, `NOTE_NODE`
  (graph-real-play-core.ts:29–47) — already exported; the test and shell bind the same ids/edges.

## `GraphRealPlayOptions` today

The options interface (graph-real-play.ts:51–64) carries `projectRoot`, `model`, `transcriptDir`,
`intervened`, and the three per-node budget overrides (`surveyBudget`, `proposeBudget`, `noteBudget`).
The AC wants it to also carry a **macro/wallet override** so a caller (notably T-052-02's live entry)
can size or inject the shared envelope; omitted ⇒ the computed default.

## Constraints & assumptions

- **No live spend in this ticket.** AC is the pure WIRING judgment + green `bun test`/typecheck. The
  metered re-cast is T-052-02.
- **Back-compat.** Passing a wallet changes `castRealPlayGraph` from the legacy path to the budgeted
  path. The `import.meta.main` live entry (graph-real-play.ts:174) and T-052-02 are the only callers;
  the budgeted path is the intended behavior, so this is the point of the change, not a regression.
- **No new graph primitives, no executor swap** (E-052 non-goals). One narrow wire + one pure sizing
  function + test assertions.
- `allocate` throws `RangeError` on a non-positive/non-integer dimension — the computed macro is a sum
  of positive integers, so it is always valid; a caller-supplied override is their responsibility.
