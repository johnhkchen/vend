# Review — T-082-02-02 quota-fraction lane heat

## Final assessment

Pass. The ticket acceptance is met, ticket-owned source is committed through Lisa, and the required
repository gate is green. Learned ledgers now select the unique lane with the lowest current quota
fraction and record readable learned-window provenance. Incomplete capacity evidence retains the
exact E-071 relative-burn fallback without inventing quota.

## Change summary

Two Lisa transactions landed three ticket-owned source paths:

```text
cc2ab42 feat(play): rank learned lane quota fractions
752650b test(engine): prove quota reason ledger propagation
```

### Modified `src/play/lane-heat.ts`

The exported interface remains:

```ts
inferDefaultSeat(records: readonly RunRecord[]): InferredSeat | null
```

The function now has two evidence rungs:

1. Learned quota fraction when every canonical known lane is learned.
2. E-071 relative recent burn when any lane is unlearned.

The learned rung:

- consumes `learnLaneCapacities(records)`;
- narrows the predecessor's discriminated union explicitly;
- sorts a copy by unclamped `quotaFraction`;
- chooses only a unique minimum;
- returns `null` for a tied minimum;
- renders every lane in canonical order;
- rounds only the display percent, not the ranking value;
- keeps fractions above 100% visible;
- returns the established frozen `{ seat, reason }` shape.

The fallback rung retains:

- the final 100 append-ordered records;
- cost-weighted `totalTokens` burn;
- unknown-seat filtering;
- extrema ambiguity checks;
- the 2x hot-lane threshold;
- exact zero-comparison wording;
- exact existing reason concatenation;
- the existing frozen return value.

### Modified `src/play/lane-heat.test.ts`

The nine E-071 tests remain unchanged. Five learned-path tests were added over fabricated normalized
records carrying cap markers:

- quota ordering contradicts and overrules raw burn;
- symmetric learned ranking;
- equal fraction ambiguity;
- partial-learning fallback with exact relative reason;
- above-cap fraction preservation.

### Modified `src/engine/cast.test.ts`

A fabricated learned-window ledger now drives the real decompose effect and cast settlement path. The
test proves:

- quota selection stamps the materialized tickets;
- the exact returned reason becomes `seatInferred.reason`;
- run-log revival preserves it unchanged;
- no unrelated default marker appears.

No production consumer required modification.

## Policy review

### All-lanes-learned guard

This is the safe interpretation of the predecessor contract. An unlearned value carries no numeric
fraction by design. Treating it as zero would invent perfect availability; treating it as one would
invent exhaustion; excluding it would silently remove a canonical lane from comparison. The relative
fallback is the only existing policy that can evaluate a partially observed registry without a fake
denominator.

The resulting dormancy is honest and explicitly anticipated by the story: real quota routing begins
only after sufficient local cap evidence exists for every lane.

### Unique-minimum ranking

Smaller fraction means more learned-window headroom. A unique minimum is therefore sufficient to
select a default. Tied hotter lanes do not make the coolest lane ambiguous, while a tied minimum does.
The implementation does not let registry order decide equal headroom.

### No 2x threshold on learned fractions

The 2x threshold remains appropriate for raw burn, which lacks a denominator. It is not carried to
the learned path because normalized quota fractions supply the comparison that E-071 lacked. Applying
the raw ratio rule after normalization would leave near-cap routing dormant in many cases and conflict
with the ticket's request to rank by quota fraction.

No new percentage threshold was invented.

### Unclamped evidence

The predecessor deliberately exposes values greater than one. The ranking uses those original values,
and provenance can say `~120%`. This avoids erasing overage, creating false 100% ties, or weakening the
local evidence.

## Provenance review

The acceptance fixture produces exactly:

```text
learned quota fraction: claude at ~85% of learned window; codex at ~20% of learned window; routing to codex
```

This contains the ticket's named phrase:

```text
claude at ~85% of learned window
```

The percent is a stable `Math.round(fraction * 100)` display. The `~` marks that presentation rounding.
The reason lists every known lane in registry order and explicitly names the selected lane.

The integration test proves the string is not reconstructed downstream. It crosses:

```text
lane-heat return
  -> decompose effect response
  -> cast settlement
  -> run-log normalization
  -> serialized terminal ledger row
  -> run-log revival
```

with exact equality.

## Compatibility review

The ticket's compatibility demand has two layers, both covered:

1. Every pre-existing pure lane-heat test remains present and unchanged.
2. The existing cast integration test still asserts the exact old relative reason.

No-cap ledgers cause at least one `unlearned` capacity fact, so they execute the private relative helper.
That helper is the prior exported body moved intact. Its stable reason remains:

```text
recent cost-weighted burn (last 100 records): claude=300 vs codex=100; 3x hotter
```

The existing both-cool, explicit-agent override, and chain cases also remain green.

## Test coverage

### Focused pure coverage

```text
bun test src/play/lane-heat.test.ts
14 pass
0 fail
26 expect() calls
```

The key non-coincidental fixture has:

```text
raw burn:       claude 185, codex 1200  -> old policy would choose claude
quota fraction: claude 85%, codex 20%   -> new policy chooses codex
```

This proves the learned denominator controls ranking.

### Focused integration coverage

```text
bun test src/engine/cast.test.ts
28 pass
0 fail
288 expect() calls
```

The new test uses no live model, provider, or paid token work. It uses the established BAML-free play
fixture while exercising real effect, materialization, settlement, and ledger code.

### Build coverage

```text
bun run build
tsc --noEmit
pass
```

This covers readonly union narrowing and public signature compatibility.

### Full repository gate

```text
bun run check
BAML generation: pass
TypeScript: pass
1978 tests pass
1 expected skip
0 tests fail
6495 assertions
```

The expected skip is the established real-dist acceptance case when `dist/` artifacts are absent.

## Acceptance checklist

- Learned capacity present causes quota-fraction ranking: pass.
- Ranking can disagree with relative raw burn: pass.
- The unique lower fraction is selected: pass.
- Equal learned fractions do not create an incidental default: pass.
- Above-cap fractions remain unclamped: pass.
- Reason says `claude at ~85% of learned window`: pass.
- Reason names the other learned fraction and selected lane: pass.
- Exact reason flows verbatim into `seatInferred`: pass.
- Run-log revival preserves the exact marker: pass.
- Unlearned capacity never receives an invented fraction: pass.
- Partially learned registry uses relative fallback: pass.
- Pre-existing lane-heat suite passes unchanged: pass.
- Existing exact relative cast reason remains green: pass.
- Full `bun run check` is green: pass.
- Ticket-owned source is committed through exact Lisa includes: pass.
- Ticket-owned source paths are clean: pass.

## Scope audit

In scope and changed:

- lane-heat inference policy;
- colocated pure tests;
- cast integration test.

Explicitly unchanged:

- capacity learning semantics;
- ledger schema and serialization production code;
- decompose-effect production code;
- cast production code;
- budget/wallet spend algebra;
- executor selection or dispatch;
- materialization behavior;
- known-seat registry;
- provider interaction;
- runtime interception or rerouting.

The ticket did not modify historical ledger rows or fetch remote quota data.

## Commit and worktree review

Pure policy commit exact includes:

```text
src/play/lane-heat.ts
src/play/lane-heat.test.ts
```

Integration proof commit exact include:

```text
src/engine/cast.test.ts
```

All three are clean at Review.

The remaining worktree entries belong to Lisa orchestration/publication and were not included:

```text
M  .lisa/provenance.jsonl
M  docs/active/tickets/T-082-02-02.md
?? docs/active/work/T-082-02-02/
```

The worker did not update phase/status or write phase artifacts directly to the shared path.

## Honest limitations

- Quota routing requires learned capacity for every canonical lane.
- A lane requires at least two usable cap observations and positive intervening burn to learn.
- Current fraction is ledger-as-of, not wall-clock-live.
- Percentage provenance is rounded to an integer for display.
- Capacity means, cadence, and sample treatment remain the predecessor ticket's simple model.
- Exact floating-point equality defines a fraction tie; no epsilon or confidence band is claimed.
- The function chooses the lower learned fraction even when both values are low or close; the ticket
  asks for ranking and defines no additional threshold.
- Real repository quota behavior remains dormant until live cap markers accrue, by story design.

These are declared boundaries, not hidden acceptance failures.

## Open concerns

No blocking concern.

A future policy ticket may decide whether statistically close learned fractions need hysteresis or a
confidence threshold. That would be a new product rule and should not be inferred into this ticket.
Likewise, quota-denominated counter envelopes and runtime cap rerouting remain explicitly deferred.

## Final disposition rationale

The implementation closes the named supervision gap with local, sourced quota evidence; preserves
the honest unlearned fallback; proves provenance through the real ledger path; stays inside the story
scope; and passes every required gate. The correct disposition is `pass`.
