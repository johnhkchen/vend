# Review — T-077-03-02

## Outcome

Pass. The ticket acceptance criterion is met by a committed regression test in the pure live-
progress suite. The test pins that the refreshing turn fraction uses the deduplicated assistant/
model-turn count over `maxTurns` and never uses Claude's larger terminal `num_turns` as that
numerator.

No production behavior changed.

## What changed

### `src/engine/cast-core.test.ts`

Added one test in the existing `cast progress` describe block:

`pins the live turn fraction to deduped agent turns, never executor num_turns (T-077-03-02)`

The test adds 21 lines and reuses the block's existing assistant-message helper and weighted usage
fixture. It requires no new import, helper, type, or dependency.

No source file was created or deleted.

## What the test proves

### The live numerator comes from deduplicated agent turns

The fixture streams:

- assistant message ID `turn-1`;
- a repeated event with the same `turn-1` ID;
- assistant message ID `turn-2`;
- a terminal result.

It reduces those messages through production `accumulateCastProgress`, beginning from
`EMPTY_CAST_PROGRESS`.

The resulting `progress.turns` is asserted to equal two. This would fail if the accumulator counted
raw assistant stream blocks instead of first-seen nested message IDs.

The expected weighted spend is also reflected in the exact line: each unique assistant fixture is
30k weighted tokens, so two unique turns render 60k. The duplicate does not charge or advance twice.

### The live denominator is the effective agent-turn cap

The test supplies `maxTurns = 15` directly to production `formatCastProgress`.

It asserts the complete line:

```text
elapsed 4m12s · 60k/500k tokens · turn 2/15
```

The formatter therefore pairs the accumulator-derived two-turn numerator with the configured
fifteen-turn denominator.

The test separately asserts `progress.turns <= maxTurns`, making the same-unit cap relationship an
explicit property rather than only an implication of string equality.

### Executor `num_turns` remains an unlike counter

The terminal result carries `num_turns: 23`, matching the evidence shape established by dependency
`T-077-01-01`: Claude's terminal conversation-event count may exceed the cap that bounds distinct
assistant/model loop iterations.

The test first asserts `23 > 15`, so the negative oracle is non-vacuous.

It then asserts the live line contains neither:

- compact live-form `23/15`;
- summary-form `23 / 15 cap`.

The first is the meaningful regression shape for `formatCastProgress`; the second carries forward
the literal T-072-04 negative invariant named by this ticket. Exact positive equality already pins
that `2`, not `23`, is rendered.

## Relationship to prior work

`T-072-04-01` repaired and tested the final summary line after diagnosing that Claude's terminal
`num_turns` uses a different unit from `--max-turns`. Its summary test rejects `18 / 15 cap`.

`T-077-01-01` extended that diagnosis to the live impure seam. It showed:

- the decompose play sends `--max-turns 15`;
- sixteen raw assistant events with fifteen distinct IDs accumulate to fifteen agent turns;
- terminal `num_turns: 23` persists as the unlike executor count;
- cap-hit subtype is recorded in the transcript.

This ticket does not repeat that broad shell setup. It converts the established seam facts into a
small pure-formatter regression oracle, which is the exact remaining story slice.

## Pure core / impure shell assessment

The repository boundary is unchanged.

- The test uses plain in-memory `StreamMessage` objects.
- Production pure accumulation derives the live state.
- Production pure formatting derives the live line.
- No filesystem, clock, process, terminal, network, or BAML effect is added.
- No logic is moved into or added to `cast.ts`.
- No executor behavior or counter is reinterpreted.

The terminal result is a negative-control input. The accumulator correctly ignores it for live turn
accounting, and the formatter has no `num_turns` parameter.

## Scope assessment

The change stays inside story `S-077-03`:

- live progress formatter behavior is pinned;
- regression coverage lives in `cast-core.test.ts`;
- no summary-line work is redone;
- no turn cap is changed;
- no turn execution moves into Vend;
- no token accounting changes;
- no cap-hit repair/resume behavior is introduced.

The adjacent live token detect-after label from `T-077-03-01` remains unchanged and its test passes.

## Test coverage

### New focused coverage

The new test covers:

- duplicate assistant stream blocks;
- distinct nested assistant ID counting;
- terminal result with an over-cap external `num_turns`;
- explicit deduplicated-count versus cap comparison;
- exact live progress rendering;
- negative compact live fraction;
- negative summary-style fraction.

### Existing complementary coverage

Existing tests continue to cover:

- accumulator behavior over seven unique IDs and one duplicate;
- malformed, unknown, usage-less, and duplicate messages as total no-ops;
- capped and uncapped live formatting;
- elapsed and token humanization;
- live detect-after token overshoot labeling;
- final summary labeling and defensive anomalous over-cap formatting;
- `resolveTurnsUsed` validation;
- effective max-turn resolution;
- impure `castPlay` option threading, stdout, transcript, and run-log behavior;
- Claude argv construction.

## Verification results

### Focused suite

Command:

`bun test src/engine/cast-core.test.ts`

Result:

- 69 passed;
- 0 failed;
- 164 expectations;
- 1 file;
- exit 0.

### Diff hygiene

`git diff --check -- src/engine/cast-core.test.ts` passed before commit.

The source diff was one test, 21 insertions, with no deletion or formatting churn.

### Authoritative gate

Command:

`bun run check`

Result:

- BAML generation succeeded;
- typecheck succeeded;
- 1,781 tests passed;
- 1 declared skip;
- 0 failed;
- 5,615 expectations;
- 1,782 tests across 117 files;
- exit 0.

The declared skip is the existing acceptance test requiring local `dist/` release artifacts. It is
unrelated to this ticket.

## Acceptance assessment

Ticket criterion:

> A regression test pins that the live progress line pairs the deduped agent-turn count with
> maxTurns (same unit, ≤ cap) and never renders the executor num_turns against the cap — extending
> T-072-04's `not.toContain('N / 15 cap')` invariant from the summary line to the live line.

Assessment:

- Regression test added: met.
- Live `formatCastProgress` exercised: met.
- Numerator derived through production deduplication: met.
- Duplicate assistant ID included: met.
- Deduplicated count asserted: met, two.
- Denominator is `maxTurns`: met, fifteen.
- Same-unit count is at or below cap: met by explicit assertion.
- Executor terminal `num_turns` represented: met, twenty-three.
- Executor count is demonstrably over-cap: met by explicit assertion.
- Exact honest live fraction: met, `turn 2/15`.
- Executor/cap live fraction absent: met, no `23/15`.
- Literal earlier summary-style forbidden form absent: met, no `23 / 15 cap`.
- Full repository gate green: met.
- Source unit committed: met.

## Commit review

Commit:

`1d35d3ac770c690196d9c00acfcfc609f8cb3254`

Message:

`test(engine): pin live turn fraction units`

The commit was created through `lisa commit-ticket` with one exact repository-relative include:

- `src/engine/cast-core.test.ts`.

Commit inspection confirms one file and 21 insertions. No Lisa metadata, ticket markdown, shared
work artifact, or concurrent source path entered the commit.

The owned source path has no staged or unstaged diff after commit. Remaining dirty paths belong to
Lisa/concurrent work and were not disturbed.

## Deviations

No design or scope deviation.

The implementation added one extra negative assertion for the literal spaced summary grammar in
addition to the planned compact live grammar. This directly reflects the ticket wording and does not
change the fixture, source boundary, or production behavior.

## Honest limitations

- This is a pure-core regression. It does not launch the Claude CLI; the dependency characterization
  covers Vend's impure argv and stream seam with a controlled executor fixture.
- The live formatter itself does not contain a defensive over-cap branch like `formatTurnSummary`.
  The test pins the current correct seam where deduplicated assistant turns are the cap-comparable
  unit; anomalous runtime behavior is outside this test-only ticket.
- Claude could change the semantics or shape of `num_turns` in a future release. That would require
  updating executor characterization, but it would not justify silently pairing the field with the
  current cap.
- The test uses two unique turns rather than reproducing the dependency's fifteen-turn fixture. This
  keeps the unit oracle compact; the explicit `<=` property and over-cap external counter preserve
  the acceptance relationship.

## Open concerns

No critical or blocking concern remains for this ticket.

The broader cap-hit outcome/repair behavior remains deliberately assigned to later S-077 work. This
test should not be read as endorsement of that behavior; it only preserves honest live accounting.

## Disposition

Pass. Acceptance is fully met, the exact source unit is committed, and the authoritative gate is
green.
