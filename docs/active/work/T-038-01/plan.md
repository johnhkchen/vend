# Plan — T-038-01 timeout-headroom-lever

Ordered, independently-verifiable steps. The whole change is small (one constant, one function
body, the tests that pin it), so it is a single atomic commit, but the steps below sequence the
edits and the verification.

## Step 1 — Add `TIMEOUT_HEADROOM` and apply it in `timeoutMsFor`

File: `src/budget/budget.ts`.

- Add `export const TIMEOUT_HEADROOM = 2;` above `timeoutMsFor`, with the doc-comment from
  `structure.md` (the ratchet rationale, the censored-margin justification for 2, the
  "raising the percentile can't fix it" note, and the IA-14-deferred note).
- Change `timeoutMsFor`'s body to
  `assertPositiveInt(budget.timeMs, "timeMs"); return Math.ceil(budget.timeMs * TIMEOUT_HEADROOM);`.
- Trim the existing `timeoutMsFor` doc-comment so it points to `TIMEOUT_HEADROOM` for the why,
  rather than still claiming "identity-with-validation."

**Verify**: `bun run check:typecheck` passes (pure arithmetic, no type change).

## Step 2 — Update and extend the proof in `budget.test.ts`

File: `src/budget/budget.test.ts`.

- Import `TIMEOUT_HEADROOM` alongside `timeoutMsFor`.
- Update the verbatim test: expect `timeoutMsFor(budget(30_000, 1))` to equal
  `30_000 * TIMEOUT_HEADROOM`.
- Keep the `test.each([0, -1, NaN, 1.5])` RangeError test unchanged.
- Add `test("TIMEOUT_HEADROOM is a documented factor with real margin")`: assert it is an integer
  `>= 2` (pins the warranted constant; catches a silent drift toward 1.0).
- Add `test("E-037 censored runs would finish under the headroomed timeout")` — the AC #3 mapping:
  - `const T = 72_785;` (the measured `propose-epic` p90 envelope).
  - `const timeout = timeoutMsFor(budget(T, 1));` → assert `=== T * TIMEOUT_HEADROOM`.
  - assert `72_792 < timeout` and `72_805 < timeout` (both E-037 censored actuals finish under the
    headroomed wall — no guillotine at 72.8 s).
  - assert affordability still gates on the **price** `T`, not the headroomed value (see Step 3 for
    the exact wallet wiring decision).

**Verify**: `bun run check:test` passes; the new tests cover the changed branch.

## Step 3 — Decide the affordability assertion shape

The mapping test must show affordability gates on the bare `T`. Read `src/budget/wallet.ts`'s
`canAfford`/`Wallet` surface and pick the lighter of:

- **(a) real `canAfford`**: build a `Wallet` with exactly `T` ms (and ample tokens) remaining,
  assert `canAfford(wallet, { timeMs: T, tokens: 1 })` is `true` and
  `canAfford(wallet, { timeMs: T + 1, tokens: 1 })` is `false` — proving the wallet measures the
  bare envelope `T`, not `T * HEADROOM`. (`canAfford` takes a `Budget` and a `Wallet`; constructing
  a `Wallet` may need a small helper — check wallet.ts for the constructor/`newWallet`.)
- **(b) direct**: if wiring a `Wallet` is disproportionate, assert the two facts that together prove
  isolation — `timeoutMsFor(budget(T,1)) === T * HEADROOM` (guard uses headroom) AND a comment +
  assertion that the price surfaces read `budget.timeMs` (`=== T`) unchanged. Prefer (a) if the
  `Wallet` constructor is one line; it's the stronger proof. This belongs in `budget.test.ts` only
  if `canAfford` is importable without dragging impure deps — `wallet.ts` is pure, so it is.

Choose during Implement; record the choice in `progress.md`.

## Step 4 — Confirm isolation (no unintended edits)

- `grep -rn "timeoutMsFor" src/` → confirm only `budget.ts` (def + this test) and the two callers
  (`cast.ts:216`, `run-equivalence-judge.ts:317`) reference it; no new call sites.
- Confirm `git status` shows only `budget.ts` and `budget.test.ts` modified under `src/`.

## Step 5 — Run the full gate

`bun run check` (= `baml:gen && check:typecheck && check:test`). Must be green.
(Note: `bun run check:*` is a zsh glob that no-ops — use the aggregate `bun run check`.)

## Step 6 — Commit

One atomic commit: `feat(budget): give the per-cast timeout headroom above the price (T-038-01)`.
Body: names the ratchet, the 2× justification from E-037's censored margin, and the isolation
(affordability/price unchanged).

## Testing strategy

- **Unit (all of it)**: `budget.test.ts` is pure (no spawn/fs/clock) and is the gate file. Every
  branch of the change is unit-covered: the headroomed return, the preserved input contract, the
  pinned constant, and the E-037 deterministic mapping.
- **No integration / no live model**: the honest boundary holds — proving the heavy signal *clears*
  live is Frontier 1's next pull, not this ticket. The mapping test is the deterministic stand-in.
- **Verification criteria** (= the ACs):
  1. `timeoutMsFor` returns `budget.timeMs × HEADROOM`, documented constant, contract preserved. ✓ Steps 1–2.
  2. Only the kill-switch changes; affordability/shelf read bare `budget.timeMs`. ✓ Steps 3–4.
  3. Deterministic proof incl. the E-037 ~72–73 s mapping, no live model. ✓ Step 2.
  4. Ratchet + IA-14-deferred rationale documented at the definition. ✓ Step 1.
  5. `bun run check` green. ✓ Step 5.

## Risk / rollback

Single-factor arithmetic change in a pure module with full unit coverage; lowest-risk class of
change. Rollback is reverting one commit. The only behavioral change downstream is that
`cast.ts`/`run-equivalence-judge.ts` casts now get 2× the wall-clock before SIGKILL — bounded above
by the macro wallet's real-actuals debit (P7 holds), so no unbounded-spend risk.
