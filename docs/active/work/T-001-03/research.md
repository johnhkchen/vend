# Research — T-001-03 budget-control

Descriptive map of the ground this ticket stands on. What exists, where, how it
connects, and the constraints that bind a budget module. No solutions here.

## What the ticket asks for

A standalone **budget control**: budget is a *hard contract* (charter P7), not a
hint. A run is allocated time + tokens up front and is accountable to them **both
ways**. For this single-shot slice budget has two faces:

- **(a) a wall-clock allowance** that becomes the executor seam's `timeoutMs`.
- **(b) a token ceiling** checked against the dispense `result.usage`.

Exhaustion must be a clean hard stop with a clear **andon** — a typed, named
outcome the runner can surface, never a silent overrun or a discarded console
line. The module is **separate from the seam** (no shared files) so it runs
parallel to T-001-02 under lisa's DAG.

## Where it sits in the codebase

The scaffold (T-001-01, `phase: done`) is on disk and green. Ground truth:

- `src/budget/.gitkeep` — the empty dir this ticket fills with `budget.ts` (+ a
  colocated test).
- `src/executor/.gitkeep` — T-001-02's seam (`claude.ts`), built in parallel.
  Budget **must not import it**.
- `src/log/`, `src/gate/`, `src/play/` — sibling empty dirs, out of scope.
- `src/smoke.test.ts` — the existing test convention (see below).

`package.json` exposes the gate surface budget is verified by:
`check:test` → `bun test`, `check:typecheck` → `tsc --noEmit`, `check` runs both.
`tsconfig.json` is **strict**: `strict: true`, `noUncheckedIndexedAccess: true`,
`verbatimModuleSyntax: true`, `allowImportingTsExtensions: true`,
`moduleResolution: bundler`. These bind how I write and import TS (see Constraints).

## The two things budget connects to

### 1. The executor seam (T-001-02) — `timeoutMs` consumer

Per `T-001-02.md`, the seam exports
`dispense({ prompt, model?, effort?, system?, onMessage?, timeoutMs? })`. It
SIGKILLs a non-returning child at `timeoutMs` and throws a typed
`ClaudeTimeoutError` with `code === "ETIMEDOUT_CLAUDE"`. Crucially the seam is
**budget-agnostic**: it *accepts* `timeoutMs` but does not own the budget — "the
budget is composed by the runner with T-001-03." So budget's job on the time axis
is only to **derive** the `timeoutMs` number the runner hands the seam; the seam,
not budget, enforces the wall-clock stop (the time-exhaustion andon is the seam's
`ClaudeTimeoutError`). Budget owns the **token** andon.

### 2. The dispense `result.usage` — token-ceiling source

The seam returns the terminal `result` message carrying `usage`,
`total_cost_usd`, and `subtype`. The shape of `usage` is the proven one from the
reference implementation
`/Volumes/ext1/swe/repos/mc-design-eval/src/sdk-binding.mjs` and its
`tallyUsage` in `trial.mjs`. Observed fields on a per-turn / terminal usage
object:

```
{ input_tokens, output_tokens,
  cache_read_input_tokens, cache_creation_input_tokens }
```

(`tallyUsage` reads exactly these four via a `num()` coercion that defaults
missing fields to 0, then sums turns into `totals`.) The terminal `result.usage`
carries the run's final totals. Budget's `check` reads this object and compares a
scalar token count against the ceiling. Any of the four sub-fields may be absent
on a given message, so `check` must treat missing as 0 — same defensive coercion
`tallyUsage` already uses.

## Reference pattern: the andon / typed-outcome convention

The sibling seam establishes the house style for a "named outcome the runner can
surface": a typed error carrying a stable string `code` (`ClaudeTimeoutError`,
`code === "ETIMEDOUT_CLAUDE"`). The ticket for *this* module asks for a "typed,
named outcome (an andon the runner can surface) — not a discarded console line."
That phrasing — "outcome," not "error" — plus "carrying the overage" reads as a
**returned discriminated-union value** (`ok | exhausted`) rather than a thrown
error: token exhaustion is the *expected* terminal state of a metered run, not an
exceptional one, and the runner needs the overage data to log and report. The
naming convention (a stable `code`/`kind` string) should still mirror the seam so
the runner can switch on both andons uniformly.

`mc-design-eval`'s testing rule is also load-bearing precedent: **pure helpers
are unit-tested with fabricated inputs; nothing live is spawned.** Budget is
*entirely* pure (no child at all), so 100% of it is unit-testable with hand-built
`Usage` objects.

## What "tokens" even means here (the open modeling question)

The ceiling is denominated in "tokens," but `usage` has four token sub-counts
with very different cost profiles (cache-read is an order of magnitude cheaper
than fresh input/output). So "spent tokens" is a **modeling decision**, not a
given: is the ceiling against `input+output`, against all four summed, or against
cost? The ticket says "token ceiling … checked against `result.usage`" and the
charter frames budget as tokens (not dollars). This is the central tradeoff
Design must resolve and justify; Research only flags that the `usage` object
under-determines a single scalar.

## Constraints that bind the implementation

- **Purity (hard AC):** no network, no fs, no clock, no child process. That means
  budget cannot itself *measure* elapsed wall-clock — it only *derives* the
  allowance and *checks* a usage object it is handed. Time enforcement lives in
  the seam; elapsed-time accounting (if any) belongs to the runner, not here.
- **No seam import (hard AC):** `budget.ts` imports nothing from `src/executor/`.
  It may depend on a *structural* `Usage` type, but that type must be defined
  locally (or shared via a neutral types module), never imported from `claude.ts`
  — otherwise budget is welded to the seam it is meant to compose with.
- **Strict TS / `noUncheckedIndexedAccess`:** optional usage fields are `number |
  undefined`; every read must coerce. `verbatimModuleSyntax` forces
  `import type` for type-only imports. `.ts` extensions are allowed in imports.
- **Right-sizing (charter P3 "allocatable"):** one module, one pure function set,
  fully testable in one session. The whole surface is: a `Budget` shape, a
  `timeoutMs` derivation, a token counter, and a `check` returning `ok |
  exhausted`. Nothing larger is in scope (no persistence, no cost model, no
  multi-run aggregation).

## Assumptions surfaced

- The runner — not yet built (S-001 has no runner ticket; it arrives in S-002) —
  is the composition point that (1) calls `timeoutMsFor(budget)` and passes the
  result to `dispense`, and (2) calls `check(budget, result.usage)` after dispense
  returns and surfaces the andon. Budget is written *to be composed*, against an
  interface that does not exist yet. So its public surface must be obvious and
  self-documenting.
- `usage` field names match `mc-design-eval` exactly (snake_case, from the
  `claude -p` stream-json). T-001-02 ports that pattern verbatim, so the names are
  stable across the seam boundary.
- A budget with `tokens === 0` or `timeMs === 0` is a caller error, not a runtime
  state to model gracefully; Design will decide whether to guard or document.
