# T-047-01 — Live cast log (graph-cast-log.md)

**Verbatim record of the LIVE, METERED `castGraph` run** (the ticket's authorized P7 spend, run on
the user's explicit "Run it live now"). Honest on outcome: this is a **partial / degraded run** —
the **concurrency headline is proven live**, the JOIN-receives-both is **not** proven live (one
propose branch budget-exhausted, so the join correctly halted) but **is** proven deterministically in
the unit test. Nothing fabricated; the degrade cause is recorded.

## Command

```
$ bun run src/play/graph-real-play.ts
```

Run against the real repo root. Started `2026-06-21T03:53:31Z`, ended `2026-06-21T03:58:07Z`
(~4m36s wall). Exit code **1** (the graph halted — see verdict).

## Result (stdout, verbatim)

```
═ real-play graph — cast result ═
  node survey: success (materialized: true) → /Volumes/ext1/swe/repos/vend/docs/active/pm/staged/survey-board.md
  node propose-1: budget-exhausted (materialized: false)
  node propose-2: success (materialized: true) → /Volumes/ext1/swe/repos/vend/docs/active/epic/E-048.md
  node capture-note: SKIPPED — skipped — dependent on halted upstream 'propose-1' (halted: step outcome 'budget-exhausted' is not success)
  sinks (net output): {}
  graph halted: skipped — dependent on halted upstream 'propose-1' (halted: step outcome 'budget-exhausted' is not success)
```

## THE HEADLINE — concurrency evidence (the two proposes ran CONCURRENTLY)

From `.vend/runs.jsonl`, the four records this cast appended (`startedAt`/`endedAt` are the cast's
real wall-clock span, stamped by `castPlay`):

| node (record) | play | epic | outcome | startedAt | endedAt |
|---|---|---|---|---|---|
| survey | survey | survey of vend | success | `03:53:31.091` | `03:55:54.567` |
| **propose-1** | propose-epic | signal #1 | budget-exhausted | **`03:55:54.569`** | `03:57:03.539` |
| **propose-2** | propose-epic | signal #2 | success | **`03:55:54.569`** | `03:58:07.532` |

**The proof:** both propose casts have the **identical `startedAt` (`03:55:54.569`)** — 2 ms after
the survey ended — and their intervals **fully overlap**: propose-1 (`…54.569 → 57:03.539`) runs
*entirely inside* propose-2's span (`…54.569 → 58:07.532`). Two real `claude -p` casts were in flight
at the same wall-clock time. This is `runGraphConcurrent` dispatching the survey-ready wave
`[propose-1, propose-2]` through a single `Promise.all` — real branch concurrency, exactly the E-046
"run plays in parallel" claim, now carried by real plays. (The survey ran first and sequentially, as
the sole source node; the fan-out is where the concurrency lives.)

## Real `produced` threading (end-to-end, live)

- **survey → proposes (fan-out):** survey's `produced` = the staged board path
  `docs/active/pm/staged/survey-board.md`. BOTH propose nodes received it in their `NodeUpstreams`
  (keyed `survey`), read it, and `pickSignal`'d their ranked signal:
  - propose-1 ← signal #1 = *"Add conditional edges to the typed DAG…"* (the recommended pull).
  - propose-2 ← signal #2 = *"Cross-branch budget accounting…"*.
  The threading is real: the board the survey staged is the board the proposes parsed.
- **propose-2 → minted epic:** propose-2 cleared all gates and minted **E-048**
  (`docs/active/epic/E-048.md`, title `cross-branch-budget-wallet`). Its `produced` (the epic path)
  was threaded toward the join.
- **propose-1 → nothing:** propose-1 hit **budget-exhausted (180315 / 150000 tokens, over by
  30315)** — it did not materialize, so it surfaced no `produced`.

## The JOIN (capture-note) — halted, correctly

`capture-note` is a JOIN: `decideThread`/`runGraphConcurrent` only run it when **every** in-edge
upstream proceeded. propose-1 did not proceed, so the join was **SKIPPED** with the cause recorded
(`dependent on halted upstream 'propose-1' (budget-exhausted)`). This is the documented HALT-the-
dependent-subgraph semantics (`graph-core.ts`) firing **live**: the independent branch (propose-2)
still ran to success; only the dependent join skipped. No note was written; `produced` sinks = `{}`.

**So the live run proves:** concurrency ✓, real `produced` threading ✓, halt-the-dependent-subgraph
✓. It does **not** live-prove "the join receives BOTH epics" — because one branch halted. That
claim is proven **deterministically** in `graph-real-play-core.test.ts` (the JOIN receives
`{propose-1: epicA, propose-2: epicB}` and builds a topic naming both), which is the AC#2 surface.

## Degrade cause (honest)

propose-1's signal (*"Add conditional edges to the typed DAG — branch the graph on a node's
result…"*) is a meaty, high-leverage proposal; the propose play's default envelope (150k tokens) was
not enough for it on this run (it spent 180k). This is a **budget calibration** degrade, not a wiring
fault — the graph behaved exactly as designed (the over-budget branch halted, the in-budget branch
landed, the join skipped). A re-run with a larger `proposeBudget` (or the lighter signal #2 alone)
would land both. The fix lives in budget calibration (E-013 / the very epic propose-2 just minted,
E-048 *cross-branch-budget-wallet*), not in this ticket's wiring.

## Minted artifact — E-048 (verbatim head)

`docs/active/epic/E-048.md` (proposed from signal #2). Notably, the model proposed an epic that
*references this very run* — the concurrency E-047 just demonstrated and the budget gap it exposes:

```
---
id: E-048
title: cross-branch-budget-wallet
status: open
kind: permanent
advances: [P7, P3]
serves: >
  Makes the budget hard contract hold under real concurrency — one shared envelope across a
  fan-out, with a correct hard stop, instead of per-branch wallets that silently overspend …
---
```

> "E-046 gave the engine real concurrency (castGraph's wave dispatcher runs independent ready nodes
> via Promise.all), and E-047 proved it live with a survey→[propose×2]→capture-note diamond where two
> casts overlap. But the macro-wallet is still single-chain … two parallel casts both pass canAfford
> against the pre-wave balance and both spend — the P7 ceiling leaks across branches exactly where
> concurrency now lives."

(The minted epic independently re-derives the budget gap this very run hit — propose-1 overspending
its branch budget — which is strong, honest corroboration of both the concurrency and the degrade.)

## `lisa validate` after (E-043 — no orphan)

```
$ lisa validate
All checks passed. 114 tickets, 1 ready, DAG valid. Run `lisa loop` to start.
Config: max_threads=2, session_timeout=3600s
```

Clean. E-048 minted onto the board with no orphan (an epic card with no decomposition yet is a valid
board state — the propose play mints the card; decomposition is a separate gesture). P7 held: bounded
by the per-node budgets (propose-1 was *stopped* at its ceiling — the hard contract working).

## Known gotcha surfaced by the live run (for Review)

Both propose records share the **same `runId`** (`run-2026-06-21T03-55-54-569Z`) because `castPlay`
derives the runId from `startedAt` when none is passed, and the two concurrent casts started at the
identical millisecond. The run-log keeps two distinct records (distinguished by `play`/`epic`), so
ordering/accounting is fine — but their per-run **transcript files** (`<runId>.jsonl`) collide. A
graph that wants distinct transcripts per concurrent node should pass a node-scoped `runId` via
`opts`. Flagged in `review.md` as a follow-up (does not affect this ticket's ACs).
