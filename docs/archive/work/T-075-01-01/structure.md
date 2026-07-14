# Structure — T-075-01-01 extend-face-jargon-classifier

## Change surface

Three repository source/test files are ticket-owned:

1. `src/present/translate.ts` — classifier policy only.
2. `src/present/translate.test.ts` — pure family regression coverage.
3. `src/present/svg-file.test.ts` — live-board designer-projection acceptance proof.

No file is created or deleted in production source. No graph, preset, projector, renderer, CLI,
canonical board, or PM document is modified.

## `src/present/translate.ts`

### Existing boundary retained

`JARGON_CLASSES` remains the only exported policy collection. Its derived `JargonClass` and
`CLASS_ORDER` continue to drive:

```text
JARGON_CLASSES
  ├─ matchClass ──► extractors
  ├─ jargonTokens ──► faceJargon
  └─ scrubFace ──► projectNode face fields
```

No new public function or type is needed.

### Constant changes

- Update `bamlSap` flags from `g` to `gi`.
- Add a named `ci` regex class for standalone CI casing variants.
- Add a named `claudeP` regex class for `Claude` followed by a `p...` word/token.
- Update the adjacent comments so the policy and matching intent are explicit.

### Interfaces

The following exports remain source-compatible:

- `JARGON_CLASSES`
- `JargonClass`
- `jargonTokens(text): string[]`
- `scrubFace(text): string`
- `extractBamlInternals(body): string[]`
- `projectNode(...)`
- `faceText(card): string`
- `faceJargon(card): string[]`

The derived `JargonClass` union gains the two new keys. There are no external exhaustive switches
over that type in the repository; `CLASS_ORDER` consumes keys generically.

### Internal behavior

- `matchClass` remains unchanged.
- Fresh regex construction remains unchanged.
- Deduplication and class-order behavior remain unchanged.
- Cleanup behavior remains unchanged.
- Details extraction continues to use `bamlSap`; it now treats case variants consistently.

## `src/present/translate.test.ts`

### Location

Extend the first describe block:

```ts
describe("jargonTokens / scrubFace — the classifier (one policy, two uses)", ...)
```

This keeps policy tests beside the current denylist representatives.

### Test shape

Add a compact case table with fields such as:

```ts
{
  family: string;
  input: string;
  tokens: string[];
  clean: string;
}
```

One test iterates the cases and asserts:

- reported token matches;
- exact cleaned output; and
- zero tokens after cleaning.

Representatives cover:

- `Baml` and embedded `baml`;
- `Ci` and embedded `ci`;
- live literal `Claude p`;
- longer `Claude prompt` family behavior.

Add a narrow-boundary assertion proving `ci` is not matched inside ordinary words such as
`cites` or `circular`.

### Existing contracts retained

- Existing mixed classifier test remains unchanged.
- Existing cleanup test remains unchanged.
- Existing extractor tests remain unchanged.
- Existing T-018 exact face test remains unchanged.
- Existing zero-jargon and details-reachability tests remain unchanged.

## `src/present/svg-file.test.ts`

### Imports

Add:

```ts
import { faceJargon } from "./translate.ts";
```

No alternate regex or helper policy is introduced.

### Live-board test location

Place the new test in the existing describe block:

```ts
describe("writeBoardSvg — the seam writes the staged artifact, never docs/active", ...)
```

That block already owns live-board integration behavior.

### Traversal

Project once:

```ts
const projection = projectGraph(await loadWorkGraph(), DESIGNER_PRESET);
```

Traverse stable groups/cards and construct a diagnostic array:

```ts
const leaks = projection.groups.flatMap(...)
```

Each leak entry should carry the card ID and the `faceJargon` tokens. Empty cards are omitted.
Assert `leaks` equals `[]`.

### Why no SVG parse

- `writeBoardSvg` renders exactly the `projectGraph` result.
- The story explicitly asks for casting the board through `DESIGNER_PRESET`.
- `faceJargon` accepts `Card`, not serialized SVG.
- Testing the projection avoids brittle XML/text parsing.
- Existing tests already prove the seam output equals direct rendering.

## Attempt artifacts

The following private files are produced but not published directly:

- `.lisa/attempts/T-075-01-01/1/work/research.md`
- `.lisa/attempts/T-075-01-01/1/work/design.md`
- `.lisa/attempts/T-075-01-01/1/work/structure.md`
- `.lisa/attempts/T-075-01-01/1/work/plan.md`
- `.lisa/attempts/T-075-01-01/1/work/progress.md`
- `.lisa/attempts/T-075-01-01/1/work/review.md`

Lisa later admits/publishes these to `docs/active/work/T-075-01-01/`.

## Change ordering

1. Add regression assertions to both test files.
2. Run focused tests to observe the expected red state.
3. Extend `JARGON_CLASSES` only.
4. Run focused tests to green.
5. Run `bun run check`.
6. Record progress and commit the exact three source/test paths via Lisa.
7. Inspect the commit/worktree and write Review.

## Atomic commit unit

The classifier plus both layers of proof form one cohesive unit:

- Production policy without tests is incomplete.
- Unit tests without live composition do not meet acceptance.
- Live proof without production policy cannot clean the board.

Use one `lisa commit-ticket T-075-01-01` invocation with exactly these include paths:

```text
src/present/translate.ts
src/present/translate.test.ts
src/present/svg-file.test.ts
```

No ordinary staging or commit command is used.

## Invariants after the change

- Same graph + same spec still yields deterministic projection bytes.
- Graph data remains frozen and unchanged.
- Every face field still passes through the shared scrubber.
- Every leak verdict still reads from the shared classifier.
- CI matching is token-bounded.
- Existing authored plain face text remains exact unless it contains a newly classified token.
- Details stay reachable through their existing fields.
- No live model, network, clock, or new filesystem effect is introduced.
