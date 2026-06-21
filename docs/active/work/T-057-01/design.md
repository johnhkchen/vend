# T-057-01 Design — annotation-input-and-provenance-render-core

Decisions, grounded in research. What we build, and what we reject and why.

## The two things to design

1. The `Annotation` type shape.
2. The provenance-trailer render: its home module, its signature, and its output.

---

## Decision 1 — `Annotation` shape

```ts
export interface Annotation {
  readonly text: string;    // the feedback a non-dev typed against a rendered node
  readonly nodeId: string;  // the annotated work-item id (E-…/S-…/T-…) from the rendered view
  readonly seat: string;    // the author seat (e.g. "designer", "founder") — who left it
}
```

- **`readonly` everywhere** — the `model.ts`/`spec.ts`/`ProjectionLink` immutability idiom; an
  annotation is captured data, not a mutable record.
- **Three fields, exactly the ticket's triple** — "feedback text + annotated work-item/node id +
  author seat". No `timestamp` (would break determinism + isn't named), no `id` (an annotation is
  not a board artifact; it mints none — the same stance `Signal` takes, expand-effect header
  lines 20–25). The epic's E-016 reuse contract says an annotation is "just a fragment plus
  provenance"; `text` is that fragment, `{nodeId, seat}` is the provenance.

**Rejected:** adding `tier`/`budget`/`advances` to `Annotation`. Those are *Signal* fields — the
expand clearing derives them from the annotation's `text` (T-057-02 / the live model). Duplicating
them here would pre-empt the clearing and couple the input to the output. The Annotation is the raw
inbound; the Signal is the priced outbound. Keep them distinct.

---

## Decision 2 — home module: `expand-effect.ts` (not `expand-core.ts`)

Two viable homes (research §"reuse target" vs §"purest sibling"):

| Option | Pro | Con |
|---|---|---|
| **A. `expand-effect.ts`** (chosen) | The cited `:80`/`:82` neighborhood; the provenance trailer is the literal sibling of the origin trailer that lives *here*; co-located with `renderStagedSignal`, which T-057-02 will extend to call it; `slugify` is the proven precedent for "pure helper beside the fs verb". | The *module* imports fs (the function does not). |
| B. `expand-core.ts` | Strictest reading of "imports no fs" — the module has zero runtime imports. | The trailer the ticket says to extend is NOT here; would split the two trailers across modules; `renderSignalRow` is the only render here and it is the *row*, not the *trailer*. |

**Chosen: A.** The AC's "imports no fs" is a property of the **render function**, not a demand to
relocate the trailer family. `renderStagedSignal` and `slugify` already live in `expand-effect.ts`,
are described in the header as PURE, touch no fs, and are tested as ordinary pure functions in
`expand-effect.test.ts` — the exact precedent. fs is not a native addon; the flakiness the
core/effect split guards against is **BAML**, and `expand-effect.ts` is explicitly addon-free.
Placing the provenance render beside its sibling origin trailer is the cohesive choice and is what
T-057-02 will reach for when it threads provenance into `renderStagedSignal`. Splitting the type +
render into `expand-core.ts` would scatter the annotation feature across two modules for a purity
nuance the precedent already resolves.

---

## Decision 3 — render signature & output

```ts
export function renderAnnotationProvenance(signal: Signal, annotation: Annotation): string
```

- **Takes the Signal AND the Annotation** — the AC pins "given a Signal + {seat, nodeId}". The
  Signal is *used* (not a dead param): the provenance line quotes the priced `signal.what`, tying
  the trailer to the specific staged signal it provenances. This avoids an unused-parameter lint
  smell and makes the trailer self-explanatory ("*this* signal came from *that* annotation").
- **Returns a markdown fragment** (two italic-underscore lines, the origin-trailer house style):

  ```
  _Provenance: “<signal.what>” — raised by **<seat>** annotating node `<nodeId>` on the rendered work-graph._
  _↩ Back to the annotated work item: [`<nodeId>`](<href>)._
  ```

  - **Line 1 (provenance)** names the **seat** and the **node id** — AC requirement (a).
  - **Line 2 (back-link)** references the **annotated work item** by id, as a markdown link — AC
    requirement (b). The link text carries the bare `nodeId` (always satisfies "references the
    item"); the href is a navigable relative path when the id prefix is known.

### Back-link href — a small pure helper

```ts
function workItemHref(nodeId: string): string
```

Maps the id prefix to its board directory, relative to a staged file under `docs/active/pm/staged/`:
`E-` → `../../epic/<id>.md`, `S-` → `../../stories/<id>.md`, `T-` → `../../tickets/<id>.md`. An
unrecognized prefix falls back to `#<nodeId>` (an in-doc anchor) so the link is never broken and the
function never throws on odd input. PURE, local to the module (copied-not-imported, the `slugify`
precedent / gates.ts no-shared-util rule).

**Rejected:** constructing an absolute path or reading the filesystem to confirm the target exists —
that would import fs and break the AC. A back-link is a *reference*, not a verified link; resolving
it is the reader's (or a later dashboard's) job. The relative path is a deterministic best-effort.

**Rejected:** emitting only the bare id with no link. The epic's "Done looks like" wants the
round-trip **traceable**; a navigable relative link is strictly better and still pure.

---

## Determinism & purity (the AC's teeth)

- Pure string interpolation over the inputs — **no `Date`, no `Math.random`, no fs, no BAML**.
- `renderAnnotationProvenance(s, a) === renderAnnotationProvenance(s, a)` for equal inputs — the
  test asserts this by calling twice and comparing.
- `Signal` stays a **type-only** import; no new value import enters `expand-effect.ts`, so the
  module remains addon-free.

## What this ticket deliberately does NOT do

- Does **not** modify `renderStagedSignal` or `expandFragmentEffect` (T-057-02 threads provenance
  into the staged artifact).
- Does **not** add a `vend annotate` CLI (T-057-03).
- Does **not** write to disk or the board — one-way authority is preserved for free.
