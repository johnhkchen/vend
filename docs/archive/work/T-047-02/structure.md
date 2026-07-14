# T-047-02 — Structure

**Settle the live `survey → [propose ×2] → capture-note` cast (T-047-01) against the project's
no-over-claim standard.** This is an *analysis / settlement* ticket: no production code changes. The
"shape of the work" is (a) the evidence sources it reads, (b) the durable record it writes, and (c)
the one board edit it makes.

## Nature of the ticket

T-047-01 built the real-play graph and cast it live; this ticket *judges* that cast. The deliverable
is judgment + a board update, not new engine code. The RDSPI Implement phase here = write the
settlement record and edit `demand.md`. `bun run check:*` must stay green (we touch no `src/`).

A complication surfaced up front: the ticket cites `work/T-047-01/graph-cast-log.md` as "the run this
settles", **but that artifact was never written** — the T-047-01 session ran out of budget after
launching the cast (its `progress.md` Step 4 is still "IN PROGRESS"). So this ticket reads the raw
evidence the cast left behind and writes the cast-log itself, under *this* ticket's work dir.

## Evidence sources (read-only)

| Source | What it gives | Status |
|---|---|---|
| `.vend/runs.jsonl` (3 tail records) | Per-cast `startedAt`/`endedAt`/`outcome`/`gateResults`/`usage`/`costUsd` — **the concurrency proof** | ✅ present |
| `work/T-047-01/cast-stdout.log` | The raw `claude -p` stream: survey success, 2 inits (the wave), the `andon: budget-exhausted` | ✅ present (truncated mid-stream) |
| `docs/active/epic/E-048.md` | The one minted epic (`cross-branch-budget-wallet`), mtime = propose-2 endedAt | ✅ present |
| `docs/active/pm/staged/survey-board.md` | The ranked board the proposes fanned over (signal #1 / #2) | ✅ present |
| `src/engine/graph-core.ts` (`GraphResult`, `runGraph` skip semantics) | Why the join did not run (halt-the-dependent-subgraph) | ✅ cited, confirmed |
| `src/log/run-log.ts` (`buildRunRecord`, `wallClockMs`) | Provenance of the timestamps the proof reads | ✅ cited, confirmed |
| `lisa validate` | Orphan check (E-043 — no orphan from a minted-only epic) | ✅ run: all green |

Confirmed via **codebase-memory-mcp** `search_code` (project `Volumes-ext1-swe-repos-vend`) as the
ticket directs: `buildRunRecord` / `wallClockMs` live in `src/log/run-log.ts`; `runGraph` + `GraphResult`
in `src/engine/graph-core.ts`; `runGraphConcurrent` (the wave dispatcher) in `src/engine/graph.ts`.

## Files this ticket creates / modifies

**Created — `docs/active/work/T-047-02/`:**
- `structure.md` (this), `plan.md`, `progress.md`, `review.md` — the RDSPI artifacts.
- `graph-cast-log.md` — **the durable settlement record** (the artifact T-047-01 never wrote): the
  four reads with verbatim run-log evidence. This is the load-bearing output.

**Modified — one file only:**
- `docs/active/demand.md` — crystallize E-047 on Frontier 3:
  - The **"In flight"** table row (line 88): `active → E-047` → **settled** with the honest verdict
    (concurrency proven; join unproven this run; E-048 minted).
  - The **Frontier 3** section (lines 142–146): `live real-play graph → pulled → E-047 (in flight)`
    → **done → E-047**, and crystallize the `cross-branch budget accounting` follow-on as **E-048**.

**Not touched:** any `src/` file, any test, the ticket frontmatter (Lisa advances phases).

## The four reads (the settlement's shape)

The `graph-cast-log.md` is organized as the ticket's four reads, each backed by the run-log:

1. **Concurrency (headline).** Both propose records share `startedAt` to the millisecond and their
   `[startedAt, endedAt]` intervals overlap → the wave dispatcher ran them concurrently. **Provable.**
2. **The join.** No `capture-note` run-log record + no note artifact + `GraphResult.skipped` semantics
   ⇒ the join **did not run live** (an upstream failed). Honest record: live join **unproven**; it
   stands only in the stub test (`graph-real-play-core.test.ts` via `runGraph`).
3. **Minted-epic quality + decompose status.** One epic (E-048) minted by the surviving propose; sound
   vs filler; `lisa validate` clean; minted-only (E-046 partial-chain pattern); keep / decompose / throwaway.
4. **P7 + honest first-composition verdict.** Spend bounded (the andon fired and held); the modest
   first-composition read — no over-claim, no under-claim.

## Boundaries / non-goals

- **No re-cast.** This ticket settles the run that happened; it does not spend to get a cleaner one.
  A degraded run recorded honestly is the deliverable (the ticket's explicit stance).
- **No engine fix.** The cross-branch-wallet gap the cast surfaced is *demand* (E-048), not in-scope work.
- **No frontmatter edits.** Lisa detects artifacts and advances `phase`.
