# T-030-02 — Structure: vend-shelf-surface

The file-level blueprint. Two pure additions (render + its tests), one impure shell, and the
CLI wiring. No deletions; the board path is untouched.

## Files

### MODIFY — `src/shelf/shelf-row.ts` (the pure render)
Add a value import and one exported function (plus a private helper).
- **New import:** widen the existing `menu.ts` import to also pull `formatBudget` (a value):
  `import { formatBudget, type ValueTier } from "./menu.ts";`
- **New private helper** `confidenceLabel(c: ShelfConfidence): string` — a `switch` over
  `c.kind`: `measured` → `(measured · ${runs} run${runs === 1 ? "" : "s"})`; `default` →
  `(default — no runs yet)`. Exhaustive (no default branch), so the union stays honest.
- **New export** `renderShelf(rows: readonly ShelfRow[]): string`:
  - empty → `"(no playbooks)"` (the `renderMenu` empty precedent).
  - else: a header `shelf — ${rows.length} playbook${rows.length === 1 ? "" : "s"}`, a blank
    line, then one numbered line per row.
  - per row: `  ${i+1}. ${name.padEnd(nameW)}   ${summary.padEnd(summaryW)}   ${env}${conf}`
    where `nameW`/`summaryW` are the max widths over `rows`, `env` is `formatBudget(envelope)`
    prefixed with `~` **iff** `confidence.kind === "default"`, and `conf` is a leading space +
    `confidenceLabel(confidence)`.
  - returns the lines `join("\n")`. Pure/total; input never mutated.
- **Doc comment:** brief, in the module's voice — names DL-6 (the shelf beneath the board),
  DL-9 (no card chrome — a numbered list), DL-3 (worth leads, envelope+confidence recede), and
  that `formatBudget` is reused so shelf and board read identically.

### MODIFY — `src/shelf/shelf-row.test.ts` (render tests)
Add `renderShelf` to the import and a new `describe("renderShelf …")` block. Reuse the existing
`makeStubPlay` + `recordOf` helpers and `shelfRows` to build realistic rows, or build `ShelfRow`
literals directly for format pinning (simpler, no recalibrate dependency). Cases in Plan.

### CREATE — `src/shelf/shelf.ts` (the impure gather shell)
The untested shell, mirroring `gather.ts`'s `browseShelf` and the `audit` arm.
- Module doc: the SUPPLY-read verb behind `vend shelf`; impure (loads the ledger, value-imports
  the BAML-addon play modules → off every pure-test path); no persistence/clock (a pure read);
  the pure work is `shelfRows` + `renderShelf`, this only wires I/O.
- Imports: the six play literals (`decomposeEpicPlay`, `surveyPlay`, `steerProjectPlay`,
  `proposeEpicPlay`, `expandFragmentPlay`, `captureNotePlay`); `loadRunLog` (run-log);
  `shelfRows` + `renderShelf` (shelf-row); `type AnyPlay` (engine/play).
- `const SHELF_PLAYS: readonly AnyPlay[] = [ … ]` — leverage-descending (Decision 2 order).
- `export async function shelfText(opts?: { path?: string }): Promise<string>`:
  `const { records } = await loadRunLog(opts?.path ? { path: opts.path } : {});`
  `return renderShelf(shelfRows(SHELF_PLAYS, records));`
  (The optional `path` mirrors `loadRunLog`'s testability seam; the CLI calls it with none.)

### MODIFY — `src/cli.ts` (the verb wiring)
- **`USAGE`:** add a line `"       vend shelf"` (a read; no args). Placed near the other
  read-only verbs (`audit`/`envelope`).
- **`ParsedCommand`:** add the arm `| { readonly cmd: "shelf" }`.
- **`parseArgs`:** add `if (argv[0] === "shelf") return parseShelfArgs(argv);` before the
  `parseSelectOrBrowse` fallthrough.
- **`parseShelfArgs(argv): ParsedCommand`** (new, pure) — modeled on `parseSurveyArgs` but with
  **no** `--budget`: any token after `shelf` → `{ cmd: "usage", error: `unexpected shelf
  argument: ${a}` }`; otherwise `{ cmd: "shelf" }`. Doc-comment: the read-only supply view
  (T-030-02), flags-free, mirrors `audit` as a no-actuation read.
- **Dispatch arm** (in `if (import.meta.main)`): add, beside the `audit` arm,
  ```
  if (parsed.cmd === "shelf") {
    const { shelfText } = await import("./shelf/shelf.ts");
    process.stdout.write(`${await shelfText()}\n`);
    process.exit(0);
  }
  ```
  Lazy import keeps the BAML addon off the pure-parse path (the house discipline).

### MODIFY — `src/cli.test.ts` (parser test)
Add a `describe("parseArgs — shelf (T-030-02 supply view)")` block: bare `shelf` →
`{ cmd: "shelf" }`; `shelf --budget 1,2` and `shelf foo` → `cmd: "usage"`.

## Module boundaries / invariants held
- **Pure stays pure:** `shelf-row.ts` gains only a value import of the pure `formatBudget`; its
  test stays addon-free.
- **Impure isolated:** `shelf.ts` is the only new module that value-imports the play modules;
  nothing pure imports it. cli imports it **lazily**, only in the `shelf` dispatch arm.
- **No drift:** the envelope is formatted by the one `formatBudget`; the shelf and board agree.
- **Board untouched:** no change to `menu.ts`'s render, `gather.ts`, or the `browse`/`select`
  arms.

## Ordering of changes (atomic-commit boundaries)
1. **Pure render + tests** — `shelf-row.ts` (`renderShelf` + helper) and `shelf-row.test.ts`.
   Self-contained, green on its own (`check:typecheck` + `check:test`). Commit 1.
2. **The `vend shelf` surface** — `shelf.ts` + cli parser/arm/usage + `cli.test.ts`. Depends on
   Commit 1's `renderShelf`. Green + the live proof. Commit 2.
