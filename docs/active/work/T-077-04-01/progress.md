# Progress — T-077-04-01

## Outcome

Implementation is complete. A gated `decompose-epic` cast now appends a schema-versioned parsed
checkpoint to `<projectRoot>/.vend/decompose-drafts.jsonl` immediately after gates and before
classification/effect. A gate-failed fixture proves the checkpoint remains readable, and the
existing max-turns characterization proves cap-hit action data is derived from the exact terminal
subtype rather than unlike counters.

## Step 1 — store primitive

Completed in commit `1bae202f91ab1e01b0dd6759729d1a96bca3e2c4`:

> feat: add resumable decompose draft store

Created:

- `src/engine/decompose-draft.ts`
- `src/engine/decompose-draft.test.ts`

Implemented:

- `DECOMPOSE_DRAFT_SCHEMA_VERSION = 1`;
- `DEFAULT_DECOMPOSE_DRAFT_PATH = .vend/decompose-drafts.jsonl`;
- canonical `RESUMABLE_DECOMPOSE_PLAY` identity;
- native CLEAR/STOP gate-finding persistence;
- structured repair/resume action union;
- exact `error_max_turns` cause selection;
- strict write-side record builder;
- newline-delimited serializer;
- tolerant row reviver and JSONL reader;
- latest globally / latest by epic selection;
- append-only filesystem writer;
- ENOENT-as-empty filesystem loader.

## Step 2 — store verification

Focused command:

```text
bun test src/engine/decompose-draft.test.ts
5 pass, 0 fail, 20 expect() calls
```

The tests cover:

- version stamping and JSONL shape;
- parsed draft preservation;
- CLEAR and STOP finding preservation;
- max-turns versus ordinary recovery causes;
- malformed, partial, future-version, and unsupported-action row skipping;
- latest selection by append order;
- missing-store behavior.

Strict typecheck passed after one implementation correction: the serializer was made generic over
the parsed object type, and the test helper's gate parameter was widened to the gate verdict union.
This was a type-shape correction only; no design behavior changed.

## Step 3 — first authoritative gate and commit

`bun run check` passed before the first Lisa commit:

- BAML generation: pass;
- TypeScript: pass;
- full suite: 1795 pass, 1 skip, 0 fail;
- 5667 expectations.

The source unit was committed only with exact `lisa commit-ticket --include` paths. No ordinary
index command or ordinary commit command was used.

## Step 4 — cast integration

Completed in commit `79d4ff13e94ecd4e13c0431bf2fda17eefe4746f`:

> feat: checkpoint decompose drafts after gates

Modified:

- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

`CastOptions` gained an optional `decomposeDraftPath` override. The default is joined to the
effective project root, unlike a process-global relative assumption.

The append branch is located immediately after `play.gates` returns. It requires:

- a real non-null gate verdict;
- stable play identity `decompose-epic`.

It appends:

- current run ID;
- `opts.subject` as epic;
- the exact parsed output object;
- the exact gate verdict;
- the subtype-derived next action;
- a local timestamp.

The branch runs before `classify` and before any effect. A failed checkpoint write therefore stops
before materialization instead of allowing an unresumable effect to proceed.

## Step 5 — failed-cast acceptance proof

Added a token-free, BAML-free fixture named `decompose-epic`.

Fixture behavior:

- stub executor returns normally;
- parse produces a story/ticket object;
- gates return a structural STOP;
- effect records if called.

Assertions prove:

- cast outcome is `gate-failed`;
- materialized is false;
- effect was not called;
- `.vend/decompose-drafts.jsonl` is loadable;
- the loader reports one record and zero skipped rows;
- epic, parsed draft, gate findings, and next action all match exactly;
- next action is `repair-gate` with cause `gate-stop`.

## Step 6 — max-turns prerequisite integration

Extended the already-committed decompose cap-hit characterization.

The existing test still proves:

- argv contains `--max-turns 15`;
- 15 distinct assistant turns pair with the 15 cap;
- terminal `num_turns` remains 23 conversation events;
- `23 / 15 cap` is never rendered;
- transcript carries `subtype: error_max_turns`.

New assertion proves the checkpoint action is:

```json
{"kind":"resume-at-gates","cause":"executor-max-turns"}
```

No numeric counter is accepted by the action selector, so cap inference cannot regress to an
unlike-unit comparison through this API.

## Step 7 — focused integration verification

Command:

```text
bun test src/engine/decompose-draft.test.ts src/engine/cast.test.ts
28 pass, 0 fail, 267 expect() calls
```

`bun run build` also passed.

## Step 8 — second authoritative gate and commit

`bun run check` passed before the cast integration commit:

- BAML generation: pass;
- TypeScript: pass;
- full suite: 1796 pass, 1 skip, 0 fail;
- 5675 expectations.

The integration unit was committed through Lisa with exact includes for `cast.ts` and
`cast.test.ts` only.

## Step 9 — final exact-HEAD verification

After both commits, `bun run check` passed again on exact HEAD:

- BAML generation: pass;
- TypeScript: pass;
- full suite: 1796 pass, 1 skip, 0 fail;
- 5675 expectations across 118 files.

Ticket-owned source status:

- `src/engine/decompose-draft.ts`: committed and clean;
- `src/engine/decompose-draft.test.ts`: committed and clean;
- `src/engine/cast.ts`: committed and clean;
- `src/engine/cast.test.ts`: committed and clean.

Remaining status entries belong to Lisa metadata, Lisa-published work artifacts, and the concurrent
T-077-02-04 ticket. They were not modified or included by this ticket's commits.

## Deviations from plan

- The initial strict typecheck exposed two generic test/helper type mismatches; they were corrected
  before the first full gate and commit.
- No architectural or scope deviation occurred.
- The acceptance proof uses a returned gate failure rather than a thrown effect interruption. This
  was the planned primary path: it is deterministic returned data, proves the checkpoint ordering,
  and avoids introducing exception semantics unrelated to this ticket.

## Remaining work outside this ticket

- T-077-04-02 clears/settles checkpoints after successful materialization.
- T-077-04-03 surfaces active checkpoints through `vend doctor`.
- T-077-04-04 loads the latest checkpoint and bypasses cold dispense on `--resume`.
- This ticket intentionally does not build repair/regeneration behavior.
