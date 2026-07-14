# Plan — T-068-02-03: runner-materialize-and-surface

## Goal

Make a returned token-overshooting plan proceed through gates and, only when those gates clear, materialize and settle as a warning-bearing success.

## Preconditions

- T-068-02-01 has added the run-log marker.
- T-068-02-02 has added the warned-clear verdict to both classifiers.
- The ticket is in research phase and Lisa owns transitions.
- Existing unrelated worktree changes must not be altered or staged accidentally.

## Step 1 — add the fixture plan and executor result

Modify `src/engine/cast.test.ts`.

Add any needed filesystem imports.

Define a small plan value with one story and one ticket.

Define a fixture play whose:

- parser reads the plan from executor JSON;
- gates explicitly clear and name a gate row;
- effect creates story/ticket directories;
- effect writes one markdown file to each directory;
- effect returns `ok: true`.

Use a dedicated stub executor or a parameterized helper that reports:

- valid plan JSON in `result`;
- usage greater than the test token ceiling;
- a stable stub model;
- a successful terminal message.

Verification criterion:

- fixture setup typechecks;
- the pre-fix test reaches the current failure mode rather than relying on BAML or Claude.

Expected pre-fix evidence:

- summary is `budget-exhausted`;
- files are absent;
- record has no warning.

## Step 2 — assert the complete acceptance path

In the same test, assert:

- `summary.outcome === "success"`;
- `summary.materialized === true`;
- `summary.overEnvelope === true`;
- actual usage matches the executor report;
- expected story markdown exists;
- expected ticket markdown exists;
- each file contains its fixture ID/title;
- the run log contains exactly one line;
- record outcome is `success`;
- record outcome is not `budget-exhausted`;
- record `overEnvelope` is true;
- record gate rows show the clear;
- record usage exceeds record envelope tokens;
- `reviveRecord(record).overEnvelope` remains true.

Verification criterion:

The test expresses every ticket acceptance clause using observable state.

## Step 3 — make exhausted returned output gateable

Modify the post-executor block in `src/engine/cast.ts`.

Keep budget checking first.

Move parsing and gate invocation outside the `budgetOutcome.status === "ok"` guard.

Retain the outer `!timedOut && result` guard.

Retain `skipGates` behavior:

- print the skip notice;
- leave `gateVerdict` null;
- let classifier reject an exhausted ungated result.

Update comments to describe the actual ordering and detect-after rationale.

Verification criterion:

- exhausted plus clear reaches `classify` with non-null output and clear verdict;
- timeout still cannot parse or gate;
- gate-stop behavior remains classifier-owned.

## Step 4 — expose warning on settlement summary

Extend `RunSummary` with optional literal `overEnvelope?: true`.

Document its one-way meaning.

Conditionally spread it into the final returned object.

Do not write false.

Verification criterion:

- the new fixture observes `summary.overEnvelope === true`;
- existing hand-built summary values continue to typecheck.

## Step 5 — surface the live warning

After effect/andon handling, add a conditional stdout write controlled by `verdict.overEnvelope`.

Use the exhausted budget outcome only to render:

- spent;
- ceiling;
- overage.

State that gates cleared and output was retained.

Do not label the run as an andon.

Verification criterion:

- a live warned clear prints an explicit settlement warning;
- ordinary clears do not enter the branch;
- source contains no duplicate warning computation.

## Step 6 — persist the warning

Add the conditional warning spread to the end-of-cast `appendRunLog` input.

Place it with one-way marker fields.

Use `verdict.overEnvelope`, not `budgetOutcome` arithmetic.

Verification criterion:

- fixture record contains literal true;
- revived fixture record retains true;
- existing ordinary-cast tests remain unmarked.

## Step 7 — run focused tests

Run:

```bash
bun test src/engine/cast.test.ts
```

If failures occur:

- distinguish fixture filesystem setup from runner disposition;
- confirm reported usage actually exceeds the supplied ceiling under current `countTokens` semantics;
- confirm the fixture gate returns explicit clear;
- confirm no optional MCP declaration triggers unrelated grounding behavior.

Verification criterion:

All cast integration tests pass.

## Step 8 — run adjacent contract tests

Run:

```bash
bun test src/engine/cast-core.test.ts src/play/decompose-epic.test.ts src/log/run-log.test.ts
```

This rechecks:

- generic classifier matrix;
- mirrored decompose classifier matrix;
- marker one-way serialization and revival.

Verification criterion:

All adjacent contract suites pass without edits to those modules.

## Step 9 — run static/full gate

Run:

```bash
bun run check
```

This includes BAML generation, typecheck, and the full test suite.

Pay particular attention to `RunSummary` consumers:

- CLI dispatch;
- chain runner;
- spend loop;
- shelf press;
- tests constructing summaries.

Verification criterion:

The command exits zero.

## Step 10 — inspect the final diff

Use exact-path diff/status inspection.

Confirm ticket-owned source changes are limited to:

- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`;
- `docs/active/work/T-068-02-03/*`.

Confirm no phase/status edits were made to the ticket.

Confirm unrelated dirty files remain untouched.

Verification criterion:

The diff matches the structure artifact and contains no accidental metadata changes.

## Step 11 — update implementation progress

Write `progress.md` with:

- completed steps;
- exact behavior landed;
- focused and full test results;
- any deviations from this plan;
- shared-worktree note;
- commit status consistent with the user’s Lisa handoff instruction.

Verification criterion:

Progress is sufficient to resume or audit the implementation without reconstructing the session.

## Step 12 — review against acceptance

Write `review.md` after implementation and verification.

Review must include:

- changed files;
- behavioral sequence;
- acceptance mapping;
- test coverage;
- gaps and limitations;
- detect-after honesty boundary;
- open concerns;
- full gate result;
- explicit statement that ticket frontmatter was not changed by this work.

Verification criterion:

The handoff lets a reviewer validate the ticket without reading every diff.

## Test matrix

| Runtime state | Expected result |
|---|---|
| timeout | timed-out, no parse/gate/effect, no warning |
| exhausted + clear | success, effect runs, marker returned/logged, warning printed |
| exhausted + stop | gate-failed, no effect, no warning |
| exhausted + null/skip | budget-exhausted, no effect, no warning |
| in-budget + clear | success, effect runs, no warning |
| in-budget + stop | gate-failed, no effect, no warning |

The pure tests already pin the full matrix.
The new fixture pins the only previously unreachable live path.

## Scope controls

Do not:

- alter token-accounting units;
- add preventative interruption;
- alter wall-clock timeout handling;
- add a new run outcome;
- move warning policy into decompose effect;
- modify record schema version;
- change recalibration behavior;
- modify ticket frontmatter;
- clean or overwrite unrelated worktree changes.

## Completion signal

Implementation is ready for Review when:

- the fixture writes both file classes;
- summary and record are cleared successes;
- both carry the warning where applicable;
- the warning survives revive;
- focused tests pass;
- `bun run check` passes;
- `progress.md` records the outcome.
