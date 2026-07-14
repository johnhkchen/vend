# T-021-05 — Progress: pure-graph-spec-to-projection

_What's done, what remains, deviations from plan._

## Status: implementation complete, all gates green

`bun run check` → **685 pass, 0 fail** (baseline 672 + 13 new cases). Typecheck clean.

## Steps completed

- **Step 1 — `export stateKey`** (`src/present/translate.ts`). Single modifier added; the state
  group-key + color-key now share the one source with `stateChip`. No behavior change; existing
  `translate.test.ts` untouched and passing.
- **Steps 2+3 — `src/present/project.ts`** (the pure core). Output types (`ProjectedCard`,
  `ProjectionGroup`, `ProjectionLink`, `Projection`, `ProjectionOverlays`), ordinal maps
  (`STATUS_ORDER`/`PRIORITY_ORDER`), the pure resolvers (`groupKeyFor`, `groupLabelFor`,
  `groupOrdinal`, `colorFor`, `buildLinks`), and the public `projectGraph(graph, spec, overlays?)`
  — accumulate → materialize-groups (id-sorted cards, ordinal+key-sorted groups) → links →
  `deepFreeze`. Reuses `projectNode`/`deepFreeze`/`stateChip`/`stateKey`/`humanizeTitle`/`scrubFace`;
  pure (type-only graph+spec imports).
- **Steps 4+5 — `src/present/project.test.ts`**. A real frozen mini-graph via `buildGraph`
  (2 epics → 3 stories → 5 tickets, one cross-story `depends_on`, mixed status/priority). Covers:
  per-axis grouping (epic/story/status/leverage/role), color tokens (status vs leverage vs role),
  links (single edge, no `blocks` double-emit), overlays threading, freeze/determinism, and the
  **AC block** — live graph via `loadWorkGraph()`, regroup under epic vs story, graph
  reference-unchanged, re-projection identical.

## Deviations from plan

1. **Commit granularity** — Steps 1–5 are landed as a coherent set rather than five micro-commits;
   `stateKey`'s export has no value without its consumer, and the helpers have no value without the
   entry. The plan anticipated this folding (Step 2 "folded into Step 3"). Net: a refactor commit
   (`export stateKey`) + a feat commit (project.ts) + a test commit, matching the T-021-04 cadence.
2. **`groupLabelFor` signature** — took `(key, groupBy, graph, sample, spec)` rather than the
   plan's `(key, graph, spec)`: the `status` label is `stateChip(sample, spec)`, which needs a
   representative ticket of the group. Threaded the bucket's first ticket as `sample`. Pure, no
   behavior surprise; resolved once per distinct key as planned.
3. **Fixture-label assertion** — the mini-graph's synthetic story title `s-S-001-01` humanizes to
   `"S S 001 01"` (doubled S); the test asserts that exact value. A fixture artifact, not a
   `humanizeTitle` bug (real titles are kebab capability names, not id-prefixed).
4. **Freeze-mutation cast** — tsc rejected casting a `readonly` array to a mutable one directly; the
   test casts through `unknown` (`p.groups as unknown as unknown[]`) to exercise the frozen-push
   throw. Cosmetic.

## Remaining

Nothing for the AC. Documented v1 deferrals (not gaps — design D5): graduated `density` and
`metaphor` layout are carried onto the projection but not yet applied; epic/story nodes are group
headers, not their own cards. Carried into `review.md` as open concerns.
