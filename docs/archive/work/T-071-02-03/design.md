# Design — T-071-02-03

## Decision

Inject inferred routing inside `decomposeEffect`, immediately before materialization. When and only
when `ctx.inputs.agent` is absent, load the project ledger, call `inferDefaultSeat`, and pass the
chosen seat to the existing `materialize` seat parameter. Return the reader result as
`EffectResult.seatInferred`. Extend `castPlay` to forward that exact marker to `appendRunLog`.

## Options considered

### Infer during CLI/input assembly

This could make `DecomposeInputs.agent` look explicit before casting. It was rejected because direct
and chain assembly have separate callers, creating two injection sites. It would also erase the
difference between caller intent and an inferred default unless more parallel input state were added.

### Infer in the generic cast engine

The engine already writes run records and knows the project root. It was rejected because the engine
does not know which plays write routable Lisa tickets or which input field represents routing. Reading
play-specific inputs there would violate the generic contract and executor-agnostic boundary.

### Infer independently inside `materialize`

Materialization owns ticket rendering and could theoretically load the ledger. It was rejected because
`materialize` is intentionally focused on board rendering and seat validation. Adding filesystem and
heat policy would collapse the pure-core/impure-shell separation and complicate its byte tests.

### Infer in `decomposeEffect` (chosen)

The effect is already the impure shell that owns board writes. Both direct decompose and chain converge
on it, it has the project root, and it already passes routing into `materialize`. The heat reader remains
pure; the effect only composes the existing ledger reader, inference function, and materializer.

## Detailed behavior

1. If `ctx.inputs.agent !== undefined`, do not read or apply inference.
2. Pass the explicit raw value unchanged to `materialize`.
3. This preserves known explicit routing and existing unknown-seat degradation.
4. If the property is absent, load `<projectRoot>/.vend/runs.jsonl`.
5. Feed normalized records to `inferDefaultSeat`.
6. If inference returns null, pass no seat and return no marker.
7. If inference succeeds, pass its known `seat` to `materialize`.
8. Return the same `{ seat, reason }` as `seatInferred`.
9. The cast loop captures the marker without interpreting it.
10. The final run record includes the marker only when present.

## Provenance contract

The effect result gains a structurally local `SeatInferred` interface, parallel to `SeatDefaulted`.
The fields are strings at the generic boundary because the engine must not import play routing policy.
The effect's concrete inferred seat is assignable to this shape. The run-log independently retains its
decoupled structural type, so no engine-to-log policy import is introduced.

## Ledger path

The effect will use `join(root, DEFAULT_RUN_LOG_PATH)`, matching the established chain default-funding
read. This is the production ledger associated with the project. Tests can keep the cast's newly written
record in a separate file so the pre-existing heat fixture remains simple and assertions see one output
record.

## Byte preservation

When inference is null, `materialize` receives `undefined`, exactly as before. No new frontmatter field is
rendered and no marker is returned or logged. The both-cool test compares story and ticket contents against
an empty-ledger baseline, proving the feature's negative path is byte-identical rather than merely similar.

## Explicit override

Presence of any explicit agent suppresses inference, including an explicit known seat and the existing
unknown-seat degradation case. This keeps `--agent` authoritative and ensures `seatDefaulted` and
`seatInferred` cannot both describe the same effect invocation.

## Testing design

- Use `buildRunRecord`/`serializeRunRecord` to write valid heat fixtures.
- Use the existing stub executor and real addon-free decompose effect fixture.
- Verify all materialized tickets carry the inferred seat; expand the plan to more than one ticket.
- Assert the run record contains the exact inferred marker and survives revival.
- Compare both-cool output bytes to a no-ledger baseline and assert absence of `agent` and marker.
- Cast with explicit Claude against hot-Claude evidence and assert Claude wins with no marker.
- Exercise `castChain` with a producing first fixture step and the same decompose fixture play second.
- Assert the chain's decompose record carries inference and its ticket is stamped.

## Rejected scope

- No changes to heat thresholds or cost weighting.
- No changes to run-log marker normalization/schema.
- No CLI flags or executor selection behavior.
- No live quota, 429, monitoring, or rerouting behavior.
- No per-ticket lane selection.
