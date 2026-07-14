# T-047-01 — Progress

Tracking the plan's four steps. Commits deferred to Lisa (the T-046-02/T-046-03 lisa-loop pattern:
Lisa commits + advances phases after `review.md`).

## Step 1 — Pure core `graph-real-play-core.ts` — DONE

Created `src/play/graph-real-play-core.ts` (addon-free): node-id constants (`SURVEY_NODE`,
`PROPOSE_1_NODE`, `PROPOSE_2_NODE`, `NOTE_NODE`), `REAL_PLAY_EDGES` (the diamond), `pickSignal` (the
fan-out selector over `parseBoardSignals`, with the honest `SignalSelection` degrade),
`epicIdFromPath`, `buildConsolidationTopic` (the join topic naming both epics), and the non-empty
run-log subjects (`subjectForProposeSignal`, `subjectForJoin`). The only value import is the pure
`parseBoardSignals` (work-core). No fs/clock/addon.

## Step 2 — Unit test `graph-real-play-core.test.ts` — DONE

Created `src/play/graph-real-play-core.test.ts` (addon-free; imports only the pure core + pure
`runGraph` + types). 6 tests, all green:
- `pickSignal` extracts ranked signal #1/#2; degrades honestly on `< 2` signals.
- `epicIdFromPath` / `buildConsolidationTopic` (names both epics; degrades legibly).
- **Wiring proof**: a `DagSpec` with the REAL node ids + `REAL_PLAY_EDGES`, stub casts wrapping the
  REAL adapters over a temp-dir fixture board, driven through pure `runGraph`. Asserts the fan-out
  delivers the board to BOTH proposes (each picks its ranked signal), the JOIN receives BOTH epic
  paths (`{propose-1: epicA, propose-2: epicB}`), and the join topic names both ids.

`bun test src/play/graph-real-play-core.test.ts` → 6 pass.

## Step 3 — Impure shell `graph-real-play.ts` — DONE

Created `src/play/graph-real-play.ts` (impure; value-imports the three plays + `castGraph`):
`GraphRealPlayOptions`, `buildRealPlayGraph` (the four `PlayNode`s + `REAL_PLAY_EDGES` — survey
source, two propose fan-out branches reading the board + `pickSignal`-ing #1/#2, the capture-note
JOIN reading both epic paths), `castRealPlayGraph` (the metered verb), and the `import.meta.main` live
entry. The propose `adapt` is async (reads the survey board); the join `adapt`/`opts` derive from both
upstream epic paths.

Verification:
- `bun run check:typecheck` → EXIT 0 (clean).
- `bun test` (full suite) → **1127 pass, 0 fail** (was 1121 at T-046-03; +6 new).
- Confirmed NO `bun test` file value-imports `graph-real-play.ts` (the `chain.ts`/`graph.ts`
  purity discipline holds — grep clean).

### Deviations from plan

- The propose node's `opts` (run-log subject) names the branch (`signal #N`) rather than the picked
  signal text: `opts` is resolved synchronously by `castGraph`, but the signal is only known after the
  async board read inside `adapt`. The subject is still non-empty + meaningful; the picked signal is
  what actually drives the cast (via `adapt`). Minor, documented in the shell.

## Step 4 — Live metered cast + capture — DONE (partial / honest degraded run)

Authorized by the user ("Run it live now"). Ran `bun run src/play/graph-real-play.ts` against the
repo root (~4m36s, exit 1 — the graph halted). Full verbatim record in `graph-cast-log.md`. Outcome:

- **survey** → success, staged the board.
- **propose-1 / propose-2** ran **CONCURRENTLY** — identical `startedAt` `03:55:54.569`, fully
  overlapping intervals (the headline; runs.jsonl evidence in the cast log).
- **propose-2** → success, minted **E-048** (`cross-branch-budget-wallet`).
- **propose-1** → **budget-exhausted** (180315/150000 tokens) — did not proceed.
- **capture-note** (JOIN) → **SKIPPED** (halt-the-dependent-subgraph: one upstream halted) — the
  documented semantics firing live.
- `lisa validate` → clean (114 tickets, DAG valid, no orphan).

**Honest verdict:** concurrency ✓ live; real `produced` threading ✓ live; halt semantics ✓ live;
"JOIN receives BOTH epics" ✓ deterministically (unit test) but NOT live (degraded — one branch
over-budget). The degrade is a **budget-calibration** cause, not a wiring fault. Recorded, not
hidden — the AC#3 "honest degraded-run record with the cause" outcome.

Deviation: the live run also surfaced a **runId collision** for concurrent nodes (both proposes
derived the same `runId` from the identical `startedAt`) — flagged in `review.md` as a follow-up
(transcripts collide; run-log records stay distinct, ACs unaffected).
