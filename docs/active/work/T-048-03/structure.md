# T-048-03 — Structure: file-level shape of the audit

> The blueprint. What is created, what is touched, what is explicitly NOT touched.
> For an audit this is deliberately small.

## Files created

### `docs/active/work/T-048-03/audit.md` (primary deliverable)
The coverage note. Sections:
1. **Gate result** — `bun run check` outcome: pass/fail, test count, expect() count,
   file count, wall-clock. (Captured: 1127 pass / 0 fail / 3026 expect / 77 files.)
2. **IA-8 coverage table** — each contract behavior → covering `describe`/`test` (by
   name) or "gap". Columns: behavior · denomination · covering test · status.
3. **Back-compat anchor call-out** — the explicit statement of whether the current
   per-cast `debit` both-denomination behavior is pinned (it is), naming the test that
   serves as the anchor `debitWave([oneActual])` must equal for a single-node wave.
4. **Gaps & findings** — the one documented-but-untested behavior (`canAfford`
   non-finite safe-refuse) and the disposition (closed via additive test, or flagged).
5. **Conclusion** — green, contract covered, T-048-01 may proceed on solid ground.

### (Optional, Option B) addition to `src/budget/wallet.test.ts`
A single `describe`/`test` block (test-only — NOT a new file, NOT production code)
pinning `canAfford`'s non-finite safe-refuse. Placed adjacent to the existing
`canAfford` block to keep related assertions together. Shape:

```ts
describe("canAfford — non-finite predicted (documented safe-refuse)", () => {
  const w = allocate(macro(30_000, 100_000));
  test.each([Infinity, NaN])("refuses a non-finite predicted timeMs: %p", (t) => {
    expect(canAfford(w, macro(t, 10_000))).toBe(false);
  });
  test.each([Infinity, NaN])("refuses a non-finite predicted tokens: %p", (n) => {
    expect(canAfford(w, macro(10_000, n))).toBe(false);
  });
});
```

Uses only already-imported symbols (`allocate`, `canAfford`, `macro`) — no new imports.

## Files modified

- **None in production.** `src/budget/wallet.ts` is **NOT touched** (audit constraint).
- `src/budget/wallet.test.ts` — modified ONLY if Option B's test is added (test-only).

## Files deleted

- None.

## Module boundaries / interfaces

- No public interface changes. `Wallet`, `allocate`, `canAfford`, `debit`,
  `DebitResult`, `remaining`, `formatWallet` keep their exact signatures.
- The optional test imports nothing new; it exercises the existing `canAfford` surface.

## Ordering of changes

1. (Already done in Research) read `wallet.ts` + `wallet.test.ts`; run `bun run check`.
2. (Implement) If Option B: add the characterization test; re-run `bun run check`;
   confirm still green with the new test counted.
3. (Implement) Write `audit.md` with the final, verified numbers.
4. (Review) Write `review.md`.

## What "done" looks like structurally

- `docs/active/work/T-048-03/audit.md` exists with the coverage table + gate result.
- The acceptance criteria each map to a section of `audit.md`.
- At most one test-only edit to `wallet.test.ts`; zero edits to any `*.ts` under `src`
  that is not a test file.
- `bun run check` green (re-verified after any test addition).
