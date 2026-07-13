# Plan — T-077-03-02

## Objective

Land a committed pure-core regression test proving that the live turn fraction uses deduplicated
assistant/model turns over `maxTurns`, and never substitutes Claude's larger terminal `num_turns`.

## Preconditions confirmed

- Parent story `S-077-03` has been read.
- Ticket `T-077-03-02` has been read.
- Dependency story, ticket, and review for `T-077-01-01` have been read.
- The earlier `T-072-04-01` summary diagnosis and invariant have been traced.
- `formatCastProgress`, `accumulateCastProgress`, and the `castPlay` call site have been inspected.
- `src/engine/cast-core.test.ts` is clean before implementation.
- Existing dirty worktree paths belong to Lisa or concurrent work and are outside this ticket.

## Step 1 — Add the regression fixture

Modify `src/engine/cast-core.test.ts` in the existing `cast progress` describe block.

Add a test named for `T-077-03-02` and the live unit contract.

Inside it:

1. Set `maxTurns` to 15.
2. Set the external executor count to 23.
3. Build two distinct assistant turns with one duplicate raw assistant event.
4. Add a terminal result carrying `num_turns: 23`.
5. Reduce all messages through `accumulateCastProgress` from `EMPTY_CAST_PROGRESS`.

Independent verification after the edit:

- inspect the diff for only the intended test;
- confirm no new production import or helper is needed.

## Step 2 — Assert the counter facts

Within the same test, assert:

- the deduplicated live count is two;
- two is at or below the cap of fifteen;
- the executor terminal count of twenty-three is above that cap.

These assertions make the positive and negative unit cases explicit before presentation is tested.

Independent verification:

- the duplicate fixture would fail `progress.turns === 2` if raw events were counted;
- the executor contrast would fail if the forbidden fraction were not actually over-cap.

## Step 3 — Assert the live formatter output

Format the reduced progress with deterministic elapsed time, token envelope, and `maxTurns`.

Assert the exact line:

`elapsed 4m12s · 60k/500k tokens · turn 2/15`

Then assert the line does not contain the compact live fraction `23/15` assembled from the named
executor count and cap constants.

This is the direct extension of T-072-04's negative summary invariant to the live line's grammar.

Independent verification:

- exact equality proves the positive numerator source;
- negative containment proves the unlike external counter is absent.

## Step 4 — Run focused verification

Run:

`bun test src/engine/cast-core.test.ts`

Expected result:

- all tests in the file pass;
- no TypeScript parse or type errors;
- the new regression adds one passing test.

If it fails:

- inspect whether the failure is fixture typing, expected token formatting, or a real unit mismatch;
- change only ticket-owned test code unless current behavior contradicts the story;
- record any design deviation before production changes.

## Step 5 — Inspect ticket diff

Run a path-scoped diff for `src/engine/cast-core.test.ts`.

Verify:

- one new test only;
- no formatting churn;
- no adjacent test semantics changed;
- no production file changed;
- test names and comments state the two counter units precisely.

## Step 6 — Run the authoritative gate

Run:

`bun run check`

Expected result:

- BAML generation succeeds;
- typecheck succeeds;
- full test suite succeeds;
- only any already-declared skip remains.

The gate must be green before committing.

If unrelated shared-worktree work causes a failure, rerun or isolate only when evidence warrants it.
Do not modify concurrent paths. Record a persistent external failure honestly in progress and review.

## Step 7 — Record implementation progress

Create `progress.md` in the attempt-private work directory.

Record:

- completed phase checklist;
- exact source change;
- focused verification result;
- full-gate result;
- deviations, if any;
- intended exact commit path.

Update it again after commit with the commit hash and isolation inspection.

## Step 8 — Commit the meaningful source unit

Confirm Lisa CLI syntax with:

`lisa commit-ticket --help`

Commit only after `bun run check` is green. Use the exact repository-relative include:

```text
lisa commit-ticket \
  --ticket-id T-077-03-02 \
  --message "test(engine): pin live turn fraction units" \
  --include src/engine/cast-core.test.ts
```

Use the actual positional/flag syntax shown by installed Lisa if it differs, while retaining the
same ticket ID, message, and exact single include.

Do not use:

- `git add`;
- `git add -A`;
- `git commit`;
- any include for Lisa metadata, ticket markdown, concurrent source, or shared work artifacts.

## Step 9 — Verify commit isolation

Inspect the resulting commit.

Verification criteria:

- commit message matches the planned test unit;
- exactly `src/engine/cast-core.test.ts` is present;
- the owned test path is no longer modified or staged;
- unrelated pre-existing worktree changes remain outside the commit;
- no attempt-private artifact was committed as source.

If Lisa updates its own metadata as part of lease/provenance handling, leave that metadata to Lisa.

## Step 10 — Review acceptance

Write `review.md` covering:

- outcome;
- source diff;
- why the fixture proves deduped agent turns;
- why `num_turns` is a meaningful negative control;
- focused and full test results;
- commit method and exact include;
- honest limitations and open concerns;
- criterion-by-criterion acceptance assessment.

## Step 11 — Write disposition

Write exactly one of:

```json
{"disposition":"pass","reason":null}
```

when acceptance is met, the source unit is committed, and the full gate is green;

or:

```json
{"disposition":"block","reason":"<non-empty actionable reason>"}
```

when a real blocker remains.

The file path is:

`.lisa/attempts/T-077-03-02/1/work/review-disposition.json`

## Test coverage map

| Acceptance fact | Test mechanism |
|---|---|
| Live numerator is agent turns | Reduce assistant messages through `accumulateCastProgress` |
| Repeated stream blocks are deduplicated | Repeat `turn-1`, assert only two turns total |
| Denominator is `maxTurns` | Pass 15 to `formatCastProgress`, assert `turn 2/15` |
| Numerator is within cap | Assert `progress.turns <= maxTurns` |
| Executor `num_turns` is unlike and over-cap | Terminal result/local constant is 23; assert 23 > 15 |
| Live line never pairs executor count with cap | Assert output does not contain `23/15` |
| No production regression elsewhere | `bun run check` |

## Definition of done

- All six RDSPI phase artifacts exist in the private attempt directory.
- The required review disposition file exists with the exact schema.
- One focused regression test pins the full acceptance criterion.
- No production behavior changes.
- Focused test suite passes.
- `bun run check` passes.
- The exact source path is committed through `lisa commit-ticket`.
- No ticket-owned source remains modified, staged, or untracked.
- Review is honest about any limitations.
