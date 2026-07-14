# T-030-01 — Design: worth-and-warranted-budget-core

Decisions, grounded in research.md. Three real questions: (A) how worth is declared, (B) how the
tier for recalibration is supplied without adding a `ValueTier` to `Play`, (C) the `ShelfRow` shape
and how `shelfRows` composes recalibrate.

## A. Worth on the contract — `Play.summary`

**Decision: add `readonly summary: string`, required, to `Play<I, O>`; set role-level on all six.**

- **Required, not optional.** The ticket calls this out and the rationale holds: the six plays are
  all in-repo, so a missing `summary` is a `tsc` error at the declaration site — the correct failure
  (an unworthed play shouldn't ship). Optional would let a play silently render a blank worth on the
  shelf, the exact "guess dressed as fact" failure mode in a different costume.
- **Role-level, one line.** `summary` answers "what is this playbook *for*" (survey → "read the
  project → a ranked demand board"), not "what leverage tier" and not a usage sentence. It is the
  worth half of the row; the budget half is the warranted envelope.
- **Placement.** Next to `name` (both are identity/worth metadata the shelf reads), above the
  behavioural members (`render`/`parse`/...). Keeps the contract's "what it is" fields together.

*Rejected — a separate `Worth`/`PlayMeta` interface.* Over-structured for one string; every call
site already destructures `Play`. A flat field matches `name`/`budget` (also flat scalars on the
contract). If worth grows (tags, a longer blurb) that refactor is cheap and not now's problem.

*Rejected — deriving worth from the doc-comment or `card`.* Doc-comments aren't typed data; `card`
encodes discipline/leverage, not role. Worth is authored prose — it must be a declared field.

## B. The tier for recalibration — derive from `card.rarity`

`recalibrate(play.name, records, tier, play.budget)` needs a `ValueTier`. The play carries none,
and the ticket forbids adding one. Options:

1. **Map `card.rarity → ValueTier`** (mythic→keystone, rare→high, uncommon→standard, common→leaf).
2. Pass a single fixed tier (e.g. `standard`) for every play.
3. Add a `tier` parameter to `shelfRows(plays, records, tier)`.

**Decision: option 1 — a pure `tierForRarity(rarity): ValueTier` map at the shelf boundary.**

Grounded in research: `play.ts:36–41` *already documents* this exact mapping ("common → mythic ≈
demand.md's leaf → keystone … the `Rarity → ValueTier` mapping is wired at the shelf boundary"). The
engine stays MTG-native; the shelf — which already owns `ValueTier` (`menu.ts`) — owns the
translation. The four rarities and four tiers are a clean order-preserving bijection:

| rarity | ValueTier | percentile (recalibrate) |
|--------|-----------|--------------------------|
| mythic | keystone | p95 |
| rare | high | p92 |
| uncommon | standard | p90 |
| common | leaf | p75 |

This is correct *meaning*, not a convenience: a mythic play (decompose-epic — keystone planning)
tolerates the fewest andon stops, so it bounds at the fattest tail (p95); a common play
(capture-note — a cheap one-shot) bounds tight (p75). Rarity *is* the play's intrinsic leverage; it
is the honest tier source.

*Rejected — option 2 (fixed tier).* Picks one percentile for all plays, throwing away the leverage
signal already encoded in `rarity`. A keystone decompose and a leaf note would bound at the same
tail — wrong, and it would make `rarity` dead metadata.

*Rejected — option 3 (tier parameter).* Contradicts the ticket's `shelfRows(plays, records)`
signature, and pushes the decision onto the caller (T-030-02's render shell) which has no better
source than `rarity` anyway. Derivation belongs in the pure core, tested once.

`tierForRarity` is a total `Record<Rarity, ValueTier>` lookup — pure, no default branch needed
(every `Rarity` member is a key; `tsc` proves exhaustiveness).

## C. The row model — `ShelfRow` + `shelfRows`

**Decision: a typed `ShelfRow` carrying structured fields (not pre-rendered strings); `shelfRows`
maps each play through `recalibrate` and reads its result.**

```ts
interface ShelfRow {
  readonly name: string;        // play.name — the join key + the row's stable id
  readonly summary: string;     // play.summary — worth, verbatim
  readonly envelope: Budget;    // recalibrate(...).envelope — warranted or cold-start prior
  readonly confidence: ShelfConfidence;
}

type ShelfConfidence =
  | { readonly kind: "measured"; readonly runs: number }  // source==="measured": N successes
  | { readonly kind: "default" };                          // source==="prior": cold-start
```

- **Structured, not formatted.** The row carries `Budget` + a discriminated `confidence`, not a
  `"measured · 5 casts · p95"` string. Rendering (`formatBudget`, `formatEnvelopeLabel`, the
  shelf surface) is T-030-02's job (DL-6…DL-9). Keeping the core structured means the render layer
  and the data layer can't drift, and `shelfRows` stays trivially unit-testable on values.
- **`confidence` is a discriminated union, not a bare `{ measured: boolean; runs: number }`.** This
  makes the E-026 lesson *unrepresentable to violate*: a `default` row has **no** `runs` field, so a
  renderer literally cannot print "measured (0 runs)". `measured` always carries a real `runs ≥ 1`.
  The honest-confidence contract is in the type, not a convention.
- **Why `runs = confidence.successes`.** That is the sample the percentile was computed over — the
  honest "measured (N)". We deliberately surface successes, not total records; the censored count is
  available on `recalibrate`'s result but is a render-time detail (the andon tail), out of scope for
  this core's minimal row (T-030-02 may pull it from a richer call later; the ticket's row is
  name·summary·envelope·confidence).

**`shelfRows` composition (pure):**

```
shelfRows(plays, records):
  for each play in plays:
    tier   = tierForRarity(play.card.rarity)
    result = recalibrate(play.name, records, tier, play.budget)   // E-013, prior = authored budget
    confidence = result.source === "measured"
        ? { kind: "measured", runs: result.confidence.successes }
        : { kind: "default" }
    → { name: play.name, summary: play.summary, envelope: result.envelope, confidence }
  return rows   // one per play, input order preserved
```

- **`prior = play.budget`** — the authored envelope is the cold-start fallback (the ticket's
  instruction, and what `recalibrate` returns verbatim when `source==="prior"`). So a no-data row's
  `envelope` **is** the play's authored `budget`, labelled `default` — never a guess dressed as
  measured. This correctness is inherited from `recalibrate`, not re-implemented.
- **Input order preserved** — `shelfRows` does not rank (that, like rendering, is T-030-02 / a
  later ranking decision). One row per play, in the order passed.
- **No recalibrate-opts plumbing** — defaults (`COLD_START_MIN_SUCCESSES`, `DEFAULT_WINDOW`) are
  correct here; the ticket scopes no override surface. Leaving them default keeps the signature
  `shelfRows(plays, records)` exactly as specified.

*Rejected — `shelfRows` reading the registry singleton directly.* Breaks purity (singleton =
ambient state) and testability. `plays` is passed in; the impure shell (T-030-02) supplies
`registry`-derived plays + `loadRunLog` records.

*Rejected — calling `calibrate` (bias correction) too.* Out of scope: the ticket pairs `summary`
with the *recalibrated envelope* (E-013's `recalibrate`), not the bias-corrected estimate
(`calibrate`). Bias correction is a per-cast estimate-time concern, not a shelf-display concern.

## Module placement

New file `src/shelf/shelf-row.ts` (pure: `ShelfRow`, `ShelfConfidence`, `tierForRarity`,
`shelfRows`) + `src/shelf/shelf-row.test.ts`. Lives beside `menu.ts` (the demand surface); this is
the supply surface's pure core. Imports are type-only where possible (`Budget`, `ValueTier`,
`Rarity`, `AnyPlay`, `RunRecord`) plus the one value import `recalibrate`. Keeps the addon-free,
pure-testable discipline of the rest of `src/shelf/`.
