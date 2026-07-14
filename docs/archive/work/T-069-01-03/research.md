# Research — T-069-01-03

## Ticket and story contract

- Ticket: `T-069-01-03`, `thread-agent-through-chain-gesture`.
- Parent story: `S-069-01`, `agent-routing-flag-at-mint`.
- Starting phase: `research`.
- Dependency: `T-069-01-01`.
- The dependency is committed as `ef73d3a`.
- The ticket advances P2, the two-gesture run.
- It also advances P4, autonomy instead of supervision.
- The requested user-facing result is eventually `vend chain … --agent codex`.
- This ticket owns only the chain gesture's option and decompose-input threading.
- CLI parsing and dispatch belong to `T-069-01-05`.
- Ticket-frontmatter rendering belongs to `T-069-01-02`.
- Effect wiring and unknown-seat relabeling belong to `T-069-01-04`.
- Lisa dispatch behavior is outside the story.
- Adding seats other than `claude | codex` is outside the story.
- A per-ticket seat override is outside the story.
- A live metered routing cast is explicitly deferred by the story.

## Acceptance boundary

- The acceptance example calls the chain with `signal` and `agent: "codex"`.
- The decompose adapter must pass that value to `assembleInputs`.
- The resulting `DecomposeInputs.agent` must equal `"codex"`.
- The omission case must leave the `agent` field absent.
- Absence means more than reading as `undefined`.
- The returned object must not own an `agent` key.
- The existing chain shape must remain unchanged.
- The proof must be addon-free.
- No live executor or model call is required.
- No materialization assertion is required by this ticket.
- Unknown-seat validation is not required at this seam.

## Relevant source module

- `src/play/chain-propose-decompose.ts` is the concrete chain shell.
- It imports the generic `castChain` engine primitive.
- It imports both concrete plays as runtime values.
- Those play imports load the BAML native addon.
- Tests therefore deliberately avoid value-importing this module.
- `ChainProposeDecomposeOptions` is the public per-cast option shape.
- Its required field is `signal: string`.
- Optional fields already include uniform and per-step budgets.
- Optional fields also include project root, intervention, model, and transcript directory.
- `after?: readonly string[]` is the closest existing pattern.
- `after` is consumed only by the decompose step.
- The propose step does not receive `after`.
- The decompose step's `adapt` callback receives the minted epic path.
- That callback currently calls `assembleInputs` with `epicPath`, `projectRoot`, and `after`.
- The callback is the single chain seam that assembles `DecomposeInputs`.
- Adding a field to that object does not add or reorder chain steps.
- It does not change step budgets.
- It does not change run-log subjects.
- It does not change proposal input assembly.

## Existing chain shape

- The chain contains exactly two `PlayStep` entries.
- Step one is `proposeEpicPlay`.
- Step two is `decomposeEpicPlay`.
- Step one's produced epic path is the thread handle.
- The engine advances only after a non-empty produced path.
- Step two derives its run-log subject from that path.
- Step two assembles the epic, charter, and project snapshot.
- Optional effect-only inputs travel on the assembled input object.
- Render and gates do not consume those optional fields.
- `agent` therefore belongs alongside `after` at this seam.

## Dependency-provided input contract

- `src/play/project-context.ts` defines `ContextSources`.
- `ContextSources` now has `readonly agent?: string`.
- It describes the value as a Lisa executor-routing seat.
- `src/play/project-context.ts` also defines `DecomposeInputs`.
- `DecomposeInputs` now has `readonly agent?: string`.
- `assembleInputs` conditionally spreads the field.
- It uses `src.agent !== undefined` as its presence test.
- A supplied empty string is therefore transported for later validation.
- An omitted value creates no own property.
- The bare object retains the pre-change `epic`, `charter`, `project` shape.
- `after` uses a separate non-empty-array presence policy.
- The assembly seam performs transport, not validation.
- Write-side/effect code is responsible for applying and validating the seat.

## Canonical seat vocabulary

- `src/play/agent-seat.ts` was created by the dependency.
- It exports `KNOWN_SEATS = ["claude", "codex"]`.
- It exports the pure membership guard `findUnknownSeat`.
- This ticket does not need to import that module.
- The chain accepts the transport type `string`, matching `ContextSources`.
- Validation before writes is assigned to later tickets.
- Keeping the option as `string` allows the write-side named andon to own invalid input.

## Existing dependency tests

- `src/play/agent-seat.test.ts` is addon-free.
- It verifies the single known-seat list.
- It creates a temporary project fixture.
- It calls `assembleInputs` with `agent: "codex"`.
- It verifies the value and own-property presence.
- It calls `assembleInputs` without `agent`.
- It verifies both `undefined` access and no own property.
- It also verifies the exact legacy object shape.
- That test proves assembly behavior in isolation.
- It does not prove the chain gesture supplies the option to assembly.
- The present ticket must cover that missing caller seam.

## Existing addon-free chain test

- `src/play/chain-propose-decompose.test.ts` is the established thread proof.
- All BAML imports in it are type-only.
- It imports addon-free effects and assembly helpers directly.
- It deliberately does not import `chain-propose-decompose.ts`.
- Its header documents this constraint.
- The first test mints an epic through `proposeEpicEffect`.
- It obtains the effect's exact `produced` path.
- It feeds that path to `assembleInputs`.
- It verifies the assembled epic equals the minted bytes.
- This mirrors the real chain adapter without spawning an executor.
- The second test proves a cleared plan materializes stories and tickets.
- The third test mirrors run-log subject derivation.
- Temporary roots are removed in `finally` blocks.
- The fixture seeds the real `CHARTER_PATH` expected by assembly.
- This file is the natural home for the new chain-option thread proof.

## Addon boundary

- Importing `castProposeDecomposeChain` directly would import both play modules.
- Those modules value-import generated BAML code.
- The repository treats that as a native-addon test boundary.
- Existing tests prove impure shells through addon-free constituent seams.
- The ticket explicitly asks for an addon-free thread test.
- The test must therefore continue the existing mirrored-adapter pattern.
- It can model the relevant chain options as a structural value.
- It can call `assembleInputs` exactly as the real adapter does.
- A source diff then ties the tested call shape to the production adapter.

## Pure-core / impure-shell fit

- The new behavior is plumbing through an existing impure shell.
- No new decision logic is introduced.
- `assembleInputs` remains the filesystem-reading shell.
- Its conditional shape rule is already directly fixture-tested.
- The chain's scheduling and halt decisions remain in tested engine/core modules.
- Extracting another pure core solely for one property copy is not required by current structure.
- The implementation should remain a narrow option declaration plus adapter argument.

## Compatibility constraints

- Existing callers must compile without supplying `agent`.
- The new option must be optional.
- A bare chain must pass `undefined` into `ContextSources` or omit the key there.
- `assembleInputs` already normalizes that to absence on `DecomposeInputs`.
- No proposal step option should change.
- No budget fallback should change.
- No ordering or count of chain steps should change.
- No log record shape should change.
- No rendered prompt input should change.
- No ticket file should be written by the new test.
- The ticket frontmatter must not be edited by this worker.

## Working-tree state

- The worktree already contains Lisa-managed board changes.
- `.lisa/provenance.jsonl` is modified.
- Ticket files for T-069-01-01, T-069-01-02, and this ticket are modified.
- The epic and story files are currently untracked.
- Those changes predate this implementation and are not owned here.
- The scoped source files are clean before implementation.
- Commits must include only this ticket's source, tests, and work artifacts.

## Verification surfaces

- Focused test: `bun test src/play/chain-propose-decompose.test.ts`.
- Dependency regression test: `bun test src/play/agent-seat.test.ts`.
- Repository gate: `bun run check`.
- Source inspection should confirm only step two receives `agent`.
- Test inspection should confirm supplied and omitted cases.
- Git diff inspection must exclude Lisa-managed board files.
- Final review must report the dirty-worktree boundary honestly.

## Research conclusion

- All required data types and omission behavior already exist.
- One production call site is missing the pass-through.
- One established addon-free test file owns the corresponding thread proof.
- The smallest in-scope change affects two source-controlled files plus RDSPI artifacts.
- No architecture, executor, CLI, materializer, or board-schema change is needed here.
