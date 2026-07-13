# Design — T-077-03-01

## Decision

The live progress formatter must make a detected token overshoot explicit while
preserving the existing accounting, elapsed-time, and turn semantics. The design
decision is where to derive the marker and how to render the token segment.

## Option A — Decide in the impure cast shell

The `onMessage` callback in `src/engine/cast.ts` could compare current weighted
spend with `budget.tokens`, then pass a boolean such as `detectAfter` into the
formatter.

Advantages:

- The shell owns the budget value and could name the state before formatting.
- The formatter would only render a supplied presentation flag.

Disadvantages:

- The formatter already receives both numeric facts required for the decision.
- A boolean would duplicate a derivation that is naturally pure.
- The shell and formatter could disagree if another caller supplies an
  inconsistent flag.
- It expands a ticket that can remain wholly inside the pure core.

Rejected.

## Option B — Add overshoot state to `CastProgress`

`accumulateCastProgress` could accept the envelope or store an overshoot boolean
on progress state as messages arrive.

Advantages:

- Overshoot would be available as accumulated state.
- Rendering would be a direct state lookup.

Disadvantages:

- `CastProgress` currently represents observations from stream messages, while
  the envelope is supplied separately by the caller.
- The fold would need budget configuration, coupling accounting to one display
  concern.
- A stored boolean could become stale if the same progress state is formatted
  against a different envelope.
- It changes more public shape and tests than the acceptance criterion needs.

Rejected.

## Option C — Compare formatted token strings

The formatter could render both token values through `humanProgressTokens`,
parse or compare the results, and append the marker when the displayed numerator
appears larger.

Advantages:

- The condition would visually track the rounded values on screen.

Disadvantages:

- Rounded thousands lose information near the boundary.
- Lexicographic comparison is invalid for numeric magnitudes.
- Parsing display strings back into facts reverses the correct dependency.
- The marker describes actual measured overshoot, not merely visual rounding.

Rejected.

## Option D — Derive overshoot inside `formatCastProgress`

Compare `state.weightedTokens > opts.tokenEnvelope` inside the pure formatter.
Build the token segment from the existing humane values, add the explicit
`tokens` denomination, and append ` (detect-after)` only for a strict overshoot.

Advantages:

- Uses the raw same-numeraire facts already at the pure seam.
- Keeps the impure shell and accumulator unchanged.
- Makes the display rule deterministic and directly unit-testable.
- Avoids new state, flags, or interfaces.
- Preserves the detect-after truth: the marker appears only after observed spend
  has crossed the funded envelope.
- Keeps equality non-overshot because the criterion says `exceeds`.

Chosen.

## Rendering contract

The token segment becomes:

- under envelope: `<spent>/<ceiling> tokens`
- equal to envelope: `<spent>/<ceiling> tokens`
- over envelope: `<spent>/<ceiling> tokens (detect-after)`

Representative complete lines:

- `elapsed 4m12s · 210k/500k tokens · turn 7/15`
- `elapsed 4m12s · 392k/200k tokens (detect-after) · turn 7/15`

The word `tokens` is present in both states. This keeps the fraction's unit
explicit and makes `(detect-after)` read as a qualification of that denomination
rather than of the turn segment.

## Boundary semantics

The condition uses the original numbers:

```ts
state.weightedTokens > opts.tokenEnvelope
```

It does not compare rounded display values. Thus 200,001 against 200,000 is
marked even though both may render as `200k`. This is correct: the display is
humane, while the annotation communicates the actual budget outcome.

Equality is deliberately not marked. `weightedTokens === tokenEnvelope` has
consumed the full contract but has not exceeded it.

Existing normalization in `humanProgressTokens` remains presentation-only.
This ticket does not redefine how non-finite or negative values are interpreted.

## Pure-core shape

Inside `formatCastProgress`:

1. Preserve the existing turn string calculation.
2. Render the spent and ceiling values through `humanProgressTokens`.
3. Append ` tokens` to form the base token fraction.
4. Append ` (detect-after)` when the raw spend is strictly greater than the raw
   envelope.
5. Interpolate that token segment into the unchanged line layout.

No new exported helper is warranted. The rule has one caller-facing surface and
is short enough to remain local to the formatter. A local `tokenProgress` value
keeps the return template readable.

## Test design

Add a pinned formatter test in the existing cast-progress describe block.

The test will provide plain progress states, avoiding executor or terminal
fixtures. It will assert:

- 392,000 weighted tokens against a 200,000 envelope renders
  `392k/200k tokens (detect-after)` in the exact complete line.
- A value below the same envelope renders `... tokens` without the marker.
- The under-envelope output does not contain `(detect-after)`.

The existing 210,000/500,000 fixture expectation must be updated to include the
new explicit `tokens` label. Existing small-unit/hour expectations also change
only at the token segment.

An exact over-envelope string assertion proves placement: the marker is after
the token fraction and before the separator that introduces turns.

## Compatibility and scope control

- `CastProgress` remains unchanged.
- `CastProgressFormat` remains unchanged.
- `accumulateCastProgress` remains unchanged.
- `src/engine/cast.ts` remains unchanged.
- Budget calculation and settlement remain unchanged.
- Transcript serialization remains unchanged.
- Turn formatting remains unchanged.
- Final summary formatting remains unchanged.
- No executor behavior changes.
- No live or metered test is needed.

The visible addition of `tokens` to the under-envelope line is intentional: it
establishes the same explicit denomination used by the required over-envelope
example and keeps the marker semantically attached to token budget detection.

## Verification

Run the focused pure-core test file first, then the repository-wide gate:

- `bun test src/engine/cast-core.test.ts`
- `bun run check`

The focused test proves the ticket behavior. The full gate protects type safety,
generated BAML consistency, and unrelated regressions across the project.
