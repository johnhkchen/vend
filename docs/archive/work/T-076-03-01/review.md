# Review — T-076-03-01

## Outcome

PASS. Doctor now reports cross-review readiness as a sixth visible check. Default configuration is
honestly green and inert, while an explicitly provisioned complement is resolved through the same
policy as a cast and probed through the same unmetered executor capability as the primary seat.

Source commit:

```text
d20a09fcb256e542f9af2502d9901e301bebb783
feat(doctor): probe configured reviewer dispensability
```

## Acceptance assessment

### Default config: green with visible inert line

PASS.

`probeDoctor` now returns this exact sixth check under the default registry:

```text
cross-review: not provisioned — casts skip review
```

The check is `ok: true` and has no hint. The all-green deterministic test asserts its exact value at
index 5. The guarded-live default test also asserts the exact line and green state independently of
the host's primary executor readiness.

This is honest rather than optimistic: canonical default complement resolution returns `null`, so
default casts skip review and dial no reviewer.

### Provisioned and reachable: green named check

PASS.

An explicit two-seat registry with a Claude author and OpenAI-compatible complement resolves through
`resolveComplementExecutor` to the Codex reviewer seat. The full `probeDoctor` result contains:

```text
cross-review reviewer dispensable: codex
```

with `ok: true`.

The test additionally proves:

- all six doctor checks are green in the wired fixture;
- the reviewer factory is constructed once;
- the reviewer probe runs once;
- the author factory is not constructed by complement resolution;
- the fake executor's `dispense()` trap is not reached.

### Provisioned and unreachable: red, seat named, fix supplied

PASS.

A two-seat registry whose complement probe returns structured failure data produces one red doctor
check named:

```text
cross-review reviewer dispensable: codex
```

Its hint contains both:

- `review endpoint refused connection`;
- `start or configure the reviewer endpoint`.

All other doctor checks remain green, so the reviewer is the sole reason the preflight is red.

### Reuses canonical resolution and existing probe

PASS.

Production code imports and calls:

- `resolveSeatOfExecution(activeExecutorId)`;
- `resolveComplementExecutor(authorSeat, registry)`;
- `reviewer.executor.probe()`.

It does not reimplement complement counting, seat mapping, registry construction, provider checks,
or endpoint/auth readers. It never calls `dispense()`.

No new probe result type or transport mechanism was added. Reviewer probing consumes the existing
required `ExecutorProbeResult` returned by every `Executor.probe()`.

### Full repository health

PASS.

`bun run check` completed successfully after BAML generation and strict TypeScript validation.

Full suite:

```text
1735 pass
1 skip
0 fail
5384 expect() calls
116 files
```

The one skip is the repository's pre-existing release acceptance integration that requires local
`dist/` artifacts.

## Files changed

### `src/doctor/doctor-probe.ts`

Added:

- `CROSS_REVIEW_INERT_CHECK`;
- `CROSS_REVIEW_DISPENSABLE_CHECK`;
- `DoctorProbeDeps.crossReviewRegistry`;
- default `crossReviewRegistry: undefined`;
- shared private dispensability result formatter;
- `reviewerDispensableCheck`;
- `crossReviewCheck`;
- sixth `safeCheck` composition in `probeDoctor`.

Updated module documentation to describe reviewer resolution and the six-check order.

The prior exported active-executor mapper retains its original names, detail joining, and fallback
text through the shared private formatter.

### `src/doctor/doctor-probe.test.ts`

Added:

- probe-controlled fake executor with a failing metered boundary;
- default inert reviewer assertion;
- provisioned reachable full-doctor assertion;
- provisioned unreachable full-doctor assertion;
- reviewer fallback mapper assertion;
- throwing reviewer probe containment assertion.

Updated all stable doctor check counts from five to six and extended guarded-live coverage.

### Files not changed

No changes were made to:

- `src/cross-review/resolve-complement.ts`;
- `src/engine/cast.ts`;
- `src/executor/executor.ts`;
- either concrete executor transport;
- `src/doctor/doctor-core.ts`;
- `src/doctor/preflight.ts`;
- `src/cli.ts`;
- ticket phase/status frontmatter.

This preserves the story's `src/doctor/` scope.

## Architecture review

### Pure core, impure shell

The structured result mapping is pure over plain values:

- active executor id/result to `Check`;
- reviewer seat/result to `Check`.

World interaction stays in the existing doctor probe shell:

- canonical lazy reviewer construction;
- shallow executor probe await.

The generic doctor core and renderer remain unchanged.

### Configuration fidelity

`crossReviewRegistry` has the same `ExecutorRegistry | undefined` semantics used by cast
orchestration:

- `undefined` invokes the canonical one-seat default;
- an explicit registry represents configured review capability.

Doctor does not use `builtinExecutors` as evidence of provisioning. This avoids regressing the
fresh-install fix from `T-076-01-01`.

### Failure containment

The new check runs inside the existing `safeCheck`. Unexpected resolver, factory, or probe throws
become returned red data rather than rejecting `probeDoctor`.

Expected provider failures are already returned as `ExecutorProbeResult { ok: false, ... }`, so
they keep the resolved seat-specific name and provider repair guidance.

A raw unexpected throw occurs before a check result exists and therefore receives the generic name
`cross-review reviewer dispensable`. This is still actionable and preserves the never-throw
contract; expected reachability failures satisfy the seat-naming acceptance path.

### Cost boundary

The test fake implements `dispense()` only as a throwing trap. Passing tests therefore establish
that reviewer readiness uses no metered path. Production code references only `probe()`.

This remains the same shallow guarantee as the primary executor check: config/auth/reachability at
the provider's probe boundary, not proof of quota or a successful review turn.

## Verification record

### Baseline

```text
bun test src/doctor/doctor-probe.test.ts   src/doctor/preflight.test.ts   src/cross-review/resolve-complement.test.ts

28 pass, 0 fail, 115 expectations
```

### Test-first red

The new tests initially failed because `crossReviewCheck` did not exist. After the initial source
implementation, old fixed counts correctly failed with received six versus expected five.

### Focused final

```text
bun test src/doctor/doctor-probe.test.ts   src/doctor/preflight.test.ts   src/cross-review/resolve-complement.test.ts

33 pass, 0 fail, 137 expectations
```

### Static and full gates

- `git diff --check` over both ticket-owned source paths: clean.
- `tsc --noEmit` through `bun run check`: pass.
- BAML generation: pass, no tracked generated delta.
- Full Bun test suite: pass.

## Commit hygiene

The source commit used Lisa's exact-path transaction:

```text
lisa commit-ticket --ticket-id T-076-03-01   --message "feat(doctor): probe configured reviewer dispensability"   --include src/doctor/doctor-probe.ts   --include src/doctor/doctor-probe.test.ts
```

The commit contains exactly those two paths. Both are clean afterward and no ticket-owned file is
staged, modified, or untracked.

Remaining working-tree state belongs to Lisa publication/provenance and the concurrent
`T-076-01-02` workflow. It was preserved.

## Open concerns and honest boundary

- No reviewer provisioning UI or persisted config surface exists in this slice. The provisioned
  branches are fixture-proven through the same explicit registry seam cast uses, as the story
  requires. A future provisioning surface must pass its registry consistently to doctor/preflight.
- The probe is intentionally shallow and unmetered. Green does not prove reviewer quota, response
  quality, or successful completion of a metered review.
- The guarded-live default proves the inert line on this host; provisioned reviewer reachability is
  deterministic unit coverage rather than a live external endpoint test.
- No auto-provisioning was added.
- No unrelated doctor behavior changed.

No critical issues remain for this ticket.

