# Plan — T-001-03 budget-control

Ordered implementation steps with verification at each gate. The work is small and
pure, so it lands as **one atomic commit** after a green `bun run check`; the steps
below are the internal sequence and their independent checks.

## Testing strategy

- **Everything is unit-tested.** The module is 100% pure (no child, no fs, no
  clock), so there is nothing that needs an integration test or a fake spawn —
  unlike the sibling seam (T-001-02), budget has no live surface at all. All
  inputs are hand-built literal `Budget` / `Usage` objects.
- **Gate:** `bun run check` (`tsc --noEmit` + `bun test`) must pass. This is the
  same surface CI (E-002) invokes, so green here = green in CI.
- **Verification criteria per AC** (traced in Review):
  1. `budget.ts` exports `Budget` + `timeoutMsFor` + `check` → typecheck + tests.
  2. Exhaustion is a typed named outcome carrying overage → exhausted-branch tests
     assert `code` and `overage`.
  3. Pure, fully unit-tested, no network/fs → grep shows no `fs`/`fetch`/`Date`/
     `process`/`Bun`; tests cover every function and branch.
  4. No seam import → grep shows no `executor`/`claude` reference in `budget.ts`.

## Steps

### Step 1 — Types and the code constant

Write the top of `src/budget/budget.ts`: module doc comment, then `interface
Budget`, `interface Usage`, `type BudgetOutcome`, and `const BUDGET_EXHAUSTED =
"EBUDGET_EXHAUSTED"`. `BudgetOutcome`'s exhausted variant references
`typeof BUDGET_EXHAUSTED` for its `code` literal so the string has one source.

**Verify:** `bun run check:typecheck` passes with the types declared (functions
can be stubbed with `throw new Error("todo")` bodies returning the right type, or
written immediately in Step 2 — prefer writing Step 2 right after to avoid a
non-compiling intermediate).

### Step 2 — Private helpers + the three functions

Add file-local `num(v)` (`Number.isFinite(v) ? v : 0`) and
`assertPositiveInt(n, label)` (throws `RangeError` unless `Number.isInteger(n) &&
n > 0`). Then:

- `timeoutMsFor(budget)` → `assertPositiveInt(budget.timeMs, "timeMs")`; return it.
- `countTokens(usage)` → sum `num()` of the four fields.
- `check(budget, usage)` → `assertPositiveInt(budget.tokens, "tokens")`; `spent =
  countTokens(usage)`; if `spent <= budget.tokens` return `ok` with `remaining =
  Math.max(0, budget.tokens - spent)`, else return `exhausted` with
  `code: BUDGET_EXHAUSTED`, `overage = spent - budget.tokens`.

**Verify:** `bun run check:typecheck` clean — in particular the `BudgetOutcome`
return type is satisfied on both branches and the discriminant narrows.

### Step 3 — Unit tests

Write `src/budget/budget.test.ts` per the Structure test blueprint: `countTokens`
(full / partial / empty / cache-only), `timeoutMsFor` (identity + four invalid
inputs throw `RangeError`), `check` ok branch (below + exact-boundary), `check`
exhausted branch (`status`, `code` against the exported constant, `overage`), the
"andon carries data" assertions, and the invalid-ceiling `RangeError`.

**Verify:** `bun run check:test` — all tests pass; no test spawns or touches fs.

### Step 4 — Remove placeholder, run full gate

`rm src/budget/.gitkeep`. Run `bun run check` (both gates together).

**Verify:** exit 0. Then `grep -nE "executor|claude|fs|fetch|process|Date|Bun"
src/budget/budget.ts` returns nothing — proves seam-agnosticism and purity
structurally (AC 3 & 4).

### Step 5 — Commit

One commit: `src/budget/budget.ts`, `src/budget/budget.test.ts`, and the
`.gitkeep` deletion together. Message scopes it to T-001-03. Per the scaffold
ticket's lesson (lisa hooks don't commit; the agent commits directly), but **only
the budget files** — leave sibling threads' files untouched to keep the shared
branch clean. Lisa serializes the commit via file locking; no cross-thread
coordination needed.

## Risks & mitigations

- **Risk: `Usage` field names drift from the seam.** Mitigation: names are copied
  verbatim from `mc-design-eval`'s `tallyUsage` (`input_tokens`, `output_tokens`,
  `cache_read_input_tokens`, `cache_creation_input_tokens`), which T-001-02 ports
  unchanged. If T-001-02 lands a differently-named usage shape, that is a
  follow-up reconciliation, flagged in Review, not a blocker here (budget's
  `Usage` is structural and independently correct).
- **Risk: token-counting decision is wrong for real budgets.** Mitigation:
  `countTokens` is a single exported function — the policy has one home and is
  cheap to change; Design records the rejected alternatives so a future change is
  an informed edit, not a rediscovery.
- **Risk: composing `check` and the seam timeout double-counts or conflicts.**
  Mitigation: they are orthogonal by construction — time is enforced pre-run by
  the seam, tokens checked post-run by budget; neither reads the other's state.

## Definition of done

`bun run check` green; all four ACs traceable to a passing test or a grep;
`budget.ts` imports nothing from `src/executor/`; module is pure; committed.
