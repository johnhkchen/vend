# Review — T-079-03-02 settle rides the cord

## Disposition

Pass. The ticket acceptance is met, the complete event path is covered end-to-end with fixtures,
ticket-owned source is committed, and `bun run check` is green.

## What changed

The previously independent Lisa loop-settled producer and Vend settle verdict are now joined.
`vend settle` strictly validates an optional `.vend/loop-settled.json`, carries its typed provenance
into the one-screen verdict, and consumes it only after the terminal verdict continuation has been
persisted. The existing Lisa `on-notify complete` hook now invokes the already-free settle CLI after
successful recording, eliminating the typed relay/inspection gesture.

Successful output contains either:

```text
loop: vend — 5 tickets done in 120s
```

or, once consumed:

```text
loop: none pending
```

## File review

### `src/settle/settle-core.ts`

- Reuses `parseLisaLoopSettledMarker`; there is no duplicate or weakened schema check.
- Adds raw optional loop bytes to the pure input.
- Adds typed optional loop provenance to a verdict.
- Adds a closed `malformed-loop-settled-marker` refusal with the canonical Vend path and repair action.
- Keeps persisted-state defects as returned data rather than thrown control flow.
- Adds no filesystem/process/clock/network effect.

### `src/settle/settle.ts`

- Claims a pending marker with atomic rename before observation.
- Prevents two settle operations from carrying the same stable marker concurrently.
- Restores on refusal or thrown failure.
- Uses non-clobbering hard-link restoration so a newer complete event is never overwritten.
- Advances last-settle before final consumption.
- Removes only the claimed name, never a newer stable producer marker.
- Renders all three provenance facts and the explicit empty state.
- Retains the existing no-executor/no-budget/no-ledger boundary.

### `.lisa/hooks/on-notify`

- Uses only Lisa's already-selected `complete` event.
- Records before triggering settle.
- Invokes the existing CLI instead of adding another command surface.
- Preserves terminal output for the operator.
- Contains failures so Lisa and optional ntfy remain non-blocking.
- Leaves attention and notification content unchanged.

### Tests

- `src/settle/settle-core.test.ts` pins schema admission and refusal policy.
- `src/settle/settle.test.ts` pins rendering, consume-on-verdict, immediate repeat, and malformed
  retention through real filesystem/gate/presweep effects.
- `src/seam/lisa-loop-settled.test.ts` exercises the actual hook, recorder, CLI, marker, fixture Git
  repository, second settle, and topic-free path.

## Acceptance evaluation

### With a fixture marker present, `vend settle` prints loop provenance

Pass.

- Direct effect fixture supplies project `fixture-project`, one completed ticket, and 12 seconds.
- `runSettle` returns the exact typed marker facts.
- Rendering asserts `loop: fixture-project — 1 ticket done in 12s`.
- The real-hook fixture asserts its dynamic project basename plus five tickets and 120 seconds.

### Settle consumes the marker

Pass.

- The stable marker is atomically claimed before observation.
- The last-settle continuation is atomically written first.
- The claim is removed only after a verdict.
- The direct effect and hook fixtures both assert the stable marker is absent after success.

### A second settle shows none pending

Pass.

- Direct effect coverage calls `runSettle` twice.
- Real event coverage invokes the hook once and the CLI a second time.
- Both assert no old provenance is present.
- Both assert the explicit `loop: none pending` terminal line.
- The event fixture also asserts the stable marker remains absent.

### Event path fires exactly once per marker

Pass.

- The selected existing `on-notify complete` hook is the trigger; no watcher was introduced.
- The hook only invokes settle after a successful recorder call.
- The event test asserts exactly one line beginning with `loop: ` for the complete event output.
- Atomic claim removes the marker from circulation before the long gate observation.
- The second invocation cannot re-read or re-render that provenance.

### Never re-fires a consumed marker

Pass.

- Second-settle output omits the old project provenance and says none pending.
- The stable marker stays absent after the second invocation.
- Latest-pending singleton semantics are preserved if a producer publishes a newer marker.

## Regression review

- Existing last-settle delta behavior remains and is exercised by prior tests.
- Existing CLI parsing remains untouched: `settle` is still bare, free, and rejects `--budget`.
- Existing run ledger and executor boundaries remain untouched.
- Existing red exceptions and refusal ANSI behavior remain covered.
- Existing marker producer schema and bytes remain unchanged.
- Existing hook ntfy messages and attention paths remain unchanged.
- One-way authority remains: all consumed/claimed/persisted state is below `.vend/`; Vend writes no
  Lisa journal, ticket, or hook configuration at run time.

## Test coverage

Focused suite:

- 62 pass;
- 0 fail;
- 183 expectations;
- pure seam schema, seam effect, hook integration, pure settle policy, settle effect, and rendering.

Full gate after the final source commit:

- BAML generation passed;
- TypeScript `tsc --noEmit` passed;
- 1,899 tests passed;
- 1 pre-existing intentional dist-dependent test skipped;
- 0 failures;
- 6,148 expectations across 125 files.

## Commit review

Three path-limited Lisa transactions contain all ticket-owned changes:

- `9896aa5` — typed consumer, lifecycle, and focused tests;
- `d2a906c` — existing-hook trigger and full event fixture;
- `9738703` — explicit none-pending terminal state.

Each used exact repository-relative includes. No ordinary index operation was used. Ticket-owned
source paths are clean.

## Open concerns and honest boundary

No acceptance-blocking issue remains.

The story's declared honest boundary remains: tests simulate Lisa's documented complete event through
the real project hook, but this ticket does not claim observation of a live multi-ticket Lisa loop in
operation.

A hard process kill after the marker is renamed to its unique `.settling` claim and before `finally`
restores it can leave that ignored sibling for manual diagnosis. Ordinary typed refusals, gate
results, and thrown failures are covered by restoration; the limitation is abrupt process death.
Crash-claim scavenging would be adjacent durability work, not needed to satisfy the fixture-driven
exactly-once lifecycle accepted here.

No automatic pull, watcher, daemon, TUI, notification-content revision, or Lisa machinery was added.
The result stays within the story slice and advances P4/P2 by removing a relay gesture.
