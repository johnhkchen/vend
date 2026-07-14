# Progress — T-077-02-03 advances-cite-degrades

## Status

Implementation is behavior-complete and committed in two atomic Lisa commits. The full repository
gate and post-commit focused acceptance tests are green.

Concurrent sibling `T-077-02-02` work temporarily made the full gate red during implementation. Its
in-progress type errors and stale bare-code expectation were resolved by that worker; this ticket did
not edit, stage, or commit any sibling-owned path.

## Completed phase work

- Read the assignment, AGENTS instructions, RDSPI workflow, vision, story, ticket, charter, and
  stack record.
- Mapped shared classifier/snapshot contracts, the normalize → gate/effect flow, and gate ordering.
- Wrote `research.md` in the private attempt directory.
- Evaluated five approaches and selected explicit parse-context flow.
- Wrote `design.md`, `structure.md`, and `plan.md` in the private attempt directory.
- Kept all artifacts out of the shared docs path; Lisa published detected copies itself.

## Unit 1 — parse context seam

Completed and committed.

### Source changes

- `src/engine/play.ts`
  - `Play.parse` now accepts `CastContext<I>` as its second argument.
  - Documentation names deterministic input-aware normalization as the purpose.
- `src/engine/cast.ts`
  - passes the already-assembled context to `play.parse`.
  - preserves budget/parse/gate/effect ordering.
- `src/engine/cast.test.ts`
  - the existing token-free echo cast captures parse contexts;
  - asserts the typed input and project root;
  - retains the end-to-end parse → gate → effect → log proof.

### Verification

```text
bun test src/engine/cast.test.ts
22 pass, 0 fail, 239 assertions
```

The first full `bun run check` completed codegen, typecheck, and the suite successfully before the
unit commit.

`git diff --check` was clean for all three paths.

### Commit

```text
cf2a7a6 refactor(engine): expose cast context to parse
```

Committed with `lisa commit-ticket` and exact includes:

- `src/engine/play.ts`
- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

No ordinary-index command was used.

## Unit 2 — charter-aware advances normalization

Completed and committed.

### Pure core

- `src/play/decompose-epic-core.ts`
  - imports pure `snapshotCharterCodes` and `classifyCharterCite`;
  - extends `stripNonGoalAdvances(plan, charter?)`;
  - preserves N-only behavior when charter is absent;
  - snapshots a supplied charter once;
  - strips N-codes even when their non-goal definitions resolve;
  - strips other well-shaped snapshot misses through the shared classifier;
  - retains resolvable codes;
  - retains structural/free-text inputs for existing gates;
  - applies action `strip` at `<ticket>.advances[index]` locations;
  - reuses clean ticket objects and never mutates input.

### Production wiring

- `src/play/decompose-epic.ts`
  - parse receives the new context;
  - passes `ctx.inputs.charter` into normalization;
  - returns the one normalized `WorkPlan` consumed by both gates and effect.

### Gate boundary

- `src/gate/gates.ts`
  - only explanatory bounds comments changed;
  - executable bounds behavior remains unchanged.
- `src/gate/gates.test.ts`
  - mixed known/dangling normalize → clear fixture passes;
  - dangling-only normalize → clear fixture stops at value;
  - direct unnormalized dangling fixture still stops at bounds.

### Core test coverage

- existing N-only mixed and empty behavior retained;
- existing no-charter compatibility retained;
- known P code retained;
- dangling P code stripped;
- dangling-only becomes empty;
- known/unknown custom K codes distinguished from charter definitions;
- free-text and blank structural values retained;
- clean object identity retained;
- changed input remains unmutated.

### Focused verification

```text
bun test src/play/decompose-epic.test.ts src/gate/gates.test.ts
67 pass, 0 fail, 131 assertions
```

`git diff --check` is clean for all five feature paths.

## Full-gate observation

The feature-unit `bun run check` reached typecheck and reported only sibling-owned errors:

```text
src/play/materialize.ts(343,5): Expected 3 arguments, but got 2.
src/play/materialize.ts(349,14): Expected 3 arguments, but got 2.
src/play/materialize.ts(418,53): Expected 3 arguments, but got 2.
src/play/materialize.ts(421,62): Expected 3 arguments, but got 2.
src/play/materialize.ts(423,67): Expected 3 arguments, but got 2.
src/play/materialize.ts(517,3): Property 'degrades' is missing ...
```

These lines were part of active `T-077-02-02`. The sibling completed its type updates and replaced
the stale cast fixture with the new degradation expectation. This ticket reran the complete gate
without modifying, staging, or including sibling work.

Final full-gate result:

```text
bun run check
BAML codegen: pass
tsc --noEmit: pass
bun test: 1780 pass, 1 skip, 0 fail, 5609 assertions
```

The one skip is the repository's existing optional release-acceptance fixture when local `dist/`
artifacts are absent; the alternate real-dist acceptance case passed in the same run.

## Unit 2 commit

```text
26e9c6b fix(play): degrade dangling advances cites
```

Committed with `lisa commit-ticket` and exact includes:

- `src/play/decompose-epic-core.ts`
- `src/play/decompose-epic.test.ts`
- `src/play/decompose-epic.ts`
- `src/gate/gates.ts`
- `src/gate/gates.test.ts`

No sibling path, generated client, ticket frontmatter, provenance record, or active-work artifact was
included.

## Post-commit verification

```text
bun test src/play/decompose-epic.test.ts src/gate/gates.test.ts
67 pass, 0 fail, 131 assertions
```

`git diff --check` is clean over all eight ticket-owned source paths. Those eight paths are absent
from `git status`; remaining modified/untracked paths belong to Lisa or active sibling work.

Commit history contains both ticket units in order:

```text
26e9c6b fix(play): degrade dangling advances cites
cf2a7a6 refactor(engine): expose cast context to parse
```

## Plan adherence

- Unit boundaries match the plan.
- The context seam required no mechanical rewrites to existing one-argument parse callbacks.
- The normalizer uses one decision array per ticket, avoiding duplicate classification.
- No generated BAML diff was introduced.
- No structural rule was weakened.
- No durable disposition metadata was added; `T-077-02-04` still owns it.
- No scope deviation so far.

## Remaining

1. Write the review handoff.
2. Write the exact pass disposition.
3. Remain on this ticket and stop for Lisa completion handling.
