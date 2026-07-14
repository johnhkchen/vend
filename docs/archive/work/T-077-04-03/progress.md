# Progress — T-077-04-03

## Status

Implementation is complete.

- Probe core and focused tests are committed.
- CLI composition and real-process smoke are committed.
- The full repository gate is green.
- All ticket-owned source paths are clean.
- Review artifacts remain to be written.

## Source unit 1 — resumable-decompose probe

Created:

```text
src/doctor/resumable-decompose-probe.ts
src/doctor/resumable-decompose-probe.test.ts
```

Commit:

```text
0281252 feat(doctor): report resumable decompose drafts
```

The commit was created through `lisa commit-ticket` with exactly those two include paths.

## Probe implementation

`src/doctor/resumable-decompose-probe.ts` now provides:

- `RESUMABLE_DECOMPOSE_CHECK` as the stable `resumable-decompose` prefix;
- `RESUMABLE_DECOMPOSE_OK` as the explicit green no-draft name;
- `ResumableDecomposeProbeDeps` with an injectable `loadDrafts` boundary;
- a default loader using the public `loadDecomposeDrafts()` store API;
- `resumableDecomposeChecks(records)` as the pure fact-to-check bridge;
- `probeResumableDecompose(deps?)` as the total impure shell.

The module remains separate from `doctor-probe.ts` and therefore from cast preflight.

## Check behavior

For an active draft belonging to `E-077`, the probe emits:

```text
resumable-decompose: E-077
resume with `vend run decompose-epic E-077 --resume`
```

The check is red, so the existing doctor renderer produces exit code 1.

A readable active-state view with no records emits one green check:

```text
resumable-decompose: no drafts
```

A rejected store read becomes a red check:

```text
resumable-decompose: drafts readable
repair the decompose draft store: <error>
```

No loader error escapes as a stack trace.

## Multiple checkpoint behavior

The pure mapper selects one latest active record per epic.

- Repeated failed attempts for one epic create one recovery check.
- Multiple epics create one check apiece.
- Representative ordering follows the positions of the latest active records.
- No timestamp comparison or graph join was introduced.
- No parsed draft, gate finding, or repair metadata is exposed in doctor output.

The store remains the authority for active versus settled state.

## Focused core coverage

Command:

```bash
bun test src/doctor/resumable-decompose-probe.test.ts
```

Result:

```text
4 pass
0 fail
12 expect() calls
```

Cases proved:

1. a persisted draft emits the exact red epic check;
2. the hint contains the complete literal resume command;
3. the rendered report is failed with `EXIT_FAILED`;
4. an empty readable store emits the stable green check;
5. the empty report uses `EXIT_OK`;
6. repeated attempts are deduplicated per epic;
7. multiple epic commands target their matching epic;
8. a loader fault resolves to an actionable red check.

## Source unit 2 — CLI wiring and smoke

Modified:

```text
src/cli.ts
src/doctor/doctor-cli.smoke.test.ts
```

Commit:

```text
f00a8f9 feat(cli): wire resumable decompose doctor check
```

The commit was created through `lisa commit-ticket` with exactly those two include paths.

## CLI composition

The normal build-workspace doctor branch now lazily imports three independent probes:

1. `probeDoctor()` for runtime/executor dependencies;
2. `probeBoardHygiene()` for canonical graph hygiene;
3. `probeResumableDecompose()` for active local recovery state.

They execute together through `Promise.all` and concatenate in that order.

The kitchen workspace branch remains unchanged and continues to call only `probeKitchen`.

`probeDoctor` itself was not changed. Cast preflight therefore does not gain the new recovery
condition and cannot be blocked by it.

## Smoke test implementation

The existing doctor spawn helper now accepts an optional cwd. Existing cases omit it and retain
their original behavior.

The new smoke:

1. creates a unique temporary project root;
2. writes a valid checkpoint to `<root>/.vend/decompose-drafts.jsonl` through the public writer;
3. spawns the real `bun run src/cli.ts doctor` entry with that cwd;
4. observes exit code 1;
5. observes `✗ resumable-decompose: E-077` in stdout;
6. observes `vend run decompose-epic E-077 --resume` in stdout;
7. proves stdout and stderr contain no stack frame or unhandled error;
8. removes the fixture in `finally`.

The test lets the CLI use the default relative store path, so it proves real cwd-backed wiring.

## CLI smoke result

Command:

```bash
bun test src/doctor/doctor-cli.smoke.test.ts
```

Result:

```text
3 pass
0 fail
16 expect() calls
```

This includes the two existing host-aware doctor smoke cases plus the persisted-draft acceptance
case.

## Doctor regression slice

Command:

```bash
bun test src/doctor/resumable-decompose-probe.test.ts \
  src/doctor/board-hygiene-probe.test.ts \
  src/doctor/doctor-probe.test.ts \
  src/doctor/doctor-core.test.ts
```

Result:

```text
44 pass
0 fail
196 expect() calls
```

This verifies the new probe, existing board-hygiene wording, dependency/capability checks, and the
shared report/exit-code model together.

## Type verification

Command run after each source unit:

```bash
bun run check:typecheck
```

Result both times:

```text
$ tsc --noEmit
exit 0
```

## Concurrent lifecycle integration

T-077-04-02 was running concurrently as authorized by the story DAG.

Its source changes were never edited or included by this ticket. During this implementation it
landed:

```text
f9d6059 feat: settle resumable decompose drafts
```

That commit extends the JSONL ledger with settlement rows while retaining the public
`ReadDecomposeDraftsResult` shape. `readDecomposeDrafts` now reconciles settlement rows and
`loadDecomposeDrafts` returns active records only.

The new doctor probe consumes exactly that public active-state view. Therefore:

- failed/interrupted drafts remain red;
- successfully settled drafts disappear into the green no-draft condition;
- no lifecycle logic is duplicated in doctor code;
- no code deviation was required after the concurrent commit.

## Full repository gate

Command:

```bash
bun run check
```

Result:

```text
BAML client generation: pass
TypeScript typecheck: pass
Bun full suite: 1805 pass, 1 skip, 0 fail
Assertions: 5709
Files: 119
Exit: 0
```

The single skipped integration test is the repository's existing expected skip when local `dist/`
artifacts are absent.

## Acceptance audit

### Red condition on persisted draft

Met. The pure test and CLI smoke both observe `resumable-decompose: E-077` as a failed check.

### Literal resume command in hint

Met. Both test layers assert `vend run decompose-epic E-077 --resume` contiguously.

### Probe mirrors board hygiene

Met. The module has:

- its own doctor-only file;
- an injectable loader dependency;
- a pure fact-to-check bridge;
- a total catch-to-red impure probe;
- an explicit green state;
- focused in-memory tests.

### Wired alongside board hygiene

Met. `src/cli.ts` invokes the probe as a third sibling in the same `Promise.all`.

### Not in `probeDoctor`

Met. `src/doctor/doctor-probe.ts` has no ticket diff.

### Core and smoke tests

Met. Four core tests and one new real-process smoke cover the accepted behavior.

## Worktree ownership

Ticket-owned source is committed and clean.

The remaining visible worktree state belongs to Lisa orchestration/publication:

- `.lisa/provenance.jsonl`;
- ticket phase files for T-077-04-02 and T-077-04-03;
- automatically published/untracked `docs/active/work/T-077-04-02/`;
- automatically published/untracked `docs/active/work/T-077-04-03/`.

This ticket did not stage, commit, revert, or rewrite those paths.

## Deviations from plan

- The lifecycle commit landed between this ticket's two source commits.
- Its public loader contract remained compatible and improved the active-state semantics expected
  by the probe.
- No planned ticket file or behavioral boundary changed.
- No extra source unit was required.

## Remaining work

- Write `review.md`.
- Write `review-disposition.json`.
- Stop on T-077-04-03 and let Lisa verify/publish/complete it.
