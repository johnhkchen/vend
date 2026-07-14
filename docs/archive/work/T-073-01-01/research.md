# Research — T-073-01-01

## Assignment and phase constraints

- The ticket starts in research and must pass continuously through all six RDSPI phases.
- Attempt artifacts belong only in .lisa/attempts/T-073-01-01/1/work/.
- Lisa publishes admitted artifacts and advances ticket frontmatter.
- Source must be committed through lisa commit-ticket with exact include paths.
- Concurrent Lisa changes to this ticket and T-073-01-02 are not ticket-owned source edits.

## Story contract

- Parent story S-073-01 routes a completed cast diff for cross-review.
- This ticket owns only the first, independent diff-capture seam.
- T-073-01-02 independently resolves the complement seat.
- T-073-01-03 later consumes the diff reference for a review request.
- T-073-01-04 later records the cross-vendor verdict.
- Verdict enforcement is explicitly deferred to S-073-02.
- The later reviewer is context-complete and single-turn, so capture must preserve concrete patch content.
- The proof must be free: stub executor and temporary Git repository.

## Charter and vision constraints

- P3 requires durable gate evidence rather than transient console output.
- P6 requires capture to be independent of executor implementation.
- P5 favors a repository-local artifact reference.
- N4 means Vend orchestrates capture/routing but does not review.
- The generic cast path must remain play-agnostic and executor-agnostic.

## Existing cast path

- src/engine/cast.ts is the impure generic cast shell.
- It resolves an executor, dispenses, parses, gates, calls play.effect, and appends one record.
- projectRoot anchors transcripts, MCP config, effect context, and the default ledger.
- The effect runs only when the pure classifier authorizes materialization.
- Contracted failures are returned as data; unexpected I/O failures throw.
- After effect, castPlay lifts routing metadata and produced from EffectResult.
- The final appendRunLog is the single normal-path persistence point.
- RunSummary returns outcome, materialization, chain handle, and actual usage.

## Existing pure core

- src/engine/cast-core.ts owns decisions expressible over plain values.
- It has no filesystem or subprocess imports.
- Its tests cover classification, gates, tool resolution, seats, progress, and formatting.
- Git inspection and patch persistence are inherently impure and do not belong there.

## EffectResult contract

- EffectResult is declared in src/engine/play.ts.
- ok states whether the effect landed.
- outcome optionally relabels the run.
- detail supplies the human effect line.
- artifacts lists all files written for provenance.
- produced is deliberately distinct: one canonical chain handle.
- Existing concrete file-writing effects report paths in artifacts.
- boardPlanPlay writes a story and ticket and reports both paths.
- echoPlay writes nothing and reports no artifacts.
- Those fixtures exactly provide positive and negative acceptance cases.

## Run log contract

- src/log/run-log.ts owns input and normalized RunRecord shapes.
- buildRunRecord is pure and freezes normalized data.
- serializeRunRecord emits one JSONL line.
- reviveRecord tolerates absent or malformed optional historical metadata.
- Existing optional facts use omission for unknown/not-applicable.
- seatOfExecution is a close precedent: preserve a non-empty raw string, omit absence.
- Additive optional fields have retained schema version 1.

## Artifact conventions

- Transcripts default under <root>/.vend/transcripts/<runId>.jsonl.
- The ledger defaults under <root>/.vend/runs.jsonl.
- Effect artifacts may be absolute paths returned by effects.
- There is no captured-patch module or field.
- A .vend-relative patch path matches local run evidence and avoids inline ledger bulk.

## Git behavior

- git diff HEAD -- <paths> captures tracked modifications/deletions.
- Plain git diff does not include untracked files.
- Newly materialized story/ticket files are normally untracked.
- git diff --no-index /dev/null <file> produces a standard new-file patch.
- Its status 1 means differences exist, not an operational failure.
- Argument arrays avoid shell interpolation.
- --binary, --no-ext-diff, and --no-color make review evidence self-contained.
- Effect-reported paths bound capture and avoid unrelated local work.
- Absolute paths must become root-relative Git pathspecs.
- Paths outside projectRoot cannot be captured from that repository.

## Test seam

- src/engine/cast.test.ts already uses stub executors and temporary directories.
- boardPlanPlay writes two real files and reports them.
- echoPlay is a true no-op effect.
- The helper tmp directory currently is not a Git repository.
- A fixture helper can initialize Git and make a baseline commit with local identity.
- Positive assertions should check summary, record, revival, and patch content.
- Negative assertions should check omission and absence of the patch file.

## Boundaries and assumptions

- Only completed successful effects can produce a captured patch.
- Stopped casts never call an effect and have no patch.
- An ok:false effect did not land and should not yield a reference.
- Effects must honestly report written files in artifacts.
- Pre-existing edits to the same reported path cannot be separated by a final worktree patch.
- This slice does not add clean-worktree enforcement.
- Routing, verdict parsing, and enforcement are deferred.
- No executor interface or BAML change is needed.

## Files in scope

- src/engine/cast.ts: capture after landed effect; log and return reference.
- src/engine/cast-diff.ts: isolated impure Git/artifact helper.
- src/log/run-log.ts: optional field, normalization, revival.
- src/engine/cast.test.ts: temp-Git positive/no-op integration proof.
- src/log/run-log.test.ts: focused pure round-trip proof if useful.

## Risks

- Missing untracked handling fails the primary board-writing case.
- Capturing the whole tree can leak unrelated changes.
- Writing before capture can capture the patch artifact itself.
- An empty file reference violates empty/omitted semantics.
- Treating no-index status 1 as error rejects every new-file patch.
- Staging to expose untracked files mutates user index state.
- Inline patch payloads bloat every ledger consumer.
- Missing revival loses the field before downstream routing.

## Conclusion

The necessary orchestration seams already exist. The effect reports written files, the cast shell has project/run identity and owns I/O, and the run log supports optional facts. The missing substrate is bounded Git patch capture immediately after a successful effect, durable storage under .vend, and propagation through the returned summary and ledger boundaries.

