# Plan — T-069-01-01

## Objective

Land the canonical `claude | codex` routing-seat contract and transport an optional unvalidated
`agent` string from `ContextSources` into `DecomposeInputs`, with exact addon-free tests for known,
unknown, present, and absent behavior.

## Preconditions

- Parent story `S-069-01` has been read.
- Ticket `T-069-01-01` has been read after the story.
- Vision and charter grounding have been read.
- RDSPI workflow has been read.
- Research, Design, and Structure artifacts exist.
- Existing Lisa-owned ticket/story/epic working-tree state is identified and will not be staged.

## Step 1 — Establish a focused failing seat-contract test

Create `src/play/agent-seat.test.ts` with the pure acceptance examples:

- exact `KNOWN_SEATS` tuple;
- `findUnknownSeat("gpt") === "gpt"`;
- `findUnknownSeat("claude") === null`;
- `findUnknownSeat("codex") === null`.

Verification:

- Running the focused test before the module exists would fail to resolve the import.
- The assertions directly match the ticket wording.

Atomic unit:

- Test plus minimal pure module implementation form one meaningful commit-sized unit.

## Step 2 — Implement the pure seat contract

Create `src/play/agent-seat.ts`.

Implementation details:

- no imports;
- declare `KNOWN_SEATS` once with `as const`;
- derive `AgentSeat` from the tuple;
- scan the tuple using exact equality;
- return null for a match;
- return the original string otherwise.

Verification:

- `bun test src/play/agent-seat.test.ts` passes the pure tests.
- TypeScript accepts the tuple scan without widening/casts that duplicate vocabulary.

## Step 3 — Extend the assembly test fixture

In the same new test file, add a temporary project fixture.

Fixture setup:

1. Create a unique temp root.
2. Create the parent directory for `CHARTER_PATH`.
3. Write a minimal epic file.
4. Write a minimal charter file.
5. Leave `src`, story, and ticket directories absent; existing helpers return empty lists.
6. Clean the entire root in `finally`.

Presence assertion:

- assemble with `agent: "codex"`;
- result carries `agent: "codex"`;
- result owns the key.

Absence assertion:

- assemble without agent;
- property access returns undefined;
- object has no own `agent` key;
- exact object equality contains only `epic`, `charter`, and `project`.

Verification:

- The test should fail until production interfaces/return assembly are changed.
- The test import graph stays addon-free.

## Step 4 — Add the optional input fields

Modify `src/play/project-context.ts`.

Changes:

- Add `readonly agent?: string` to `ContextSources`.
- Add `readonly agent?: string` to `DecomposeInputs`.
- Document pass-through, effect ownership, and absence semantics.
- Do not import or call the guard here.

Verification:

- Typecheck permits caller input and result access.
- Existing consumers compile without changes because the field is optional.

## Step 5 — Add presence-preserving pass-through

Modify `assembleInputs` return construction.

Changes:

- Retain the exact existing `after` conditional spread.
- Append `...(src.agent !== undefined ? { agent: src.agent } : {})`.
- Update the nearby comment to describe both optional effect inputs.
- Update the file header's outdated direct-test statement.

Verification:

- Focused presence test passes.
- Focused absence exact-object test passes.
- Existing project-context tests pass.
- An explicitly empty string would be transported, not silently erased.

## Step 6 — Focused verification

Run:

```bash
bun test src/play/agent-seat.test.ts src/play/project-context.test.ts
```

Pass criteria:

- All new contract tests pass.
- All existing snapshot/title-reader tests pass.
- No native addon error occurs.
- No fixture residue remains in the repository.

If failing:

- Fix only the new contract/pass-through behavior.
- Record any plan deviation in `progress.md` before broadening scope.

## Step 7 — Static verification

Run:

```bash
bun run build
```

Pass criteria:

- `tsc --noEmit` exits zero.
- Existing callers require no edits.
- `AgentSeat` derives correctly from the tuple.
- Optional fields satisfy exact optional-property settings in the repository.

## Step 8 — Review the diff for scope and shape

Inspect:

```bash
git diff -- src/play/agent-seat.ts src/play/agent-seat.test.ts src/play/project-context.ts
git status --short
```

Checks:

- No later-ticket file changed.
- No package/generated file changed unexpectedly.
- Ticket phase/status remains untouched by this worker.
- Existing Lisa-owned epic/story/ticket state remains present and unstaged.
- The bare assembly return has no `agent` own property.
- The known-seat vocabulary appears once in production code.

## Step 9 — Write implementation progress

Create/update `docs/active/work/T-069-01-01/progress.md`.

Record:

- each completed plan step;
- focused test counts/results;
- typecheck result;
- any deviations and rationale;
- full-gate result once available;
- commit result once available.

The progress artifact must remain honest if any check fails.

## Step 10 — Run the repository gate

Run:

```bash
bun run check
```

This performs:

1. BAML code generation;
2. TypeScript typecheck;
3. Full Bun test suite.

Pass criteria:

- Command exits zero.
- No generated drift remains unless it was already tracked and expected.
- New tests are included in the full suite.
- Existing behavior remains green.

If BAML generation changes files unexpectedly:

- Inspect rather than blindly stage.
- Revert only ticket-generated incidental drift with a safe patch if necessary.
- Never overwrite unrelated user/Lisa changes.

## Step 11 — Self-review implementation

Assess:

- acceptance criterion line by line;
- pure-core/impure-shell boundary;
- exact absence semantics;
- downstream import usability;
- out-of-slice exclusions;
- test cleanup and determinism;
- open concerns or limitations.

Run a final focused test if review causes any edit.

## Step 12 — Write Review artifact

Create `docs/active/work/T-069-01-01/review.md` containing:

- outcome summary;
- files created/modified/deleted;
- acceptance mapping;
- test coverage and command results;
- scope exclusions;
- open concerns/TODOs;
- critical-issue statement;
- commit handoff.

Do not claim acceptance if the full gate is red.

## Step 13 — Commit completed ticket work

Stage explicit ticket-owned paths only:

- `src/play/agent-seat.ts`;
- `src/play/agent-seat.test.ts`;
- `src/play/project-context.ts`;
- `docs/active/work/T-069-01-01/*.md`.

Do not stage:

- `docs/active/tickets/T-069-01-01.md` phase transition;
- `docs/active/epic/E-069.md`;
- `docs/active/stories/S-069-01.md`;
- any other concurrent work.

Use a ticket-scoped commit message.

The pre-commit hook may run checks; do not bypass it.

After committing:

- verify `git status --short` contains only preserved Lisa/concurrent state;
- record commit hash in `progress.md`/`review.md` only if doing so does not require an unnecessary
  post-completion artifact commit cycle; otherwise report it in the final handoff.

## Test matrix

| Behavior | Test level | Expected |
|---|---|---|
| Constant vocabulary | pure unit | exactly `["claude", "codex"]` |
| Unknown lookup | pure unit | `"gpt"` |
| Claude lookup | pure unit | `null` |
| Codex lookup | pure unit | `null` |
| Supplied agent transport | temp-fs unit | own key with `"codex"` |
| Absent agent access | temp-fs unit | `undefined` |
| Absent agent shape | temp-fs unit | no own key, exact legacy object |
| Existing snapshot behavior | regression unit | unchanged |
| Compile compatibility | typecheck | zero errors |
| Repository integration | full gate | all tests green |

## Completion standard

The ticket is complete only when:

- all six RDSPI artifacts exist;
- code and tests meet the acceptance criterion;
- `bun run check` is green;
- review is honest about limitations;
- ticket-owned changes are committed;
- no ticket phase/status field was manually changed.
