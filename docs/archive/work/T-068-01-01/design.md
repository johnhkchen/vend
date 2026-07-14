# Design — T-068-01-01 confirm-pricing-cost-weights

## Decision

Add one exported, frozen constant to `budget.ts`:

```ts
export const COST_WEIGHTS = {
  input: 1.0,
  cache_read: 0.1,
  cache_creation: 1.25,
  output: 5.0,
} as const;
```

with a doc comment citing the pricing basis, plus a unit test in `budget.test.ts` asserting
the four confirmed values (and their key relationships). `countTokens` is left untouched —
its cost-weighted rewrite is T-068-01-02.

## The confirmed weights (and why exactly these)

Ratios are to the input token (the numeraire, weight 1.0):

- **output = 5.0** — every current Claude model prices output at 5× input (Opus $5/$25,
  Sonnet 5 $3/$15, Haiku 4.5 $1/$5, Fable 5 $10/$50). The ratio is lineup-wide, not
  Opus-specific.
- **cache_read = 0.1** — cache reads bill at ~0.1× base input, a fixed API-wide multiplier.
- **cache_creation = 1.25** — cache writes bill at 1.25× base input at the default 5-minute
  ephemeral TTL (the TTL the executor uses). The 1-hour TTL write is 2×, but the ledger's
  single `cache_creation_input_tokens` bucket does not distinguish TTL, so the canonical
  weight is the default-TTL multiplier.

Because the vector is *ratios to input*, and the whole lineup shares the 1:5 input:output
ratio and the fixed cache multipliers, the vector is **model-invariant**: a future executor
swap does not move it. This is why a single pinned constant is correct rather than a
per-model table.

## Options considered

### A. Frozen object keyed by bucket stem — CHOSEN

`COST_WEIGHTS = { input, cache_read, cache_creation, output } as const`, `as const` giving a
readonly literal type; optionally `Object.freeze` for runtime immutability.

- **For:** A consumer weights a bucket by name (`w.cache_read * usage.cache_read_input_tokens`)
  — no positional coupling, self-documenting, matches the `Usage` sub-count stems. Pure
  literal, keeps budget.ts free of imports/fs/clock. Trivially unit-pinnable.
- **Against:** Keys (`cache_read`) differ from the full `Usage` field names
  (`cache_read_input_tokens`); the consumer maps stem→field. Acceptable — the AC names the
  vector with exactly these short stems, and the mapping is one obvious line in the consumer.

### B. Tuple `[1.0, 0.1, 1.25, 5.0]` — REJECTED

Positional. A consumer must remember index order; a reordering is a silent, type-clean bug.
The AC lists the buckets by name, not position — an object honors that. Rejected.

### C. Per-model lookup `Record<ModelId, Weights>` — REJECTED

The research shows the ratios are model-invariant across the current lineup, so a per-model
table adds a config surface with no varying data — dead generality. budget.ts is
deliberately seam-agnostic and knows nothing about model IDs (it never imports the executor);
threading a model id in to select weights would break that. If a future model ever breaks the
1:5 / 0.1 / 1.25 pattern, that is a new ticket with real data behind it, not speculative
scaffolding now (respects the "no premature abstraction" house rule). Rejected.

### D. Keep the guesses unverified / hardcode inside a future `countTokens` — REJECTED

The AC requires the vector exported and documented with the pricing basis cited, and the
ratios *confirmed at implement time*. Confirmation happens to land on the starting figures,
but the ticket's value is precisely making that confirmation explicit and re-assertable —
burying the numbers inside the (not-yet-written) `countTokens` would defeat both the "single
source every cost-weighted count reads" goal and the unit-pin. Rejected.

## Immutability: `as const` + `Object.freeze`

- `as const` — compile-time: the type becomes `{ readonly input: 1; ... }`, so a consumer
  can't reassign a weight and the literal values are part of the type.
- `Object.freeze` — runtime: a defensive freeze so a torn consumer can't mutate the shared
  singleton. The module already uses `Object.freeze` for its record singletons (run-log
  pattern) and budget.ts values are shared read-only; freezing is cheap insurance and costs
  nothing in purity. Chosen: apply both.

## Where the pricing basis lives

A doc comment directly above `COST_WEIGHTS`, citing: the numeraire (input = 1.0), the Opus
4.8 per-MTok prices the ratios derive from, the fixed cache multipliers (0.1× read, 1.25×
write @ 5-min TTL), and the model-invariance note (output = 5× input lineup-wide). This is
the "pricing basis cited in a comment" the AC demands, and it lets a future reader re-verify
against a pricing page without re-deriving.

## Test design

In `budget.test.ts`, a new `describe("COST_WEIGHTS")` block asserting:

1. The exact confirmed vector `{ input: 1.0, cache_read: 0.1, cache_creation: 1.25, output: 5.0 }`
   — the "unit test asserts the confirmed values" requirement, and the guard against silent
   drift back toward parity (all-1.0) or toward the wrong ratios.
2. The load-bearing *relationships* the accounting depends on, so a future edit that keeps
   plausible-looking numbers but breaks the economics still fails: `output` is 5× `input`;
   `cache_read` is far below `input` (the whole point — cached context is cheap);
   `cache_creation` sits just above `input`.
3. `input === 1.0` (the numeraire is fixed — other weights are ratios to it).

Optionally assert the object is frozen. Fabricated-input, pure-module style, matching the
existing `TIMEOUT_HEADROOM` constant-pinning test.

## Grounding

Every claim traces to Research: the bucket shape (budget.ts:30-35), the parity sum this
feeds (budget.ts:117-124), the confirmed prices (claude-api skill table + prompt-caching
economics), and the test conventions (budget.test.ts:12-14, 58-62). No live cast, no
history rewrite — fixture/unit-proven and FREE, per S-068-01's honest boundary.
