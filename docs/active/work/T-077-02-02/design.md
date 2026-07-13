# T-077-02-02 — Design

## Decision summary

Apply unresolved inline charter cites as an annotation during pure rendering, collect one
`DegradeDisposition` per occurrence, return the ordered records from `materialize`, and forward them
from the concrete decompose effect. Keep the post-render `BareCodeError` guard as a backstop for
surfaces this ticket does not own, especially unresolved `advances` output.

The annotation marker will be:

```text
[unresolved charter cite]
```

It deliberately contains no charter code. The exact code remains in the returned structured
disposition, where the final story ticket can record it without reintroducing a bare-code artifact.

## Option 1 — Remove `BareCodeError` entirely

This would delete the post-render scan and allow every unresolved code to materialize.

Advantages:

- minimal control flow;
- no editorial prose cite can trigger the old andon;
- fewer historical concepts in `materialize.ts`.

Rejected because:

- the guard currently covers both prose and `advances`;
- `T-077-02-03` owns the read-side advances normalization and has not landed yet;
- deleting the guard would silently materialize a dangling advances code during the DAG gap;
- it would remove a useful final rendered-byte safety net;
- the story reserves refusal for structural invalidity, but does not require deleting named legacy
  error types before all producing surfaces are migrated.

## Option 2 — Catch `BareCodeError` and write the original files anyway

This would retain current rendering, convert the exception to a warning, and continue to write.

Advantages:

- small diff in the impure materialization function;
- preserves original model prose byte-for-byte;
- can report the existing hit payload.

Rejected because:

- the written board would still carry the unresolved bare cite;
- the acceptance criterion explicitly requires stripping or honest annotation;
- hit grouping deduplicates codes per file and loses occurrence-level provenance;
- the catch cannot identify the originating field reliably from rendered bytes;
- it would turn a failed guard into a bypass rather than an intentional editorial transform.

## Option 3 — Strip unresolved inline codes silently

This would replace each unresolved cite with an empty string and record action `strip`.

Advantages:

- guarantees the artifact is grep-clean;
- simple replacement behavior;
- advances normalization is expected to use this action later.

Rejected for inline prose because:

- silent removal can leave confusing punctuation or an unexplained authored gloss;
- a cold worker reading the board cannot tell that grounding was lost;
- the predecessor explicitly left open the stronger inline annotation choice;
- the ticket asks for an honest marker, and inline prose has room to carry one.

## Option 4 — Annotate inline cites and return structured records

This is the chosen option.

Advantages:

- the materialized board is locally honest about the lost grounding;
- the marker cannot be mistaken for a resolved charter definition;
- the structured record preserves the exact requested code separately;
- location can be attached before rendering erases field boundaries;
- occurrence order can be retained;
- the final ledger ticket receives typed data rather than parsing artifact prose;
- the post-render guard can remain unchanged for non-inline surfaces.

Cost:

- rendering needs an internal detailed result, not only a string;
- ticket and story renderers must aggregate per-field classifications;
- current goldens for empty-snapshot and unresolved prose behavior must change deliberately.

## What counts as an inline charter cite

A code is eligible when either:

1. the cut-time snapshot resolves it, or
2. its leading-letter prefix belongs to a policed charter family.

Policed families retain current materializer policy:

- P and N are always charter families;
- every leading-letter family defined by the current snapshot is also a charter family;
- a snapshot-missing foreign family remains untouched ordinary prose.

This keeps `forward-E1` and `A3` passthrough behavior while handling the reporter's N2/N4 cites even
against a charter snapshot that no longer defines those codes.

## Already-glossed prose

The current regex skips a code followed by ` — `. That is insufficient for this ticket because an
author-supplied gloss can still cite a code absent from the authoritative snapshot.

The new prose matcher will observe an optional following ` — ` delimiter:

```text
N4 — Not an executor
```

For a resolvable code with an authored delimiter, the original text remains unchanged. This
preserves the established idempotence contract.

For an unresolved policed code, the code and delimiter become the marker plus a space:

```text
[unresolved charter cite] Not an executor
```

For an unresolved bare code, only the code becomes the marker:

```text
aligns with [unresolved charter cite] end to end
```

The marker carries no code-shaped token, so the unchanged post-render guard will not reject it.

## Classification and action

Every eligible match calls `classifyCharterCite` with:

- the exact matched code;
- a caller-supplied artifact-and-field location;
- action `annotate`;
- the cut-time snapshot.

Resolvable classifications supply the authoritative title for bare-code expansion.

Degradable classifications supply the exact record returned to callers and trigger marker output.

A structural classification is impossible for regex-produced codes and constant nonblank locations.
The implementation will still switch exhaustively and throw on that internal contract breach rather
than silently materialize a programmer defect.

## Location format

Use `<artifact-file>#<draft-field>`.

Ticket examples:

- `T-900-01.md#purpose`;
- `T-900-01.md#doneSignal`.

Story examples:

- `S-900.md#scope`;
- `S-900.md#storyAcceptance`;
- `S-900.md#honestBoundary`;
- `S-900.md#waveRationale`;
- `S-900.md#outOfSlice`.

This format is deterministic, nonblank, filesystem-independent, and specific enough for a reviewer
to find the editorial source after materialization.

## Renderer organization

Keep the exported pure renderer API stable:

```ts
renderTicketFile(...): RenderedFile
renderStoryFile(...): RenderedFile
```

Add internal detailed renderers that return:

```ts
interface DetailedRender {
  readonly file: RenderedFile;
  readonly classifications: readonly CharterCiteClassification[];
}
```

The exported renderers delegate and return only `file`, preserving callers and render golden shapes.
`materialize` calls the detailed variants so it can aggregate classifications without storing hidden
metadata on the public rendered-file shape.

## Materialization result

Extend `MaterializeResult` with:

```ts
readonly degrades: readonly DegradeDisposition[];
```

The field is always present:

- clean materialization returns `[]`;
- degraded materialization returns records in rendered field/occurrence order.

Always-present data avoids ambiguous `undefined` semantics at this concrete boundary. The later
generic effect/log boundary may choose omission for backward-compatible serialization.

Before writing, fold all classifications through `materializationDisposition`.

- `materialized` contributes an empty record list;
- `materialized-with-degrades` contributes its ordered list;
- `structural-refusal` is an internal invariant failure and writes nothing.

The existing rendered-byte guard still runs after this fold and before writes.

## Concrete effect propagation

Define a decompose-specific effect result subtype carrying optional cite degradations. This avoids
making the generic engine import concrete play policy in this parallel ticket while making records
available to the final join.

`decomposeEffect` forwards `materialize`'s nonempty records on a successful result. A clean result
omits the optional field to retain the current effect object shape. Routing disposition behavior is
unchanged.

The generic cast shell and run log remain untouched here. `T-077-02-04` owns lifting the field into
durable and human-facing output after both inline and advances appliers exist.

## Structural refusal proof

The cast fixture will contain two contrasting plans:

- editorial: a complete, gate-clearing story/ticket whose prose contains unresolved N4 and N2;
- structural: a story missing the required story contract fields.

The editorial plan must:

- return cast outcome `success`;
- report `materialized: true`;
- write both story and ticket files;
- contain annotation markers instead of N4/N2 codes;
- expose exact ordered degradation records from the effect/materializer seam.

The structural plan must:

- stop at `story-completeness`;
- report `gate-failed` and `materialized: false`;
- never call the materializer;
- leave both target directories absent.

This proves the change narrows only editorial refusal and does not weaken structural gates.

## Files deliberately unchanged

- `src/gate/gates.ts` — advances and structural gate policy stay fixed.
- `src/play/decompose-epic-core.ts` — owned by `T-077-02-03`.
- `src/log/run-log.ts` — owned by `T-077-02-04`.
- `src/engine/cast.ts` — durable/summary propagation is deferred.
- BAML schemas and generated clients — no data-model change is required.
- Ticket/story frontmatter — Lisa owns workflow transitions.

## Verification decision

- Update pure render tests for bare and authored-gloss unresolved citations.
- Update real-filesystem materialization tests to assert written markers and returned records.
- Invert the existing cast-level editorial refusal fixture into a degraded success.
- Add a real-gate structural contrast with zero files written.
- Keep pure `findBareCodes` tests to prove the safety net itself remains intact.
- Run focused play tests, typecheck, and the full `bun run check` gate.
- Commit only exact ticket-owned source/test paths through `lisa commit-ticket`.
