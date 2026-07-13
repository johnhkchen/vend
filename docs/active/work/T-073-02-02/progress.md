# T-073-02-02 — Progress

## Status

Implementation is complete and verified. One ticket-owned source unit was added. No production
module changed, and no deviation from the approved design was required.

## Completed work

### Research

- Read the parent story before designing the ticket.
- Read the assignment, vision, charter, stack, and complete RDSPI workflow.
- Mapped the cast, diff capture, complement resolution, review, settlement, and ledger path.
- Confirmed `T-073-02-01` already owns production enforcement and focused branch coverage.
- Identified this ticket's distinct obligation as a contrastive end-to-end demonstration.

### Design

- Evaluated relying on dependency tests, extending the broad cast suite, a standalone proof, and
  a CLI subprocess proof.
- Selected a dedicated test because it gives the acceptance behavior a clear, ticket-owned file.
- Kept the real filesystem, Git diff, review parser, settlement, and JSONL append path.
- Replaced only author/reviewer vendor transports with typed zero-cost stubs.
- Preserved the story's honest boundary: no live second-vendor claim.

### Structure

- Created `src/engine/cross-review-refusal.e2e.test.ts` as the sole source unit.
- Kept all fixtures private to the test.
- Used one temporary Git project and one ledger for the bad/good contrast.
- Used known executor ids so real seat projection resolves Claude authoring and Codex reviewing.

### Implementation

- Added temporary-directory cleanup.
- Added a Git helper and local empty-baseline repository initializer.
- Added a high budget so no budget branch obscures review settlement.
- Added a small play fixture with a named passing ordinary gate.
- Made its effect write visible bad or good acceptance evidence to a reported artifact.
- Added a typed Claude author executor double returning parsed bad/good fixture JSON.
- Added a two-seat registry with a recording OpenAI-compatible complement double.
- Primed the complement replies in order: reasoned FAIL, then PASS.
- Drove the bad cast completely and asserted final `gate-failed`, never success.
- Drove the good cast completely and asserted final success.
- Asserted both review calls are single-turn and contain the actual current patch bytes.
- Asserted the reviewer prompts also carry the authored play purpose.
- Parsed the shared durable ledger and asserted exactly two lines.
- Asserted the failing verdict, reason, seat provenance, and failed review gate row.
- Asserted the passing verdict, seat provenance, and passed review gate row.
- Asserted passing verdict detail is omitted rather than invented.

## Focused verification

Command:

```bash
bun test src/engine/cross-review-refusal.e2e.test.ts
```

Result:

```text
1 pass
0 fail
17 expect() calls
```

Observed output includes:

```text
· effect ✓ wrote bad acceptance evidence
· andon: gate-failed — cross-vendor review: required acceptance proof is false
· effect ✓ wrote good acceptance evidence
```

This verifies the autonomous bad-run refusal is visible while the contrast run clears.

## Full verification

Command:

```bash
bun run check
```

Result:

```text
BAML generation: passed
TypeScript typecheck: passed
Bun tests: 1693 pass, 1 expected skip, 0 fail
Assertions: 5248
Files: 114
```

The skipped test is the pre-existing guarded release acceptance test that requires built `dist/`
artifacts; it is unrelated to this ticket.

## Ownership audit

- Ticket-owned source: `src/engine/cross-review-refusal.e2e.test.ts` only.
- No production files changed.
- No files are staged in the ordinary Git index.
- `.lisa/provenance.jsonl` and the ticket file are Lisa-managed modifications and were untouched.
- Lisa mirrored phase artifacts into `docs/active/work/T-073-02-02/` after detecting completion;
  the worker wrote only to the private attempt directory as assigned.
- The generated BAML client remained clean after the full gate.

## Plan deviations

None.

The implementation followed the planned standalone-test structure, focused verification, full
verification, and exact-path commit boundary. No production fix became necessary.

## Commit plan

Commit exactly:

```text
src/engine/cross-review-refusal.e2e.test.ts
```

Using:

```bash
lisa commit-ticket \
  --ticket-id T-073-02-02 \
  --message "test(engine): prove cross-review refusal end to end" \
  --include src/engine/cross-review-refusal.e2e.test.ts
```

After the transaction, record the created commit id below and confirm the ticket-owned path is
clean before writing the final review.

## Commit result

Created successfully through `lisa commit-ticket`:

```text
85e783058621f57b18b2526e0451cf89937b7746
```

Message: `test(engine): prove cross-review refusal end to end`

Exact include:

```text
src/engine/cross-review-refusal.e2e.test.ts
```

## Remaining

1. Confirm source cleanliness and commit contents.
2. Write `review.md` and stop on this ticket.
