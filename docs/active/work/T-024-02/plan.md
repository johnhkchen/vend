# T-024-02 Plan — autonomous-spend-loop

Ordered, independently-verifiable steps. Each is commit-sized; the suite stays green at every
boundary. Testing strategy and the AC traceability table close the doc.

## Step 1 — The `RunSummary` actuals seam (`src/engine/cast.ts`)
1. Add `export interface CastActuals { readonly usage: Usage; readonly wallMs: number }` near
   `RunSummary`.
2. Add `readonly actuals?: CastActuals;` to `RunSummary` (additive, optional).
3. In `castPlay`: lift `endedAt` into `const endedAt = new Date().toISOString();` immediately
   before `appendRunLog`; pass `endedAt` into the record (replacing the inline `new
   Date().toISOString()`), so the logged line is byte-identical.
4. Replace the return with:
   ```ts
   const wallMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
   const usage = (result?.usage ?? {}) as Usage;
   return { runId, outcome, materialized, produced, actuals: { usage, wallMs } };
   ```
**Verify:** `bun run check:typecheck` clean; `bun test` still 789 pass (no test asserts
`RunSummary`'s full shape; `chain-core.test.ts`'s `summary()` fake compiles with the new
optional field). **Commit:** `feat(engine): RunSummary surfaces cast actuals (T-024-02)`.

## Step 2 — The pure decision core (`src/engine/spend-core.ts` + test)
1. Write the module header (PURE; the walk-away decision algebra; cites IA-1/7/8/9, P7).
2. Imports: `canAfford` + `type Wallet` from `../budget/wallet.ts`; `type Budget` from
   `../budget/budget.ts`; `type RunOutcome` from `../log/run-log.ts`.
3. Types: `StopReason`, `Continuation`, `BoardState`, `SpendStep`, `SessionResult`, `StepSignal`
   (per Structure).
4. `fitNext<C>(wallet, candidates, priceOf)`: `for (const c of candidates) if (canAfford(wallet,
   priceOf(c))) return c; return null;`
5. `shouldContinue(wallet, board, lastOutcome)`: andon → cleared → `!fits` → continue, each stop
   carrying a `detail` naming the remaining wallet (`wallet.remaining`).
6. Write `spend-core.test.ts` alongside (test map in Structure) — every branch of both functions.
**Verify:** `bun test src/engine/spend-core.test.ts` green; whole suite green; typecheck clean.
**Commit:** `feat(engine): pure spend-loop decision core — fitNext + shouldContinue (T-024-02)`.

## Step 3 — The impure loop (`src/engine/spend.ts`)
1. Module header (IMPURE shell over the tested core, like `castChain`; engine ⊥ play → the cast
   is injected; NOT unit-tested).
2. Imports (Structure D-list); `export * from "./spend-core.ts";`.
3. `SpendLoopParams<C>` + `spendDown<C>` driving the D5 loop:
   - `fitNext` → `shouldContinue` → break-on-stop → `onStep("start")` → `await castOne` →
     `sumActuals` → `debit` → filter board → push `SpendStep` → `onStep("done")`.
   - accumulate `cleared` (count `outcome === "success"`), build `SessionResult` from the final
     `Continuation`.
4. `sumActuals(result)`: sum steps' `actuals` (tokens via `countTokens`, ms via `wallMs`); lazy
   `loadRunLog` fallback by `runId` for any step missing actuals; missing-everywhere ⇒ 0.
**Verify:** `bun run check:typecheck` clean (the module typechecks against the core + injected
thunks); `bun test` still green (no new test imports the impure module). **Commit:**
`feat(engine): autonomous spend loop driving castChain + wallet debit (T-024-02)`.

## Step 4 — Full gate
`bun run check` (`baml:gen && tsc --noEmit && bun test`) green end to end.

## Testing strategy
- **Unit (the gate): `spend-core.test.ts`.** The only load-bearing branching logic —
  `fitNext`'s first-fit/skip/null and `shouldContinue`'s three stops + precedence — is pure and
  fully covered with fabricated wallets and `priceOf` fixtures. No spawn, no fs, no addon.
- **Not unit-tested: `spend.ts`.** The impure shell, exactly like `castChain`/
  `chain-propose-decompose.ts`: its decision logic is the tested core, its debit is the tested
  wallet (`wallet.test.ts`), its cast is the tested chain. Proven LIVE when T-024-03 injects the
  real `castProposeDecomposeChain` + `recalibrate` and runs `vend work`. `sumActuals` is simple
  summation over the seam; left to the live proof, consistent with the house stance on untested
  impure wiring.
- **Regression:** Step 1 must leave all 789 existing tests green — the seam is additive.

## Verification criteria (map to AC)

| Acceptance criterion | Satisfied by | Verified |
|---|---|---|
| Pure `fitNext` (highest-leverage affordable, or null) + `shouldContinue` (3 stops w/ reason), **unit-tested** on each stop + fits/doesn't-fit boundary | Step 2 — `spend-core.ts` + `spend-core.test.ts` | `bun test src/engine/spend-core.test.ts` |
| `RunSummary` surfaces actuals (usage + wall-clock ms); existing cast path + tests **unaffected** | Step 1 — `cast.ts` additive seam | typecheck + 789 tests still green |
| Impure loop funds→fits→casts(`castChain`)→debits→repeats→stops cleanly, returns structured session result; **never authorizes an unaffordable cast** (P7); andon ends session | Step 3 — `spendDown` (P7 by construction: only a `fitNext` result is cast) | typecheck; live in T-024-03 |
| `bun run check:*` green | Step 4 | `bun run check` |

## Risks & mitigations
- **`exactOptionalPropertyTypes`** would reject `{ actuals: {…}, produced: undefined }` — but it
  is OFF (only `strict` + `noUncheckedIndexedAccess`), and `castPlay` already returns `produced`
  possibly-undefined. No risk.
- **A test asserting `RunSummary` shape exactly** would break on the new field — confirmed none
  does (`chain-core.test.ts` reads `.outcome`/`.produced`, never `toEqual` the whole summary).
- **Engine→play cycle** if the loop imported the real chain — avoided by the injected `castOne`
  (D2); `ChainResult` is imported type-only.
- **`noUncheckedIndexedAccess`** on `result.steps[i]` in `sumActuals` — iterate with `for…of`
  (element is `RunSummary`, not `RunSummary | undefined`), avoiding index access.
