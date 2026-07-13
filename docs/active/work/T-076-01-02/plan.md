# Plan — T-076-01-02 cross-review-skipped-marker

## Objective

Make a relevant cross-review attempt that cannot resolve a complement reviewer durably visible as
`crossReviewSkipped`, while leaving lane-less, diff-less, ungated, and reviewed casts unchanged.

## Preconditions

- Parent story `S-076-01` and ticket `T-076-01-02` have been read in that order.
- Dependency `T-076-01-01` is complete and default complement resolution returns `null`.
- Lisa-owned ticket/provenance modifications must be preserved and excluded from commits.
- Phase artifacts stay in `.lisa/attempts/T-076-01-02/1/work/`.
- Source work is committed only through `lisa commit-ticket` with exact includes.

## Step 1 — Pin run-log behavior with tests

Modify `src/log/run-log.test.ts`.

Add a `crossReviewSkipped` suite using the fixed marker:

```ts
{
  reason: "no-complement-reviewer-resolved",
  bindsWhen: "author-and-exactly-one-complement-reviewer-provisioned",
}
```

Cover:

1. Valid build → serialize → `readRuns` → serialize round trip.
2. Absent marker exactly matches a pinned pre-feature JSONL literal.
3. Historical literal reads without marker synthesis.
4. Partial input marker is omitted atomically.
5. Valid marker is copied without extra fields.
6. Malformed read metadata is dropped while the base record survives.

Run before source implementation:

```bash
bun test src/log/run-log.test.ts
```

Expected red signal: the input type and/or runtime record does not yet support
`crossReviewSkipped`. Capture the failure in `progress.md`.

## Step 2 — Implement the pure run-log schema

Modify `src/log/run-log.ts`.

1. Declare exported `CrossReviewSkipped` with `reason` and `bindsWhen`.
2. Add it to `RunRecordInput`.
3. Add it to `RunRecord`.
4. Implement `normalizeCrossReviewSkipped(unknown)`.
5. Normalize and conditionally spread it in `buildRunRecord`.
6. Normalize and conditionally spread it in `reviveRecord` at the same key position.

Run:

```bash
bun test src/log/run-log.test.ts
```

Review checkpoint:

- no executor/cross-review import enters `run-log.ts`;
- schema version remains unchanged;
- absent marker does not serialize;
- partial/malformed marker cannot poison the base record;
- canonical key order is `reason`, then `bindsWhen`.

## Step 3 — Pin cast settlement boundaries with tests

Modify `src/engine/cast.test.ts`.

### Positive case

Adapt the existing single-seat inert test:

- known Claude author;
- landed board-plan diff;
- omitted `crossReviewRegistry` to use default configuration;
- gates enabled.

Assert the exact marker, absent `crossVendorVerdict`, unchanged success, and unchanged ordinary
gate rows.

### Lane-less negative case

Extend the captured-diff fixture using the default `stub` executor id. Assert both raw and revived
records omit `crossReviewSkipped`.

### Diff-less negative case

Use a known Claude id in the no-op fixture, then assert raw and revived records omit the marker.

### Reviewed branches

Extend passing and refusing reviewer tests to assert the marker is absent.

Run before cast implementation:

```bash
bun test src/engine/cast.test.ts
```

Expected red signal: the default relevant-but-inert record lacks the marker. The negative and
reviewed assertions should remain green.

## Step 4 — Wire the settlement seam

Modify `src/engine/cast.ts`.

1. Import `CrossReviewSkipped` as a type from run-log.
2. Declare optional marker state beside `crossVendorVerdict`.
3. Preserve the existing applicability guard.
4. Preserve the non-null reviewer branch.
5. In the `reviewer === null` branch, assign the two fixed marker strings.
6. Forward the marker to `appendRunLog` through an omission-preserving spread.

Do not:

- assign outside the applicability guard;
- alter outcomes or gate rows;
- alter review timeouts;
- change `RunSummary` or stdout;
- touch resolver semantics.

Run:

```bash
bun test src/engine/cast.test.ts
```

Expected result: all cast integration tests pass.

## Step 5 — Focused regression verification

Run owned suites together:

```bash
bun test src/log/run-log.test.ts src/engine/cast.test.ts
```

Run adjacent boundary suites:

```bash
bun test src/cross-review/resolve-complement.test.ts src/engine/cast-core.test.ts
```

Expected results:

- marker round-trips;
- default resolver remains inert;
- reviewed settlement remains pass/fail compatible;
- relevant default path is marked;
- irrelevant boundary paths remain unmarked.

## Step 6 — Static and diff checks

Inspect only ticket-owned changes:

```bash
git diff -- src/log/run-log.ts src/log/run-log.test.ts src/engine/cast.ts src/engine/cast.test.ts
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts src/engine/cast.ts src/engine/cast.test.ts
bun run build
```

Review for:

- no unrelated source edits;
- no formatting damage;
- no policy import into run-log;
- all applicability facts precede marker assignment;
- marker and verdict are mutually exclusive;
- no historical marker synthesis;
- comments describe implemented behavior.

## Step 7 — Full project gate

Run:

```bash
bun run check
```

This is the authoritative BAML codegen, typecheck, and full test gate.

If it fails:

- distinguish ticket-owned failures from shared-worktree failures;
- fix only in-scope ticket failures;
- rerun focused tests after changes;
- rerun the full gate until green;
- do not commit a red state.

## Step 8 — Write implementation progress

Create private `progress.md` with:

- completed steps;
- red/green test evidence;
- exact files changed;
- deviations and rationale;
- focused and full-gate results;
- workspace ownership notes;
- commit command and hash.

## Step 9 — Commit the source unit with Lisa

After the full gate is green:

```bash
lisa commit-ticket \
  --ticket-id T-076-01-02 \
  --message "feat(cross-review): record skipped complement review (T-076-01-02)" \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

Do not use `git add`, `git commit`, or the ordinary index.

After commit, inspect `git status --short` and `git show --stat --oneline HEAD`.

Verify:

- no ticket-owned path remains staged, modified, or untracked;
- Lisa-owned provenance/frontmatter changes remain untouched;
- the commit contains exactly the four source/test files.

## Step 10 — Post-commit gate

Run `bun run check` again so Review cites the committed source state.

If the Lisa helper runs its own gate, retain both that result and the explicit post-commit result.

## Step 11 — Write Review

Create private `review.md` with:

- an acceptance verdict for every checkbox;
- source files changed and their responsibilities;
- exact marker schema and emitted values;
- positive and negative stamp boundaries;
- test coverage and commands;
- final full-gate result;
- source commit hash;
- open concerns or an explicit statement that none block acceptance;
- out-of-slice behavior deferred to `S-076-02` and later stories.

## Step 12 — Stop

After `review.md` exists:

- do not edit ticket phase/status;
- do not publish private artifacts manually;
- do not start another ticket;
- remain on `T-076-01-02` for Lisa verification.

## Acceptance verification matrix

| Requirement | Verification |
|---|---|
| Marker schema declared | Typecheck and source inspection |
| SeatDefaulted-style normalize | partial, extra-field, malformed tests |
| Ledger read round-trip | `readRuns` and byte-stable reserialize test |
| Relevant inert cast marked | default-config board-plan integration test |
| Lane-less cast unmarked | diff-producing `stub`-lane assertion |
| Diff-less cast unmarked | known-Claude no-op assertion |
| Reviewed cast unmarked | pass/fail reviewer assertions |
| Existing outcome/gates unchanged | existing integration assertions |
| Repository quality gate | `bun run check` |
| Done means committed | Lisa exact-includes commit and clean owned paths |
