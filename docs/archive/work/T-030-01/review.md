# T-030-01 — Review: worth-and-warranted-budget-core

Handoff for a human reviewer. What changed, test coverage, open concerns.

## What changed

Two atomic commits on `main`, both green at their boundary.

**Commit 1 — `feat(play): add required summary worth to the Play contract`**
- `src/engine/play.ts` — added `readonly summary: string` (required, doc-commented) to `Play<I, O>`,
  after `name`. The only contract change; module stays pure (no new coupling).
- Six play literals gained one role-level `summary` line each:
  `src/play/{decompose-epic,expand-fragment,note,propose-epic,steer,survey}.ts`.
- `src/engine/play.test.ts` — `makeStubPlay` gained `summary` so the pure stub still typechecks.

**Commit 2 — `feat(shelf): pure shelfRows worth + warranted-budget core`**
- `src/shelf/shelf-row.ts` (new) — `ShelfConfidence`, `ShelfRow`, `RARITY_TIER`/`tierForRarity`,
  `shelfRows(plays, records)`. Pure; one value import (`recalibrate`), rest type-only.
- `src/shelf/shelf-row.test.ts` (new) — 9 unit tests.

No files deleted. `recalibrate.ts`, `run-log.ts`, `gather.ts`, `menu.ts` untouched (read-only deps).

## Acceptance criteria — all met

- **AC#1** — `Play` gains required `summary`, set on all six; `tsc` proves it. ✅ `check:typecheck`
  green; grep confirmed the six literals + one stub are the complete set of `Play` constructors.
- **AC#2** — pure `shelfRows(plays, records)`: one row per play, recalibrated envelope (cold-start to
  the play's authored `budget` when N=0), confidence distinguishing `measured (N)` from `default`. ✅
- **AC#3** — unit-tested (history → measured + N; no records → authored default labelled `default`;
  worth verbatim); `bun run check:*` green. ✅ **862 pass / 0 fail** (was 853; +9).

## Test coverage

Strong for a pure core. Covered:
- `tierForRarity`/`RARITY_TIER` — every rarity → its tier; no gaps.
- Measured path — ≥cold-start successes → `{ kind:"measured", runs:N }`, envelope = the percentile
  (asserted ≠ the prior, so it is genuinely measured).
- Tier-flows-through — mythic (p95→5000) vs common (p75→4000) on the *same* sample, proving rarity
  reaches `recalibrate`'s percentile selection (not just stored).
- Cold-start — zero records AND below-threshold (2 successes) both → `default` with the authored
  budget verbatim (the E-026 lesson, twice).
- Worth/name verbatim; input order preserved; per-play isolation (one play's runs don't bleed into
  another's row); empty `plays` → `[]`; inputs not mutated.

Gaps (acceptable — out of this ticket's scope):
- No test for the wall-clock (`timeMs`) dimension of a measured envelope (token dimension is
  asserted; time follows the identical `recalibrate` path, which recalibrate.test.ts covers fully).
- No test mixing censored (`budget-exhausted`/`timed-out`) records into a row — `shelfRows` doesn't
  read the censored count (it surfaces only `successes`); censoring math is recalibrate.test.ts's.
- `shelfRows` over the *real* `registry` plays is not exercised (it takes `plays` in by design; the
  registry-wiring is the impure T-030-02 shell's smoke).

## Open concerns / notes for the reviewer

1. **Tier source = `card.rarity`** (the one judgment call). Grounded in `play.ts:36–41`, which
   documents this exact `Rarity → ValueTier` mapping as "wired at the shelf boundary," and it is an
   order-preserving bijection (mythic→keystone … common→leaf). If product later wants an explicit
   per-play tier independent of rarity, it slots in behind `tierForRarity` without changing
   `shelfRows`' shape. Flagged because it is the only non-mechanical decision here. See design.md §B.
2. **`summary` wording is provisional.** The six strings are role-level and parallel, but are
   authored prose — worth a human read for voice/accuracy (e.g. is "course-correction" the right word
   for `steer`?). Changing them is a one-line edit per play; no structural impact.
3. **Confidence carries only `successes`, not the censored (andon) count.** Deliberate: the ticket's
   row is name·summary·envelope·confidence, and the andon tail is a richer render-time detail
   (T-030-02 can pull it straight off a `recalibrate` call if the surface wants it). The discriminated
   union (`default` has no `runs`) makes the honest-confidence contract type-enforced, not conventional.
4. **No ranking.** `shelfRows` preserves input order; ranking the supply shelf (if wanted) is a
   T-030-02 / later concern, matching how `menu.ts` separates `rankActions` from the model.

## Downstream

Unblocks **T-030-02** (`renderShelf` + `vend shelf` CLI verb): it will load records (`loadRunLog`),
gather the registry plays, call `shelfRows`, and render rows via the DL-6…DL-9 surface
(`formatBudget` for the envelope; a label for `confidence`). The structured `ShelfRow` is the seam —
no formatting decisions leaked into this core.

## Critical issues

None. No security surface (pure, no I/O), no migration, no behavioural change to existing plays
(adding a read-only field; runtime behaviour of `castPlay`/the registry is unchanged).
