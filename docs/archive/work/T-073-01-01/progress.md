# Progress — T-073-01-01

## Status

Implementation, verification, and the ticket source commit are complete.

## Completed

- [x] Read assignment, workflow, vision, charter, parent story, and ticket.
- [x] Mapped cast effect, EffectResult, RunSummary, and RunRecord boundaries.
- [x] Wrote research.md in the private attempt directory.
- [x] Wrote design.md in the private attempt directory.
- [x] Wrote structure.md in the private attempt directory.
- [x] Wrote plan.md in the private attempt directory.
- [x] Added src/engine/cast-diff.ts as the isolated impure Git capture shell.
- [x] Captured tracked artifact changes relative to HEAD.
- [x] Captured untracked reported artifacts using git diff --no-index.
- [x] Avoided all ordinary index mutations.
- [x] Bounded capture to EffectResult.artifacts inside projectRoot.
- [x] Persisted non-empty patches under .vend/artifacts/<runId>.diff.
- [x] Added capturedDiff to EffectResult and enriched it in the generic cast shell.
- [x] Added capturedDiff to RunSummary.
- [x] Added capturedDiff to RunRecordInput and RunRecord.
- [x] Added pure build/revive normalization with omission for empty/malformed values.
- [x] Added temp-Git cast integration proof for file-writing and no-op effects.
- [x] Added focused run-log round-trip/omission tests.
- [x] Ran focused typecheck/tests.
- [x] Ran the full repository gate.
- [x] Committed the six exact ticket-owned source paths through `lisa commit-ticket`.
- [x] Verified all six source paths are clean after commit.

## Implementation details

The effect continues to own only its declared write provenance through artifacts. After a successful effect, castPlay asks captureEffectDiff to turn those paths into patch text. The helper first confirms projectRoot is a Git worktree, divides reported paths into tracked and untracked candidates, and uses standard Git patch formats for both. It writes only after finding non-empty content.

The returned repository-relative reference enriches the EffectResult inside the cast effect path, is lifted onto RunSummary, and is conditionally included in the one normal-path ledger append. Run-log construction and revival retain non-empty strings and omit empty/malformed metadata.

## Verification evidence

Focused verification:

```text
bun run check:typecheck
bun test src/engine/cast.test.ts src/log/run-log.test.ts
```

Result:

- TypeScript: green.
- Focused tests: 122 pass, 0 fail.
- New positive case writes two untracked board files and verifies non-empty patch content, summary reference, raw ledger reference, and revived reference.
- New negative case casts a no-op effect and verifies summary/raw/revived omission plus no patch file.

Full gate:

```text
bun run check
```

Result:

- BAML generation: green.
- TypeScript: green.
- Full suite: 1675 pass, 1 intentionally skipped, 0 fail.
- 5140 assertions across 112 files.

Additional hygiene:

- git diff --check: green.
- Bun remains pinned at 1.3.13.
- No ordinary git add/commit was used.

Source commit:

```text
81febb36e3da73a4badfca31633a379e0866a145
feat(engine): capture cast diff artifact
```

## Deviations from plan/design

The initial design said an invalid/non-Git project root would propagate as an operational error. During implementation, existing integration fixtures exposed that Vend also supports casts rooted in plain temporary directories. Capture was refined to be inert outside a Git worktree, preserving existing cast behavior and matching the feature's Git-specific applicability. Unexpected Git failures after worktree confirmation still propagate.

The public EffectResult field was included explicitly, and castPlay enriches the concrete effect report after capture. This makes the requested EffectResult → RunRecord path visible without forcing each concrete effect to know Git storage details.

## Known limitations

- Capture depends on effects honestly reporting written paths in artifacts.
- A pre-existing edit to the same reported tracked path is part of the final worktree patch; this ticket does not snapshot file bytes before effect.
- Paths outside projectRoot are ignored.
- A non-Git project completes normally but has no capturedDiff.
- Review routing, complement-seat selection, verdict parsing, and enforcement remain out of this ticket.

## Remaining

- [ ] Write review.md and stop.
