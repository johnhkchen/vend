# Design — T-076-01-02 cross-review-skipped-marker

## Decision summary

Add an optional atomic `CrossReviewSkipped` object to the run-log schema with two required,
non-empty string fields:

```ts
interface CrossReviewSkipped {
  readonly reason: string;
  readonly bindsWhen: string;
}
```

At the existing cross-review settlement seam, stamp one fixed marker only when all existing review
applicability conditions hold and `resolveComplementExecutor` returns `null`:

```ts
{
  reason: "no-complement-reviewer-resolved",
  bindsWhen: "author-and-exactly-one-complement-reviewer-provisioned",
}
```

Normalize, serialize, and revive the marker with the same atomic optional-object pattern as
`seatDefaulted`. Omit it everywhere else.

## Goals

- Make a relevant but inert cross-review gate countable in the durable ledger.
- State both the observed reason for skipping and the condition that would bind the gate.
- Preserve ordinary and historical record bytes when no marker applies.
- Preserve the existing successful and refusing reviewer paths.
- Keep the log decoupled from executor and cross-review policy modules.
- Keep verification free and hermetic.

## Non-goals

- Do not change complement selection semantics.
- Do not add a reviewer provisioning surface.
- Do not diagnose endpoint reachability.
- Do not classify provisioned-but-unreachable reviewer failures.
- Do not modify UI or doctor output.
- Do not add a new run outcome.
- Do not make skipped review fail settlement.
- Do not add a cross-review gate row when no reviewer ran.
- Do not synthesize markers for historical records.

## Applicability decision

The existing `castPlay` guard is the authoritative definition of whether complement review is
relevant at settlement time:

1. Gates are enabled.
2. The effect landed successfully.
3. A non-empty diff artifact was captured.
4. The author executor projected to a known lane.

The marker is considered only inside this guard. The resolver result then partitions the relevant
path:

- non-null reviewer → execute review and record `crossVendorVerdict`;
- null reviewer → execute no review and record `crossReviewSkipped`.

This yields mutual exclusivity by construction. It also avoids reverse inference from missing
verdict data.

## Marker field design

### `reason`

`reason` records the event observed by the caller: no complement reviewer was resolved from the
configured capability set.

The selected stable value is:

```text
no-complement-reviewer-resolved
```

This wording is deliberately faithful to the resolver's public `ComplementExecutor | null`
contract. It does not overclaim that a registry was completely empty. A null can also represent an
incomplete or ambiguous registry, and the cast seam cannot distinguish those internal cases.

### `bindsWhen`

`bindsWhen` records the actionable capability condition that would make the existing resolver
return a live reviewer.

The selected stable value is:

```text
author-and-exactly-one-complement-reviewer-provisioned
```

This mirrors the actual resolver contract:

- the authoring seat must be present in the configured registry;
- exactly one other known seat must be present.

It is more accurate than a generic “configure reviewer” hint because an opposite-only registry and
an ambiguous multi-complement registry are also inert.

### Why strings rather than literal unions

The nearby `SeatDefaulted.reason` and `SeatInferred.reason` fields are strings. The ledger preserves
facts without importing the source policy's enum. Following that pattern keeps run-log decoupled
and permits future reason vocabulary without a ledger schema migration.

Tests pin the current cast-emitted values, providing stability where it matters.

## Considered approaches

### Option A — Boolean one-way marker

Shape:

```ts
readonly crossReviewSkipped?: true;
```

Advantages:

- Smallest serialized representation.
- Same omission semantics as `reducedGrounding` and `overEnvelope`.

Disadvantages:

- Fails the story requirement to state why review was skipped.
- Does not say what must become true for review to bind.
- Leaves operators with an observable problem but no capability contract.

Decision: rejected.

### Option B — Structured marker with only `reason`

Advantages:

- Mirrors many diagnostic records.
- Explains why no verdict exists.

Disadvantages:

- Omits the story's explicit “what would have to be true to bind” requirement.
- Encourages consumers to infer provisioning rules from the reason string.

Decision: rejected.

### Option C — Structured marker with `reason` and `bindsWhen`

Advantages:

- Directly represents both required facts.
- Closely follows the atomic `seatDefaulted` pattern.
- Human-readable and countable.
- Extensible without changing the outer run-record contract.
- Can be canonically normalized and round-tripped.

Disadvantages:

- Adds two strings to relevant skipped ledger lines.
- The fixed policy text must remain synchronized with resolver semantics.

Decision: selected. The extra bytes occur only for the degraded path and buy the honesty required
by P3/P7.

### Option D — Expand `resolveComplementExecutor` into a discriminated result

Example:

```ts
{ status: "resolved", reviewer } | { status: "inert", reason, bindsWhen }
```

Advantages:

- Lets the resolver own detailed null reasons.
- Prevents the cast seam from carrying resolution vocabulary.

Disadvantages:

- Changes the dependency ticket's settled public contract.
- Requires edits to `resolve-complement.ts` and all callers/tests.
- Broadens a marker-wiring ticket into resolution-policy redesign.
- The ticket explicitly identifies the seam “where resolution returns null.”

Decision: rejected for this slice. A richer resolver result can be a future refactor if consumers
need per-null-subcase diagnostics.

### Option E — Derive skipped review during ledger read

Infer `crossReviewSkipped` when a record has `capturedDiff` and `seatOfExecution` but lacks
`crossVendorVerdict`.

Advantages:

- No cast wiring change.
- Could retroactively classify historical lines.

Disadvantages:

- Historical absence is unknown, not proof that current policy attempted resolution.
- `--no-gates` casts would be falsely classified.
- Schema consumers would receive synthesized events that were never recorded.
- It violates append-only provenance: requested-versus-actual state should be stamped at the
  event boundary.

Decision: rejected.

## Run-log normalization design

Add `CrossReviewSkipped` locally in `src/log/run-log.ts`.

Add optional fields to both faces:

- `RunRecordInput.crossReviewSkipped?: CrossReviewSkipped`;
- `RunRecord.crossReviewSkipped?: CrossReviewSkipped`.

Implement `normalizeCrossReviewSkipped(value: unknown)`:

- require a non-null object;
- require non-empty string `reason`;
- require non-empty string `bindsWhen`;
- rebuild `{ reason, bindsWhen }` in deterministic order;
- drop all extra nested keys;
- return `undefined` for absent, partial, or malformed values.

Use the helper in `buildRunRecord` and `reviveRecord`.

Conditionally spread the normalized object adjacent to cross-review evidence fields. This preserves
the serialized shape exactly when absent.

Do not increment `RUN_LOG_SCHEMA_VERSION`. The change is additive and optional, matching the
repository's treatment of `seatDefaulted`, `seatInferred`, `seatOfExecution`, `capturedDiff`, and
`crossVendorVerdict`.

## Cast wiring design

Import `CrossReviewSkipped` as a type from run-log.

Add a local optional variable near `crossVendorVerdict`:

```ts
let crossReviewSkipped: CrossReviewSkipped | undefined;
```

Inside the existing applicability guard:

- resolve the reviewer exactly once;
- if it is non-null, preserve the existing review code unchanged;
- otherwise assign the fixed marker.

Forward the marker into `appendRunLog` through an omission-preserving conditional spread.

Do not add it to `RunSummary`. Acceptance requires a durable run record, and summary expansion
would create an unrequested API surface.

Do not add stdout. The ticket asks for ledger honesty; live UI behavior is not specified and would
broaden the surface.

## Byte compatibility

JavaScript property insertion order makes adding a conditional spread harmless when its value is
undefined: the key is absent and every later key retains the same relative order.

The negative integration assertions compare serialized record text against the same fixture with
the new key absent, or at minimum assert the raw JSON line lacks the key. A unit test pins an exact
pre-feature literal for the base record, following `seatDefaulted`.

Relevant skipped records intentionally change by gaining one object field. Reviewed records remain
unchanged and continue to carry `crossVendorVerdict` plus the cross-vendor gate row.

## Testing strategy

### Run-log unit tests

- Valid marker survives build and `readRuns`.
- Reserializing a revived valid marker is byte-stable.
- Absent marker serializes byte-identically to a pinned pre-feature record.
- Historical line revives without marker synthesis.
- Partial marker is omitted atomically.
- Extra nested fields are stripped.
- Malformed parsed metadata is dropped without losing the run.

### Cast integration tests

- Default one-seat resolution with a Claude author and captured diff stamps the exact marker.
- The same line has no `crossVendorVerdict` and no cross-vendor gate row.
- A lane-less author with a captured diff has no marker.
- A known-lane no-op/diff-less cast has no marker.
- Passing and refusing provisioned reviewer paths have no marker.
- All tests use local stubs and temporary Git repos; no metered call is needed.

## Risks and mitigations

- Risk: marker claims a reviewer is unprovisioned for every null subcase.
  - Mitigation: `reason` says only that no reviewer resolved; `bindsWhen` states the exact resolver
    capability condition.
- Risk: marker appears on irrelevant casts.
  - Mitigation: assign only inside the existing applicability guard and pin both boundary cases.
- Risk: malformed optional metadata makes ledger lines unreadable.
  - Mitigation: atomic tolerant normalization at the read boundary.
- Risk: skipped marker and verdict coexist.
  - Mitigation: assign them in opposite branches and assert absence on reviewed fixtures.
- Risk: source changes accidentally include Lisa-owned frontmatter/provenance files.
  - Mitigation: use exact `lisa commit-ticket --include` paths only.

## Acceptance mapping

- Schema declaration: `CrossReviewSkipped`, `RunRecordInput`, and `RunRecord`.
- Normalize and round-trip: one helper used by build and revive, with focused unit tests.
- Exact stamp condition: resolver-null branch inside the existing applicability guard.
- Lane-less compatibility: captured-diff fixture with executor id `stub`.
- Diff-less compatibility: no-op effect fixture.
- Full project gate: `bun run check` before final source commit and again before Review handoff.
