# Progress — T-081-02-01

## Status

Implementation is complete, committed, and verified.

Commit:

```text
e0c2bcd962cd38a137b0375fb3ec0d7a6c2a5700
fix(cast): reconcile live weighted spend
```

## Phase completion

| Phase | Artifact | Status |
|---|---|---|
| Research | `research.md` | complete |
| Design | `design.md` | complete |
| Structure | `structure.md` | complete |
| Plan | `plan.md` | complete |
| Implement | source, tests, fixtures, `progress.md` | complete |
| Review | `review.md`, `review-disposition.json` | pending |

## Files committed

Modified:

- `src/engine/cast-core.ts`;
- `src/engine/cast-core.test.ts`;
- `src/engine/cast.test.ts`.

Created:

- `src/engine/fixtures/T-081-02-01/README.md`;
- `src/engine/fixtures/T-081-02-01/token-spend-excerpt.jsonl`;
- `src/engine/fixtures/T-081-02-01/turn-sidechain-excerpt.jsonl`.

Commit summary:

```text
6 files changed, 248 insertions(+), 20 deletions(-)
```

No `cast.ts`, budget, executor, ledger, schema, BAML, or package file changed.

## Fold implementation

`accumulateCastProgress` now applies one ordered pure policy.

### Sidechain boundary

A record with non-null/non-undefined `parent_tool_use_id` is rejected before any fold branch.

Consequences:

- marked sidechain assistant usage does not change `weightedTokens`;
- marked sidechain assistant IDs do not change `turns`;
- marked sidechain IDs do not enter `seenMessageIds`;
- marked sidechain thinking deltas are ignored;
- marked sidechain result usage cannot reconcile parent progress.

The test replays the real 12-main/33-sidechain census and adds a synthetic non-zero sidechain
sequence to prove both counters share this admission boundary.

### Explicit thinking spend

Main `system/thinking_tokens` records with finite non-negative `estimated_tokens_delta` are charged
through:

```ts
countTokens({ output_tokens: delta })
```

The fold does not duplicate the canonical output weight.

Invalid, negative, non-finite, and zero deltas preserve state identity.

### Terminal reconciliation

Main `result` records with object `usage` replace `weightedTokens` with:

```ts
countTokens(result.usage)
```

They do not increment turns or modify the seen assistant IDs. Replacement, rather than addition,
keeps cumulative usage from double-charging the live estimate.

An equal terminal total returns the same state; a changed total returns a frozen replacement.

### Named agreement policy

Added:

```ts
CAST_PROGRESS_LEDGER_TOLERANCE = 0
```

The constant is documented in weighted tokens. Zero is warranted because terminal progress and
the ledger invoke the same canonical meter on the same usage object.

### Operator label

The progress segment now renders:

```text
215k/250k weighted tokens
```

instead of the ambiguous `tokens` label. Elapsed time, display rounding, detect-after, and turn
formatting are unchanged.

## Evidence fixtures

The test-owned excerpts were copied byte-for-byte from the sanitized outputs of completed spike
`T-081-01-01`.

Validation:

```text
19 token-spend-excerpt.jsonl
50 turn-sidechain-excerpt.jsonl
69 total JSONL records
```

Both files pass `jq -e .` for every line.

Sanitization search found none of:

- raw `msg_` identifiers;
- raw `toolu_` identifiers;
- session/request ID keys;
- `/Users/` absolute paths.

The committed README records both captured run IDs, extraction date, retained/removed fields, and
expected arithmetic.

## Token replay receipt

The fixture represents run `run-2026-07-13T17-07-45-166Z`.

After 17 assistant endpoints collapse to nine IDs:

```text
assistant weighted spend = 104,807
```

After the aggregate record representing 150 thinking messages totaling 15,419 output tokens:

```text
explicit thinking contribution = 77,095
pre-terminal weighted spend = 181,902
```

After terminal cumulative usage:

```text
progress.weightedTokens = 214,621
ledger totalTokens       = 214,621
absolute difference      = 0
named tolerance          = 0
turns                    = 9
```

The formatter assertion pins:

```text
elapsed 4m12s · 215k/250k weighted tokens · turn 9/15
```

The original 104,807-versus-214,621 ~2× undercount is closed exactly at settlement, while the
explicit mid-cast observation rises to 181,902 before settlement.

## Sidechain replay receipt

The fixture represents run `run-2026-07-13T14-39-35-941Z`.

Fixture population:

```text
main/null-parent assistant IDs = 12
sidechain assistant IDs        = 33
all assistant IDs              = 45
```

Fold result:

```text
progress.turns = 12
seen IDs       = 12, all main-* replacements
weightedTokens = 0 (fixture intentionally carries empty usage)
```

The synthetic spend companion begins with one 30,000-weighted-token main assistant, then folds a
marked sidechain assistant, a 10,000-token sidechain thinking record, and a sidechain result with
99,999 output tokens. All three sidechain records preserve the main state by identity:

```text
weightedTokens = 30,000
turns          = 1
seen IDs       = [main-spend]
```

## Focused verification

Before the full gate:

```text
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
96 pass
0 fail
451 expectations
```

The isolated core suite after commit:

```text
71 pass
0 fail
182 expectations
```

`bun run check:typecheck` passed.

`git diff --check` passed.

## Full repository gate

`bun run check` passed before the ticket commit:

```text
BAML generation: 14 files generated, green
TypeScript: green
Tests: 1,949 pass, 1 declared skip, 0 fail
Expectations: 6,419
Files: 126
```

The declared skip is the existing real-dist acceptance test when no `dist/` artifacts are present.

## Commit discipline

The implementation was committed with `lisa commit-ticket` and six exact `--include` paths.

No ordinary `git add`, `git add -A`, or `git commit` was used.

After commit, all six ticket-owned paths are clean. Remaining worktree changes are Lisa-managed
ticket/provenance/publication state or the concurrent `T-081-01-02` attempt and were not touched.

## Plan deviation

One expected-value correction was required in `cast.test.ts`.

The Plan initially said the stdout test's numeric values would remain unchanged. Focused execution
showed the third fake event is a terminal result whose cumulative usage meters to 22 weighted
tokens. The old behavior left the line at the assistant estimate of 7; terminal reconciliation
correctly changes the final refresh to 22.

The assertion was updated from 7 to 22, and the test now proves the intended production behavior.
No implementation boundary changed.

## Remaining work

- Complete the Review self-assessment.
- Write the required pass/block disposition.
- Stop on this ticket for Lisa's completion publication.
