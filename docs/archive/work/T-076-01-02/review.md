# Review — T-076-01-02 cross-review-skipped-marker

## Verdict

**PASS.** All ticket acceptance criteria are met. The implementation is committed, ticket-owned
paths are clean, and the authoritative post-commit `bun run check` is green.

## Source commit

- Commit: `562613b073cc2af5f79f102b19109c2b3cb88766`
- Subject: `feat(cross-review): record skipped complement review (T-076-01-02)`
- Commit mechanism: `lisa commit-ticket`
- Exact includes:
  - `src/log/run-log.ts`
  - `src/log/run-log.test.ts`
  - `src/engine/cast.ts`
  - `src/engine/cast.test.ts`
- Diff size: 158 insertions, 10 deletions across four files.
- No ordinary `git add` or `git commit` was used.
- The ordinary Git index was empty after commit.
- All four ticket-owned paths were clean after commit.

## What changed

### Durable marker schema

`src/log/run-log.ts` now exports:

```ts
interface CrossReviewSkipped {
  readonly reason: string;
  readonly bindsWhen: string;
}
```

The optional `crossReviewSkipped` field exists on both:

- `RunRecordInput`;
- normalized `RunRecord`.

This follows the structured optional-marker pattern established by `SeatDefaulted` and
`SeatInferred`.

### Normalization and read behavior

`normalizeCrossReviewSkipped`:

- accepts only non-null objects;
- requires a non-empty `reason` string;
- requires a non-empty `bindsWhen` string;
- rebuilds the object with schema keys only;
- preserves deterministic key order;
- drops partial or malformed optional metadata;
- never invalidates the otherwise useful base run.

Both `buildRunRecord` and `reviveRecord` use this helper.

A valid marker therefore survives:

```text
RunRecordInput
  → buildRunRecord
  → serializeRunRecord
  → readRuns/reviveRecord
  → serializeRunRecord
```

Absent markers remain absent. Historical records are not reclassified or synthesized.

`RUN_LOG_SCHEMA_VERSION` remains `1`, consistent with the repository's other additive optional
provenance fields.

### Settlement wiring

`src/engine/cast.ts` now carries optional `crossReviewSkipped` state beside
`crossVendorVerdict`.

The existing applicability boundary remains intact. Complement resolution is reached only when:

1. gates are enabled;
2. the effect succeeded;
3. a non-empty captured diff exists;
4. the executor maps to a known authoring lane.

Inside that boundary:

- a non-null reviewer follows the existing review path;
- a null reviewer stamps `crossReviewSkipped`.

The emitted marker is:

```json
{
  "reason": "no-complement-reviewer-resolved",
  "bindsWhen": "author-and-exactly-one-complement-reviewer-provisioned"
}
```

This wording reflects the resolver's real contract. It does not falsely claim that a registry was
empty: null can also mean incomplete or ambiguous capability configuration.

The marker is forwarded to the single run-log append through a conditional spread. The field is
therefore physically absent when it does not apply.

### Behavior deliberately unchanged

- A skipped complement remains inert for settlement; it does not fail the run.
- No cross-vendor gate row is fabricated when no reviewer ran.
- A passing reviewer still preserves success and adds pass evidence.
- A refusing reviewer still produces `gate-failed` and retains landed-effect truth.
- `RunSummary` is unchanged.
- Stdout is unchanged.
- Budget and timeout behavior are unchanged.
- Resolver semantics are unchanged.
- Reviewer provisioning is unchanged.
- Run-log retains no dependency on executor or cross-review policy modules.

## Acceptance review

### AC 1 — run-log declaration, normalization, round trip, unit tests

> `crossReviewSkipped` is declared in run-log.ts following the seatDefaulted pattern (schema,
> normalize, round-trip through the ledger read path) with unit tests.

**PASS.** Evidence:

- exported `CrossReviewSkipped` interface;
- optional fields on both run-log faces;
- atomic `normalizeCrossReviewSkipped` helper;
- build-path conditional preservation;
- revive/read-path conditional preservation;
- six focused unit tests;
- valid marker byte-stable read round trip;
- exact absent-marker pre-feature serialization;
- historical absence remains absent;
- partial build input omitted;
- extra fields stripped;
- malformed parsed marker dropped without losing the record.

### AC 2 — exact cast stamp condition and irrelevant-path compatibility

> castPlay stamps the marker exactly when a complement would be relevant and resolution is inert;
> a lane-less or diff-less cast carries NO marker (byte-identical record to today).

**PASS.** Evidence:

- assignment occurs only inside the existing review applicability guard;
- assignment occurs only in `reviewer === null`;
- default one-seat configuration with known Claude author and real diff receives the exact marker;
- default-config skipped cast remains successful with ordinary gate rows unchanged;
- lane-less diff-producing cast has no marker in raw or revived record;
- known-lane diff-less cast has no marker in raw or revived record;
- absent-marker unit test pins the exact pre-feature serialized bytes;
- passing reviewer record has no skipped marker;
- refusing reviewer record has no skipped marker;
- marker and verdict cannot be assigned in the same branch.

### AC 3 — full gate

> `bun run check` green.

**PASS.** Post-commit result:

- BAML code generation passed;
- `tsc --noEmit` passed;
- 1735 tests passed;
- 1 expected release-artifact integration test skipped because `dist/` is absent;
- 0 tests failed;
- 5384 expectations passed.

## Test coverage

### Focused schema suite

```bash
bun test src/log/run-log.test.ts
```

- 119 passed;
- 0 failed;
- 261 expectations.

### Focused cast suite

```bash
bun test src/engine/cast.test.ts
```

- 18 passed;
- 0 failed;
- 154 expectations.

### Combined ticket-owned suites

```bash
bun test src/log/run-log.test.ts src/engine/cast.test.ts
```

- 137 passed;
- 0 failed;
- 415 expectations.

### Adjacent resolution and settlement suites

```bash
bun test src/cross-review/resolve-complement.test.ts src/engine/cast-core.test.ts
```

- 72 passed;
- 0 failed;
- 161 expectations.

### Static checks

```bash
bun run build
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts src/engine/cast.ts src/engine/cast.test.ts
```

- Typecheck passed.
- Diff whitespace check passed.

### Test-first credibility

The new tests demonstrated the missing behavior before implementation:

- run-log red: 117 pass, 2 fail because valid markers were absent;
- cast red: 17 pass, 1 fail because a relevant default-config run lacked the marker.

Both became green only after their corresponding source changes.

## Full-gate concurrency note

The first full-gate attempt observed eight transient failures from concurrent ticket
`T-076-03-01`. Its doctor implementation had added a sixth result before updating existing
five-result expectations.

This worker did not modify those files. After the concurrent ticket completed the expectation
updates, its focused suite passed 23/23 and Vend's full gate passed. The source commit was made only
after the shared gate was green, and the full gate passed again after this ticket's commit.

This was shared-worktree timing, not a defect hidden or waived by this Review.

## Coverage assessment

Coverage is proportional and complete for the ticket:

- pure schema normalization is branch-tested;
- append-only read compatibility is tested;
- exact serialization compatibility is tested;
- impure cast wiring is exercised with token-free stub executors and temporary Git repos;
- the positive settlement path captures actual patch bytes;
- both named negative boundaries are tested;
- provisioned pass/fail paths guard mutual exclusivity;
- adjacent resolver and pure settlement behavior remains green;
- the entire repository suite remains green.

No live or metered cast was necessary. The story explicitly describes this slice as free and
unit-testable.

## Open concerns and limitations

### Generic null reason

`resolveComplementExecutor` returns `ComplementExecutor | null`, not a discriminated reason. The
marker therefore uses the truthful generic reason `no-complement-reviewer-resolved` for every null
subcase reached through the relevant guard.

The `bindsWhen` field still names the exact capability condition that would resolve:

```text
author-and-exactly-one-complement-reviewer-provisioned
```

This is not acceptance-blocking. A future need for finer distinctions would justify a separate
resolver-result refactor rather than inference in the cast or log.

### Deferred failure handling

A reviewer that resolves but is unreachable belongs to `S-076-02`. This ticket intentionally does
not catch or relabel that failure.

### No UI/doctor changes

Provisioning UI and doctor coverage are explicitly outside this slice. Concurrent
`T-076-03-01` owns doctor visibility independently.

No other known concern blocks acceptance.

## Scope integrity

- No resolver source was changed.
- No provisioning mechanism was invented.
- No UI was added.
- No doctor code was modified.
- No ticket phase/status field was manually updated.
- No Lisa provenance or concurrent source file was included in the commit.
- Private work artifacts were written to the assignment path.
- The work stops on `T-076-01-02` after this Review, awaiting Lisa verification and publication.
