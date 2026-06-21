# T-048-03 — Audit: Macro-Wallet IA-8 Two-Denomination Coverage

**Scope:** Read-only audit confirming the macro-wallet's IA-8 two-denomination contract
is test-covered before E-048's T-048-01 generalizes it to a concurrent wave. One
test-only characterization was added (see §4); no production code was modified.

---

## 1. Gate result (AC-1)

`bun run check` (`baml:gen` → `tsc --noEmit` → `bun test`) — **PASS**.

| Metric | Before audit | After (with added test) |
|---|---|---|
| Result | ✅ pass | ✅ pass |
| Tests | 1127 pass / 0 fail | **1131 pass / 0 fail** |
| Assertions | 3026 expect() | 3030 expect() |
| Files | 77 | 77 |
| Wall-clock | ~1.5s | ~1.8s |

Typecheck clean; lint/format enforced via the same gate. The tree is green.

> **Concurrency note (honest record):** T-048-03 runs **concurrently** with T-048-01
> (no `depends_on` — deliberate parallel check). During this audit the T-048-01 thread
> was actively landing `debitWave`/`authorizeWave` and its tests into the SAME files
> (`wallet.ts`, `wallet.test.ts`). The gate stayed green throughout; a re-run after
> T-048-01 progressed read **1147 pass / 0 fail / 3061 expect()**. The exact count is a
> moving target while the sibling ticket commits — the load-bearing fact is **0 fail at
> every observation**. The "before/after" column above is this ticket's own delta
> (the +4 from the characterization test in §4), measured before T-048-01's later tests
> merged in.

---

## 2. IA-8 coverage table (AC-2)

The contract (from `wallet.ts` banner): *the meter must not lie about its two
denominations — wall-clock = HARD WALL, tokens = DETECT-AFTER, never conflated.*

| # | Contract behavior | Denomination | Covering test (`wallet.test.ts`) | Status |
|---|---|---|---|---|
| 1 | `canAfford` refuses a predicted spend over remaining **time** | ⏱ wall-clock (hard wall) | `canAfford` → "refuses a cast that is over on wall-clock" | ✅ pinned |
| 2 | Fits on tokens but **not** on time ⇒ does NOT fit (no conflation) | ⏱ wall-clock | `canAfford` → "fits on tokens but not on time does NOT fit (IA-8)" | ✅ pinned |
| 3 | Fits on time but not on tokens ⇒ does NOT fit | ◇ tokens | `canAfford` → "fits on time but not on tokens does NOT fit" | ✅ pinned |
| 4 | Exact fit (`<=` boundary) is affordable | both | `canAfford` → "exact fit on both denominations affords (<= boundary)" | ✅ pinned |
| 5 | A depleted wallet affords nothing positive | both | `canAfford` → "a depleted wallet affords nothing positive" | ✅ pinned |
| 6 | `debit` floors remaining **tokens** at 0 and surfaces `overshoot` | ◇ tokens (detect-after) | `debit — token overshoot (IA-8 detect-after, the load-bearing case)` | ✅ pinned |
| 7 | `debit` floors remaining **time** at 0 and surfaces `overshoot` | ⏱ wall-clock (defensive symmetry) | `debit — time overshoot (defensive symmetry)` | ✅ pinned |
| 8 | Per-denomination overshoot is independent (one floors, other untouched) | both | tests in rows 6 & 7 (assert the *other* denom stays exact) | ✅ pinned |
| 9 | Sequence depletes monotonically to exactly 0, then floors + reports full overshoot | both | `debit — a sequence depletes monotonically to zero` | ✅ pinned |
| 10 | `debit(Usage)` debits tokens by `countTokens`, leaves wall-clock untouched | ◇ tokens | `debit — Usage actual` (two tests) | ✅ pinned |
| 11 | `allocate` rejects non-positive / non-integer funds (`RangeError`) | both | `allocate` → two `test.each([0,-1,NaN,1.5])` | ✅ pinned |
| 12 | `formatWallet` shows BOTH denominations separately, never one bar | both (display) | `formatWallet` → 4 tests incl. "renders two distinct bars, never one combined figure" | ✅ pinned |
| 13 | `canAfford` safe-refuses a **non-finite** predicted price | both | **ADDED** `canAfford — refuses non-finite predicted timeMs/tokens` | ✅ pinned (was gap) |

**Verdict:** every facet of the IA-8 two-denomination contract is now pinned by a test.

---

## 3. Back-compat anchor for T-048-01 (AC-3)

T-048-01's `debitWave` must, for a **single-node wave**, behave **exactly like the
current per-cast `debit`** (tokens summed, wall-clock — for one node — equal to that
node's time; the divergence to MAX only matters for *multi-node* waves).

**The current `debit` both-denomination behavior IS pinned.** The anchor test is:

> `debit — fitting Budget actual` → **"depletes both denominations by the exact
> amount; no overshoot"**
> `debit(allocate(macro(30_000,100_000)), macro(10_000,40_000))` ⇒
> `remaining = { timeMs: 20_000, tokens: 60_000 }`, `overshoot = { 0, 0 }`.

This asserts a single cast subtracts BOTH denominations by the cast's cost — the
behavior `debitWave([oneActual])` must reproduce. Supporting anchors: `debit — fitting
Budget actual` "carries funded through unchanged and never mutates the input"
(immutability contract `debitWave` must also honor) and `debit — a sequence depletes
monotonically to zero` (fold semantics over successive casts).

**No gap on the anchor** — it does not need to be authored; T-048-01 can write
`debitWave([a]) toEqual debit(w, a).wallet` directly against this established baseline.

---

## 4. Gaps & disposition (AC-4)

One behavior was **documented in the source but not directly asserted**:

- **`canAfford` non-finite "safe-refuse"** — the banner on `canAfford` states *"A
  non-finite predicted naturally fails the comparison → false (safe-refuse)."* No test
  exercised a `NaN`/`Infinity` predicted price. This is a real characterization gap on
  the **hard-wall** denomination T-048-01's `authorizeWave` (each-node-time ≤ remaining)
  will inherit — a non-finite predicted price must safely refuse, not admit an unbounded
  cast.

  **Disposition: CLOSED with a test-only, additive characterization** (per Design Option
  B; the ticket permits a trivial additive test). Added to `wallet.test.ts` adjacent to
  the `canAfford` block, using only already-imported symbols:

  ```ts
  test.each([Infinity, NaN])("refuses a non-finite predicted timeMs: %p", (t) =>
    expect(canAfford(w, macro(t, 10_000))).toBe(false));
  test.each([Infinity, NaN])("refuses a non-finite predicted tokens: %p", (n) =>
    expect(canAfford(w, macro(10_000, n))).toBe(false));
  ```

  All four cases pass — the documented behavior is true (`Infinity <= finite` is false;
  any comparison with `NaN` is false). **No production code changed.**

No other gaps. `formatWallet`'s `fmtTokens`/`fmtMs` paths are format-only and covered by
the `formatWallet` block; they are outside the IA-8 algebra contract this audit targets.

---

## 5. Conclusion

- The gate is **green**: 1131 pass / 0 fail.
- The IA-8 two-denomination contract (hard wall via `canAfford`, detect-after +
  overshoot via `debit`, no conflation) is **fully test-pinned**.
- The single-node **back-compat anchor** T-048-01 builds on is present and named.
- The one documented-but-untested behavior was closed with a trivial test-only addition.

**T-048-01 may proceed on solid, characterized ground.** The behavior it must preserve
for single-node waves — and the hard-wall semantics it must generalize across a
ready-set — are both pinned by the suite that gates every merge.
