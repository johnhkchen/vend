# T-034-01 — Structure: history-audit-core

*Phase: Structure. The file-level blueprint — what is created/modified, the public surface, internal
organization, and ordering. Not code; the shape of the code.*

## Files

| File | Action | Why |
|------|--------|-----|
| `src/ci/history-core.ts` | **create** | The pure core: types + `classifyHistory` + `boundRange` + `DEFAULT_HISTORY_MAX`. |
| `src/ci/history-core.test.ts` | **create** | Pure-function tests (the `head-build-core.test.ts` precedent), covering all four AC cases + edges. |

**No other files change.** Not modified:
- `package.json` — `check:history` is T-034-02's deliverable (needs the impure runner). This module is
  exercised by the existing `check:typecheck` + `check:test` (both run by `bun run check`).
- `check-head.ts` / `head-build-core.ts` — `buildCommittedHead` generalization is T-034-02. No edits here.
- `tsconfig` / test glob — `src/**` is already covered; the new files are picked up automatically.

## `src/ci/history-core.ts` — public surface

Ordered top-to-bottom as the file will read:

```
// header comment — PURE/TOTAL contract, place in the E-008→E-010→E-033→E-034 family,
//                  "returned data never thrown" house rule, mirror-of-head-build-core note.

// ── classifyHistory ──────────────────────────────────────────────
export interface CommitResult {            // D1: flat row, NOT BuildOutcome
  sha: string;
  subject: string;
  green: boolean;
  summary?: string;
}

export interface HistoryVerdict {          // D2: anyRed derived from redCount
  anyRed: boolean;
  redCount: number;
  report: string;
}

function summarySuffix(summary: string | undefined): string   // D4: graceful, never "undefined"

export function classifyHistory(results: readonly CommitResult[]): HistoryVerdict   // D3 three-branch

// ── boundRange ───────────────────────────────────────────────────
export const DEFAULT_HISTORY_MAX = 100;    // D6: R12 single-source default

export interface BoundOpts {               // D6
  max?: number;
  widenHint?: string;
}

export interface RangeBound {              // D6
  covered: string[];
  droppedCount: number;
  note: string;
}

export function boundRange(allShas: readonly string[], opts?: BoundOpts): RangeBound  // D6
```

### Internal organization

- **`summarySuffix(summary)`** — private. Returns `""` when summary is absent/blank, else
  `": " + summary.trim().replace(/\s+/g, " ")`. Single-spaced, one line. Mirrors `precommit-core.tail`.
- **`classifyHistory`** — the three-branch ladder (D3):
  1. compute `reds = results.filter(r => !r.green)`, `redCount = reds.length`, `total = results.length`.
  2. `total === 0` → honest-empty report, `{ anyRed:false, redCount:0, report }`.
  3. `redCount === 0` → all-green tally report, `{ anyRed:false, redCount:0, report }`.
  4. else → header (`ANDON — R of T … are red:`) + one indented line per red
     (`  ${sha} ${subject}${summarySuffix(summary)}`, in **input order** per D5) + a tally footer;
     `{ anyRed:true, redCount, report }`.
  - `anyRed` is always written as `redCount > 0` (single expression), never tracked separately.
- **`boundRange`** — (D6):
  1. `max = opts?.max === undefined ? DEFAULT_HISTORY_MAX : Math.max(0, Math.floor(opts.max))`.
  2. `covered = allShas.slice(0, max)`; `droppedCount = allShas.length - covered.length`.
  3. `note`: dropped → loud `covered N of M (bounded at K — widen with <hint>)`;
     not-dropped → quiet `covered all M commit(s) (within bound K)`.
  4. return `{ covered: [...covered], droppedCount, note }` (fresh array — never alias the input).

## Public interface contracts (what callers may rely on)

- **Total / pure:** no throw on any input, including `[]`, `max:0`, negative `max`, missing `summary`.
- **`classifyHistory([])`** → honest-empty, `anyRed:false`. Never "all green".
- **`anyRed === redCount > 0`** invariant holds for every input.
- **Red report** names every red commit (sha + subject + summary-when-present) in input order; greens
  are not individually listed.
- **`boundRange`** never mutates `allShas`; `covered` is a fresh prefix slice; `droppedCount >= 0`;
  `note` is always non-empty and truthful about coverage (loud iff `droppedCount > 0`).
- **`DEFAULT_HISTORY_MAX`** is the one source of the default bound (T-034-02 imports it).

## `src/ci/history-core.test.ts` — test structure

```
import { describe, expect, test } from "bun:test";
import { boundRange, classifyHistory, DEFAULT_HISTORY_MAX, type CommitResult } from "./history-core.ts";

describe("classifyHistory", () => {
  test("all green → anyRed false, redCount 0, tally names the count, no commit listed")
  test("some red → anyRed true, redCount correct, report names each red sha+subject+summary")
  test("red row without summary → still named, no 'undefined' leak")
  test("empty range → honest-empty line, anyRed false (not 'all green')")
  test("preserves input order in the red list (D5)")
});

describe("boundRange", () => {
  test("under the bound → droppedCount 0, covered === allShas, quiet note, no 'widen'")
  test("over the bound → loud 'covered N of M (bounded at K)' note, covered is the prefix")
  test("widenHint is interpolated into the note when supplied")
  test("default bound is DEFAULT_HISTORY_MAX when max omitted")
  test("max 0 covers nothing; negative max clamps to 0 (no throw)")
  test("does not mutate the input array")
});
```

Assertions: exact `anyRed` / `redCount` / `droppedCount` / `covered`; `toContain` substrings for
report/note text (sha, subject, summary, "no commits", "ANDON", "covered N of M", the hint). No git,
no fs, no process — sub-millisecond, like the pure half of `head-build-core.test.ts`.

## Ordering of changes

1. Create `history-core.ts` (types → `summarySuffix` → `classifyHistory` → bound consts/types →
   `boundRange`). One self-contained commit-able unit.
2. Create `history-core.test.ts` exercising it.
3. `bun run check` (baml:gen → typecheck → test) green.
4. Commit the two files + the RDSPI artifacts atomically (through the live E-033 pre-commit gate).

No intermediate ordering hazard: the module has no imports beyond TS built-ins, and nothing else
depends on it within this ticket (T-034-02 is a separate, later ticket).
