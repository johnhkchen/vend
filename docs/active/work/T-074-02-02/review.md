# Review — T-074-02-02 wire counter-time underfunding warning

## Verdict

PASS. The ticket acceptance criterion is met by committed source and tests.

A severely underfunded cast with a measured shelf floor now prints the settled advisory before
dispatch and proceeds with the supplied budget. Cold-start and adequately funded cases write no
warning bytes. Named/pressed runs and the direct Steer gesture use one shared funding-counter
wrapper. The full repository gate is green.

## Commits

```text
ca184a0576f5748cf2c3cde7672976b8302c6b62
feat(shelf): add shared funding counter

359ec205c20707fa5f8a93ab75c7a4f8b00ac598
feat(cli): warn on measured underfunding before cast
```

Both commits were made with `lisa commit-ticket --ticket-id T-074-02-02` and exact repository-relative
include paths.

## Files created

### `src/shelf/funding-counter.ts`

New 60-line shared counter composition.

It exports:

```ts
fundingWarningFor(play, funded, records): string | null
withFundingCounter(play, funded, cast, opts?): Promise<T>
```

The pure half uses `shelfRows([play], records)`, so it inherits the existing:

- play-name record isolation;
- rarity-to-value-tier mapping;
- percentile recalibration;
- authored-budget cold-start prior;
- measured/default provenance distinction.

It calls the predecessor `underfundingWarning` only for measured confidence.

The wrapper owns the effects:

- load `<projectRoot>/.vend/runs.jsonl`;
- compute the decision;
- write a warning plus one newline when present;
- invoke and return the supplied cast callback.

The callback sits outside the warning condition. Warn-don't-block is therefore structural, not a
message-only claim.

### `src/shelf/funding-counter.test.ts`

New 112-line addon-free suite with eight Bun tests.

It constructs plain play stubs and canonical run records without importing a concrete BAML-backed
play, dispatcher, or executor.

## Files modified

### `src/play/dispatch.ts`

The registry-hit path now wraps `assembleAndCast` with `withFundingCounter`.

The registry miss remains an immediate return, preserving unknown-play behavior and output.

This one edit covers:

- `vend run <play>`;
- `vend <selection>`, because `pressShelf` already calls `runPlay` for every planned run.

No duplicate counter logic was added to `press.ts`.

### `src/cli.ts`

The Steer branch now wraps its existing `castSteer({ budget })` call with the shared counter.

The branch still owns:

- explicit/default budget selection;
- the existing funding echo;
- the direct Steer input assembly/cast;
- summary rendering;
- exit-code mapping.

Only the counter-time warning was inserted between funding acknowledgement and cast.

## Files intentionally unchanged

- `src/shelf/underfunding-core.ts`: factor and message were settled by T-074-02-01.
- `src/shelf/shelf-row.ts`: remains the canonical recalibration composition.
- `src/ledger/recalibrate.ts`: no percentile or provenance policy changed.
- `src/shelf/press.ts`: existing `runPlay` call supplies the wiring.
- `src/shelf/press-core.ts`: selection/staleness decisions remain funding-policy-free.
- `src/play/steer.ts`: play definition, authored budget, and cast assembly remain unchanged.
- executor, budget tiers, run-log schema, and cast andons remain untouched.

## Behavioral review

### Field-report warning

Three successful 400k Steer records produce a measured 400k floor. Funding 12.5k produces exactly:

```text
⚠ underfunded: 12.5k tokens funded vs 400k measured floor; proceeding with funded budget
```

The wrapper appends exactly one newline at the output boundary.

### Ordering

The warned-case test captures this exact event sequence:

```text
write:<warning>\n
dispatch
```

The callback is invoked only after the writer call returns. The returned callback value is asserted
unchanged.

For explicit `vend steer --budget`, the existing funding echo remains before the wrapper, so the
operator sees funding acknowledgement, warning, then dispatch output.

### Proceed semantics

The warned test asserts:

- warning is emitted;
- dispatch callback runs exactly once;
- funded input still equals 12.5k;
- dispatch result is returned unchanged.

There is no auto-escalation, replacement budget, confirmation prompt, or refusal.

### Cold start

No records and fewer than three successful records both produce default confidence. The warning
writer is never called and the dispatch callback still runs.

### Adequate funding

A measured 400k floor funded at 400k produces no warning write and still dispatches.

### Per-play isolation

Measured Steer records do not cause a Survey play to warn. `shelfRows` delegates the join to the
existing per-play recalibration filter.

### Unknown named play

`runPlay` still returns its typed registry miss before entering the counter. The existing CLI test
for `missing-play` remains byte-identical and green.

## Test coverage

Focused calibration/counter suite:

```text
32 pass
0 fail
51 assertions
```

Focused wiring/CLI/press suite:

```text
133 pass
0 fail
236 assertions
```

Coverage includes:

- exact field-report message;
- measured provenance requirement;
- cold-start silence at zero and two successes;
- adequate measured silence;
- per-play record isolation;
- warning-before-dispatch order;
- warned dispatch continuation;
- dispatch result passthrough;
- no blank writes on silent paths;
- existing CLI output behavior;
- existing press planning behavior;
- TypeScript compilation.

## Repository verification

`bun run check` was run before each meaningful source commit.

Final result after complete wiring:

```text
BAML generation passed
TypeScript typecheck passed
1721 tests passed
1 test skipped
0 tests failed
5302 assertions
116 test files
```

The single skip is the existing release-acceptance integration requiring local `dist/` artifacts.
It is unrelated to this ticket.

`git diff --check HEAD~2..HEAD` passed. Commit inspection confirms exactly four ticket-owned source
paths across the two commits.

## Acceptance assessment

Ticket clause: funding below the recalibrated measured floor prints a warning.

- PASS — the counter obtains the floor through `shelfRows` and gates on measured confidence.

Ticket clause: warning appears before dispatch.

- PASS — wrapper program order and captured event sequence pin write before callback.

Ticket clause: cast still proceeds.

- PASS — callback invocation and unchanged result are asserted in the warned field-report case.

Ticket clause: cold-start play prints nothing.

- PASS — zero-record and below-threshold cases return null; the wrapper writer receives no calls.

Ticket clause: adequately funded cast prints nothing.

- PASS — measured 400k versus funded 400k writes zero bytes.

Ticket clause: silent cases are byte-identical to today.

- PASS for observable output — no placeholder, blank line, or label is written; existing CLI tests remain
  green. The wrapper adds only a local ledger read before cast.

Ticket clause: field-report 12.5k versus approximately 400k is observable.

- PASS in deterministic fixture — exact values, exact message, ordering, and proceed semantics are pinned.

## Scope and architecture review

The design respects pure-core/impure-shell:

- threshold/message core remains pure;
- measured-floor composition remains pure over plain records;
- ledger/stdout live in the thin counter wrapper;
- concrete input assembly and executor work remain in existing cast callbacks.

The shared callback wrapper resolves the actual-code mismatch found in Research: pressed/named dispatch
already used `runPlay`, while Steer had a direct play-specific cast. Both now share counter behavior without
expanding `runPlay` into a generic play-input assembly system.

## Open concerns and limitations

No critical issue requires human attention.

Intentional limitations:

- Warning policy is token-only, matching T-074-02-01 and the ticket contract.
- A non-ENOENT run-log read failure still propagates as a real local-state error.
- The counter reads the run log immediately before each selected cast; a multi-selection press therefore
  recalibrates independently per run, favoring fresh truth over one cached batch.
- The real live ~400k Steer envelope was not spent against an executor in this ticket. The story explicitly
  defers that live field-report verification; the deterministic fixture proves the same ledger/calibration,
  output-order, and proceed path without consuming hundreds of thousands of tokens.
- The warning does not ask for confirmation and cannot block a deliberate thin probe, by design.

## Worktree note

Concurrent Lisa and T-074-01-02 changes remained present in the shared worktree during final inspection.
They were not edited or included by this ticket. Ticket-owned source files are committed and clean.

## Final handoff

The implementation is complete and honest against the story boundary. Lisa may publish the private phase
artifacts and complete the ticket. No follow-on ticket was started.
