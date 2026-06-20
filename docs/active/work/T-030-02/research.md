# T-030-02 — Research: vend-shelf-surface

Descriptive map of the code this ticket touches. The job is two parts: a **pure**
`renderShelf(rows)` (clean-typographic supply view, DL-6/DL-9/DL-3) and an **impure**
`vend shelf` verb that gathers the registered plays + the run log, computes rows
(`shelfRows`, T-030-01), renders, prints. T-030-01 already shipped the pure data half.

## What already exists (the inputs)

### The pure data core — `src/shelf/shelf-row.ts` (T-030-01, shipped)
- `ShelfRow { name, summary, envelope: Budget, confidence }` — the row to render. Carries
  **structured** fields, never pre-formatted strings (the comment is explicit: "rendering …
  is the render shell's job, so the data layer and the display layer can't drift").
- `ShelfConfidence` — a discriminated union: `{ kind: "measured", runs }` | `{ kind: "default" }`.
  The E-026 lesson is made unrepresentable-to-violate: a `default` row carries **no** `runs`
  field, so a renderer literally cannot print "measured (0 runs)".
- `shelfRows(plays, records)` — pure/total: one row per play, recalibrated envelope (E-013)
  at the tier from `card.rarity`, authored `budget` as the cold-start prior. Input order
  preserved; inputs never mutated; no I/O (records passed in).
- `tierForRarity` / `RARITY_TIER` — the `Rarity → ValueTier` mapping (mythic→keystone …
  common→leaf). Not needed by the render, but lives here.
- Header note (line 19): "*Nothing imports this back yet — T-030-02 (renderShelf + `vend
  shelf`) is the first consumer.*" — renderShelf is the expected addition.

### The board render to mirror — `src/shelf/menu.ts`
- `formatBudget(budget): string` — `"<time>/<tokens>"`, e.g. `2h/50k`, `30m/8k`, `45s/500`.
  Pure/total. **This is the envelope formatter the ticket says to reuse** so the shelf and
  the board read identically. Private helpers `humanTime`/`humanTokens` back it.
- `renderMenu(actions, opts)` — the precedent for a pure list renderer: numbers visible rows
  `1..N`, an empty list renders a single guidance line instead of erroring, a `(+K hidden)`
  footer when rows are hidden. menu.ts holds **both** the model (`Action`) and its renderer —
  the precedent for putting `renderShelf` beside `ShelfRow`.
- DL-9 clause 2 names `renderMenu` as "already a numbered list, not a card grid" — the shelf
  render must hold that same no-card-chrome line.

### The run log — `src/log/run-log.ts`
- `loadRunLog(opts?): Promise<ReadResult>` — the single impure read verb. A **missing** ledger
  is not an error (ENOENT → `{ records: [], skipped: 0 }`), so a cold project is safe.
- `readRuns(jsonl): ReadResult` — pure parse (the ticket cites `readRuns`; `loadRunLog` is the
  fs verb that composes it). `ReadResult { records, skipped }`.
- `RunRecord` — the actuals `shelfRows` filters per play via `recalibrate`'s own `forPlay`.

### The CLI surface — `src/cli.ts`
- `parseArgs(argv): ParsedCommand` — pure dispatcher; `argv[0] === "<verb>"` → per-verb parser.
  `ParsedCommand` is a discriminated union of `cmd` literals.
- `vend audit` is the **read-only verb to mirror** (ticket): `parseAuditArgs` (a flags-only
  parser, no `--budget`), an `{ cmd: "audit", … }` union arm, and a dispatch arm that lazily
  imports `loadRunLog` + the formatter, prints, and **exits 0** (read-only never actuates).
- `USAGE` — the banner printed on any parse error; the ticket says to add the `shelf` line.
  **Not referenced by any test** (`grep` of cli.test.ts is empty), so extending it is free.
- The impure dispatch (`if (import.meta.main)`) lazily imports per-arm so the BAML addon stays
  off the pure-parse path — the discipline a `shelf` arm must keep.

### The gather precedent — `src/shelf/gather.ts`
- `browseShelf(opts): Promise<BrowseResult>` — the impure orchestrator bare `vend` calls:
  gather → rank → render → persist → return. The shape a `vend shelf` orchestrator mirrors
  (minus persistence — the shelf is a pure read, no `.vend/*` cache, no freshness marker).
- `budgetForTier` lives here (the tier→budget prior); not directly needed (shelfRows uses each
  play's authored `play.budget` as the prior, not the tier default).

### The plays + registry — `src/engine/play.ts` and `src/play/*.ts`
- `Play<I,O>` carries `readonly summary: string` (T-030-01) + `card.rarity` + `budget`.
- `registry` (singleton) is populated by **side-effect** when each `src/play/*.ts` module is
  value-imported (`registry.register(xPlay)` at module load). `registry` exposes `names()`,
  `get()`, `has()` — but **no `values()`/`all()`** to enumerate every registered play.
- The six registered play literals, each exported from its module:
  | literal | name | rarity → tier | live records |
  |---|---|---|---|
  | `decomposeEpicPlay` | `decompose-epic` | mythic → keystone | 12 |
  | `surveyPlay` | `survey` | rare → high | 1 |
  | `steerProjectPlay` | `steer` | rare → high | 1 |
  | `proposeEpicPlay` | `propose-epic` | rare → high | 7 |
  | `expandFragmentPlay` | `expand-fragment` | rare → high | 3 |
  | `captureNotePlay` | `capture-note` | common → leaf | 1 |
- `recalibrate` cold-start threshold `COLD_START_MIN_SUCCESSES = 3`: a play needs ≥3
  **successes** to read `measured`; fewer → `default` (the authored prior). So on the live
  ledger, `decompose-epic`/`propose-epic` (and likely `expand-fragment`) read measured; the
  single-run plays read default — exactly the ticket's predicted live proof.

## Patterns / constraints (house rules)
- **Pure/impure split.** Render + data are pure (fixture-tested, addon-free); the gather verb
  is the thin untested shell (it value-imports the BAML-addon play modules). Mirrors
  gather.ts / dispatch.ts / the `audit` arm.
- **No drift seam.** `ShelfRow` is structured; `formatBudget` is the one envelope formatter —
  reuse it, never re-derive, so shelf and board agree.
- **No card chrome (DL-9), hierarchy from levers (DL-3), demand-leads-supply (DL-6).** The
  render is a flat numbered list, worth leading, envelope+confidence receding, no boxes, no
  color (no andon applies here).
- **Read-only verb.** Like `audit`: no `--budget`, no flags needed, always exits 0; a missing
  ledger is a clean empty, not a crash.

## Open questions (resolved in Design)
1. Where does `renderShelf` live — in `shelf-row.ts` (beside the model, the menu.ts precedent)
   or a new render module?
2. How are the six plays enumerated — explicit literal list, or a new `registry.values()` over
   side-effect imports?
3. Exact row format / column alignment / the `~`-prefix-on-default convention.
