# Plan — T-077-04-01

## Step 1 — implement the pure draft record contract

Create `src/engine/decompose-draft.ts` with constants, structural types, validators, action
selection, record builder, serializer, tolerant reviver/reader, and latest selection.

Verification criteria:

- no import from `src/play/`, BAML, CLI, doctor, executor implementation, or budget;
- cap cause comes only from exact terminal subtype text;
- parsed draft and gate finding values survive without policy transformation;
- invalid rows return `null`/increment skipped rather than throwing from batch reads;
- write-side programmer errors remain loud.

## Step 2 — add focused store tests

Create `src/engine/decompose-draft.test.ts`.

Test:

- schema stamping and JSONL newline serialization;
- CLEAR and STOP round trips;
- exact gate detail preservation;
- structured action selection for cap-hit and ordinary gate stop;
- malformed/unsupported row tolerance;
- latest-by-append-order globally and by epic;
- ENOENT load behavior.

Run:

```bash
bun test src/engine/decompose-draft.test.ts
bun run build
```

Expected: all focused tests pass and TypeScript stays strict-green.

## Step 3 — run the full gate for source unit 1

Run `bun run check` before committing. Inspect `git diff` and `git status` to confirm only the two
new source files are included in the ticket commit; Lisa/ticket metadata remains untouched.

Commit through:

```bash
lisa commit-ticket \
  --ticket-id T-077-04-01 \
  --message "feat: add resumable decompose draft store" \
  --include src/engine/decompose-draft.ts \
  --include src/engine/decompose-draft.test.ts
```

Do not use `git add` or ordinary `git commit`.

## Step 4 — wire checkpoint persistence into `castPlay`

Modify `src/engine/cast.ts`:

- import store constants/functions from the sibling module;
- add optional `CastOptions.decomposeDraftPath`;
- after actual gates return, branch on stable play name `decompose-epic`;
- append epic, parsed draft, native gate verdict, derived next action, run ID, and timestamp;
- default the path under the supplied project root;
- keep the write before classify/effect;
- skip the checkpoint for `--no-gates` and every other play.

Verification criteria:

- generic engine still imports no concrete play or BAML runtime;
- a store append failure prevents effect execution;
- classifications and existing run-log settlement remain unchanged;
- normal non-decompose tests observe no new persistence.

## Step 5 — prove a failed cast retains a readable draft

Modify `src/engine/cast.test.ts` with a token-free, BAML-free fixture named `decompose-epic`.

The fixture will:

- parse the stub response into a plain object;
- return a deterministic gate STOP;
- expose whether its effect was called.

Assert:

- outcome `gate-failed`;
- no effect/materialization;
- one valid record under `<root>/.vend/decompose-drafts.jsonl`;
- exact epic subject;
- exact parsed draft;
- exact gate STOP findings;
- repair-gate next action with `gate-stop` cause.

This is the acceptance proof for interrupted/failed state retention.

## Step 6 — pin honest cap-hit repair cause

Extend the existing T-077-01-01 cap-hit characterization in `cast.test.ts`.

After its `error_max_turns` result:

- load the new draft store;
- assert the record is readable;
- assert the action cause is `executor-max-turns`;
- retain all existing 15 agent-turn versus 23 conversation-event assertions unchanged.

This ensures the implementation uses the exact subtype and does not regress to a numeric
comparison of unlike units.

## Step 7 — run focused integration verification

Run:

```bash
bun test src/engine/decompose-draft.test.ts src/engine/cast.test.ts
bun run build
```

Inspect failures for unintended default-path draft writes in decompose-shaped tests. Such writes
are expected only in temporary roots and are cleaned by existing test teardown.

## Step 8 — run authoritative gate for source unit 2

Run:

```bash
bun run check
```

Expected:

- BAML generation succeeds;
- strict typecheck succeeds;
- full repository test suite passes;
- no metered executor or network call occurs.

Inspect status and diffs. Commit only:

```bash
lisa commit-ticket \
  --ticket-id T-077-04-01 \
  --message "feat: checkpoint decompose drafts after gates" \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

## Step 9 — post-commit verification

Run `git status --short --branch` and inspect recent commits.

Confirm:

- all four ticket-owned source files are committed;
- none is staged, modified, or untracked;
- Lisa/ticket metadata changes remain present and untouched;
- attempt artifacts remain in the private work directory for Lisa publication.

Run `bun run check` once more if the commit hook or concurrent branch changes make the final state
uncertain. Record the actual command/test counts in `progress.md`.

## Step 10 — Review phase

Write `review.md` covering:

- source files created/modified;
- store schema and lifecycle boundary;
- cast integration ordering;
- pure and integration test coverage;
- exact acceptance mapping;
- verification and commit evidence;
- limitations and downstream ownership.

Write `review-disposition.json` exactly as pass only if:

- the failed-cast readable-draft acceptance test is green;
- cap-hit action is derived from terminal subtype;
- `bun run check` is green;
- all ticket source changes are committed through Lisa;
- no ticket-owned source remains dirty.

Otherwise write block with a specific actionable reason.

## Acceptance mapping

| Acceptance clause | Planned evidence |
|---|---|
| after parse+gates | append is immediately after `play.gates` and before classify/effect |
| decompose cast only | stable `RESUMABLE_DECOMPOSE_PLAY` identity guard |
| schema-versioned record | `DECOMPOSE_DRAFT_SCHEMA_VERSION` + builder/serializer tests |
| under `.vend/` | default `.vend/decompose-drafts.jsonl`, joined to project root |
| epic subject | `opts.subject` round-trip assertion |
| parsed draft | fixture object round-trip assertion |
| gate findings | native STOP/CLEAR verdict round-trip assertions |
| next repair action | structured selector and cast assertions |
| interrupted/failed remains readable | gate-failed integration test + public loader |
| runs.jsonl conventions | JSONL append, version, tolerant malformed-tail read, ENOENT empty |

## Risks and controls

- Risk: concrete-play dependency cycle. Control: stable name constant in engine store module.
- Risk: cap inferred from unlike counters. Control: selector accepts subtype, no count arguments.
- Risk: ungated cast fabricates findings. Control: require real non-null gate verdict.
- Risk: checkpoint write occurs after failure. Control: place append before classify/effect.
- Risk: scope creep into lifecycle/resume. Control: leave cleanup, doctor, and CLI untouched.
- Risk: concurrent dirty worktree contamination. Control: exact Lisa include paths and status checks.
