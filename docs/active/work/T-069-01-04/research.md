# Research — T-069-01-04

## Ticket state and contract

- Ticket: `T-069-01-04`, `run-option-and-effect-relabel`.
- Parent story: `S-069-01`, `agent-routing-flag-at-mint`.
- The ticket starts in `phase: research`.
- All six RDSPI phases therefore remain.
- The ticket asks for the run-side half of the decompose gesture.
- `RunOptions` must accept the optional Lisa agent-routing seat.
- Input assembly must carry that option into `DecomposeInputs`.
- The decompose effect must pass that input to `materialize`.
- A materializer `UnknownSeatError` must become returned effect data.
- The named returned outcome is `unknown-seat`.
- The refusal must happen before any file is written.
- The acceptance proof uses `agent: "codex"` for the success side.
- It also uses an unknown seat for the refusal side.

## Parent-story boundary

- The story covers `--agent <seat>` on two board-writing gestures.
- This ticket does not parse the CLI flag.
- CLI parse and dispatch belong to downstream `T-069-01-05`.
- Chain option threading belongs to sibling `T-069-01-03` and is committed.
- Seat vocabulary and input fields belong to `T-069-01-01` and are committed.
- Materializer stamping and validation belong to `T-069-01-02` and are committed.
- Lisa dispatch behavior is explicitly outside this slice.
- Adding seats beyond `claude | codex` is outside this slice.
- Per-ticket seat overrides are outside this slice.
- The unrelated SVG projection `--seat` option is outside this slice.
- The live metered routing drive is human-authorized deferred work.
- The proof required here is fixture-based, offline, and token-free.

## Charter and vision constraints

- P4 requires autonomy through a named andon, not a hand-edit pass.
- P6 requires routing metadata not to assume Claude is the only executor.
- P3 requires executable test evidence for the behavior.
- The local-first boundary favors filesystem fixtures and a stubbed validator.
- Vend remains the board writer and orchestrator, not the executor.
- The run should transport a preselected seat without negotiating it mid-run.

## Dependency state: seat contract

- `src/play/agent-seat.ts` is the canonical seat vocabulary module.
- `KNOWN_SEATS` is the literal tuple `["claude", "codex"]`.
- `AgentSeat` is derived from that tuple.
- `findUnknownSeat(seat)` is the pure membership oracle.
- Matching is exact; it performs no case or whitespace normalization.
- Unknown values are returned as strings rather than thrown here.
- The effectful write boundary owns the typed refusal.
- The module has no filesystem, BAML, or executor dependency.
- `src/play/agent-seat.test.ts` pins both known seats and `gpt` as unknown.

## Dependency state: input assembly

- `src/play/project-context.ts` declares `ContextSources`.
- `ContextSources` already has `readonly agent?: string`.
- The same module declares `DecomposeInputs`.
- `DecomposeInputs` already has `readonly agent?: string`.
- `assembleInputs` conditionally spreads the field when supplied.
- Omission therefore produces no own `agent` property.
- This preserves byte and shape compatibility for existing callers.
- The current direct decompose caller does not yet supply `agent` to assembly.
- That missing adapter is in `assembleAndCast` in `decompose-epic.ts`.

## Dependency state: materialization

- `src/play/materialize.ts` exports `UnknownSeatError`.
- The error records the offending `seat`.
- Its name is explicitly `UnknownSeatError`.
- Its message also lists the known seats.
- `materialize(plan, targets, charter, agent?)` accepts an optional final argument.
- The unknown-seat guard is the first operation in `materialize`.
- It runs before board reads, directory creation, and file writes.
- A known seat is passed into every ticket renderer.
- `renderTicketFile` emits `agent: <seat>` immediately after `priority:`.
- Story files never gain an `agent` field.
- Omission keeps legacy output byte-identical.
- `materialize.test.ts` already proves the renderer and direct write guard.
- The current decompose effect calls `materialize` without the fourth argument.

## Current decompose run surface

- `src/play/decompose-epic.ts` owns the concrete play and direct run adapter.
- `RunOptions` contains `epicPath`, `budget`, and optional cast controls.
- It already contains optional `after` dependency targets.
- It does not yet contain `agent`.
- `assembleAndCast` resolves the project root.
- It calls `assembleInputs` with `epicPath`, `projectRoot`, and `after`.
- It does not yet pass `opts.agent`.
- It then invokes `castPlay` with the assembled inputs.
- `runDecomposeEpic` delegates to `assembleAndCast`.
- `src/play/dispatch.ts` imports and consumes `RunOptions`.
- Adding an optional field is structurally backward compatible for current callers.

## Current decompose effect

- `decomposeEffect` is currently a module-private constant.
- It receives a `WorkPlan` and `CastContext<DecomposeInputs>`.
- It canonicalizes generated story and ticket ids.
- It runs a pre-write graph-integrity net.
- It applies and validates optional external `after` edges.
- It calls `materialize` inside a `try` block.
- It currently passes plan, target directories, and charter.
- It runs `lisaValidate` only after materialization succeeds.
- `IdCollisionError` becomes the `id-collision` outcome.
- `BareCodeError` becomes the `bare-code` outcome.
- Other errors are rethrown as genuine unexpected failures.
- `UnknownSeatError` is not imported or handled yet.
- Because `agent` is not passed, the materializer guard cannot currently fire here.

## Effect and engine contract

- `EffectResult` permits `ok: false` with an optional `RunOutcome`.
- `castPlay` uses a supplied effect outcome to relabel the terminal run.
- A returned effect failure yields `materialized: false`.
- The cast loop appends the returned named outcome to the run log.
- This is the existing house pattern for expected pre-write andons.
- Throwing an expected seat validation error would lose that named outcome.
- Relabeling at the concrete effect boundary preserves engine genericity.

## Run-log vocabulary

- `src/log/run-log.ts` defines `RUN_OUTCOMES` as a const tuple.
- `RunOutcome` is derived from the tuple.
- Current materialization andons include `id-collision` and `bare-code`.
- `unknown-seat` is not present.
- `assertOutcome` checks membership in `RUN_OUTCOMES`.
- `buildRunRecord` therefore rejects any label absent from the tuple.
- `src/log/run-log.test.ts` iterates every tuple member.
- Adding the tuple member automatically exercises record acceptance.
- The tuple also feeds exhaustive outcome maps in ledger code.
- Those maps are constructed dynamically from `RUN_OUTCOMES`.
- The schema version remains 1 because this extends an enum-like vocabulary.

## Test architecture and addon constraint

- `src/play/decompose-epic.test.ts` deliberately avoids value-importing `decompose-epic.ts`.
- That production module value-imports the generated BAML sync client.
- Bun's native addon has a documented once-per-process reactor limitation in tests.
- Existing pure tests import `decompose-epic-core.ts` instead.
- Existing cast tests use decompose-shaped fixture plays to avoid the addon.
- The ticket acceptance specifically asks to drive `decomposeEffect`.
- A test that merely duplicates its catch arm would be weaker than that wording.
- The effect currently cannot be imported independently from the BAML-bearing play module.
- An addon-safe effect seam does not currently exist.

## Existing relevant test patterns

- `bare-code-cast.test.ts` uses a temp root and real `materialize`.
- It verifies a named andon and zero output directories.
- It duplicates the production relabel arm in a fixture play.
- `materialize.test.ts` directly proves `UnknownSeatError` precedes any mkdir.
- `agent-seat.test.ts` proves input assembly preserves supplied and omitted shapes.
- `run-log.test.ts` proves every `RUN_OUTCOMES` member is accepted.
- Tests use type-only BAML imports to keep the native addon unloaded.
- Filesystem fixtures use `mkdtemp` and cleanup in `afterEach`.

## Files in the likely change surface

- `src/play/decompose-epic.ts`: run option, assembly adapter, effect wiring location.
- `src/play/materialize.ts`: dependency only; behavior already exists.
- `src/play/project-context.ts`: dependency only; input field already exists.
- `src/play/agent-seat.ts`: dependency only; canonical vocabulary already exists.
- `src/log/run-log.ts`: add the named outcome and documentation.
- A new addon-free effect module or test seam may be needed.
- A new effect-level test can cover both success and refusal in one fixture.
- `src/log/run-log.test.ts` may need an explicit presence assertion if desired.

## Repository and workflow state

- Dependency commits for T-069-01-01 through T-069-01-03 are present.
- The worktree also contains Lisa-managed ticket/provenance changes.
- Those changes are not owned by this ticket and must be preserved.
- The ticket frontmatter phase/status must not be edited manually.
- Completion requires code, tests, artifacts, a green `bun run check`, and commits.
- RDSPI calls for incremental commits during implementation.

## Assumptions to verify during implementation

- Passing `opts.agent` through `assembleInputs` is sufficient for both direct and dispatched runs.
- `UnknownSeatError` remains the single write-side validation authority.
- The effect should not prevalidate or duplicate `KNOWN_SEATS` membership.
- The unknown-seat detail should identify the offending seat.
- The validator must not run after the materializer rejects the seat.
- A known-seat test can stub validation to avoid spawning Lisa.
- An extracted effect module can remain independent of BAML runtime imports.
- No consumers use a hard-coded exhaustive switch that requires another manual branch.

## Research conclusion

- All prerequisite contracts are landed and tested.
- The production transport currently breaks at two adjacent links:
- `RunOptions.agent` is absent from `assembleAndCast` input assembly.
- `ctx.inputs.agent` is absent from the `materialize` call.
- The expected error currently lacks an effect relabel and run-log label.
- The chief implementation constraint is testing the real effect without loading BAML.
- No CLI, chain, Lisa, renderer, charter, or gate changes belong in this ticket.
