# T-030-01 — Plan: worth-and-warranted-budget-core

Ordered, independently-verifiable steps. Two atomic commits. Verification = `bun run check`
(`baml:gen` + `tsc --noEmit` + `bun test`) green at each commit boundary.

## Step 1 — add `summary` to the `Play` contract

`src/engine/play.ts`: add `readonly summary: string` (with doc-comment) to `Play<I, O>` directly
after `name`. **Expected intermediate state:** `tsc` now errors at all six play literals and the
test stub (required field missing). This is the forcing function working — do not stop here.

## Step 2 — set `summary` on all six plays + fix the test stub

One added line per `Play` literal, role-level, verb-led, lowercase:
- `decompose-epic.ts` → `"clear an epic into ready stories and tickets"`
- `expand-fragment.ts` → `"grow a rough fragment into one board-ready signal"`
- `note.ts` → `"capture a topic into a filed markdown note"`
- `propose-epic.ts` → `"turn a signal into a proposed epic card"`
- `steer.ts` → `"read the project and propose a course-correction"`
- `survey.ts` → `"read the project into a ranked demand board"`

`src/engine/play.test.ts`: add `summary: \`stub ${name}\`` to `makeStubPlay`.

**Verify:** `bun run check:typecheck` green (proves AC#1 — every play declares `summary`, the
cast/registry paths unaffected). `bun test` green (no behavioural change). **Commit 1:**
`feat(play): add required summary worth to the Play contract (T-030-01)`.

## Step 3 — create `src/shelf/shelf-row.ts`

Implement per structure.md:
- imports: type-only `Budget`, `AnyPlay`, `Rarity`, `RunRecord`, `ValueTier`; value `recalibrate`.
- `ShelfConfidence` (discriminated union), `ShelfRow` interface.
- `RARITY_TIER: Record<Rarity, ValueTier>` = `{ mythic:"keystone", rare:"high", uncommon:"standard",
  common:"leaf" }`; `tierForRarity(rarity)` = `RARITY_TIER[rarity]`.
- `shelfRows(plays, records)`: map each play → `recalibrate(play.name, records,
  tierForRarity(play.card.rarity), play.budget)`; build `confidence` from `result.source`
  (`measured` → `{ kind:"measured", runs: result.confidence.successes }`, else `{ kind:"default" }`);
  return `{ name, summary, envelope: result.envelope, confidence }`. Input order preserved; pure.

**Verify:** `tsc` green.

## Step 4 — create `src/shelf/shelf-row.test.ts`

Fixtures (no BAML — pure): `makeStubPlay(name, opts?)` returning a valid `Play<unknown, unknown>`
with overridable `rarity`/`budget`/`summary`; `rec(name, outcome, {tokens, ms})` building a
`RunRecord` (via `buildRunRecord` or a literal frozen object with `startedAt`/`endedAt` so
`wallClockMs` parses). Tests:

1. **measured** — a play + 3 `success` records with known token/ms costs → `shelfRows` returns
   `confidence === { kind:"measured", runs: 3 }`; `envelope` equals the recalibrated percentile
   (assert it differs from the authored budget, or matches the expected p-value of the sample).
2. **default (no data)** — a play + `[]` records → `confidence === { kind:"default" }` and
   `envelope` **deep-equals the play's authored `budget`** (cold-start prior, verbatim). The
   E-026 lesson: not labelled measured.
3. **default (below cold-start)** — a play + 2 success records → still `{ kind:"default" }`
   (`COLD_START_MIN_SUCCESSES = 3`), envelope = authored budget.
4. **worth verbatim** — `row.summary` === the play's `summary`; `row.name` === `play.name`.
5. **order + multiplicity** — `shelfRows([a, b, c], records)` returns 3 rows in input order, each
   keyed to the right play (records for one play don't bleed into another's row — relies on
   `recalibrate`'s internal `forPlay` filter; assert play `b` with no records is `default` even
   when play `a` has history).
6. **`tierForRarity`** — table-driven: mythic→keystone, rare→high, uncommon→standard, common→leaf;
   and (sanity) a mythic play's measured envelope is bound at p95 vs a common play at p75 on the
   same sample (confirms the tier actually flows into recalibrate).

**Verify:** `bun run check` fully green (AC#3 — unit-tested; `bun run check:*` green). **Commit 2:**
`feat(shelf): pure shelfRows worth + warranted-budget core (T-030-01)`.

## Testing strategy

- **All unit, all pure.** No integration test needed — `shelfRows` has no I/O; `recalibrate` is
  already integration-covered by E-013. The new surface is a pure composition + a total lookup map.
- **No BAML in the test process** — fixtures build `Play` stubs directly (the `play.test.ts`
  precedent), so the suite stays addon-free and fast.
- **Determinism** — `RunRecord` fixtures use fixed ISO timestamps so `wallClockMs` is stable; token
  sums are explicit. Percentile assertions use nearest-rank values computable by hand for small n.

## Acceptance-criteria mapping

- AC#1 (`Play.summary` required, set on six, `tsc` proves) → Steps 1–2, `check:typecheck`.
- AC#2 (pure `shelfRows` with recalibrated envelope + cold-start-to-budget + `measured (N)` vs
  `default`) → Step 3.
- AC#3 (unit-tested: history→measured+N; no records→default; worth verbatim; `bun run check:*`
  green) → Step 4.

## Risks & mitigations

- **R: tier source is a judgment (rarity→tier).** Mitigation: grounded in play.ts's own documented
  mapping (design.md §B); order-preserving bijection; table-tested. If product later wants an
  explicit per-play tier, it slots in behind `tierForRarity` without changing `shelfRows`' shape.
- **R: `recalibrate` confidence semantics drift.** Mitigation: `shelfRows` reads only `source` +
  `confidence.successes` (the stable public surface); it never re-derives math, so it tracks E-013.
- **R: required-field churn in other `Play` constructors.** Mitigation: `tsc` enumerates every site;
  Step 2 fixes exactly the six literals + the one test stub — the complete set (grep-confirmed).
