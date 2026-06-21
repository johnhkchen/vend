# T-057-01 Structure — annotation-input-and-provenance-render-core

The blueprint: exact files, exact insertions, exact public surface. Not code — the shape of it.

## Files touched

| File | Change | Why |
|---|---|---|
| `src/play/expand-effect.ts` | **modify** — add `Annotation` interface, `workItemHref` (private), `renderAnnotationProvenance` (exported) | the cited trailer neighborhood (design D2) |
| `src/play/expand-effect.test.ts` | **modify** — add imports + one `describe` block | the sibling test the AC names |

No files created. No files deleted. No new module (copied-not-imported idiom — no cross-play core).

## `src/play/expand-effect.ts` — additions

Insertion order, placed **after `renderStagedSignal` (ends line 102)** and **before
`expandFragmentEffect`** — the pure-render family stays grouped above the impure verb, mirroring how
`slugify` + `renderStagedSignal` sit above the effect today.

### 1. The `Annotation` interface (after the `renderStagedSignal` block)

```ts
/**
 * A non-dev's feedback on a rendered work-graph node — the inbound half of E-057's round-trip.
 * Captured ONCE, at annotation, as data (P1): the feedback `text` (the fragment the expand clearing
 * prices into a Signal), the `nodeId` it was left on (a board work-item id from the rendered view —
 * E-…/S-…/T-…), and the `seat` that left it. An Annotation mints no id and carries no Signal fields
 * (tier/budget/advances are DERIVED by the clearing, not stated here) — it is the raw fragment +
 * provenance, exactly the E-016 "annotation = fragment plus provenance" reuse contract.
 */
export interface Annotation {
  readonly text: string;
  readonly nodeId: string;
  readonly seat: string;
}
```

### 2. `workItemHref` — private pure helper

```ts
/** Map a work-item node id to a board-relative back-link href, as seen from a staged file under
 *  `docs/active/pm/staged/`. PURE: id-prefix → board dir (`E-`→epic, `S-`→stories, `T-`→tickets),
 *  unknown prefix → an in-doc anchor `#<id>` so the link is never broken and never throws. Local to
 *  this module (the `slugify` copied-not-imported idiom — no shared util, gates.ts rule). */
function workItemHref(nodeId: string): string {
  const dir = nodeId.startsWith("E-")
    ? "epic"
    : nodeId.startsWith("S-")
      ? "stories"
      : nodeId.startsWith("T-")
        ? "tickets"
        : null;
  return dir ? `../../${dir}/${nodeId}.md` : `#${nodeId}`;
}
```

### 3. `renderAnnotationProvenance` — the exported pure render (the AC's subject)

```ts
/**
 * Render an Annotation's PROVENANCE TRAILER + BACK-LINK for a staged signal — the sibling of
 * `renderStagedSignal`'s origin trailer (:99), naming the HUMAN source (seat X on node Y) rather
 * than the play source. PURE (the `renderStagedSignal`/`slugify` pattern): deterministic, no clock,
 * no fs, no BAML — `Signal` is a type-only import. Two italic-underscore lines:
 *   - a provenance line quoting the priced `signal.what`, naming the `seat` and the `nodeId`,
 *   - a back-link referencing the annotated work item (`workItemHref` gives the board-relative path).
 * T-057-02 threads this into `renderStagedSignal`; here it is the standalone pure building block.
 */
export function renderAnnotationProvenance(signal: Signal, annotation: Annotation): string {
  const { text: _text, nodeId, seat } = annotation;
  return [
    `_Provenance: “${signal.what}” — raised by **${seat}** annotating node \`${nodeId}\` on the rendered work-graph._`,
    `_↩ Back to the annotated work item: [\`${nodeId}\`](${workItemHref(nodeId)})._`,
  ].join("\n");
}
```

Note: `text` is destructured-and-ignored (`_text`) to document that the *fragment* is intentionally
NOT echoed in the trailer — it feeds the Signal (`signal.what`), which the trailer already quotes.
This keeps the trailer about provenance, not a duplicate of the feedback body. (If lint flags the
unused binding, drop it from the destructure — `nodeId`/`seat` are the only fields read.)

## Public surface added

- `export interface Annotation` — the typed inbound.
- `export function renderAnnotationProvenance(signal: Signal, annotation: Annotation): string`.
- `workItemHref` stays **private** (no `export`) — an internal detail of the render.

## `src/play/expand-effect.test.ts` — additions

1. Extend the existing effect-module import (lines 9–15) to add `Annotation` (type) and
   `renderAnnotationProvenance`.
2. Add one `describe("renderAnnotationProvenance — provenance trailer + back-link (pure)", …)`
   block, peer to the `slugify + renderStagedSignal` block (after line 166). It builds an
   `Annotation` literal and asserts the AC clauses (see plan.md for the exact cases).

## Ordering & boundaries

- The interface and helper must precede `renderAnnotationProvenance` (TS hoists types but the helper
  read is cleaner top-down). All three sit in the pure-render region above `expandFragmentEffect`.
- No change to `STAGING_DIR`, `ExpandFragmentInputs`, `slugify`, `renderStagedSignal`, or
  `expandFragmentEffect` — the boundary with T-057-02 is exactly "renderStagedSignal unchanged here".
- No import added beyond what the test needs; `expand-effect.ts` gains **zero** new runtime imports
  (`Signal` already imported type-only at line 29).
