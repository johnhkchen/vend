# Review — T-073-01-01

## Outcome

PASS. The ticket acceptance criterion is met.

A cast running in a temporary Git repository through the existing stub executor now captures the non-empty patch produced by its successful file-writing effect, exposes a repository-relative capturedDiff reference through the enriched EffectResult/RunSummary path, and records the same reference on RunRecord. A successful no-op cast omits the reference and writes no patch artifact.

## Source commit

```text
81febb36e3da73a4badfca31633a379e0866a145
feat(engine): capture cast diff artifact
```

The commit was created with lisa commit-ticket and six exact repository-relative include paths. No ordinary staging or commit command was used.

## Files created

### src/engine/cast-diff.ts

New impure Git/artifact shell.

- Accepts projectRoot, runId, and EffectResult.artifacts.
- Normalizes and deduplicates paths.
- Ignores paths outside projectRoot.
- Detects whether projectRoot is a Git worktree.
- Divides reported paths into tracked and untracked.
- Captures tracked changes against HEAD.
- Captures new untracked files with git diff --no-index.
- Uses --binary, --no-color, and --no-ext-diff.
- Does not stage or mutate the ordinary index.
- Writes only non-empty content to .vend/artifacts/<runId>.diff.
- Returns a repository-relative reference.
- Returns undefined when no reported path changed or the root is not a Git worktree.

## Files modified

### src/engine/play.ts

Added optional capturedDiff to EffectResult.

Concrete effects continue to report only artifacts. The generic cast shell enriches a successful result after Git capture, preserving the pure-core/impure-shell and play-agnostic boundaries.

### src/engine/cast.ts

- Added optional capturedDiff to RunSummary.
- Captures immediately after a successful effect.
- Does not capture failed/stopped effects.
- Lifts the enriched EffectResult reference into the summary.
- Conditionally forwards it into the single normal-path ledger append.
- Leaves produced, routing metadata, metering, and outcome behavior unchanged.

### src/log/run-log.ts

- Added optional capturedDiff to RunRecordInput.
- Added optional capturedDiff to RunRecord.
- Added pure non-empty-string normalization.
- Preserves valid references through buildRunRecord.
- Preserves valid references through reviveRecord.
- Omits absent, empty, and malformed optional metadata.
- Retained schema version 1 because the field is additive and optional.

### src/engine/cast.test.ts

Added two token-free integration cases using the existing stub executor.

Positive case:

- Initializes a temporary Git repository with a real HEAD.
- Casts the board-plan fixture.
- Writes an untracked story and ticket.
- Verifies cast success and materialization.
- Verifies the returned .vend/artifacts/<runId>.diff reference.
- Reads the patch and verifies both written file paths occur.
- Verifies the raw JSONL record carries the same reference.
- Verifies reviveRecord retains it.

Negative case:

- Initializes a separate temporary Git repository.
- Casts the no-op echo effect.
- Verifies success/materialization remain unchanged.
- Verifies summary, raw record, and revived record omit capturedDiff.
- Verifies the run patch file does not exist.

### src/log/run-log.test.ts

Added focused pure coverage:

- Valid reference build/serialize/revive round-trip.
- Absent and empty reference omission.
- Malformed parsed metadata omission without record loss.

## Verification

Focused commands:

```text
bun run check:typecheck
bun test src/engine/cast.test.ts src/log/run-log.test.ts
```

Focused result:

- 122 tests passed.
- 0 failed.
- 334 assertions.

Full required gate:

```text
bun run check
```

Full result:

- BAML code generation completed.
- TypeScript completed.
- 1675 tests passed.
- 1 existing intentional integration skip.
- 0 tests failed.
- 5140 assertions across 112 files.

Hygiene:

- git diff --check passed.
- All six ticket-owned source paths are clean after commit.
- Concurrent Lisa-owned changes to provenance, ticket frontmatter, and published work artifacts were not included in the source commit.

## Acceptance evaluation

Criterion:

> A test over the cast effect path shows a cast in a temp git repo that writes files records a non-empty captured-diff reference on its EffectResult/RunRecord, while a no-op cast records an empty/omitted diff.

Evaluation:

- Temp Git repository: proven.
- Stub executor/no tokens: proven.
- Successful effect writes files: proven with story and ticket.
- Non-empty captured patch: proven by reading the referenced file and inspecting both paths.
- Effect path reference: proven by cast enrichment and RunSummary observation.
- RunRecord reference: proven in raw JSONL and revive round-trip.
- No-op omission: proven on summary, raw record, revived record, and filesystem.

Result: fully met.

## Design quality assessment

The capture boundary remains executor-agnostic. No executor interface or executor implementation changed. The effect reports plain provenance data; Git and filesystem operations remain in an impure shell. The ledger stores a compact reference instead of embedding large patch content. Capture is scoped to reported artifacts, avoiding unrelated worktree changes.

Untracked materialized files are explicitly supported without staging, which is load-bearing for the board-writing acceptance case.

## Deviations

The initial design proposed treating a non-Git root as an error. Implementation instead treats capture as inapplicable and omits capturedDiff outside a Git worktree. This preserves established local-first casts and test fixtures rooted in plain directories. Once a valid worktree is confirmed, unexpected Git/process/filesystem failures still propagate rather than silently losing evidence.

## Open concerns and limitations

- Capture relies on concrete effects accurately reporting written paths in artifacts.
- If a reported tracked path already had local changes before the effect, the final patch includes those same-path changes; no pre-effect byte snapshot is taken.
- Reported paths outside projectRoot are intentionally ignored.
- Non-Git projects receive no capturedDiff.
- The artifact lifecycle currently follows other .vend run evidence; pruning/retention is not introduced here.
- The patch filename sanitizes unusual run-id characters, while the ledger stores the resulting actual reference.

None of these limitations prevents the ticket acceptance case or the next ticket from loading a concrete patch.

## Explicitly out of slice

- Complement-seat resolution.
- Cross-review prompt construction.
- Second-seat dispense.
- Structured pass/fail verdict parsing.
- Cross-vendor verdict recording.
- Blocking enforcement.
- Per-play review rubrics.
- Live metered cross-vendor proof.

Those remain assigned to later tickets in S-073-01 and S-073-02.

## Human review focus

A reviewer should primarily confirm:

1. EffectResult.artifacts is the intended provenance boundary for capture.
2. Returning undefined in a non-Git project is the desired backward-compatible behavior.
3. The same-path pre-existing-change limitation is acceptable for this rung.
4. The .vend/artifacts reference location is suitable for the downstream cross-review module.

No critical issue requires human intervention before admission.

