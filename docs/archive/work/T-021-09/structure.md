# T-021-09 — Structure: rubric-scorecard-probe

The blueprint — file-level changes, module shapes, public interfaces, ordering. Not code.

## Files

| File | Action | Purpose |
|---|---|---|
| `src/probe/rubric.ts` | **create** | PURE scoring core — the rubric verdict over a designer render. The only unit-tested half. |
| `src/probe/rubric.test.ts` | **create** | Pure-function tests over `buildGraph` fixtures, incl. the AC's mechanical-language teeth. |
| `src/probe/run-rubric-probe.ts` | **create** | IMPURE CLI harness — load live board, render designer preset, score, print. NOT unit-tested. |

No edits to existing files. The probe composes the landed E-021 surface (translate/project/
paper/load) and the spec preset; nothing upstream changes (one-way authority, additive only).

## `src/probe/rubric.ts` (pure core)

Header comment in the consistency.ts/paper.ts house voice: what it is (the 'good enough'
rubric scorecard core, T-021-09 / S-021-04 / E-021), PURITY note (no fs/clock/network; imports
only pure modules — `faceJargon`/`faceText` from translate.ts, the `Projection`/`Card` types),
the reuse-not-reinvent note (language gate IS `faceJargon`), and IA-4/IA-8 discipline.

Imports (type-only where erasable):
- `type { Projection, ProjectedCard } from "../present/project.ts"`
- `type { Card } from "../present/translate.ts"`
- `{ faceJargon, faceText } from "../present/translate.ts"` (value, pure)

### Closed-set vocabulary (D6)
```
export const RUBRIC_DIMENSIONS =
  ["comprehension","structure","density","language","navigability"] as const;
export type RubricDimension = (typeof RUBRIC_DIMENSIONS)[number];
```

### Output types
```
export interface DimensionScore {
  readonly dimension: RubricDimension;
  readonly score: number;        // 0..1, never NaN
  readonly pass: boolean;
  readonly detail: string;       // one human phrase
  readonly failures: readonly string[]; // evidence (card ids / reasons), IA-8
}
export interface Scorecard {
  readonly dimensions: readonly DimensionScore[]; // always all five, in RUBRIC_DIMENSIONS order
  readonly pass: boolean;        // good enough = every dimension passed
}
```

### Per-density face-volume budget (D4)
```
const DENSITY_CHAR_BUDGET: Readonly<Record<string, number>> =
  { low: 240, medium: 480, full: Number.POSITIVE_INFINITY };
```

### Pure leaf helpers (private)
- `allCards(projection): ProjectedCard[]` — flatten `groups.flatMap(g => g.cards)`.
- `ratio(clean, total): number` — `total === 0 ? 1 : clean / total` (vacuous pass = 1, never
  NaN — the consistency.ts zero-safety discipline).
- helpers build each `DimensionScore` (one private fn per dimension, named
  `scoreLanguage` / `scoreComprehension` / `scoreDensity` / `scoreStructure` /
  `scoreNavigability`), each taking the inputs it needs.

### Per-dimension functions
- `scoreLanguage(cards): DimensionScore` — for each card, `faceJargon(card.card)`; a card is
  dirty if non-empty. `failures = ["<id>: <tok>, <tok>"]`; `score = clean/total`;
  `pass = failures.length === 0`. **The AC gate.**
- `scoreComprehension(cards): DimensionScore` — a card passes iff
  `card.card.face.plainTitle` is non-empty AND `card.card.face.state` is non-empty.
  `failures` names the missing field per card.
- `scoreDensity(projection, cards): DimensionScore` — budget = `DENSITY_CHAR_BUDGET[
  projection.density] ?? Infinity`; a card passes iff `faceText(card.card).length <= budget`.
  `failures = ["<id>: <n> chars"]`.
- `scoreStructure(render, projection): DimensionScore` — `treeOk = render.includes("```mermaid")
  && render.includes("graph TD")`; `labelsOk = groups.every(g => g.label.trim().length > 0)`;
  `pass = treeOk && labelsOk`; `score` = 1 if pass else fraction of labelled groups; `failures`
  notes a missing tree and/or unlabelled group keys.
- `scoreNavigability(render, projection): DimensionScore` — `headingsOk =` render contains all
  three of `"Designer view"`, `"Card faces"`, `"Founder/director view"`; `danglers =` links
  whose `from`/`to` is not a projected card id; `pass = headingsOk && danglers.length === 0`;
  `failures` lists missing headings + dangling `from→to`.

### Public entry + formatter
```
export function scoreDesignerRubric(render: string, projection: Projection): Scorecard
export function formatScorecard(card: Scorecard): string
```
- `scoreDesignerRubric` flattens cards once, calls the five scorers in `RUBRIC_DIMENSIONS`
  order, assembles `{ dimensions, pass: dimensions.every(d => d.pass) }`.
- `formatScorecard` → headline `rubric — good enough: yes|no` then one line per dimension:
  `  ✓ language — 0 of 12 faces carry jargon` / `  ✗ language — 2 faces carry jargon: …`.
  Pure string join, mirrors `formatConsistencyReport`.

## `src/probe/run-rubric-probe.ts` (impure harness)

Header in the run-consistency-probe.ts voice: usage line
`bun run src/probe/run-rubric-probe.ts [root]`, the NOT-unit-tested house-rule note, the
read-only + one-way-authority note (imports `loadWorkGraph` only; `docs/active` appears in the
comment, never executable code → authority-guard stays green).

Imports: `{ loadWorkGraph } from "../graph/load.ts"`, `{ DESIGNER_PRESET } from
"../present/spec.ts"`, `{ projectGraph } from "../present/project.ts"`, `{ renderPaper } from
"../present/paper.ts"`, `{ scoreDesignerRubric, formatScorecard } from "./rubric.ts"`.

`async function main(root?: string)`:
1. `const graph = await loadWorkGraph(root ? { root } : undefined)`.
2. `const projection = projectGraph(graph, DESIGNER_PRESET)`.
3. `const render = renderPaper(graph, DESIGNER_PRESET)`.
4. `const card = scoreDesignerRubric(render, projection)`.
5. `process.stdout.write(...)` header (board size) + `formatScorecard(card)`.

`if (import.meta.main) { const root = Bun.argv[2]; await main(root); process.exit(0); }`.

## `src/probe/rubric.test.ts` (pure tests)

Imports `buildGraph`/`RawNode`/`WorkGraph` (model.ts), `DESIGNER_PRESET` (spec.ts),
`projectGraph` (project.ts), `renderPaper` (paper.ts), and the rubric surface. Reuses the
`paper.test.ts` fixture builders (`epic`/`story`/`ticket`/`miniGraph`/`emptyGraph`).

Test cases:
1. `scoreDesignerRubric` over `miniGraph` under `DESIGNER_PRESET` → `pass === true`, all five
   dimensions present in order, language clean.
2. **AC teeth:** a hand-built `Projection` with a card whose `face.plainTitle` carries a jargon
   token (e.g. `"Ship PE-1 thing"` / `"survey-core.ts"`, bypassing scrub by constructing the
   `Card` directly) → `language.pass === false`, the token in `failures`, and overall
   `pass === false`.
3. comprehension: a card missing `state` (or `plainTitle`) → `comprehension.pass === false`.
4. density: a card whose `faceText` exceeds the low budget → `density.pass === false`; a terse
   one → pass.
5. structure: a render string missing the mermaid fence → `structure.pass === false`.
6. navigability: a projection with a dangling link / a render missing a heading →
   `navigability.pass === false`.
7. IA-4 vacuous pass: `emptyGraph` render+projection → every dimension `pass === true` (no
   cards/links/groups), overall `pass === true`, scores are 1 (never NaN).
8. determinism (P5): same inputs → identical `formatScorecard` output.

## Ordering

1. `rubric.ts` (pure core) — nothing depends on the harness.
2. `rubric.test.ts` — green the core.
3. `run-rubric-probe.ts` — composes the green core + landed surface; smoke-run on the live
   board.

## Risk register

- **Density budget mis-tuned** → flags the legitimate live designer render. Mitigation: derive
  the budget from the live faces during implement; 240 chars is a starting point, widen if the
  live board's terse faces exceed it (a low-density face is a title + short why + state).
- **Authority-guard false-positive** if `docs/active` slips into executable code. Mitigation:
  keep it in comments only; harness imports `loadWorkGraph`, no fs writer (verify by re-running
  `bun test src/present/authority-guard.test.ts`).
- **Heading strings drift** from paper.ts. Mitigation: match on the stable substrings the
  paper.test.ts AC already asserts (`Designer view`, `Card faces`, `Founder/director view`).
