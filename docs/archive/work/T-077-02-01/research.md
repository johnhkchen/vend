# T-077-02-01 — Research

## Ticket position

- Ticket: `T-077-02-01`, `degrade-disposition-shape`.
- Parent story: `S-077-02`, `degrade-not-discard-charter-cites`.
- Current ticket phase at lease start: `research`.
- The ticket has no dependencies and is the first node in the story DAG.
- Tickets `T-077-02-02` and `T-077-02-03` depend directly on this ticket.
- Ticket `T-077-02-04` joins those two branches and records their dispositions.
- This ticket therefore owns shared vocabulary, not either application path.

## Story contract

- Story scope names two whole-cast refusal surfaces.
- The read-side surface is `boundsGate` in `src/gate/gates.ts`.
- The write-side surface is the bare-code guard in `src/play/materialize.ts`.
- Inline prose handling later belongs to `T-077-02-02`.
- `advances` normalization and bounds behavior later belong to `T-077-02-03`.
- Run-record and cast-summary surfacing later belongs to `T-077-02-04`.
- The story requires unresolvable editorial charter cites to degrade rather than discard a cast.
- The landed board must carry either stripped or honestly annotated content.
- The run must retain a `{code, location, action}` degradation record.
- Structural invalidity must continue to refuse materialization.
- Named structural cases are bad graphs, duplicate or missing ids, missing required fields,
  and absent story contracts.
- The story explicitly excludes repair, regeneration, and auto-fix loops.
- The proof is fixture-based, uses a stub executor, and spends no model tokens.

## Epic and charter grounding

- `E-077` originates in a live field report where two unresolved non-goal citations caused an
  entire already-paid-for decompose result to be discarded.
- The epic frames this as proportionality and surface-honesty debt, not as a request to remove
  gates.
- P3 requires gates to remain the contract; the change narrows refusal to actual structural
  invalidity rather than eliminating judgment.
- P5 requires the local surface and ledger to explain a degraded result without a cloud service.
- P7 is relevant at story level because the paid-for output should not be discarded for an
  editorial citation defect.
- Vision principle 3 makes the distinction between a degraded clear and a refusal load-bearing.
- Vision principle 5 requires the implementation and proof to remain local and offline.

## Existing charter snapshot seam

- `src/play/charter-snapshot.ts` is the canonical code-definition resolver.
- It exports `CharterSnapshot` as `ReadonlyMap<string, string>`.
- Keys are charter codes such as `P3`, `N4`, or kitchen-seed `K1`.
- Values are normalized one-line titles.
- Absence is represented by `snapshot.get(code) === undefined`.
- `snapshotCharterCodes` is pure, total, addon-free, and zero-import.
- Its parser accepts definition codes matching `[A-Z]{1,3}\d+`.
- It ignores prose mentions, handles wrapped titles, and resolves duplicates first-wins.
- A codeless charter yields an empty snapshot rather than throwing.
- `src/play/charter-snapshot.test.ts` pins the live charter and kitchen charter.
- The tests make unknown and retired code absence explicit.
- This seam already answers whether a well-shaped cited code is resolvable.
- It does not decide what a caller should do with an unresolved citation.

## Existing write-side behavior

- `src/play/materialize.ts` resolves charter text once per cut.
- Pure ticket and story renderers expand resolvable cites to `code — title`.
- A snapshot miss currently leaves the original bare code in rendered text.
- `findBareCodes` scans rendered files for unglossed codes in policed prefix families.
- `P` and `N` are always policed.
- Prefix families present in the snapshot, such as `K`, are also policed.
- A found bare code becomes `BareCodeError` before any filesystem write.
- `decomposeEffect` maps that error to the `bare-code` run outcome.
- The current behavior is atomic: a refused cut writes zero files.
- That atomicity is a structural guarantee the story preserves.
- `BareCodeHit` currently records a file name and its codes.
- It does not express whether a specific cite was stripped or annotated.
- It also does not provide the shared per-cite record requested by this ticket.

## Existing read-side behavior

- `src/gate/gates.ts` owns the ordered DecomposeEpic clearing gates.
- `boundsGate` derives live invariant and non-goal sets from charter text.
- A non-goal-shaped `advances` entry currently stops as incoherent defense in depth.
- A `P\d+` entry absent from the charter currently stops as a dangling reference.
- Free-text `advances` entries are not rule-failed.
- `stripNonGoalAdvances` in `src/play/decompose-epic-core.ts` is the prior degrade precedent.
- It removes `N\d+` entries before gates and materialization see the parsed plan.
- A ticket left with no `advances` still fails the value gate.
- The function returns plain data and does not mutate its input.
- It currently records no per-cite disposition.
- It does not strip dangling invariant codes.

## Existing structural refusals

- `storyCompletenessGate` refuses absent story contract sections.
- `allocationGate` refuses duplicate ids, dangling dependencies, cycles, and missing story-ticket
  membership targets.
- `structuralGate` refuses missing Lisa ticket fields.
- `decomposeEffect` runs a graph-integrity pre-write net and returns `graph-invalid` on failure.
- `materialize` refuses cross-board id collisions before writes.
- Lisa validation remains a final structural poka-yoke after materialization.
- These judgments do not depend on charter-code resolution.
- The ticket must name their category without moving or weakening their implementation.

## Existing outcome and ledger vocabulary

- `RunOutcome` is an exhaustive literal union in `src/log/run-log.ts`.
- Current values include `success`, `gate-failed`, `graph-invalid`, and `bare-code`.
- `bare-code` currently represents the whole-cut refusal that later story tickets retire from the
  editorial-cite path.
- `RunRecord` has optional structured markers for other successful degradations.
- `SeatDefaulted` is an atomic requested/applied/reason record.
- `reducedGrounding` is a one-way successful-degradation marker.
- Optional ledger metadata is normalized at the read boundary so malformed metadata cannot make
  an otherwise useful historical record unreadable.
- This ticket does not own `RunRecord`; `T-077-02-04` does.
- A shared disposition type in `src/play` can be imported type-only by the ledger or duplicated
  structurally there, following existing decoupling conventions.

## Pure-core conventions

- Pure decisions accept plain values and return data rather than throwing expected outcomes.
- Modules such as `id-guard.ts`, `agent-seat.ts`, and `charter-snapshot.ts` avoid BAML imports.
- Tests use `bun:test`, exact equality, and frozen inputs where mutation risk exists.
- `verbatimModuleSyntax` makes type-only import boundaries explicit.
- Strict TypeScript and `noUncheckedIndexedAccess` require absence to be handled.
- `bun run check` performs BAML generation, typecheck, and the full test suite.

## Constraints and assumptions

- A charter cite handled by this story uses the same uppercase-prefix-plus-digits code shape as
  `CharterSnapshot`.
- The snapshot remains the only authority for resolution; the classifier must not parse charter
  prose independently.
- Location must be supplied by the caller because only the caller knows the artifact and field.
- The mutation action must be explicit because later inline prose may annotate while `advances`
  normalization may strip.
- A blank or malformed code/location/action input is a contract defect, not an unresolved editorial
  cite.
- Resolvable cites must not create false degradation records.
- An unresolved, well-shaped cite must produce exactly one degradation record.
- Structural refusal must be distinguishable in the type system from a successful materialization
  carrying degradation records.
- This ticket should not edit `materialize.ts`, `gates.ts`, `decompose-epic-core.ts`, `run-log.ts`,
  or `cast.ts`; those are owned by later DAG nodes.
- Existing Lisa-managed changes to ticket frontmatter are outside ticket-owned source scope.

## Verification surface

- A focused pure unit suite can cover resolvable, degradable-strip, degradable-annotate, and
  structural-input cases without filesystem or BAML.
- Exact object assertions can pin `{code, location, action}`.
- A small aggregation classifier can pin `materialized`, `materialized-with-degrades`, and
  `structural-refusal` as mutually exclusive results.
- Frozen snapshots and inputs can demonstrate the classifier does not mutate caller data.
- Full repository verification remains `bun run check` before the ticket commit.
