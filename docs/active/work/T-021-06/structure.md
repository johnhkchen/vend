# T-021-06 — Structure: paper-renderer-tree-and-brief

The blueprint — files, module boundaries, public interfaces, internal organization, ordering. Not
code; the shape of the code.

## Files

| File | Action | Purpose |
|---|---|---|
| `src/present/paper.ts` | **create** | The pure paper renderer: tree + faces + brief + composer. |
| `src/present/paper.test.ts` | **create** | Pure tests over a fabricated frozen graph + a live-board AC test. |

No edits to `model.ts` / `spec.ts` / `translate.ts` / `project.ts` — the renderer is a pure
*consumer* of their exports. No CLI edit in this ticket (D7 defers `vend present`). One module added
to `src/present/`, the data/presentation split's home.

## `src/present/paper.ts` — module layout (top → bottom)

A header comment in the house style (cf. project.ts): names the ticket/story/epic, states the
data/presentation split role (the 4th leg — IR → paper), the purity + honest-empty + one-way
authority invariants, and "composition, not reinvention."

1. **Imports (type-only where erasable).**
   - `type { WorkGraph, EpicNode, StoryNode, TicketNode, AnyNode } from "../graph/model.ts"`
   - `type { PresentationSpec } from "./spec.ts"`
   - `{ projectGraph } from "./project.ts"` + `type { Projection, ProjectionGroup, ProjectedCard,
     ProjectionOverlays } from "./project.ts"`
   - `{ scrubFace, humanizeTitle, stateKey } from "./translate.ts"` + `type { Card } from
     "./translate.ts"`

2. **Public option / narrative types.**
   - `interface BriefNarrative { readonly direction?: string; readonly decision?: string }` — authored
     prose for the brief, routed not invented (honest-empty when absent).
   - `interface RenderOptions { readonly overlays?: ProjectionOverlays; readonly narrative?:
     BriefNarrative }`.

3. **State vocabulary (private constants).**
   - `STATE_EMOJI: Record<string,string>` — `{ done:"✅", in_progress:"🔄", open:"⬜", ready:"⬜" }`.
   - `STATE_CLASS: Record<string,string>` — `{ done:"done", in_progress:"active", open:"todo",
     ready:"todo" }`.
   - `LABEL_EMOJI: Record<string,string>` — lowercased display-label → emoji (`"done"`, `"in progress"`,
     `"to do"`) for the face chip (face.state is a *label*, not a key).
   - `NOTHING = "nothing here"` — the single IA-4 placeholder string.

4. **Pure helpers (private).**
   - `sanitizeId(id) → string` — `[^A-Za-z0-9_] → "_"`; the Mermaid-safe node id.
   - `mmLabel(text) → string` — `"` →`'`, `[`/`]`→`(`/`)`, newlines→spaces, then wrap `["…"]`.
   - `stateEmoji(key) / stateClass(key)` — table lookups, default `""` / `"default"`.
   - `labelEmoji(label) → string` — `LABEL_EMOJI[label.toLowerCase()] ?? ""`.
   - `detailsSummary(card) → string` — count phrase from `card.details`; `""` when empty.
   - `cardIndex(projection) → Map<string, ProjectedCard>` — flatten groups → id lookup for the tree.
   - `rollUpState(group) → string` — D8 status rollup from `card.color`.

5. **The tree (private builders + public `renderTree`).**
   - `treeNodeLine(node, label, key, lines)` — push `ID["label"]:::class` once (dedupe via a `Set`).
   - `walkContainer(node, parentId, index, out)` — recursive: emit this node, then either its children
     (epic→stories, story→tickets) or a `NOTHING` leaf when the child list is empty (D5 scope 2).
     Ticket leaves pull their label from `index` (the projected card's `face.plainTitle`, fallback
     `humanizeTitle(title)`), emoji/class from `stateKey(ticket)`.
   - `renderTree(graph, projection): string` — assemble: ` ```mermaid `, `graph TD`, the `classDef`
     block, `ROOT["🛒 …"]:::root`, then `walkContainer` per epic (or one `NOTHING` child when the
     board has no epics — D5 scope 1), close fence.

6. **The faces (public `renderFaces`).**
   - `faceBlock(pc: ProjectedCard) → string` — the blockquote (D4), each line omitted when absent.
   - `renderFaces(projection): string` — section heading + every group's cards in order, or a single
     `*nothing here*` when there are no cards.

7. **Designer view (public `renderDesignerView`).**
   - `renderDesignerView(graph, projection): string` — `## ◤ Designer view — the decomposition tree`
     + `renderTree` + `### Card faces` + `renderFaces`.

8. **Founder brief (public `renderFounderBrief`).**
   - `briefRow(group) → string` — `| {group.label} | {emoji} {Title-cased state} |`.
   - `renderFounderBrief(projection, narrative?): string` — `## ◤ Founder/director view — the brief`,
     optional **Direction** paragraph (from `narrative.direction`), the `| Theme | State |` table (or
     `*nothing here*` when no groups — D5 scope 3), optional **The one decision waiting on you:** line
     (from `narrative.decision`). Both narrative lines omitted when absent.

9. **The composer (public `renderPaper`).**
   - `presetHeader(spec) → string` — the mock's preset blockquote echoing the knobs.
   - `founderSpec(spec) → PresentationSpec` — `{ ...spec, groupBy:"epic", colorLanguage:"status",
     density:"low", preset:"custom" }` (D7).
   - `renderPaper(graph, spec, opts: RenderOptions = {}): string` — header + designer view (projected
     under `spec`) + founder brief (projected under `founderSpec`), joined with `---` rules, matching
     the mock's section order.

## Public interface (the export surface)

```ts
export interface BriefNarrative { readonly direction?: string; readonly decision?: string }
export interface RenderOptions  { readonly overlays?: ProjectionOverlays; readonly narrative?: BriefNarrative }
export function renderTree(graph: WorkGraph, projection: Projection): string
export function renderFaces(projection: Projection): string
export function renderDesignerView(graph: WorkGraph, projection: Projection): string
export function renderFounderBrief(projection: Projection, narrative?: BriefNarrative): string
export function renderPaper(graph: WorkGraph, spec: PresentationSpec, opts?: RenderOptions): string
```

Internal helpers stay unexported unless a test pins them (`sanitizeId`, `mmLabel`, `rollUpState` are
likely test targets → export those three; keep the rest private).

## `src/present/paper.test.ts` — layout

Mirrors `project.test.ts`: build a small real frozen graph via `buildGraph` (not a cast) — reuse the
2-epic/3-story/5-tickets fixture shape, plus **one empty-branch case** (an epic with no stories /
a story with no tickets) to exercise IA-4. `describe` blocks:

- **`renderTree`** — root + classDef present; every ticket id appears as a sanitized node; an empty
  branch emits exactly one `nothing here` leaf (and no fabricated node); deterministic (same inputs →
  identical string).
- **`renderFaces`** — a card with an authored `why` shows `*Why:*`; one without omits it; details
  summary appears only when details non-empty.
- **`renderFounderBrief`** — one row per epic theme; rolled state correct (all-done → Done, any
  in-progress → In progress); `narrative.decision` present → the decision line; absent → omitted;
  empty projection → `nothing here`.
- **`renderPaper`** — contains the designer tree section, the faces, and the founder table; no jargon
  (`faceJargon`-style spot check that no `*.ts`/charter-code leaks onto the rendered face lines).
- **AC (live board)** — `await loadWorkGraph()`; `renderPaper(graph, DESIGNER_PRESET)` contains a
  Mermaid block, the designer + founder section headings, and at least one state emoji; an empty-board
  graph (built in-test) renders `nothing here`. Asserts the graph object is reference-unchanged.

## Ordering of changes

1. `paper.ts` helpers + state tables → 2. tree → 3. faces/designer view → 4. brief → 5. composer →
6. `paper.test.ts` alongside (eval-friendly: write the AC-contract test first per house practice).
Single commit (one cohesive module) after `bun run check` is green.
