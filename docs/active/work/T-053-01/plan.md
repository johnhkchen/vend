# T-053-01 — Plan

Ordered, verifiable steps. One atomic commit (single pure function + its tests). Testing strategy is
unit-only — no live model, all fabricated `RunRecord` fixtures.

## Step 1 — Add the band constants (E1)

In `src/ledger/recalibrate.ts`, after `CENSORED_WIDEN_RATE` (~line 214), export
`FUNDING_FLOOR_TOKENS = 350_000` and `FUNDING_CEILING_TOKENS = 700_000` with doc-comments.
**Verify:** `tsc --noEmit` clean (constants unused yet is fine — they are exported).

## Step 2 — Extend `FundingOptions` (E2)

Add optional `floorTokens?` / `ceilingTokens?` to the interface, doc-commented like `headroom`.
**Verify:** typecheck clean.

## Step 3 — Add the `bandTokens` helper (E3)

Beside `fundDimension`: `bandTokens(tokens, floor, ceiling) = positiveInt(min(ceiling, max(floor,
tokens)))`. **Verify:** typecheck clean.

## Step 4 — Wire the clamp into both return paths (E4 + E5)

Resolve `floor` / `ceiling` from `opts` at the top of `fundingEnvelope`. Band the token dimension at
the measured-clean early return and at the under-calibrated widened return. Keep `widened` computed
on the **un-banded** tokens. `timeMs` untouched in both.
**Verify:** typecheck clean; existing T-050-01 tests still green (the new floor is 350k — every
existing fixture's funded tokens must be re-checked: see Risk below).

## Step 5 — Add the band unit tests (new `describe`, T-053-01)

Import the two new constants. Add the seven cases from structure.md. Exact assertions:

- **below-floor, measured-clean:** 5 success records all small (~1k tokens) → `recalibrate` →
  `source: "measured"`, p90 ≪ 350k; `fundingEnvelope` ⇒ `envelope.tokens === FUNDING_FLOOR_TOKENS`
  (350_000), `widened === false`, `envelope.timeMs === result.envelope.timeMs` (untouched).
- **above-ceiling, self-fund:** cold-start prior + a censored run logging ~400k tokens so
  `400k × headroom(2) = 800k > ceiling` ⇒ `envelope.tokens === FUNDING_CEILING_TOKENS` (700_000),
  `widened === true`. (Mirrors E-051's 733k → capped.)
- **in-band:** construct funding that lands strictly inside the band (e.g. measured p90 ≈ 450k via
  records at ~450k, or opts-narrowed band) ⇒ `envelope.tokens` equals the computed value, unchanged
  by the band.
- **price untouched:** snapshot `{ ...result.envelope }` and `formatEnvelopeLabel(result)` before and
  after `fundingEnvelope(...)`; assert byte-identical (IA-8).
- **wall-clock untouched:** huge time prior / time funding; assert `envelope.timeMs` equals the
  pre-band time value while tokens are banded (band is tokens-only).
- **opts override:** pass `{ floorTokens: 10_000, ceilingTokens: 20_000 }`; a value below 10k floors
  to 10k, above 20k caps to 20k — proves the knobs are wired like the others.
- **constants P7:** `FUNDING_FLOOR_TOKENS` and `FUNDING_CEILING_TOKENS` are finite, positive
  integers, and `FUNDING_FLOOR_TOKENS < FUNDING_CEILING_TOKENS`.

**Verify:** `bun test src/ledger/recalibrate.test.ts` green.

## Step 6 — Full gate + commit

`bun run check` (baml:gen + typecheck + full test suite). Then a single commit:
`feat(T-053-01): clamp fundingEnvelope tokens to rational band [350k,700k]`.

## Testing strategy

- **Unit (this ticket):** all cases above, pure fixtures via `recordOf` / `buildRunRecord`. No fs,
  clock, spawn, or live model. The band is a pure property of `fundingEnvelope` — fully unit-testable.
- **Integration / end-to-end:** explicitly **out of scope** — that is T-053-02 (propose floors at
  350k through the real cast path; decompose caps at 700k; wallet still authorizes on price). This
  ticket only proves the pure clamp.

## Risk — existing T-050-01 fixtures now hit the floor

The new floor (350_000) is large. Existing T-050-01 tests assert exact funded-token values well below
350k (e.g. `264_866 × 2 = 529_732` is above floor and below ceiling — safe; but
`50_000 × 2 = 100_000`, `PRIOR.tokens × 2`, and the small measured-clean cases are **below** 350k).
Those existing assertions will now see the floored value (350_000), so they would FAIL unless
updated.

**Mitigation (decided):** the existing T-050-01 tests assert the *headroom* behavior, which is a
distinct contract from the *band*. To keep them asserting headroom (not the band) cleanly, pass an
explicit wide band via the new opts in the affected existing tests — e.g.
`fundingEnvelope("p", records, result, { floorTokens: 1, ceilingTokens: Number.MAX_SAFE_INTEGER })`
— so those tests continue to prove the headroom math unchanged, while the NEW T-053-01 tests prove
the default band. This keeps each test focused on one contract and avoids coupling the headroom
fixtures to the band default. Document this adjustment in progress.md.

(Alternative considered: rewrite the affected T-050-01 assertions to expect the floored values.
Rejected — it would conflate "headroom lifted the funding" with "the band floored it," losing the
headroom regression signal. The opts-widen keeps the two contracts independent.)

## Definition of done (maps to acceptance criteria)

- [ ] Constants exported; token output clamped to `[floor, ceiling]` as outermost bound.
- [ ] Wall-clock / price / percentile / label / `canAfford` / `fitNext` unchanged.
- [ ] Unit tests: below-floor → 350k, above-ceiling → 700k, in-band → unchanged, price untouched,
      constants finite (P7).
- [ ] `bun run check` green.
