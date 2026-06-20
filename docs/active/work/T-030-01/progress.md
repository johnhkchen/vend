# T-030-01 — Progress

Executing plan.md. Gate at each commit: `bun run check` (`baml:gen` + `tsc --noEmit` + `bun test`).

## Step 1 — `Play.summary` contract — DONE

`src/engine/play.ts`: added `readonly summary: string` (required, doc-commented) to `Play<I, O>`
directly after `name`. As planned, this broke `tsc` at all six play literals + the test stub until
Step 2 satisfied it (the forcing function).

## Step 2 — worth on all six plays + test stub — DONE

Set one role-level `summary` per `Play` literal:
- `decompose-epic` → `"clear an epic into ready stories and tickets"`
- `expand-fragment` → `"grow a rough fragment into one board-ready signal"`
- `capture-note` → `"capture a topic into a filed markdown note"`
- `propose-epic` → `"turn a signal into a proposed epic card"`
- `steer` → `"read the project and propose a course-correction"`
- `survey` → `"read the project into a ranked demand board"`

`src/engine/play.test.ts`: `makeStubPlay` gained `summary: \`stub ${name}\``.

`bun run check:typecheck` green — AC#1 proven: every registered play declares its worth, the
cast/registry paths unaffected. Grep confirmed these six literals + the one stub are the COMPLETE
set of `Play` constructors in the tree (no other site to update).

## Step 3 — `src/shelf/shelf-row.ts` — DONE

New pure core: `ShelfConfidence` (discriminated union — `default` carries no `runs`, so
"measured (0)" is unrepresentable), `ShelfRow` (name · summary · envelope · confidence, structured
not pre-rendered), `RARITY_TIER`/`tierForRarity` (the documented Rarity→ValueTier shelf-boundary
map), and `shelfRows(plays, records)`. The latter maps each play through `recalibrate(play.name,
records, tierForRarity(play.card.rarity), play.budget)` and reads `result.source` →
`measured`/`default`. One value import (`recalibrate`); all else type-only; pure, addon-free.

## Step 4 — `src/shelf/shelf-row.test.ts` — DONE

9 pure tests, no BAML (stub plays) + fabricated `RunRecord`s (the recalibrate.test.ts `recordOf`
pattern): tierForRarity table + coverage; measured envelope + N on history; rarity→percentile flow
(mythic p95=5000 vs common p75=4000 on the same sample); cold-start (no data → authored budget,
labelled default) and below-threshold (2 successes → still default); worth/name verbatim; input
order + per-play isolation (one play's runs don't bleed); empty plays + no-mutation.

## Gate result

`bun run check` fully green: **862 pass / 0 fail** (was 853; +9 shelf-row tests), `tsc --noEmit`
clean, `baml:gen` clean. AC#1/#2/#3 all satisfied.

## Deviations from plan

None. Implemented exactly as designed/structured/planned. (The plan named two commits; both landed
green at their boundaries — see git log.)
