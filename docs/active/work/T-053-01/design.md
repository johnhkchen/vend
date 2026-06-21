# T-053-01 — Design

Decide HOW to clamp `fundingEnvelope`'s token output to `[350_000, 700_000]`, grounded in the
research. One decision per axis, with rejected alternatives.

## Decision 1 — Where the clamp lives: a `bandTokens` helper applied at BOTH return points

`fundingEnvelope` has two exits: the trusted-measured early return (`{ ...priced }`, line 275) and
the under-calibrated widened return (line 294). The band is the OUTERMOST bound and must apply to
**both** — the dogfood failure (propose, p90 ~170k, `source: "measured"`, clean) takes the
trusted-measured path, and 170k < 350k must still floor to 350k. If the clamp only wrapped the
widened path, the exact failure the epic exists to fix would slip through.

**Chosen:** a tiny pure helper

```ts
function bandTokens(tokens: number, floor: number, ceiling: number): number {
  return positiveInt(Math.min(ceiling, Math.max(floor, tokens)));
}
```

applied to the `tokens` dimension at each return, leaving `timeMs` untouched:

- measured path: `return { envelope: { timeMs: priced.timeMs, tokens: bandTokens(priced.tokens, …) }, widened }`
- widened path: clamp the `tokens` computed by `fundDimension` before building the envelope.

`min(ceiling, max(floor, tokens))` is the ticket's exact formula; `positiveInt` keeps the
budget-dimension contract uniform (the inputs are already positive ints, so it is a no-op in
practice, but it documents the contract and is the reused primitive the ticket names).

**Rejected — clamp inside `fundDimension`:** `fundDimension` funds ONE dimension generically and is
called for BOTH tokens and time. Banding inside it would clamp wall-clock too, violating the strict
tokens-only scope. Reject.

**Rejected — clamp only at a single unified exit (refactor to one return):** would require
restructuring the early-return control flow. The early return is load-bearing for back-compat
clarity ("a well-calibrated play is unchanged"). A two-site clamp via a shared helper is smaller and
keeps the existing shape. Reject.

**Rejected — clamp at the call sites in `work.ts` / `resolveStepBudgets`:** spreads the policy across
files, breaks "no new wiring," and the band would not be unit-testable as a pure property of
`fundingEnvelope`. The ticket explicitly localizes the change to `fundingEnvelope`. Reject.

## Decision 2 — Constants beside the existing knobs, overridable via `opts`

```ts
export const FUNDING_FLOOR_TOKENS = 350_000;
export const FUNDING_CEILING_TOKENS = 700_000;
```

placed beside `MEASUREMENT_HEADROOM` / `CENSORED_WIDEN_RATE` (the funding sub-module), with matching
doc-comments. Add two optional `FundingOptions` fields — `floorTokens?` / `ceilingTokens?` —
defaulting to the constants, mirroring how `window` / `widenRate` / `headroom` already work. This
satisfies "Overridable via the existing `opts` for tests, like the other knobs" and lets unit tests
drive small synthetic bands without 350k-scale fixtures where convenient (though we will also test at
real scale).

**Rejected — hard-coded literals, no `opts`:** the ticket says overridable via opts like the other
knobs; the other three knobs all have opts fields. Consistency wins. Reject.

**Rejected — a single `band: [floor, ceiling]` tuple option:** the module's style is flat scalar
knobs (`window`, `widenRate`, `headroom`), not structured tuples. Match the house style. Reject.

## Decision 3 — `widened` is computed BEFORE the band, on the headroom signal only

The ticket: "The `widened` flag stays whatever the existing logic sets (the floor/ceiling are bounds,
not the headroom signal)." So `widened` keeps its current meaning — "did `max(priced, censored ×
headroom)` lift a dimension strictly above its price." The band must NOT change `widened`:

- On the measured-clean path, `widened` stays `false` even when the floor lifts 170k → 350k. The
  floor is a band bound, not headroom actuation. (An honest funding *label* downstream could note
  "floored," but that is out of this ticket's scope — `widened` semantics are preserved.)
- On the widened path, compute `widened` from the pre-band `fundDimension` outputs vs price (exactly
  as today), THEN band the token number for the returned `envelope`.

This means: band is applied to the `envelope.tokens` value, but the `widened` boolean is derived from
the un-banded comparison. Concretely on the widened path, keep the current
`widened = envelope.tokens > priced.tokens || envelope.timeMs > priced.timeMs` computed on the
**unbanded** tokens, then replace `envelope.tokens` with its banded value for the return.

**Edge note:** if the ceiling caps a runaway (733k → 700k) but 700k is still > price, `widened` stays
true — correct, headroom did lift it. If the floor raises a measured 170k → 350k on the clean path,
`widened` stays false — correct, no headroom was applied. Both align with the ticket.

**Rejected — recompute `widened` after the band:** would flip the measured-floor case to `widened:
true`, redefining the headroom signal. The ticket forbids this. Reject.

## Decision 4 — Wall-clock strictly untouched

`timeMs` flows through unchanged on both paths. No band, no new clamp. The ticket's "Strict scope (do
NOT touch the WALL-CLOCK dimension)" and E-038's time headroom both demand this. Verified by a test
asserting a huge-time / banded-token case leaves `timeMs` at its E-038-headroom value.

## Decision 5 — Price / percentile / label / authorization untouched

No change to `recalibrate`, `percentile`, `formatEnvelopeLabel`, `canAfford`, or `fitNext`. The band
is a strict post-processor on the funding `envelope.tokens` only. A test snapshots
`result.envelope` and `formatEnvelopeLabel(result)` across a `fundingEnvelope` call to prove the
price side is byte-identical (IA-8).

## Behavior table (the proof obligations)

| Case | priced.tokens | computed funding | banded result | widened |
|------|--------------|------------------|---------------|---------|
| below-floor, measured-clean (the propose dogfood) | ~170k | 170k (verbatim) | **350k** | false |
| below-floor, cold-start | small | priced×2 still <350k | **350k** | true (headroom) |
| in-band | 450k | 450k | **450k** (unchanged) | per path |
| above-ceiling, self-fund (E-051 decompose) | — | ~733k | **700k** | true |
| wall-clock | any | any | unchanged | — |

## Totality / P7

`bandTokens` is total: finite inputs → finite output in `[floor, ceiling]`, coerced positive-int.
Constants are finite positive ints (P7). No new failure modes; no fs/clock/process.
