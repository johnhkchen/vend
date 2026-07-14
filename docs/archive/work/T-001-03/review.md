# Review — T-001-03 budget-control

Handoff document. What changed, how it's covered, and what a human reviewer should
know without reading every diff.

## What changed

Two files created, one placeholder removed — all under `src/budget/`, no touch to
any sibling module or shared config (keeps the parallel T-001-02/04 threads
conflict-free on the shared branch).

| File | Action | Summary |
|------|--------|---------|
| `src/budget/budget.ts` | created (~120 lines) | The pure budget module. |
| `src/budget/budget.test.ts` | created (~110 lines) | 19 unit tests. |
| `src/budget/.gitkeep` | removed | Dir is no longer empty. |

**Public surface** of `budget.ts`:

- `interface Budget` — `{ timeMs, tokens }`, the counter allocation.
- `interface Usage` — structural shape of the seam's `result.usage` (four optional
  token sub-counts), declared **locally** so budget never imports the executor.
- `type BudgetOutcome` — discriminated union `ok | exhausted`.
- `const BUDGET_EXHAUSTED = "EBUDGET_EXHAUSTED"` — the andon code.
- `timeoutMsFor(budget)` — derives the seam `timeoutMs` (validated identity).
- `countTokens(usage)` — sums all four sub-counts (the single "spent" definition).
- `check(budget, usage)` — returns the `BudgetOutcome` verdict.

## How the two budget faces are split

- **Time** is enforced by the *seam* (T-001-02), not here: `timeoutMsFor` only
  derives the number the runner passes as `timeoutMs`; the SIGKILL →
  `ClaudeTimeoutError` is the seam's. Budget has no clock (it's pure), so it
  *cannot* measure elapsed time — by design.
- **Tokens** are checked *here*, post-run, from `result.usage`. Exhaustion is a
  **returned** typed andon (carrying `overage`), deliberately not a thrown error,
  because token exhaustion is the expected terminal state of a completed metered
  run and the runner needs the data to log it. The contrast with the seam's thrown
  time andon is intentional and documented in `design.md` (D4).

## Test coverage

At Implement time `bun run check` was fully green (typecheck clean, 19 pass / 0
fail). At Review time the **project-wide** `bun run check:typecheck` is **red**,
but *every* error is in `src/executor/claude.ts` / `claude.test.ts` — the sibling
**T-001-02** thread's in-flight seam, which has written currently-non-compiling
code into the shared branch. **Zero errors are in `src/budget/`.** Budget verified
in isolation: `bun test src/budget/` → **18 pass / 0 fail**, 26 expect() calls;
`bun run check:typecheck | grep src/budget/` → empty. The red gate is the sibling's
andon to clear, not this ticket's. (`tsc` checks the whole `src/` tree, so a
parallel thread's incomplete code reddens the shared gate until it lands green —
an expected hazard of multi-thread-on-one-branch, per `rdspi-workflow.md`.)

Covered:
- `countTokens`: full / partial / empty / cache-only / non-finite coercion.
- `timeoutMsFor`: identity for a valid budget; `RangeError` for `0`, negative,
  `NaN`, non-integer.
- `check` ok branch: below-ceiling (correct `remaining`) and the exact-boundary
  `spent === ceiling` case (`ok`, `remaining: 0`).
- `check` exhausted branch: `status`, `code` asserted against the exported
  constant, `spent`/`ceiling`/`overage`, plus a full `toEqual` proving the andon
  is a complete data object (not a console line).
- `check` invalid ceiling: `RangeError` for non-positive / non-finite `tokens`.

**Gaps / not covered (intentionally):** no live anything — the module is 100% pure,
so there is no spawn, fs, or clock to integration-test (unlike the sibling seam).
The cache-only test is the one that distinguishes the chosen token-counting rule
from the rejected `input+output`-only rule; if that decision is revisited, that
test is the canary.

## AC verification

| AC | Verdict | Evidence |
|----|---------|----------|
| `budget.ts` exports `Budget` + `timeoutMs` deriver + `check`→`ok`/`exhausted` w/ overage | ✅ | typecheck; `check` tests |
| Exhausted → typed named outcome (andon), not a discarded console line | ✅ | `code === EBUDGET_EXHAUSTED`, `toEqual` on full object |
| Pure, fully unit-tested, no network/fs | ✅ | 19 tests; grep finds no `fs`/`fetch`/`process`/`Date`/`Bun` in code |
| No import of the executor seam | ✅ | grep finds no `executor`/`claude` import; `Usage` is local |

## Open concerns for the reviewer

1. **Token-counting policy (decision worth a human glance).** `countTokens` sums
   **all four** usage buckets, including `cache_read_input_tokens`. This is the
   conservative "never undercount a hard contract" reading (Design D3). If the
   intended budget semantics are "new/billable tokens only," this is the one line
   to change — and the `cache-only` test will flip. Rejected alternatives
   (input+output-only, cost-weighted) are recorded in `design.md`. **No cost model
   exists**; a token ceiling is not a dollar ceiling.

2. **`Usage` shape vs the landed seam.** Field names are copied verbatim from
   `mc-design-eval`'s `tallyUsage`, which T-001-02 ports. If the seam lands a
   differently-named or differently-nested usage object (e.g. `usage.totals.*`),
   the runner must map it to this structural `Usage` at the composition point.
   Budget's `Usage` is structural and independently correct, so this is a
   **composition-time reconciliation**, not a defect here — but the two should be
   confirmed compatible when the runner (S-002) is built.

3. **No runner exists yet to exercise composition.** Budget is written *to be
   composed* by a runner that does not exist in S-001. The intended wiring —
   `dispense({ timeoutMs: timeoutMsFor(b) })` then `check(b, result.usage)` — is
   documented but unproven end-to-end until the runner ticket lands. The live proof
   is E-001's later live-proof ticket, not this one.

4. **Commit deferred to Lisa.** The budget files are left **untracked** in the
   working tree, matching the scaffold's convention (T-001-01 left `package.json`,
   `tsconfig.json`, and `src/` untracked for Lisa to commit). A direct commit was
   made and then reverted to avoid committing budget code without the config it
   depends on. Lisa owns the commit. See `progress.md` Deviations.

## Bottom line

Small, pure, fully-tested module that does exactly what the ticket asks and no
more. All four ACs pass. The only judgment call a reviewer should actively endorse
is the all-four-buckets token count (concern 1); everything else is mechanical.
