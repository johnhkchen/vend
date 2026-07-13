# Progress — T-078-02-03

## Outcome

Implementation is complete, verified, and committed.

The generic `vend init` charter now ships with three P-labeled invariant examples and the exact
one-line convention note:

```markdown
<!-- Casts cite these labels in `advances`; keep each P-label stable once referenced. -->
```

The pure init test resolves those seed labels through the shared exported gate detector. The real
filesystem effect test confirms a fresh workspace receives the labeled charter at
`docs/knowledge/charter.md`.

## Research completed

- Read `AGENTS.md`.
- Read `.lisa/attempts/T-078-02-03/1/work/assignment.md`.
- Read `docs/knowledge/rdspi-workflow.md`.
- Read parent story `docs/active/stories/S-078-02.md`.
- Read ticket `docs/active/tickets/T-078-02-03.md`.
- Read `docs/knowledge/vision.md` and `docs/knowledge/charter.md`.
- Inspected the predecessor gate detector in `src/gate/gates.ts` and its tests.
- Inspected all init core, effect, and idempotency source/tests.
- Confirmed `CHARTER_STUB` is the single base-manifest content source.
- Confirmed `applyInitScaffold` already writes manifest bytes with no-clobber semantics.
- Confirmed template overlays own distinct charter content and are out of scope.

Artifact written:

- `.lisa/attempts/T-078-02-03/1/work/research.md`

## Design completed

Selected a content-only production change:

- enrich the module-private `CHARTER_STUB` in place;
- retain generic authoring guidance;
- add three illustrative, replaceable P-labeled invariants;
- teach the citation convention in one HTML comment line;
- keep runtime init independent of gate semantics;
- prove conformance through test-only imports of `matchIds`.

Rejected:

- exporting the private stub solely for tests;
- adding charter-specific logic to the filesystem effect;
- duplicating the detector regex;
- copying Vend's own P1–P7 as a new project's value function;
- changing hackathon or kitchen overlay charters.

Artifact written:

- `.lisa/attempts/T-078-02-03/1/work/design.md`

## Structure completed

Planned exactly three ticket-owned source files:

- `src/init/init-core.ts`
- `src/init/init-core.test.ts`
- `src/init/init-effect.test.ts`

No production interface, manifest shape, path, order, or effect signature changed.

Artifact written:

- `.lisa/attempts/T-078-02-03/1/work/structure.md`

## Plan completed

Sequenced:

1. Seed content change.
2. Pure shared-detector proof.
3. Fresh-workspace filesystem proof.
4. Focused tests.
5. Full repository check.
6. Exact-path Lisa commit.
7. Commit and worktree verification.
8. Review artifacts.

Artifact written:

- `.lisa/attempts/T-078-02-03/1/work/plan.md`

## Implementation step 1 — generic charter seed

Modified `CHARTER_STUB` in `src/init/init-core.ts`.

Added:

- `## Invariants`;
- the exact cast-citation comment;
- `P1 — Name the durable value`;
- `P2 — State the hard boundary`;
- `P3 — Make success verifiable`.

Each example explicitly tells the operator to replace its placeholder content. This teaches the
shape without presenting Vend's own principles as the initialized project's values.

Unchanged:

- the charter title;
- the existing project-specific authoring instruction;
- the `vision.md` pointer;
- manifest path and entry structure;
- overlay charter strings;
- init planner and writer.

## Implementation step 2 — pure detector proof

Modified `src/init/init-core.test.ts`.

- Imported exported `matchIds` from `src/gate/gates.ts`.
- Promoted the base charter manifest fixture for reuse.
- Added a focused test group for `T-078-02-03`.
- Asserted the shared detector returns exactly `P1`, `P2`, and `P3` from the seed.
- Pinned the complete one-line HTML comment byte-for-byte.
- Kept the test filesystem-free and addon-free.
- Updated stale base-charter comments without changing overlay assertions.

## Implementation step 3 — fresh-workspace effect proof

Modified `src/init/init-effect.test.ts`.

- Imported the same exported `matchIds` detector.
- Extended the existing bare Lisa-project scaffold test.
- Read the generated `docs/knowledge/charter.md` from the real temp root.
- Asserted the on-disk charter has a non-empty detected P-label set.
- Asserted its bytes equal the charter entry in `SCAFFOLD_MANIFEST`.
- Retained the existing `finally` cleanup.
- Updated stale E-040 byte-parity wording to describe the generic labeled stub honestly.

## Plan deviations

No architectural or scope deviations occurred.

One small implementation refinement was made during diff review: stale effect-test wording that said
the charter remained byte-identical to the original E-040 stub was updated because this ticket
intentionally changes those bytes. The test behavior itself was unchanged.

## Focused verification

Command:

```text
bun test src/init/init-core.test.ts src/init/init-effect.test.ts
```

Result:

- 65 tests passed.
- 0 tests failed.
- 418 expectations completed.
- Both source test files ran.
- The new pure detector test passed.
- The new on-disk labeled-charter assertion passed.
- Existing template, no-clobber, and idempotency coverage passed.

## Full repository gate

Command:

```text
bun run check
```

Result:

- BAML client generation passed.
- TypeScript `tsc --noEmit` passed.
- 1,819 tests passed.
- 1 test was intentionally skipped because no `dist/` artifacts existed.
- 0 tests failed.
- 5,900 expectations completed.
- 119 test files ran.

No generated BAML file remained modified after the gate.

## Diff inspection

`git diff --check` passed for all ticket-owned source paths.

Pre-commit diff summary:

- `src/init/init-core.ts`: 8 additions.
- `src/init/init-core.test.ts`: 23 additions, 7 deletions.
- `src/init/init-effect.test.ts`: 12 additions, 2 deletions.

The final commit contains:

- 43 insertions;
- 9 deletions;
- exactly three files.

No gate, doctor, schema, CLI, production effect, or overlay source file changed.

## Commit

Created through the required Lisa transaction:

```text
lisa commit-ticket \
  --ticket-id T-078-02-03 \
  --message "feat(init): scaffold labeled charter invariants" \
  --include src/init/init-core.ts \
  --include src/init/init-core.test.ts \
  --include src/init/init-effect.test.ts
```

Commit:

```text
3c26cfc3180e4d75d587d1bde4317ebf5c74f30e
```

Commit inspection confirms exactly:

- `src/init/init-core.ts`
- `src/init/init-core.test.ts`
- `src/init/init-effect.test.ts`

No ordinary `git add` or `git commit` was used.

## Worktree ownership after commit

All three ticket-owned source paths are clean.

Remaining changes are Lisa-managed concurrent workflow state:

- `.lisa/provenance.jsonl`
- `docs/active/tickets/T-078-02-02.md`
- `docs/active/tickets/T-078-02-03.md`
- published work-artifact directories under `docs/active/work/`

Those paths were not included in the ticket source commit and were not reverted or modified by this
implementation.

## Remaining

- Write `review.md`.
- Write `review-disposition.json`.
- Stop on this ticket for Lisa completion handling.
