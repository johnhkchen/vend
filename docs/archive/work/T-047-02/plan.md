# T-047-02 — Plan

Ordered, independently-verifiable steps. This is an analysis ticket: most "implementation" is reading
evidence and writing judgment; the only mutation is one `demand.md` edit. No `src/` changes ⇒ the
test/typecheck gates are unaffected and stay green.

## Step 1 — Gather the cast evidence (DONE during this pass)

Read the run-log + stdout + minted epic + board, and confirm the cited coordinates.

- `tail .vend/runs.jsonl` → the 3 records for the `03:53Z` cast (survey + 2 proposes).
- `work/T-047-01/cast-stdout.log` → corroborate (two `init` blocks = the wave; the `andon` line).
- `docs/active/epic/E-048.md` → the one minted epic + its mtime.
- `survey-board.md` → which signal #1 / #2 the proposes fanned over.
- `lisa validate` → orphan check.
- codebase-memory `search_code` → confirm `GraphResult` / `runGraph` / `buildRunRecord` / `wallClockMs`
  coordinates (ticket directive: use the MCP, not raw grep).

**Verify:** every number in the cast-log traces to a verbatim run-log field. ✅ complete.

## Step 2 — Write `graph-cast-log.md` (the settlement record)

The durable artifact T-047-01 never wrote. Structured as the ticket's four reads, each with the raw
run-log evidence inline (timestamps verbatim, no rounding that hides overlap).

1. **Concurrency proof** — the two proposes' `startedAt` (identical to the ms) + overlapping intervals;
   contrast survey→propose (sequential, 2 ms gap = the topo barrier). State the overlap window in seconds.
2. **Join** — no `capture-note` record, no note artifact; `GraphResult` halt-the-dependent-subgraph
   explains it (propose-1 failed → join skipped, `blockedBy: [propose-1]`). Honest: live join unproven.
3. **Minted-epic read** — E-048 sound-vs-filler; `lisa validate` clean; minted-only; keep/decompose.
4. **P7 + first-composition verdict** — per-node bound held (andon fired correctly); no shared
   cross-branch wallet (the gap the cast surfaced → E-048); cost tally; the modest honest verdict.

**Verify:** the four ACs each have a paragraph that either proves or honestly disproves the claim.

## Step 3 — Update `demand.md` Frontier 3 (the one mutation)

Two edits, both crystallizing E-047 from "in flight" to settled:

- **"In flight" table (line 88):** rewrite the Status cell `active → E-047 … Awaiting lisa loop` →
  **settled**: concurrency proven live; multi-upstream join unproven this run (degraded — propose-1
  budget-exhausted skipped the join); minted **E-048**; the modest first-composition read.
- **Frontier 3 section (lines 142–146):** `a live real-play graph → pulled → E-047 (in flight)` →
  **done → E-047** with the one-line verdict; and crystallize `cross-branch budget accounting` as
  **minted → E-048** (the cast surfaced its own need).

**Verify:** `grep -n "E-047\|E-048" docs/active/demand.md` shows the settled language; no "in flight"
/ "Awaiting lisa loop" left on the E-047 row.

## Step 4 — Gate + write `progress.md`

- Run `bun run check:typecheck` and `bun run check:test` (the AC's `check:*`). Expect green — we touch
  no `src/`. Record exact pass counts.
- Write `progress.md`: steps done, the verbatim evidence table, any deviation (the missing
  T-047-01 cast-log; writing it here instead).

**Verify:** typecheck EXIT 0; full suite pass count ≥ 1127 (the T-047-01 baseline), 0 fail.

## Step 5 — Write `review.md` (handoff) and stop

Summarize what changed (docs only), the four-read verdict, test-coverage note (no new tests — analysis
ticket; the wiring's coverage is T-047-01's `graph-real-play-core.test.ts`), and open concerns (the
unproven live join; E-048 awaiting decompose decision; the cross-branch-wallet gap). Then stop — Lisa
commits and advances.

## Testing strategy

No unit/integration tests added: this ticket writes judgment + a board edit, not behavior. The cast's
*wiring* is already unit-proven (T-047-01, 6 tests). The cast's *liveness* is what this ticket reads.
The only executable gate is `check:*` staying green, which is a regression guard (we changed no code).

## Risks

- **Over-claiming the join.** Mitigation: Step 2 read #2 states plainly the live join is unproven.
- **Mis-reading sequential as concurrent.** Mitigation: the proof rests on identical `startedAt` +
  interval overlap, not on stdout ordering.
- **demand.md drift.** Mitigation: edit only the E-047 row + the Frontier 3 follow-on line; leave the
  rest of the board intact.
