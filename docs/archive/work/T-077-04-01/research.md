# Research — T-077-04-01

## Assignment and phase contract

- The ticket starts in Research and the assignment requires one continuous RDSPI pass.
- Attempt artifacts belong only in `.lisa/attempts/T-077-04-01/1/work/`.
- Lisa publishes admitted artifacts and owns ticket phase/status transitions.
- Ticket-owned source must be committed through `lisa commit-ticket` with exact include paths.
- The authoritative verification command is `bun run check`.
- Existing worktree changes in `.lisa/provenance.jsonl` and ticket frontmatter are Lisa-owned.
- Those files are outside this ticket's source ownership and must remain untouched.

## Product and story boundary

- Parent story `S-077-04` is the contract for resumable decompose.
- The story covers persistence, success cleanup, doctor surfacing, and resume execution.
- This ticket is only the foundational persistence slice.
- T-077-04-02 owns clearing a draft after successful materialization.
- T-077-04-03 owns the doctor probe and resume-command hint.
- T-077-04-04 owns CLI parsing and bypassing executor dispense on resume.
- No repair, regeneration, or auto-fix loop exists or belongs in this story.
- Gate findings must be persisted as-is; this ticket does not alter gate taxonomy.
- Charter P4 is served by making post-gate interruption recoverable without supervision.
- Charter P5 is served by keeping recovery state in the local project under `.vend/`.

## Field failure being addressed

- E-077 records long decompose casts that were interrupted after substantial paid work.
- The operator was left with an orphan epic and no resumable parsed state.
- A retry cold-dispensed and paid generation cost again.
- The desired recovery unit is the latest parsed plan plus its gate evidence.
- The current cast path has no durable checkpoint between parse/gates and effect settlement.
- Transcripts preserve raw executor messages but do not provide a typed parsed plan.
- `runs.jsonl` preserves terminal accounting but not the parsed plan or next action.

## Current cast pipeline

- `src/engine/cast.ts` owns the generic impure orchestration shell.
- Its order is render → executor probe/dispense → meter → parse → gates → classify → effect.
- `CastContext` is assembled once from typed inputs and project root.
- Parse and gates run only when the executor returned a result and did not time out.
- With `skipGates`, parse still runs but the gate verdict remains `null`.
- A normal gated result assigns the exact object returned by `play.gates` to `gateVerdict`.
- `classify` converts that verdict into run outcome and normalized log gate rows.
- A gate STOP prevents the effect but still reaches run-log settlement.
- A gate CLEAR authorizes effect execution.
- An effect throw occurs after parse/gates and before run-log settlement.
- Therefore the checkpoint must be written immediately after gates, before classification/effect.

## Play and gate shapes

- `Play<I,O>` is generic; the parsed output type `O` is owned by each play.
- Decompose's concrete output is BAML `WorkPlan`, a plain JSON-shaped object.
- Decompose is stably identified in the registry and ledger as `decompose-epic`.
- The engine must not import the concrete decompose play because that dependency points upward.
- Comparing the stable play name keeps the engine independent of `src/play/` and BAML.
- `GateVerdict` is a small discriminated union in `src/engine/play.ts`.
- CLEAR carries an optional ordered `cleared` list.
- STOP carries `gate`, `unit`, and `reason`.
- Persisting that union directly preserves findings as-is.
- Persisting `classify().gateLog` instead would translate the verdict and lose its native shape.

## Existing local persistence convention

- `src/log/run-log.ts` is the closest precedent.
- Its default path is `.vend/runs.jsonl`.
- It stamps a numeric schema version on every record.
- Pure builders validate/normalize plain input into a frozen record.
- Pure serialization emits one JSON object plus a trailing newline.
- Pure readers tolerate blank, malformed, partial, and unsupported rows.
- The impure writer creates the parent directory and uses append-only `appendFile`.
- The impure loader treats ENOENT as an empty store and propagates other errors.
- This shape supports crash tolerance: an incomplete tail does not erase prior records.
- The draft store should mirror these conventions rather than reuse the run-log schema.

## Store identity and lookup needs

- The story calls for a new versioned draft store under `.vend/`.
- A dedicated `.vend/decompose-drafts.jsonl` keeps parsed plans out of accounting records.
- Multiple casts of the same epic can append newer checkpoints.
- The epic promises the latest parsed draft, so append order is the natural precedence.
- Future doctor/resume consumers need a helper that selects the latest record per epic.
- A `runId` ties the checkpoint to transcript and run-log evidence.
- A `createdAt` timestamp makes the record independently inspectable.
- Neither field replaces append order for determining latest; malformed clocks should not reorder.

## Next-repair-action facts

- T-077-01-01 characterized cap-hit at the real cast/executor seam.
- Claude cap-hit is explicitly represented by terminal subtype `error_max_turns`.
- `result.num_turns` counts executor conversation events.
- The live accumulator counts distinct assistant message IDs.
- Those values use different units and must not be compared to infer cap-hit.
- The durable next action must inspect the terminal subtype directly.
- A gate STOP is also actionable and must retain its exact gate/unit/reason.
- No automatic repair is allowed, so the action is descriptive recovery metadata.
- For a stopped draft the action is repair that gate, then resume.
- For a clear draft the action is resume at gates after interruption.
- Cap-hit is retained as the cause when the terminal subtype says so.

## Interrupted/failed acceptance path

- A deterministic fixture can return a parsed object and a gate STOP.
- The store write must occur before `classify` returns `gate-failed`.
- The effect must remain uncalled.
- The resulting cast returns normally with `outcome: gate-failed`.
- The test can then load the draft through the public store reader.
- This proves a failed cast leaves a readable checkpoint without network or token spend.
- An effect-throw fixture would also prove interruption after gates, but is less direct.
- Gate failure is a stable returned-data path and matches the project's andon style.

## Pure-core / impure-shell boundary

- Draft validation, action selection, serialization, row parsing, and latest selection are pure.
- Filesystem append/load are thin wrappers over those pure functions.
- `castPlay` remains the impure orchestration shell that invokes the append wrapper.
- The store does not import budget, executor implementation, BAML, doctor, or CLI modules.
- It may import `GateVerdict` as a type-only engine contract.
- This keeps the new module usable by later doctor and resume tickets.

## Compatibility and failure semantics

- Store absence must read as no drafts for fresh projects.
- A malformed tail must be skipped rather than make earlier checkpoints unreadable.
- Unsupported schema versions must be skipped rather than coerced.
- Optional or malformed gate/action subobjects must invalidate only their row.
- Parsed draft must remain an object because decompose `WorkPlan` is object-shaped.
- The writer should not silently swallow serialization or filesystem failures.
- If checkpoint persistence fails, continuing to effect would falsely claim resumability.
- Therefore an append error should propagate before effect execution.

## Repository test patterns

- `src/engine/cast.test.ts` already injects token-free executors.
- It uses temporary roots, explicit run-log paths, and BAML-free play fixtures.
- The suite already contains a decompose-shaped cap-hit characterization.
- Extending that fixture can assert the exact cap-derived next action.
- A separate gate-failure fixture can prove the ticket acceptance criterion.
- Store pure functions belong in a focused `decompose-draft.test.ts` suite.

## Research conclusion

- Add a dedicated versioned append-only JSONL store in `src/engine/`.
- Preserve the parsed draft and native gate verdict without transformation.
- Derive structured next-action metadata from gate STOP plus exact result subtype.
- Append only for the stable `decompose-epic` play after real gates ran.
- Write before classification/effect so a later failure or interruption retains the checkpoint.
- Do not clear drafts, add doctor output, add resume flags, or change cast outcomes here.
