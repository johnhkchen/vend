# Plan — T-081-02-01

## Goal

Land one atomic progress-fold unit that tracks explicit main-stream spend, reconciles terminal
weighted usage exactly to the ledger, excludes sidechains from both counters, and labels the
rendered unit.

## Step 1 — Publish test-owned sanitized fixtures

Create `src/engine/fixtures/T-081-02-01/`.

Add the two excerpts from the completed forensics attempt using `apply_patch`:

- `token-spend-excerpt.jsonl`;
- `turn-sidechain-excerpt.jsonl`.

Add `README.md` with source, sanitization, and expected replay facts.

Checks:

- every JSONL line parses with `jq -e`;
- token fixture has 19 records;
- turn fixture has 50 records;
- token fixture has nine unique assistant IDs;
- turn fixture has 12 null-parent and 33 non-null-parent assistant IDs;
- search finds no raw message/tool/session/request ID prefixes or absolute user paths.

## Step 2 — Add progress policy helpers

Modify `src/engine/cast-core.ts`.

Add:

- a sidechain predicate using non-null `parent_tool_use_id`;
- a thinking-delta extractor accepting only finite non-negative values;
- a terminal-usage extractor accepting only result records with object usage.

Keep helpers private and pure.

Verification:

- TypeScript accepts the open `StreamMessage` narrowing;
- helpers duplicate no cost weights;
- no helper reaches I/O or shell state.

## Step 3 — Extend the immutable fold

Update `accumulateCastProgress` branch order:

1. reject marked sidechains by identity;
2. reconcile valid result usage by replacement;
3. add valid positive thinking delta using `countTokens({ output_tokens: delta })`;
4. retain first-main-assistant-event dedup and counting;
5. return original state for all other records.

Add the exported named zero tolerance adjacent to the progress model.

Preserve frozen changed states and existing array immutability.

Focused verification criteria:

- zero/invalid thinking is identity-preserving;
- an equal terminal total is identity-preserving;
- a changed terminal total preserves turn/ID facts;
- result records never increment turns;
- a marked sidechain record can reach none of the mutation branches.

## Step 4 — Name the formatter's unit

Change the token segment in `formatCastProgress` to “weighted tokens.”

Do not change:

- time formatting;
- human value rounding;
- envelope comparison;
- detect-after placement;
- turn formatting.

Update the function documentation to make numerator and denominator units explicit.

## Step 5 — Add captured token replay test

In `src/engine/cast-core.test.ts`, load and parse `token-spend-excerpt.jsonl`.

Replay the pre-terminal records and assert:

- `turns === 9`;
- assistant plus thinking weighted spend is 181,902;
- all nine admitted IDs are retained.

Fold the terminal result and define the fixture's real ledger total as 214,621.

Assert:

- `CAST_PROGRESS_LEDGER_TOLERANCE === 0`;
- final `weightedTokens === 214_621`;
- absolute difference is less than or equal to the named tolerance;
- turns remain nine;
- formatter emits the expected rounded line with “weighted tokens.”

This is the direct ticket acceptance proof.

## Step 6 — Add captured sidechain replay test

Load and parse `turn-sidechain-excerpt.jsonl`.

Count fixture evidence before folding:

- 12 main assistant records;
- 33 sidechain assistant records.

Replay all 50 records and assert:

- `turns === 12`;
- `seenMessageIds` contains exactly the 12 `main-*` IDs;
- no `sidechain-*` ID was admitted;
- empty evidence usage leaves weighted spend zero.

Then fold a focused synthetic sequence with equal non-zero main and sidechain usage. Assert the
sidechain row changes neither `turns` nor `weightedTokens`, while the main row changes both once.

Include marked sidechain thinking and marked sidechain result messages in the no-op coverage.

## Step 7 — Update existing behavior tests

Adjust all exact `formatCastProgress` expectations in `cast-core.test.ts` to say “weighted tokens.”

Revise the existing no-op fixture:

- remove the assumption that a valid main result usage is ignored;
- keep malformed result usage as a no-op;
- add invalid thinking shapes;
- keep duplicate assistant behavior pinned.

Update comments describing terminal reconciliation rather than terminal skipping.

Modify the one exact stdout expectation in `src/engine/cast.test.ts` to use the new label on all
three refreshed lines. Do not alter fake events or expected numeric values.

## Step 8 — Run focused verification

Run:

```bash
bun test src/engine/cast-core.test.ts
bun test src/engine/cast.test.ts
bun run check:typecheck
```

If a focused failure reveals a contract mismatch, fix the smallest owned surface and document the
deviation in `progress.md` before changing the plan.

Also run:

```bash
git diff --check
git diff -- src/engine/cast-core.ts src/engine/cast-core.test.ts src/engine/cast.test.ts
```

Inspect the final diff for accidental changes outside the six owned paths.

## Step 9 — Run the repository gate

Run `bun run check` exactly as required by `AGENTS.md`.

Record:

- BAML generation result;
- TypeScript result;
- total test passes/failures/skips;
- focused fixture receipts.

If generated files become dirty, inspect whether codegen made a real change. Do not include
unrelated/generated drift without ownership and need.

## Step 10 — Commit the implementation unit

Use only `lisa commit-ticket` with ticket ID `T-081-02-01`.

Include exactly:

```text
src/engine/cast-core.ts
src/engine/cast-core.test.ts
src/engine/cast.test.ts
src/engine/fixtures/T-081-02-01/README.md
src/engine/fixtures/T-081-02-01/token-spend-excerpt.jsonl
src/engine/fixtures/T-081-02-01/turn-sidechain-excerpt.jsonl
```

Use a message describing weighted progress reconciliation and sidechain filtering.

Do not run `git add`, `git add -A`, or ordinary `git commit`. Confirm no ticket-owned path remains
modified or untracked after the Lisa commit. Leave Lisa-managed ticket/provenance files untouched.

## Step 11 — Write implementation progress

Create attempt-private `progress.md` with:

- completed file list;
- branch-policy summary;
- fixture replay values;
- focused/full gate receipts;
- commit hash;
- deviations or “none.”

The progress artifact is not included in the implementation commit; Lisa publishes admitted
phase artifacts after lease verification.

## Step 12 — Review against acceptance

Inspect the committed diff and independently replay both fixtures.

Review questions:

1. Does final progress equal 214,621 within the named zero tolerance?
2. Does the pre-terminal estimate incorporate the 15,419 thinking delta?
3. Does the line say “weighted tokens” everywhere?
4. Do 33 marked sidechain IDs affect neither turns nor weighted spend?
5. Does the fold remain total and immutable?
6. Is `bun run check` green after commit?
7. Are all ticket-owned files committed and only Lisa-managed files dirty?

Write `review.md` honestly with coverage, limitations, and open concerns.

Write exact JSON to `review-disposition.json`:

```json
{"disposition":"pass","reason":null}
```

only if every acceptance item and gate passes. Otherwise write a blocking disposition with a
non-empty actionable reason.

## Expected atomic outcome

The production fold, evidence fixtures, pure tests, and exact stdout consumer move in one commit.
The implementation does not require a transitional broken state or a second source unit. After
Review, remain on this ticket and stop for Lisa's completion publication.
