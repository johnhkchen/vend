# Review — T-077-02-03 advances-cite-degrades

## Outcome

Pass. The ticket acceptance criterion is met.

A decompose plan whose ticket carries a well-shaped charter code absent from the current charter
snapshot is now normalized before both gates and effect consume it. The dangling code is stripped as
an editorial degradation instead of whole-stopping the cast at bounds. If stripping leaves no actual
`advances` value, the existing value gate still refuses the ticket.

The bounds gate itself remains intact as defense in depth for direct callers that bypass production
normalization. Structural/value invalidity was not weakened.

## Commits

```text
cf2a7a6 refactor(engine): expose cast context to parse
26e9c6b fix(play): degrade dangling advances cites
```

Both commits were created with `lisa commit-ticket`, exact include paths, and no ordinary-index
staging or direct Git commit.

## Change summary

### `src/engine/play.ts`

`Play.parse` now receives the typed `CastContext<I>`:

```ts
readonly parse: (text: string, ctx: CastContext<I>) => O;
```

This makes deterministic input-aware normalization explicit at the parse boundary. Existing
one-argument parse callbacks remain valid and required no repository-wide rewrite.

### `src/engine/cast.ts`

The cast loop passes its already-assembled context to parse. No phase was reordered:

- execution returns;
- budget is checked;
- output parses/normalizes once;
- gates see that output;
- effect receives the same output on CLEAR.

This single-output flow is load-bearing: a normalization that only changed the gate input would have
allowed the original dangling code to reach materialization.

### `src/engine/cast.test.ts`

The existing token-free executor seam now captures parse contexts and proves parse receives:

- the typed input object;
- the resolved project root;
- exactly one context on the successful cast path.

The test continues through effect and run-log settlement, so it proves the callback change at the
real generic cast boundary.

### `src/play/decompose-epic-core.ts`

`stripNonGoalAdvances` now accepts an optional charter:

```ts
stripNonGoalAdvances(plan, charter?): WorkPlan
```

Behavior without a charter is backward-compatible: only N-shaped non-goals strip.

With a charter:

1. `snapshotCharterCodes` snapshots definition-shaped codes once;
2. N-shaped claims strip unconditionally because a non-goal cannot be advanced even when its
   definition resolves;
3. every remaining claim is judged by shared `classifyCharterCite` with action `strip`;
4. `degradable` snapshot misses strip;
5. `resolvable` codes remain;
6. `structural`/free-text values remain for existing gates to judge.

Locations use `<ticket-id>.advances[index]`, giving the shared classifier occurrence-level
provenance even though durable disposition recording belongs to successor `T-077-02-04`.

The normalizer remains pure:

- no filesystem, clock, network, process, or BAML runtime dependency;
- one charter snapshot per call;
- one classification decision per occurrence;
- no mutation of plan, ticket, or advances arrays;
- unchanged ticket objects retain identity;
- changed tickets receive copied arrays.

### `src/play/decompose-epic.ts`

Production decompose parsing now supplies `ctx.inputs.charter` to normalization. Because the cast
loop fans this returned `WorkPlan` to both gates and effect, a stripped code cannot reach the
materialized ticket file.

### `src/gate/gates.ts`

Only documentation changed. The executable bounds rules are byte-for-byte unchanged:

- direct N-shaped claims STOP as non-goals;
- direct P-shaped snapshot misses STOP as dangling refs;
- free-text outcomes remain human-judgment territory.

The comments now identify both production-normalized editorial classes and preserve the direct-call
backstop rationale.

### `src/play/decompose-epic.test.ts`

The pure core suite now covers:

- legacy `[P4, N2]` → `[P4]` behavior;
- legacy N-only → empty behavior;
- no-charter compatibility;
- known P-code retention;
- mixed `[P3, P9]` → `[P3]`;
- dangling-only `[P9]` → `[]`;
- prefix-generic custom charter codes (`K1` retained, `K9` stripped);
- free-text and blank structural values retained;
- clean ticket identity;
- changed input non-mutation;
- independent multi-ticket transformation.

The test imports only the addon-free core; the BAML native addon remains off this path.

### `src/gate/gates.test.ts`

The composed acceptance proof covers both required outcomes:

- normalize `[P3, P9]` against definition-shaped charter → assert `[P3]` → `clear` returns CLEAR;
- normalize `[P9]` → assert `[]` → `clear` returns STOP at `value`.

The existing direct `[P9]` fixture still returns STOP at `bounds`, proving the backstop was not
silently removed.

## Acceptance mapping

| Acceptance clause | Result | Evidence |
|---|---|---|
| dangling `advances` code degrades | met | core snapshot/classifier normalization tests |
| code stripped/annotated in normalize | met via strip | exact normalized arrays asserted |
| no normal-path bounds STOP | met | composed mixed fixture returns CLEAR |
| normalized plan can materialize | met | production parse returns one plan to gates and effect |
| empty survivor still refuses | met | dangling-only fixture STOPs at value |
| structural boundary retained | met | direct bounds STOP and full gate suite |
| verified over core/gates | met | 67 focused tests, addon-free |

## Verification

### Generic parse seam

```text
bun test src/engine/cast.test.ts
22 pass, 0 fail, 239 assertions
```

### Ticket-focused post-commit proof

```text
bun test src/play/decompose-epic.test.ts src/gate/gates.test.ts
67 pass, 0 fail, 131 assertions
```

### Repository completion gate

```text
bun run check
BAML codegen: pass
tsc --noEmit: pass
bun test: 1780 pass, 1 skip, 0 fail, 5609 assertions
```

The single skip is the existing optional release-acceptance branch for absent local `dist/`
artifacts. The real-dist acceptance branch passed in the same suite.

### Diff hygiene

- `git diff --check` is clean over all eight ticket-owned source paths.
- All eight ticket-owned source paths are committed and absent from `git status`.
- No BAML generated diff was committed.
- No source file was created or deleted.

## Concurrency audit

Sibling `T-077-02-02` ran in parallel on the story-declared disjoint materialization surface. During
this implementation its incomplete edits temporarily caused typecheck failures and one stale
bare-code integration expectation. This ticket did not modify those paths. The final full gate ran
after the sibling work reached a coherent green state.

Remaining modified/untracked worktree paths at handoff are Lisa-managed ticket/provenance/work
artifacts or sibling-owned materialization changes. Neither source commit included them.

## Scope audit

Intentionally not changed:

- inline prose rendering or `BareCodeError` handling (sibling `T-077-02-02`);
- materialize or decompose-effect result shapes;
- `RunRecord` or cast-summary disposition presentation (`T-077-02-04`);
- graph, story-completeness, structural, allocation, or value rules;
- repair/regeneration loops;
- charter contents;
- BAML schema or generated clients;
- ticket phase/status fields.

## Honest boundary

The proof is fixture-based, local, addon-free on the core/gate path, and token-free. No live metered
decompose cast was run, matching the parent story's honest boundary.

The exact production materialization assertion is architectural rather than a new full-play BAML
fixture: `castPlay` parses once, and the returned normalized `WorkPlan` is the same object handed to
gates and effect. The generic cast context test plus pure normalize/gate fixtures pin both sides of
that flow. This matches the ticket's explicit “verified over decompose-epic-core / gates” scope.

## Open concerns

None blocking.

The normalizer invokes the shared disposition classifier but this ticket does not persist its
records. Successor `T-077-02-04` owns carrying both inline and advances dispositions onto the run
record and summary. That is a named story dependency, not an unreported gap in this ticket.

The optional-charter overload preserves older direct callers. Production always supplies the run's
charter, so dangling-code degradation is active on the real decompose path without hardcoding Vend's
current invariant set.

## Final assessment

The implementation is inside scope, pure at the decision core, backward-compatible for existing
plays and direct no-charter callers, fully tested, green under the repository gate, and committed.
Editorial charter-cite noise no longer discards a valuable board, while a ticket that advances
nothing still cannot clear. This preserves P3's structural contract and P5's local charter authority.
