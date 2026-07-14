# Design — T-077-03-02

## Goal

Add one regression test that makes the live turn-fraction contract explicit:

- the numerator is the deduplicated assistant/model-turn count;
- the denominator is the effective `maxTurns` cap;
- the resulting numerator does not exceed that cap in the characterized fixture;
- Claude's larger terminal `num_turns` never appears as the numerator of that live fraction.

The current runtime behavior already satisfies this contract. The design therefore favors a
test-only change that observes existing public pure functions without modifying production code.

## Decision drivers

1. Match the ticket's exact live-line acceptance wording.
2. Extend the earlier summary-line negative invariant to `formatCastProgress`.
3. Use the factual counter distinction established by `T-077-01-01`.
4. Exercise deduplication rather than merely supplying a precomputed turn count.
5. Keep the test deterministic, addon-free, and local to the pure core.
6. Avoid duplicating the broad impure-shell characterization already in `cast.test.ts`.
7. Make a future regression from `progress.turns` to executor `num_turns` fail clearly.

## Option A — Assert only an exact formatter string from a hand-built state

Construct a `CastProgress` value with `turns: 15`, call `formatCastProgress` with `maxTurns: 15`,
and assert the output ends in `turn 15/15`.

### Advantages

- Minimal code.
- Directly exercises the live formatter.
- Provides a stable exact-string oracle.

### Disadvantages

- Does not prove where the numerator came from.
- Does not include or contrast executor `num_turns`.
- Does not pin deduplication, which is part of the acceptance language.
- A test reader could not tell whether `15` represents assistant turns, raw stream events, or an
  arbitrary authored number.

### Assessment

Insufficient on its own. It checks formatting but not the same-unit relationship named by the
ticket.

## Option B — Add another broad `castPlay` integration test

Repeat the dependency fixture in `src/engine/cast.test.ts`, run a decompose-shaped cast, capture
stdout, and assert the live refreshing line contains `turn 15/15` rather than `turn 23/15`.

### Advantages

- Covers the impure call site and stdout control characters.
- Demonstrates the end-to-end live surface.
- Exercises option threading into both formatter and executor.

### Disadvantages

- Duplicates the completed `T-077-01-01` integration test, which already captures stdout and rejects
  `23 / 15 cap` on the final surface.
- Requires temporary directories, transcript/run-log writes, executor injection, parsing, gates,
  and output capture unrelated to this ticket's narrow formatter contract.
- The story explicitly names regression tests in `cast-core.test.ts`.
- Larger setup makes the unit distinction less visible.
- Failure output would be noisier than a pure-core assertion.

### Assessment

Rejected. The integration seam is already characterized; this ticket asks for a focused live-line
regression.

## Option C — Reuse a result-bearing stream fixture and reduce it through the accumulator

Build an in-memory message fixture with:

- multiple assistant stream records;
- a duplicate nested assistant `message.id`;
- a terminal result carrying a larger `num_turns` value;
- an effective cap smaller than the terminal `num_turns` but at least the deduplicated turn count.

Reduce the fixture through `accumulateCastProgress`, then call `formatCastProgress` with the reduced
state and cap. Assert the deduplicated count, its cap relationship, the exact live line, and the
absence of the forbidden executor-count fraction.

### Advantages

- Exercises both halves of the live pure path: accumulation and formatting.
- Makes duplicate raw events observable while deriving the numerator through production code.
- Places unlike counters in one fixture without asking the formatter to accept an invalid input.
- Directly extends `not.toContain("N / 15 cap")` to the live line.
- Remains deterministic and fast.
- Fits the existing `cast progress` describe block and helper style.

### Disadvantages

- The terminal result is deliberately ignored by the accumulator, so the test must retain the
  executor count in a clearly named local value for the negative assertion.
- A very small fixture is less evidence-shaped than the 16-event/15-ID dependency fixture.
- A full 15-turn literal fixture could add visual bulk to the test.

### Assessment

Chosen. It most directly proves the acceptance criterion at the requested layer.

## Option D — Change the production formatter to accept executor `num_turns`

Extend `CastProgressFormat` with an executor counter and add defensive selection logic inside
`formatCastProgress`.

### Advantages

- Could make the unit distinction explicit in the formatter signature.
- Could support additional labels on the live surface.

### Disadvantages

- Introduces production behavior and API changes where no defect currently exists.
- Makes an unlike counter available to a formatter that intentionally does not need it.
- Increases the chance of the exact regression the ticket guards against.
- Violates the story's honest boundary: regression test, not counter rewrite.
- Requires call-site threading and broader tests without any user-facing benefit.

### Assessment

Rejected as unnecessary and counterproductive.

## Chosen fixture shape

Use a compact evidence-shaped fixture in the existing `cast progress` describe block.

The fixture will contain:

- one assistant event for `turn-1`;
- the same `turn-1` assistant event again, representing repeated stream blocks;
- one assistant event for `turn-2`;
- a terminal result with `num_turns: 23`.

Use `maxTurns = 15`.

This establishes three different observable numbers:

- four raw fixture events;
- two distinct assistant/model turns;
- twenty-three executor conversation events.

Only the second belongs over the cap. The expected turn segment is `turn 2/15`.

The smaller fixture preserves the relevant semantics without duplicating fifteen nearly identical
assistant objects from the integration characterization. The dependency review supplies the larger
realistic evidence shape; this pure test supplies the narrow regression oracle.

## Assertions

The test will make each part of the contract separately legible.

### Deduplication assertion

Assert `progress.turns === 2`.

This fails if repeated blocks for the same nested message ID are counted twice.

### Same-unit/cap assertion

Assert `progress.turns <= maxTurns`.

This states the acceptance condition directly instead of relying only on the rendered string.

### External counter contrast

Retain `executorNumTurns = 23` and assert it is greater than `maxTurns`.

This makes the negative string check non-vacuous: the unlike executor counter really would produce
an over-cap fraction if substituted.

### Exact live-line assertion

Call `formatCastProgress` with deterministic elapsed and token values and assert the complete line:

`elapsed 4m12s · 60k/500k tokens · turn 2/15`

The two distinct assistant turns each use the existing 30k weighted fixture usage, so the token
segment is 60k. Exact output proves the live formatter consumes the reduced progress state.

### Forbidden fraction assertion

Assert the live line does not contain `` `${executorNumTurns}/${maxTurns}` ``.

The live formatter uses compact `turn N/M` syntax rather than the summary's spaced `N / M cap`
syntax. The assertion should target the actual live representation, `23/15`, while the test name and
comments explicitly connect it to T-072-04's invariant.

To mirror the ticket wording even more closely, a second negative check for `23 / 15 cap` is not
necessary: that text cannot occur anywhere in the live line's grammar. The meaningful regression
for this formatter is `turn 23/15` or the contained substring `23/15`.

## Why no production change

Research confirms the existing dataflow is already correct:

1. assistant stream records enter `accumulateCastProgress`;
2. duplicate nested IDs are ignored;
3. `progress.turns` is passed as state to `formatCastProgress`;
4. the same resolved `maxTurns` is passed to the formatter and executor;
5. terminal `num_turns` is not a formatter input.

Changing code would expand scope without improving acceptance. The durable value of this ticket is
the executable invariant that catches a future accidental substitution.

## Test location and naming

Add one test inside:

`describe("cast progress — per-turn weighted spend + humane line (T-072-02-01)", ...)`

A suitable name is:

`pins the live turn fraction to deduped agent turns, never executor num_turns (T-077-03-02)`

This placement gives direct access to the existing `assistant` helper and `perTurnUsage` fixture.
It also keeps all live progress behavior together.

## Verification design

Run the focused pure-core suite first:

`bun test src/engine/cast-core.test.ts`

Then run the authoritative repository gate:

`bun run check`

After both pass, commit only:

`src/engine/cast-core.test.ts`

through `lisa commit-ticket` with ticket ID `T-077-03-02` and an exact include path.

## Risks and controls

### Risk: weak negative assertion

If the executor counter is not greater than the cap, absence of an over-cap fraction proves little.

Control: assert `executorNumTurns > maxTurns` before checking the rendered line.

### Risk: hand-authored numerator bypasses deduplication

Control: derive `progress` by reducing real stream-shaped objects through
`accumulateCastProgress`.

### Risk: duplicated integration coverage

Control: stay inside the pure test file and avoid filesystem/executor setup.

### Risk: concurrent work enters the commit

Control: use exactly one `--include src/engine/cast-core.test.ts` argument and inspect the resulting
commit.

### Risk: unrelated dirty changes are disturbed

Control: do not stage, restore, reformat, or otherwise mutate paths outside the single test file and
the attempt-private artifact directory.
