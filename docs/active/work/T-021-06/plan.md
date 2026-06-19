# T-021-06 — Plan: paper-renderer-tree-and-brief

Ordered, independently-verifiable steps. Testing strategy: one pure test file
(`paper.test.ts`) over a fabricated frozen graph + a live-board AC test, the `project.test.ts`
mould. Whole ticket is one cohesive module → **one atomic commit** after `bun run check` is green.
Per house practice (and the recent T-021-05 / eval-first commits), the **AC-contract test is
written first**, then the implementation makes it pass.

## Step 0 — Baseline (done in Research)

`bun run check` → 685 pass / 0 fail. Recorded. Any regression at the end is mine.

## Step 1 — Test scaffold + the AC contract test (write first)

Create `src/present/paper.test.ts`. Build the fixtures via `buildGraph` (a genuine frozen graph, not
a cast):
- `miniGraph()` — 2 epics → 3 stories → 5 tickets, one cross-story dep, mixed states (clone the
  `project.test.ts` fixture so the two suites share a mental model).
- `sparseGraph()` — an epic with **no stories**, and a story with **no tickets** — the IA-4 branch.
- `emptyGraph()` — `buildGraph([], [], [])` — the empty-board scope.

Write the **live-board AC test** up front (it will fail to compile until Step 2 exists, which is
fine — it pins the contract): `loadWorkGraph()` → `renderPaper(graph, DESIGNER_PRESET)` contains a
` ```mermaid ` block, both section headings, ≥1 state emoji; graph reference-unchanged; an
`emptyGraph()` render contains `nothing here`.

**Verify:** file parses; tests red (expected — module absent).

## Step 2 — `paper.ts`: header, imports, state tables, pure helpers

Create `src/present/paper.ts` with the house header comment. Add imports (Structure §1), the
`BriefNarrative` / `RenderOptions` types, the `STATE_EMOJI` / `STATE_CLASS` / `LABEL_EMOJI` /
`NOTHING` constants, and the leaf helpers: `sanitizeId`, `mmLabel`, `stateEmoji`, `stateClass`,
`labelEmoji`, `detailsSummary`, `cardIndex`, `rollUpState`. Export `sanitizeId`, `mmLabel`,
`rollUpState` (test targets).

**Verify:** `tsc --noEmit` clean; add unit asserts for `sanitizeId("T-021-06") === "T_021_06"`,
`mmLabel('a "b" [c]')` escapes, `rollUpState` on a hand-built group. Green for these.

## Step 3 — The tree (`renderTree`)

Implement `treeNodeLine`, `walkContainer` (recursive, with the empty-branch → `NOTHING` leaf), and
`renderTree(graph, projection)` assembling the fenced `graph TD` + classDef + root + per-epic walk
(or a single `NOTHING` child when no epics). Ticket labels from `cardIndex`; emoji/class from
`stateKey`.

**Verify (Step 1's tree block):** root + classDef present; every `miniGraph` ticket id appears as a
sanitized node; `sparseGraph` emits exactly one `nothing here` under the empty epic and one under the
empty story, with **no fabricated node**; same inputs → identical string (determinism / P5).

## Step 4 — Faces + designer view (`renderFaces`, `renderDesignerView`)

Implement `faceBlock` (each line omitted when its field is absent) and `renderFaces` (section heading
+ ordered cards, or `*nothing here*` when none). Then `renderDesignerView` = tree + `### Card faces`
+ faces.

**Verify (faces block):** an authored `why` overlay surfaces `*Why:*`; a card without one omits it
(honest-empty); `detailsSummary` appears only when `card.details` is non-empty; no jargon leaks onto
a face line (spot-check with a charter-code-bearing fixture body — it must stay in details, never the
face).

## Step 5 — Founder brief (`renderFounderBrief`)

Implement `briefRow` and `renderFounderBrief(projection, narrative?)`: heading, optional Direction
paragraph, the `| Theme | State |` table (or `*nothing here*`), optional decision line — narrative
lines omitted when absent.

**Verify (brief block):** one row per epic theme; all-done epic → `Done`, any-in-progress → `In
progress` (rollup); `narrative.decision` present → the line appears, absent → omitted; empty
projection → `nothing here`.

## Step 6 — The composer (`renderPaper`) + close the AC test

Implement `presetHeader`, `founderSpec`, and `renderPaper(graph, spec, opts?)` — header + designer
view (under `spec`) + founder brief (under `founderSpec(spec)`), `---`-joined in mock order. This
makes Step 1's live-board AC test compile and pass.

**Verify:** the full `bun run check` → all green, **including** the live-board AC test (Mermaid
block + both headings + ≥1 emoji; empty-board → `nothing here`; graph reference-unchanged).

## Step 7 — Full gate + commit

`bun run check` (baml:gen → tsc → bun test) must be **685 + new tests, 0 fail**. Then **one atomic
commit**: `feat(present): paper renderer — Mermaid tree + faces + founder brief (T-021-06)`, staging
`src/present/paper.ts` + `src/present/paper.test.ts` + the work artifacts. (The on-stop
done-means-committed gate, D-005, requires a clean tree.)

## Testing strategy summary

- **Unit (pure, no fs):** `sanitizeId`, `mmLabel`, `rollUpState`, tree/faces/brief over the
  fabricated frozen graphs — the bulk of coverage, fast and deterministic.
- **Honest-empty (IA-4):** `sparseGraph` (empty branch) + `emptyGraph` (empty board) → `nothing
  here`, asserted at tree/faces/brief and the composer.
- **Integration (one test, real fs):** `loadWorkGraph()` → `renderPaper` — the AC's "running the
  renderer on the live board," plus graph-reference-unchanged (one-way authority).
- **Determinism (P5):** same inputs → identical string, asserted on the tree and the whole paper.

## Risks & mitigations

- **Live-board volatility** — asserting exact strings against ~20 live epics is brittle. *Mitigation:*
  the AC test asserts *structural* invariants (a Mermaid block exists, headings exist, ≥1 emoji, the
  empty-board placeholder), never the full live string. Exact-string/determinism asserts run against
  the **fixed fixture** graphs only.
- **Mermaid syntax breakage from label content** — unescaped `"`/`[`/`]` corrupts the diagram.
  *Mitigation:* every label routes through `mmLabel`; a fixture title carrying those chars asserts the
  escape.
- **`density:'brief'` temptation** — none: the brief is a render mode (D1/D7), `founderSpec` uses a
  valid `density:'low'`. No spec.ts change, so no risk of an out-of-set knob.
- **Inventing brief prose** — guarded by D7: Direction/decision are *routed* from `narrative`, omitted
  when absent; a test asserts the omission (honest-empty).
