# T-030-02 — Review: vend-shelf-surface

Handoff for a human reviewer. Renders T-030-01's `ShelfRow[]` as the supply shelf behind a new
read-only `vend shelf` verb — the clean-typographic supply view beside the board (IA-2).
Shipped in two atomic commits; the full gate is green.

## What changed

| File | Change |
|---|---|
| `src/shelf/shelf-row.ts` | **MODIFY** — value-import `formatBudget`; add private `confidenceLabel` + exported pure `renderShelf(rows)`. |
| `src/shelf/shelf-row.test.ts` | **MODIFY** — `+7` tests for `renderShelf` (format, E-026 honesty, DL-9 no-chrome, DL-3 alignment, empty, seam). |
| `src/shelf/shelf.ts` | **CREATE** — impure gather shell: `SHELF_PLAYS` (six literals) + `shelfText()` = load log → `shelfRows` → `renderShelf`. |
| `src/cli.ts` | **MODIFY** — `shelf` command arm + `parseShelfArgs` + dispatch arm + `USAGE` line. |
| `src/cli.test.ts` | **MODIFY** — `+2` tests for `parseShelfArgs`. |

Commits: `4d2b6ce` (pure render), `da07ee3` (the verb). No deletions; the board path
(`menu.ts` render, `gather.ts`, the `browse`/`select` arms) is untouched.

## Acceptance criteria

- **AC #1 — pure `renderShelf`, DL-6/9/3, default vs measured honest, unit-tested.** ✅
  `renderShelf` is pure/total (no fs/clock); a flat numbered list, no boxes (DL-9), worth
  leading and envelope+confidence receding by position + `~` marker (DL-3); `default` →
  `~env (default — no runs yet)`, `measured` → `env (measured · N runs)`. Tested on measured +
  default fixtures, alignment, empty, and the data→render seam.
- **AC #2 — `vend shelf` verb gathers plays + run log and prints; board unaffected; usage
  updated; parser covered like `audit`.** ✅ `parseShelfArgs` + dispatch arm mirror the
  read-only `audit` pattern (no `--budget`, exits 0); `USAGE` gains `vend shelf`; the board and
  other verbs are unchanged; `parseShelfArgs` is unit-tested.
- **AC #3 — live proof, `bun run check:*` green.** ✅ `bun run src/cli.ts shelf` lists the six
  playbooks (output in `progress.md`): `decompose-epic`/`propose-epic` `measured (6)`/`(5)`;
  the rest `default`. `bun run check` → **871 pass, 0 fail**, typecheck clean.

## Test coverage

- **Pure, unit-tested (the regression surface):** `renderShelf` (7 cases incl. the E-026
  "never says measured" pin and the DL-9 no-box-chars assertion) and `parseShelfArgs` (3
  assertions across 2 tests). `shelfRows` itself was covered by T-030-01.
- **Not unit-tested, by house rule:** `src/shelf/shelf.ts` (the gather shell — value-imports
  the BAML-addon play modules) and the cli dispatch arm. Their logic is the tested pure pair
  (`shelfRows` + `renderShelf`) plus thin I/O, exactly as `browseShelf`/`dispatch.ts`/the
  `audit` arm are untested. Covered instead by the live proof.
- **Gap (acceptable):** no automated test asserts the `vend shelf` *end-to-end* stdout (it
  depends on the live ledger). The seam is covered: pure render is pinned; `shelfText` is a
  two-line composition of two tested functions. A future fixture-ledger smoke (pass
  `shelfText({ path })` a temp JSONL) could close it cheaply if desired.

## Open concerns / notes for the reviewer

1. **Play enumeration is an explicit list, not the registry.** `SHELF_PLAYS` hardcodes the six
   literals (Design Decision 2: the registry has no `values()`; an explicit list is the same
   import cost with deterministic order and no engine change). A **seventh play would not appear
   on the shelf until added here** — the single, typed maintenance point. If play registration
   ever becomes dynamic, revisit with a `registry.values()`.
2. **No color / no "dim" lever.** `renderShelf` returns a plain string, so DL-3's *dim* lever is
   unavailable; recession is carried by position + the parenthetical + `~`. Honest for the
   no-andon shelf (DL-5 is silent here); a TUI can add true dimming later against this contract.
3. **No tier column** (e.g. `[Keystone]`) — deliberate (Design Decision 3): the ticket row spec
   is `name · summary · envelope · confidence`; the tier is *expressed* in the recalibrated
   envelope, not re-printed. The DL-6 Home mock shows a tier tag, but that is the composed Home
   board, not this standalone supply verb.
4. **`expand-fragment` reads `default` despite having 3 records** — correct, not a bug:
   `recalibrate`'s `COLD_START_MIN_SUCCESSES = 3` counts *successes*, and it has <3, so the
   authored prior is shown, honestly labelled. The shelf reflects the ledger, not a raw count.

## No critical issues
Nothing needs human intervention before merge. The board is untouched, the gate is green, and
the honest-confidence (E-026) and no-card-chrome (DL-9) contracts are pinned by tests.
