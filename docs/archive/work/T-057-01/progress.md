# T-057-01 Progress — annotation-input-and-provenance-render-core

## Status: implementation complete, gate green

All plan steps executed with no deviation from design/structure.

## Completed

- **Step 1** — `src/play/expand-effect.ts`: added, after `renderStagedSignal` and before
  `expandFragmentEffect` (the pure-render region):
  - `export interface Annotation { text; nodeId; seat }` (all `readonly`).
  - `function workItemHref(nodeId)` — private pure helper, id-prefix → board-relative href
    (`E-`→epic, `S-`→stories, `T-`→tickets, unknown→`#<id>`).
  - `export function renderAnnotationProvenance(signal, annotation)` — the AC's subject: two
    italic-underscore markdown lines (provenance naming seat+node, back-link to the work item).
  - **No new runtime import** — `Signal` stays type-only; the module is still addon-free.
- **Step 2** — `src/play/expand-effect.test.ts`: extended the effect import (`Annotation` type +
  `renderAnnotationProvenance`) and added the
  `describe("renderAnnotationProvenance — provenance trailer + back-link (pure)", …)` block with
  five tests covering AC clauses (a) seat+node, (b) back-link, the Signal-is-used clause,
  determinism, and the prefix→dir mapping (epic/story/unknown).
- **Step 3** — full gate green:
  - `bun test src/play/expand-effect.test.ts` → **13 pass / 0 fail** (7 prior + 6 new).
  - `bun run check` (baml:gen + tsc --noEmit + full suite) → **1286 pass / 0 fail**, typecheck clean.

## Deviations from plan

- **One, minor:** plan.md §risk floated a `_text` destructure to document that the feedback body is
  intentionally not echoed. Implemented WITHOUT it — destructured only `{ nodeId, seat }` — to avoid
  any unused-binding lint and keep the function minimal. The "text feeds the Signal, not the trailer"
  rationale is captured in the `Annotation` doc-comment instead. No behavior change.

## Remaining

- Commit (plan Step 4) — one atomic commit, message
  `feat(expand): typed Annotation + pure provenance/back-link render (T-057-01)`.
- Review phase (`review.md`) — the handoff summary.

## Notes for T-057-02 (the next edge)

- `renderAnnotationProvenance` is the building block to thread into `renderStagedSignal` (or the
  effect) so a staged signal carries the provenance trailer. The signature already takes the Signal,
  so T-057-02 calls it inside the staged-render with the cast's annotation context.
- `renderStagedSignal` and `expandFragmentEffect` were deliberately left UNCHANGED — that edit is
  T-057-02's, keeping the dependency boundary clean.
