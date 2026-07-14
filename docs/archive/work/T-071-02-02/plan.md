# Plan — T-071-02-02

## Objective

Add an optional, atomic `seatInferred` provenance marker to the run-log’s write and read contracts,
prove valid round-trip plus absent/malformed byte compatibility, pass the full repository gate, and
commit only the two ticket-owned source files through Lisa.

## Preconditions

- Parent story `S-071-02` has been read and bounds this ticket to marker schema work.
- Dependency `T-071-01-01` is present in the current source as `seatOfExecution` support.
- Sibling `T-071-02-01` already defines inference results as `{ seat, reason }`.
- `src/log/run-log.ts` and `src/log/run-log.test.ts` are clean before implementation.
- Unrelated worktree changes exist and must not be staged, reverted, formatted, or committed.
- Phase artifacts are private under `.lisa/attempts/T-071-02-02/1/work/`.

## Step 1 — Start implementation tracking

Create `progress.md` in the private attempt work directory.

Record:

- completion of Research, Design, Structure, and Plan;
- the chosen `{ seat, reason }` durable shape;
- the two source files owned by this ticket;
- the unrelated dirty worktree constraint;
- the implementation checklist and verification commands.

Verification:

- `progress.md` exists in the attempt directory.
- No file is written to `docs/active/work/T-071-02-02/`.

## Step 2 — Add the marker type and interface fields

Modify `src/log/run-log.ts`:

1. Add exported `SeatInferred` after `SeatDefaulted`.
2. Give it `readonly seat: string` and `readonly reason: string`.
3. Add documented optional `seatInferred?: SeatInferred` to `RunRecordInput`.
4. Add documented optional `seatInferred?: SeatInferred` to `RunRecord`.
5. Place both properties between `seatDefaulted` and `seatOfExecution`.

Verification:

- Search shows one marker type and one field in each record interface.
- There is no new import from `src/play`, `src/executor`, or the known-seat registry.
- Existing fields and schema version are unchanged.

## Step 3 — Add shared atomic normalization

Modify `src/log/run-log.ts`:

1. Add `normalizeSeatInferred` after `normalizeSeatDefaulted`.
2. Return `undefined` unless both `seat` and `reason` are non-empty strings.
3. Return a fresh object containing only `seat` then `reason`.
4. Preserve accepted string values verbatim.
5. Reuse `isNonEmptyString`.

Verification:

- The helper mirrors `normalizeSeatDefaulted`’s optional, non-throwing stance.
- The helper contains no routing-policy logic.
- The helper canonically selects schema fields.

## Step 4 — Wire the write path

Modify `buildRunRecord`:

1. Normalize `input.seatInferred` after `input.seatDefaulted`.
2. Conditionally spread `{ seatInferred }` after `seatDefaulted`.
3. Keep `seatOfExecution` after the marker.

Verification:

- A valid marker can appear in the normalized result.
- `undefined` cannot create an own property.
- Existing object-freezing and required validation remain unchanged.
- Property order is `seatDefaulted`, `seatInferred`, `seatOfExecution` when all are present.

## Step 5 — Wire the read path

Modify `reviveRecord`:

1. Read `r.seatInferred` after the defaulted marker block.
2. Admit only non-null objects to the normalizer.
3. Normalize through the same helper as the write path.
4. Conditionally spread the result in the same property order as `buildRunRecord`.

Verification:

- A valid parsed marker is retained.
- A primitive, partial, empty, or malformed marker is omitted.
- Malformed optional marker data does not return `null` for an otherwise valid record.
- No changes are made to `readRuns`; it receives the behavior through `reviveRecord`.

## Step 6 — Add focused tests

Modify `src/log/run-log.test.ts` with a `seatInferred` describe block between the defaulted and
execution-seat blocks.

Add five cases:

1. Valid supplied marker survives build, serialize, `readRuns`, revive, and reserialize.
2. Absent marker serializes exactly as a literal pre-feature line.
3. Partial malformed marker serializes exactly as the same absent line.
4. Valid marker with an extra nested field is canonically copied without the extra field.
5. Malformed marker on revive is dropped while the surrounding record survives.

Test fixture details:

- Marker seat: `codex`.
- Marker reason: a stable string naming recent cost-weighted burn and a hotter claude lane.
- Use a distinct `si*` run-id namespace.
- Use unsafe casts only where intentionally bypassing the TypeScript contract.
- Use `readRuns` for the valid round-trip because acceptance names it explicitly.
- Use exact serialization equality for both absent and malformed cases.

Verification:

- Every acceptance phrase maps to at least one assertion.
- Tests remain pure: no filesystem, clock, executor, or network.
- Tests do not import `lane-heat.ts` or `KNOWN_SEATS`.

## Step 7 — Format and inspect the ticket diff

Run the repository’s existing formatter only if the project exposes a safe targeted formatting
command. Otherwise preserve the established manual style and rely on the check gate.

Inspect:

```bash
git diff -- src/log/run-log.ts src/log/run-log.test.ts
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts
```

Verification:

- Only the intended marker schema, normalization, wiring, and tests appear.
- No unrelated lines are reformatted.
- No whitespace errors are reported.

## Step 8 — Run focused tests

Run:

```bash
bun test src/log/run-log.test.ts
```

Expected result:

- All run-log tests pass.
- New valid, absent, malformed, canonical-copy, and revival branches pass.

If failure occurs:

- Diagnose whether it is production behavior, fixture byte order, or an existing unrelated failure.
- Fix ticket-owned behavior only.
- Document any plan deviation in `progress.md` before changing approach.
- Re-run the focused test until green.

## Step 9 — Run the authoritative gate

Run:

```bash
bun run check
```

This covers:

- BAML generation;
- TypeScript checking/build;
- the full Bun test suite.

Expected result:

- Exit status 0.
- No generated ticket-owned changes remain unexpectedly.

If the gate fails:

- Determine whether the failure is caused by this ticket.
- Correct ticket-owned failures and rerun.
- If an unrelated concurrent failure exists, document exact evidence honestly; do not mask it.
- Acceptance is not met until the gate is green.

## Step 10 — Update implementation progress

Update private `progress.md` with:

- exact source changes completed;
- focused test result and count;
- full gate result and count/output summary;
- deviations from the plan, if any;
- remaining commit/review work.

Verification:

- Progress accurately reflects observed commands, not anticipated results.

## Step 11 — Commit the meaningful source unit

Before committing:

```bash
git status --short
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts
```

Commit with Lisa only:

```bash
lisa commit-ticket \
  --ticket-id T-071-02-02 \
  --message "feat(log): record inferred seat provenance (T-071-02-02)" \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts
```

Rules:

- Do not run `git add`, `git add -A`, or ordinary `git commit`.
- Do not include ticket frontmatter, Lisa state, hooks, unrelated artifacts, or private phase files.
- Do not bypass hooks.
- If Lisa refuses because of lease/state, capture the exact output and investigate within the
  assignment’s rules.

Verification:

- The command succeeds and reports a commit.
- The two ticket-owned source files are no longer modified.
- Unrelated pre-existing dirty files remain untouched.
- `git log -1` shows the ticket commit message.

## Step 12 — Post-commit verification

Run:

```bash
git status --short
git show --stat --oneline HEAD
```

Optionally rerun focused tests if the Lisa hook output does not already prove the committed tree,
but the authoritative pre-commit `bun run check` remains the main gate.

Update `progress.md` with the commit id and post-commit source cleanliness.

## Step 13 — Review phase

Create `.lisa/attempts/T-071-02-02/1/work/review.md`.

Review must include:

- ticket/story scope and outcome;
- files changed;
- public schema and normalization behavior;
- test coverage mapped to acceptance;
- focused and full verification results;
- commit id and Lisa commit method;
- compatibility assessment;
- architecture assessment;
- open concerns, limitations, and explicitly deferred downstream integration;
- honest acceptance checklist.

After writing review:

- remain on this ticket;
- do not start another ticket;
- do not modify ticket phase/status;
- stop and allow Lisa to verify the lease and publish admitted artifacts.

## Atomicity rationale

The entire source change is one meaningful unit:

- public durable type without write/read wiring is incomplete;
- wiring without tests violates P3;
- tests without the schema do not compile;
- production and tests share exactly one module boundary.

Therefore one Lisa commit with exactly two include paths is the appropriate atomic commit. Phase
artifacts remain outside that source commit under the assignment’s private publication mechanism.

## Acceptance traceability

| Acceptance requirement | Planned proof |
|---|---|
| `buildRunRecord` writes supplied marker | valid marker test asserts built property and line |
| marker contains chosen seat + heat reason | `{ seat, reason }` fixture and equality assertions |
| `reviveRecord` retains supplied marker | valid `readRuns` test exercises revival |
| survives `readRuns` round-trip | zero skipped, one record, marker equality, reserialized bytes |
| absent omitted byte-identically | exact literal JSONL equality |
| malformed omitted byte-identically | partial build marker equals same absent JSONL literal |
| atomic-marker discipline | partial rejection + extra-key removal + malformed revival tests |
| malformed revive does not lose record | non-null/run-id assertions with marker absence |
| `bun run check` green | authoritative gate command before commit |
| committed ticket-owned source | Lisa exact-path commit and post-commit status |
