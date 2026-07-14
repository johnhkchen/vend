# T-076-02-02 Progress — ledger line and artifact survive settlement throw

## Status

Implementation is complete, committed, and verified on the committed state.

The source unit contains five ticket-owned files:

- `src/engine/cast.ts`
- `src/engine/cast.test.ts`
- `src/engine/cast-diff.ts`
- `src/log/run-log.ts`
- `src/log/run-log.test.ts`

The mandatory repository gate is green before and after the exact Lisa source commit. Only the
Review artifact remains.

## Workflow completion

- Research complete: mapped the post-effect ordering and existing test seams.
- Design complete: selected guarded tail + durable discrepancy + atomic diff publication.
- Structure complete: fixed the five-file unit and module boundaries.
- Plan complete: defined red proof, implementation order, verification, and commit command.
- Implement source complete.
- Review remains after commit and final verification.

All phase artifacts are in `.lisa/attempts/T-076-02-02/1/work/` as required.
Lisa independently published admitted phase artifacts under `docs/active/work/T-076-02-02/`.
This worker did not write directly to that shared location.

## Red proof

The test was added before production behavior:

```bash
bun test src/log/run-log.test.ts src/engine/cast.test.ts \
  --test-name-pattern "artifactDiscrepancy|non-reviewer settlement throw"
```

Observed result before implementation:

```text
1 pass
2 fail
```

The schema failure showed `built.artifactDiscrepancy` was `undefined`.

The real cast failure proceeded through:

1. stub primary dispense;
2. parse and fixture gate clear;
3. real story/ticket effect;
4. real Git diff capture;
5. complement registry resolution;
6. removal of the captured patch;
7. production `readFile` throwing `ENOENT`.

The cast rejection itself was expected. The acceptance failure was the subsequent read of
`runs.jsonl`: it also threw `ENOENT` because no ledger file existed. This reproduced the field
defect without model tokens or a production-only injection seam.

## Run-log schema implementation

Added exported `ArtifactDiscrepancy`:

```ts
interface ArtifactDiscrepancy {
  readonly reference: string;
  readonly reason: string;
}
```

Threaded it through:

- `RunRecordInput`;
- `RunRecord`;
- `buildRunRecord`;
- `reviveRecord`.

Added `normalizeArtifactDiscrepancy`, following existing optional structured-marker conventions.

The normalizer:

- requires a non-null object;
- requires non-empty `reference` and `reason` strings;
- reconstructs exactly those two keys;
- drops unknown nested metadata;
- omits partial or malformed markers without losing the base row.

Ordinary and historical rows omit the new field and retain their prior serialization.

## Atomic diff publication

Changed `captureEffectDiff` to write a unique temporary sibling and then rename it to the final
`.vend/artifacts/<run>.diff` destination.

The sequence is:

1. assemble complete patch bytes;
2. create the artifact directory;
3. write `<destination>.<uuid>.tmp`;
4. rename the sibling to the final destination;
5. return the reference.

On write or rename failure, temporary cleanup is best-effort and the original failure is rethrown.
No fallible operation occurs between successful rename and reference return.

This prevents a failed diff write from leaving a partial final `.diff` name with no row.

## Settlement guard implementation

`castPlay` now snapshots primary execution facts before post-effect settlement:

- logged model;
- turns used;
- usage;
- cost;
- reduced-grounding state.

The `play.effect` await remains outside the new guard. This preserves the established honest
boundary for uncontracted effect throws, where the shell cannot know whether an ambiguous effect
partially landed.

Once the effect resolves, the guarded region contains:

- authoritative effect-result projection;
- diff capture;
- effect presentation;
- complement resolution;
- patch loading;
- reviewer dispense and named failure conversion;
- cross-review settlement;
- terminal andon/warning/turn presentation.

The reviewer-specific inner catch from `T-076-02-01` is unchanged in semantics. A resolved
reviewer that fails still becomes `missing-capability` and the cast resolves.

The outer catch is only for unexpected settlement defects. It:

- remembers that a throw occurred separately from the thrown value, so `throw undefined` is still
  representable;
- retains the original thrown value;
- changes the durable terminal outcome to `errored`;
- preserves already-observed gate evidence.

The finally block:

1. reconciles any captured diff reference with the filesystem;
2. selects either available `capturedDiff` or `artifactDiscrepancy`;
3. stamps `endedAt` once;
4. appends exactly one terminal row with primary usage/cost and settlement facts.

After a successful append, the original unexpected settlement value is rethrown. The caller still
sees the real defect; the ledger no longer loses the spent run.

## Artifact reconciliation

Added private `reconcileCapturedDiff` in the impure cast shell.

It returns:

- `{}` when capture produced no reference;
- `{ capturedDiff: reference }` when the path is accessible;
- `{ artifactDiscrepancy: { reference, reason } }` when it is unavailable.

The stable reason is:

```text
captured-diff-unavailable-at-settlement
```

The record assembly spreads only the reconciled reference. A path this cast already knows is
missing is never persisted under `capturedDiff`.

## Test coverage added

### Pure run-log tests

Added two tests:

1. complete discrepancy survives build/serialize/revive and extra nested keys are dropped;
2. absence, partial build input, and malformed revived metadata omit the marker without losing the
   row.

### Full cast integration test

Added one real-Git test:

```text
castPlay: a non-reviewer settlement throw writes an errored row and records a missing diff discrepancy
```

It asserts:

- original cast promise rejects with error code `ENOENT`;
- reviewer dispense was never called;
- exactly one row exists;
- row run id matches;
- outcome is `errored`;
- input/output usage is 7/3;
- cost is 0.001;
- base `fixture-contract` gate evidence survives;
- `capturedDiff` is absent;
- discrepancy reference and reason are exact;
- `reviveRecord` preserves the discrepancy;
- no cross-vendor verdict is fabricated;
- no skipped-review marker is fabricated;
- final diff file is absent.

Existing successful diff-capture coverage proves the other consistency branch: artifact present
and the same `capturedDiff` reference on summary and row.

## Focused verification

Targeted post-implementation command:

```bash
bun test src/log/run-log.test.ts src/engine/cast.test.ts \
  --test-name-pattern "artifactDiscrepancy|non-reviewer settlement throw"
```

Result:

```text
3 pass
0 fail
21 expect() calls
```

Typecheck:

```bash
bun run build
```

Result: exit 0.

Complete focused suites:

```bash
bun test src/log/run-log.test.ts src/engine/cast.test.ts
```

Result:

```text
141 pass
0 fail
459 expect() calls
```

This includes existing successful diff, empty diff, reviewer pass, reviewer fail, reviewer
unreachable, inert complement resolution, token overshoot, timeout, seat, and grounding cases.

Static check:

```bash
git diff --check -- \
  src/engine/cast.ts \
  src/engine/cast.test.ts \
  src/engine/cast-diff.ts \
  src/log/run-log.ts \
  src/log/run-log.test.ts
```

Result: exit 0, no output.

## Full repository gate

Command:

```bash
bun run check
```

Result: exit 0.

The gate completed:

- BAML generation;
- TypeScript typecheck;
- full Bun test suite.

Suite result:

```text
1740 pass
1 skip
0 fail
5432 expect() calls
116 test files
```

The one skip is the existing release acceptance integration that requires absent `dist/`
artifacts. It is unrelated to this ticket and unchanged.

## Deviations

No scope or architecture deviation from Design/Structure/Plan.

One implementation detail was made explicit beyond the initial pseudocode: a separate
`settlementThrew` boolean accompanies `settlementError`. This preserves a deliberately thrown
`undefined` value, which an `error !== undefined` sentinel would accidentally swallow. The behavior
strengthens the planned original-error preservation without changing the design.

## Honest boundary

- An unwritable ledger path can still prevent the row from landing; no code can record into a
  storage destination that refuses the append.
- The artifact availability check and JSONL append are separate filesystem operations. The ticket
  guarantee covers this cast's own failure ordering, not an unrelated external process deleting the
  file after verification.
- Uncontracted `play.effect` throws retain prior behavior because effect landing is ambiguous.
- The next ticket owns default-config real-fetch/no-listener characterization.

## Repository hygiene before commit

Expected Lisa-owned changes remain:

- `.lisa/provenance.jsonl` modified;
- `docs/active/tickets/T-076-02-02.md` modified;
- Lisa-published `docs/active/work/T-076-02-02/` present.

The five source/test files are modified and ticket-owned.

The ordinary Git index is empty.

No `git add`, `git add -A`, ordinary `git commit`, reset, or checkout command was used.

## Source commit

```bash
lisa commit-ticket \
  --ticket-id T-076-02-02 \
  --message "fix(engine): preserve ledger across settlement errors (T-076-02-02)" \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts \
  --include src/engine/cast-diff.ts \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts
```

Result:

```text
018a5906e771ba82f2c53cde5c6f6b793795901b
```

Commit:

```text
018a590 fix(engine): preserve ledger across settlement errors (T-076-02-02)
```

`git show --name-only` confirms exactly the five planned source/test paths.

Post-commit worktree audit confirms:

- every ticket-owned source path is clean;
- the ordinary Git index is empty;
- only Lisa-owned ticket/provenance and published-work state remain outside the commit.

## Post-commit gate

Ran `bun run check` again at `018a590`.

Result: exit 0.

```text
1740 pass
1 skip
0 fail
5432 expect() calls
116 test files
```

The skip remains the unchanged `dist/`-dependent release acceptance integration.

## Remaining

1. Write `review.md`.
2. Confirm all six private artifacts exist.
3. Stop on this ticket for Lisa completion handling.
