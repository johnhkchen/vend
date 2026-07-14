# Progress — T-082-01-01 run-log cap-window marker

## Status

Implementation complete, verified, and committed. Review remains the only phase at
the time this artifact is written.

## Completed workflow phases

- Research completed in `research.md`.
- Design completed in `design.md`.
- Structure completed in `structure.md`.
- Plan completed in `plan.md`.
- Implementation completed in the two planned source files.
- Focused and repository-wide verification completed successfully.
- Ticket-owned source committed through `lisa commit-ticket` with exact includes.

## Implemented public contract

Added to `src/log/run-log.ts`:

```ts
export interface CapWindowExhausted {
  readonly signal: string;
  readonly reason: string;
}
```

Added the optional field to both ledger faces:

```ts
readonly capWindowExhausted?: CapWindowExhausted;
```

The field name is event-shaped and one-way:

- present means settlement recorded provider reset-window exhaustion;
- absent means no such event was recorded or the row is historical;
- it is not a broader generic `rateLimited` or `providerError` field;
- it does not assert a numeric quota the repository cannot source.

## Implemented normalization

Added `normalizeCapWindowExhausted` in the pure run-log core.

The normalizer:

- requires a non-empty `signal` string;
- requires a non-empty `reason` string;
- treats the two facts atomically;
- returns `undefined` for missing, partial, empty, or malformed values;
- rebuilds a valid marker in deterministic `{ signal, reason }` order;
- drops unknown nested keys;
- preserves accepted values verbatim;
- applies no executor or provider policy.

## Write-face integration

`buildRunRecord` now:

- normalizes `input.capWindowExhausted` once;
- includes the field only when the marker is complete;
- places it immediately after `seatOfExecution` in canonical object order;
- leaves all pre-existing fields and their order unchanged;
- returns the same frozen normalized record shape as before.

`serializeRunRecord` remains unchanged.

## Read-face integration

`reviveRecord` now:

- guards the raw optional value as a non-null object;
- passes it through the same pure normalizer as the write face;
- drops partial, malformed, and non-object marker data;
- retains the containing run record;
- places a valid revived marker in the same canonical order as build;
- synthesizes nothing for historical rows.

`readRuns`, `loadRunLog`, and filesystem effects remain unchanged.

## Single-sourced surrounding facts

The marker does not duplicate:

- execution lane (`seatOfExecution`);
- burn (`usage`, interpreted by `totalTokens`);
- event time (`endedAt`);
- model (`model`);
- terminal classification (`outcome`).

This keeps future capacity learning compositional and prevents contradictory copies.

## Test implementation

Added one focused `capWindowExhausted` describe block with seven tests:

1. Complete `signal` and `reason` survive build → serialize → revive.
2. A marked revived record reserializes byte-identically.
3. An absent marker builds to a literal pre-feature JSONL line byte-for-byte.
4. The same historical marker-less line revives and reserializes byte-for-byte.
5. A partial build marker is omitted atomically and equals absent-marker bytes.
6. A complete marker is canonically copied without an extra diagnostic key.
7. Malformed nested and non-object read values are omitted without losing their run
   rows (covered as two separate tests).

The test group uses fabricated data only and makes no provider call.

## Verification evidence

### Baseline

Before source modification:

```text
bun test src/log/run-log.test.ts
132 pass
0 fail
306 expect() calls
```

### Focused post-change suite

```text
bun test src/log/run-log.test.ts
139 pass
0 fail
325 expect() calls
```

### Typecheck

```text
bun run build
$ tsc --noEmit
exit 0
```

### Diff hygiene

```text
git diff --check -- src/log/run-log.ts src/log/run-log.test.ts
exit 0
```

### Repository gate

```text
bun run check
BAML generation: pass
Typecheck: pass
Full suite: 1956 pass, 1 skip, 0 fail
6438 expect() calls
126 test files
exit 0
```

The one skipped test is the repository's pre-existing local-dist integration test,
which reports its intentional skip when no `dist/` artifacts are present.

## Commit

The source unit was committed with:

```text
lisa commit-ticket \
  --ticket-id T-082-01-01 \
  --message "feat(log): record cap-window exhaustion (T-082-01-01)" \
  --include src/log/run-log.ts \
  --include src/log/run-log.test.ts
```

Result:

```text
377ac7a454ecac8a68c3bb8281baddf69c5243ed
```

Commit inspection confirms exactly two files:

- `src/log/run-log.ts`
- `src/log/run-log.test.ts`

Commit summary: 130 insertions, no deletions.

Both ticket-owned source paths are clean after commit. The ordinary index has no
staged paths.

## Worktree handling

- `.lisa/provenance.jsonl`, ticket frontmatter, and the shared work directory changed
  under Lisa while this attempt ran.
- These paths were not included in the scoped source commit.
- The attempt did not write artifacts directly to `docs/active/work/T-082-01-01/`.
- Lisa published detected private artifacts there during the run, consistent with
  the assignment contract.
- No unrelated worktree change was reset, staged, or committed.

## Deviations from plan

No functional or scope deviation.

One command-syntax correction was made before committing: the installed CLI requires
`--ticket-id` and `--message`, as confirmed with `lisa commit-ticket --help`; the
plan's illustrative positional form was not used.

## Explicitly not implemented

- No executor failure classifier.
- No cast settlement wiring.
- No new run outcome.
- No provider-specific imports.
- No lane-capacity learning.
- No quota-fraction heat.
- No budget or wallet denomination.
- No mid-run interception or rerouting.
- No historical ledger migration or backfill.
- No live provider-cap proof.
- No manual ticket phase/status edit.

## Remaining work

- Complete `review.md`.
- Write `review-disposition.json`.
- Stop on this ticket and wait for Lisa to publish/complete it.
