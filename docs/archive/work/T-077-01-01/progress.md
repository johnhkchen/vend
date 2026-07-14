# Progress — T-077-01-01

## Status

Implementation is complete, committed, and green. Review remains.

## Completed work

### Phase artifacts

- Read the assignment, repository `AGENTS.md`, RDSPI workflow, parent story, ticket, vision, and
  charter.
- Wrote private `research.md`.
- Wrote private `design.md`.
- Wrote private `structure.md`.
- Wrote private `plan.md`.
- All authored phase files were written only under
  `.lisa/attempts/T-077-01-01/1/work/` as required.

### Source implementation

Modified one ticket-owned source file:

- `src/engine/cast.test.ts`

Added one impure-shell integration characterization:

`castPlay: decompose cap-hit reaches Claude argv and records unlike turn units at the live seam
(T-077-01-01 AC)`

The test:

- uses the production `DECOMPOSE_MAX_TURNS` constant;
- constructs a BAML-free play named `decompose-epic` with that authored default;
- casts it through the real generic `castPlay` shell;
- injects an executor identified as Claude so no model, network, or subprocess is invoked;
- calls production `buildArgs` on the exact `DispenseOptions` received from `castPlay`;
- asserts exact argv includes `--max-turns`, `15`;
- streams 16 assistant events carrying 15 distinct nested message IDs;
- includes one repeated assistant ID to prove the accumulator deduplicates response blocks;
- streams and returns a terminal `error_max_turns` result;
- gives that result `num_turns: 23` to preserve the diagnosed unlike-unit shape;
- asserts final stdout reports `15 / 15` only for agent turns and labels 23 separately as executor
  conversation events;
- asserts stdout never reports `23 / 15 cap`;
- asserts the raw transcript retains all 16 assistant events but only 15 unique IDs;
- asserts the raw transcript's terminal row records `subtype: "error_max_turns"`;
- asserts the run log retains `turnsUsed: 23`;
- asserts current behavior settles as success and runs the effect when returned result text parses,
  usage remains in budget, and gates clear.

## Current behavior characterized

The test pins current behavior without modifying it:

- The decompose authored default reaches the executor option and production Claude argv builder.
- The live accumulator measures distinct assistant message IDs.
- Terminal `num_turns` remains a separate executor counter and is logged as `turnsUsed`.
- Cap-hit is durably recorded as terminal transcript subtype `error_max_turns`.
- `castPlay` does not currently classify that subtype as a distinct outcome.
- A parseable, gates-cleared, in-budget cap-hit result currently materializes and logs success.

No production code, cap value, counter, classifier, run-log schema, or repair behavior changed.

## Focused verification

Command:

```sh
bun test src/engine/cast.test.ts
```

Result:

- 22 pass
- 0 fail
- 238 expectations
- 1 test file

The new T-077 characterization passed.

## Type verification

Command:

```sh
bun run build
```

Result:

- `tsc --noEmit` completed with exit status 0.

## Diff verification

Command:

```sh
git diff --check -- src/engine/cast.test.ts
```

Result:

- Clean; no whitespace errors.

The reviewed pre-commit diff contained only the intended imports and new test in
`src/engine/cast.test.ts`.

## Full repository gate

Command:

```sh
bun run check
```

Result:

- BAML client generation succeeded.
- Typecheck succeeded.
- 1,752 tests passed.
- 1 declared integration test skipped because local `dist/` artifacts were absent.
- 0 tests failed.
- 5,547 expectations ran.
- 1,753 tests across 116 files.
- Exit status 0.

No generated BAML diff remained after the gate.

## Commit

Committed through the required Lisa transaction:

```sh
lisa commit-ticket \
  --ticket-id T-077-01-01 \
  --message "test(engine): characterize decompose max-turns seam" \
  --include src/engine/cast.test.ts
```

Commit:

`0fad893e54bf39af46efaba52bdc4056917f1898`

Commit contents:

- `src/engine/cast.test.ts`
- 106 insertions
- no other path

The ticket-owned source path is clean after commit.

## Worktree ownership

After the source commit, `git status --short` shows only:

- Lisa-owned ticket phase metadata for `T-077-01-01`;
- concurrent Lisa-owned ticket phase metadata for `T-077-02-01`;
- shared work-artifact directories that Lisa published automatically for both attempts.

No ticket-owned source file remains modified, staged, or untracked. The Lisa-owned metadata and
published work paths were not included in the source commit and were not edited by this worker.

## Deviations from plan

No material deviation.

- The test was placed directly after the existing progress/transcript shell test as planned.
- A local play fixture was used instead of adding a shared fixture helper because it is specific to
  this single characterization and keeping it local makes the acceptance narrative contiguous.
- The exact current `success` outcome on a parseable cleared cap-hit result was asserted, making the
  absence of distinct cap-hit classification explicit.

## Remaining

- Write `review.md`.
- Write `review-disposition.json`.
- Remain on T-077-01-01 and stop for Lisa completion handling.
