# Design — T-079-03-02 settle rides the cord

## Decision drivers

- Consume the exact v1 marker defined by the completed seam ticket.
- Print project, completed-ticket count, and loop duration in the settle verdict.
- Print that provenance at most once for one pending marker.
- Leave malformed evidence pending and visible.
- Do not lose a valid marker when settle fails before a verdict.
- Do not let consumption delete a newer producer replacement.
- Fire settle from Lisa's existing complete hook without adding a daemon or user gesture.
- Preserve pure core / impure shell and the existing free CLI contract.
- Keep hook failures non-fatal to Lisa.

## Option 1 — Read and delete in the CLI dispatcher

The CLI could read `.vend/loop-settled.json`, prepend a provenance line to rendered text, and delete
the file after `runSettle` returns.

Advantages:

- Small local diff.
- No change to the settle core result type.
- Directly adjacent to stdout.

Costs:

- Marker validation and lifecycle would live outside the existing settle abstraction.
- Tests calling `runSettle` would not exercise the real consumer.
- A raw rendering prefix could drift from typed result semantics.
- The read/delete interval spans the full settle operation and could delete a newer replacement.
- A malformed loop marker would need a second refusal mechanism in CLI code.

Decision: reject. The CLI should remain dispatch/presentation glue, not own state judgment.

## Option 2 — Let the impure shell parse and inject optional provenance

`runSettle` could strictly parse the marker and pass `LisaLoopSettledMarker | null` to a widened pure
core input, then delete the stable path after a verdict.

Advantages:

- Reuses the dependency's strict parser.
- Adds provenance to the typed result and renderer.
- Keeps filesystem work out of the pure core.

Costs:

- The pure core would not itself pin malformed-loop refusal from raw persisted bytes.
- Read-then-delete retains the producer replacement race.
- Two callers could read and print the same marker before either deletes it.

Decision: reject as incomplete. Typed provenance is right, but ownership must be claimed before the
long-running settle observation.

## Option 3 — Atomically claim, compute with raw bytes, finalize or restore

Before observation, `runSettle` atomically renames the stable marker to a unique sibling claim.
Only the process that wins the rename receives those bytes. The bytes are passed to the pure core,
which delegates validation to the seam parser and returns either a typed provenance-bearing verdict
or a malformed-loop refusal. On a verdict, the last-settle marker is written first and the claimed
loop marker is removed. On refusal or thrown failure, the claimed marker is restored to the stable
name without overwriting any newer stable marker.

Advantages:

- One stable marker can produce provenance in at most one concurrent settle.
- A newer producer event can publish at the stable name while an older marker is claimed.
- Final consumption cannot unlink a newer marker.
- Raw malformed bytes remain handled by the pure result policy.
- Failure can restore pending evidence.
- The effect lifecycle is explicit and testable.

Costs:

- Adds a small claim/restore helper and temporary path lifecycle.
- A process crash can leave a unique claim sibling; crash recovery is not part of current
  acceptance and the producer's next event remains able to publish stable state.
- Concurrent ordinary settles may still both print board verdicts, but only one can carry the loop
  provenance; the ticket's exactly-once marker contract is preserved.

Decision: choose this option.

## Restore semantics

Restoration must not replace a newer stable marker. The claim is hard-linked back to the stable path:

- if the stable path is absent, `link(claim, stable)` succeeds atomically and the claim name is
  removed;
- if the stable path exists, a newer producer marker already supersedes the older singleton, so the
  old claim is removed without replacing the newer event;
- other restoration errors propagate after best-effort cleanup and stay visible.

This follows the dependency contract's latest-pending-singleton semantics. It also keeps malformed
bytes at the canonical stable path when no replacement event has arrived.

## Pure result design

`ComputeSettleInput` gains `loopSettledContents: string | null`.

`SettleVerdict` gains `loop: LisaLoopSettledMarker | null`. The seam marker type is imported with a
type-only import; parsing uses the existing pure parser.

The core validates loop bytes before deriving verdict claims:

- absence yields `loop: null`;
- valid bytes yield the frozen typed marker;
- malformed bytes yield a `malformed-loop-settled-marker` refusal naming the canonical path and an
  exact repair/rerun action.

`SettleRefusal` becomes a union covering malformed last-settle and malformed loop-settled state.
Existing last-settle behavior remains byte- and wording-compatible.

## Render design

For a valid pending marker, the renderer adds one line directly after the `settle` heading:

```text
loop: vend — 2 tickets done in 41s
```

The line is omitted when no marker is pending. This keeps second-settle output honest: it still
prints the ordinary current-board verdict, but never repeats consumed loop provenance.

Counts use the existing singular/plural helper so `1 ticket done` and `2 tickets done` are both
grammatical. Duration remains exact integer seconds because that is the Lisa contract fact.

## Effect ordering

The chosen successful path is:

1. Atomically claim an optional loop marker.
2. Read claimed bytes.
3. Load board, last-settle state, and review concerns.
4. Run the repository gate and presweep.
5. Compute the typed result including marker validation.
6. If refusal, restore the claim and return the refusal.
7. If verdict, atomically write `.vend/last-settle.json`.
8. Remove the claim, completing consumption.
9. Return the provenance-bearing verdict for rendering.

If any step before claim finalization throws, a `finally` path restores the marker. A red gate is
not a failure here: current settle semantics treat it as a successfully observed verdict containing
an exception, so it consumes the marker after persistence.

## Event-trigger design

The existing `.lisa/hooks/on-notify` complete branch remains the selected trigger. After the recorder
successfully creates the marker, the hook invokes the existing CLI entry as:

```text
bun run src/cli.ts settle
```

The invocation stays synchronous so its stdout/stderr remains attached to the complete event and is
directly observable. Its failure is contained so the hook still exits 0 and optional ntfy behavior
still runs. Settle is invoked only if recording succeeded and the CLI source is readable.

No new command, budget, config, watcher, daemon, or background service is introduced.

## Testing design

Pure tests will cover:

- valid marker bytes become exact typed provenance;
- absent marker becomes `null` provenance;
- malformed marker becomes the named refusal without board verdict claims.

Renderer tests will cover:

- exact provenance line with all three facts;
- singular ticket count;
- no provenance line when `loop` is null;
- malformed-loop refusal rendering.

Effect/integration tests will cover:

- a fixture marker is consumed after a successful `runSettle`;
- a second settle has no provenance and the marker remains absent;
- malformed bytes refuse and remain at the stable path;
- the real complete hook records, invokes settle, prints provenance once, and leaves no pending
  marker;
- a direct second settle after that event never prints the consumed provenance again.

Existing CLI tests continue to prove the command remains free and executor/ledger independent.

## Rejected scope

- No standing watch.
- No process-crash recovery registry for abandoned claim siblings.
- No marker history or queue; the contract is a latest-pending singleton.
- No changes to the producer schema or Lisa environment contract.
- No changes to ntfy content.
- No automatic pull or sweep.
- No changes to ticket frontmatter or shared work artifacts.
