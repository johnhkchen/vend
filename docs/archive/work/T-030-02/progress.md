# T-030-02 — Progress: vend-shelf-surface

Implemented to plan in two atomic commits. No deviations.

## Commit 1 — pure render — `4d2b6ce`
`feat(shelf): pure renderShelf — clean-typographic supply view (T-030-02)`
- **`src/shelf/shelf-row.ts`** — widened the `menu.ts` import to a value import of
  `formatBudget`; added private `confidenceLabel` (exhaustive `switch` over `ShelfConfidence`,
  singular/plural `run(s)`) and exported `renderShelf(rows)`: empty → `(no playbooks)`; else a
  `shelf — N playbooks` header + blank line + numbered, self-sizing, width-aligned rows; the
  envelope is `formatBudget(...)` prefixed with `~` iff the row is `default`, trailed by the
  confidence label. Pure/total; input order preserved.
- **`src/shelf/shelf-row.test.ts`** — `describe("renderShelf …")` with 7 tests: measured
  (plain env + `(measured · 5 runs)`, no `~`), singular `1 run`, default (`~env` +
  `(default — no runs yet)`, asserts the string never says `measured` — the E-026 pin), no box
  chars (DL-9), column alignment across unequal names (DL-3), empty → guidance line, and a
  data→render seam test via `shelfRows`.
- Gate: `check:typecheck` clean, `shelf-row.test.ts` 16 pass.

## Commit 2 — the `vend shelf` surface — `da07ee3`
`feat(shelf): vend shelf supply-view verb (T-030-02)`
- **`src/shelf/shelf.ts`** (new) — the impure gather shell: `SHELF_PLAYS` (the six registered
  literals, leverage-descending) + `shelfText(opts?)` = `loadRunLog` → `shelfRows` →
  `renderShelf`. No persistence/clock (a pure read). Untested by house rule (value-imports the
  BAML-addon play modules), like `gather.ts`/`dispatch.ts`.
- **`src/cli.ts`** — added `{ cmd: "shelf" }` to `ParsedCommand`; the `argv[0] === "shelf"`
  branch; `parseShelfArgs` (flags-free, any arg → usage); the read-only dispatch arm
  (lazy-import `shelfText`, print, exit 0); a `vend shelf` line in `USAGE`.
- **`src/cli.test.ts`** — `describe("parseArgs — shelf …")`: bare `shelf` → `{ cmd: "shelf" }`;
  a positional / `--budget` / `--all` → usage.
- Gate: `bun run check` green — **871 pass, 0 fail**; `check:typecheck` clean.

## Live proof (AC #3) — `bun run src/cli.ts shelf`, exit 0
```
shelf — 6 playbooks

  1. decompose-epic    clear an epic into ready stories and tickets        161s/227k (measured · 6 runs)
  2. survey            read the project into a ranked demand board         ~30m/300k (default — no runs yet)
  3. steer             read the project and propose a course-correction    ~40m/400k (default — no runs yet)
  4. propose-epic      turn a signal into a proposed epic card             73s/227k (measured · 5 runs)
  5. expand-fragment   grow a rough fragment into one board-ready signal   ~20m/250k (default — no runs yet)
  6. capture-note      capture a topic into a filed markdown note          ~10m/8k (default — no runs yet)
```
All six listed; `decompose-epic`/`propose-epic` read `measured (N)`; the others (including
`expand-fragment`, which has runs but <3 successes) read `default` honestly — matching the
ticket's prediction.

## Deviations
None. The two design open-questions resolved as planned: `renderShelf` lives in `shelf-row.ts`
(the menu.ts precedent); the six plays are an explicit literal list (no `registry.values()`
added).
