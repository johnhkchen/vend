# T-021-06 — Progress: paper-renderer-tree-and-brief

Implementation log against `plan.md`. Status: **complete** — `src/present/paper.ts` +
`paper.test.ts` landed, full gate green (713 pass / 0 fail), one atomic commit.

## Steps executed

- **Step 0 — Baseline.** `bun run check` → 685 pass / 0 fail (recorded in research.md).
- **Step 1 — Test scaffold + AC contract (eval-first).** Wrote `src/present/paper.test.ts` first:
  `miniGraph` (2 epics → 3 stories → 5 tickets, cross-story dep, mixed states), `sparseGraph` (an
  epic with no stories + a story with no tickets — the IA-4 branch), `emptyGraph`. The live-board AC
  test (`loadWorkGraph` → `renderPaper`) pinned the contract before the module existed.
- **Step 2 — Helpers + state tables.** `paper.ts`: house header, `BriefNarrative`/`RenderOptions`,
  `STATE_EMOJI`/`STATE_CLASS`/`LABEL_EMOJI`/`NOTHING`, and the leaf helpers `sanitizeId`/`mmLabel`/
  `stateEmoji`/`stateClass`/`labelEmoji`/`detailsSummary`/`cardIndex`/`rollUpState`. Exported
  `sanitizeId`/`mmLabel`/`rollUpState` for the unit tests.
- **Step 3 — The tree.** `walkContainer` (recursive epic→story→ticket over the graph's object refs;
  empty child list → one `nothing here` leaf), `renderTree(graph, projection)` (fenced `graph TD` +
  classDefs + root + per-epic walk; no epics → one `nothing here` under root). Colored/chipped by
  `stateKey` (design D3).
- **Step 4 — Faces + designer view.** `faceBlock` (each line omitted when its field is absent),
  `renderFaces` (`*nothing here*` when no cards), `renderDesignerView` (tree + `### Card faces`).
- **Step 5 — Founder brief.** `briefRow` + `renderFounderBrief` (Direction paragraph + `| Theme |
  State |` table with rolled-up state + the routed decision line; all narrative routed, omitted when
  absent — honest-empty).
- **Step 6 — Composer.** `presetHeader`, `founderSpec` (epic-grouped, status-colored, low-density),
  `renderPaper(graph, spec, opts?)` — header + designer view (under `spec`) + founder brief (under
  `founderSpec`), `---`-joined in mock order. This closed the live-board AC test.
- **Step 7 — Gate + commit.** `bun run check` → 713 pass / 0 fail. One atomic commit.

## Deviation D1 — `declare` → `declareNode` (a TypeScript-keyword landmine)

The tree's node-emitter was first named `declare`. **`declare` is a TypeScript keyword** (ambient
declarations), so Bun's transpiler **silently stripped every `declare("…")` call statement** as if it
were an ambient declaration — the function body never ran, and the rendered tree came out with edges
but **zero node declarations**. Diagnosed by isolating the helper (the call wasn't even logging),
recognized the keyword collision, and renamed to `declareNode`. No other landmine; renamed all five
sites. Lesson worth keeping: avoid TS reserved words (`declare`, `type`, `namespace`, `module`) as
plain function/var names — the failure is silent, not a compile error.

## Deviation D2 — live-board state values beyond {open, in_progress, done}

On the live board several epics carry statuses outside the three mapped state keys (the model.ts
faithful-mirror rule keeps raw strings). These **degrade honestly**: an unmapped key → no emoji +
the `default` class (a neutral grey node), never a wrong/fabricated chip. This is the intended
honest-empty behavior, not a defect — the tree still reads, and ticket-level states (where the chips
matter most) map cleanly. The founder brief rolls up from ticket `card.color` (status-colored), so
its rows show correct ✅/🔄/⬜. No change needed.

## No other deviations

The public surface matches `structure.md` exactly. No upstream module was edited (the renderer is a
pure consumer). No CLI wiring added — deferred per design D1/D7 (the AC is met by the exported entry
+ the live-board test; a `vend present` command is a clean follow-on).

## Verification

- `bun run check`: **713 pass / 0 fail** (685 baseline + 28 new) across 48 files.
- Honest-empty (IA-4): `sparseGraph` → exactly two `nothing here` leaves (no fabricated node);
  `emptyGraph` → one under root; faces/brief → `nothing here`. All asserted.
- Determinism (P5): tree and whole paper assert same-inputs → identical string.
- One-way authority: AC test asserts `graph.tickets` reference-unchanged and graph frozen after render.
- Eyeballed the live render: faithful to `linear-surface-mock.md` in shape (header, colored tree with
  emoji chips, faces, founder table + routed decision).
