# Research — T-069-01-01

## Ticket position

- Ticket: `T-069-01-01`, `agent-seat-contract-and-input-field`.
- Parent story: `S-069-01`, `agent-routing-flag-at-mint`.
- Current ticket phase at handoff: `research`.
- The ticket has no dependencies.
- Every later ticket in the story depends directly or transitively on this one.
- This ticket therefore settles shared vocabulary and input shape, not write behavior or CLI behavior.
- The ticket frontmatter and its parent story/epic are currently Lisa-owned working-tree changes.
- The phase and status fields must not be edited by this worker.

## Story contract

- The story adds one optional executor-routing seat to the two board-writing gestures.
- The complete story will eventually support `vend chain ... --agent codex`.
- The complete story will eventually support `vend run decompose-epic ... --agent codex`.
- The complete story writes `agent: codex` into materialized ticket frontmatter.
- Omission must leave minted output byte-identical to current output.
- Unknown seats must be refused before any file write.
- The complete story's known vocabulary is exactly `claude | codex`.
- Adding more seats is explicitly outside this slice.
- Changing Lisa dispatch is explicitly outside this slice.
- Per-ticket seat overrides are explicitly outside this slice.
- The unrelated present-layer `--seat designer|dev` concept is outside this slice.
- This first ticket owns only the known-seat contract, validation oracle, and decompose input field.
- Materialization, run-log relabeling, chain options, and CLI parsing belong to later tickets.

## Product and charter grounding

- Vision P6 requires executor-agnostic orchestration underneath.
- A small named seat vocabulary avoids encoding routing as executor implementation logic.
- Vision P2 keeps routing inside the mint gesture rather than a later manual edit.
- Charter N4 says Vend is not the executor; this ticket only carries allocation metadata.
- The ticket advances the story by defining the board-routing value all consumers can share.
- No model call or metered proof is required for this ticket.
- The story's honest boundary says all proof in this epic is fixture-based and free.

## Existing decompose input seam

- `src/play/project-context.ts` owns the decompose input assembly boundary.
- It imports only Node filesystem/path APIs and type-only `Dirent`.
- It does not import BAML or a native addon.
- `ContextSources` is the caller-facing source description.
- Its required field is `epicPath: string`.
- Its optional path overrides are `charterPath` and `projectRoot`.
- Its existing gesture metadata is `after?: readonly string[]`.
- `DecomposeInputs` is the assembled object handed into the decompose play.
- Its required prompt strings are `epic`, `charter`, and `project`.
- Its existing effect-only metadata is `after?: readonly string[]`.
- Render and gates consume the three prompt strings.
- The materialization effect consumes `after` later in the flow.
- The story explicitly identifies this same pass-through seam for `agent`.

## `assembleInputs` behavior

- `assembleInputs(src)` is asynchronous and filesystem-reading.
- It defaults `projectRoot` to `process.cwd()`.
- It defaults the charter to `<root>/docs/knowledge/charter.md`.
- It reads the epic and charter verbatim in parallel.
- It lists `src/**`, story ids, and ticket ids in parallel.
- It formats those listings through the pure `buildProjectSnapshot` helper.
- Its current return begins with exactly `{ epic, charter, project }`.
- It conditionally spreads `after` only when supplied and non-empty.
- That conditional spread is documented as preserving bare-mint object shape.
- An absent `after` does not create an own property with value `undefined`.
- An empty `after` array is also treated as absent.
- The new acceptance criterion requires the same absence discipline for `agent`.
- Unlike `after`, a seat is scalar rather than a collection.
- The exact acceptance example supplies `agent: "codex"`.
- The exact absence example requires the field to be `undefined` while object shape remains unchanged.

## Existing project-context tests

- `src/play/project-context.test.ts` uses `bun:test`.
- It currently imports `buildProjectSnapshot` and `listEpicIdTitlesIn`.
- Snapshot tests pin deterministic sorting and honest empty sections.
- Snapshot tests explicitly compare absent optional input with `intent: undefined`.
- Filesystem reader tests use `mkdtemp`, `writeFile`, and `rm` in `finally`.
- The file's historical comment says `assembleInputs` is deliberately not exercised.
- That comment predates this ticket's explicit assembly acceptance criterion.
- The module itself remains addon-free, so testing `assembleInputs` does not load BAML.
- A temp-root fixture must provide an epic file and the canonical charter path.
- Missing `src`, stories, and tickets directories are already tolerated by helpers.
- Therefore the assembly fixture can stay small and deterministic.

## Pure guard precedents

- `src/play/id-guard.ts` is a strong local precedent for a pure guard module.
- It accepts plain values and performs no effects.
- It avoids even type-only BAML dependencies.
- It returns data rather than throwing.
- `detectCollisions` returns an empty array to mean clear.
- `findExistingByTitle` returns `null` to mean no conflicting/adoptable value.
- The ticket specifically names `findUnknownSeat`, matching this oracle style.
- `findUnknownSeat("gpt")` must return the offending value, `"gpt"`.
- `findUnknownSeat("claude")` must return `null`.
- `findUnknownSeat("codex")` must return `null`.
- The known values must come from one exported `KNOWN_SEATS` constant.
- This ticket does not request a throwing error type.
- The parent story mentions a typed error, but assigns write/effect behavior to downstream tickets.
- T-069-01-02 explicitly consumes the guard and later establishes the write-side error path.

## Executor vocabulary nearby

- `src/executor/select.ts` has executor ids `claude` and `openai-compat`.
- Those ids describe Vend execution adapters, not Lisa routing seats.
- The new seat `codex` is not an executor id in that registry.
- Reusing `builtinExecutors` would conflate two separate abstractions.
- The story says the known-seat list comes from the existing Lisa/frontmatter convention.
- The ticket settles that convention locally as `claude | codex`.
- No executor module should be modified by this ticket.

## Downstream consumers

- `src/play/materialize.ts` currently imports `listIdsIn` from project context.
- T-069-01-02 will add ticket stamping and the write-side validation guard there.
- `src/play/decompose-epic.ts` imports `assembleInputs` and `DecomposeInputs`.
- T-069-01-04 will thread/relabel the materialize error there.
- `src/play/chain-propose-decompose.ts` imports `assembleInputs`.
- T-069-01-03 will add the chain option and pass it into assembly.
- `src/cli.ts` will parse and dispatch `--agent` only in T-069-01-05.
- The current ticket must not preempt changes in those files.
- A standalone seat-contract module gives those consumers a shared import without cycles.

## TypeScript and repository constraints

- The repository uses TypeScript modules with explicit `.ts` import suffixes.
- Interfaces use `readonly` fields throughout this seam.
- Tests use Bun and are colocated as `*.test.ts`.
- `tsconfig` is checked by `tsc --noEmit` through `bun run check`.
- The repository house rule is pure core, impure shell.
- The seat membership oracle naturally belongs in a pure, dependency-free module.
- The assembly pass-through remains in the existing impure shell.
- No package or dependency change is needed.
- No generated BAML change is needed.

## Working-tree constraints

- Before implementation, `git status --short` showed:
- `docs/active/tickets/T-069-01-01.md` modified only from `phase: ready` to `phase: research`.
- `docs/active/epic/E-069.md` untracked.
- `docs/active/stories/S-069-01.md` untracked.
- Those are orchestration inputs and must be preserved.
- New ticket work artifacts belong under `docs/active/work/T-069-01-01/`.
- Commits must stage explicit paths so they do not capture Lisa's unrelated/untracked board inputs.

## Verification boundary

- The ticket's exact seat membership examples can be pinned in one addon-free unit test.
- The exact assembly-presence example needs a temporary filesystem fixture.
- The absent case should test both property access and own-property/object equality.
- Existing snapshot tests must remain green.
- Typecheck must prove both interfaces accept and expose the optional field.
- The final repository gate is `bun run check`.
- The repository requires completed work and artifacts to be committed.

## Research conclusions carried forward

- The relevant change surface is small and well isolated.
- A new pure contract module is needed because no existing module represents Lisa seats.
- `project-context.ts` is the established single pass-through boundary.
- Conditional object spread is load-bearing for byte-identical absence semantics.
- A new test may exercise `assembleInputs` without violating the addon-free constraint.
- Later story tickets need a stable export path for both the list and validation function.
- No CLI, materialization, run-log, executor, BAML, or Lisa behavior belongs in this ticket.
