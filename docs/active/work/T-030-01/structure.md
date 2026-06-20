# T-030-01 — Structure: worth-and-warranted-budget-core

The blueprint — files, interfaces, boundaries, ordering. Not code; the shape of the code.

## Files

| File | Action | What |
|------|--------|------|
| `src/engine/play.ts` | modify | add `readonly summary: string` to `Play<I, O>` |
| `src/play/decompose-epic.ts` | modify | set `summary` on `decomposeEpicPlay` |
| `src/play/expand-fragment.ts` | modify | set `summary` on `expandFragmentPlay` |
| `src/play/note.ts` | modify | set `summary` on `captureNotePlay` |
| `src/play/propose-epic.ts` | modify | set `summary` on `proposeEpicPlay` |
| `src/play/steer.ts` | modify | set `summary` on `steerProjectPlay` |
| `src/play/survey.ts` | modify | set `summary` on `surveyPlay` |
| `src/engine/play.test.ts` | modify | add `summary` to `makeStubPlay` (keeps the pure stub valid) |
| `src/shelf/shelf-row.ts` | **create** | `ShelfRow`, `ShelfConfidence`, `tierForRarity`, `shelfRows` |
| `src/shelf/shelf-row.test.ts` | **create** | unit tests for the new pure core |

No deletions. No changes to `recalibrate.ts`, `run-log.ts`, `gather.ts`, `menu.ts` (read-only deps).

## `src/engine/play.ts` — the contract change

Add to the `Play<I, O>` interface (after `name`, line 129), a required member:

```ts
/** One-line worth — what this playbook is FOR, role-level (e.g. survey → "read the
 *  project → a ranked demand board"). Required: tsc proves every play declares its
 *  worth; a missing one is a compile error (an unworthed play shouldn't ship). The
 *  shelf (E-030) pairs it with the warranted envelope to form a supply row. */
readonly summary: string;
```

This is the only contract edit. `AnyPlay`, `PlayRegistry`, errors — unchanged. Module stays pure
(a string field adds no fs/clock/addon coupling). Every `Play` literal now fails `tsc` until it
declares `summary` — the forcing function; the next six edits satisfy it.

## The six play literals — `summary` values

One added line per `Play` object literal (placed next to `name`/`budget`). Role-level, one line:

| File | object | `summary` |
|------|--------|-----------|
| decompose-epic.ts | `decomposeEpicPlay` | `"clear an epic into ready stories and tickets"` |
| expand-fragment.ts | `expandFragmentPlay` | `"grow a rough fragment into one board-ready signal"` |
| note.ts | `captureNotePlay` | `"capture a topic into a filed markdown note"` |
| propose-epic.ts | `proposeEpicPlay` | `"turn a signal into a proposed epic card"` |
| steer.ts | `steerProjectPlay` | `"read the project and propose a course-correction"` |
| survey.ts | `surveyPlay` | `"read the project into a ranked demand board"` |

(Wording finalised in implement; the shape is one short role phrase, lowercase, verb-led — mirroring
the existing doc-comment one-liners on each play. Exact strings may be tuned for parallelism.)

## `src/engine/play.test.ts` — stub fix

`makeStubPlay` (line 23) returns a `Play<unknown, unknown>`; it must gain `summary` or it stops
typechecking once the contract requires it. One line:

```ts
return {
  name,
  summary: `stub ${name}`,   // ← added
  render: () => "",
  ...
};
```

This is the canonical fixture builder; `shelf-row.test.ts` reuses the same pattern.

## `src/shelf/shelf-row.ts` — the new pure core

Public surface:

```ts
import type { Budget } from "../budget/budget.ts";
import type { AnyPlay, Rarity } from "../engine/play.ts";
import type { RunRecord } from "../log/run-log.ts";
import { recalibrate } from "../ledger/recalibrate.ts";   // value import (the one)
import type { ValueTier } from "./menu.ts";

export type ShelfConfidence =
  | { readonly kind: "measured"; readonly runs: number }
  | { readonly kind: "default" };

export interface ShelfRow {
  readonly name: string;
  readonly summary: string;
  readonly envelope: Budget;
  readonly confidence: ShelfConfidence;
}

/** Order-preserving Rarity → ValueTier map (play.ts:36–41). Total: every Rarity is a key. */
export const RARITY_TIER: Record<Rarity, ValueTier>;
export function tierForRarity(rarity: Rarity): ValueTier;   // RARITY_TIER[rarity]

export function shelfRows(plays: readonly AnyPlay[], records: readonly RunRecord[]): ShelfRow[];
```

Internal logic of `shelfRows` (pure, total, input order preserved):
- per play: `tier = tierForRarity(play.card.rarity)`;
  `r = recalibrate(play.name, records, tier, play.budget)`;
- `confidence = r.source === "measured" ? { kind: "measured", runs: r.confidence.successes }
  : { kind: "default" }`;
- push `{ name: play.name, summary: play.summary, envelope: r.envelope, confidence }`.

No I/O. No registry access. No ranking. Returns a fresh array; inputs never mutated.

### Boundary contracts

- **Depends UP** onto `engine` (play types), `ledger` (`recalibrate`), `log` (`RunRecord` type),
  `budget` (`Budget` type), and sideways onto `menu.ts` (`ValueTier`). Nothing imports `shelf-row.ts`
  back yet; T-030-02 will (the render shell). Acyclic.
- **Type-only imports** except `recalibrate` (the lone value import). No BAML, no fs — so the test
  is an ordinary pure test (never loads the addon), matching `menu.test.ts` / `press-core.test.ts`.
- **E-013 boundary respected**: `shelf-row.ts` *calls* `recalibrate` with the play's authored
  `budget` as the prior; it never re-derives percentile/cold-start/confidence math.

## `src/shelf/shelf-row.test.ts` — coverage shape

A local `makeStubPlay(name, { rarity, budget, summary })` fixture (no BAML) + a `rec(play, outcome,
{tokens, ms})` `RunRecord` builder. Cases (detailed in plan.md):
1. play with ≥3 success records → `confidence.kind==="measured"`, `runs===N`, envelope measured.
2. play with 0 records → `confidence.kind==="default"`, envelope **===** the play's authored budget.
3. play with 1–2 successes (below cold-start) → still `default` (honest, not measured).
4. `summary` rides through verbatim; `name` is the join key; row order matches input order.
5. `tierForRarity` / `RARITY_TIER` — each rarity maps to its tier (table-driven).

## Ordering of changes (why this sequence)

1. `play.ts` contract first (breaks `tsc` everywhere a play is declared — the forcing function).
2. Six play literals + `play.test.ts` stub (restore green `tsc`).
3. `shelf-row.ts` (the new core) — depends on the now-`summary`-bearing contract.
4. `shelf-row.test.ts` — pins the new behaviour.

Each of 1–2 is one atomic, compile-restoring commit; 3–4 a second. Keeps every commit green.
