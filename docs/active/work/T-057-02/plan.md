# T-057-02 — Plan

_Ordered, independently-verifiable steps. One atomic commit at the end. Gate: `bun run check`._

## Testing strategy

- **Unit (effect), the AC test** — the headline. Stub the cast by calling `expandFragmentEffect`
  directly with an annotated `CastContext` against a `mkdtemp` projectRoot (exactly the existing
  effect-test pattern). Assert the staged file carries the provenance trailer + back-link, AND
  the board (`demand.md`/`epic`/`stories`/`tickets`) is untouched. This is AC#1 verbatim.
- **Unit (render), regression** — the existing `renderAnnotationProvenance` block (T-057-01)
  already pins the trailer's content; the no-annotation `renderStagedSignal` tests already pin
  the unchanged path. Adding the optional param must keep both green (backward compatibility).
- **No integration / live-model test** — `render`/`parse` (BAML) are untouched; the annotation
  never enters the prompt. The cast-level thread (`assembleExpandFragmentInputs`) follows the
  established "assemble verb is not unit-tested" convention.
- **Gate** — `bun run check` (typecheck + lint + full suite). Memory confirms the correct gate is
  `bun run check`, not a `lint` script. Must be green before commit.

## Steps

### Step 1 — thread the field onto `ExpandFragmentInputs`

`src/play/expand-effect.ts`: add `readonly annotation?: Annotation;` to `ExpandFragmentInputs`
with the doc comment from Structure (Change 1). `Annotation` is declared later in the same
module — no import.
**Verify:** `bun run check` typechecks (no value yet reads the field; type-only add).

### Step 2 — append the provenance trailer in `renderStagedSignal`

`src/play/expand-effect.ts`: add the optional `annotation?: Annotation` param; when present, push
a blank line + `renderAnnotationProvenance(signal, annotation)` after the origin trailer, before
the trailing `""` (Change 2). No-annotation branch returns the identical string.
**Verify:** existing `renderStagedSignal` tests stay green (no-annotation path unchanged).

### Step 3 — pass `ctx.inputs.annotation` through the effect

`src/play/expand-effect.ts`: change the write to
`renderStagedSignal(signal, ctx.inputs.annotation)` (Change 3).
**Verify:** existing effect tests stay green (`ctxFor` supplies no annotation → unchanged file).

### Step 4 — thread the cast option

`src/play/expand-fragment.ts`: import `type Annotation` from `./expand-effect.ts`; add
`readonly annotation?: Annotation;` to `ExpandFragmentOptions`; return
`{ fragment, charter, project, annotation: opts.annotation }` from
`assembleExpandFragmentInputs` (Changes 4–5).
**Verify:** `bun run check` typechecks; full suite still green.

### Step 5 — the AC effect test (+ fixture hoist)

`src/play/expand-effect.test.ts`: hoist `FULL_ANNOTATION` to module scope; add `annotatedCtx`;
add the new test in the effect `describe` block asserting trailer + back-link present AND board
untouched (Change 6).
**Verify:** `bun test src/play/expand-effect.test.ts` — the new test passes and all prior tests
in the file stay green.

### Step 6 — full gate + atomic commit

Run `bun run check` (typecheck + lint + full suite, expect ~1287 tests green: 1286 prior + 1 new,
modulo any fixture-hoist neutrality). Commit all three files as one logical change.
Commit message: `feat(expand): thread annotation provenance through the staging effect (T-057-02)`.

## AC → step → test mapping

| AC clause | Step | Test |
|---|---|---|
| staged `<slug>.md` contains the provenance trailer | 2, 3, 5 | new effect test: `toContain("Provenance:")`, seat, nodeId |
| …+ back-link | 2, 3, 5 | new effect test: `toContain("Back to the annotated work item")`, `"../../tickets/T-055-01.md"` |
| NO write to demand.md / epic / stories / tickets (one-way authority) | 3, 5 | new effect test: `exists(...) === false` block (reused) |
| effect test stubs expand-fragment's cast, as expand-effect.test.ts does | 5 | direct `expandFragmentEffect(...)` call on a temp-dir root |
| full suite green via `bun run check` | 6 | the gate |

## Risks & mitigations

- **Trailing-newline drift** — appending must keep the final `""` so the file still ends in `\n`.
  Mitigation: push the trailer BEFORE the existing trailing `""`, not after. Existing
  no-annotation tests catch any drift.
- **Duplicate fixture** — `FULL_ANNOTATION` already exists in the render describe block; hoisting
  (not re-declaring) avoids a shadow. Mitigation: move it to module scope, reference from both.
- **Over-threading** — resist adding the `vend annotate` CLI; that is T-057-03. This ticket stops
  at `assembleExpandFragmentInputs`.

## Definition of done

All four production edits in place, the AC effect test green, every prior test still green,
`bun run check` clean, one atomic commit. `review.md` written.
