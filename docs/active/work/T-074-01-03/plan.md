# Plan — T-074-01-03

## Goal

Make `castPlay` refuse a cast before dispense when the exact active executor's shallow probe
returns non-ok, using the existing missing-capability amber outcome with zero spend and one durable
record, while preserving the successful-probe path.

## Preconditions

- Parent story and ticket contract have been read.
- Dependency ticket `T-074-01-01` is present in the branch.
- `Executor.probe()` is required and both built-ins return structured reason/hint data.
- The working tree's Lisa and sibling-ticket changes are unrelated and must be preserved.
- Attempt artifacts are written only to the private attempt directory.

## Step 1 — Add the pure classifier regression

Edit `src/engine/cast-core.test.ts` inside the existing classify describe block.

Add a non-ok probe fixture with a named executor-unreachable reason and repair hint.

Call `classify` with the failed probe plus conflicting timeout, exhausted-budget, and stopped-gate
facts.

Assert:

- outcome is missing-capability;
- materialization is false;
- gate rows are empty;
- over-envelope is absent.

Supply `{ ok: true }` to an ordinary success case and retain its existing expected verdict.

Verification:

```bash
bun test src/engine/cast-core.test.ts
```

Expected before implementation: a type error or failed outcome assertion showing the branch is
not yet represented.

## Step 2 — Implement pure executor-probe classification

Edit `src/engine/cast-core.ts`.

Add a type-only `ExecutorProbeResult` import.

Add optional `executorProbe` to `ClassifyInput` with contract documentation.

Put the failed-probe branch first in `classify` and return an empty-gate missing-capability verdict.

Leave all existing branch bodies and their order unchanged after this new precondition.

Verification:

```bash
bun test src/engine/cast-core.test.ts
```

Pass criteria: all core tests green, including failed-probe priority and successful-probe inertness.

## Step 3 — Add the cast andon integration regression

Edit `src/engine/cast.test.ts`.

Create a failing injected executor with known id, deterministic reason/hint, counted probe, and a
dispense method that fails the test if reached.

Cast the existing echo play through it with temp project/run-log/transcript locations and captured
stdout.

Assert:

- one probe call;
- zero dispense calls;
- zero effect calls;
- missing-capability summary;
- false materialization;
- empty actual usage;
- stdout names id, reason, and hint;
- no transcript file/directory;
- exactly one run-log JSONL line;
- zero normalized token counts and zero cost;
- empty gate rows;
- known execution seat.

Verification:

```bash
bun test src/engine/cast.test.ts
```

Expected before shell implementation: dispense is reached or the returned result is not the
missing-capability refusal.

## Step 4 — Wire probe into the impure cast shell

Edit `src/engine/cast.ts`.

Move exact executor selection and seat mapping directly after required-MCP success.

Await the exact instance's `probe()` once.

Classify the result through the pure core with neutral downstream facts.

When non-ok:

- stamp end time;
- render one missing-capability andon with executor id, reason, and hint;
- append one zero-spend/empty-gate run record;
- include known execution-seat provenance;
- return a non-materialized summary with empty usage;
- do not render, create transcript, dispense, parse, gate, effect, or reach terminal append.

Use total formatting fallbacks for blank or absent reason/hint.

Remove the old later executor resolution block.

Pass the successful probe result into the normal post-dispense `classify` call.

Verification:

```bash
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
```

Pass criteria: classifier and shell refusal tests green; existing successful, timeout, progress,
cross-review, and materialization tests remain green.

## Step 5 — Inspect focused diff and scope

Inspect only ticket-owned paths:

```bash
git diff -- src/engine/cast-core.ts src/engine/cast-core.test.ts src/engine/cast.ts src/engine/cast.test.ts
```

Check that:

- no executor implementation changed;
- no run-log schema changed;
- no doctor code changed;
- no ordinary index staging occurred;
- the passing dispense options remain unchanged;
- the early branch has one append and one immediate return;
- reason/hint text cannot print `undefined`.

## Step 6 — Run the repository gate

Run:

```bash
bun run check
```

This performs BAML code generation, TypeScript build, and the full test suite.

If generated files change only because of codegen, inspect them before assigning ownership; do not
commit unrelated generated drift.

Pass criteria:

- code generation succeeds;
- typecheck succeeds;
- all non-preexisting tests pass;
- no ticket-owned source file remains unverified.

## Step 7 — Commit the meaningful source unit

Use only Lisa's ticket commit transaction:

```bash
lisa commit-ticket \
  --ticket-id T-074-01-03 \
  --message "feat(engine): andon unreachable executor at cast time (T-074-01-03)" \
  --include src/engine/cast-core.ts \
  --include src/engine/cast-core.test.ts \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

Do not use `git add`, `git add -A`, or ordinary `git commit`.

This is one meaningful source unit because the pure classifier, impure consumer, and their tests
jointly implement one indivisible terminal path. Splitting would temporarily leave production and
its required verification inconsistent.

After the transaction, inspect status and commit contents to ensure only the four exact paths were
included and those paths are clean.

## Step 8 — Record implementation progress

Write `progress.md` in the attempt directory with:

- completed steps;
- focused red/green evidence;
- full gate evidence;
- commit hash and exact include paths;
- deviations and rationale;
- remaining work, if any;
- working-tree ownership notes.

Continue immediately to Review.

## Step 9 — Review against acceptance

Inspect the committed diff and rerun any focused command needed to resolve review uncertainty.

Write `review.md` in the attempt directory covering:

- outcome;
- files changed;
- pure classifier behavior;
- shell ordering and exactly-once persistence;
- stdout cause/hint behavior;
- passing-path compatibility;
- test coverage and full gate evidence;
- scope/non-changes;
- honest limitations and open concerns;
- clean state of ticket-owned files.

Stop on this ticket after writing Review. Do not publish attempt artifacts directly to
`docs/active/work`, edit ticket phase/status, or start another ticket.

## Test matrix

| Behavior | Test layer | Expected evidence |
|---|---|---|
| Failed executor probe classifies missing capability | pure unit | exact `Verdict` |
| Capability refusal outranks later facts | pure unit | timeout/gate/budget conflict still refuses capability |
| Successful probe is inert | pure unit + integration | ordinary success unchanged |
| Failed probe prevents dispense/effect | integration | counters remain zero |
| Cause and hint are named | integration | captured stdout contains exact strings |
| Refusal is countable once | integration | one JSONL line |
| Refusal spends nothing | integration | empty summary usage; normalized ledger zeros; cost 0 |
| Nothing is prepared/materialized | integration | no transcript; no effect |
| Repository compatibility | full gate | `bun run check` green |

## Rollback boundary

The change has no migration or external state beyond source code.

A rollback consists only of reverting the four ticket-owned source/test paths in the committed
unit. No ledger schema, user configuration, credential, generated API, or persisted data needs
rollback handling.

## Completion definition

The ticket is complete only when:

- the pure and integration acceptance cases pass;
- `bun run check` is green;
- the four ticket-owned source/test paths are committed through `lisa commit-ticket`;
- no ticket-owned path remains staged, modified, or untracked;
- `progress.md` and `review.md` exist in the attempt-private work directory;
- any limitation is stated honestly in Review.
