# Research — T-081-02-01

## Ticket and story contract

`T-081-02-01` is the sole implementation ticket in story `S-081-02`.

The owned production surface is deliberately narrow:

- `src/engine/cast-core.ts`;
- `src/engine/cast-core.test.ts`;
- sanitized transcript excerpts used by those tests.

The story leaves the `cast.ts` `onMessage` wiring unchanged unless terminal settlement needs a
separate render. The existing wiring already folds and renders every streamed message in order, so
the core can observe the terminal result without a shell change.

The acceptance contract has four linked facts:

1. replay the captured steer-jank transcript through `accumulateCastProgress`;
2. close the observed 104,807-versus-214,621 weighted-token gap within a named tolerance;
3. label the rendered number for the unit it actually represents;
4. treat sidechains consistently in both `weightedTokens` and `turns`.

The story explicitly defers a funded installed-binary cast. This ticket is fixture-proven and
must remain free of live model spend.

## Product constraints

The ticket advances P7, “Budget is a hard contract,” and P3, “Gates are the contract.”

`docs/knowledge/vision.md` defines the budget as the time/token allocation made at the counter.
The operator should be able to allocate and observe that contract without negotiating what the
number means during a run.

`src/budget/budget.ts` is the canonical meter. Its `countTokens` function converts four usage
buckets into fresh-input-token-equivalents using the frozen cost vector:

| Bucket | Weight |
|---|---:|
| input | 1.0 |
| output | 5.0 |
| cache read | 0.1 |
| cache creation | 1.25 |

`countTokens` rounds the weighted sum to one integer. The completed ledger and the budget check use
that function's unit. The progress line must therefore expose that same weighted unit, rather than
an unlabeled raw-token count.

## Current progress model

`CastProgress` in `src/engine/cast-core.ts` has three fields:

- `weightedTokens` — accumulated weighted usage;
- `turns` — distinct accepted assistant IDs;
- `seenMessageIds` — immutable transport deduplication state.

`EMPTY_CAST_PROGRESS` is frozen, and every changed fold result is frozen. Existing tests assert
identity preservation for no-op records, so total/no-op behavior is part of the observable API.

The internal `assistantTurn` helper currently admits a record only when:

- `type === "assistant"`;
- `message` is a non-array object;
- `message.id` is a non-empty string;
- `message.usage` is a non-array object.

`accumulateCastProgress` then rejects already-seen IDs, adds `countTokens(usage)`, increments
`turns`, and appends the ID immutably.

The current function does not inspect top-level `parent_tool_use_id`. It therefore mixes parent
and subagent streams into both counters.

The current function also rejects all non-assistant records. In particular it ignores:

- `system/thinking_tokens` records with `estimated_tokens_delta`;
- terminal `result` records with cumulative `usage`.

The terminal skip was intentional: cumulative usage must not be added as another incremental turn.
The captured evidence shows that ignoring it entirely leaves the live state materially below the
meter's completed value.

## Current formatter

`formatCastProgress` receives explicit elapsed time, token envelope, and optional turn cap. It is
pure and has no clock or I/O dependency.

Its output currently has this shape:

```text
elapsed 4m12s · 210k/500k tokens · turn 7/15
```

The numerator is weighted spend and the denominator is a weighted budget ceiling, but the line
calls them only “tokens.” The ambiguity is exactly the operator-facing unit error named by the
ticket.

`humanProgressTokens` rounds whole weighted values to the nearest displayed thousand at 1,000 and
above. This display rounding does not affect `CastProgress.weightedTokens` or budget settlement.

The formatter adds `(detect-after)` only when `weightedTokens > tokenEnvelope`. Existing tests pin
that strict comparison and the humane time formats.

## Shell wiring

`src/engine/cast.ts` constructs one `onMessage` callback. For every external stream record it:

1. calls `accumulateCastProgress`;
2. computes elapsed wall time from the injected clock;
3. calls `formatCastProgress`;
4. refreshes one stdout line;
5. forwards the raw message to the transcript sink.

The terminal result is sent through `onMessage` before the executor returns it. The same terminal
record is later passed to `check(budget, result.usage)` for authoritative settlement. Therefore a
pure fold change can reconcile the final displayed state to the exact input used by the budget
check without modifying shell control flow.

## Forensics dependency

Completed spike `T-081-01-01` inspected two real 2026-07-13 transcripts and preserved sanitized
fixtures in its Lisa attempt directory.

### Turn evidence

Run `run-2026-07-13T14-39-35-941Z` contains:

- 156 assistant rows;
- 45 distinct nested assistant IDs;
- 12 parent/main IDs with null `parent_tool_use_id`;
- 33 sidechain IDs with non-null `parent_tool_use_id`;
- sidechain group sizes 4, 9, 11, and 9.

The current fold renders 45 turns. Filtering the counted population to null-parent assistant
records yields 12, which is below the configured parent cap of 15.

The five terminal result records report `num_turns` values 10, 1, 1, 1, and 2. They do not carry
a usable sidechain marker; the final result and ledger value are 2. Those executor conversation
event counts are not substitutes for the distinct main assistant-ID counter.

The ticket's “both fold counters” phrase refers to `turns` and `weightedTokens`: a sidechain
assistant record currently advances both together. The evidence identifies non-null
`parent_tool_use_id` as the available admission boundary.

### Token evidence

Run `run-2026-07-13T17-07-45-166Z` contains 35 assistant rows collapsed to nine IDs. Their first
and last usage snapshots are identical for every ID. The existing first-event policy therefore
is not responsible for this run's gap.

The admitted assistant usage sums to:

| Bucket | Assistant fold |
|---|---:|
| input | 2,994 |
| output | 63 |
| cache read | 416,183 |
| cache creation | 47,903 |

Per-ID calls to `countTokens` produce 104,807 weighted units.

The same transcript has 150 `system/thinking_tokens` records. Their
`estimated_tokens_delta` values sum to 15,419. The field is an output-token delta in the captured
stream. At the canonical output weight, it contributes 77,095 weighted units.

The terminal result and matching ledger row contain:

| Bucket | Terminal usage |
|---|---:|
| input | 2,994 |
| output | 22,026 |
| cache read | 416,183 |
| cache creation | 47,903 |

One canonical `countTokens` call returns 214,621. The assistant-only undercount is 109,815 weighted
units. Thinking deltas account for 77,095; the remaining 32,720 is 6,544 output tokens present
only in terminal cumulative usage among the retained fields.

All records in this token run are main-stream records: assistant, thinking, and terminal records
have absent or null parent markers.

## Fixture state

The spike's private attempt contains:

- `fixtures/token-spend-excerpt.jsonl` — 17 assistant endpoints, one aggregate thinking record,
  and the terminal result;
- `fixtures/turn-sidechain-excerpt.jsonl` — 45 assistant IDs partitioned by parent marker plus
  five result rows;
- a manifest describing sanitization, source lines, expected counts, and arithmetic.

Lisa's completion commit published only the six named phase artifacts, not the spike's nested
fixtures or root-cause note. Production tests therefore cannot depend on
`docs/active/work/T-081-01-01/fixtures`.

This ticket must commit the evidence it needs under a test-owned source path. The excerpt contains
only accounting fields, deterministic replacement IDs, parent classes, and source-line audit
metadata; it contains no prompts, generated content, paths, real IDs, or signatures.

## Existing test conventions

`src/engine/cast-core.test.ts` is a pure-function suite. It imports no impure cast shell or native
BAML module. The current focused file has 69 passing tests and 164 expectations.

The progress tests already pin:

- duplicate assistant event idempotence;
- weighted per-turn accounting;
- distinct assistant turns instead of terminal `num_turns`;
- malformed/unknown record no-ops by object identity;
- elapsed and token formatting;
- detect-after behavior.

The repository uses Bun's test runner and permits test fixtures below `src`. `import.meta.dir` and
`Bun.file(...).text()` are established mechanisms for loading repository-relative test data.

Baseline focused result on Bun 1.3.13:

```text
69 pass
0 fail
```

## Constraints and assumptions

- The external stream shape is open JSON; new extraction must remain total over malformed values.
- A non-null `parent_tool_use_id` is the captured sidechain marker. Null or absence denotes the
  main stream for the relevant records.
- Thinking deltas are incremental observations, not cumulative usage snapshots.
- Terminal `result.usage` is cumulative and authoritative; it must replace/reconcile, never add to,
  prior estimates.
- Terminal result records in multiplexed transcripts cannot be assigned to a sidechain from the
  marker. The final record is the parent result in the captured ordering and is the ledger truth.
- The final exact state can use the same `countTokens` function as the meter, so arithmetic drift
  need not be accepted silently.
- No schema, ledger, executor, or `cast.ts` change is required by the observed data flow.
- The worktree contains Lisa-managed modifications to provenance and ticket frontmatter; they are
  unrelated and must not be staged or committed by this ticket.

## Research conclusion

The defect is localized to the pure fold and its label. The shell already provides every record
needed for incremental thinking spend and exact terminal reconciliation. The test suite already
has the right pure seam, while the captured fixtures provide both the 104,807-to-214,621 spend
replay and the 45-to-12 sidechain census required to prove the change.
