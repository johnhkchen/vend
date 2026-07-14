# T-050-02 — Plan: ordered, verifiable steps

Each step is small, independently checkable, and commit-able. Testing strategy is per step; the
load-bearing proof is the pure E-049 contrast in step 2. No live model anywhere.

## Step 1 — Pure core: `fundedStepDefault` + `CHAIN_DEFAULT_TIER`

`src/play/chain-propose-decompose-core.ts`:
- Add imports: `recalibrate`, `fundingEnvelope`, `type FundingOptions`, `type RecalibrateOptions`
  from `../ledger/recalibrate.ts`; `type RunRecord` from `../log/run-log.ts`; `type ValueTier` from
  `../shelf/menu.ts`. (All addon-free — verify the core test still loads under `bun test`.)
- Add `export const CHAIN_DEFAULT_TIER: ValueTier = "standard"`.
- Add `export function fundedStepDefault(records, play, prior, tier?, opts?)` =
  `fundingEnvelope(play, records, recalibrate(play, records, tier, prior, opts?.recalibrate), opts?.funding).envelope`,
  with the guard-≠-price doc comment.
- Leave `resolveStepBudgets` untouched.

**Verify:** `bun run check:typecheck`. No behavior change yet (new export, no caller).

## Step 2 — Pure core test: the deterministic E-049 proof (AC#4)

`src/play/chain-propose-decompose-core.test.ts`:
- Extend imports: `fundedStepDefault`, `CHAIN_DEFAULT_TIER`, `MEASUREMENT_HEADROOM`, `recalibrate`
  (for the old-path contrast) from the respective modules; `buildRunRecord`/`type RunRecord` /
  `type RunOutcome` from `../log/run-log.ts`. Add a local `recordOf` fixture (mirror
  recalibrate.test.ts).
- New `describe("fundedStepDefault — measurement-funded default rung (T-050-02)")` with the six cases
  from structure.md §test. The headline:
  ```ts
  const prior = { timeMs: 7_200_000, tokens: 120_000 };            // decompose-epic's static default
  const records = [recordOf({ tokens: 60_000 }), recordOf({ tokens: 60_000 }),
                   recordOf({ tokens: 264_866, outcome: "budget-exhausted" })];
  expect(recalibrate("decompose-epic", records, "standard", prior).envelope.tokens).toBe(120_000); // OLD: re-censors
  expect(fundedStepDefault(records, "decompose-epic", prior).tokens).toBe(264_866 * MEASUREMENT_HEADROOM); // NEW: room
  ```

**Verify:** `bun run check:test` (the new block green; full suite still green — additive). This is the
ticket's "deterministic E-049-shaped proof, no live model". **Commit 1** (core + proof):
`feat(ledger): fundedStepDefault — measurement-funded bare-chain default rung (T-050-02)`.

## Step 3 — Chain shell: ledger-read funded defaults

`src/play/chain-propose-decompose.ts`:
- Add imports: `join` (node:path), `loadRunLog` + `DEFAULT_RUN_LOG_PATH` (../log/run-log.ts),
  `fundedStepDefault` (alongside `resolveStepBudgets`).
- Add private `async stepDefaults(root, opts): Promise<[Budget, Budget]>` with the `defaultUnused`
  short-circuit (skip the ledger when a uniform `--budget` or both per-step overrides are present —
  the `vend work` path stays byte-for-byte) and the funded path otherwise.
- In `castProposeDecomposeChain`: compute `root` first, then
  `const [proposeDefault, decomposeDefault] = await stepDefaults(root, opts)` and feed them to
  `resolveStepBudgets(opts, proposeDefault, decomposeDefault)`. Update the inline comment.

**Verify:** `bun run check:typecheck` + full `bun run check:test` (the shell isn't unit-tested; the
suite proves nothing else broke). No new test (impure shell; its logic is the step-2 pure proof).

## Step 4 — work.ts: price/funding split + thread funding into the cast

`src/play/work.ts`:
- Add `fundingEnvelope` to the `../ledger/recalibrate.ts` import.
- Keep the full per-step `RecalibrateResult`s; `price = sumBudgets(proposeResult.envelope,
  decomposeResult.envelope)` (honest, gates the wallet — unchanged).
- Compute `proposeFunding`/`decomposeFunding` via `fundingEnvelope`.
- Thread `proposeBudget: proposeFunding` / `decomposeBudget: decomposeFunding` into
  `castProposeDecomposeChain`; leave `priceOf: () => price` unchanged. Update the comment block.

**Verify:** `bun run check` (typecheck + full suite + lint/format). **Commit 2** (the threading):
`feat(work): fund each cast under fundingEnvelope while the quote stays the honest p90 (T-050-02)`.

## Step 5 — Full gate + invariant audit

- `bun run check:*` all green (AC#5).
- Diff audit for IA-8 (AC#2): confirm `price`, `sumBudgets`, `priceOf`, `budgetForTier`,
  `formatEnvelopeLabel`, and affordability are textually UNCHANGED — only the cast's run-guard widened.
- P7 + back-compat (AC#3): confirm `spendDown`/wallet/`debit` untouched (still debits actuals,
  finite headroom); the step-3 well-calibrated test proves funding == price.

## Testing strategy summary

| AC | Proof | Where |
| --- | --- | --- |
| #1 funding threaded into the default rung AND work.ts; override wins | `fundedStepDefault` widens the default; `resolveStepBudgets` override-wins case; work.ts threads funding (inspection) | core test + diff |
| #2 price stays honest (IA-8) | sibling `recalibrate(...).envelope` unchanged after a funding call; `price`/label/affordability diff-clean | core test + diff |
| #3 P7 finite + back-compat | well-calibrated ⇒ funding == price (core test); `spendDown`/`debit` untouched | core test + diff |
| #4 deterministic E-049 proof, no live model | OLD 120k vs NEW 264_866×2 contrast | step-2 core test |
| #5 `bun run check:*` green | full gate | step 5 |

## Commit cadence

Two atomic commits: (1) pure core + deterministic proof (green in isolation); (2) the two impure-shell
threadings (proven by the green core + full suite). Each leaves the tree green.

## Rollback / risk

- If the bare-chain cold-start doubling proves undesirable downstream, the headroom is a single
  `opts.funding.headroom` away from tuning, and `fundedStepDefault` is the one chokepoint.
- The shell's `defaultUnused` guard is the back-compat safety: any path that already passes a budget
  never touches the ledger, so the only behavior delta is the bare `vend chain`/`vend run` default.
