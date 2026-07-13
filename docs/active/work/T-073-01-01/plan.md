# Plan — T-073-01-01

## Goal

Deliver a tested vertical slice: a successful cast effect writing reported files produces a durable non-empty Git patch reference on returned summary and ledger; a no-op effect leaves both shapes unchanged.

## Step 1 — ledger field

Modify src/log/run-log.ts:

- Add optional capturedDiff to RunRecordInput and RunRecord.
- Add non-empty-string normalization.
- Preserve in buildRunRecord and reviveRecord.
- Omit empty/malformed values.

Tests:

- Valid reference serializes.
- Empty input omits.
- Malformed parsed metadata omits.

## Step 2 — bounded patch capture

Create src/engine/cast-diff.ts:

- Define input.
- Normalize artifact paths against root.
- Ignore paths outside root.
- Deduplicate.
- Return undefined for no candidates.
- Divide tracked and untracked paths.
- Capture tracked changes against HEAD with binary/no-color/no-ext-diff.
- Capture untracked files against /dev/null with --no-index.
- Accept no-index status 1 as useful.
- Assemble non-empty segments.
- Write .vend/artifacts/<runId>.diff only when non-empty.
- Return repository-relative reference.

Verification:

- Integration test drives real helper through effect.
- New untracked files must appear.
- Process failures must be actionable.

## Step 3 — wire cast

Modify src/engine/cast.ts:

- Import helper.
- Extend RunSummary.
- Declare local reference state.
- Capture after successful effect using eff.artifacts.
- Do not capture failed/stopped effects.
- Pass reference to appendRunLog only when defined.
- Return it to caller.

Regression expectations:

- echo cast remains successful.
- chain produced behavior is unchanged.
- andon/timeout paths omit new field.

## Step 4 — acceptance integration

Modify src/engine/cast.test.ts:

- Add Git fixture setup.
- Initialize a temp repo with HEAD.
- Cast boardPlanPlay using stub.
- Assert returned reference.
- Read patch and assert both files.
- Read JSONL and assert same reference.
- Revive and assert preservation.
- Cast echoPlay in separate Git repo.
- Assert summary/raw/revived omission.
- Assert no run patch exists.

Focused command:

```text
bun test src/engine/cast.test.ts src/log/run-log.test.ts
```

## Step 5 — focused checks

Run:

```text
bun run check:typecheck
bun test src/engine/cast.test.ts src/log/run-log.test.ts
```

Inspect:

- Bun subprocess typings.
- Git status handling.
- Absolute/relative paths.
- Artifact directory interference.
- Optional-field exactness.

## Step 6 — full gate

Run:

```text
bun run check
```

This includes BAML generation, typecheck, and full tests. Do not absorb unrelated generated churn.

## Step 7 — progress and commit

Write progress.md with completed work, tests, deviations, and limitations.

Inspect:

```text
git status --short
git diff -- src/engine/cast-diff.ts src/engine/cast.ts src/log/run-log.ts src/engine/cast.test.ts src/log/run-log.test.ts
```

Commit only exact ticket-owned paths:

```text
lisa commit-ticket \
  --ticket-id T-073-01-01 \
  --message "feat(engine): capture cast diff artifact" \
  --include src/engine/cast-diff.ts \
  --include src/engine/cast.ts \
  --include src/log/run-log.ts \
  --include src/engine/cast.test.ts \
  --include src/log/run-log.test.ts
```

Never use ordinary git add or git commit.

## Step 8 — post-commit

- Confirm ticket-owned source paths are clean.
- Confirm concurrent frontmatter changes untouched.
- Record commit identifier.
- Private attempt artifacts remain Lisa-owned and uncommitted.

## Step 9 — review

Write review.md with:

- Exact files changed.
- Capture and omission behavior.
- Test evidence and full gate.
- Commit method/id.
- Limitations.
- Honest acceptance result.
- Explicit downstream out-of-slice work.

Then stop on this ticket.

## Acceptance matrix

| Case | Effect | Patch | Summary | RunRecord |
|---|---|---|---|---|
| New reported files | ok:true, artifacts | non-empty | present | present |
| Tracked modification | ok:true, artifacts | non-empty | present | present |
| Reported unchanged file | ok:true, artifacts | empty | omitted | omitted |
| No-op | ok:true, no artifacts | none | omitted | omitted |
| Failed effect | ok:false | not attempted | omitted | omitted |
| Stop/timeout | no effect | not attempted | omitted | omitted |

## Rollback

The feature is additive. Removing helper call and optional fields restores prior behavior; old readers tolerate unknown additive JSON. No migration or index mutation is introduced.

