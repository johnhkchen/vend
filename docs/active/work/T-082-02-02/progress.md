# Progress — T-082-02-02 quota-fraction lane heat

## Outcome

Implementation is complete. Learned-capacity ledgers now route the default seat by the unique lowest
quota fraction, produce percentage-based learned-window provenance, and carry that reason unchanged
into the terminal `seatInferred` ledger marker. Any unlearned known lane keeps the exact E-071
relative-burn fallback.

## Phase completion

- Research: complete in private `research.md`.
- Design: complete in private `design.md`.
- Structure: complete in private `structure.md`.
- Plan: complete in private `plan.md`.
- Implement: complete in two meaningful Lisa source transactions.
- Review: remains to be recorded after this progress artifact.

Lisa independently surfaced admitted phase artifacts under the shared work path during execution.
This worker wrote only the private attempt paths and did not add, edit, stage, or commit the shared
copies.

## Baseline

Before source edits:

```text
bun test src/play/lane-heat.test.ts
9 pass
0 fail
17 expect() calls
```

This established the dependency ticket's unmodified E-071 baseline.

## Implementation unit 1 — pure quota policy

Commit:

```text
cc2ab42cd45053cdb07b2cfb05cb6c69ded93242
feat(play): rank learned lane quota fractions
```

Exact Lisa includes:

```text
src/play/lane-heat.ts
src/play/lane-heat.test.ts
```

### `src/play/lane-heat.ts`

- Added the runtime import of `learnLaneCapacities`.
- Added type-only imports for the learned union narrowing.
- Kept `LANE_HEAT_WINDOW = 100` unchanged.
- Kept `HOT_LANE_RATIO = 2` unchanged.
- Kept the relative `heatReason` construction unchanged.
- Moved the E-071 body into private `inferByRelativeBurn` without policy edits.
- Added an explicit `status === "learned"` predicate.
- Added stable integer-percent display formatting.
- Added canonical registry-order quota evidence rendering.
- Added unique-minimum fraction ranking.
- Preserved fractions above one without clamping.
- Returned `null` for an equal minimum rather than breaking ties by registry order.
- Made `inferDefaultSeat` prefer quota ranking only when every known lane is learned.
- Made any incomplete learned set fall back to relative heat.
- Kept the exported signature and frozen result shape unchanged.
- Updated comments to describe the two evidence rungs.

### Exact quota reason

The acceptance fixture renders:

```text
learned quota fraction: claude at ~85% of learned window; codex at ~20% of learned window; routing to codex
```

The reason enumerates all learned lanes in canonical order and explicitly names the selected seat.

### `src/play/lane-heat.test.ts`

All nine pre-existing tests and their assertions remain textually unchanged. Five additive tests now
cover the learned path:

1. Fraction ranking overrules contradictory raw-burn ranking.
2. Ranking is symmetric when the other lane has more headroom.
3. Equal fractions remain unrouted despite unequal absolute burn.
4. A partially learned registry preserves the exact relative reason.
5. Above-100% fraction evidence remains unclamped in ranking and provenance.

The primary fixture learns:

```text
claude capacity 100, current burn 85   -> 85%
codex  capacity 1000, current burn 200 -> 20%
```

Its aggregate raw ledger burn is the opposite ordering:

```text
claude 185
codex  1200
```

This makes the test discriminate quota policy from the old relative algorithm.

## Focused verification after unit 1

```text
bun test src/play/lane-heat.test.ts
14 pass
0 fail
26 expect() calls

bun run build
tsc --noEmit
exit 0
```

`git diff --check` passed before the Lisa commit.

## Implementation unit 2 — verbatim ledger propagation proof

Commit:

```text
752650b047629a8c49e0eca3c218146d2676a458
test(engine): prove quota reason ledger propagation
```

Exact Lisa include:

```text
src/engine/cast.test.ts
```

### `src/engine/cast.test.ts`

- Added a narrow `writeLaneQuota` fixture beside the existing relative `writeLaneHeat` helper.
- Wrote normalized cap-boundary and current-burn records to `DEFAULT_RUN_LOG_PATH`.
- Reused the same 85%-versus-20% geometry as the pure test.
- Drove the existing BAML-free play through real `decomposeEffect`.
- Drove materialization through the real ticket writer.
- Drove settlement through the real cast shell.
- Drove marker normalization and serialization through the real run log.
- Asserted both materialized tickets receive `agent: codex` exactly once.
- Asserted exact `seatInferred` object equality in the terminal ledger row.
- Asserted `reviveRecord` preserves the marker unchanged.
- Asserted no `seatDefaulted` marker is present.

No production consumer was changed. The test proves the already-existing chain copies the new reason
verbatim:

```text
inferDefaultSeat
  -> decomposeEffect result
  -> cast settlement state
  -> terminal RunRecord input
  -> serialized seatInferred marker
```

## Focused verification after unit 2

```text
bun test src/engine/cast.test.ts
28 pass
0 fail
288 expect() calls

bun test src/play/lane-heat.test.ts
14 pass
0 fail
26 expect() calls
```

The existing exact relative cast reason, both-cool behavior, explicit override behavior, and chain
behavior all remained green.

`git diff --check` passed before the second Lisa commit.

## Repository gate

Command:

```text
bun run check
```

Result:

```text
BAML generation: pass (14 generated files checked, no residual source diff)
TypeScript: pass (`tsc --noEmit`)
Tests: 1978 pass, 1 expected skip, 0 fail
Assertions: 6495
Files: 127
Elapsed test time: 9.42s
Command exit: 0
```

The one skip is the established dist acceptance test when no `dist/` artifacts are present.

## Scope audit

Ticket-owned committed paths:

```text
src/play/lane-heat.ts
src/play/lane-heat.test.ts
src/engine/cast.test.ts
```

No changes were made to:

- `src/play/lane-capacity.ts`;
- `src/play/decompose-effect.ts`;
- `src/engine/cast.ts`;
- `src/log/run-log.ts`;
- any ledger schema or version;
- budget or wallet algebra;
- executor behavior;
- provider APIs;
- materializer production code;
- ticket phase/status by this worker.

## Worktree audit

All three ticket-owned source paths are clean after the Lisa commits.

Remaining status is orchestration/publication-owned:

```text
M  .lisa/provenance.jsonl
M  docs/active/tickets/T-082-02-02.md
?? docs/active/work/T-082-02-02/
```

Those paths were present or created by Lisa phase detection/publication and were deliberately left
out of both exact source transactions.

## Deviations from plan

No material implementation deviation.

- The pure policy and integration proof landed in the planned two commit units.
- The planned all-learned guard, unique-minimum policy, exact reason, and tests were implemented.
- All planned focused and repository-wide checks ran successfully.
- Lisa published shared phase artifacts while work continued; this was orchestration behavior, not a
  worker write, and required no corrective action.

## Remaining work

- Write the private Review handoff.
- Write the required `review-disposition.json`.
- Stop on this ticket and await Lisa completion handling.
