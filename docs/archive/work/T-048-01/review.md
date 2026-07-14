# T-048-01 Review — wave-budget pure core

Handoff document. What changed, test coverage vs the acceptance criteria, open concerns, and the
T-048-02 handoff. Read this instead of every diff.

## What changed

Strictly **additive** — no existing export, signature, or behavior was modified, so the single-chain
(`fitNext` / `debit` / `spendDown`) path is structurally untouched.

| File | Change |
|------|--------|
| `src/budget/wallet.ts` | **+`debitWave(wallet, actuals): DebitResult`** — folds a concurrent wave's settled actuals into one combined `Budget` (**tokens summed, wall-clock MAX** via the in-file `actualToBudget`), then delegates to the public `debit`. Plus one IA-8 header line noting the MAX/SUM divergence. |
| `src/engine/spend-core.ts` | **+`WaveAuthorization<C>`** interface and **+`authorizeWave<C>(wallet, readySet, priceOf)`** — the `fitNext` generalization to a ready-set: greedy walk in given order, each-fits time (MAX) + cumulative tokens (SUM) enforced via a per-node virtual wallet through `canAfford`; partitions into `{ dispatch, stopped }`. |
| `src/budget/wallet.test.ts` | **+`describe("debitWave", …)`** — 8 cases. |
| `src/engine/spend-core.test.ts` | **+`describe("authorizeWave", …)`** — 8 cases. |
| `docs/active/work/T-048-01/*` | research / design / structure / plan / progress / review artifacts. |

Both functions are **PURE / TOTAL**, type-only imports beyond the pure `canAfford` / `debit` /
`actualToBudget`, no fs/clock/seam — the wallet.ts / spend-core.ts discipline.

## Design choices a reviewer should know

1. **Placement split (not one `wave-budget.ts`):** `debitWave` lives in wallet.ts beside `debit`;
   `authorizeWave` in spend-core.ts beside `fitNext`. This avoids exporting wallet's private IA-8 helpers
   (`floorNonNeg`/`overBy`/`actualToBudget`) or re-implementing the floor/overshoot math in a second file
   (a meter-lies risk). Each generalization sits next to the function it generalizes. See `design.md` D1.
2. **`debitWave` = fold-then-delegate to `debit`:** makes **single-element == `debit`** and **empty ==
   no-op** *structural*, not coincidental — the overshoot is computed exactly once by `debit` on the summed
   delta. See `design.md` D2.
3. **`authorizeWave` continue-after-stop (not stop-all):** a stopped node is skipped and the walk continues,
   so a smaller later node still dispatches — the faithful generalization of `fitNext`'s documented
   "skip the unaffordable head to spend the wallet down." A stopped node never adds to the cumulative, so a
   wave can never overspend. Flagged because a reviewer who prefers stop-all-after-first-miss can get it
   with a one-line `break` — see `design.md` D3.

## Test coverage vs acceptance criteria

| AC | Covered by |
|----|-----------|
| `authorizeWave` returns `{dispatch, stopped}`; each time ≤ remaining, cumulative tokens ≤ remaining; deterministic order | all-fit · token-stop · time-stop · continue-after-stop · none-fit · empty · exact-fit `<=` · **"walks given order, does not re-sort"** |
| `debitWave` folds: tokens SUMMED, wall-clock MAX; floors + surfaces overshoot (IA-8) | all-fit (time=MAX) · **MAX-not-SUM** (3-branch) · overshoot-once (floored, collective) · mixed Usage+Budget |
| **single-element wave == `debit`** (asserted, back-compat) | `debitWave(w,[a]) === debit(w,a)` for **both** a Budget actual and a Usage actual |
| Unit-tested, no live model: all-fit / partial (token-stop, time-stop) / tokens-sum-time-max / overshoot-once / single==debit / empty | ✅ all present (+ immutability check on `debitWave`) |
| `bun run check:*` green | typecheck clean; full `bun test` **1147 pass / 0 fail / 77 files** |

**Gate results:**
- `bun run check:typecheck` → clean.
- `bun test src/budget/wallet.test.ts src/engine/spend-core.test.ts` → **64 pass / 0 fail**.
- `bun test` (full) → **1147 pass / 0 fail** — no regression in single-chain wallet/spend/graph tests.

## Open concerns / limitations

- **`authorizeWave` does not consult `funded`** beyond passing it through the virtual wallet; affordability
  is purely a `remaining` question, matching `canAfford`. Intentional — noted so it isn't read as an
  oversight.
- **No live/integration coverage here** — by design (the ticket forbids a live model). The functions are
  proven against the impure shell only when **T-048-02** threads them into `castGraph` and adds the
  deterministic worked example (fan-out the shared wallet stops where per-node budgets would overspend).
- **Continue-after-stop** semantics (D3) — the one substantive behavioral decision; surfaced above for
  explicit reviewer sign-off rather than buried.

## Handoff to T-048-02

`authorizeWave` and `debitWave` are the exact seam T-048-02 wires: `authorizeWave(wallet, readySet,
priceOf)` before each wave's `Promise.all` (dispatch the subset, hard-stop the rest at the wave boundary
and skip their subgraphs), `debitWave(wallet, actuals)` after the wave settles (one serialized fold,
immutable wallet threaded forward). The single-node-wave equivalences (`authorizeWave` head == `fitNext`
affordability, `debitWave[one]` == `debit`) are what keep the linear path provably unchanged.

## Note on the commit

Due to Lisa's shared-branch concurrency (multiple threads, file-lock-serialized commits over one shared
index), this ticket's staged files were committed under a concurrently-running thread's commit
(`5a6027d`, the T-048-03 audit). Verified at HEAD: `authorizeWave` + `debitWave` (src and tests) are all
present and the full suite is green. Content is intact; only the commit *message* belongs to the other
thread — an expected artifact of the concurrency model, not a lost change.
