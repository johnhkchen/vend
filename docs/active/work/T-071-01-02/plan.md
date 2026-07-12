# T-071-01-02 Plan — cast stamps seat of execution

## Step 1 — add and pin the pure mapping

Modify `src/engine/cast-core.ts`:

- type-import `AgentSeat`;
- add total `resolveSeatOfExecution(executorId)`;
- explicitly map `claude → claude`;
- explicitly map `openai-compat → codex`;
- return `undefined` for unmapped ids.

Modify `src/engine/cast-core.test.ts`:

- import the resolver;
- assert both required mappings;
- assert an arbitrary stub id remains unknown;
- pin exact matching if appropriate.

Verification:

```bash
bun test src/engine/cast-core.test.ts
```

Pass criteria: all pure core tests pass, with no fs/spawn/native-addon dependency added.

## Step 2 — thread known execution lane into settlement

Modify `src/engine/cast.ts`:

- import the pure resolver;
- compute the optional lane from the resolved `executor.id`;
- keep the result available through dispense, timeout, gates, and effect;
- conditionally spread the field into the one final `appendRunLog` call;
- do not synthesize a lane on the pre-execution missing-capability andon.

Verification:

```bash
bun run build
```

Pass criteria: strict TypeScript accepts the optional field and no public executor/cast return
contracts change.

## Step 3 — extend token-free cast integration proof

Modify `src/engine/cast.test.ts`:

- parameterize the stub executor id with a default of `stub`;
- make the primary injected cast use a Claude-id stub;
- assert its record contains `seatOfExecution: "claude"`;
- add a separate lane-less stub cast;
- assert the lane-less record omits the key entirely.

Verification:

```bash
bun test src/engine/cast.test.ts
```

Pass criteria: the stub cast writes exactly one known-lane record, the lane-less cast writes
exactly one record without the field, and all prior integration cases stay green.

## Step 4 — focused combined verification

Run:

```bash
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
```

Cross-check acceptance:

- Claude executor identity maps to Claude lane.
- OpenAI-compatible identity maps to Codex lane.
- The cast shell persists the mapped value.
- Unknown identity returns undefined and the shell omits the field.
- Existing record revival/storage behavior remains owned and tested by the dependency.

## Step 5 — repository gate

Run:

```bash
bun run check
```

Pass criteria: BAML generation, typecheck, and the complete test suite are green.

If unrelated concurrent changes cause a failure, distinguish ticket-owned failures from ambient
failures and document evidence honestly. Do not modify out-of-scope files to mask an ambient issue.

## Step 6 — diff and ownership audit

Inspect:

```bash
git diff -- src/engine/cast-core.ts src/engine/cast-core.test.ts src/engine/cast.ts src/engine/cast.test.ts
git status --short
```

Pass criteria:

- only intended changes exist in the four ticket-owned files;
- no ticket-owned file is staged in the ordinary index;
- unrelated Lisa/user changes remain untouched;
- no run-log, executor implementation, selector, materialize, reader, or ticket metadata change
  was introduced by this implementation.

## Step 7 — commit exact ticket-owned source unit

Use only:

```bash
lisa commit-ticket \
  --ticket-id T-071-01-02 \
  --message "feat(engine): stamp cast execution lane (T-071-01-02)" \
  --include src/engine/cast-core.ts \
  --include src/engine/cast-core.test.ts \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

Do not use `git add` or ordinary `git commit`. Confirm the four paths are clean afterward.

## Step 8 — implementation record and review

Write `progress.md` with:

- completed steps;
- exact verification results;
- commit id;
- deviations, if any;
- acceptance checklist.

Write `review.md` with:

- file summary;
- behavior and mapping summary;
- test coverage;
- scope confirmation;
- open concerns or limitations;
- final honest acceptance result.

Remain on this ticket after the review artifact and stop; Lisa handles publication and completion.
