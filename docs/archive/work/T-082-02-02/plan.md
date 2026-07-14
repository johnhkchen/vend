# Plan — T-082-02-02 quota-fraction lane heat

## Preconditions

1. Preserve Lisa-owned modifications to `.lisa/provenance.jsonl` and the ticket file.
2. Keep all phase artifacts in the generation-1 private attempt directory.
3. Do not edit ticket frontmatter.
4. Do not use the ordinary Git index workflow.
5. Use only exact-path `lisa commit-ticket` transactions for source changes.

## Step 1 — establish the fallback baseline

Run:

```bash
bun test src/play/lane-heat.test.ts
```

Record the current passing count. This establishes that the dependency ticket did not already alter
E-071 heat behavior and gives a comparison point after dispatch is added.

Verification:

- all current lane-heat tests pass;
- no source changes occur;
- current exact relative reason remains known.

## Step 2 — restructure relative inference without behavior change

In `src/play/lane-heat.ts`:

1. Update the module header to name relative burn as the fallback rung.
2. Keep `LANE_HEAT_WINDOW` unchanged at 100.
3. Keep `HOT_LANE_RATIO` unchanged at 2.
4. Keep `LaneBurn` unchanged.
5. Keep `heatReason` byte-identical.
6. Move the existing `inferDefaultSeat` body into `inferByRelativeBurn`.
7. Do not modify any branch or comparison inside the moved body.

Intermediate verification:

```bash
bun test src/play/lane-heat.test.ts
```

Expected: the baseline count and all assertions remain green.

## Step 3 — add learned quota dispatch

In `src/play/lane-heat.ts`:

1. Import `learnLaneCapacities`.
2. Import the capacity union/member types needed for narrowing.
3. Add `isLearned` as a discriminant predicate.
4. Add an unclamped integer percentage formatter.
5. Add a canonical-order quota reason renderer.
6. Add `inferByQuotaFraction` over learned facts.
7. Guard fewer than two lanes.
8. Sort a copy ascending by `quotaFraction`.
9. Reject a non-unique minimum.
10. Return the unique coolest lane and frozen reason object.
11. Make exported `inferDefaultSeat` call the learner once.
12. Use quota ranking only when every capacity is learned.
13. Otherwise call `inferByRelativeBurn(records)`.
14. Update the exported doc comment to describe both rungs.

Review checks:

- no fraction is synthesized for an unlearned value;
- no fraction is clamped;
- no raw-burn ratio is applied on the learned path;
- no caller-visible signature changes;
- no mutation of learned results.

## Step 4 — add pure quota fixtures

In `src/play/lane-heat.test.ts`:

1. Leave every pre-existing test body unchanged.
2. Add `QUOTA_BASE` and a settled cap marker constant.
3. Add a timestamp helper.
4. Add a normalized quota-record builder.
5. Add a helper for a pair of cap markers plus current burn per lane if it improves readability.

Fixture rules:

- use `buildRunRecord`;
- use fabricated token values only;
- use explicit valid ISO timestamps;
- use canonical known seats;
- use capped outcomes only for marker records;
- avoid fs, current clock, or executor work.

## Step 5 — prove quota ranking differs from raw heat

Add a test with:

- first lane learned capacity 100 and current burn 85;
- second lane learned capacity 1000 and current burn 200;
- first fraction 85%;
- second fraction 20%;
- first total raw ledger burn 185;
- second total raw ledger burn 1200.

Assertions:

- selected seat is the second lane;
- exact reason is:

```text
learned quota fraction: claude at ~85% of learned window; codex at ~20% of learned window; routing to codex
```

- the acceptance phrase appears verbatim;
- the result is frozen if worth pinning alongside existing convention.

This test fails any implementation that continues ranking raw burn.

## Step 6 — cover learned decision edges

Add focused tests for:

1. Symmetry: reverse the fractions and select the first lane.
2. Tie: equal fractions with unequal capacities/raw burn return `null`.
3. Partial evidence: one learned lane plus one unlearned lane yields exact relative fallback bytes.
4. Overage: a greater-than-one fraction remains hotter and is not clamped to 100%.

Avoid duplicate assertions already owned by `lane-capacity.test.ts`; lane heat needs to prove policy
consumption, not re-test every learning calculation.

## Step 7 — focused pure verification

Run:

```bash
bun test src/play/lane-heat.test.ts
bun run build
```

Inspect failures for:

- TypeScript narrowing across the readonly union array;
- timestamp interval boundary ownership;
- exact percentage rounding;
- changed relative reason bytes.

If fixture geometry is wrong, correct fixture timestamps/tokens without changing settled capacity
semantics.

## Step 8 — commit pure policy unit

Confirm only the intended two source paths are included, then run:

```bash
lisa commit-ticket \
  --ticket-id T-082-02-02 \
  --message "feat(play): rank learned lane quota fractions" \
  --include src/play/lane-heat.ts \
  --include src/play/lane-heat.test.ts
```

Do not include attempt artifacts or orchestration-owned changes.

Post-commit checks:

- both included source paths are clean;
- Lisa-owned dirty paths remain present and untouched;
- HEAD contains the pure policy commit.

## Step 9 — add learned ledger integration fixture

In `src/engine/cast.test.ts`:

1. Add `writeLaneQuota(root)` beside `writeLaneHeat`.
2. Reuse `buildRunRecord`, `serializeRunRecord`, and `DEFAULT_RUN_LOG_PATH`.
3. Create `.vend` before writing.
4. Write two cap boundaries and one current row for each canonical lane.
5. Use the primary 85%-versus-20% geometry.
6. Keep the original `writeLaneHeat` helper unchanged.

Avoid making a general fixture framework; this is one narrow acceptance proof.

## Step 10 — add end-to-end marker test

Add a sibling to the current omitted-agent test:

1. Create a temporary root.
2. Call `writeLaneQuota`.
3. Cast the BAML-free `seatDefaultPlay` with no explicit agent.
4. Use a separate output ledger path.
5. Assert `success`.
6. Assert both materialized tickets carry the quota-selected agent once.
7. Parse the one terminal output row.
8. Assert exact `seatInferred` object equality.
9. Assert `reviveRecord(record)?.seatInferred` equals the raw marker.
10. Assert `seatDefaulted` is absent.

This proves the reason flows:

```text
inferDefaultSeat -> decomposeEffect -> EffectResult -> cast settlement -> serialized RunRecord
```

without any production consumer edit.

## Step 11 — focused integration verification

Run the narrow named test if Bun's filter is convenient, then the file:

```bash
bun test src/engine/cast.test.ts
```

Also rerun:

```bash
bun test src/play/lane-heat.test.ts
```

Verification:

- quota marker is exact;
- old relative integration reason remains exact;
- explicit-agent override still emits no inferred marker;
- both-cool fallback still emits no inferred marker;
- chain behavior remains green.

## Step 12 — commit propagation proof

Run:

```bash
lisa commit-ticket \
  --ticket-id T-082-02-02 \
  --message "test(engine): prove quota reason ledger propagation" \
  --include src/engine/cast.test.ts
```

Post-commit checks:

- `src/engine/cast.test.ts` is clean;
- no ticket-owned source remains modified or untracked;
- orchestration-owned dirty paths are still untouched.

## Step 13 — repository gate

Run the required completion gate:

```bash
bun run check
```

The command includes BAML codegen, TypeScript checking, and the full suite. Do not bypass or replace
it with focused tests.

If generated files change unexpectedly:

- inspect ownership and diff;
- do not absorb unrelated generated changes into ticket commits;
- only commit a generated path if the ticket genuinely owns and requires it.

## Step 14 — diff and scope audit

Inspect:

```bash
git status --short
git show --stat --oneline HEAD
git diff HEAD~2..HEAD -- src/play/lane-heat.ts src/play/lane-heat.test.ts src/engine/cast.test.ts
```

Audit against the story:

- only lane heat policy changed;
- only tests changed outside that module;
- no ledger schema change;
- no consumer production change;
- no wallet/budget/executor change;
- no ticket frontmatter edit by this worker;
- relative fallback reason is byte-identical.

## Step 15 — progress artifact

Write `progress.md` in the private attempt directory containing:

- completed steps;
- commit ids and exact includes;
- focused test results;
- full check result;
- any deviations and rationale;
- remaining work, expected to be Review only.

## Step 16 — review artifact

Write `review.md` in the private attempt directory containing:

- concise outcome;
- file-by-file changes;
- policy semantics;
- exact fallback behavior;
- provenance propagation evidence;
- test coverage and results;
- scope audit;
- limitations and open concerns;
- acceptance checklist;
- final pass/block assessment.

## Step 17 — review disposition

If all acceptance and gates pass, write exactly:

```json
{"disposition":"pass","reason":null}
```

If a real blocker remains, write exactly the block form with a non-empty actionable reason. Both
Review artifacts are mandatory.

## Step 18 — stop condition

After Review:

- remain on `T-082-02-02`;
- do not start another ticket;
- do not publish attempt artifacts manually;
- do not modify ticket phase/status;
- wait for Lisa to verify the lease and create the completion commit.

## Acceptance trace

| Acceptance condition | Implementation | Verification |
|---|---|---|
| Rank learned lanes by quota fraction | Steps 3 and 5 | contradictory raw-vs-fraction fixture |
| Reason reads `~85% of learned window` | Step 3 formatter | exact pure and integration assertions |
| Reason flows verbatim into marker | unchanged consumers | Step 10 settled-record equality |
| Unlearned capacity uses relative fallback | all-learned guard | unchanged old suite plus partial case |
| E-071 behavior byte-compatible | untouched relative helper/reason | unchanged existing assertions |
| No invented provider quota | union narrowing | partial-evidence test and scope review |
| Repository gate green | no shortcuts | `bun run check` |
