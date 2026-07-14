# T-047-01 — Review

Handoff for a human reviewer: what changed, what's proven, and the open concerns. The headline is the
**concurrency** (two real casts overlapping) + the **join semantics** — proven LIVE — not the
artifacts.

## What changed

Three new files, no edits to existing code (engine ⊥ play holds — the shell depends UP onto
`castGraph` + the three plays; nothing depends down on it). Committed at `953657b`.

| File | Kind | Lines | Tested |
|---|---|---|---|
| `src/play/graph-real-play-core.ts` | pure, addon-free | ~120 | yes — `graph-real-play-core.test.ts` |
| `src/play/graph-real-play-core.test.ts` | unit test (addon-free) | ~155 | — (6 tests) |
| `src/play/graph-real-play.ts` | impure shell + live entry | ~175 | no (the `castGraph`/`chain.ts` discipline) — proven live |
| `docs/active/work/T-047-01/graph-cast-log.md` | live cast record | — | — |

The real-play graph is the graph-scale analog of `chain-propose-decompose.ts`: a `survey → [propose
×2] → capture-note` diamond. The pure core owns the adapter judgment (`pickSignal` fan-out selector,
`buildConsolidationTopic` join topic, id derivation, run-log subjects) + node identity; the impure
shell wires the four `PlayNode`s and carries the `import.meta.main` live entry.

## Acceptance criteria

- **AC#1 — real-play `DagSpec` survey→[propose×2]→capture-note; fan-out uses `parseBoardSignals`, the
  join consumes both upstream epic paths.** ✅ `buildRealPlayGraph` (`graph-real-play.ts`) +
  `REAL_PLAY_EDGES`. Fan-out adapters read the survey board and `pickSignal` (over
  `parseBoardSignals`); the join adapter reads both `propose-1`/`propose-2` epic paths.
- **AC#2 — wiring unit-tested deterministically (stubs): fan-out extracts #1/#2; join receives BOTH,
  builds a note referencing both; NO live model.** ✅ `graph-real-play-core.test.ts` — 6 tests,
  addon-free, driven through the pure `runGraph` with stub nodes wrapping the REAL adapters. Asserts
  propose-1 saw signal #1, propose-2 saw signal #2, the join saw `{propose-1: epicA, propose-2:
  epicB}`, the topic names both.
- **AC#3 — cast LIVE through `castGraph`: two proposes CONCURRENT (evidence), join note references
  both, real `produced` threading, `lisa validate` clean; OR an honest degraded record with cause.**
  ✅ via the **honest degraded** branch (explicitly permitted): the two proposes ran **concurrently**
  (identical `startedAt`, overlapping spans — `graph-cast-log.md`), real `produced` threaded
  end-to-end, `lisa validate` clean. The join did **not** receive both *live* — propose-1
  budget-exhausted, so the join correctly **halted** — recorded with the cause. The "join receives
  both" claim is met by AC#2's deterministic proof.
- **AC#4 — `graph-cast-log.md` captures run + concurrency evidence + minted ids/note path.** ✅
  Verbatim stdout, the runs.jsonl timestamp table (the concurrency proof), the minted E-048 card, the
  degrade cause, and `lisa validate`.

## Test coverage

- **Pure adapters:** `pickSignal` (ranked #1/#2 + the `< 2` honest degrade), `epicIdFromPath`,
  `buildConsolidationTopic` (names both; degrades legibly). Direct unit tests.
- **Wiring (fan-out + JOIN):** the stub-node `runGraph` proof — the load-bearing AC#2 surface. Proven
  without the addon (never imports the spawning shell).
- **Concurrency / live threading / halt:** the live cast (`graph-cast-log.md`) — concurrency,
  `produced` threading, and halt-the-dependent-subgraph all proven LIVE.
- **Full suite:** 1127 pass / 0 fail (was 1121 at T-046-03; +6); `tsc --noEmit` clean.

### Coverage gaps (honest)

- **The impure shell `graph-real-play.ts` is not unit-tested** — by design (it value-imports the
  addon; the `chain.ts`/`graph.ts` discipline). Its wiring is the tested pure core; its cast is proven
  live. The shell's own glue (the async board read in `adapt`, the budget fallback) is exercised only
  by the live run.
- **The live JOIN-receives-both path is unproven live** (propose-1 halted). Deterministically proven
  (AC#2). A re-run with a larger `proposeBudget` would close it live; not required by the AC.
- **The `< 2 signals` degrade path** is unit-tested at the `pickSignal` level but its end-to-end
  consequence (empty signal → propose value-gate STOP → join skip) is not exercised live (the real
  board had 14 signals).

## Open concerns / follow-ups

1. **runId collision for concurrent nodes (real, minor).** Both proposes derived the same `runId`
   (`run-2026-06-21T03-55-54-569Z`) — `castPlay` derives it from `startedAt`, and the two concurrent
   casts started at the same millisecond. Run-log records stay distinct (keyed by `play`/`epic`), so
   accounting is correct, but their per-run **transcript files** (`<runId>.jsonl`) collide. A graph
   with concurrent nodes should pass a node-scoped `runId` via `opts`. Candidate fix: `castGraph` (or
   the real-play shell) injects a per-node `runId` suffix. Not in this ticket's scope.
2. **Propose budget calibration.** propose-1 over-ran the 150k default on a meaty signal (180k spent).
   Expected (E-013 recalibration territory) — and exactly what the epic propose-2 minted (E-048
   *cross-branch-budget-wallet*) is about. The graph's behavior was correct (it stopped at the
   ceiling — P7 working).
3. **Run-log subject for the propose nodes** names the branch (`signal #1`) not the picked signal
   text — because `opts` resolves synchronously while the signal is read async in `adapt`. Cosmetic
   (the cast is driven by `adapt`'s real signal); could be improved by threading the picked signal.
4. **No CLI verb** — the live entry is `bun run src/play/graph-real-play.ts` (`import.meta.main`), the
   minimal non-invasive choice. Promoting to a `vend graph` verb is a clean follow-up if the real-play
   graph becomes a recurring gesture.

## Board mutation (authorized, clean)

The live run minted **E-048** (`docs/active/epic/E-048.md`) and staged
`docs/active/pm/staged/survey-board.md`. No note was written (the join skipped). `lisa validate`
confirms no orphan. These are the ticket's authorized P7 artifacts (data, not code) — left in place;
E-048 is a genuinely coherent epic the board can now act on.

## Verdict

The substrate is proven to carry **real plays + real concurrency**: two real casts overlapped, real
`produced` threaded end-to-end, and the JOIN's halt semantics fired correctly live. The one claim not
shown live — the join consuming both epics — is the deterministic AC#2 proof, degraded live by a
budget ceiling (recorded honestly). P7 held; the board is clean. Ready for human review.
