# Plan — T-077-04-04

## Goal

Deliver the exact public resume gesture using the existing active draft and shared cast settlement,
with deterministic proof that no executor dispense occurs and successful materialization clears the
draft.

## Step 1 — establish baseline and ownership

1. Recheck `git status --short`.
2. Confirm only Lisa-owned ticket/provenance files are dirty.
3. Run focused existing draft/cast/CLI tests before editing if practical.
4. Record any pre-existing failure before attributing it to the ticket.

Verification:

- source files in scope are clean;
- dependency lifecycle tests pass.

## Step 2 — add the engine resume source

1. Import the `DecomposeDraftRecord` type in `src/engine/cast.ts`.
2. Add `resumeDraft?: DecomposeDraftRecord` to `CastOptions`.
3. Validate resume play identity, subject equality, and mandatory gates.
4. Hoist the terminal facts needed by both source modes.
5. Wrap the existing cold execution prefix without reordering its internal statements.
6. On resume, install `parsedDraft` as output and call gates.
7. Skip checkpoint append on resume.
8. Join the existing classifier/effect/settlement tail.
9. Ensure zero result facts normalize to zero usage/cost and absent turns/seat.

Verification:

- TypeScript compiles;
- all prior cast tests remain green.

## Step 3 — add the engine acceptance test

1. Seed a schema-valid active draft with the public writer.
2. Load/select it through the public reader APIs.
3. Create a BAML-free `decompose-epic` fixture play.
4. Make render and parse throw if reached.
5. Make the executor record probe/dispense if reached.
6. Make gates capture the supplied stored draft and return CLEAR.
7. Make effect write one artifact using a unique stored value.
8. Call `castPlay` with `resumeDraft`.
9. Assert no cold calls occurred.
10. Assert gates precede effect.
11. Assert the artifact contains the stored value.
12. Assert successful materialization and zero token actuals.
13. Assert active draft state is empty.
14. Assert the raw settlement row belongs to the resume run.

Verification command:

```bash
bun test src/engine/cast.test.ts src/engine/decompose-draft.test.ts
```

## Step 4 — commit the engine unit

1. Run `bun run check`.
2. Inspect exact diff for `src/engine/cast.ts` and `src/engine/cast.test.ts`.
3. Commit only those paths with `lisa commit-ticket`.
4. Confirm neither file remains modified or staged.

Proposed commit message:

`feat(engine): resume decompose from persisted draft`

## Step 5 — add concrete draft lookup

1. Add the resume path resolver in `src/play/decompose-epic.ts`.
2. Map a bare epic ID to the canonical active epic card path.
3. Extend run options with `resume` and hermetic store/log path overrides.
4. Assemble current epic/charter/project context from the resolved path.
5. Derive the canonical epic subject.
6. Load active drafts from the public reader.
7. Select the latest record for the subject.
8. Throw a typed missing-draft error when absent.
9. Pass the record and store override into `castPlay`.
10. Preserve cold assembly and cast behavior when resume is absent.

Verification:

- build succeeds;
- cold call sites need no source changes beyond optional types.

## Step 6 — add resume-aware dispatch

1. Extend `DispatchResult` with `no-draft`.
2. Permit optional budget at the dispatch boundary.
3. Resolve the play before selecting the resume budget.
4. On cold run, retain the funding counter and supplied budget.
5. On resume, bypass the funding counter and use the play-authored envelope internally.
6. Convert only the typed missing-draft error to data.
7. Preserve unknown-play behavior.

Verification:

- TypeScript exhaustiveness catches every caller needing the new result arm.

## Step 7 — add CLI parsing and presentation

1. Add exact resume syntax to `USAGE` under free commands.
2. Add optional `resume: true` to the parsed run shape.
3. Make run budget optional in the type but required for every non-resume parse.
4. Update `parseRunArgs` to accept the exact no-budget resume command.
5. Preserve cold run object shapes.
6. Print funding only when a budget was explicitly parsed.
7. Pass the resume flag into dispatch.
8. Render `no-draft` as an actionable one-line refusal.
9. Preserve no-play exit code and successful summary output.

Verification:

- parser has no filesystem/BAML dependency;
- normal funding echo tests remain unchanged.

## Step 8 — add CLI tests

1. Assert the exact doctor command parses.
2. Assert no `budget` own-property exists for resume.
3. Assert an explicit markdown path also parses for resume.
4. Reassert cold missing-budget behavior.
5. Assert help includes the exact recovery command.
6. Assert the recovery command is in the free section.
7. Assert the metered cold command still requires budget.

Verification command:

```bash
bun test src/cli.test.ts
```

## Step 9 — integrated verification

Run focused suites together:

```bash
bun test src/cli.test.ts src/engine/decompose-draft.test.ts src/engine/cast.test.ts
```

Then run the authoritative gate:

```bash
bun run check
```

Acceptance requires:

- zero failed tests;
- exact resume parser path;
- no executor probe/dispense/render/parse in the acceptance fixture;
- materialized artifact comes from stored payload;
- active draft clears after success.

## Step 10 — commit the concrete/CLI unit

1. Inspect exact diffs.
2. Confirm no Lisa-owned file is included.
3. Run `bun run check` at the intended commit HEAD.
4. Commit with exact include paths:

- `src/play/decompose-epic.ts`;
- `src/play/dispatch.ts`;
- `src/cli.ts`;
- `src/cli.test.ts`.

Proposed commit message:

`feat(cli): resume decompose from active draft`

## Step 11 — final verification and review

1. Confirm all ticket-owned source is committed and clean.
2. Run `bun run check` at exact final HEAD.
3. Inspect the two ticket commits and exact path ownership.
4. Write `progress.md` with completed steps, tests, commits, and deviations.
5. Write `review.md` with acceptance assessment and open concerns.
6. Write `review-disposition.json` with pass only if every criterion is met.
7. Remain on this ticket and stop; Lisa handles publication/completion.

## Planned honest limitations

- Resume uses fixture/stub proof, as the story explicitly permits.
- No live metered executor is invoked.
- No repair loop changes a gate-stopped stored draft.
- The v1 record cannot restore cold-only optional `after`/`agent` inputs it did not persist.
- Raw draft ledger history remains append-only after active settlement.

