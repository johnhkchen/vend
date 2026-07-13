# Plan — T-082-02-01 learned-window-capacity

## Execution constraints

- Continue directly from Plan into Implement and Review.
- Keep all phase artifacts in this attempt-private work directory.
- Do not change ticket phase/status frontmatter.
- Preserve pre-existing Lisa-managed worktree changes.
- Create only the two ticket-owned source paths named in Structure.
- Use `apply_patch` for source edits.
- Do not use ordinary Git staging or commit commands.
- Run the full repository gate before the Lisa commit.
- Commit with exact repeated `--include` paths only.
- Finish with both required Review artifacts and then stop on this ticket.

## Step 1 — add the pure result contract and evidence projection

Create `src/play/lane-capacity.ts`.

1. Add the module header describing:
   - pure local-ledger learning;
   - cap-to-cap evidence;
   - canonical cost-weighted burn;
   - explicit unlearned behavior;
   - no fs, clock, or provider access.
2. Import `totalTokens` and `RunRecord` from run-log.
3. Import `KNOWN_SEATS` and `AgentSeat` from agent-seat.
4. Define exported learned, unlearned, and union result types.
5. Define private timestamped-record and window-sample shapes.
6. Add a timestamp projection that:
   - parses each `endedAt` once;
   - drops non-finite timestamps;
   - retains original index;
   - sorts by time and then index without mutating input.

Verification after Step 1:

- `bun run check:typecheck` may still fail if the exported function is not yet present, so complete
  the production module before treating typecheck as a gate.
- Manually inspect imports to confirm no impure dependency.

## Step 2 — implement adjacent-cap sampling

Within `src/play/lane-capacity.ts`:

1. Add a `burnBetween` helper over one lane's ordered observations.
2. Use the exact predicate `at > lowerExclusive && at <= upperInclusive`.
3. Sum `totalTokens(record)` without rounding.
4. Add a sample builder that filters cap-marked lane observations.
5. Walk adjacent cap rows in order.
6. Skip equal or backwards timestamp pairs.
7. Create a sample with positive duration and interval burn for every valid pair.
8. Add a small arithmetic mean helper for non-empty numeric arrays.

Verification after Step 2:

- Review boundary ownership on paper with three cap markers.
- Confirm the earlier cap row is not included in its following sample.
- Confirm the later cap row is included in the sample it exhausts.
- Confirm no marker string policy has leaked into the learner.

## Step 3 — implement learned/unlearned lane results

Within `src/play/lane-capacity.ts`:

1. Add a private per-lane learner.
2. Return frozen `insufficient-cap-evidence` when no valid samples exist.
3. Average sample duration into `windowMs`.
4. Average sample burn into `windowCapacity`.
5. Return frozen `non-positive-capacity` unless the capacity is positive and finite.
6. Compute the rolling current lower bound from global ledger `asOf - windowMs`.
7. Reuse `burnBetween` for current lane burn.
8. Compute the unclamped quota fraction.
9. Return a frozen learned object including sample count.
10. Add `learnLaneCapacities(records)`:
    - build ordered valid observations once;
    - derive global as-of from the last ordered observation;
    - map every `KNOWN_SEATS` entry through the per-lane learner;
    - freeze the resulting array.

Verification after Step 3:

- `bun run check:typecheck`
- Inspect inferred return types for proper discriminated narrowing.
- Confirm the unlearned object has no optional numeric placeholders.
- Confirm the empty-ledger path is total.

## Step 4 — add fabricated acceptance fixtures

Create `src/play/lane-capacity.test.ts`.

1. Import `bun:test`, the learner, canonical seats, and run-record fixture types/helpers.
2. Guard that at least two known seats exist, matching the established lane-heat test style.
3. Add a deterministic record builder with complete cap markers.
4. Create a primary two-lane timeline with two cap markers per lane.
5. Use output/cache or clearly separated input values so weighted burn is hand-verifiable.
6. Advance global ledger time with ordinary rows.
7. Assert for each lane:
   - `status`;
   - `windowMs`;
   - `windowCapacity`;
   - `currentBurn`;
   - `quotaFraction`;
   - `samples`.

Verification after Step 4:

```bash
bun test src/play/lane-capacity.test.ts
```

Expected: primary acceptance fixture passes for both lanes with exact numeric values.

## Step 5 — cover explicit unlearned and evidence edges

Extend `src/play/lane-capacity.test.ts` with focused tests.

1. Empty/no-cap ledger:
   - one result per known seat;
   - exact unlearned branch;
   - learned numeric keys absent.
2. Single cap marker:
   - insufficient evidence because cadence is not known.
3. Equal/invalid cap timestamps:
   - no positive interval;
   - no `NaN` or invented number.
4. Zero-burn interval:
   - explicit non-positive-capacity result.
5. Multiple intervals:
   - average duration and burn;
   - sample count equals adjacent valid pairs.
6. Unknown raw seat:
   - no output entry and no contribution to known-lane capacity.
7. Ordering/immutability:
   - out-of-time-order input learns correctly;
   - input order remains unchanged;
   - output array and members are frozen;
   - returned seats follow `KNOWN_SEATS`.

Verification after Step 5:

```bash
bun test src/play/lane-capacity.test.ts
bun run check:typecheck
```

Expected: all new branches green and strict TypeScript green.

## Step 6 — review source scope and diff hygiene

Before the repository-wide gate:

1. Run `git diff --check` for whitespace errors.
2. Run `git diff -- src/play/lane-capacity.ts src/play/lane-capacity.test.ts`.
3. Confirm exactly the two planned files are ticket-owned and untracked/modified.
4. Run `git status --short` and distinguish Lisa-managed pre-existing paths from ticket paths.
5. Confirm no ordinary index entries exist for ticket-owned paths.
6. Confirm no change to lane heat, run log, budget, wallet, or engine code.

No commit occurs if scope is wider than the two exact planned source paths.

## Step 7 — run the full completion gate

Run:

```bash
bun run check
```

The gate must prove:

- BAML generation succeeds;
- TypeScript succeeds;
- the new focused suite succeeds;
- all existing suites remain green;
- no lane-heat fallback behavior has changed because its files were untouched.

If the gate fails:

1. Diagnose only failures caused by ticket-owned changes.
2. Patch the smallest owned source unit.
3. Rerun focused tests when relevant.
4. Rerun the full gate until green.
5. Record any deviation or unrelated blocker honestly in `progress.md`.

## Step 8 — commit the meaningful source unit through Lisa

After a green full gate, run exactly one Lisa transaction:

```bash
lisa commit-ticket \
  --ticket-id T-082-02-01 \
  --message "feat(play): learn lane window capacity" \
  --include src/play/lane-capacity.ts \
  --include src/play/lane-capacity.test.ts
```

The two paths are one atomic behavior-plus-proof unit.

Post-commit verification:

1. Capture the returned commit identifier.
2. Inspect `git show --stat --oneline HEAD`.
3. Inspect `git show --format= --name-only HEAD`.
4. Confirm the commit contains only the two exact source paths.
5. Confirm both ticket-owned paths are clean/untracked no longer.
6. Confirm pre-existing Lisa-managed changes remain present and unstaged.

## Step 9 — write implementation progress

Create/update `.lisa/attempts/T-082-02-01/1/work/progress.md` with:

- the implemented public contract;
- the cap interval and current rolling-window semantics;
- tests added and branches covered;
- focused-test result;
- full-gate result;
- exact Lisa commit command/paths and commit ID;
- worktree scope confirmation;
- deviations from Plan, if any;
- remaining work (Review only).

Because private artifacts are Lisa-published, do not include `progress.md` in the source commit.

## Step 10 — perform self-review

Review the committed diff, not only the working copy.

1. Re-read ticket and story acceptance.
2. Inspect every line in the committed production/test diff.
3. Verify the pure-module boundary from imports and behavior.
4. Verify explicit unlearned results contain no numeric quota fields.
5. Recompute primary fixture values by hand.
6. Verify cap-boundary inclusion/exclusion is documented and tested.
7. Verify cadence and accumulated sample behavior are covered.
8. Verify no values are clamped or invented.
9. Verify full gate remains green after the commit.
10. Note honest limitations:
    - result is current as of latest ledger evidence;
    - live history may remain dormant until repeated cap events accrue;
    - adjacent cap events are treated as observed window samples;
    - heat integration belongs to the dependent ticket.

## Step 11 — write required Review artifacts

Create `.lisa/attempts/T-082-02-01/1/work/review.md` summarizing:

- exact files created;
- API and learned/unlearned semantics;
- interval/current calculations;
- test coverage and results;
- commit method and scope;
- open concerns and deferred work;
- explicit acceptance disposition.

Then create `.lisa/attempts/T-082-02-01/1/work/review-disposition.json`.

If all acceptance and gates are satisfied, its entire contents must be:

```json
{"disposition":"pass","reason":null}
```

If a real blocker remains, write `block` with a non-empty actionable reason instead. Never soften a
red outcome into pass.

## Step 12 — final state check and stop

1. Confirm all six phase artifacts exist in the attempt directory.
2. Confirm the disposition JSON parses and has exactly the required keys/values.
3. Run `git status --short` one final time.
4. Confirm no ticket-owned file is staged, modified, or untracked.
5. Do not start `T-082-02-02`.
6. Stop on this ticket and wait for Lisa to admit artifacts and create the completion commit.

## Plan completion criteria

Implementation is ready for Review only when:

- both source files exist and no other source file changed for this ticket;
- fabricated cap-marked ledgers prove each lane's hand-computed learned facts;
- no-cap and insufficient evidence are explicit unlearned branches without numbers;
- the module has no fs, current-clock, provider, executor, or network access;
- focused tests pass;
- `bun run check` passes;
- the exact two-path source unit is committed through `lisa commit-ticket`;
- ticket-owned source paths are clean afterward.
