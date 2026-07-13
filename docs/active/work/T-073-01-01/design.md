# Design — T-073-01-01

## Decision

Turn a successful effect's reported working-tree changes into a concrete routable patch artifact, while leaving no-op casts unchanged and preserving generic executor/play boundaries.

## Option A — inline patch in RunRecord

Advantages:

- One record contains everything.
- No missing-reference lifecycle.

Costs:

- The ticket asks for an artifact reference.
- Large changes create huge JSONL lines.
- Every analytics reader pays patch parsing/storage cost.
- Binary patches worsen duplication.

Decision: reject.

## Option B — capture the entire post-effect worktree

Advantages:

- Simple invocation.
- Does not rely on effect provenance for tracked files.

Costs:

- Plain Git diff misses untracked materialization output.
- Including all untracked files can leak unrelated work or secrets.
- Pre-existing dirt is falsely attributed to the executor seat.
- Review evidence becomes dishonest.

Decision: reject.

## Option C — snapshot the repository before and after effect

Advantages:

- Strongly isolates effect changes.
- Can detect unreported writes.

Costs:

- Full snapshots are expensive and must reproduce Git ignore/binary/symlink behavior.
- Temporary index/object approaches risk repository mutation.
- It duplicates the existing EffectResult.artifacts provenance contract.
- It is disproportionate to this ticket.

Decision: reject for this slice.

## Option D — capture only effect-reported artifact paths

After ok:true, normalize artifacts inside projectRoot. Ask Git for tracked changes and render untracked files as no-index patches. Join non-empty segments, persist once under .vend/artifacts, and return/log the relative reference. Write nothing when empty.

Advantages:

- Uses existing provenance.
- Excludes unrelated worktree changes.
- Covers modified tracked and new untracked files.
- Never stages or mutates the index.
- Produces standard context-complete patch text.
- Keeps the ledger compact.
- No-op effects naturally omit it.
- Remains executor-independent.

Costs:

- Effects that omit artifacts produce no patch.
- Pre-existing edits to the same reported file remain in final patch.
- Multiple Git invocations may be required.

Decision: choose Option D.

## Artifact location

- Store at <projectRoot>/.vend/artifacts/<runId>.diff.
- Record .vend/artifacts/<runId>.diff.
- Relative references are repository-portable and avoid temporary absolute roots.
- Create the directory only after assembling non-empty content.
- Capture before writing the patch so it cannot include itself.

## Capture timing

1. Run effect.
2. Confirm eff.ok.
3. Inspect eff.artifacts.
4. Capture patch content.
5. Persist a non-empty patch.
6. Forward reference to ledger and summary.

Stops, parse/gate failures, and failed effects remain inert.

## Git algorithm

- Resolve relative artifact paths against projectRoot.
- Keep only paths within root.
- Deduplicate in stable order.
- Divide candidates into tracked and untracked via git ls-files.
- Run git diff --binary --no-color --no-ext-diff HEAD -- <tracked>.
- Run git diff --binary --no-color --no-ext-diff --no-index -- /dev/null <untracked>.
- Accept no-index statuses 0 and 1.
- Unexpected process failures propagate.
- Join non-empty segments with one newline boundary.
- Empty output returns undefined and writes nothing.

## Non-Git roots

The acceptance and intended project path are Git repositories. A Git failure must not silently become “no diff,” because that falsely makes an unreviewable run appear inert. Missing/invalid Git context therefore propagates as an operational error.

## Public data shape

- Add optional capturedDiff?: string to RunSummary.
- Add it to RunRecordInput and RunRecord.
- Keep concrete EffectResult producers unchanged; artifacts remains their report to the shell.
- Normalize non-empty strings and omit empty/malformed values.
- Preserve through reviveRecord.
- Keep schema version 1 for additive optional compatibility.

## Pure/impure boundary

- New src/engine/cast-diff.ts owns subprocess and patch-file I/O.
- cast.ts remains orchestrator and calls one helper.
- cast-core.ts stays unchanged and pure.
- Run-log normalization remains pure.
- Tests use real Git in temp repos and a stub executor, never a model.

## Test design

Positive:

- Initialize temp Git repo with HEAD.
- Cast boardPlanPlay through stub executor.
- Assert success/materialization.
- Assert summary.capturedDiff is non-empty and relative.
- Assert emitted and revived records carry the same value.
- Read patch and assert it names both written files.

Negative:

- Initialize another temp Git repo.
- Cast echoPlay.
- Assert success is unchanged.
- Assert summary/raw/revived record omit capturedDiff.
- Assert no run patch exists.

Pure log tests:

- Preserve valid reference.
- Omit empty input.
- Omit malformed parsed metadata.

## Rejected scope

- No complement-seat resolution.
- No review prompt or second dispense.
- No verdict type or enforcement.
- No executor method.
- No per-play rubric.
- No clean-tree enforcement.
- No ordinary index mutation.

## Final design

The patch is durable run evidence indexed by an optional ledger reference. The generic shell captures only the successful effect's declared artifacts, including untracked files, without staging. Empty capture is omission. The reference is returned immediately and round-trips through the ledger for downstream routing.

