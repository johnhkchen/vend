# Structure — T-001-03 budget-control

The shape of the code, not the code. Files, exports, internal organization, and
ordering. Implements the decisions in `design.md`.

## Files

| Path | Action | Purpose |
|------|--------|---------|
| `src/budget/budget.ts` | **create** | The entire budget module: types + three pure functions. |
| `src/budget/budget.test.ts` | **create** | Colocated unit tests (`bun:test`), the gate. |
| `src/budget/.gitkeep` | **delete** | Placeholder; superseded once real files land. |

No other files change. Notably **no edit** to `package.json`/`tsconfig.json` (the
gate surface already exists and is green) and **no touch** to `src/executor/` (AC:
no seam import, no shared files — keeps the parallel T-001-02 thread conflict-free).

## `src/budget/budget.ts` — public surface

Exported, in declaration order:

1. **`interface Budget`** — `{ readonly timeMs: number; readonly tokens: number }`.
   The allocation: wall-clock allowance + token ceiling. Both required, no
   defaults (the runner always allocates both at the counter).

2. **`interface Usage`** — four `readonly` *optional* numeric fields:
   `input_tokens?`, `output_tokens?`, `cache_read_input_tokens?`,
   `cache_creation_input_tokens?`. The structural shape of the seam's
   `result.usage`; declared locally (no import) so the seam satisfies it by
   duck-typing. Optional because any field may be absent on a given message.

3. **`type BudgetOutcome`** — discriminated union on `status`:
   - `{ status: "ok"; spent; ceiling; remaining }`
   - `{ status: "exhausted"; code: "EBUDGET_EXHAUSTED"; spent; ceiling; overage }`
   All fields `readonly number` except the two literal discriminants.

4. **`const BUDGET_EXHAUSTED = "EBUDGET_EXHAUSTED"`** — exported stable code
   constant (single source of truth for the string; the union references its
   literal type). Mirrors the seam's `ETIMEDOUT_CLAUDE` naming so the runner can
   switch on both andons uniformly.

5. **`function timeoutMsFor(budget: Budget): number`** — validates
   `budget.timeMs` is a positive finite integer (else `RangeError`), returns it.
   The named seam for time-policy derivation (Design D2).

6. **`function countTokens(usage: Usage): number`** — sum of the four sub-counts,
   each coerced `undefined → 0`. The single definition of "spent" (Design D3).

7. **`function check(budget: Budget, usage: Usage): BudgetOutcome`** — validates
   `budget.tokens` is a positive finite integer; computes `spent =
   countTokens(usage)`; returns `ok` (with `remaining = max(0, ceiling - spent)`)
   when `spent <= ceiling`, else `exhausted` (with `overage = spent - ceiling`).

## Internal organization (one file, no sub-modules)

A private `num(v: number | undefined): number` helper — `Number.isFinite(v) ? v :
0` — is the coercion `countTokens` applies to each field (the local analogue of
`mc-design-eval`'s `num()`). A private `assertPositiveInt(n, label)` backs the two
validations so the `RangeError` messages are consistent. Both are file-local, not
exported — the public surface stays exactly the seven items above.

File layout top-to-bottom: doc comment → types (`Budget`, `Usage`, `BudgetOutcome`)
→ `BUDGET_EXHAUSTED` const → private helpers → `timeoutMsFor` → `countTokens` →
`check`. Types and the code constant first so the public contract reads before the
mechanics.

## Module boundaries & invariants

- **Imports:** none at runtime. Possibly `import type` nothing external either —
  the module is self-contained. `verbatimModuleSyntax` is satisfied trivially.
- **No seam coupling:** `Usage` is structural and local; `budget.ts` never names
  `claude.ts`. Enforced by inspection (and a Review check via `grep`).
- **Purity:** no `Date`, `process`, `fetch`, `Bun`, or `fs` references. The only
  globals touched are `Number.isFinite` and `Math.max`. This is what makes "no
  network, no fs" structurally true, not just asserted.
- **`noUncheckedIndexedAccess`:** no indexing — fields are accessed by name, all
  optional, all funneled through `num()`. No `[]` access exists to be unchecked.

## `src/budget/budget.test.ts` — test shape

`bun:test` (`import { expect, test } from "bun:test"`), colocated, matching
`src/smoke.test.ts`'s convention. Grouped by function; each test builds a literal
`Budget` / `Usage` — no spawning, no fs, no clock (mirrors mc-design-eval's
"fabricated inputs only" rule). Coverage blueprint:

- **`countTokens`**: all four fields present → exact sum; some fields missing →
  missing treated as 0; empty `{}` → 0; only cache fields present → counted (the
  decision that distinguishes Design D3 from the rejected input+output rule).
- **`timeoutMsFor`**: returns `timeMs` verbatim for a valid budget; throws
  `RangeError` for `0`, negative, `NaN`, and non-integer `timeMs`.
- **`check` — ok branch**: `spent < ceiling` → `status: "ok"` with correct
  `remaining`; `spent === ceiling` (boundary) → `ok` with `remaining: 0`.
- **`check` — exhausted branch**: `spent > ceiling` → `status: "exhausted"`,
  `code === "EBUDGET_EXHAUSTED"` (asserted against the exported constant),
  `overage === spent - ceiling`.
- **`check` — andon is data**: assert the exhausted object carries `spent`,
  `ceiling`, `overage` (proves it is a surfacable outcome, not a console line).
- **`check` — invalid ceiling**: `tokens <= 0` or non-finite → `RangeError`.

## Ordering of changes

1. Write `src/budget/budget.ts` (types first, then functions) so the contract
   compiles in isolation.
2. Write `src/budget/budget.test.ts` against that surface.
3. `rm src/budget/.gitkeep` (dir is no longer empty).
4. Run `bun run check` (typecheck + test) — the gate.

Steps 1–2 are one logical unit (surface + its proof) and commit together; the
`.gitkeep` removal rides the same commit. No inter-step dependency on any sibling
ticket — budget builds and verifies entirely on its own.
