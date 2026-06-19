# T-021-05 — Plan: pure-graph-spec-to-projection

_Ordered, independently-verifiable steps + testing strategy. Each commits atomically._

## Testing strategy

- **Unit (pure, no fs)** — the bulk. A hand-built frozen `WorkGraph` via `buildGraph` (the
  `model.test.ts`/`load.test.ts` fixture idiom) drives grouping (one test per axis), color, links,
  and freeze/purity. Pure-function tests over plain records — the spec.test.ts/translate.test.ts
  mould.
- **AC / live-graph (one impure boundary)** — `loadWorkGraph()` reads the real `docs/active` board
  (the `load.test.ts` live-board smoke precedent); the projection logic under test stays pure. This
  is the AC's literal "render the live graph under two specs differing only in `group_by`."
- **Verification gate** — `bun run check` (baml:gen → tsc → bun test). Baseline is **672 pass**;
  the change only adds tests, so green-after = baseline + new, zero regressions.

## Steps

### Step 1 — Promote `stateKey` to `export` in `translate.ts`

The one reuse-seam change (structure §the one-line change). `function stateKey` →
`export function stateKey`. No behavior change.

- **Verify:** `tsc --noEmit` green; `translate.test.ts` still passes unchanged.
- **Commit:** `refactor(present): export stateKey for projection reuse (T-021-05)`.

### Step 2 — `project.ts`: types + ordinal maps + resolvers

Header comment, the four output types + `ProjectionOverlays`, `STATUS_ORDER`/`PRIORITY_ORDER`, and
the pure resolvers `groupKeyFor` / `groupLabelFor` / `groupOrdinal` / `colorFor` / `buildLinks`
(structure §4–6). No public entry yet — internal helpers compile against the imported types.

- **Verify:** `tsc --noEmit` green (helpers may be momentarily unused — acceptable mid-file; Step 3
  consumes them in the same commit).
- **Commit:** folded into Step 3 (the helpers have no value without the entry).

### Step 3 — `project.ts`: the `projectGraph` entry

The public `projectGraph(graph, spec, overlays?)` assembling the accumulate → materialize-groups →
links → `deepFreeze` pipeline (structure §7). Completes the module.

- **Verify:** `tsc --noEmit` green; module exports `projectGraph` + the types.
- **Commit:** `feat(present): pure graph+spec → projection (grouping, color, links) (T-021-05)`
  (Steps 2+3 together — one coherent module).

### Step 4 — `project.test.ts`: fixtures + unit tests

The mini-graph fixture (2 epics → 3 stories → 5 tickets, a cross-story `depends_on`, mixed
status/priority) via `buildGraph`. Then: per-axis grouping, color (status vs leverage), links
(single edge, no `blocks` double-emit), freeze/purity (graph `===` + frozen before/after).

- **Verify:** `bun test src/present/project.test.ts` green.
- **Commit:** `test(present): projectGraph grouping/color/links/purity (T-021-05)`.

### Step 5 — `project.test.ts`: the AC block (live graph)

`loadWorkGraph()` the live board; project under `groupBy: "epic"` vs `"story"` (DESIGNER_PRESET
base). Assert: (a) the two group structures differ; (b) `graph === graph` and `graph.tickets ===
graph.tickets` across both projections — **reference-unchanged**; (c) same spec twice → identical
projection (determinism). This is the AC, verbatim.

- **Verify:** `bun run check` fully green; test count = baseline + the new cases.
- **Commit:** folded into Step 4 (one test file, one logical addition) **or** a separate
  `test(present): T-021-05 AC — live-graph regroup, graph reference-unchanged` if the file is split
  cleanly. Prefer one commit for the file.

### Step 6 — `progress.md` + final `bun run check`

Record completion, deviations, the green gate. Then `review.md`.

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Live board has 0 tickets / 1 epic → "regroup differs" assertion is vacuous | low | Board is ticket-rich (E-013…E-021, many tickets — observed). If a single group, the AC test asserts the **weaker but still-true** property (groups differ OR identical structure with reference-unchanged); but expected path is genuinely different epic vs story partitions. Guard: assert `groups.length >= 1` and that epic-grouping key-set ≠ story-grouping key-set. |
| `stateKey` export breaks an unexpected importer | very low | It is currently private; no external importer exists (grep). Pure addition of a modifier. |
| `group_by: role` single-group looks like a bug | low | Documented (design D2) as honest-empty; test asserts the single `"all"` group **on purpose**. |
| Density/metaphor carried-but-unapplied flagged as incomplete | low | Documented v1 deferral (design D5), the T-021-04 `vocabulary` precedent; noted in review open-concerns. |
| Sort non-determinism on values outside the ordinal maps | low | Total order: ordinal-9 fallback + `localeCompare` secondary; covered by a mixed-status fixture. |

## Definition of done

- `projectGraph` pure, frozen output, graph untouched (AC reference-unchanged proven).
- Live-graph regroup test green; per-axis + color + links + purity unit tests green.
- `bun run check` green at baseline + new tests, zero regressions.
- `progress.md` + `review.md` written.
