# T-030-02 — Plan: vend-shelf-surface

Ordered, independently-verifiable steps in two atomic commits. Each step names its files, its
verification, and the AC it advances.

## Commit 1 — the pure render (`renderShelf`) + unit tests

### Step 1.1 — add `renderShelf` + `confidenceLabel` to `src/shelf/shelf-row.ts`
- Widen the `menu.ts` import to a value import of `formatBudget` (keep `type ValueTier`).
- Add private `confidenceLabel(c: ShelfConfidence): string` — exhaustive `switch` on `c.kind`
  (`measured` → `(measured · N run/runs)` with singular/plural; `default` →
  `(default — no runs yet)`).
- Add exported `renderShelf(rows): string`:
  - empty → `"(no playbooks)"`.
  - header `shelf — N playbook(s)` + blank line + numbered, width-aligned rows; `~`-prefix the
    envelope **iff** the row's confidence is `default`; trail with the confidence label.
- Doc-comment in the module voice (DL-6/9/3, `formatBudget` reuse).
- **Verify:** `bun run check:typecheck` clean.

### Step 1.2 — unit-test `renderShelf` in `src/shelf/shelf-row.test.ts`
Add `renderShelf` to the import; new `describe("renderShelf — the supply view (DL-6/9/3)")`:
1. **measured row** → contains `(measured · 5 runs)`, the `formatBudget` envelope, **no** `~`
   before that envelope; singular `1 run` for a one-run measured row.
2. **default row** → contains `~` + the authored envelope + `(default — no runs yet)`; asserts
   the string does **not** contain `measured` (the E-026 honest-confidence pin).
3. **no card chrome (DL-9)** → output has no `|`, `┌`, `└`, `─`, `[`/`]` box characters.
4. **alignment** → with two rows of unequal name length, the summary column starts at the same
   index on both lines (padEnd width check).
5. **empty** → `renderShelf([])` === `"(no playbooks)"`.
6. (optional) **integration** → `renderShelf(shelfRows([stub], []))` round-trips a real default
   row, proving the data→render seam.
- **Verify:** `bun run check:test` green (existing + new); `bun run check:typecheck` clean.

### Commit 1 gate & message
- `bun run check:typecheck && bun run check:test` green.
- `feat(shelf): pure renderShelf — clean-typographic supply view (T-030-02)`

## Commit 2 — the `vend shelf` surface

### Step 2.1 — create `src/shelf/shelf.ts` (impure gather shell)
- Import the six play literals, `loadRunLog`, `shelfRows` + `renderShelf`, `type AnyPlay`.
- `SHELF_PLAYS` in leverage-descending order (decompose-epic, survey, steer, propose-epic,
  expand-fragment, capture-note).
- `export async function shelfText(opts?: { path?: string }): Promise<string>` → load log,
  `renderShelf(shelfRows(SHELF_PLAYS, records))`.
- Module doc: the impure SUPPLY-read shell; untested by house rule; no persistence/clock.
- **Verify:** `bun run check:typecheck` clean.

### Step 2.2 — wire the verb into `src/cli.ts`
- Add `| { readonly cmd: "shelf" }` to `ParsedCommand`.
- Add `parseShelfArgs` (flags-free; stray token → `usage`), and the `argv[0] === "shelf"`
  branch in `parseArgs`.
- Add the dispatch arm (lazy-import `shelfText`, print, exit 0).
- Add `vend shelf` to `USAGE`.
- **Verify:** `bun run check:typecheck` clean.

### Step 2.3 — parser tests in `src/cli.test.ts`
`describe("parseArgs — shelf (T-030-02 supply view)")`: bare `shelf` → `{ cmd: "shelf" }`;
`shelf foo` and `shelf --budget 1,2` → `cmd: "usage"`.
- **Verify:** `bun run check:test` green.

### Step 2.4 — live proof (AC #3)
- `bun run src/cli.ts shelf` — confirm it lists the six playbooks; `decompose-epic` /
  `propose-epic` (and `expand-fragment` if ≥3 successes) read `(measured · N runs)`, the
  single-run plays read `~… (default — no runs yet)`. Capture the output for `review.md`.
- `bun run check` (the full gate: baml:gen + typecheck + test) green.

### Commit 2 gate & message
- `bun run check` green + the live proof captured.
- `feat(shelf): vend shelf supply-view verb (T-030-02)`

## Testing strategy summary
- **Unit (pure):** `renderShelf` (format, honesty, alignment, empty) in shelf-row.test.ts;
  `parseShelfArgs` in cli.test.ts. These are the regression surface.
- **Not unit-tested (house rule):** `shelf.ts` gather shell + the cli dispatch arm (they
  value-import the BAML addon / touch fs) — covered by the live proof, exactly as `browseShelf`
  / `dispatch.ts` / the `audit` arm are.
- **Gate:** `bun run check` green before each commit; the board path proven untouched (no edits
  to menu.ts render / gather.ts / browse arm).

## Risks / mitigations
- *Alignment math off-by-one* → covered by the alignment test (Step 1.2 #4).
- *A default row accidentally printing "measured"* → the E-026 pin (Step 1.2 #2) + the
  exhaustive `switch` make it unrepresentable.
- *Live ledger thinner than expected (a play has <3 successes)* → still correct: it reads
  `default`, which is the honest label; the proof asserts the labels match the ledger, not a
  fixed count.
