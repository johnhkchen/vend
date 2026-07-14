# T-077-02-02 — Structure

## File-level change set

| Path | Operation | Responsibility |
|---|---|---|
| `src/play/materialize.ts` | modify | Classify/apply inline cites, aggregate and return dispositions |
| `src/play/materialize.test.ts` | modify | Pure and real-fs proof of annotation and returned records |
| `src/play/decompose-effect.ts` | modify | Forward nonempty cite degradations from materialization |
| `src/play/decompose-effect.test.ts` | modify | Pin concrete effect propagation without ledger changes |
| `src/play/bare-code-cast.test.ts` | modify | Full-cast degraded success plus structural refusal contrast |

No production file is created or deleted.

## Dependency direction

`materialize.ts` adds a runtime import from the existing peer module:

```ts
import {
  classifyCharterCite,
  materializationDisposition,
  type CharterCiteClassification,
  type DegradeDisposition,
} from "./degrade-disposition.ts";
```

This keeps the classifier as the single classification authority.

`decompose-effect.ts` imports only `DegradeDisposition` as a type from the same play layer.

No generic engine module imports a concrete decompose policy module in this ticket.

## `src/play/materialize.ts`

### Comment contract

Update the historical T-067 write-guard commentary to state:

- unresolved inline prose now annotates and reports a successful degradation;
- the remaining rendered-byte guard is a safety net;
- unresolved `advances` behavior remains separately owned;
- structural pre-write guards still precede all filesystem writes.

The comment must not falsely claim every bare code still causes whole-cut refusal after inline
application.

### Public `MaterializeResult`

Add one required field:

```ts
readonly degrades: readonly DegradeDisposition[];
```

Ordering is source/render order.

The field is `[]` for a clean materialization.

Existing `storyFiles`, `ticketFiles`, and `seatDefaulted` fields remain unchanged.

### Public `RenderedFile`

No shape change.

It stays:

```ts
interface RenderedFile {
  readonly name: string;
  readonly body: string;
}
```

This avoids leaking classification metadata into the byte-oriented guard API.

### Internal `DetailedRender`

Add:

```ts
interface DetailedRender {
  readonly file: RenderedFile;
  readonly classifications: readonly CharterCiteClassification[];
}
```

It is private to the module.

### Marker constant

Add:

```ts
const UNRESOLVED_CHARTER_CITE = "[unresolved charter cite]";
```

The marker includes no uppercase-prefix-plus-digits token.

### Prose matcher

Replace the gloss-skipping matcher with one that captures:

- the code;
- an optional following ` — ` delimiter.

Conceptual shape:

```ts
/\b([A-Z]{1,3}\d+)\b( — )?/g
```

The match remains limited to running prose.

### Prefix helper

Keep `policedPrefixes(snapshot)` as the shared definition of charter-family scope.

Both the inline applier and rendered-byte guard call it.

Known snapshot codes are classified regardless; unknown codes are classified only when their
leading-letter prefix is policed.

### Internal prose result

Add:

```ts
interface ResolvedProse {
  readonly text: string;
  readonly classifications: readonly CharterCiteClassification[];
}
```

### `resolveCodesInProse`

Change the private signature to:

```ts
function resolveCodesInProse(
  text: string,
  snapshot: CharterSnapshot,
  location: string,
): ResolvedProse;
```

Algorithm:

1. Allocate an ordered classification array.
2. Compute policed prefixes once for the field.
3. Replace every prose matcher occurrence.
4. If a snapshot-missing prefix is foreign, return the original match.
5. Classify every known or policed cite with action `annotate`.
6. Append classification in occurrence order.
7. Resolvable plus authored delimiter returns the original match.
8. Resolvable without authored delimiter returns `code — title`.
9. Degradable plus authored delimiter returns marker plus one space.
10. Degradable without delimiter returns marker.
11. Structural classification throws an internal invariant error.
12. Return transformed text plus classifications.

The input string and snapshot are not mutated.

### Ticket detailed renderer

Add private:

```ts
function renderTicketFileDetailed(
  t: TicketDraft,
  snapshot: CharterSnapshot,
  agent?: string,
): DetailedRender;
```

Locations:

- purpose: `${t.id}.md#purpose`;
- done signal: `${t.id}.md#doneSignal`.

The advances line continues through `advancesLine` only.

Classifications concatenate purpose then doneSignal, matching body order.

The current exported `renderTicketFile` delegates to the detailed renderer and returns `.file`.

### Story detailed renderer

Add private:

```ts
function renderStoryFileDetailed(
  s: StoryDraft,
  storyTickets: readonly TicketDraft[],
  cutDate: string,
  snapshot: CharterSnapshot,
): DetailedRender;
```

Every present contract field is resolved with its own field-name location.

Pre-DAG fields remain in existing order.

Wave rationale is resolved after the DAG block.

Out-of-slice remains last before provenance.

Classification ordering follows that rendered order.

The exported `renderStoryFile` delegates and returns `.file`.

### Materialize orchestration

`materialize` calls detailed renderers instead of exported byte-only wrappers.

It derives:

```ts
const classifications = [...story details, ...ticket details];
const disposition = materializationDisposition(classifications);
```

Guard order remains:

1. seat default judgment;
2. board id collision gather/judgment;
3. charter snapshot and complete in-memory rendering;
4. classification fold;
5. rendered-byte bare-code guard;
6. directory creation;
7. file writes.

If the fold returns structural refusal, throw an invariant error before directory creation.

If it returns clean or degraded materialization, retain its `degrades` array.

Return that array alongside current result fields.

## `src/play/decompose-effect.ts`

### Concrete result subtype

Add:

```ts
export interface DecomposeEffectResult extends EffectResult {
  readonly degrades?: readonly DegradeDisposition[];
}
```

Change the function return type to `Promise<DecomposeEffectResult>`.

This remains assignable to the generic `Play.effect` contract.

### Success return

Destructure `degrades` from `materialize`.

Spread the field only when it is nonempty:

```ts
...(degrades.length > 0 ? { degrades } : {})
```

No ledger, stdout, outcome, or run-summary change occurs here.

Expected refusal catch arms remain unchanged.

## `src/play/materialize.test.ts`

### Pure renderer additions

Add cases for:

- unresolved bare N4 in ticket purpose becomes the marker;
- unresolved authored-gloss N2 becomes marker plus retained gloss prose;
- repeated occurrences create repeated materializer records at the fs boundary;
- resolved authored gloss remains byte-identical;
- foreign-prefix passthrough remains byte-identical.

Update the empty-snapshot golden because P/N prose fields now annotate if present; the existing
fixture only has P1 in advances, so its bytes should remain unchanged until the advances ticket.

### Real-filesystem replacement

Replace the old prose `BareCodeError` test with:

- a plan whose advances resolve;
- unresolved N4/N2 only in prose;
- successful write of both target directories;
- body contains marker and retains authored gloss text;
- body contains neither N4 nor N2;
- result contains exact ordered `annotate` dispositions.

Keep the collision-first test and make its prose cite irrelevant to the expected identity refusal.

Keep `findBareCodes` tests unchanged to prove the backstop still detects raw would-be files.

## `src/play/decompose-effect.test.ts`

Add a complete plan with an unresolved inline N4 cite.

Call the real `decomposeEffect` with a passing Lisa validator stub.

Assert:

- `ok: true`;
- two artifacts;
- exact degrades field;
- written ticket marker;
- no N4 token in written bytes;
- validator called once.

Existing routing tests remain unchanged.

## `src/play/bare-code-cast.test.ts`

Retain the filename because it still characterizes the historical write-guard boundary and its
remaining scanner.

### Editorial plan

Change the refused fixture into a complete plan citing both N4 and N2 in ticket prose.

The fixture effect records the returned materializer degradations and forwards them in its result.

Assert after `castPlay`:

- `success`;
- materialized true;
- target files exist;
- annotations are present;
- raw N4/N2 tokens are absent;
- exact two records were observed;
- all real gates passed in the run record.

### Structural plan

Add a plan whose story omits the five contract fields.

Assert after `castPlay`:

- `gate-failed`;
- materialized false;
- no story/ticket directories;
- run record names failed story-completeness evidence;
- no degradation record was observed because the effect never ran.

## Files outside the source commit

Attempt artifacts remain under `.lisa/attempts/T-077-02-02/1/work/`.

Lisa publishes them later after lease verification.

Do not include:

- `.lisa/provenance.jsonl`;
- Lisa-modified ticket frontmatter;
- concurrent `T-077-03-01` work;
- generated BAML output with no source schema change.

## Commit unit

The five changed source/test files form one meaningful inline-cite application unit because the
production behavior, effect propagation, pure/fs proof, and cast/structural proof must move
together. Commit them through one `lisa commit-ticket` invocation with five exact includes after
`bun run check` is green.
