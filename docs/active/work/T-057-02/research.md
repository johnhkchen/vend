# T-057-02 — Research

_Thread annotation provenance through expand-fragment's existing cast/effect so a cleared
annotation STAGES one Signal carrying the trailer + back-link._

Descriptive map of the terrain. No solutions here — those are Design's job.

## The ticket in one line

T-057-01 (done, `b585301`) added the typed `Annotation` and the PURE
`renderAnnotationProvenance(signal, annotation)` building block. T-057-02 must THREAD that
building block through the existing expand-fragment cast/effect so the staged `<slug>.md`
actually carries the provenance trailer + back-link — without rebuilding the clearing, gates,
or pricing, and without weakening the one-way-authority staging invariant.

## What already exists (the reuse surface)

### `src/play/expand-effect.ts` — the addon-free staging effect

The module is the world-touching half of the ExpandFragment play, split out from the pure core
and the BAML shell for testability (imports NO BAML — only the pure `renderSignalRow`). Key
members relevant to this ticket:

- `STAGING_DIR = "docs/active/pm/staged"` (:36) — the one place an expand cast writes. NEVER the
  board (`demand.md`, `epic/`, `stories/`, `tickets/`). This is the one-way-authority invariant.
- `ExpandFragmentInputs` (:44) — `{ fragment, charter, project }`, the typed inputs `castPlay`
  threads to BOTH `render` and the gate/effect `CastContext`. This is the natural carrier for a
  new `annotation` field: it already reaches the effect via `ctx.inputs`.
- `renderStagedSignal(signal): string` (:82) — PURE. Builds the staged markdown: a `# <what>`
  heading, the demand-row table, a `## Pull this` block, and an **origin trailer** (:99) naming
  the play + un-promoted status. This is where the provenance trailer must be appended.
- `Annotation` (:112) — `{ text, nodeId, seat }`. Added by T-057-01. The inbound feedback shape.
- `workItemHref(nodeId)` (:123) — PURE, module-local. Maps an id prefix (`E-`/`S-`/`T-`) to a
  board-relative dir, unknown → `#<id>` anchor. Used by the provenance renderer.
- `renderAnnotationProvenance(signal, annotation): string` (:144) — PURE. Returns two
  italic-underscore lines: a provenance line (quoting `signal.what`, naming `seat` + `nodeId`)
  and a back-link line (`[`<id>`](href)`). Added by T-057-01, **fully tested, NOT YET CALLED by
  any production path.** Threading it in is precisely this ticket.
- `expandFragmentEffect(signal, ctx)` (:164) — the one impure verb: `mkdir -p STAGING_DIR` under
  `ctx.projectRoot`, `writeFile(<slug>.md, renderStagedSignal(signal))`. Returns an
  `EffectResult` carrying the staged path. **Calls `renderStagedSignal(signal)` with no
  annotation today** — the seam to thread through.

### `src/play/expand-fragment.ts` — the BAML shell + cast

- `expandFragmentPlay` (:88) — the registry entry. `render` consumes
  `i.fragment/i.charter/i.project` (BAML); `effect` is `expandFragmentEffect`. Render does NOT
  read an annotation — provenance is staging-time metadata, not prompt input.
- `ExpandFragmentOptions` (:111) — the per-cast values (`fragment`, `budget`, `projectRoot`, …).
  The end-to-end entry point a future `vend annotate` seam (out of scope, T-057-03) would call.
- `assembleExpandFragmentInputs(opts)` (:134) — IMPURE. Builds `ExpandFragmentInputs` from the
  charter + snapshot. The place an `opts.annotation` would be copied into the inputs.
- `castExpandFragment(opts)` (:157) — `castPlay` over the play. The full pipeline.

### `src/play/expand-effect.test.ts` — the test pattern to mirror

The AC says "stubbing expand-fragment's cast, exactly as expand-effect.test.ts does." The file
already demonstrates the exact pattern:
- `FULL_SIGNAL` (:31) — a complete clearing Signal built directly (no model call).
- `seedRoot()` (:57) — `mkdtemp` a throwaway projectRoot.
- `exists(path)` (:62) — the negative assertion helper for "nothing written to the board."
- `ctxFor(root)` (:49) — builds a `CastContext<ExpandFragmentInputs>` from `inputsFor(...)`.
- The existing "writes ONLY under docs/active/pm/" test (:99) already asserts NO write to
  `demand.md`/`epic`/`stories`/`tickets`. The new annotation test reuses this exact assertion.
- The `renderAnnotationProvenance` describe block (:170) — `FULL_ANNOTATION` (:172) is already
  defined here; the new effect test can reuse the same annotation fixture shape.

## Constraints & invariants (inherited, do NOT weaken)

1. **One-way authority** — an expand cast stages ONLY to `docs/active/pm/staged/`. The
   annotation thread must not introduce any new write target. (E-057 "Done looks like".)
2. **Purity of the renderers** — `renderStagedSignal` / `renderAnnotationProvenance` import no
   fs, no BAML, no clock. Threading must keep `renderStagedSignal` pure (annotation passed as an
   argument, not read from disk).
3. **Addon-free effect** — `expand-effect.ts` must keep importing NO BAML, so `bun test` can
   value-import it. The annotation is a plain TS type; no addon edge added.
4. **Annotation is staging-time only** — provenance is NOT part of the BAML prompt. `render`
   stays untouched; the field is read only by the effect/renderer.
5. **Backward compatibility** — an expand cast with NO annotation (the `vend expand` gesture)
   must keep producing the exact same staged file. So the annotation is OPTIONAL.

## Open questions for Design

- Where does `annotation` live so it reaches the effect: on `ExpandFragmentInputs` (via
  `ctx.inputs`) or as a separate effect parameter? (`ctx.inputs` is the established channel.)
- Does `renderStagedSignal` gain an optional second parameter, or does the effect concatenate?
- How far up the cast do we thread (`ExpandFragmentOptions` + `assembleExpandFragmentInputs`)
  given the `vend annotate` CLI is the NEXT ticket (T-057-03), not this one?
