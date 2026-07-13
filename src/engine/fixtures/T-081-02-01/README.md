# T-081-02-01 sanitized cast-progress fixtures

These compact JSONL excerpts preserve only the external stream fields needed to replay the
weighted-spend and sidechain-count evidence captured by `T-081-01-01`.

## Sources

| Fixture | Captured run | Local source transcript |
|---|---|---|
| `token-spend-excerpt.jsonl` | `run-2026-07-13T17-07-45-166Z` | `.vend/transcripts/run-2026-07-13T17-07-45-166Z.jsonl` |
| `turn-sidechain-excerpt.jsonl` | `run-2026-07-13T14-39-35-941Z` | `.vend/transcripts/run-2026-07-13T14-39-35-941Z.jsonl` |

Extraction and verification date: 2026-07-13.

The token run's matching ledger row reports `totalTokens: 214621`. Its assistant endpoint usage
folds to 104,807 weighted tokens; 150 thinking-token messages sum to 15,419 output tokens; its
terminal cumulative usage meters to 214,621.

The turn run contains 45 distinct assistant IDs: 12 main/null-parent and 33 non-null-parent
sidechain IDs, partitioned 4/9/11/9. The configured parent cap was 15.

## Sanitization

Removed:

- prompts, generated text, thinking/text/tool content, and tool payloads;
- filesystem paths;
- real message, tool, request, session, and UUID identifiers;
- signatures, model/service metadata, timing, costs, and result prose.

Retained:

- stream type/subtype;
- deterministic replacement assistant IDs;
- null versus non-null `parent_tool_use_id` class;
- exact accounting buckets used by the replay;
- terminal `num_turns` values;
- underscore-prefixed source-line audit metadata ignored by production code.

The token fixture keeps first and last endpoints for repeated assistant IDs and aggregates the 150
thinking messages into one explicitly marked record with their exact count and sum. The turn
fixture keeps one first occurrence per distinct assistant ID because the production fold dedupes
repeated records by ID.

These files are captured evidence for the pure fold tests, not general executor schemas.
