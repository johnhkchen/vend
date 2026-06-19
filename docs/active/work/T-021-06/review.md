# T-021-06 — Review: paper-renderer-tree-and-brief

Self-assessment / handoff. What changed, test coverage, open concerns. All six RDSPI phases ran.
**Status: complete** — committed `7483da0`, full gate green (713 pass / 0 fail).

## What this ticket delivered

The fourth and final leg of E-021's data/presentation split: a **pure renderer** that turns a
`Projection` (T-021-05) into the MCP-independent **paper artifact** — the designer decomposition tree
(Mermaid, state-colored) + plain card faces, and the collapsed founder/director brief. This is the
**render contract** a Linear renderer later executes against the same `Projection` IR. Story
S-021-03 is now complete (T-021-05 projection → T-021-06 render); T-021-07 is the remaining sibling.

## Files

| File | Action | Notes |
|---|---|---|
| `src/present/paper.ts` | **created** (~300 lines) | The pure renderer: tree + faces + brief + composer. |
| `src/present/paper.test.ts` | **created** (~200 lines) | 28 tests over fabricated frozen graphs + live-board AC. |
| `docs/active/work/T-021-06/*.md` | **created** | The six RDSPI artifacts. |

No upstream module was edited — the renderer is a pure *consumer* of `model.ts` / `spec.ts` /
`translate.ts` / `project.ts`. No CLI change (deferred — see Open concerns).

## Public surface

`renderTree(graph, projection)`, `renderFaces(projection)`, `renderDesignerView(graph, projection)`,
`renderFounderBrief(projection, narrative?)`, `renderPaper(graph, spec, opts?)`, plus the
`BriefNarrative` / `RenderOptions` types and three exported helpers (`sanitizeId`, `mmLabel`,
`rollUpState`). `renderPaper` is the one high-level entry: header + designer view (under the active
spec) + founder brief (under a derived epic-grouped, status-colored `founderSpec`).

## AC verification

> *Running the renderer on the live board reproduces a designer-preset tree + faces and a founder
> brief matching linear-surface-mock.md in shape; an honest-empty branch renders 'nothing here'
> (IA-4) rather than fabricated nodes.*

- **Live-board render** — the AC test loads the real graph via `loadWorkGraph()` and asserts
  `renderPaper(graph, DESIGNER_PRESET)` contains a Mermaid block, both section headings, and ≥1 state
  chip. Eyeballed: faithful to the mock in shape — preset header blockquote, `graph TD` with
  classDefs/root/colored nodes/emoji, card faces, and the `| Theme | State |` founder table with a
  routed decision line. ✅
- **Honest-empty (IA-4)** — `sparseGraph` (empty epic + empty story) → exactly two `nothing here`
  leaves, no fabricated node; `emptyGraph` → one under root; faces/brief → `nothing here`. ✅
- **In shape, not byte-identical** — by design: the mock's authored prose (epic plain-titles, Why
  text, the decision sentence) is human-authored and not derivable. The renderer **routes** authored
  prose (`overlays`, `narrative`) and **omits** what isn't supplied (honest-empty), degrading epic
  labels to the humanized canonical title rather than inventing the mock's editorial titles. ✅

## Test coverage

28 new tests, 713 total / 0 fail across 48 files. Coverage by surface:

- **Pure helpers** — `sanitizeId`, `mmLabel` (escapes `"`/`[`/`]`/newlines), `rollUpState` (the three
  rollup branches).
- **Tree** — fenced `graph TD` + classDefs + root; every ticket present as a sanitized node; the IA-4
  empty-branch path (exact `nothing here` count); empty-board path; determinism (same inputs →
  identical string, P5).
- **Faces** — authored `why` surfaces, an un-authored card omits it; no jargon leaks onto a face line
  (a charter-code/file-cite fixture body stays in details); empty projection → `nothing here`.
- **Brief** — one row per epic theme; rolled-up state (any in-progress → In progress); `decision`
  routed when given, omitted when absent; empty projection → `nothing here`.
- **Composer** — full artifact contains tree + faces + founder table; determinism.
- **AC (live board)** — render + graph-reference-unchanged + frozen (one-way authority).

**Gaps (acknowledged, low-risk):** (1) no test asserts the *exact* full live-board string — deliberate,
that string tracks ~20 live epics and would be brittle; structural invariants are asserted instead,
exact strings only against fixtures. (2) The thin impure verbs (`presetHeader`/`founderSpec`) are
covered only transitively through `renderPaper` — acceptable, they hold no branching judgment (the
house "thin shell untested" precedent, cf. load.ts/presets.ts fs verbs).

## Open concerns / follow-ups

- **No `vend present` CLI** — deferred per design D1/D7. The AC is met by the exported entry + the
  live-board test, but a human can't yet *run* the renderer from a shell. A follow-on ticket should
  add a `present [--seat <s>] [--out <path>]` dispatch arm to `cli.ts` (lazy-import, like the other
  arms) writing the artifact to a file. Likely T-021-07's or a new ticket's scope.
- **Authored brief/face prose has no producer yet** — `narrative` and richer `overlays` are routed but
  nothing populates them; today the live render degrades to humanized titles and omits Why/decision.
  Wiring `steer`/`survey` output (or a saved authoring file) into `RenderOptions` would close the gap
  to full mock fidelity. Not this ticket's scope; honest-empty makes the omission safe meanwhile.
- **Tree colors by state, not `colorLanguage`** (design D3) — intentional and documented, but worth a
  human eye: if a future seat wants a leverage-colored tree, that's a knob to add, not a bug.

## Critical issues needing human attention

**None.** No regressions (713/0), pure module, no fs/write path (one-way authority intact). The one
notable implementation hazard — naming a function `declare` (a TS keyword Bun silently strips) — was
caught and fixed (`declareNode`); see progress.md D1. Worth a project-wide note: reserved-word
function names fail *silently* under Bun's transpiler, not as a compile error.
