# T-077-02-02 — Plan

## Objective

Convert unresolved inline charter citations from a whole-cut `BareCodeError` into an honest,
successful annotated materialization with ordered structured dispositions, while proving a real
structural defect still stops before every write.

## Scope controls

- Modify only inline prose application and its concrete effect propagation.
- Do not normalize or strip `advances`; `T-077-02-03` owns that surface.
- Do not change gates or structural verdicts.
- Do not add run-log or cast-summary presentation; `T-077-02-04` owns that join.
- Do not modify BAML schemas or generated clients.
- Do not touch concurrent Lisa/provenance/ticket/worktree changes.
- Write all phase artifacts only to the attempt work directory.

## Step 1 — Add inline prose classification/application

Modify `src/play/materialize.ts`.

1. Import the predecessor classifier, aggregate fold, and types.
2. Add the stable annotation marker.
3. Widen prose matching to observe already-authored gloss delimiters.
4. Reuse `policedPrefixes` for snapshot-miss scope.
5. Change private prose resolution into text plus classifications.
6. Supply action `annotate` for every eligible occurrence.
7. Preserve unknown foreign-prefix matches.
8. Preserve authored gloss bytes for resolvable codes.
9. Replace unresolved code/delimiter with the honest marker.
10. Treat structural classifier output as an internal invariant failure.

Independent verification:

```bash
bun test src/play/materialize.test.ts
```

Expected intermediate state: old prose-refusal assertions fail until Step 3 updates tests.

## Step 2 — Add detailed pure renderer seams

Continue in `src/play/materialize.ts`.

1. Add private `DetailedRender`.
2. Split ticket rendering into internal detailed renderer plus stable public wrapper.
3. Locate ticket fields as filename fragments.
4. Collect ticket classifications in body order.
5. Split story rendering into internal detailed renderer plus stable public wrapper.
6. Locate each story contract field separately.
7. Collect story classifications in rendered order.
8. Keep public `RenderedFile` unchanged.
9. Keep all frontmatter, DAG, footer, and advances bytes unchanged except transformed inline cites.

Verification criteria:

- existing renderer goldens pass unless they explicitly exercise the changed unresolved behavior;
- resolved citation goldens remain byte-identical;
- alias and story-contract behavior remains unchanged.

## Step 3 — Return materialization dispositions

Continue in `src/play/materialize.ts`.

1. Extend `MaterializeResult` with required `degrades`.
2. Render using detailed renderers.
3. Flatten classifications story-first then ticket-first, preserving current file order.
4. Fold classifications through `materializationDisposition`.
5. Refuse an impossible structural fold before filesystem writes.
6. Run unchanged `findBareCodes` on rendered byte-only files.
7. Write files on clean or degraded classification.
8. Return the aggregate degradation array.
9. Update module and function comments so they describe the new boundary honestly.

Verification criteria:

- clean plans return `degrades: []`;
- editorial inline misses return nonempty ordered records;
- remaining raw bare-code surfaces can still trigger `BareCodeError`;
- collision still wins before content judgment.

## Step 4 — Update pure and real-fs materializer tests

Modify `src/play/materialize.test.ts`.

1. Add pure bare unresolved prose annotation case.
2. Add authored-gloss unresolved annotation case.
3. Assert readable gloss prose survives.
4. Assert raw unresolved codes do not survive.
5. Replace the old fs prose-refusal test with successful materialization.
6. Assert exact `{code, location, action}` arrays.
7. Assert files/directories actually exist.
8. Assert the written bytes are clean through the existing bare-code scanner semantics.
9. Assert clean fs results carry an empty degradation array.
10. Leave pure `findBareCodes` scanner tests intact.
11. Leave collision and routing-seat tests intact.

Focused command:

```bash
bun test src/play/materialize.test.ts
```

Pass bar: all tests in the module green with no expectation weakening on collision or scanner
behavior.

## Step 5 — Forward records through the concrete effect

Modify `src/play/decompose-effect.ts`.

1. Import `DegradeDisposition` type-only.
2. Add `DecomposeEffectResult extends EffectResult`.
3. Change `decomposeEffect`'s declared return type to the subtype.
4. Destructure `degrades` from `materialize`.
5. Forward only nonempty arrays on successful effects.
6. Preserve current routing disposition and inferred-seat spreads.
7. Preserve all named refusal catch arms.
8. Do not edit generic `EffectResult`, cast, or run-log types.

Modify `src/play/decompose-effect.test.ts`.

1. Create a complete unresolved-inline fixture.
2. Run the real concrete effect with a passing validator stub.
3. Assert success and exact disposition.
4. Assert annotated materialized bytes.
5. Assert validator execution remains once.

Focused command:

```bash
bun test src/play/decompose-effect.test.ts
```

## Step 6 — Invert the full-cast editorial fixture

Modify `src/play/bare-code-cast.test.ts`.

1. Update commentary from whole-cut refusal to degrade-not-discard behavior.
2. Make the editorial fixture cite unresolved N4 and N2 in ticket prose.
3. Ensure advances remain resolvable so the bounds gate clears.
4. Capture materializer degradations at the fixture effect boundary.
5. Forward the records from the fixture effect.
6. Assert the cast outcome is success/materialized.
7. Read real files and assert honest markers.
8. Assert N4/N2 raw tokens are absent.
9. Assert exact ordered records and field locations.
10. Assert the run log still shows all real gates passed.

Focused command:

```bash
bun test src/play/bare-code-cast.test.ts
```

## Step 7 — Add the structural contrast

Continue in `src/play/bare-code-cast.test.ts`.

1. Create a plan with an absent story contract.
2. Cast it through the same real gates and stub executor.
3. Assert `gate-failed`.
4. Assert `materialized: false`.
5. Assert neither target directory exists.
6. Assert the effect did not report degradations.
7. Assert run-log gate evidence names the story-completeness failure.

This test is mandatory because editorial success alone could accidentally hide a broad gate bypass.

## Step 8 — Focused verification

Run the three changed test modules together:

```bash
bun test \
  src/play/materialize.test.ts \
  src/play/decompose-effect.test.ts \
  src/play/bare-code-cast.test.ts
```

Verify:

- no BAML native addon value imports entered the test modules;
- annotation handles both bare and authored-gloss input;
- dispositions preserve occurrence order;
- clean materialization remains clean;
- structural gate refusal writes nothing;
- routing and collision tests remain green.

## Step 9 — Typecheck/build

Run:

```bash
bun run build
```

Verify:

- exported concrete result subtype is assignable to `Play.effect`;
- union narrowing is exhaustive;
- no unchecked regex group is used without handling;
- all changed callers accept the required `MaterializeResult.degrades` field.

## Step 10 — Full repository gate

Run:

```bash
bun run check
```

This is the mandatory commit gate.

It must prove:

- BAML code generation succeeds;
- TypeScript compilation succeeds;
- the full test suite succeeds;
- no unrelated shared-branch work broke the repository;
- no generated diff was introduced unexpectedly.

If the gate fails from this ticket, fix and rerun. If it fails only from concurrent work, capture the
evidence in progress/review and avoid modifying that work.

## Step 11 — Diff and ownership audit

Run read-only inspections:

```bash
git diff --check -- \
  src/play/materialize.ts \
  src/play/materialize.test.ts \
  src/play/decompose-effect.ts \
  src/play/decompose-effect.test.ts \
  src/play/bare-code-cast.test.ts

git diff -- \
  src/play/materialize.ts \
  src/play/materialize.test.ts \
  src/play/decompose-effect.ts \
  src/play/decompose-effect.test.ts \
  src/play/bare-code-cast.test.ts
```

Confirm:

- no ticket-owned file is already staged;
- only intended source behavior changed;
- ticket phase/status changes remain Lisa-owned and uncommitted by this source unit;
- concurrent `T-077-03-01` files remain untouched.

## Step 12 — Atomic ticket source commit

After the full gate is green:

```bash
lisa commit-ticket \
  --ticket-id T-077-02-02 \
  --message "fix(play): degrade unresolved inline charter cites (T-077-02-02)" \
  --include src/play/materialize.ts \
  --include src/play/materialize.test.ts \
  --include src/play/decompose-effect.ts \
  --include src/play/decompose-effect.test.ts \
  --include src/play/bare-code-cast.test.ts
```

Do not use `git add`, `git commit`, or a normal index workflow.

Post-commit:

- capture the commit hash;
- verify the five paths are clean;
- verify unrelated shared changes remain visible and untouched;
- verify no ticket-owned source remains staged, modified, or untracked.

## Step 13 — Progress artifact

Write `progress.md` in the attempt directory with:

- implemented behavior;
- exact files changed;
- focused test results;
- build result;
- full gate result;
- commit command/hash;
- deviations from this plan;
- remaining work, which should be Review only.

## Step 14 — Review artifacts

Write `review.md` covering:

- acceptance evidence;
- file-by-file summary;
- annotation semantics;
- disposition ordering/location semantics;
- structural refusal proof;
- tests and full gate;
- out-of-slice work reserved for T-077-02-03/-04;
- open concerns or limitations;
- worktree/commit hygiene.

Write exact JSON:

```json
{"disposition":"pass","reason":null}
```

only when all acceptance and verification bars are met. Otherwise write `block` with a nonempty,
actionable reason.

## Acceptance trace

| Acceptance clause | Implementation | Proof |
|---|---|---|
| unresolvable inline prose cite no longer throws | inline applier before bare-code guard | real-fs + cast fixture |
| board materializes | unchanged write loop after degraded fold | filesystem assertions |
| cite stripped/annotated honestly | `[unresolved charter cite]` marker | byte assertions |
| returns degrade disposition | `MaterializeResult.degrades`, concrete effect forwarding | exact object assertions |
| structural defect still refuses | unchanged real story-completeness gate | structural cast fixture |
| zero files on structural refusal | effect never invoked after STOP | absent-directory assertions |
| advances behavior not scope-crept | `advancesLine` unchanged, guard retained | diff review + existing tests |

## Stop condition

After `review.md` and `review-disposition.json` exist, remain on this ticket and stop. Lisa owns
publication, completion commit, ticket transition, and seat release.
