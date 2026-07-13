# Progress — T-077-03-01

## Status

Implementation is complete, verified, and committed. Review remains to be
recorded in the final phase artifacts.

## Completed — Research

- Read the attempt assignment.
- Read `AGENTS.md`.
- Read `docs/knowledge/rdspi-workflow.md`.
- Read the parent story before the ticket contract was analyzed.
- Read `docs/knowledge/vision.md`, `docs/knowledge/charter.md`, and the relevant
  stack record.
- Mapped the pure progress accumulator/formatter, effectful call site, tests, and
  earlier T-072 history.
- Recorded the codebase map in `research.md`.

## Completed — Design

- Considered shell-derived state, accumulated overshoot state, formatted-string
  comparison, and pure formatter derivation.
- Chose the pure formatter comparison because both same-numeraire raw facts are
  already available there.
- Defined strict `weightedTokens > tokenEnvelope` semantics.
- Defined an explicit `tokens` denomination in both normal and overshot lines.
- Defined `(detect-after)` as an over-envelope-only suffix.
- Recorded the decision and rejected alternatives in `design.md`.

## Completed — Structure and Plan

- Scoped the runtime change to `formatCastProgress`.
- Scoped the primary regression coverage to the existing cast-progress test
  block.
- Planned a red/green focused test, full gate, exact-path Lisa commit, and final
  review.
- Recorded the blueprint and sequence in `structure.md` and `plan.md`.

## Completed — Red test

Changed `src/engine/cast-core.test.ts` first:

- Updated normal exact strings to include the token denomination.
- Added a pinned 392k/200k over-envelope line.
- Added a paired 199k/200k under-envelope line.
- Added an explicit negative marker assertion for the under-envelope output.

Command:

`bun test src/engine/cast-core.test.ts`

Observed expected red result:

- 65 passed.
- 3 failed.
- Failures showed that the current formatter omitted `tokens` and did not add
  `(detect-after)` above the envelope.

This established that the new regression genuinely detected the missing
behavior before production code changed.

## Completed — Pure formatter implementation

Changed `src/engine/cast-core.ts`:

- Added a local suffix selected by raw
  `state.weightedTokens > opts.tokenEnvelope`.
- Composed the existing humane fraction with `tokens` and the conditional
  suffix.
- Reused the composed segment in the existing line layout.
- Left accumulation, accounting, turn formatting, and shell wiring unchanged.

Focused verification after implementation:

`bun test src/engine/cast-core.test.ts`

Result:

- 68 passed.
- 0 failed.
- 158 assertions.

## Full-gate finding and plan deviation

The first `bun run check` completed BAML generation and typecheck, then found one
downstream exact-string failure:

- 1,768 passed.
- 1 failed.
- 1 skipped.
- The failure was the existing live shell wiring golden in
  `src/engine/cast.test.ts`.

This file was not listed in the initial structure because research focused on the
story-named pure formatter test seam. The full gate correctly revealed that the
integration-level wiring test also pins the entire live line.

Deviation:

- Updated only the three expected live strings in the existing shell wiring
  test to include `tokens`.
- Did not change `src/engine/cast.ts` or any effectful behavior.
- Added `src/engine/cast.test.ts` to the exact-path source commit.

Rationale:

- The golden assertion is a direct consumer of the deliberately changed visible
  contract.
- Keeping it stale would make the repository gate red.
- Updating it also preserves integration proof that the pure formatter reaches
  the terminal surface without disturbing transcript behavior.

## Completed — Verification after deviation

Affected integration test:

`bun test src/engine/cast.test.ts --test-name-pattern "stub stream refreshes one progress line"`

Result:

- 1 passed.
- 0 failed.
- 21 filtered out.

Pure-core suite rerun:

- 68 passed.
- 0 failed.

Whitespace verification:

`git diff --check -- src/engine/cast-core.ts src/engine/cast-core.test.ts src/engine/cast.test.ts`

Result: clean.

Final repository gate:

`bun run check`

Result:

- BAML generation succeeded with CLI 0.223.0.
- `tsc --noEmit` succeeded.
- 1,769 tests passed.
- 1 integration test was intentionally skipped by its existing dist-artifact
  guard.
- 0 tests failed.
- 5,572 assertions across 117 files.

## Completed — Commit

Committed through Lisa's isolated exact-path mechanism:

- Commit: `f4fdf60bb09385d5845cda668ec22a585cec928c`.
- Message: `fix(engine): label live token overshoot detect-after`.
- Included `src/engine/cast-core.ts`.
- Included `src/engine/cast-core.test.ts`.
- Included `src/engine/cast.test.ts`.

Post-commit checks:

- All three ticket-owned source paths are clean.
- The ordinary Git index is empty.
- The commit contains exactly those three files.
- Concurrent `.lisa/provenance.jsonl`, ticket frontmatter, and Lisa-published work
  state remain outside the source commit and untouched by this worker.

## Remaining

- Write `review.md`.
- Write the exact machine-readable `review-disposition.json`.
- Stop on this ticket and allow Lisa to publish/complete it.
