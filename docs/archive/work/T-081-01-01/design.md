# Design — T-081-01-01

## Objective

Produce durable, reviewable evidence that the two dependent fixes can build against without
copying sensitive full transcripts or selecting their implementation policy prematurely.

The output needs to do four things:

1. state the root cause in one reviewer-facing note;
2. preserve enough transcript shape to replay the 45-turn sidechain inflation;
3. preserve enough usage shape to replay 104,807 live versus 214,621 terminal weighted tokens;
4. keep all attempt artifacts inside Lisa's leased private work directory.

## Design constraints from Research

- The turn anomaly depends on a top-level field: `parent_tool_use_id`.
- The production fold requires assistant records to carry both `message.id` and `message.usage`.
- The 45 count depends on unique IDs, not assistant row count.
- The parent-only count is 12; the four sidechains contribute 4, 9, 11, and 9 IDs.
- The five terminal `num_turns` values are 10, 1, 1, 1, and 2; they do not sum to 45.
- The final terminal result is 2 and is the value present in the real ledger row.
- The token anomaly depends on nine assistant IDs, 150 skipped thinking records, and one terminal
  cumulative result.
- Repeated assistant records do not change usage between first and last event in the evidence run.
- Full transcript text contains generated prose, paths, tool input/output, identifiers, and other
  material irrelevant to the accounting facts.
- Production code and tests belong to downstream tickets, not this spike.

## Option A — Commit the complete real transcripts

Copy both `.vend/transcripts/*.jsonl` files into the work directory unchanged.

### Advantages

- Perfect fidelity.
- Any future question can be recomputed from the original source.
- No derivation or fixture-shaping judgment.

### Costs and risks

- The files contain prompts, generated board content, source excerpts, local paths, tool payloads,
  session identifiers, request identifiers, and message signatures.
- The sidechain transcript is 522 lines with very large embedded payloads.
- Reviewers cannot easily see which fields are load-bearing.
- Later unit tests would either ingest excessive irrelevant data or create another fixture anyway.
- Committing raw local transcript content violates the acceptance request for sanitized excerpts.

### Decision

Rejected.

## Option B — Commit only aggregate tables in Markdown

Write the counted results and arithmetic into `root-cause.md`, with no machine-readable excerpts.

### Advantages

- Small and easy to review.
- No transcript content exposure.
- Directly answers the human-readable acceptance clauses.

### Costs and risks

- The dependent fixes cannot replay the evidence through `accumulateCastProgress`.
- A typo in the table would not be independently detectable.
- The fixture-proven story contract would become prose-proven only.
- Parent-marker behavior and terminal-message behavior would not be structurally preserved.

### Decision

Rejected as insufficient by itself.

## Option C — Sanitized minimal stream excerpts plus a root-cause note

Create two JSONL fixtures containing only accounting-relevant external stream fields, plus a
manifest that maps fixture facts back to source run IDs and source line numbers.

### Turn fixture

Preserve one assistant record per unique nested message ID:

- 12 records with `parent_tool_use_id: null`;
- 4 records labeled `sidechain-1`;
- 9 records labeled `sidechain-2`;
- 11 records labeled `sidechain-3`;
- 9 records labeled `sidechain-4`.

Each assistant record has:

- `type: "assistant"`;
- a deterministic sanitized `message.id`;
- `message.usage: {}` so the real fold accepts it but the fixture carries no irrelevant spend;
- sanitized `parent_tool_use_id` preserving null versus non-null;
- `_source_line` as audit metadata ignored by the production fold.

Append five sanitized result records retaining only source line, type/subtype, and `num_turns`.
Their order and values remain 10, 1, 1, 1, 2.

### Token fixture

Preserve first and last events for each of the nine assistant IDs:

- two records for each repeated ID;
- one record for the single-event ID;
- exact four-bucket usage on every retained record;
- deterministic sanitized IDs;
- original source line in `_source_line`.

Add one aggregate system record with:

- `type: "system"`;
- `subtype: "thinking_tokens"`;
- `estimated_tokens_delta: 15419`;
- `_source_count: 150`;
- source line span metadata.

Add the terminal result with its exact four-bucket usage and `num_turns: 20`.

### Manifest and note

`fixtures/README.md` states precisely which transformations were applied and records the expected
replay values. `root-cause.md` presents the final evidence and arithmetic in reviewer-facing form.

### Advantages

- Both current folds are replayable from ordinary JSONL.
- Downstream tests can copy or directly consume evidence-shaped records.
- The fields that matter are visible and compact.
- Prompts, text, content blocks, tools, paths, sessions, request IDs, UUIDs, signatures, timing,
  costs, and model metadata are removed.
- Source run IDs and counted line numbers remain auditable against the local originals.
- No fix policy is embedded; the fixtures prove observations only.

### Costs and risks

- The excerpts are derived rather than raw, so the manifest must state the transformation.
- Aggregating 150 thinking messages into one record is not a byte-level replay of message timing.
- Empty usage objects in the turn fixture prove counting behavior but deliberately do not preserve
  the unrelated token behavior of that run.
- Future consumers must not mistake sanitized sidechain labels for real tool IDs.

### Decision

Chosen. It is the smallest artifact set that is both safe and machine-replayable.

## Root-cause conclusions to state without ambiguity

### Turn conclusion

The displayed 45 was not Claude's parent terminal `num_turns`. It was Vend's sidechain-blind count
of all distinct assistant message IDs in a transcript that multiplexed one parent loop and four
subagent streams.

The exact displayed arithmetic is:

`12 parent/main + 4 + 9 + 11 + 9 sidechain = 45`.

The configured cap is 15 on the parent dispense. The main-only observable is 12. The terminal
parent result is 2. These are separate counters and must remain separately named.

### Token conclusion

The current fold reproduced the reported 105k exactly as 104,807 weighted units after its
per-message rounding. The ledger's terminal usage is 214,621 weighted units.

All non-output buckets match exactly. The 109,815 weighted shortfall is 21,963 output tokens:

- 15,419 are explicit but skipped `system/thinking_tokens` deltas;
- 6,544 are not present in retained assistant usage and appear only in terminal cumulative usage.

First-event versus last-event selection contributes zero on this run because every retained
message ID carries the same usage at both endpoints.

## Why the fixtures do not prescribe the fixes

The turn fixture demonstrates that parent-marker filtering changes 45 to 12. It does not decide
whether a future fold should filter, separately count, or namespace sidechain IDs.

The token fixture demonstrates that terminal cumulative usage is authoritative and assistant
snapshots are incomplete. It does not decide whether live progress should replace, reconcile, or
supplement intermediate estimates when a terminal result arrives.

Those choices belong to `T-081-01-02` and `T-081-02-01`, which can evaluate compatibility and UI
tradeoffs in their own Design phases.

## Verification design

Use a small, temporary read-only Bun/TypeScript replay script from the command line to:

1. parse both JSONL fixtures;
2. feed the records through the real `accumulateCastProgress`;
3. assert turn fixture totals 45 and a null-parent filter totals 12;
4. assert token fixture folds to 104,807 and nine turns;
5. compute terminal usage through `countTokens` and assert 214,621;
6. assert first-versus-last per-ID bucket difference is zero;
7. assert thinking aggregate 15,419 and terminal residual 6,544;
8. validate every JSONL line with `jq`;
9. run the repository's full `bun run check` gate.

The replay is verification, not a committed source test, because the spike owns evidence rather
than production behavior.

## Publication and commit handling

- Write every phase artifact, note, manifest, and fixture below
  `.lisa/attempts/T-081-01-01/1/work/`.
- Do not write `docs/active/work/T-081-01-01/` directly.
- Do not include Lisa's modified ticket frontmatter in any commit.
- There is no production source unit to commit during Implement.
- Lisa's verified completion commit will publish the admitted artifacts, satisfying the story's
  requirement that the forensic fixtures become durable ticket evidence.
