# T-077-02-01 — Plan

## Goal

Land the shared pure charter-cite disposition contract used by the two later appliers and the final
ledger ticket. Prove that unresolved editorial cites become explicit degradation records while
invalid cite inputs remain structurally distinguishable.

## Scope controls

- Create only `src/play/degrade-disposition.ts` and its unit test.
- Do not apply the classifier to production rendering or gates in this ticket.
- Do not change RunRecord or cast summary behavior.
- Do not change existing structural refusal behavior.
- Do not update ticket phase or status frontmatter.
- Preserve all pre-existing worktree modifications.
- Write RDSPI artifacts only in the private attempt directory.

## Step 1 — Create the pure contract module

Create `src/play/degrade-disposition.ts`.

Add:

- `DEGRADE_ACTIONS`;
- `DegradeAction`;
- `CharterCite`;
- `DegradeDisposition`;
- the three single-cite result interfaces;
- `CharterCiteClassification`;
- the three materialization result interfaces;
- `MaterializationDisposition`;
- `classifyCharterCite`;
- `materializationDisposition`.

Implementation checks:

- import `CharterSnapshot` type-only;
- use the same code shape as snapshot parsing;
- trim code and location once;
- validate code before location;
- use `snapshot.get` as the only resolution oracle;
- return data rather than throwing;
- preserve caller action on unresolved cites;
- first structural classification wins in the aggregate fold;
- preserve degradation order;
- return a fresh degradation array.

Verification after Step 1:

- inspect the file for runtime imports;
- run `bunx tsc --noEmit` only after the test exists, or rely on the focused Bun test's compile;
- ensure no existing source file changed.

## Step 2 — Add focused unit coverage

Create `src/play/degrade-disposition.test.ts`.

Build a small snapshot fixture:

```ts
new Map([
  ["P3", "Gates are the contract"],
  ["N4", "Not an executor"],
])
```

Test resolvable behavior:

- a known exact code returns `resolvable` with its title;
- whitespace is normalized;
- no degradation record is present on the result.

Test degradation behavior:

- unknown `N2` + `strip` returns exact `{code, location, action}`;
- unknown `P9` + `annotate` returns exact `{code, location, action}`;
- valid `K7` against an empty snapshot degrades;
- the input action is preserved exactly.

Test structural behavior:

- empty code is `invalid-code`;
- lowercase or malformed code is `invalid-code`;
- blank location is `missing-location`;
- invalid code has deterministic priority over missing location.

Test materialization taxonomy:

- empty classifications → `materialized`;
- all resolvable → `materialized`;
- one or more degradable → `materialized-with-degrades`;
- records remain in caller order;
- structural → `structural-refusal`;
- structural wins over a preceding degradation.

Test purity:

- classify a frozen cite against a frozen map;
- fold a frozen array;
- assert original values remain unchanged;
- assert aggregate output does not reuse the input array.

## Step 3 — Focused verification

Run:

```bash
bun test src/play/degrade-disposition.test.ts
```

Expected:

- all new tests pass;
- zero skipped tests;
- no BAML native addon involvement;
- no filesystem fixtures.

If a test fails:

- correct the production contract when the test reflects the design;
- correct the test only when it contradicts the documented design;
- record any material deviation in `progress.md` before proceeding.

## Step 4 — Type and diff verification

Run:

```bash
bun run build
git diff --check -- src/play/degrade-disposition.ts src/play/degrade-disposition.test.ts
git diff -- src/play/degrade-disposition.ts src/play/degrade-disposition.test.ts
```

Confirm:

- strict TypeScript accepts all union narrowing;
- `verbatimModuleSyntax` accepts the type-only snapshot import;
- no formatting whitespace defects exist;
- exported API matches Structure exactly;
- only the intended two source paths are ticket-owned changes.

## Step 5 — Full repository gate

Run:

```bash
bun run check
```

This is mandatory before the implementation commit. It must prove:

- BAML code generation succeeds;
- TypeScript typecheck succeeds;
- the full test suite succeeds;
- the new contract does not regress existing behavior.

If BAML generation changes generated files, inspect them. Do not include unrelated mechanical output
unless the ticket actually requires it; this ticket should not change BAML sources or generated
clients.

## Step 6 — Atomic Lisa commit

Commit the meaningful source unit only after the full gate is green:

```bash
lisa commit-ticket \
  --ticket-id T-077-02-01 \
  --message "feat(play): classify charter cite dispositions (T-077-02-01)" \
  --include src/play/degrade-disposition.ts \
  --include src/play/degrade-disposition.test.ts
```

Do not use `git add`, `git commit`, or an ordinary-index workflow.

Post-commit checks:

- capture the commit hash;
- verify the two source paths are no longer modified/untracked;
- verify Lisa-managed ticket-frontmatter changes remain untouched;
- verify no ticket-owned file is staged, modified, or untracked.

## Step 7 — Progress artifact

Write `progress.md` in the attempt work directory with:

- completed implementation steps;
- focused-test result;
- typecheck result;
- full-gate result;
- commit id and included paths;
- deviations, if any;
- remaining work, expected to be Review only.

## Step 8 — Review

Review the committed diff and acceptance criterion.

Write `review.md` covering:

- exact files created;
- public contracts added;
- classification semantics;
- test coverage and verification counts;
- compatibility and pure-core assessment;
- explicit later-ticket boundaries;
- open concerns or `none`.

Write `review-disposition.json` exactly as one of:

```json
{"disposition":"pass","reason":null}
```

or a blocked object with a non-empty actionable reason.

## Acceptance trace

| Acceptance clause | Implementation evidence | Test evidence |
|---|---|---|
| pure degrade-disposition type | `DegradeDisposition` in new addon-free module | exact object assertions |
| classifier accepts cited code + snapshot | `classifyCharterCite(cite, snapshot)` | known, unknown, empty snapshot cases |
| resolvable classification | `classification: "resolvable"` | known `P3` fixture |
| degradable strip/annotate | action literal union + degradable branch | exact strip and annotate fixtures |
| structural classification | malformed-code/location branches | deterministic structural tests |
| `{code, location, action}` record | `DegradeDisposition` | exact equality and ordering |
| materialized-with-degrades distinct | aggregate discriminated union | degraded aggregate fixture |
| structural refusal distinct | `structural-refusal` branch | structural-wins fixture |
| unit tests | new pure Bun suite | focused and full gates |

## Risk handling

### Risk: classifier duplicates snapshot parsing

Mitigation: it validates only the already-extracted code token shape and delegates resolution solely
to `snapshot.get`.

### Risk: location vocabulary is underspecified

Mitigation: keep location as validated nonblank provenance. Later appliers own exact strings and the
ledger preserves them verbatim.

### Risk: taxonomy is confused with terminal RunOutcome

Mitigation: use `status` only inside the play-level materialization disposition and do not import or
modify `RunOutcome`.

### Risk: structural branch weakens real structural gates

Mitigation: this ticket changes no existing gate/effect. The new branch classifies invalid direct
cite inputs only; graph/id/field/story refusals remain where they are.

### Risk: concurrent Lisa board edits enter the commit

Mitigation: use only exact `--include` paths and inspect post-commit status.
