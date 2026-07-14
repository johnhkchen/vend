# T-077-02-02 — Research

## Assignment and phase

- Ticket: `T-077-02-02`, `inline-prose-cite-degrades`.
- Parent story: `S-077-02`, `degrade-not-discard-charter-cites`.
- Starting phase: Research.
- The assignment requires one continuous RDSPI pass through Review.
- Attempt artifacts belong only under `.lisa/attempts/T-077-02-02/1/work/`.
- Lisa owns ticket phase/status transitions and publication into `docs/active/work/`.
- Ticket source commits must use `lisa commit-ticket` with exact repository-relative includes.

## Story contract

- The story covers two charter-cite refusal surfaces.
- This ticket owns the write-side inline-prose surface.
- `T-077-02-03` separately owns dangling `advances` entries and the bounds gate.
- `T-077-02-04` joins both branches at the run-record and cast-summary surface.
- Structural invalidity remains a refusal.
- No repair, regeneration, or automatic retry loop belongs in this slice.
- The proof is fixture-based, token-free, and uses a stub executor.
- The reporter's live metered E-045 re-cast is explicitly outside the story boundary.

## Charter and vision grounding

- P3 makes gates the contract that permits autonomous materialization.
- The story distinguishes editorial loss from structural invalidity.
- Treating both as a whole-cut refusal overstates the gate contract.
- P5 requires the classification and materialization behavior to work locally.
- No cloud lookup is needed or allowed for charter resolution.
- The cut-time charter snapshot is the local source of truth.
- The vision keeps Vend distinct from the executor.
- The cited N4/N2 prose is editorial grounding, not board structure.
- A degraded clear remains a successful materialization, not a false structural pass.

## Predecessor contract

- `T-077-02-01` is committed at `b4a472a`.
- It created `src/play/degrade-disposition.ts`.
- It created `src/play/degrade-disposition.test.ts`.
- `classifyCharterCite` accepts a code, location, action, and `CharterSnapshot`.
- A snapshot hit returns `classification: "resolvable"` with the carried title.
- A well-shaped snapshot miss returns `classification: "degradable"`.
- The degradable branch carries `{code, location, action}`.
- Malformed codes and blank locations return `classification: "structural"`.
- The classifier is pure and addon-free.
- `materializationDisposition` folds classifications into clean, degraded, or structural results.
- Classification preserves occurrence order and does not deduplicate degradations.
- The predecessor deliberately left annotation wording and caller locations to this ticket.
- Its design expected inline prose to annotate while advances normalization may strip.
- Its review explicitly deferred returning records from materialization/effect to this ticket.

## Charter snapshot seam

- `src/play/charter-snapshot.ts` owns charter definition parsing.
- A snapshot is a readonly map from codes to one-line charter titles.
- Supported code shape is uppercase one-to-three-letter prefix plus digits.
- Snapshot creation does not throw for an empty or codeless charter.
- Resolution is exact and cut-local.
- The new classifier imports this snapshot type only.
- Materialization already snapshots the charter exactly once per cut.
- This ticket does not need a second parser or a second charter authority.

## Current inline rendering

- `src/play/materialize.ts` owns ticket and story body rendering.
- `renderTicketFile` renders `purpose` into Context.
- `renderTicketFile` renders `doneSignal` into Acceptance Criteria.
- `renderStoryFile` renders scope, story acceptance, honest boundary, wave rationale, and out-of-slice.
- Every prose field passes through `resolveCodesInProse`.
- `resolveCodesInProse` currently returns only a string.
- Its `PROSE_CODE` expression matches uppercase-prefix codes not already followed by ` —`.
- A snapshot hit becomes `code — carried title`.
- A snapshot miss currently passes through verbatim.
- An already-glossed code currently passes through verbatim.
- Foreign prefixes such as the E in `forward-E1` pass through when absent from the snapshot.
- The pure renderers know the exact artifact id and source field at the call site.
- Those call sites are the natural owners of a degradation location string.

## Current write guard

- `findBareCodes` scans fully rendered would-be files.
- It detects unglossed codes in policed prefix families.
- P and N are always policed.
- A prefix family defined by the current charter is also policed.
- Foreign prefix families remain legal passthrough.
- Hits are grouped by filename.
- Codes are deduplicated within each file in body order.
- `materialize` runs this guard before its first directory creation or file write.
- A hit currently causes `BareCodeError`.
- `decomposeEffect` catches that error and returns the `bare-code` outcome.
- The cast log therefore records an editorial cite as a failed, non-materialized run.
- The guard also catches unresolved bare codes emitted by the advances line.
- The advances surface is owned by the next parallel ticket, not this one.
- Keeping the guard after prose transformation preserves a backstop for remaining surfaces.

## Existing materialization result

- `MaterializeResult` returns story file paths and ticket file paths.
- It may also return the existing routing `seatDefaulted` degradation.
- It has no charter-cite degradation field today.
- `decomposeEffect` destructures the materialization result.
- It forwards routing degradation through `EffectResult`.
- `EffectResult` has optional fields for routing provenance but no cite-degrade field.
- `castPlay` currently does not lift charter-cite dispositions into its summary or run log.
- That final transport/presentation is reserved for `T-077-02-04`.
- This ticket must nevertheless make the records available at the effect boundary for that join.

## Existing tests

- `src/play/materialize.test.ts` covers pure renderer bytes and real-filesystem materialization.
- It pins snapshot resolution in purpose, doneSignal, and story fields.
- It pins already-glossed passthrough.
- It pins foreign-prefix passthrough.
- It pins `findBareCodes` independently as a pure scanner.
- Its current prose-miss test expects `BareCodeError` and zero files.
- That expectation is the behavior this ticket replaces.
- Its collision tests prove identity refusal precedes content processing and writes.
- The collision refusal must stay unchanged.
- `src/play/bare-code-cast.test.ts` is an addon-free full-cast fixture.
- It uses a stub executor, the real `clear`, real `materialize`, and `castPlay`.
- Its current first fixture clears all gates, cites unresolved P9 in prose, and expects refusal.
- Its second fixture proves normal resolved cites materialize with no bare P/N codes.
- The first fixture is the most direct acceptance test to invert.
- The same harness can add a structurally invalid plan that stops at a real gate.
- An absent story contract is already a named structural gate defect.
- On a gate STOP, `castPlay` never calls the effect, so target directories stay absent.

## Structural refusal surfaces that remain

- `clear` still refuses missing story contract fields.
- `clear` still refuses malformed allocation and bounds defects.
- `decomposeEffect` still refuses graph integrity violations before materialization.
- `materialize` still refuses cross-board id collisions before rendering writes.
- Enum/alias drift remains a programmer error.
- Filesystem failures remain unexpected errors.
- Lisa validation can still fail after writing and remains outside this editorial classifier.
- This ticket must not soften any of these branches.

## Workspace state

- The branch is shared and already ahead of origin with completed ticket commits.
- Lisa has modified ticket/provenance files outside this ticket's source ownership.
- `docs/active/work/T-077-03-01/` is untracked concurrent work.
- Those changes must remain untouched.
- No ticket-owned source file was modified at Research completion.
- Attempt artifacts are private and ignored from the ordinary source commit.

## Constraints and assumptions

- Only codes from policed charter prefix families are editorial charter cites on a snapshot miss.
- A snapshot-known code is resolvable regardless of prefix.
- A snapshot-unknown foreign prefix remains ordinary prose.
- Each unresolved occurrence should yield one disposition, even when codes repeat.
- The caller must supply stable artifact-and-field provenance.
- Annotation text must not itself look like another bare charter code.
- Already-authored gloss text should remain readable after the code is annotated away.
- The advances line must not be silently changed in this ticket.
- The post-render guard should remain in place as a safety net.
- The full repository gate is `bun run check`.

## Research conclusion

- The smallest owned change is an inline-prose applier inside `materialize.ts`.
- It can reuse the cut-time snapshot and predecessor classifier.
- Pure render call sites can provide exact locations without filesystem knowledge.
- Materialization can collect ordered dispositions and return them with written paths.
- `decomposeEffect` can forward the records without yet changing ledger presentation.
- Existing real-fs and cast fixtures provide both degraded-clear and structural-refusal proofs.
