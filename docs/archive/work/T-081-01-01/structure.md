# Structure — T-081-01-01

## Artifact boundary

All ticket-owned files are private attempt artifacts until Lisa verifies the lease and publishes
them. The target tree is:

```text
.lisa/attempts/T-081-01-01/1/work/
├── research.md
├── design.md
├── structure.md
├── plan.md
├── progress.md
├── root-cause.md
├── review.md
├── review-disposition.json
└── fixtures/
    ├── README.md
    ├── turn-sidechain-excerpt.jsonl
    └── token-spend-excerpt.jsonl
```

Lisa will publish admitted work artifacts under:

```text
docs/active/work/T-081-01-01/
```

No file is written directly to that shared path during the attempt.

## Existing artifacts

### `research.md`

Owns descriptive codebase and evidence mapping:

- story/ticket boundary;
- current turn and token paths;
- raw transcript message census;
- exact source run IDs and line references;
- constraints carried into design.

It records observations and arithmetic but does not choose downstream production behavior.

### `design.md`

Owns the evidence-publication decision:

- raw transcripts rejected;
- prose-only tables rejected;
- sanitized minimal replay excerpts chosen;
- sanitization and replay tradeoffs;
- verification approach.

### `structure.md`

This file defines the remaining file-level blueprint and boundaries.

## New forensic note

### `root-cause.md`

This is the primary acceptance artifact for human reviewers and the dependent tickets.

Sections:

1. evidence sources and immutable identifiers;
2. executive verdict;
3. 45-turn message census;
4. exact parent-versus-sidechain reconciliation;
5. terminal result/ledger counter distinction;
6. token bucket census;
7. first-versus-final per-ID comparison;
8. skipped-kind accounting;
9. terminal residual accounting;
10. implications for the two downstream tickets;
11. honest limitations.

Every material conclusion cites:

- a run ID;
- the real `.vend` file;
- counted transcript line numbers or ranges;
- the matching real ledger line where applicable.

The note will explicitly correct the misleading shorthand that called the 45 value `num_turns`.
It will preserve all three observed turn counters rather than force them into one label.

## Fixture directory

### `fixtures/README.md`

Owns fixture provenance and sanitization rules.

It records:

- source transcript run ID for each fixture;
- extraction date;
- retained fields;
- removed fields;
- deterministic renaming scheme;
- aggregation applied to thinking-token records;
- expected replay results;
- intended downstream consumers;
- warning that source-line metadata is audit-only and ignored by the stream fold.

It also gives short `jq` commands for validating JSONL shape and reproducing raw counts.

### `fixtures/turn-sidechain-excerpt.jsonl`

Purpose: reproduce sidechain inflation in the existing assistant-ID fold.

Record layout for assistant rows:

```ts
interface SanitizedTurnAssistantRecord {
  readonly type: "assistant";
  readonly message: {
    readonly id: string;
    readonly usage: Record<string, never>;
  };
  readonly parent_tool_use_id: string | null;
  readonly _source_line: number;
}
```

The deterministic IDs encode stream class and ordinal only:

- `main-01` through `main-12`;
- `sidechain-1-01` through `sidechain-1-04`;
- `sidechain-2-01` through `sidechain-2-09`;
- `sidechain-3-01` through `sidechain-3-11`;
- `sidechain-4-01` through `sidechain-4-09`.

Non-null parent markers use `sidechain-1` through `sidechain-4`. They are not real tool IDs.

Record layout for terminal rows:

```ts
interface SanitizedTurnResultRecord {
  readonly type: "result";
  readonly subtype: "success";
  readonly num_turns: number;
  readonly _source_line: number;
}
```

Ordering:

1. assistant records in original first-occurrence source-line order;
2. result records in original line order 518–522.

Expected facts:

- 45 assistant records and 45 unique IDs;
- 12 null-parent IDs;
- 33 non-null-parent IDs;
- four non-null groups sized 4, 9, 11, 9;
- result counters 10, 1, 1, 1, 2;
- current fold total 45;
- main-only fold total 12.

### `fixtures/token-spend-excerpt.jsonl`

Purpose: reproduce the live fold, per-ID endpoint comparison, and terminal weighted ledger value.

Assistant record layout:

```ts
interface SanitizedTokenAssistantRecord {
  readonly type: "assistant";
  readonly message: {
    readonly id: string;
    readonly usage: {
      readonly input_tokens: number;
      readonly output_tokens: number;
      readonly cache_read_input_tokens: number;
      readonly cache_creation_input_tokens: number;
    };
  };
  readonly parent_tool_use_id: null;
  readonly _source_line: number;
  readonly _endpoint: "first" | "last" | "only";
}
```

The IDs are `turn-01` through `turn-09`. First and last rows share an ID so the production fold
keeps its normal dedup behavior. The line-75 singleton uses `_endpoint: "only"`.

Thinking aggregate layout:

```ts
interface SanitizedThinkingAggregate {
  readonly type: "system";
  readonly subtype: "thinking_tokens";
  readonly estimated_tokens_delta: 15419;
  readonly _source_count: 150;
  readonly _source_first_line: 6;
  readonly _source_last_line: 208;
  readonly _aggregate: true;
}
```

Terminal record layout:

```ts
interface SanitizedTokenResultRecord {
  readonly type: "result";
  readonly subtype: "success";
  readonly num_turns: 20;
  readonly usage: {
    readonly input_tokens: 2994;
    readonly output_tokens: 22026;
    readonly cache_read_input_tokens: 416183;
    readonly cache_creation_input_tokens: 47903;
  };
  readonly _source_line: 212;
}
```

Expected facts:

- 17 retained assistant rows representing nine unique IDs;
- every repeated ID has identical first and last usage;
- production live fold is 104,807 weighted units and nine turns;
- assistant bucket sum before weighting is 2,994 / 63 / 416,183 / 47,903;
- thinking aggregate is 15,419;
- terminal bucket sum is 2,994 / 22,026 / 416,183 / 47,903;
- terminal weighted result is 214,621;
- output residual is 21,963;
- post-thinking terminal residual is 6,544.

## Implementation tracking

### `progress.md`

Will record:

- phase artifact completion;
- fixture construction;
- verification commands and exact outputs;
- any arithmetic or structure deviations;
- repository gate result;
- commit handling decision.

There are no production source commits planned. The artifact publication commit remains Lisa's
responsibility after Review.

## Review handoff

### `review.md`

Will assess:

- acceptance clause by clause;
- changed/created files;
- fixture replay coverage;
- full repository gate;
- limitations and open concerns;
- whether downstream implementation can proceed.

### `review-disposition.json`

Will contain exactly one of:

```json
{"disposition":"pass","reason":null}
```

or a blocking disposition with a non-empty actionable reason.

## Files explicitly unchanged

- `docs/active/tickets/T-081-01-01.md` — Lisa owns phase/status transitions.
- `src/engine/cast-core.ts` — downstream fold implementation.
- `src/engine/cast.ts` — downstream ledger wiring.
- `src/log/run-log.ts` — downstream schema change.
- all test files — this spike supplies fixtures and evidence, not the eventual assertions.
- `.vend/transcripts/*.jsonl` — read-only evidence sources.
- `.vend/runs.jsonl` — append-only real ledger, read-only for this spike.

## Ordering dependency

1. Build fixtures before the final note so note values can be checked against committed excerpts.
2. Verify fixtures through production pure functions before declaring the root cause final.
3. Run the full repository gate after artifact construction.
4. Write Review only after all replay and repository checks are green.
5. Stop on this ticket after Review; do not start a dependent ticket.
