# Structure — T-081-02-01

## Change boundary

The implementation remains centered on the pure cast-progress core. It changes one production
module, two test modules, and adds one evidence-fixture directory.

No application shell, executor, budget, ledger, schema, BAML, or package file changes.

## File map

### Modify `src/engine/cast-core.ts`

Responsibilities retained:

- define immutable progress state;
- classify open stream records;
- fold records into progress;
- render the humane live line.

New/changed structure:

1. export the terminal ledger-agreement tolerance near the progress model;
2. add private record classifiers for sidechain, thinking delta, and terminal usage;
3. order `accumulateCastProgress` branches by semantic kind;
4. update documentation from assistant-only spend to reconciled weighted spend;
5. label the formatted numerator/denominator as weighted tokens.

No changes to `CastProgress` fields or `CastProgressFormat` fields.

### Modify `src/engine/cast-core.test.ts`

Responsibilities added:

- load the committed sanitized JSONL excerpts;
- replay captured token behavior through the production fold;
- replay captured sidechain census through the production fold;
- pin tolerance and label;
- pin malformed/sidechain no-op behavior for new branches.

Existing progress expectations change only where the operator-facing label changes or where a
formerly ignored valid terminal usage is now authoritative.

### Modify `src/engine/cast.test.ts`

One integration assertion captures the exact stdout refresh sequence produced by `castPlay`.
Update only its expected text from `tokens` to `weighted tokens`.

The fake executor events, clock, transcript behavior, and shell assertions remain unchanged. This
test is outside the story's conceptual decision core but is a necessary consumer update for the
intentional formatter contract change.

### Add `src/engine/fixtures/T-081-02-01/README.md`

Document:

- source run IDs and local transcript paths;
- extraction date;
- retained accounting fields;
- removed sensitive/irrelevant fields;
- expected replay values;
- why the fixtures are evidence, not general executor schemas.

### Add `src/engine/fixtures/T-081-02-01/token-spend-excerpt.jsonl`

Commit the sanitized 19-record excerpt produced by `T-081-01-01`:

- 17 assistant endpoint records representing nine IDs;
- one aggregate main-stream thinking record totaling 15,419;
- one terminal result with the four cumulative usage buckets and `num_turns: 20`.

The fold ignores underscore-prefixed audit metadata.

### Add `src/engine/fixtures/T-081-02-01/turn-sidechain-excerpt.jsonl`

Commit the sanitized 50-record excerpt produced by `T-081-01-01`:

- 12 parent assistant IDs;
- 33 sidechain assistant IDs split 4/9/11/9;
- five usage-less result rows retaining their observed `num_turns` values.

Usage objects remain empty because this fixture proves admission and counting. A focused synthetic
test supplies non-zero usage to prove that the same admission gate controls weighted spend.

## Public interface

### Existing `CastProgress`

Unchanged:

```ts
interface CastProgress {
  readonly weightedTokens: number;
  readonly turns: number;
  readonly seenMessageIds: readonly string[];
}
```

Meaning becomes more complete:

- `weightedTokens` is a live estimate from main assistant usage plus explicit main thinking
  deltas, reconciled to authoritative cumulative result usage when observed;
- `turns` is distinct main-stream assistant IDs;
- `seenMessageIds` contains only admitted main assistant IDs.

No migration is required because state shape and zero value remain identical.

### New exported constant

```ts
export const CAST_PROGRESS_LEDGER_TOLERANCE = 0;
```

This is a behavioral contract, not configuration. It names the maximum accepted absolute
difference in weighted tokens between terminal progress and ledger truth for canonical usage.

It is exported so the acceptance test can pin the named policy instead of duplicating an anonymous
literal.

### Existing `accumulateCastProgress`

Signature unchanged:

```ts
(state: CastProgress, msg: StreamMessage) => CastProgress
```

Branch ordering:

```text
marked sidechain
  └─ return same state

valid result usage
  └─ replace weightedTokens with canonical cumulative count

valid thinking delta
  └─ add canonical output-weighted delta

new valid assistant ID + usage
  └─ add canonical usage, increment turns, remember ID

everything else
  └─ return same state
```

Result and thinking records never change `turns` or `seenMessageIds`.

### Existing `formatCastProgress`

Signature unchanged. The textual contract changes in one segment:

```text
<used>/<envelope> tokens
```

becomes:

```text
<used>/<envelope> weighted tokens
```

Elapsed time, human rounding, turn cap, and detect-after semantics remain intact.

## Private helpers

### Sidechain classifier

Input: open `StreamMessage`.

Output: boolean.

Rule: `parent_tool_use_id !== null && parent_tool_use_id !== undefined`.

This helper is applied once at the start of the fold so every counter shares one admission rule.

### Thinking delta extractor

Input: open `StreamMessage`.

Output: finite non-negative number or `null`.

It recognizes only `system/thinking_tokens`. It does not perform weighting; the fold passes the
delta to `countTokens` as output usage.

### Terminal usage extractor

Input: open `StreamMessage`.

Output: `Usage` or `null`.

It recognizes only `result` with a non-array object `usage`. The structural cast is safe for
`countTokens`, whose optional known fields are individually checked for finite numeric values.

## Immutability and identity

Changed progress values remain frozen objects.

For result reconciliation:

- if canonical terminal spend differs, create a frozen shallow replacement preserving the same
  immutable ID array;
- if it is identical, return the original state.

For thinking deltas:

- invalid or zero deltas return the original state;
- positive deltas create a frozen replacement preserving turns and IDs.

For assistant records, retain the existing frozen new array behavior.

Sidechain and unknown records always return the original state by identity.

## Test organization

Keep the existing `describe("cast progress …")` block as the behavioral home.

Add a small asynchronous fixture loader near the block or module top:

```ts
readJsonlFixture(name): Promise<StreamMessage[]>
```

It resolves only under `./fixtures/T-081-02-01/`, trims trailing whitespace, splits lines, and
parses each JSON object.

Focused tests:

1. captured token replay and terminal tolerance;
2. captured sidechain replay and both-counter filtering;
3. invalid thinking/result and marked sidechain no-ops;
4. existing formatter cases with the new label.

The captured token test should retain the terminal record separately so it can assert the
pre-terminal value before asserting exact reconciliation.

## Commit ownership

One implementation unit owns these exact repository-relative paths:

- `src/engine/cast-core.ts`;
- `src/engine/cast-core.test.ts`;
- `src/engine/cast.test.ts`;
- `src/engine/fixtures/T-081-02-01/README.md`;
- `src/engine/fixtures/T-081-02-01/token-spend-excerpt.jsonl`;
- `src/engine/fixtures/T-081-02-01/turn-sidechain-excerpt.jsonl`.

They must be committed together with `lisa commit-ticket` after focused and full gates pass,
because the formatter contract and all exact-text consumers must move atomically.

Lisa-managed ticket/provenance files and attempt artifacts are excluded from the ticket commit.

## Verification boundaries

Pure fixture replay proves:

- the real captured token arithmetic;
- the real captured parent/sidechain population;
- exact terminal agreement;
- label text;
- total behavior over invalid records.

The existing shell test proves the changed formatter still reaches stdout through the unchanged
`onMessage` wiring.

`bun run check` proves generated BAML stability, strict type compatibility, and repository-wide
regression safety.

No funded cast is part of this structure; epic closure owns the fresh installed-binary proof.
