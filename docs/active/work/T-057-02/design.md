# T-057-02 — Design

_Decide how to thread the annotation through expand's clearing so the staged Signal carries the
provenance trailer + back-link. Grounded in Research; one decision, rejections recorded._

## The shape of the decision

Three threading questions, each with a clear winner given the codebase reality.

### Q1 — How does the annotation reach the effect?

**Options**

- **A. Carry it on `ExpandFragmentInputs`** (`ctx.inputs.annotation`). The inputs already flow to
  the effect via `CastContext<ExpandFragmentInputs>` — `expandFragmentEffect` receives `ctx`
  today and reads `ctx.projectRoot`; reading `ctx.inputs.annotation` is a zero-plumbing add.
- **B. Add a separate `annotation` parameter to `expandFragmentEffect`.** Diverges the effect
  signature from the `Play.effect` contract (`(result, ctx) => EffectResult`) the engine calls —
  `castPlay` invokes the effect with exactly `(signal, ctx)`, so a third param could never be
  supplied through the cast. Dead-on-arrival for the end-to-end path.
- **C. A module-level mutable.** Rejected on sight — breaks purity, breaks concurrency (Lisa runs
  multiple threads), un-testable.

**Decision: A.** The inputs are the engine's established side-channel into the effect. The
`Play.effect` signature stays exactly `(signal, ctx)`; the annotation rides `ctx.inputs`, which
is already typed `ExpandFragmentInputs`. No engine change, no contract divergence.

`annotation` is **optional** (`readonly annotation?: Annotation`) — a plain `vend expand` cast
supplies none and the staged file is byte-identical to today (invariant #5).

### Q2 — Where is the provenance trailer appended?

**Options**

- **A. `renderStagedSignal` gains an optional 2nd param** `(signal, annotation?)` and appends
  `renderAnnotationProvenance(signal, annotation)` when present. One pure render owns the whole
  staged document; the trailer sits right after the existing origin trailer.
- **B. The effect concatenates** `renderStagedSignal(signal) + renderAnnotationProvenance(...)`.
  Splits the document's shape across two call sites; the effect (impure) starts owning layout,
  which today lives entirely in the pure renderer. Rejected — leaks layout into the verb.

**Decision: A.** Keep the document a single pure function. `renderStagedSignal(signal,
annotation?)` stays deterministic, fs-free, BAML-free (invariant #2) — `renderAnnotationProvenance`
is already pure, so composing them preserves purity. The trailer renders only when an annotation
is present, so the no-annotation path is unchanged.

Placement: append AFTER the existing origin trailer line (`_Staged by Vend's `expand-fragment`
play…_`), separated by a blank line. The origin trailer names the PLAY source; the provenance
trailer names the HUMAN source — they read as two stacked attributions, machine then human.

### Q3 — How far up the cast do we thread?

**Options**

- **A. Effect + renderer only.** Satisfies the AC literally (the AC tests the effect). But leaves
  `assembleExpandFragmentInputs` unable to populate `annotation`, so a real `castExpandFragment`
  could never carry one — the thread would dead-end one call below the cast.
- **B. Effect + renderer + `ExpandFragmentOptions.annotation` + `assembleExpandFragmentInputs`.**
  Threads the whole path: a caller passes `opts.annotation`, assemble copies it into the inputs,
  the effect renders it. The `vend annotate` CLI (T-057-03) then only has to build the opts.
- **C. B + the `vend annotate` CLI seam.** That CLI is explicitly the NEXT slice (E-057 names two
  slices; the CLI is slice 2 / T-057-03). Out of scope here.

**Decision: B.** The ticket says "thread … through expand-fragment's existing cast/effect" — the
cast, not just the effect. Threading `ExpandFragmentOptions` + `assembleExpandFragmentInputs` is
four trivial lines and makes the cast genuinely annotation-capable, so T-057-03 is pure CLI glue.
We stop before the CLI (C) — that is a separate ticket with its own gesture/flag surface.

## The resulting change, in prose

1. `ExpandFragmentInputs` gains `readonly annotation?: Annotation`.
2. `renderStagedSignal(signal, annotation?)` appends the provenance trailer when an annotation is
   present (calling the already-shipped `renderAnnotationProvenance`).
3. `expandFragmentEffect` passes `ctx.inputs.annotation` into `renderStagedSignal`.
4. `ExpandFragmentOptions` gains `readonly annotation?: Annotation`;
   `assembleExpandFragmentInputs` copies `opts.annotation` into the returned inputs.

## Why this is right (and safe)

- **Reuse, not rebuild** — the clearing, gates, pricing, and staging path are untouched; the
  annotation is purely a render-time provenance addendum. This is exactly E-057's reuse contract
  ("an annotation is just a fragment plus provenance").
- **Invariant-preserving** — no new write target (one-way authority holds, #1); renderers stay
  pure (#2); no BAML edge added (#3); `render` untouched so provenance never enters the prompt
  (#4); annotation optional so `vend expand` is byte-identical (#5).
- **Testable exactly as the AC demands** — the effect test stubs the cast by calling
  `expandFragmentEffect(FULL_SIGNAL, ctxWithAnnotation)` against a temp-dir root, reads the
  staged file, asserts the trailer + back-link are present, and reuses the existing "no board
  write" assertion block.

## Rejected, in one place

- Effect param (Q1-B) — breaks the `Play.effect` contract the engine calls.
- Module mutable (Q1-C) — breaks purity + concurrency.
- Effect-side concatenation (Q2-B) — leaks document layout into the impure verb.
- Effect-only thread (Q3-A) — dead-ends the annotation one call below the cast.
- CLI seam (Q3-C) — out of scope; it is T-057-03 (slice 2).
