# T-021-06 — Design: paper-renderer-tree-and-brief

Decisions, grounded in Research. One new pure module renders the projection (+ graph) to the paper
artifact. The recurring tension: the projection is **flat**, but a *decomposition tree* and a
*founder brief* want different views of the same graph. Resolved by choosing the right input per
surface and reusing the upstream legs rather than reinventing them.

## D1 — One module, `src/present/paper.ts`; pure string builders

**Decision:** add `src/present/paper.ts` (+ `paper.test.ts`), the fourth and final leg of the
data/presentation split, parallel to `translate.ts`/`project.ts`. Pure: no fs/clock/network/addon;
graph/spec/projection types imported type-only; value imports are translate.ts's pure helpers and
project.ts's `projectGraph`. **Rejected:** rendering inside `project.ts` (conflates "what to show"
with "how to draw it" — the projection is the renderer-agnostic IR, and a Linear renderer is a
*second* consumer of the same `Projection`); a `vend present` CLI dispatch *as the deliverable*
(the AC says "running the renderer," satisfied by an exported entry + a live-graph test — the impure
CLI shell is a thin follow-on, deferred per D7).

## D2 — The tree takes `(graph, projection)`, not the projection alone

**Decision:** `renderTree(graph, projection)`. The mock's "decomposition tree" is the epic→story→
ticket **containment hierarchy** — which lives in the graph's object refs (`epic.stories`,
`story.tickets`), *not* in the flat projection (where epics/stories are only group labels). The
projection supplies a flattened **`Map<id, ProjectedCard>`** so each ticket node renders its
projected (scrubbed, possibly overlay-authored) plain title.

**Rejected — 2-level tree from the projection alone** (`root → group → cards`): simpler and
fully projection-driven, but (a) it can only ever be two levels, not a true decomposition tree, and
(b) it **cannot show an empty branch** — an epic with no tickets never forms a bucket, so it simply
vanishes, which is exactly the "fabricated vs. honest-empty" failure the AC guards against. The
graph-walked tree shows the empty epic and renders "nothing here" under it (D5). The cost — coupling
the renderer to the graph shape — is acceptable: the whole layer already depends on `model.ts`.

The **faces** and the **brief** stay projection-only (faces are per-card; the brief rolls up an
epic-grouped projection) — so only the tree needs the graph.

## D3 — The tree colors and chips by STATE, uniformly, via `translate.stateKey`

**Decision:** every tree node (epic, story, ticket) gets its color `classDef` and its emoji chip
from `stateKey(node)` (translate.ts) → `open|in_progress|done`. The mock's tree is state-colored
(`color_language: state`), and "where does it stand" is the universal reading of a decomposition
tree. This is **independent of `spec.colorLanguage`** (which governs the *board/faces*, where the
calibration knob belongs). `classDef`s: `done` (green), `active` (amber, = in_progress), `todo`
(grey, = open/ready), `root` (purple). A `stateClass(key)` / `stateEmoji(key)` pair maps the three
state keys to class + emoji, with a default bucket.

**Rejected:** coloring tree tickets by `card.color` (the projection's `colorLanguage` token) — would
make the tree's colors swing with an unrelated knob (leverage tokens like `high`/`critical` have no
tree palette) and break uniformity with container nodes (which have no card). State is the one signal
every node kind shares.

## D4 — Faces render `ProjectedCard`s straight; honest-empty per field

**Decision:** `renderFaces(projection)` emits one blockquote per `ProjectedCard`, in projection order
(group order, then id-sorted within — already deterministic from T-021-05):

```
> **{face.plainTitle}** · {emoji} {face.state}
> *Why:* {face.why}
> *What it breaks down to:* {face.breakdown}
> *[ Details ▸ ]* — {detailsSummary}
```

Every line is **omitted when its field is absent** (the translate.ts honest-empty discipline —
`projectNode` already omits `why`/`breakdown` when no overlay/structure supplies them). `face.state`
is already the spec's display label ("Done"); the emoji is mapped from it via a small
label→emoji table (case-insensitive, falls back to no emoji). `detailsSummary` is a plain count
phrase derived from `card.details` (`"3 codes · 2 cites · BAML internals · raw ACs"`), omitted whole
when details is empty. The face strings are already `scrubFace`d upstream — no re-scrub needed, but
the Mermaid path (D6) still escapes for syntax safety.

## D5 — Honest-empty (IA-4): "nothing here", three scopes

**Decision:** the AC's teeth. Three nested scopes, all rendering the literal **`nothing here`** and
never a fabricated node:

1. **Empty board** (`graph.tickets.length === 0` / no epics): the tree is a single root with one
   `nothing here` child; faces and brief each render a one-line `*nothing here*`.
2. **Empty container branch** (an epic with `stories: []`, or a story with `tickets: []`): the walk
   emits a `nothing here` leaf under that container instead of recursing into nothing.
3. **Empty brief** (the epic-grouped projection has zero groups): the themes table is replaced by
   `*nothing here*`.

Grounded in IA-4 / the survey-core honest-empty rule: absence is reported as absence, never padded.

## D6 — Mermaid emission is a pure, escaped sub-builder

**Decision:** a private `mermaid` section builder. Node id = `sanitizeId(node.id)` (`[^A-Za-z0-9_]
→ _`; root = `ROOT`). Label = `mmLabel(text)` → wrap `["…"]`, replace `"`→`'`, `[`/`]`→`(`/`)`,
collapse newlines to spaces. Edges `PARENT --> CHILD`. `classDef` block emitted once at top; each
node tagged `:::class`. Deterministic walk order (graph lists are already id-sorted) → byte-identical
output (P5). **Rejected:** a Mermaid library — overkill, an impure dep, and the subset we emit
(`graph TD`, nodes, edges, classDef) is a dozen lines of string-join.

## D7 — `renderPaper(graph, spec, opts?)` composes the full artifact; brief prose is routed

**Decision:** the one high-level entry mirrors the mock end-to-end:

```
renderPaper(graph, spec, opts?) =
  presetHeader(spec)
  + renderDesignerView(graph, projectGraph(graph, spec, opts?.overlays))      // tree + faces
  + renderFounderBrief(projectGraph(graph, founderSpec(spec), opts?.overlays), // epic table + decision
                       opts?.narrative)
```

`founderSpec(spec) = { ...spec, groupBy:'epic', colorLanguage:'status', density:'low',
preset:'custom' }` — so the brief's per-epic state rolls up cleanly from `card.color` (now a status
key). The **authored brief prose** — `narrative.direction`, `narrative.decision` — is an optional
input, **routed and omitted when absent** (honest-empty; the mock's Direction/decision sentences are
human-authored, not derivable). `projectGraph` is called twice; it is pure and cheap.

**Rejected:** inventing the Direction/decision from graph stats (e.g. "N done, 1 in progress") —
that crosses from *reporting* into *manufacturing editorial prose*, the exact line translate.ts's D1
draws. A future `steer`/`survey` output could *supply* `narrative`; the renderer must not fabricate it.

## D8 — State rollup for the brief is pure and explicit

**Decision:** `rollUpState(group) → key`: `in_progress` if any `card.color === 'in_progress'`, else
`done` if all `=== 'done'`, else `open`. Mirrors the mock ("the one thing moving" = in progress).
Depends on the founder projection being **status-colored** — guaranteed by `founderSpec` (D7), and
documented as the contract for a standalone `renderFounderBrief` call.

## Public surface (frozen by this design)

`renderTree(graph, projection)`, `renderFaces(projection)`, `renderDesignerView(graph, projection)`,
`renderFounderBrief(projection, narrative?)`, `renderPaper(graph, spec, opts?)`, plus the
`BriefNarrative` / `RenderOptions` types. Helpers (`sanitizeId`, `mmLabel`, `stateClass`,
`stateEmoji`, `rollUpState`, `detailsSummary`) stay private except where a test needs them.
