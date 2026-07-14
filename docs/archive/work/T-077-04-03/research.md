# Research — T-077-04-03

## Assignment and workflow constraints

- The ticket begins in Research and the assignment requires a continuous RDSPI pass.
- Attempt artifacts belong in `.lisa/attempts/T-077-04-03/1/work/` only.
- Lisa publishes admitted artifacts to `docs/active/work/T-077-04-03/`.
- Lisa owns ticket phase/status transitions; this worker must not edit those fields.
- Ticket source commits must use `lisa commit-ticket` with exact repository-relative includes.
- Ordinary `git add` and `git commit` are prohibited for this attempt.
- The final repository gate is `bun run check`.
- The current worktree contains Lisa-owned modifications to provenance and ticket files.
- Those existing modifications are not ticket-owned and must remain outside this ticket's commits.

## Product grounding

- Vend converts repeatable agent work into named, reusable, gated playbooks.
- Its core product promise is consistency over probabilistic work.
- Gates provide the contract that makes autonomous runs trustworthy.
- P4 requires autonomy without live supervision.
- Resumable state advances P4 because an interrupted long cast does not require babysitting.
- P5 requires the system to remain local-first and own its local state.
- The decompose checkpoint lives under the project-local `.vend/` directory.
- Doctor is a read-only local diagnostic surface over that state.
- This ticket does not change budget behavior, executor behavior, or gate taxonomy.

## Story contract

- Parent story `S-077-04` owns resumable decompose across four tickets.
- T-077-04-01 created the persisted decompose draft store and post-gate checkpoint.
- T-077-04-02 owns clearing or settling a draft after successful materialization.
- This ticket owns only the doctor condition and its CLI composition.
- T-077-04-04 owns parsing `--resume` and bypassing cold executor dispense.
- The story acceptance names the exact red check prefix `resumable-decompose`.
- The story acceptance requires the resume command in the failed check's hint.
- The ticket requires the literal check shape `resumable-decompose: <epic>`.
- The ticket requires `probeResumableDecompose` to mirror board hygiene.
- It must be wired beside board hygiene and not folded into `probeDoctor`.
- No repair, regeneration, or auto-fix loop belongs in this slice.
- Doctor gains exactly one probe; the remainder of doctor is unchanged.

## Field failure being surfaced

- E-077 records long decompose casts interrupted after substantial paid work.
- The operator previously saw an orphan-epic doctor failure with no recovery path.
- The persisted draft now retains parsed output, gate findings, and next-repair metadata.
- Without a doctor probe, that useful state is invisible at the diagnostic surface.
- A bare orphan warning can encourage a cold retry that repays generation cost.
- A resume-command hint makes the available recovery action explicit.
- This ticket reports recoverability but does not implement recovery itself.

## Existing doctor model

- `src/doctor/doctor-core.ts` defines the pure `Check` model.
- A check has a `name`, `ok`, and an optional failure `hint`.
- `passed(name)` creates a green check without a hint.
- `failed(name, hint)` creates a red check with an actionable hint.
- `renderDoctorReport` preserves input check order.
- Any failed check yields exit code 1 and a `doctor: FAILED` report.
- All-green checks yield exit code 0 and a `doctor: ok` report.
- Failed check lines render both the name and hint.
- The new probe can reuse this model without changing the renderer.

## Existing dependency probe boundary

- `src/doctor/doctor-probe.ts` probes Vend runtime dependencies and executor capability.
- `probeDoctor` is reused by cast preflight, not only by the CLI doctor command.
- Adding resumable state to `probeDoctor` would risk blocking casts that could recover it.
- The ticket explicitly forbids placing the new probe there.
- The new diagnostic must remain a doctor-only, read-only composition.

## Board-hygiene precedent

- `src/doctor/board-hygiene-probe.ts` is the direct structural precedent.
- It is deliberately separate from `doctor-probe.ts`.
- Its default dependency reads project state beneath `process.cwd()`.
- Its dependency interface permits an injected loader in unit tests.
- It has a pure fact-to-`Check` bridge, `orphanEpicCheck`.
- `probeBoardHygiene` returns an ordered `Check[]` for CLI composition.
- The probe catches loader failures and converts them into a red check.
- It never throws expected diagnostic failures into the CLI.
- Its green state is represented by one stable green check.
- Its focused test proves red, green, deterministic, and loader-failure outcomes.
- This is the shape the ticket asks `probeResumableDecompose` to mirror.

## Persisted draft store

- `src/engine/decompose-draft.ts` owns the versioned JSONL store.
- Its default path is `.vend/decompose-drafts.jsonl`.
- `loadDecomposeDrafts()` reads the default relative to the caller's current directory.
- An absent file returns `{ records: [], skipped: 0 }`.
- Malformed, torn, or unsupported rows are skipped rather than thrown.
- A valid record includes `runId`, `epic`, `parsedDraft`, `gateFindings`, and repair metadata.
- `latestDecomposeDraft(records, epic?)` selects by append order.
- T-077-04-01 established append order, not timestamps, as latest authority.
- The doctor probe only needs record epic identities; it must not inspect parsed plan internals.
- It also need not reinterpret gate findings or repair metadata.

## Draft lifecycle concurrency

- T-077-04-02 is allocated in parallel with this ticket.
- Its wave is intentionally disjoint: engine lifecycle versus doctor files.
- It may extend the draft store's active-state representation while this ticket is running.
- The doctor probe should consume the store's public loader result rather than JSONL directly.
- It should avoid modifying `src/engine/decompose-draft.ts`.
- This preserves the story DAG's claimed file separation.
- Before final verification, the public loader shape must be rechecked for concurrent changes.

## CLI doctor composition

- `src/cli.ts` handles `doctor` at approximately lines 1034–1068.
- Kitchen workspaces branch to `probeKitchen` and do not run build-board probes.
- Normal build workspaces currently import `probeDoctor` and `probeBoardHygiene` lazily.
- Those two probes run concurrently with `Promise.all`.
- Their results are concatenated dependency-first, board-hygiene-second.
- The new probe belongs in that same normal-workspace `Promise.all`.
- It must be a sibling result, not nested inside either existing probe.
- Lazy import preserves the CLI's existing addon/loading boundary.
- The report renderer and process exit behavior need no changes.
- A persisted draft will add one red check and therefore make doctor exit 1.

## Command wording

- T-077-04-04's ticket specifies the future command shape.
- The full command is `vend run decompose-epic <epic> --resume`.
- The doctor hint must substitute the actual persisted epic identifier.
- “Literal resume command” means the hint must include the complete runnable command text.
- The check name must be exactly `resumable-decompose: ${epic}` for one draft.
- No prompt, approval request, or conversational recovery belongs in the hint.

## Multiple persisted records

- The JSONL store can retain multiple records and multiple attempts for one epic.
- A check per raw record would duplicate the same epic after repeated attempts.
- The diagnostic fact is resumability per epic, not checkpoint history.
- Stable unique epic identifiers are therefore the natural doctor subjects.
- Append order is stable and already meaningful in the store.
- Selecting each epic once from the latest end avoids duplicate warnings.
- Sorting by epic would be deterministic but would discard meaningful store order.
- Existing board hygiene sorts through its pure graph detector.
- The acceptance criterion directly exercises one persisted draft, so multiple-epic policy is secondary.

## Empty and malformed stores

- A missing store is a normal fresh-project state, not a diagnostic failure.
- A readable store with zero valid records has no resumable decompose condition.
- The skipped-row count is evidence that malformed rows existed.
- The current store deliberately tolerates malformed rows to preserve valid checkpoints.
- This ticket's acceptance concerns persisted readable drafts, not corrupt-row reporting.
- Inventing a new corruption warning would add a second condition outside “exactly one probe.”
- Therefore the probe can treat zero valid drafts as a green no-draft check.
- A true loader rejection, such as permissions or filesystem failure, should become a red check.
- That follows board hygiene's never-throw diagnostic convention.

## Pure core / impure shell

- Draft-record-to-check mapping is pure over plain records.
- Filesystem loading remains in `loadDecomposeDrafts`.
- The new module should expose a pure helper for focused tests.
- The asynchronous probe should inject only the loader boundary.
- Doctor report and exit-code decisions remain in `doctor-core.ts`.
- CLI only composes probe arrays and renders the result.
- No source module needs to write or clear recovery state in this ticket.

## Core test precedent

- `src/doctor/board-hygiene-probe.test.ts` uses in-memory facts through an injected loader.
- It proves the returned `Check` and the rendered report outcome.
- A resumable-decompose core test can fabricate store records as plain values.
- It should assert the exact failed check name.
- It should assert the exact full resume command is present in the hint.
- It should assert the report is red and exits with `EXIT_FAILED`.
- It should also cover empty store and loader failure to pin total behavior.
- Multiple attempts for one epic should not create duplicate recovery checks.

## Smoke test precedent

- `src/doctor/doctor-cli.smoke.test.ts` spawns the real CLI entry.
- It already proves print-and-exit behavior behind `import.meta.main`.
- The helper currently runs with inherited cwd and supplied environment.
- A new smoke can add an optional cwd to this helper.
- A temporary project root can contain `.vend/decompose-drafts.jsonl`.
- The public draft-store writer can create a schema-valid checkpoint.
- `loadWorkGraph` tolerates missing board directories, so a minimal temp root is valid.
- The board-hygiene probe on an empty graph remains green.
- Host dependency checks may be green or red, but the target check is host-independent.
- The smoke should assert exit 1, the exact check name, and literal command in stdout.
- It should assert no stack trace in stdout or stderr.
- The temporary fixture should be removed in `finally` to avoid residue.

## File ownership map

- New: `src/doctor/resumable-decompose-probe.ts`.
- New: `src/doctor/resumable-decompose-probe.test.ts`.
- Modify: `src/cli.ts` normal-workspace doctor composition only.
- Modify: `src/doctor/doctor-cli.smoke.test.ts` for wired runtime proof.
- No changes to `src/doctor/doctor-probe.ts`.
- No changes to `src/engine/decompose-draft.ts` are required.
- No changes to ticket or shared work-artifact paths are allowed.

## Research conclusion

- Add a separate doctor-only probe over the public decompose draft loader.
- Model one failed check per unique resumable epic.
- Put the exact `vend run decompose-epic <epic> --resume` command in each hint.
- Return one green no-draft check for an empty readable store.
- Convert loader rejection into an actionable red store-readable check.
- Wire the probe as a third sibling beside dependency and board-hygiene probes.
- Prove pure/check behavior in a focused unit suite.
- Prove actual CLI cwd loading and rendered command through a temp-root smoke.
- Recheck the store API before implementation because lifecycle work is concurrent.
