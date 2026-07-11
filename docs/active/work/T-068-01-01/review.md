# Review — T-068-01-01 confirm-pricing-cost-weights

## Summary

Pinned the canonical cost-weight vector for the four token buckets, confirmed against current
Claude pricing, as the single source every cost-weighted count in E-068 will read. Additive,
pure-constant change plus its unit proof — no behavior altered.

Commit: `f2249c4 feat(budget): pin confirmed COST_WEIGHTS cost-weight vector (T-068-01-01)`

## What changed

| File | Change |
|------|--------|
| `src/budget/budget.ts` | **modified** — added exported `CostWeights` interface + frozen `COST_WEIGHTS` const `{input 1.0, cache_read 0.1, cache_creation 1.25, output 5.0}` with a doc comment citing the per-MTok pricing basis and the model-invariance rationale, placed directly above `countTokens`. |
| `src/budget/budget.test.ts` | **modified** — imported `COST_WEIGHTS`; added a `describe("COST_WEIGHTS")` block (4 tests). |

Work artifacts: research / design / structure / plan / progress / this review in
`docs/active/work/T-068-01-01/`.

No files created or deleted in `src/`. No other module touched. No import added to budget.ts
(purity preserved). No dependency/toolchain change.

## Acceptance criteria

> budget.ts exports a documented COST_WEIGHTS vector {input 1.0, cache_read, cache_creation,
> output} with the pricing basis cited in a comment; a unit test asserts the confirmed values
> (the ratios verified at implement time, not the {0.1/1.25/5} starting guesses).

- ✅ `COST_WEIGHTS` exported from `budget.ts`, `{input 1.0, cache_read 0.1, cache_creation
  1.25, output 5.0}`, `Object.freeze`d, readonly `CostWeights` type.
- ✅ Pricing basis cited in the doc comment — per-MTok Opus 4.8 prices per bucket, the fixed
  cache multipliers (0.1× read, 1.25× write @ 5-min TTL), and the lineup-wide 1:5 output ratio.
- ✅ Unit test asserts the confirmed values — exact vector + numeraire + load-bearing
  relationships + frozen. The ratios were confirmed at implement time (they land exactly on
  the starting guesses; the confirmation is now explicit and re-assertable, not assumed).

## Test coverage

- `bun test src/budget/budget.test.ts` → **24 pass / 0 fail** (20 prior + 4 new).
- `bun run check` (typecheck + lint + format + full suite) → **1571 pass / 0 fail, EXIT=0**.
- The 4 new tests defend, in layers: exact-value pin (drift back to parity or wrong ratios
  fails), relationship pins (plausible-but-wrong numbers that break the economics still fail
  even if the exact test were loosened), numeraire pin, and frozen-singleton.
- Regression: every pre-existing budget suite stayed green → the change is purely additive.

Gaps: none for this ticket's scope. There is deliberately **no** test that the weights are
*applied* — application is `countTokens`/`totalTokens` (T-068-01-02/-03), not this ticket.

## Confirmation record (the ticket's substance)

Ratios to the input token (numeraire = 1.0), confirmed against current Claude pricing:

| bucket | Opus 4.8 $/MTok | ratio | weight |
|--------|-----------------|-------|--------|
| input | $5.00 | — | 1.0 |
| output | $25.00 | 5× input | 5.0 |
| cache_read | $0.50 | 0.1× input | 0.1 |
| cache_creation | $6.25 | 1.25× input (5-min TTL) | 1.25 |

Model-invariant: output = 5× input holds across Opus 4.8 ($5/$25), Sonnet 5 ($3/$15),
Haiku 4.5 ($1/$5), Fable 5 ($10/$50); cache 0.1×/1.25× are fixed API-wide multipliers. This
is why a single pinned constant is correct, not a per-model lookup.

## Open concerns / limitations

- **cache_creation TTL.** The weight uses the 5-min ephemeral write multiplier (1.25×), the
  default the executor uses. A 1-hour-TTL write is 2×, but the ledger's single
  `cache_creation_input_tokens` bucket can't distinguish TTL, so 1.25× is the only
  well-defined canonical choice. Documented in the comment; flagged here for completeness.
- **Precision, not magnitude, is the risk.** The one way this ticket goes wrong is a wrong
  number; mitigated by deriving each weight from a cited per-MTok price and pinning it.
- **Downstream is where the payoff lands.** This vector on its own changes no meter. The
  boilerplate-demo E-008 recompute, the recalibrated p90 envelopes, and the ceiling
  re-denomination all live in T-068-01-02/-03/-04, which read `COST_WEIGHTS`. Those must map
  bucket stem → `Usage` field (`cache_read` → `cache_read_input_tokens`).

## Critical issues needing human attention

None. Additive, gate-green, scope-clean (no `countTokens` edit — respects the S-068-01 wave
that keeps the three consumers on disjoint files).
