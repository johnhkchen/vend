# Review — T-077-03-01

## Disposition

Pass. The acceptance criterion is met, deterministic tests cover both requested
branches, the full repository gate is green, and the ticket-owned source unit is
committed through Lisa.

## Acceptance review

Criterion:

> When weightedTokens exceeds the token envelope, formatCastProgress renders the
> token fraction with an in-line detect-after marker; a pinned test asserts the
> marker appears over-envelope and is absent under-envelope.

Evidence:

- `formatCastProgress` compares the raw values with
  `state.weightedTokens > opts.tokenEnvelope`.
- The over-envelope suffix is exactly ` (detect-after)`.
- The suffix is composed directly after the token fraction and denomination,
  before the separator introducing the turn segment.
- The pinned over-envelope expected line is
  `elapsed 4m12s · 392k/200k tokens (detect-after) · turn 0/15`.
- The pinned under-envelope expected line is
  `elapsed 4m12s · 199k/200k tokens · turn 0/15`.
- The under-envelope branch additionally asserts that it does not contain
  `(detect-after)`.

Result: met.

## Files changed

### `src/engine/cast-core.ts`

- `formatCastProgress` now composes a named token segment.
- The segment retains the existing humane numerator/denominator formatting.
- The word `tokens` makes the denomination explicit in both normal and overshot
  progress lines.
- A strict raw numeric comparison adds `(detect-after)` only after spend exceeds
  the envelope.
- No exported signature or progress state shape changed.

### `src/engine/cast-core.test.ts`

- Existing exact formatter expectations now include the token denomination.
- A new ticket-pinned regression test covers 392k/200k over-envelope behavior.
- The same test covers 199k/200k under-envelope behavior and explicitly rejects
  the marker there.

### `src/engine/cast.test.ts`

- The existing shell wiring golden now expects `tokens` in each refreshed live
  line.
- No executor, terminal, transcript, or cast implementation changed.
- This update was identified by the full repository gate rather than the initial
  file blueprint and is documented in `progress.md`.

## Architecture review

- Pure core / impure shell is preserved.
- The comparison uses plain values already passed into the formatter.
- No boolean flag or duplicated derivation was added to the shell.
- No envelope state was added to the accumulator.
- No filesystem, clock, network, or terminal effect entered core code.
- Token accounting remains owned by the canonical `countTokens` path.
- Turn accounting and final summary formatting are untouched.
- The executor interface and detect-after settlement contract are untouched.

## Boundary review

- Strict greater-than matches the ticket's `exceeds` wording.
- Equality remains unmarked.
- Raw values drive the marker, so display rounding cannot conceal a real
  overshoot.
- The marker communicates detection after observed spend; it makes no claim of
  prevention.
- The live line is the only runtime presentation behavior changed.
- The final summary line remains out of scope and unchanged.
- The sibling ticket's turn-fraction work remains out of scope and unchanged.

## Test coverage

### Red/green proof

Before implementation, the focused core suite produced three expected failures:
the new token denomination expectations and over-envelope marker were absent.

After implementation:

- 68 core tests passed.
- 0 core tests failed.
- 158 assertions passed.

### Wiring proof

The targeted existing cast wiring test passed after its deliberate golden update:

- 1 passed.
- 0 failed.
- It continues to prove one refreshed line and byte-preserved raw transcript
  messages.

### Repository gate

Final `bun run check` result:

- BAML generation: passed.
- TypeScript `tsc --noEmit`: passed.
- Tests: 1,769 passed, 1 existing guarded integration skipped, 0 failed.
- Assertions: 5,572.
- Test files: 117.

## Commit review

- Commit: `f4fdf60bb09385d5845cda668ec22a585cec928c`.
- Subject: `fix(engine): label live token overshoot detect-after`.
- Commit contains exactly:
  - `src/engine/cast-core.ts`
  - `src/engine/cast-core.test.ts`
  - `src/engine/cast.test.ts`
- Commit was created with `lisa commit-ticket` and exact includes.
- Ticket-owned source paths are clean after commit.
- The ordinary index is empty.
- Concurrent Lisa-managed changes were not included.

## Gaps and open concerns

- There is no live metered cast in this ticket. The story explicitly defines
  pure-formatter proof as the honest boundary, so this is not an acceptance gap.
- Equality does not have a new dedicated formatter assertion. The implementation
  is a direct strict-greater-than expression, and existing budget-core tests pin
  equality as non-exhausted; no ambiguity remains in this small branch.
- Humane rounding can display an over-envelope numerator and denominator as the
  same `k` value near the boundary, but the raw comparison still adds the marker.
  This is intentional and more truthful than comparing display strings.
- Adding `tokens` changes existing under-envelope line bytes. This is intentional
  to match the story's explicit denomination and is covered by both core and
  wiring goldens.

## Final assessment

The change is narrow, pure, and honest about detect-after behavior. It advances
P7 by making a breached live token contract visible at the moment the measured
progress crosses it, without claiming prevention or altering accounting. It
remains local-first and deterministic, with no token spend required for proof.
No blocker remains.
