# T-021-06 — Research: paper-renderer-tree-and-brief

**Ticket:** render the projection to the MCP-independent **paper artifact** — the Mermaid
decomposition tree + plain card faces (designer) and the collapsed founder/director brief. This is
the *render contract* a Linear renderer later executes. Story S-021-03's third and last ticket;
follows T-021-05 (the pure projection). Advances P5 (consistency), P1.

This is descriptive — what exists, where, how it connects. No solutions here.

## The render contract (the target shape)

`docs/active/pm/linear-surface-mock.md` is the **canonical paper mock** the AC names. It renders
the real board (E-013…E-019) through the designer preset, on paper, **zero Linear dependency**. Its
shape, section by section:

1. **A preset header blockquote** — echoes the active spec knobs (`vocabulary · density · metaphor ·
   color_language · face · details`), with the note "calibration edits this header, never the graph."
2. **◤ Designer view — the decomposition tree**: a Mermaid `graph TD` with three `classDef`s
   (`done` green, `active` amber, `root` purple), a root node `V["🛒 Vend — the project"]`, epics as
   `V --> E16[...]` branches, and **one branch expanded** to story → tickets to show depth. Node
   labels are plain language + a state emoji (✅ 🔄). Colored by **state**.
3. **Card faces** — per-node blockquotes: `**title** · ✅ Done`, `*Why:* …`, `*What it does:* …`,
   and a `*[ Details ▸ ]*` line naming the dev-layer tokens "one tap away." Plain, low-density.
4. **The before→after table** — one ticket (`T-018-01`) raw-vs-face (illustrative; T-021-04 already
   ships the translation that backs this).
5. **◤ Founder/director view — the brief** *(same graph, `density: brief · group_by: epic`)*: a
   one-paragraph **Direction** line, a compact **| Theme | State |** table (one row per epic theme,
   rolled-up state), and **"The one decision waiting on you: …"**. "No tickets, no IDs, no jargon —
   shape, direction, and the single call that's the director's."
6. A post-it round-trip illustration + a "how to read this" rubric (out of scope for the renderer).

The AC: *running the renderer on the live board reproduces a designer-preset tree + faces and a
founder brief matching the mock **in shape**; an honest-empty branch renders 'nothing here' (IA-4)
rather than fabricated nodes.* "In shape," not byte-identical — the authored prose in the mock
(epic plain-titles, the Why text, the decision) is human-authored and not derivable.

## What already exists upstream (the three landed legs)

The data/presentation split is the whole architecture of E-021. Three legs landed before this:

- **`src/graph/model.ts` (T-021-01)** — the pure `WorkGraph`: frozen `epics/stories/tickets` lists +
  `byId` index. **Containment is OBJECT refs** (`epic.stories → StoryNode[]`, `story.tickets →
  TicketNode[]`); cross/back edges are ids (`ticket.dependsOn/blocks`, `story.epicId`). So the object
  graph is a **tree** — exactly what a decomposition tree walks. `deepFreeze` is exported.
  `src/graph/load.ts` is the one impure verb (`loadWorkGraph()`) reading `docs/active/**`.
- **`src/present/spec.ts` (T-021-02)** — the `PresentationSpec` (seven knobs) + `validateSpec`.
  Knob value-sets: `GROUPINGS = epic|story|status|role|leverage`, `METAPHORS = tree|board|timeline`,
  `DENSITIES = low|medium|full`, `COLOR_LANGUAGES = leverage|status|role`. `DESIGNER_PRESET` /
  `DEV_PRESET` exported. **Note:** `DENSITIES` has no `brief` value — the mock's "density: brief" is a
  *render mode*, not a spec value (constraint below).
- **`src/present/translate.ts` (T-021-04)** — `projectNode(node, spec, overlay) → Card` (face +
  details). Exports the helpers the renderer reuses: `scrubFace` (jargon stripper — every face string
  passes through it), `humanizeTitle` (kebab → sentence, scrubbed), `stateKey(node) →
  open|in_progress|done`, `stateChip(node, spec)` (the spec's display label), `structuralBreakdown`.
  Also `PlainOverlay` (authored `plainTitle/why/breakdown` — **routed, never invented**, the
  honest-empty discipline) and `Card`/`FaceContent`/`DetailContent` types.
- **`src/present/project.ts` (T-021-05)** — `projectGraph(graph, spec, overlays?) → Projection`. The
  immediate input to this ticket. `Projection` = `{ groupBy, density, colorLanguage, metaphor,
  groups: ProjectionGroup[], links: ProjectionLink[] }`. `ProjectionGroup` = `{ key, label, cards:
  ProjectedCard[] }`. `ProjectedCard` = `{ card: Card, color: string }` (a SEMANTIC token, not hex).
  `ProjectionLink` = `{ from, to, kind: "depends_on" }`. Deeply frozen; pure; graph untouched.

**Key gap the projection leaves for the tree:** the projection is **flat** — tickets grouped along
one axis; epics/stories survive only as group *labels*, not as a hierarchy. A faithful
*decomposition tree* (root → epic → story → ticket) needs the containment hierarchy, which lives in
the **graph** (object refs), not the flat projection. So the tree renderer needs both `graph`
(structure) and `projection` (per-ticket faces/colors). The faces and the brief, by contrast, are
fully projection-driven.

## House patterns the renderer must follow

- **Purity (cf. spec.ts / translate.ts / project.ts headers):** no fs/clock/network/addon. Graph and
  spec/projection imports are type-only where possible; value imports (`scrubFace`, `humanizeTitle`,
  `stateKey`) are all pure. The render functions are pure string builders → ordinary pure-function
  tests over a fabricated frozen graph (the `project.test.ts` / `model.test.ts` mould).
- **Honest-empty / IA-4 (translate.ts D1, survey-core.ts):** never invent. An absent overlay field is
  *omitted*, not manufactured. For this ticket: an empty branch (an epic with no stories, a story with
  no tickets, or a wholly empty board) renders a literal **"nothing here"** placeholder, never a
  fabricated node. Authored brief prose (Direction, the decision) is *routed* from an optional input
  and omitted when absent.
- **One-way authority (E-021 invariant):** the renderer READS graph+projection, never writes. No fs.
- **Composition, not reinvention:** reuse `scrubFace`/`humanizeTitle`/`stateKey` from translate.ts and
  `projectGraph` from project.ts. The renderer adds only what those don't: Mermaid emission, the
  blockquote face layout, the brief table + state rollup.
- **Readonly/frozen idiom; deterministic sorts** (no clock/random) → P5 byte-identical output.

## Constraints & assumptions

- **`brief` is a render mode, not a density.** The founder brief is a distinct render function, not a
  `density:'brief'` projection. The brief is naturally built from an **epic-grouped, status-colored**
  projection so per-epic state rolls up from `card.color`.
- **The tree colors by STATE**, matching the mock (`color_language: state`), independent of the
  card-level `colorLanguage` knob — a decomposition tree's universal reading is "where does it stand."
  Container nodes (epic/story) get their state via translate's `stateKey(node)`; this is uniform.
- **Mermaid label safety:** node ids must be alnum/underscore (`T-021-06 → T_021_06`); label text must
  escape `"`/`[`/`]`/newlines. A pure escaping helper is needed.
- **Live board reality:** `loadWorkGraph()` reads `docs/active/{epic,stories,tickets}`. The board has
  ~20 epics, many stories/tickets; stories can have zero tickets and epics zero stories (referential
  integrity does not forbid empty containers) — so empty branches are *real* and the IA-4 path is
  exercised by the live board, not just a fixture.
- **`vend present` CLI surface** (a `present` command in `cli.ts`) is a plausible follow-on but is
  **not** named by the AC ("running the renderer"); the AC is satisfied by an exported render entry +
  a test that runs it on the live graph. CLI wiring is a deferral candidate.
- Baseline before work: `bun run check` green — **685 tests, 0 fail** across 45 files.
