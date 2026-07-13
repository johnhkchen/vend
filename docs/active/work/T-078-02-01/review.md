# Review — T-078-02-01

## Disposition

Pass. The ticket acceptance contract is met, the source unit is committed, and the full repository
gate is green.

## What changed

The clearing gates now explain the P-label convention when, and only when, the active charter has no
detected P-labeled invariants and the plan stops for either of the two relevant `advances` defects.

The existing charter ID detector is now exported for sibling doctor and init work. Its semantics are
unchanged.

## File inventory

### `src/gate/gates.ts`

- Exported `matchIds`.
- Preserved its existing `(text, "P" | "N") => Set<string>` contract.
- Preserved its word-boundary regex, deduplication, and encounter order.
- Added one private diagnostic string naming:
  - the missing-label cause;
  - the `P1 — Author once, run forever...` convention example;
  - the `label them or cite none` fix.
- Added one private helper that appends the diagnostic only when the charter has zero detected P IDs.
- Threaded existing `ClearContext` into the private value gate.
- Applied the helper to ticket-level empty/invalid `advances` only.
- Applied the helper to shaped-P dangling references only.
- Kept every other reason and branch unchanged.

### `src/gate/gates.test.ts`

- Added the public `matchIds` import.
- Added a zero-label charter fixture.
- Pinned zero-label detection.
- Pinned P/N prefix selection and deduplication.
- Pinned the exact unlabeled empty-advances reason.
- Pinned the exact unlabeled dangling-ref reason.
- Strengthened both labeled equivalents from substring checks to exact legacy byte checks.
- Retained the complete pre-existing gate suite.

No source file was created, deleted, or renamed.

## Acceptance review

### Zero-label empty-advances refusal

Pass.

The new test calls `clear` with a charter containing no `P\d+` token and a ticket whose advances list
is empty. The verdict remains:

- status: stop;
- gate: value;
- unit: `T-009-01`.

The exact reason retains the old immediate defect and adds the missing-label cause, example, and
label-or-cite-none fix.

### Zero-label dangling-ref refusal

Pass.

The new test directly clears an unnormalized `P9` claim against the zero-label charter. The verdict
remains:

- status: stop;
- gate: bounds;
- unit: `T-009-01`.

The exact reason retains `P9`, `no such invariant`, and `dangling ref`, then adds the identical
missing-label cause and fix.

### Labeled-charter refusal wording

Pass.

The existing labeled empty-advances test now asserts the complete original literal:

```text
`advances` is empty — must name what it advances (never empty)
```

The existing labeled dangling-reference test now asserts the complete original literal:

```text
advances `P9` — no such invariant in the charter (dangling ref)
```

Production behavior makes this compatibility explicit: the diagnostic helper returns its input
`reason` without interpolation or reconstruction when at least one P-label exists.

### Labeled-charter pass/refuse verdicts

Pass.

- `GATE_NAMES` did not change.
- The gate table order did not change.
- The `clear` loop did not change.
- `GateResult`, `GateStop`, and `GateClear` did not change.
- All existing test fixtures still use labeled `CTX` unless they explicitly target the new case.
- All existing happy-path and refusal tests pass.
- Value branch ordering did not change.
- Bounds classification did not change.
- No previously passing plan is newly refused.
- No previously refused plan now clears.

### Detector export

Pass.

`matchIds` is imported and called as a runtime value from the test module. Typecheck and tests prove
the export is available. The function body is unchanged from the prior module-private implementation,
so downstream siblings inherit the same detector the bounds gate uses.

## Test coverage

### Focused suite

Post-commit command:

```text
bun test src/gate/gates.test.ts
```

Result:

- 31 passed;
- 0 failed;
- 59 expectations.

Coverage includes:

- public detector behavior;
- zero-label value refusal;
- labeled value compatibility;
- zero-label bounds refusal;
- labeled bounds compatibility;
- gate happy path;
- every existing gate family;
- first-offense ordering;
- normalization interaction;
- non-goal and free-text behavior;
- programmer-error guards.

### Full repository gate

Pre-commit command:

```text
bun run check
```

Result:

- BAML generation passed;
- TypeScript checking passed;
- 1,817 tests passed across 119 files;
- 1 integration test skipped because `dist/` was absent;
- 0 tests failed;
- 5,893 expectations completed.

The skip is an established conditional release-artifact test and is unrelated to this pure gate
change.

## Architecture review

- Pure core remains pure: no filesystem, clock, process, network, or native addon was introduced.
- The detector stays next to the gate that defines its current semantics.
- The new sibling seam is additive and has no reverse dependency on doctor or init.
- The public `clear` API is unchanged.
- No new parser or schema layer was introduced.
- The diagnostic derives only from the supplied charter, never from the epic where P references could
  mask an unlabeled charter.
- The change follows P3 by making an existing refusal teach the repair without weakening the gate.

## Scope review

The implementation stays inside the parent story boundary.

Not changed:

- gate verdict requirements;
- epic schema;
- charter schema;
- cite normalization;
- doctor behavior;
- init charter stub;
- kitchen or hackathon overlay charters;
- automatic labeling or migration;
- help behavior;
- CLI or executor behavior.

The two downstream story tickets remain intentionally unimplemented; they depend on this exported
seam and own disjoint directories.

## Commit and worktree review

Commit:

```text
3d212c889a17a81e5f69d0a4f9e9d4f151e522e8
fix(gates): explain unlabeled charter refusals
```

The commit was created through `lisa commit-ticket` and contains exactly:

- `src/gate/gates.ts`;
- `src/gate/gates.test.ts`.

`git show --check` reports no whitespace error. Both owned files are clean after the commit. Unrelated
concurrent changes in CLI, ticket, and shared work-artifact paths remain outside this commit and were
not modified for this ticket.

## Open concerns and limitations

- `matchIds` intentionally detects token-shaped labels anywhere in charter text rather than parsing
  Markdown definitions. This is existing behavior and the explicit shared seam, not a new limitation.
- A prose example containing `P1` counts as a label under that detector. Changing that semantic would
  require a separate story because it would alter bounds behavior and sibling expectations.
- The diagnostic is intentionally reactive. Proactive non-blocking diagnosis belongs to the doctor
  sibling ticket.
- The init stub remains unlabeled until its sibling ticket lands; this ticket only establishes the
  detector that sibling will reuse.
- No metered/live cast was necessary or warranted. All acceptance is fixture-proven in the pure gate
  layer, matching the story’s honest boundary.

None of these concerns blocks this ticket.

## Final assessment

The implementation is narrowly scoped, backward-compatible for labeled charters, explicit for the
two zero-label refusal paths, and verified at focused and repository-wide levels. It is ready for
Lisa to admit and complete.
