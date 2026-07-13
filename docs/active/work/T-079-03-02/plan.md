# Plan — T-079-03-02 settle rides the cord

## Step 1 — widen the pure settle contract

1. Import the seam parser, marker path, and marker type into `settle-core.ts`.
2. Split the refusal type into last-settle and loop-settled variants.
3. Add raw optional loop bytes to `ComputeSettleInput`.
4. Add optional typed loop provenance to `SettleVerdict`.
5. Parse the loop marker at the start of `computeSettleVerdict`.
6. Return an actionable refusal on malformed bytes.
7. Carry valid provenance unchanged into successful verdicts.

Verification:

- typecheck exposes all fixtures/callers missing the new input/result field;
- no effect import enters the pure file;
- existing last-settle refusal wording remains stable.

## Step 2 — pin the pure policy

1. Update the shared test input to default loop bytes to null.
2. Assert ordinary verdicts contain no loop provenance.
3. Supply the canonical seam fixture bytes and assert exact typed provenance.
4. Supply malformed JSON and a closed-schema mismatch.
5. Assert both are named `malformed-loop-settled-marker` refusals.
6. Assert no verdict fields are present on refusal.

Verification:

- `bun test src/settle/settle-core.test.ts` passes;
- all old delta/clearance/exception cases remain green.

## Step 3 — implement atomic claim lifecycle

1. Add a private claim helper in `settle.ts`.
2. Rename only the stable loop marker to a unique sibling; ENOENT means no claim.
3. Read bytes from the claimed name.
4. If reading fails, attempt non-clobbering restore before propagating.
5. Add restore via `link(claim, stable)` followed by claim unlink.
6. Treat EEXIST as a newer stable singleton and discard only the older claim.
7. Add successful consume by unlinking only the claim path.

Verification:

- no operation removes the stable path after it has been claimed;
- a producer replacement at the stable path cannot be deleted by finalization;
- absence remains normal optional state.

## Step 4 — join claim lifecycle to runSettle

1. Claim the optional marker before board/gate observation.
2. Pass claim bytes or null into `computeSettleVerdict`.
3. On typed refusal, restore the claim and return.
4. On verdict, atomically write the existing last-settle continuation.
5. Only after that write succeeds, remove the claim.
6. On any thrown failure, restore the claim before rethrowing.
7. Ensure restore/finalize happens at most once.

Verification:

- valid marker plus successful verdict leaves no stable or claim marker;
- gate-red verdict still consumes because observation completed;
- thrown failures preserve retryable pending state.

## Step 5 — render provenance

1. Insert the loop line immediately under the `settle` heading when `result.loop` is non-null.
2. Include the exact project, ticket count, and duration seconds.
3. Reuse count pluralization for `ticket`/`tickets`.
4. Omit the line entirely when no loop marker was pending.
5. Render malformed-loop refusals through the existing generic refusal path.

Verification:

- exact expected line is pinned;
- immediate repeat contains no `loop:` line;
- no ANSI behavior changes for exception/refusal rendering.

## Step 6 — direct settle effect tests

1. Add a minimal temporary fixture repository builder to `settle.test.ts`.
2. Create valid board files and a deterministic passing check script.
3. Initialize Git and commit the fixture baseline.
4. Write the canonical loop marker after baseline.
5. Call `runSettle({ root })` and assert provenance plus marker absence.
6. Call it again and assert `loop: null` and no marker.
7. In a separate fixture, write malformed marker bytes.
8. Assert refusal and byte-for-byte marker retention.
9. Clean every temporary root in `finally`.

Verification:

- `bun test src/settle` passes;
- tests exercise real gate and presweep effects without the live repository.

## Step 7 — commit settle consumer unit

Run targeted tests, inspect the scoped diff, then use:

```text
lisa commit-ticket --ticket-id T-079-03-02 \
  --message "feat(settle): consume Lisa loop provenance" \
  --include src/settle/settle-core.ts \
  --include src/settle/settle-core.test.ts \
  --include src/settle/settle.ts \
  --include src/settle/settle.test.ts
```

Do not stage or commit any other path.

## Step 8 — wire the existing complete event

1. Change the complete branch in `.lisa/hooks/on-notify` to test recorder success.
2. Locate `src/cli.ts` from the same project-relative hook root.
3. Invoke the existing `settle` command only after successful recording.
4. Preserve settle stdout/stderr.
5. Contain a nonzero settle result so the hook continues and ultimately exits 0.
6. Leave attention and ntfy content byte-for-byte unchanged.

Verification:

- no watcher/daemon/config is added;
- missing Bun/source retains safe behavior;
- local marker recording remains independent of ntfy topic.

## Step 9 — event-path acceptance test

1. Expand the real-hook fixture with the minimal board/check/Git baseline.
2. Copy the real hook and symlink repository `src` as before.
3. Invoke one `complete` event with known count and duration.
4. Assert hook exit 0 and provenance on stdout.
5. Assert `.vend/loop-settled.json` is absent afterward.
6. Invoke the CLI settle path a second time.
7. Assert the second output has no provenance line.
8. Assert no pending marker reappears.

Verification:

- `bun test src/seam/lisa-loop-settled.test.ts` passes;
- the test demonstrates marker creation, automatic firing, successful consumption, and non-refire.

## Step 10 — commit event seam unit

After targeted tests and scoped diff inspection, use:

```text
lisa commit-ticket --ticket-id T-079-03-02 \
  --message "feat(seam): trigger settle on Lisa completion" \
  --include .lisa/hooks/on-notify \
  --include src/seam/lisa-loop-settled.test.ts
```

No ordinary Git index operations are permitted.

## Step 11 — full verification

1. Run `bun test src/settle src/seam`.
2. Run `bun run check` as the repository gate.
3. Inspect `git status --short`.
4. Confirm ticket-owned source paths are clean.
5. Confirm pre-existing unrelated worktree paths remain untouched.
6. Record commit hashes, test counts, and any unrelated failures in `progress.md`.

If a failure is caused by concurrent unrelated work, rerun after checking ownership and document it
honestly. Do not modify another ticket's files to force green.

## Step 12 — review disposition

1. Compare behavior to every ticket acceptance clause.
2. Summarize modified files and lifecycle semantics in `review.md`.
3. Record test coverage and the fixture-driven honest boundary.
4. Name any crash-recovery or live-loop observation limitations without overstating them.
5. Write exactly `{"disposition":"pass","reason":null}` if all acceptance and the full gate pass.
6. Otherwise write a reasoned actionable block disposition.
7. Stop on this ticket after review; Lisa owns publication and completion.

## Acceptance trace

- Fixture marker present -> steps 2, 4, 6, and 9.
- Provenance line -> steps 1, 5, and 9.
- Marker consumed -> steps 3, 4, 6, and 9.
- Second settle none pending -> steps 5, 6, and 9.
- Event path fires automatically -> steps 8 and 9.
- Exactly once per marker -> atomic claim in step 3 plus repeat assertions in steps 6 and 9.
- Never re-fires consumed marker -> absence and second-invocation assertions in steps 6 and 9.
