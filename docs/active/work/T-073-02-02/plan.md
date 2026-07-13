# T-073-02-02 — Plan

## Implementation sequence

### 1. Create the standalone acceptance test shell

- Add `src/engine/cross-review-refusal.e2e.test.ts`.
- Import only exported production contracts and standard/Bun test utilities.
- Add temp-directory cleanup and Git initialization helpers.
- Establish a generous fixed budget.

Verification:

- The file typechecks with strict TypeScript.
- The temp repository has a real HEAD without depending on global Git identity.
- Cleanup always removes the temporary worktree.

### 2. Add the artifact-producing play fixture

- Define the bad/good parsed output union.
- Render a deterministic fixture prompt.
- Parse the author stub's JSON reply.
- Return one named passing ordinary gate.
- Write a TypeScript evidence artifact with visibly defective or corrected bytes.
- Report the absolute path through `EffectResult.artifacts`.

Verification:

- Bad and good casts generate non-empty captured diff references.
- Captured prompt text can distinguish the actual patch bytes.
- The ordinary gate row is identical and passing for both cases.

### 3. Add typed executor doubles

- Build an author double with executor id `claude`.
- Build a two-seat registry containing Claude and OpenAI-compatible ids.
- Prime the complement with a reasoned FAIL followed by PASS.
- Record every complement `DispenseOptions` call.
- Throw if the production path asks for more review responses than supplied.

Verification:

- Complement resolution produces the Codex reviewing seat.
- Exactly two review calls occur.
- Each review has `maxTurns: 1`.
- Both doubles report zero usage and cost.

### 4. Drive the bad cast

- Use run id `cross-review-bad`.
- Inject the bad author result and shared review registry.
- Await the complete `castPlay` call with no intermediate input or approval.
- Assert the returned outcome is `gate-failed`, explicitly not `success`.
- Assert the captured diff reference exists.

Verification:

- The first review prompt contains the intentionally bad evidence bytes.
- The cast completes without network or human interaction.

### 5. Drive the good cast

- Use run id `cross-review-good`.
- Inject the good author result and the same queued review registry.
- Await the complete `castPlay` call.
- Assert the returned outcome is `success`.
- Assert the captured diff reference exists.

Verification:

- The second review prompt contains the corrected evidence bytes.
- It follows the same production path as the refused cast.

### 6. Assert the durable two-line contrast

- Read and parse the shared JSONL ledger.
- Assert exactly two records in cast order.
- Match the bad record's run id, final outcome, execution seat, verdict, and gate rows.
- Match the good record's corresponding success facts.
- Assert authoring/reviewing seat provenance on both verdicts.
- Assert fail detail is retained and pass does not invent detail.

Verification:

- No bad ledger line reports success.
- Both records retain the cross-vendor verdict that caused/preserved settlement.
- Ledger cardinality remains one line per cast.

### 7. Run focused verification

Command:

```bash
bun test src/engine/cross-review-refusal.e2e.test.ts
```

Pass condition:

- The new scenario passes deterministically.
- No test invokes a live vendor endpoint.
- No temp files survive cleanup.

### 8. Run repository verification

Command:

```bash
bun run check
```

Pass condition:

- BAML generation succeeds.
- Strict TypeScript checking succeeds.
- The complete Bun test suite is green.

### 9. Review source ownership and diff

- Inspect `git status --short`.
- Inspect the new test diff.
- Confirm no production source was changed.
- Confirm Lisa-managed ticket/provenance modifications remain untouched.
- Confirm no ticket-owned path is staged in the ordinary index.

### 10. Commit the meaningful source unit

Use only:

```bash
lisa commit-ticket \
  --ticket-id T-073-02-02 \
  --message "test(engine): prove cross-review refusal end to end" \
  --include src/engine/cross-review-refusal.e2e.test.ts
```

Pass condition:

- Lisa creates the ticket source commit.
- The included source path is clean afterward.
- No unrelated or private attempt file is included.

### 11. Complete implementation tracking

- Write `progress.md` in the private attempt directory.
- Record completed steps, commands, test results, commit id, and any deviations.
- Do not publish it directly to `docs/active/work/`.

### 12. Complete review

- Write `review.md` in the private attempt directory.
- Summarize the new proof and exact source file.
- Map assertions to the ticket acceptance criterion.
- State test coverage and honest limitations.
- State whether the full gate passed and whether concerns remain.
- Stop on this ticket after the artifact is complete.

## Testing strategy

### End-to-end coverage

The new test is intentionally broad. It tests exported orchestration and durable filesystem
outcomes rather than mocking internal settlement functions.

### Existing lower-level coverage retained

- Pure settlement branching remains pinned in `cast-core.test.ts`.
- Review parsing/dispense remains pinned in `cross-review/review.test.ts`.
- Run-log normalization remains pinned in `run-log.test.ts`.
- Focused fail/pass/inert cast behavior remains pinned in `cast.test.ts`.

### Failure diagnostics

- A missing Git diff fails captured-reference and prompt assertions.
- Wrong complement routing fails call count and seat assertions.
- Missing enforcement fails the bad summary/ledger outcome assertions.
- Dropped verdict data fails exact ledger matches.
- Double logging fails the exact two-line assertion.
- Reviewer interaction changes fail the one-turn assertion.

## Deviation policy

If production code must change, record why in `progress.md` before editing and rerun the full gate.
If the acceptance cannot be demonstrated honestly, leave review red and stop rather than weakening
assertions. No scope expansion into live metered proof or new executor configuration is authorized.
