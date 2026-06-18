# Design — T-001-03 budget-control

Decisions, with rationale, grounded in Research. Three questions to settle: (1)
the public surface, (2) what "spent tokens" means, (3) how exhaustion is
surfaced (the andon shape). Each is decided and the rejected options recorded.

## Decision 1 — Public surface: a pure value module, not a class

**Chosen:** a `Budget` plain interface plus free functions
`timeoutMsFor(budget)`, `countTokens(usage)`, and `check(budget, usage)`. No
class, no instance state, no constructor.

```ts
export interface Budget {
  readonly timeMs: number;   // wall-clock allowance → seam timeoutMs
  readonly tokens: number;   // token ceiling
}
```

**Why.** Budget is stateless: every operation is a pure function of its inputs.
A `Budget` is just the two allocated numbers; behavior is functions over it. This
matches the codebase's functional reference style (`mc-design-eval` exports pure
`tallyUsage`/`serializeTranscript`, not classes) and makes the AC "pure and fully
unit-tested" trivially true — there is no lifecycle to mock.

**Rejected — a `Budget` class with `.timeoutMs()`/`.check()` methods.** It reads
nicely but adds `this` for no gain, complicates `readonly` immutability, and
tempts future stateful drift (a `.spent` accumulator) that the single-shot slice
explicitly does not need. Free functions keep the seam-agnostic, compose-me
posture the ticket demands.

**Rejected — fold time + tokens into one `enforce()` call.** The two axes are
enforced in **different places at different times**: `timeoutMs` is consumed by
the seam *before* the run; tokens are checked *after* the run from `result.usage`.
A single call cannot straddle that. Two functions mirror the two real moments.

## Decision 2 — `timeoutMsFor`: derive, don't measure

**Chosen:** `timeoutMsFor(budget: Budget): number` returns `budget.timeMs`
directly (an identity-with-validation: assert it is a positive finite integer,
else throw a programmer-error `RangeError`). It exists as a *named seam* so the
derivation has one home if it ever grows (e.g. reserving a shutdown margin).

**Why.** Research established that budget is pure and **cannot** measure elapsed
time — it has no clock (hard AC: no network/fs/clock). The seam owns wall-clock
enforcement via SIGKILL → `ClaudeTimeoutError`. So budget's entire time-axis
responsibility is to *hand the runner the number to give the seam*. Today that is
the allowance verbatim; wrapping it now means the call site (`dispense({ timeoutMs:
timeoutMsFor(budget) })`) never changes if the policy does. The validation earns
its keep: it converts a `timeMs: 0` / `NaN` caller bug into a loud failure at the
budget boundary instead of a seam that never times out.

**Rejected — expose `budget.timeMs` raw, no function.** Cheaper, but then the
time-policy seam has no home and validation scatters to every call site. One named
function is the cheaper invariant.

## Decision 3 — What "spent tokens" means: sum all four sub-counts

This is the load-bearing modeling call Research flagged. `usage` carries
`input_tokens`, `output_tokens`, `cache_read_input_tokens`,
`cache_creation_input_tokens`.

**Chosen:** `countTokens(usage)` returns the sum of **all four** sub-counts,
each coerced `undefined → 0` (mirroring `mc-design-eval`'s `num()` default).

```ts
export interface Usage {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_read_input_tokens?: number;
  readonly cache_creation_input_tokens?: number;
}
```

**Why.** A *hard contract* (P7) must not undercount. Every token in any of the
four buckets is a token the run actually moved through the model; excluding
cache-read would let a run with a huge cached prefix silently sail past a ceiling
the author set. Summing all four is the **conservative** reading of "the tokens it
was allocated," and it is the simplest rule to explain and to test. The ceiling is
denominated in tokens (charter, not dollars), so weighting buckets by price would
smuggle a cost model in — out of scope.

**Rejected — `input + output` only.** Closer to "billable new tokens" and what a
naive reader pictures, but it ignores cache traffic entirely; a run could exhaust
its real footprint while `check` reports `ok`. Undercounting is the one failure a
hard contract cannot make.

**Rejected — cost-weighted (`total_cost_usd`-based).** More economically honest,
but it changes the unit from tokens to dollars, depends on a price table that
drifts, and contradicts the ticket's "token ceiling." Deferred to a future
cost-budget if ever wanted; noted as a limitation in Review.

`countTokens` is exported (not just internal) so the runner/log can reuse the
exact same definition of "spent" — one source of truth for the number.

## Decision 4 — The andon: a returned discriminated union, not a thrown error

**Chosen:** `check` returns a discriminated union; exhaustion is a value, not an
exception.

```ts
export type BudgetOutcome =
  | { readonly status: "ok";
      readonly spent: number; readonly ceiling: number; readonly remaining: number }
  | { readonly status: "exhausted"; readonly code: "EBUDGET_EXHAUSTED";
      readonly spent: number; readonly ceiling: number; readonly overage: number };

export function check(budget: Budget, usage: Usage): BudgetOutcome;
```

Boundary is `spent > ceiling` ⇒ `exhausted`; `spent === ceiling` is `ok`
(spending exactly your allowance is honoring the contract, not breaching it).
`remaining = max(0, ceiling - spent)`; `overage = spent - ceiling` (always > 0 in
the exhausted branch).

**Why a value, not a throw.** Token exhaustion is the *expected* terminal state
of a metered run — the run did its job up to the line. The runner needs the
**data** (spent/ceiling/overage) to log a countable record and surface the andon;
an exception is the wrong shape for an anticipated, data-carrying outcome and
would force `try/catch` as control flow. This is the deliberate contrast with the
seam's *time* andon: a wall-clock kill is an interruption mid-flight (a thrown
`ClaudeTimeoutError` is right there), whereas a token check is a post-hoc verdict
on a completed `usage` (a returned verdict is right here). The runner switches on
`outcome.status` for tokens and catches `ClaudeTimeoutError` for time — two
andons, one uniform habit: a stable `code` string on each.

**Named, not discarded (the explicit AC).** The exhausted variant carries
`code: "EBUDGET_EXHAUSTED"` — the token analogue of `ETIMEDOUT_CLAUDE`. It is a
typed object the runner returns/logs, the opposite of a `console.log`. The `code`
is a literal type, so a `switch` over andons is exhaustively checkable by `tsc`.

**Rejected — throw a `BudgetExhaustedError`.** Symmetric with the seam at first
glance, but it conflates "the run completed and overspent" (a result to report)
with "the run was forcibly stopped" (an interruption). Throwing also discards the
ergonomics of returning `remaining` on the happy path, which the runner wants for
its log line regardless of outcome.

**Rejected — return a bare `boolean`.** Fails the AC outright: a boolean carries
no overage, so the runner cannot surface *how much* it overran. The andon must
carry the overage.

## Seam-agnosticism, concretely

`budget.ts` imports **nothing** from `src/executor/`. The `Usage` interface is
declared locally as a structural shape (only the four optional fields `check`
reads) — the seam's `result.usage` satisfies it by duck-typing, with zero
compile-time coupling. If a neutral shared types module appears later, `Usage`
can move there; until then, local declaration keeps budget independently
buildable while T-001-02 is still in flight on the same branch.

## What is deliberately out of scope

No persistence, no multi-run aggregation, no elapsed-time measurement, no cost
model, no reservation/soft-warning tiers. The single-shot slice needs exactly:
derive a timeout, count tokens one way, render a ceiling verdict. Anything more is
overproduction (charter: refuse work that advances nothing nameable now).
