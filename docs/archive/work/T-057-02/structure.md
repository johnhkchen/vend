# T-057-02 — Structure

_The blueprint: exact file-level changes, signatures, and ordering. Not code — the shape of it._

## Files touched

| File | Change | Why |
|---|---|---|
| `src/play/expand-effect.ts` | modify | Carry `annotation` on inputs; append trailer in `renderStagedSignal`; pass it through the effect. |
| `src/play/expand-fragment.ts` | modify | Carry `annotation` on `ExpandFragmentOptions`; copy into inputs in `assembleExpandFragmentInputs`. |
| `src/play/expand-effect.test.ts` | modify | New effect test: annotated cast stages trailer + back-link AND writes nothing to the board. |

No new files. No deletions. No new modules. Three files, mirroring T-057-01's footprint.

## `src/play/expand-effect.ts`

### Change 1 — `ExpandFragmentInputs` gains an optional annotation (at :44)

```ts
export interface ExpandFragmentInputs {
  readonly fragment: string;
  readonly charter: string;
  readonly project: string;
  /** OPTIONAL provenance for the round-trip (E-057): when this cast originated as a non-dev's
   *  annotation on a rendered work-graph node, the effect renders its provenance trailer +
   *  back-link into the staged signal. Absent for a plain `vend expand` fragment — the staged
   *  file is then byte-identical to before. `render` (BAML) ignores it; it is staging-time
   *  provenance, never prompt input. */
  readonly annotation?: Annotation;
}
```

(`Annotation` is already declared lower in the same module — no import needed; a forward type
reference within one module is fine under `verbatimModuleSyntax`.)

### Change 2 — `renderStagedSignal` gains an optional annotation (at :82)

Signature: `export function renderStagedSignal(signal: Signal, annotation?: Annotation): string`

Shape: build the existing array exactly as today, then — when `annotation` is present — append a
blank line + the two `renderAnnotationProvenance(signal, annotation)` lines AFTER the existing
origin trailer, BEFORE the trailing `""`. The no-annotation branch returns the identical string
it does today (regression-safe). Sketch:

```
const lines = [ …existing through the origin trailer… ];
if (annotation) {
  lines.push("", renderAnnotationProvenance(signal, annotation));
}
lines.push("");           // keep the trailing newline
return lines.join("\n");
```

Doc comment updated to note the optional provenance trailer (machine origin, then human origin).

### Change 3 — `expandFragmentEffect` threads `ctx.inputs.annotation` (at :164)

The only change is the render call:

```ts
await writeFile(path, renderStagedSignal(signal, ctx.inputs.annotation), "utf8");
```

`ctx.inputs` is already typed `ExpandFragmentInputs`; `ctx.inputs.annotation` is `Annotation |
undefined`. Everything else (mkdir, path, EffectResult) is unchanged.

## `src/play/expand-fragment.ts`

### Change 4 — `ExpandFragmentOptions` gains an optional annotation (at :111)

```ts
  /** OPTIONAL annotation provenance (E-057 round-trip). When set, the staged signal carries the
   *  provenance trailer + back-link to the annotated work item. The `vend annotate` seam
   *  (T-057-03) sets this with fragment = annotation.text; a plain `vend expand` leaves it unset. */
  readonly annotation?: Annotation;
```

Add `Annotation` to the existing type import from `./expand-effect.ts`:
`import { expandFragmentEffect, type Annotation, type ExpandFragmentInputs } from "./expand-effect.ts";`

### Change 5 — `assembleExpandFragmentInputs` copies it through (at :142)

```ts
return { fragment: opts.fragment, charter, project, annotation: opts.annotation };
```

`assembleExpandFragmentInputs` is impure and NOT unit-tested (its logic is the pure formatter +
thin fs reads), so this thread is exercised end-to-end only via the effect test's inputs shape —
acceptable, matching the existing no-unit-test convention for the assemble verb.

## `src/play/expand-effect.test.ts`

### Change 6 — a new effect test in the existing effect `describe` block (after :113)

Reuse `FULL_SIGNAL`, `seedRoot`, `exists`, `STAGING_DIR`, `slugify`. Add an annotated ctx:

```ts
const FULL_ANNOTATION: Annotation = {
  text: "this card's blocked edge is hard to spot on the board",
  nodeId: "T-055-01",
  seat: "designer",
};
const annotatedCtx = (root: string): CastContext<ExpandFragmentInputs> => ({
  inputs: { ...inputsFor("this is rough"), annotation: FULL_ANNOTATION },
  projectRoot: root,
});
```

New test — "an annotated cast stages the provenance trailer + back-link, board untouched":
1. `expandFragmentEffect(FULL_SIGNAL, annotatedCtx(root))`.
2. Read the staged `<slug>.md`; assert it `toContain`:
   - `"Provenance:"`, the `seat` (`designer`), the `nodeId` (`T-055-01`) — the trailer;
   - `"Back to the annotated work item"` and `"../../tickets/T-055-01.md"` — the back-link;
   - the existing origin trailer `"not promoted"` still present (trailer is additive, not a
     replacement).
3. Assert the board is untouched — reuse the exact negative block: `exists(demand.md)` /
   `epic` / `stories` / `tickets` all `false`; `exists(STAGING_DIR)` `true`.

(`FULL_ANNOTATION` already exists in the `renderAnnotationProvenance` describe block at :172. To
avoid a duplicate const, hoist that fixture to module scope (top of file, near `FULL_SIGNAL`) and
let both describe blocks reference it.)

## Ordering

1. expand-effect.ts: the interface field, then `renderStagedSignal`, then the effect call (Change
   1→2→3) — each compiles independently.
2. expand-fragment.ts: the option + assemble (Change 4→5).
3. expand-effect.test.ts: hoist the fixture, add the test (Change 6).

One atomic commit — the four production lines and the test are one logical unit (a thread is only
meaningful end-to-end).

## What does NOT change

- The BAML shell `render`/`parse`, the gates (`clear`), the budget, the card.
- `STAGING_DIR`, `slugify`, `workItemHref`, `renderAnnotationProvenance`, the `EffectResult` shape.
- The engine (`castPlay`, `Play.effect` signature, `CastContext`).
- Every existing test — the no-annotation paths are byte-identical.
