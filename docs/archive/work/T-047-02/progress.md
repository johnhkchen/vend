# T-047-02 — Progress

Tracking the plan's five steps. Commits deferred to Lisa (the lisa-loop pattern: Lisa commits +
advances phases after `review.md`).

## Step 1 — Gather the cast evidence — DONE

Read `.vend/runs.jsonl` (3 records for the `03:53Z` cast), `work/T-047-01/cast-stdout.log`,
`docs/active/epic/E-048.md`, `docs/active/pm/staged/survey-board.md`. Ran `lisa validate`. Confirmed
the cited coordinates via codebase-memory `search_code` (project `Volumes-ext1-swe-repos-vend`):
`buildRunRecord`/`wallClockMs` in `src/log/run-log.ts`; `runGraph`+`GraphResult` in
`src/engine/graph-core.ts`; `runGraphConcurrent` (wave dispatcher) in `src/engine/graph.ts`.

The verbatim evidence (all four reads trace to these):

| play | subject | startedAt | endedAt | outcome | cost |
|---|---|---|---|---|---|
| survey | survey of vend | 03:53:31.091Z | 03:55:54.567Z | success | $0.862 |
| propose-epic | signal #1 | 03:55:54.569Z | 03:57:03.539Z | **budget-exhausted** | $0.619 |
| propose-epic | signal #2 | 03:55:54.569Z | 03:58:07.532Z | success → **E-048** | $0.576 |

## Step 2 — Write `graph-cast-log.md` (settlement record) — DONE

The durable artifact T-047-01 never wrote (it ran out of budget mid-cast). Written here with the four
reads, each backed by verbatim run-log fields:
1. **Concurrency PROVEN** — both proposes `startedAt 03:55:54.569Z`; overlap 68.97 s; sequential would
   have cost 201.9 s of propose wall vs the concurrent 132.96 s. The wave dispatcher, live.
2. **Join NOT proven live** — no `capture-note` record/artifact; propose-1 budget-exhausted ⇒ `runGraph`
   skipped the join (`blockedBy: [propose-1]`, `halted: true`). Live join stub-proven only.
3. **E-048 sound** (real P7 gap: no shared wallet across the concurrent wave); `lisa validate` clean
   (no orphan); minted-only; keep. The cast minted the demand for its own failure mode.
4. **P7 held per-node** (andon fired: spent 180315/150000, the exact token sum); no cross-branch
   envelope (→ E-048); $2.06 total; modest-but-real first-composition verdict.

## Step 3 — Update `demand.md` Frontier 3 — DONE

Two edits, both crystallizing E-047 from in-flight to settled:
- **"In flight" table:** the E-047 row Status `active → E-047 … Awaiting lisa loop` → **settled →
  E-047** with the honest verdict (concurrency proven; join unproven this run; E-048 minted; modest).
- **Frontier 3 section:** `live real-play graph → pulled → E-047 (in flight)` → **done → E-047** (with
  the verdict); `cross-branch budget accounting` → **minted → E-048**; and noted conditional edges
  stays open (it was signal #1, starved by propose-1's budget-exhaustion before it could mint).

## Step 4 — Gate — DONE

- `bun run check:typecheck` → **EXIT 0** (clean).
- `bun run check:test` → **1127 pass, 0 fail** (3022 expect() calls, 77 files). Unchanged from the
  T-047-01 baseline (1127) — expected: this ticket touches no `src/`, only `docs/`.

## Step 5 — Write `review.md` — DONE (see review.md), then stop for Lisa.

## Deviations from plan

- **The cited `work/T-047-01/graph-cast-log.md` does not exist.** The T-047-01 session exhausted its
  budget after launching the cast (its `progress.md` Step 4 is "IN PROGRESS"; no review.md). Rather than
  block on the missing artifact, this ticket reads the raw run-log/stdout the cast left and **writes the
  cast-log itself** under `work/T-047-02/graph-cast-log.md`. The settlement is unaffected — the run-log
  is the authoritative evidence either way. Documented so a reviewer is not surprised by the relocation.
- **No re-cast.** The plan and ticket both stance: settle the run that happened, honestly. The run was
  degraded (propose-1 budget-exhausted); recorded with cause, not hidden, not re-run for a cleaner result.
