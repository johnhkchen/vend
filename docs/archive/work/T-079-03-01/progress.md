# Progress — T-079-03-01

## Status

Implementation complete. Focused verification and the full repository gate are green. The meaningful
ticket-owned seam unit is committed and every ticket-owned repository path is clean.

## Research completed

- Read the parent story before the ticket implementation work.
- Read the RDSPI workflow, project vision, charter, stack, and go-and-see context.
- Ran and read `lisa hooks-guide` for the live installed lisa contract.
- Inspected the executable project-owned `.lisa/hooks/on-notify`.
- Inspected the current `.lisa/completion-journal.jsonl` rows.
- Confirmed the journal is per-ticket reconciliation and lacks whole-loop provenance.
- Confirmed `on-notify complete` carries project, tickets done, and duration.
- Mapped `.vend/` ownership and existing pure-core / impure-shell record patterns.
- Confirmed no pre-existing loop marker or `src/settle/` implementation was in this ticket's surface.
- Recorded the pre-existing Lisa-managed worktree changes for preservation.

Artifact:

- `.lisa/attempts/T-079-03-01/1/work/research.md`

## Design completed

Decisions recorded:

- source the marker from existing `on-notify complete`;
- reject the completion journal as the wrong lifecycle/data shape;
- store one pending marker at `.vend/loop-settled.json`;
- use a closed five-field v1 schema;
- retain only event-supplied provenance plus schema identity;
- keep validation pure and filesystem/process work in a seam shell;
- extend the user-owned hook without changing ntfy content;
- record before the optional topic early exit;
- keep settle rendering and consumption in the dependent ticket.

Artifact:

- `.lisa/attempts/T-079-03-01/1/work/design.md`

## Structure completed

Defined the seven-path ticket-owned unit:

- `docs/knowledge/lisa-loop-settled-contract.md`
- `src/seam/lisa-loop-settled-core.ts`
- `src/seam/lisa-loop-settled-core.test.ts`
- `src/seam/lisa-loop-settled.ts`
- `src/seam/lisa-loop-settled.test.ts`
- `src/seam/fixtures/lisa-loop-settled.valid.json`
- `.lisa/hooks/on-notify`

The structure kept `src/cli.ts`, `src/settle/`, lisa journals/signals, and the notify sample out of
scope.

Artifact:

- `.lisa/attempts/T-079-03-01/1/work/structure.md`

## Plan completed

- Sequenced fixture, pure schema, schema tests, recorder, effect tests, hook, contract doc, gates,
  exact commit, and review.
- Defined malformed-schema and one-way-authority test matrices.
- Defined the exact `lisa commit-ticket` include set.
- Preserved the no-ordinary-index assignment rule.

Artifact:

- `.lisa/attempts/T-079-03-01/1/work/plan.md`

## Implementation completed

### Canonical fixture

Created `src/seam/fixtures/lisa-loop-settled.valid.json` with exact bytes:

```json
{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":2,"durationSecs":41}
```

### Pure schema core

Created `src/seam/lisa-loop-settled-core.ts`.

It now exports:

- schema version `1`;
- marker kind `lisa-loop-settled`;
- default path `.vend/loop-settled.json`;
- readonly marker/event/result types;
- strict marker construction;
- closed-schema revival from `unknown`;
- non-throwing JSON parsing;
- lisa complete-event classification;
- deterministic serialization.

The core requires:

- exact key set;
- literal version and kind;
- non-empty project basename;
- non-negative safe-integer counts/duration;
- an absolute `LISA_PROJECT` on complete events.

### Pure tests

Created `src/seam/lisa-loop-settled-core.test.ts`.

Coverage includes:

- committed fixture validation;
- fixture byte round trip;
- frozen valid marker;
- honest zeros;
- strict builder rejection;
- invalid JSON;
- non-object values;
- wrong/missing version and kind;
- empty project;
- malformed quantities;
- unknown extra key;
- valid complete-event normalization;
- attention ignore;
- malformed complete-event refusal.

### Filesystem recorder

Created `src/seam/lisa-loop-settled.ts`.

- It classifies before filesystem access.
- Ignored/refused inputs create nothing.
- It joins only the validated project root and exported Vend-owned relative path.
- It writes a unique sibling temporary file with exclusive creation.
- It atomically renames onto the stable marker.
- It removes an unpublished temporary file in `finally`.
- Its `import.meta.main` adapter reads only the documented lisa environment values.
- It stays silent on recorded/ignored outcomes and names malformed/fault outcomes on stderr.

### Effect and hook tests

Created `src/seam/lisa-loop-settled.test.ts`.

Coverage includes:

- valid event materialization at the exact path;
- pure re-validation of disk bytes;
- root contains only `.vend` after direct recording;
- no `.lisa` path created;
- ignored/refused events leave an empty root;
- second complete event replaces the singleton;
- no temporary sibling remains;
- copied real hook invocation with no ntfy topic records the valid marker.

### Existing hook crossing

Modified `.lisa/hooks/on-notify`.

- The complete event calls the seam recorder before topic resolution.
- The hook uses its project-local source path and Bun, already required by the project.
- Recorder failures are contained with `|| :`.
- Attention dispatch is unchanged.
- Complete ntfy title/body/priority/tags are unchanged.
- The hook remains executable and ends with unconditional success.

### Durable agreement

Created `docs/knowledge/lisa-loop-settled-contract.md`.

It names:

- home;
- exact shape;
- source emission;
- producer;
- consumer;
- atomic production;
- replacement semantics;
- consume-on-successful-settle lifecycle;
- malformed-marker andon behavior;
- one-way authority;
- versioning rule;
- explicit exclusions.

## Verification completed

### Focused schema/effect tests

```text
bun test src/seam/lisa-loop-settled-core.test.ts src/seam/lisa-loop-settled.test.ts
```

Result:

- 32 passed;
- 0 failed;
- 57 expectations;
- 2 test files.

### Shell syntax

```text
sh -n .lisa/hooks/on-notify
```

Result: exit 0.

### Diff hygiene

- tracked diff check passed;
- no ticket-owned trailing whitespace found;
- source file set matches Structure;
- no CLI or settle file changed;
- no generated file remained dirty.

### Full repository gate

```text
bun run check
```

Result:

- BAML generation passed;
- TypeScript passed;
- 1,872 tests passed;
- 1 intentional release-acceptance skip;
- 0 failures;
- 6,028 expectations across 123 test files.

## Deviations and corrections

No design or scope deviation occurred.

One mechanical test correction was needed:

- The first full gate found `root.split("/").at(-1)` had type `string | undefined` under
  `noUncheckedIndexedAccess`.
- The test was corrected to use `basename(root)`, which is also the production normalization.
- The full gate was rerun from the beginning and passed.

The first focused run also exposed a missing parenthesis in the new hook test. It was corrected before
the successful focused run. No production behavior changed because of either correction.

## Concurrent Lisa-managed state preserved

During implementation Lisa published/updated runtime board state, including:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-079-01-02.md`;
- `docs/active/tickets/T-079-03-01.md`;
- `docs/active/work/T-079-03-01/`.

These paths were not edited directly, reverted, staged, or added to the ticket-owned include set.

## Commit completed

The exact Lisa transaction produced:

```text
57261b4b684c96394357dd4bd732572dd0e32003
```

Subject:

```text
feat(seam): record lisa loop settlement
```

Verified commit contents:

- `.lisa/hooks/on-notify`
- `docs/knowledge/lisa-loop-settled-contract.md`
- `src/seam/fixtures/lisa-loop-settled.valid.json`
- `src/seam/lisa-loop-settled-core.test.ts`
- `src/seam/lisa-loop-settled-core.ts`
- `src/seam/lisa-loop-settled.test.ts`
- `src/seam/lisa-loop-settled.ts`

No other path is in the commit. A path-scoped `git status` over all seven files is empty.

## Remaining before ticket handoff

- Write `review.md` and `review-disposition.json`.
