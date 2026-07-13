# Research — T-079-01-01

## Assignment and phase

- Ticket: `T-079-01-01` — `settle-core-pure-verdict`.
- Parent story: `S-079-01` — `settle-verdict-is-free`.
- The ticket starts in `phase: research`.
- The assignment requires one continuous pass through all six RDSPI phases.
- Attempt artifacts belong under `.lisa/attempts/T-079-01-01/1/work/`.
- Lisa publishes admitted artifacts to `docs/active/work/T-079-01-01/`.
- The worker must not edit ticket phase or status frontmatter.
- Source commits must use `lisa commit-ticket` with exact include paths.
- The existing worktree has unrelated T-078-02-02 and Lisa-owned changes.
- Those paths must remain untouched and excluded from this ticket's commit.

## Story contract

- The story creates a new `src/settle/` slice.
- This ticket owns the pure verdict computation and its tests.
- The dependent ticket owns the `vend settle` CLI verb and filesystem effects.
- The story's settle gesture is token-free.
- It composes existing state instead of invoking an executor.
- It must report board change since the preceding settle.
- It must report per-epic cleared-ticket counts.
- It must identify epics whose tickets are all done.
- It must retain gate, presweep, and review-concern facts.
- It must produce ordered exceptions carrying exact next actions.
- A first settle must summarize the current full board.
- A malformed last-settle marker must be a named refusal, not an exception throw.
- CLI formatting, colors, executor guards, and marker filesystem writes are downstream.
- Sweep will consume this ticket's all-done derivation as its single source.
- Event triggering and loop provenance belong to S-079-03, not this ticket.

## Product and charter grounding

- The epic advances P3 by making gate state visible as structured data.
- It advances P4 by removing a human inspection step.
- The verdict does not add new judgment; it assembles machine-known facts.
- The computation therefore belongs in a deterministic pure core.
- A returned refusal follows the project's andon-as-data convention.
- Local marker state fits P5 and does not require a remote service.
- This ticket introduces no prompt, play, executor, budget, or run-log operation.
- The future one-screen rendering is a typed gesture, not a dashboard.

## Canonical board graph

- `src/graph/model.ts` defines the canonical in-memory `WorkGraph`.
- `WorkGraph` contains sorted `epics`, `stories`, and `tickets` arrays.
- It also provides a frozen `byId` record.
- `EpicNode.stories` contains resolved story objects.
- `StoryNode.tickets` contains resolved ticket objects.
- `TicketNode.storyId` retains the reverse containment id.
- Ticket dependencies and blockers remain id arrays.
- Node values are deeply frozen.
- Status, phase, priority, and type are intentionally plain strings.
- The graph loader does not narrow live vocabulary.
- `buildGraph` is pure and suitable for fixture construction.
- `src/graph/load.ts` is the one filesystem-reading graph shell.
- `loadWorkGraph` reads `docs/active/{epic,stories,tickets}`.
- The settle core should consume `WorkGraph`, not duplicate board parsing.
- The dependent CLI shell can call `loadWorkGraph` and pass the result inward.

## Meaning of done

- Ticket frontmatter carries both `status` and `phase`.
- Existing closeout machinery keys done-state on `phase === "done"`.
- `src/ci/presweep-core.ts` exports `donePhaseIds` with this exact rule.
- The sweep story explicitly says cards flip only after tickets are `phase: done`.
- Therefore settle cleared counts must also use `phase === "done"`.
- Using `status` would diverge from presweep and future sweep semantics.
- `donePhaseIds` returns ticket ids sorted.
- The graph itself already sorts tickets and child containment.
- Deterministic ordering should still be explicit at the settle boundary.

## Per-epic derivation

- An epic owns stories through `EpicNode.stories`.
- Each story owns tickets through `StoryNode.tickets`.
- Per-epic tickets can be flattened without an id join.
- The board model integrity gate prevents dangling containment.
- Cleared count is the number of flattened tickets with phase `done`.
- Total count is the number of flattened tickets.
- Cleared ticket ids are useful to future sweep provenance.
- An epic is all-done only when it has at least one ticket and every ticket is done.
- The non-empty condition avoids vacuous completion for an empty epic.
- Future sweep needs an ordered all-done epic id set.
- JSON and plain-data consumers cannot safely rely on a JavaScript `Set`.
- A sorted readonly id array is the portable representation of that set.

## Last-settle marker requirements

- The story places the durable marker under `.vend/`.
- The exact effectful read/write lifecycle belongs to T-079-01-02.
- This core needs a stable marker value contract for that shell.
- A marker must record the done-ticket frontier seen at the preceding settle.
- Computing the delta then becomes current done ids minus prior seen done ids.
- The marker does not need a clock to satisfy this ticket.
- Omitting time keeps the core deterministic and avoids an injected clock.
- A schema version permits future marker evolution to refuse clearly.
- The marker should carry a sorted, unique string array.
- Prior ids absent from the current graph should remain tolerated.
- Archived or removed historical tickets must not invalidate an otherwise useful frontier.
- Duplicate ids make the marker non-canonical and should be refused.
- Blank ids, unknown keys, wrong versions, and wrong field types are malformed.
- JSON syntax failure must be represented by the same named refusal.
- No marker is a distinct valid first-settle state, not malformed data.
- The next marker can be derived from the current done ids in the verdict.
- The shell can serialize/write it only after a successful computation.

## Board delta semantics

- With a valid prior marker, delta contains currently done ids not in that marker.
- Tickets that became undone are not “newly done” and do not enter the delta.
- The story asks specifically for tickets newly done since the marker.
- A first settle has no prior frontier.
- Its full-board summary therefore treats every currently done ticket as newly observed.
- The result should carry an explicit first-settle boolean for honest rendering.
- An empty repeated delta is represented by an empty array.
- The verdict should also carry the full current done frontier as its next marker.

## Presweep core

- `src/ci/presweep-core.ts` is pure and addon-free.
- It exports `SweepVerdict` with `ok`, `doneIds`, and `offenders`.
- `classifySweep` turns dirty source/board paths into expected andon data.
- The settle core can import `SweepVerdict` as a type-only dependency.
- It should preserve the complete supplied presweep facts.
- A false presweep verdict is an exception surfaced to the operator.
- Each offender is already a concrete path.
- A deterministic next action can name that exact path and rerun command.
- The core must not itself execute Git or presweep.
- The dependent shell owns assembling the actual presweep verdict.

## Gate result facts

- The repository has multiple unrelated `GateResult` types.
- `src/gate/gates.ts` owns a decompose-plan clearing result.
- `src/log/run-log.ts` owns individual historical gate rows.
- Settle's story-level gate line may come from an inline check or recorded result.
- T-079-01-02 explicitly retains that sourcing decision.
- Coupling this core to either existing gate shape would prematurely decide the shell policy.
- A small settle-owned summary shape can carry `ok`, a name/detail, and next action.
- The core should preserve the supplied gate summary unchanged except for defensive copying.
- A failed gate summary should produce the first ordered exception.

## Review concern facts

- RDSPI work directories publish `review.md` and `review-disposition.json`.
- The disposition contract is pass or block with an actionable reason on block.
- Review markdown commonly has an `Open concerns` section.
- Filesystem discovery and markdown/JSON loading are effect concerns.
- This ticket's acceptance requires the verdict to carry review-concern fields.
- It does not require a filesystem crawler inside the pure core.
- A plain `ReviewConcern` input keeps extraction outside and judgment inside.
- Each concern needs a stable owner id, a human-readable name, and a next action.
- The owner id lets the one-screen shell name the associated ticket.
- Concern ordering should be stable regardless of filesystem enumeration order.
- An open review concern should also become an ordered exception.

## Exception ordering

- The acceptance criterion explicitly requires an ordered exceptions list.
- Gate failure is the highest-level contract failure and should appear first.
- Presweep offenders directly contradict “done means committed” and follow.
- Review concerns follow in stable owner/name order.
- Partial epics are normal board state, not exceptions.
- A malformed marker prevents any honest delta and must refuse the whole computation.
- It should not be mixed into a possibly misleading verdict exception list.
- Every exception needs a machine-readable kind, a readable message, and exact next action.
- The renderer can color every exception red without reconstructing policy.

## Pure-core house patterns

- Core files take plain values and return fresh values.
- Expected refusals return discriminated data rather than throw.
- Programmer wiring defects may throw, but malformed persisted state is expected input.
- Effects, clocks, Git, filesystem, process, and network remain outside.
- Tests live beside the core as `*.test.ts`.
- Tests use Bun's `describe`, `test`, and `expect`.
- Exact object equality is common and pins public contracts well.
- Type-only imports preserve addon-free unit test execution.
- Production modules use readonly interfaces and discriminated unions.

## Likely ticket-owned files

- Create `src/settle/settle-core.ts`.
- Create `src/settle/settle-core.test.ts`.
- Create no effect shell in this ticket.
- Modify no CLI file in this ticket.
- Modify no graph or presweep source in this ticket.
- Modify no board frontmatter in this ticket.
- Keep all RDSPI files in the private attempt directory.

## Verification constraints

- Focused acceptance command: `bun test src/settle`.
- Type verification is required because this establishes downstream public types.
- Full gate: `bun run check`.
- The pre-commit hook also runs repository checks.
- Ambient dirty paths may make presweep unsuitable as a ticket-local cleanliness proof.
- Exact path inspection is required before and after `lisa commit-ticket`.
- No ordinary `git add` or `git commit` may be used.

## Research conclusion

- Existing graph and presweep seams provide all upstream facts this core needs.
- The missing piece is one pure normalization and derivation boundary.
- A versioned done-frontier marker is sufficient for repeatable board deltas.
- Phase-done containment yields both per-epic counts and the future sweep all-done set.
- Gate, presweep, and review inputs can remain plain facts without deciding downstream I/O.
- Named marker refusal and deterministic exception order make the result safe to render directly.
