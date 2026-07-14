# Plan — T-070-01-03: cast records and warns on seat default

## Objective

Close the final cast boundary for unknown-seat degradation. Preserve the exact report returned by the
effect, make it visible at cast time, and persist it in the append-only run record. Prove the complete
fixture path from a stub executor through real board materialization without spending tokens.

## Scope controls

- Modify only `src/engine/cast.ts`, `src/engine/cast.test.ts`, and this ticket's work artifacts.
- Do not edit ticket phase or status.
- Do not change seat membership or Lisa's default.
- Do not change materialization, effect, run-log schema, or outcome vocabulary.
- Do not load BAML values in the test process.
- Do not run a live executor or Lisa process.
- Preserve unrelated worktree changes.

## Step 1 — commit phase artifacts

Stage:

- `research.md`
- `design.md`
- `structure.md`
- `plan.md`

Review the staged file list and commit the completed pre-implementation phases. This creates the
workflow checkpoint before source changes.

Verification:

- all four files exist under `docs/active/work/T-070-01-03/`;
- Research remains descriptive;
- Design records alternatives and rationale;
- Structure names exact file/interface boundaries;
- Plan sequences independently checkable work;
- no ticket frontmatter is staged.

## Step 2 — add the acceptance fixture

Extend `src/engine/cast.test.ts` imports with:

- stdout spy support if required;
- directory listing support;
- type-only `WorkPlan` and enum contracts;
- real addon-free `decomposeEffect`;
- type-only `DecomposeInputs`.

Create a complete one-story/one-ticket plan fixture. Use a fixture charter that resolves every cited
code. Keep ids unique within each temporary project.

Create a decompose-shaped play whose parser consumes the stub's JSON plan and whose effect calls
`decomposeEffect` with a successful validator stub.

Verification:

- TypeScript imports from generated BAML are all `import type`;
- the play has no tools declaration and therefore no unrelated reduced-grounding warning;
- the validator is a function argument, not a Lisa process;
- the effect is the real production adapter.

## Step 3 — write the failing end-to-end expectations

Add one test that performs:

1. baseline cast with no agent;
2. degraded cast with `agent: "kodex"`;
3. full board inventory reads;
4. story and ticket exact-byte comparisons;
5. explicit absence of `agent:` in the degraded ticket;
6. run-record marker assertions;
7. run-log revive assertion;
8. exact stdout warning assertion.

Capture and restore stdout around only the degraded cast. Store the degraded summary outside the
capture block for later assertions.

Expected red state before production wiring:

- board comparisons pass because dependency behavior is already present;
- summary remains successful;
- run record lacks `seatDefaulted`;
- warning text is absent.

Run:

```bash
bun test src/engine/cast.test.ts --test-name-pattern "seat default"
```

Record the failure in `progress.md`. If Bun does not accept the filter spelling or the spy overload,
adjust the test command or local test typing without widening production API.

## Step 4 — retain the effect report

In `src/engine/cast.ts`:

1. import `SeatDefaulted` as a type from `./play.ts`;
2. declare an optional local beside other effect result state;
3. assign `eff.seatDefaulted` immediately after the effect returns.

Do not condition assignment on `eff.ok`. Presence is the effect's authoritative statement that the
default disposition occurred.

Verification:

- no concrete play import enters the engine;
- no input shape inspection is added;
- no membership/default logic is duplicated;
- existing `produced` and outcome code is unchanged.

## Step 5 — emit the live warning

After the effect/andon branch, emit the selected single-line note only when `seatDefaulted` exists.
Interpolate the report's `requested`, `applied`, and `reason` fields.

Expected line:

```text
· seat defaulted — requested 'kodex'; using 'claude' (unknown-seat; proceeding, recorded)
```

Verification:

- degraded stdout contains the exact line once;
- the line is not an andon;
- it says the run proceeds and the fact is recorded;
- no warning is possible when no effect report exists.

## Step 6 — forward to the run record

Add a conditional spread to the normal `appendRunLog` input:

```ts
...(seatDefaulted !== undefined ? { seatDefaulted } : {}),
```

Place it with other optional degradation/warning metadata and document that the effect owns the fact.
Do not edit the early missing-capability append.

Verification:

- degraded JSONL contains the exact structured marker;
- `reviveRecord` preserves all three fields;
- baseline JSONL has no own marker property;
- degraded outcome remains `success`;
- exactly one record is written per cast.

## Step 7 — focused test pass

Run the acceptance test alone, then the entire cast test file:

```bash
bun test src/engine/cast.test.ts --test-name-pattern "seat default"
bun test src/engine/cast.test.ts
```

If the test reveals process-global stdout interference, narrow capture further and ensure restoration
in `finally`. Do not solve test isolation by adding a public production writer seam unless direct
capture is demonstrably unreliable.

Inspect all newly written fixture files through assertions, not manual assumptions.

## Step 8 — static and adjacent verification

Run:

```bash
bun run build
bun test src/log/run-log.test.ts --test-name-pattern seatDefaulted
bun test src/play/materialize.test.ts src/play/decompose-effect.test.ts
git diff --check
```

This checks:

- type compatibility between engine and log marker shapes;
- dependency schema behavior;
- dependency materialization/effect behavior;
- no whitespace errors.

If `bun run build` or a focused dependency test exposes a legitimate integration mismatch, adjust
only the cast/test seam unless the dependency contract is actually broken. Document any scope change
before making it.

## Step 9 — full repository gate

Run the required gate:

```bash
bun run check
```

The criterion is green BAML codegen, TypeScript, and the complete test suite. A known optional skip is
acceptable only when the suite names it and no ticket behavior depends on it. Any failure must be
investigated and either fixed in scope or reported honestly.

## Step 10 — progress artifact

Write `progress.md` with:

- completed phase checklist;
- red-test evidence, if obtained;
- exact production changes;
- test fixture topology;
- focused, adjacent, and full-gate results;
- any deviations from this plan and rationale;
- scope audit;
- remaining work before Review.

Do not claim acceptance until the full gate is green and the acceptance assertions pass.

## Step 11 — implementation commit

Inspect:

```bash
git status --short
git diff -- src/engine/cast.ts src/engine/cast.test.ts docs/active/work/T-070-01-03/progress.md
git diff --check
```

Stage only:

- `src/engine/cast.ts`
- `src/engine/cast.test.ts`
- `docs/active/work/T-070-01-03/progress.md`

Commit with a ticket-scoped message. The pre-commit hook may rerun tests; do not bypass it.

After commit, confirm unrelated board/provenance changes remain unstaged and the ticket frontmatter is
unchanged by this work.

## Step 12 — Review phase

Read the committed diff and commit history. Write `review.md` covering:

- outcome and acceptance assessment;
- production changes by file;
- test changes and fixture boundary;
- exact verification evidence;
- pure-core/impure-shell assessment;
- compatibility and scope audit;
- open concerns or known limitations;
- commits produced by the ticket.

Be explicit that:

- evidence is fixture-only and token-free;
- no live metered cast was run;
- stdout is process-global but restored by the test;
- historical `unknown-seat` remains readable by design;
- a valid known-seat path remains covered by dependency tests;
- no ticket phase/status field was edited.

## Step 13 — Review commit and stop

Stage only `review.md`, inspect the staged diff, and commit it. Do not update ticket frontmatter. After
the Review artifact is complete and committed, stop; Lisa handles phase and status transitions.

## Acceptance matrix

| Requirement | Planned evidence |
|---|---|
| cast through stub executor | injected `Executor` in `cast.test.ts` |
| request is `--agent kodex` semantic value | degraded `DecomposeInputs.agent === "kodex"` |
| full board materializes | expected story/ticket inventories in temp root |
| default-byte output | exact body comparisons against no-agent cast |
| no explicit degraded seat | ticket lacks `agent:` |
| report reaches cast | stdout and JSONL both use effect report |
| record carries raw request | exact `requested: "kodex"` assertion |
| record carries applied default | exact `applied: "claude"` assertion |
| reason is retained | exact `reason: "unknown-seat"` assertion |
| read boundary retains marker | `reviveRecord` assertion |
| cast warning is visible | exact captured stdout line |
| no refusal | summary and record outcome are `success` |
| repository remains green | `bun run check` |

## Completion condition

Implementation is complete only when the focused acceptance test passes, `bun run check` is green,
the scoped source/test/progress changes are committed, and `review.md` truthfully hands off the result.
