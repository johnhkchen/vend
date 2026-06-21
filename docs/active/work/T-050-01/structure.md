# T-050-01 — Structure: file-level blueprint

The shape of the code, not the code. One file modified, one test file extended. No new files.

## Files

| File | Change | What |
| --- | --- | --- |
| `src/ledger/recalibrate.ts` | **modify** (append-only, after `formatEnvelopeLabel`, before the T-013-03 bias section) | 2 constants, 2 exported types, 1 exported fn, 1 private helper |
| `src/ledger/recalibrate.test.ts` | **modify** (append a new `describe` block + extend the import list) | unit tests for `fundingEnvelope` + constants |

No changes to `budget.ts`, `run-log.ts`, the CLI, or any caller. This ticket is the PURE CORE only;
threading `fundingEnvelope` into the cast funding path is T-050-02 (a separate ticket, `depends_on`
this one).

## `src/ledger/recalibrate.ts` — additions

Placement: a new section header between `formatEnvelopeLabel` (ends `:180`) and the
`── Reference-class bias correction (T-013-03) ──` header (`:182`). Keeps the funding guard adjacent
to the price it guards, before the unrelated bias-correction half.

### Section comment (mirrors the module's existing banner style)
A ~12-line block: the funding-envelope = guard-≠-price thesis, the censoring-ratchet it breaks, the
IA-14 actuation it represents, and the explicit "does NOT touch `recalibrate`'s envelope / percentile
/ label" invariant. Cross-references `budget.ts`'s `TIMEOUT_HEADROOM` as the wall-clock precedent.

### Constants
```ts
export const MEASUREMENT_HEADROOM = 2;       // ≥2, finite — mirrors budget.ts TIMEOUT_HEADROOM
export const CENSORED_WIDEN_RATE = 1 / 3;    // censored-rate threshold for measured-source auto-widen
```
Each with a doc comment (the `CENSORED_WIDEN_RATE` comment names the IA-14 actuation; the
`MEASUREMENT_HEADROOM` comment points at `TIMEOUT_HEADROOM` and the ratchet rationale).

### Types
```ts
export interface FundingOptions {
  readonly window?: number;      // default DEFAULT_WINDOW — MUST match the recalibrate call's window
  readonly widenRate?: number;   // default CENSORED_WIDEN_RATE
  readonly headroom?: number;    // default MEASUREMENT_HEADROOM
}

export interface FundingResult {
  readonly envelope: Budget;     // the funded guard (≥ priced, per dimension)
  readonly widened: boolean;     // true iff headroom lifted some dimension above its price
}
```

### Private helper
```ts
function fundDimension(priced: number, censoredActuals: readonly number[], headroom: number): number
```
- `floor = censoredActuals.length > 0 ? Math.max(...censoredActuals) * headroom : priced * headroom`
- returns `positiveInt(Math.max(priced, floor))` (reuses the existing module-private `positiveInt`).
- PURE; no record/log knowledge — operates on plain numbers, so it is trivially unit-coverable via
  `fundingEnvelope` (not separately exported, like `medianOrNull`/`positiveInt`).

### Public function
```ts
export function fundingEnvelope(
  play: string,
  records: readonly RunRecord[],
  result: RecalibrateResult,
  opts: FundingOptions = {},
): FundingResult
```
Internal flow (no branches beyond the gate):
1. Resolve `window`/`widenRate`/`headroom` from `opts` ?? constants. `priced = result.envelope`.
2. `rate = sample > 0 ? censored / sample : 0` where `sample = successes + censored` (from
   `result.confidence`). `underCalibrated = result.source === "prior" || rate >= widenRate`.
3. If `!underCalibrated`: `return { envelope: { ...priced }, widened: false }` (back-compat fast path).
4. Re-window censored records:
   `const windowedCensored = forPlay(records, play).slice(-window).filter(r => CENSORED_OUTCOMES.includes(r.outcome))`.
5. `censoredTokens = windowedCensored.map(totalTokens)`;
   `censoredTimes = windowedCensored.map(wallClockMs).filter((ms): ms is number => ms !== null)`.
6. `tokens = fundDimension(priced.tokens, censoredTokens, headroom)`;
   `timeMs = fundDimension(priced.timeMs, censoredTimes, headroom)`.
7. `envelope = { timeMs, tokens }`;
   `widened = envelope.tokens > priced.tokens || envelope.timeMs > priced.timeMs`.
8. `return { envelope, widened }`.

**Reuse:** `forPlay`, `totalTokens`, `wallClockMs`, `CENSORED_OUTCOMES`, `DEFAULT_WINDOW`,
`positiveInt`, `RunRecord`, `Budget`, `RecalibrateResult` — all already in the module/imports. No new
import lines needed (`Budget` is already a type-only import; nothing from `budget.ts`'s runtime).

### Public surface delta (exports added)
`MEASUREMENT_HEADROOM`, `CENSORED_WIDEN_RATE`, `FundingOptions`, `FundingResult`, `fundingEnvelope`.
Nothing renamed, nothing removed — purely additive, so no caller breaks.

## `src/ledger/recalibrate.test.ts` — additions

Extend the existing import from `./recalibrate.ts` to add `fundingEnvelope`, `MEASUREMENT_HEADROOM`,
`CENSORED_WIDEN_RATE` (and reuse the existing `recordOf` / `PRIOR` fixtures + `recalibrate` itself to
build `RecalibrateResult` inputs honestly — feed real recalibrate output into fundingEnvelope rather
than hand-faking the result, so the two stay coupled exactly as production wires them).

New `describe("fundingEnvelope — measurement-funding guard …")` covering every AC bullet:
1. **E-049 shape** — 120k prior, a censored run logging ~265k ⇒ funding ≥ 265k × headroom (tokens),
   `widened: true`.
2. **pure cold-start, no censored history** ⇒ funding == `priced × headroom` both dims, `widened: true`.
3. **trusted-measured + clean** (measured source, 0 censored) ⇒ funding == priced, `widened: false`.
4. **high-censored-rate auto-widen on a `measured` source** ⇒ under-calibrated despite measured;
   funding lifted above priced.
5. **per-dimension independence** — tokens widen while time does not (or vice-versa).
6. **does-not-mutate** — assert `recalibrate`'s returned `envelope` is unchanged after a
   `fundingEnvelope` call (guard ≠ price, AC #2).
7. **positive-int / totality** — empty & degenerate inputs return a valid positive-int `Budget`,
   no throw.
8. **constants** — `MEASUREMENT_HEADROOM >= 2`, `CENSORED_WIDEN_RATE` ≈ 1/3 (documented values).

## Ordering of changes (matters)
1. Constants → 2. types → 3. `fundDimension` → 4. `fundingEnvelope` (depends on 1-3) →
5. tests (depend on all). Within `recalibrate.ts` the additions are self-contained; the file
typechecks at each step because each new symbol only references already-defined ones.

## Verification gates
`bun run check:typecheck` (no `any`, exhaustive types) and `bun run check:test` (the new block +
the full existing suite green — proves the additive change broke nothing). `bun run check` runs both.
