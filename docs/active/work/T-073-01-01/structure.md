# Structure — T-073-01-01

## Create src/engine/cast-diff.ts

Purpose: impure shell that turns effect-reported paths into one durable Git patch reference.

Public interface:

```ts
export interface CaptureEffectDiffInput {
  readonly projectRoot: string;
  readonly runId: string;
  readonly artifacts?: readonly string[];
}

export async function captureEffectDiff(
  input: CaptureEffectDiffInput,
): Promise<string | undefined>
```

Responsibilities:

- Normalize/deduplicate artifact paths under project root.
- Return undefined for no usable paths.
- Determine tracked versus untracked candidates.
- Capture tracked changes relative to HEAD.
- Capture untracked files as no-index patches.
- Join patches deterministically.
- Persist only non-empty content.
- Return a project-relative reference.
- Propagate unexpected Git/filesystem failures.

Non-responsibilities:

- Calling or judging the play effect.
- Appending the ledger.
- Routing executors.
- Parsing review verdicts.

Internal pieces:

- Subprocess result helper using Bun.spawn.
- Path normalization helper.
- Tracked-path query.
- No-index helper with explicit accepted statuses.
- Stable artifact directory and Git flags.

## Modify src/engine/cast.ts

Imports:

- captureEffectDiff from ./cast-diff.ts.

RunSummary:

- Add optional readonly capturedDiff?: string.
- Document it as repository-relative durable patch evidence.
- Present only for landed effects with non-empty patch.

Effect block:

- Add local capturedDiff state beside produced.
- After play.effect resolves and only when eff.ok, call helper with root, runId, artifacts.
- Keep produced and routing behavior unchanged.
- Do not capture failed effects.

Ledger append:

- Conditionally spread capturedDiff into RunRecordInput.
- Preserve all current optional markers.

Return:

- Expose the same reference on RunSummary.
- Preserve actuals and chain behavior.

Early andon path remains unchanged because no effect ran.

## Modify src/log/run-log.ts

RunRecordInput:

- Add optional readonly capturedDiff?: string.

RunRecord:

- Add same optional field and omission documentation.

Normalization:

- Add normalizeCapturedDiff(value: unknown).
- Preserve non-empty strings.
- Omit empty/malformed values.
- Do not check filesystem existence in the pure layer.

buildRunRecord:

- Normalize and conditionally spread the field.

reviveRecord:

- Normalize parsed optional metadata and conditionally spread it.
- Never reject an otherwise useful record due to malformed optional metadata.

Schema remains version 1.

## Modify src/engine/cast.test.ts

Git fixture:

- Add initGitRepo(root).
- Run git init.
- Write/commit a baseline or make empty commit.
- Supply local identity per command.
- Ensure HEAD exists.

Positive test:

- Reuse boardPlanPlay and stub executor.
- Initialize Git.
- Cast.
- Assert summary reference exists.
- Assert raw record has identical value.
- Assert reviveRecord retains it.
- Resolve/read patch and assert both story and ticket occur.

Negative test:

- Reuse echoPlay no-op.
- Initialize Git.
- Cast successfully.
- Assert summary/raw/revived omission.
- Assert the run patch does not exist.

## Modify src/log/run-log.test.ts

Focused cases:

- buildRunRecord preserves a non-empty reference.
- Empty reference is omitted.
- reviveRecord preserves valid and omits malformed values.

## Dependency direction

```text
play effect
    │ EffectResult.artifacts
    ▼
cast.ts ─────► cast-diff.ts ─────► git + filesystem
    │
    ├──── capturedDiff ────► RunSummary
    │
    └──── capturedDiff ────► run-log.ts ────► runs.jsonl
```

- cast-diff imports no play/executor implementation.
- run-log imports no engine module.
- cast-core stays pure and unchanged.
- Concrete plays stay unchanged.

## Data invariants

- capturedDiff refers to non-empty persisted content when returned.
- Reference is repository-relative.
- No field means no routable patch.
- Empty string is never serialized.
- Only successful effects can produce it.
- Only reported paths inside root are candidates.
- produced remains independent.
- artifacts remains many-file provenance.

## Ordering

1. Add ledger shape/normalization.
2. Add Git helper.
3. Wire successful effect branch.
4. Add integration and pure tests.
5. Run focused tests/typecheck.
6. Run full check.
7. Commit cohesive source unit with exact paths.
8. Verify ticket-owned paths clean.
9. Write review artifact.

## Commit boundary

One cohesive vertical unit:

```text
lisa commit-ticket --ticket-id T-073-01-01 \
  --message "feat(engine): capture cast diff artifact" \
  --include src/engine/cast-diff.ts \
  --include src/engine/cast.ts \
  --include src/log/run-log.ts \
  --include src/engine/cast.test.ts \
  --include src/log/run-log.test.ts
```

Attempt artifacts are excluded; Lisa publishes them.

## Compatibility

- Existing effects need no changes.
- Existing RunSummary callers remain valid.
- Historical ledger lines revive without the field.
- Existing readers ignore additive JSON.
- No executor/CLI/BAML changes.

## Review focus

- Untracked new files appear in patch.
- No ordinary index mutation.
- No patch/reference for no-op effect.
- Reviver retains field.
- Capture is bounded to reported paths.
- Concurrent ticket frontmatter remains untouched.

