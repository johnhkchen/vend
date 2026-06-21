# T-057-01 Review — annotation-input-and-provenance-render-core

Handoff document. What changed, how it's covered, and what a reviewer should know — without reading
every diff.

## What the ticket asked

Define the typed **Annotation** (feedback text + annotated node id + author seat) and a **pure
render** of a provenance trailer + back-link, so a staged signal can name its non-dev source.
Captured once, at annotation, as data. The first pure slice of E-057's annotation→demand round-trip.

## What changed

One commit: `b585301`. Two source files, five new work artifacts.

### `src/play/expand-effect.ts` (modified, +~45 lines, after `renderStagedSignal`)
- **`export interface Annotation`** — `{ text, nodeId, seat }`, all `readonly`. The raw inbound:
  `text` is the fragment the expand clearing prices; `{nodeId, seat}` is the provenance. Mints no id,
  carries no derived Signal fields (tier/budget/advances) — the E-016 "annotation = fragment plus
  provenance" reuse contract.
- **`function workItemHref(nodeId)`** (private) — pure id-prefix → board-relative href:
  `E-`→`../../epic/<id>.md`, `S-`→`../../stories/<id>.md`, `T-`→`../../tickets/<id>.md`, unknown →
  `#<id>`. Never throws; copied-not-imported (the `slugify` idiom).
- **`export function renderAnnotationProvenance(signal, annotation)`** — the AC's subject. Two
  italic-underscore markdown lines: a provenance line quoting `signal.what` and naming `seat`+`nodeId`,
  and a back-link referencing the annotated work item. PURE: no fs, no BAML (`Signal` type-only), no
  clock/random — deterministic.

### `src/play/expand-effect.test.ts` (modified, +~40 lines)
- Import extended with `Annotation` (type) + `renderAnnotationProvenance`.
- New `describe("renderAnnotationProvenance — provenance trailer + back-link (pure)")` block, peer
  to the existing pure-helper block.

### `docs/active/work/T-057-01/` (created)
- `research.md`, `design.md`, `structure.md`, `plan.md`, `progress.md`, `review.md`.

## Test coverage

The AC ("a pure unit test, sibling of expand-effect.test.ts, asserting … seat+node provenance line +
back-link … no BAML, no fs … deterministic") is met by five focused tests:

| AC clause | Test |
|---|---|
| provenance line names seat + node id | `…names the seat and the annotated node id` — asserts `Provenance:`, `designer`, `T-055-01` |
| back-link references the work item | `…back-link references the annotated work item…` — asserts the link text `[\`T-055-01\`]` + href `../../tickets/T-055-01.md` |
| Signal param is used (not dead) | `uses the Signal param…` — asserts the trailer contains `FULL_SIGNAL.what` |
| deterministic across repeat calls | `is deterministic…` — two calls compared with `.toBe` |
| href prefix mapping | `…maps the id prefix…` — epic/story/unknown variants |

- **Targeted file:** 13 pass / 0 fail (7 prior + 6 new).
- **Full gate (`bun run check`):** 1286 pass / 0 fail; `tsc --noEmit` clean; `baml:gen` clean.
- **Purity** is structural (asserted by construction): the test file's BAML imports are all type-only,
  so no native addon loads — the house discipline for "pure" in this module. "Imports no fs" is a
  property of the source, visible in the diff and reviewed in structure.md.

## Design decisions a reviewer should sanity-check

1. **Home = `expand-effect.ts`, not `expand-core.ts`.** The render lives beside its sibling origin
   trailer (`renderStagedSignal`) and the `slugify` precedent for "pure helper beside the fs verb,"
   honoring the ticket's `:80`/`:82` cite. `expand-core.ts` (zero runtime imports) is the strictest
   reading of "no fs," but would scatter the trailer family across modules. Rationale: design.md D2.
   *If the reviewer prefers the strictest-purity home, the function + type move to `expand-core.ts`
   verbatim — no logic change.*
2. **Signal is a real parameter, not decoration.** The trailer quotes `signal.what` so the provenance
   ties to the specific priced signal — avoids a dead param and makes the trailer self-explanatory.
3. **Back-link is a best-effort reference, not a verified link.** No fs check that the target exists
   (that would break the AC). The relative path is deterministic; an unknown prefix degrades to an
   anchor rather than a broken path.

## Open concerns / limitations

- **None blocking.** The slice is intentionally small (a type + one pure function + tests).
- **`workItemHref` couples the `../../` depth to `STAGING_DIR`'s location** (`docs/active/pm/staged/`).
  If staging ever moves, the relative prefix must move with it. Noted, not load-bearing today — the
  link text always carries the bare id, so even a stale href still *references* the item.
- **`text` is not echoed in the trailer** by design (it feeds `signal.what`). If T-057-02 wants the
  verbatim feedback in the staged artifact, it can render `annotation.text` separately — the field
  is on the type.

## Handoff to T-057-02 (`depends_on: [T-057-01]`)

`renderAnnotationProvenance` is ready to thread into `renderStagedSignal` (or the effect) so a staged
signal carries the provenance trailer + back-link. `renderStagedSignal`/`expandFragmentEffect` were
left UNCHANGED here — that edit, and the staged-artifact integration test, are T-057-02's. The
one-way-authority invariant is preserved: this ticket added no write path; nothing reaches the board.
