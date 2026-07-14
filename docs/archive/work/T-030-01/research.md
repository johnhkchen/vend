# T-030-01 — Research: worth-and-warranted-budget-core

The pure foundation of the **supply** half of Home (IA-2): each authored playbook's **worth**
(its role) + its **warranted budget** (a recalibrated envelope from actuals, E-013). Two parts:
(1) add `readonly summary: string` to the `Play` contract and set it on the six registered plays;
(2) a **pure** `shelfRows(plays, records)` that pairs each play's `summary` with its recalibrated
envelope + a confidence read. No I/O. Output: a typed `ShelfRow[]` for T-030-02 to render.

This is descriptive. What exists, where, how it connects. No solutions proposed.

## The Play contract — `src/engine/play.ts`

`Play<I, O>` (line 127) is the shared contract every play hangs on. Members today:
`name`, `render`, `parse`, `gates`, `effect`, `budget: Budget`, `maxTurns?: number`, `card: Card`.
There is **no** `summary`/worth field — adding it is part 1 of this ticket.

- `name` (129): stable registry key, stamped on every run-log record. This is the join key into
  the ledger (`forPlay(records, play.name)`).
- `budget: Budget` (139): the play's authored default envelope — the **cold-start prior** the
  ticket hands `recalibrate` when a play has no measured history.
- `card: Card` (46–50): `{ color, type, rarity }`. `rarity` is `"common" | "uncommon" | "rare" |
  "mythic"` (`RARITIES`, line 40). The doc-comment at lines 36–41 explicitly notes a
  **`Rarity → ValueTier` mapping** that "is wired at the shelf boundary" — the engine contract
  deliberately stays MTG-native (`Rarity`) and does **not** depend upward on the shelf's `ValueTier`.
- `AnyPlay = Play<any, any>` (162): the type-erased element the registry stores (heterogeneous map).
- `PlayRegistry` (216): a pure `name → Play` Map; `registry` (246) is the shelf-wide singleton.
  `names()` returns registration order. **No iterator over `Play` objects** is exported — the
  registry stores plays but only `get(name)`/`has`/`names()` are public. A consumer wanting the six
  `Play` objects either calls `registry.get(name)` per name, or receives `plays` as an argument
  (the ticket's `shelfRows(plays, records)` signature takes them in — purity).

The module is **PURE** (types + a Map only; no fs/clock/network/process/addon). Adding a
required string field keeps it pure and addon-free.

## The six registered plays — `src/play/*.ts`

Each play self-registers at module load (`registry.register(...)`). Inventory (name · budget ·
card.rarity):

| Play | `name` | `budget` (timeMs / tokens) | rarity | role (for `summary`) |
|------|--------|----------------------------|--------|----------------------|
| decompose-epic | `decompose-epic` | 7_200_000 / 120_000 | mythic | epic → cleared stories + tickets |
| expand-fragment | `expand-fragment` | 1_200_000 / 250_000 | rare | rough fragment → one board-ready signal |
| capture-note | `capture-note` | 600_000 / 8_000 | common | a topic → a filed markdown note |
| propose-epic | `propose-epic` | 1_800_000 / 150_000 | rare | a signal → a proposed epic card |
| steer | `steer` | 2_400_000 / 400_000 | rare | project → a course-correction |
| survey | `survey` | 1_800_000 / 300_000 | rare | read the project → a ranked demand board |

Each play file declares its `Play` literal with a doc-comment describing render/parse/gates/effect/
budget/card (e.g. `survey.ts:79`, `note.ts:68`). Adding `summary` means one line per literal, set
role-level (one phrase per the ticket). Because `summary` will be **required**, `tsc` proves all six
declare it — a missing one is a compile error (the intended forcing function; an unworthed play
shouldn't ship).

Constraint: these literals are typed `satisfies`-style (`card: {...} satisfies Card`) but the play
object itself is annotated `Play<I, O>`, so a missing required member is a hard `tsc` error at the
declaration site. Pure tests import the play-*core* modules, never these BAML-loading files, so
adding `summary` does not touch any pure test path.

## The recalibration core — `src/ledger/recalibrate.ts` (E-013, owned elsewhere)

`recalibrate(play, records, tier, prior, opts?)` (line 124) → `RecalibrateResult`:
- `envelope: Budget` — tokens & wall-clock bounded **independently** at the tier percentile over
  the play's **successful** runs; censored (andon'd) runs counted but never averaged in (IA-13).
- `confidence: { successes, censored, percentile }` (64–72) — the sample size, the censored count,
  the percentile used.
- `source: "measured" | "prior"` (79) — `"prior"` means cold-start fired (`successes < minSuccesses`,
  default `COLD_START_MIN_SUCCESSES = 3`) and `envelope` **is** the passed-in `prior` verbatim.

This is exactly the shape the ticket needs: `source` distinguishes `measured` from `default`, and
`confidence.successes` is the `N` in "measured (N runs)". `recalibrate` already returns the prior
verbatim on cold-start with honest counts — so the "never a guess dressed as measured" lesson
(E-026) is **already enforced upstream**; `shelfRows` only has to read `source`/`successes`, never
re-derive them. `formatEnvelopeLabel` (173) renders a human label but is a *rendering* concern
(T-030-02); the core row carries structured fields, not a pre-formatted string.

`recalibrate` requires a `tier: ValueTier` to pick `TIER_PERCENTILE` (39): keystone p95, high p92,
standard p90, leaf p75. **The play carries no `ValueTier`** (the ticket forbids adding one) — so
`shelfRows` must supply the tier. The only worth-bearing signal already on a play is `card.rarity`,
and play.ts itself documents the `Rarity → ValueTier` mapping as the shelf-boundary wiring. This is
the one real design question (resolved in design.md).

## The actuals — `src/log/run-log.ts`

`RunRecord` (139) is the per-run ledger line. `forPlay(records, play, opts?)` (477) filters to one
play (and optionally outcome/project) — the exact seam `recalibrate` consumes internally. `recalibrate`
does its own `forPlay` filtering, so `shelfRows` passes the **whole** `records` array straight through
per play; it does not pre-filter. `loadRunLog` (535) is the one impure read verb (ENOENT → empty) —
**not** called by `shelfRows`; the ticket says "it takes the already-read records" (the impure CLI
shell in T-030-02 loads them). `totalTokens`/`wallClockMs` are pure derivations recalibrate uses.

## The shelf today — `src/shelf/gather.ts`, `src/shelf/menu.ts`

`menu.ts` is the existing **demand** surface (bare `vend`): `ValueTier` (23) =
`"keystone" | "high" | "standard" | "leaf"`; `Action` (30) = a board action; `rankActions`/
`visibleActions`/`renderMenu` rank+render; `formatBudget` (131) renders a `Budget` as `2h/50k`.
`gather.ts` has `budgetForTier(tier)` (135) / `TIER_BUDGET` (49) — the **static** tier→budget the
demand board uses today, *never recalibrated per-play* (the gap E-030 closes). `TIER_BUDGET` is the
tier hand-prior; for the supply shelf the cold-start prior is the **play's own** `budget`, not the
tier default.

The supply shelf (the row model) is **new** — there is no `ShelfRow` type and no `shelfRows`
function yet. They live in a new module under `src/shelf/`. `ValueTier` is the natural import for
the rarity→tier mapping.

## Test conventions

- `play.test.ts` builds a `makeStubPlay(name)` (line 23) returning a minimal valid `Play<unknown,
  unknown>` — **no BAML**, pure. Adding a required `summary` means updating this stub (one line) or
  every `Play` literal in the test fails to typecheck. This is the canonical place to build fixture
  plays for `shelfRows` unit tests.
- `recalibrate` tests fabricate `RunRecord[]` directly. `shelfRows` tests will do the same: a play
  with ≥3 success records → `measured` + N; a play with zero records → `default` carrying the
  play's authored `budget`; assert the `summary` rides through verbatim.
- Gates: `bun run check` = `baml:gen` + `tsc --noEmit` + `bun test`. Current suite is 853 tests
  green (per session history). `check:typecheck` proves the required-`summary` claim.

## Constraints & boundaries (assumptions surfaced)

- **Do not edit recalibration math** — E-013 owns `recalibrate`; `shelfRows` only *calls* it.
- **Do not add a `ValueTier` to `Play`** — worth is role, not leverage tier. Tier for the
  percentile is derived (from `card.rarity`), not stored.
- **`shelfRows` is pure** — no fs/clock; records are passed in.
- **`summary` is required** — compile-time proof every play declares its worth.
- **Confidence must not lie** (E-026/IA-8) — `default` is never labelled `measured`; this falls out
  of reading `recalibrate`'s `source`, not a re-implementation.
