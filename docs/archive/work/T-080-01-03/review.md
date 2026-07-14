# Review — T-080-01-03 settle surfaces cord failure

## Disposition

Pass.

The ticket acceptance is implemented, focused and full verification are green, the exact
ticket-owned source unit is committed through Lisa, and no ticket-owned source remains modified,
staged, or untracked.

## Outcome

`vend settle` now closes the remaining silent recorder gap. When the local Lisa seam failure log is
newer than the latest successful claim/acknowledgement, settle returns a normal verdict carrying the
latest admitted reason and renders:

```text
cord: last recording failed — <reason>
```

The reason is JSON-decoded and preserved verbatim. The line is ordinary, uncolored verdict context;
it is not a refusal, exception, gate failure, next action, or blocker.

No log means no cord line. A current successful marker claim or prior successful verdict whose
filesystem mtime is equal to or newer than the trace suppresses stale evidence. Once a fresh warning
is shown, the normal last-settle continuation write acknowledges that observation, so an immediate
repeat is quiet without truncating or modifying the append-only failure history.

## Source commit

- Full hash: `db93977d42f1c17c88b0d29c30502ee41fe1bf79`.
- Short hash: `db93977`.
- Subject: `fix(settle): surface recorder cord failures`.
- Created with `lisa commit-ticket --ticket-id T-080-01-03`.
- Used exact repeated repository-relative `--include` paths.
- No ordinary `git add`, `git add -A`, or `git commit` was used.
- Summary: 5 files changed, 311 insertions, 16 deletions.

Exact committed paths:

1. `docs/knowledge/lisa-loop-settled-contract.md`
2. `src/settle/settle-core.test.ts`
3. `src/settle/settle-core.ts`
4. `src/settle/settle.test.ts`
5. `src/settle/settle.ts`

## File review

### `src/settle/settle-core.ts`

Added `SettleCordObservation`, a plain-value boundary containing:

- optional failure-trace contents;
- optional failure-trace modification time;
- optional latest successful claim modification time.

This preserves pure-core/impure-shell separation. The core does not read files, stat paths, consult
a clock, or mutate trace state.

Added `cordFailureReason`, a pure selector which:

1. requires present trace bytes and a finite nonnegative trace mtime;
2. suppresses the trace when a finite nonnegative claim watermark is equal or newer;
3. scans nonblank physical JSONL lines from tail to head;
4. parses each candidate without throwing;
5. requires an exact two-field `timestamp`/`reason` object;
6. requires canonical ISO-8601 UTC timestamp text;
7. requires a nonblank reason;
8. returns the first admitted reason without trimming or rewriting it;
9. returns null when no valid applicable record exists.

Tolerating malformed diagnostic lines is deliberate. The failure trace is advisory context; it
must not block the board/gate verdict. This remains distinct from malformed loop-marker bytes, which
continue to refuse because settle would otherwise claim invalid provenance.

Extended `SettleVerdict` with `cordFailureReason: string | null` and `ComputeSettleInput` with the
cord observation. Verdict assembly computes this field without altering loop parsing, last-settle
parsing, epic clearance, delta, gate, presweep, review concerns, exceptions, or next marker.

No persisted marker schema changed.

### `src/settle/settle.ts`

Optional file observation now returns UTF-8 contents plus `mtimeMs`. It is used for:

- `.vend/last-settle.json`;
- `.vend/lisa-loop-settled-failures.jsonl`.

The atomic loop claim now retains the claimed inode's `mtimeMs` beside its bytes. Failure while
reading either bytes or metadata goes through the pre-existing claim restoration path.

`runSettle` computes the latest claim watermark as the maximum available mtime from:

- the preceding successful `.vend/last-settle.json` continuation;
- the current claimed `.vend/loop-settled.json` marker.

This lets a marker newer than the failure log suppress stale evidence on the same verdict, while a
failure newer than an old pending marker stays visible. No new timestamp is minted and neither
closed marker schema needs migration.

The transaction order remains:

1. atomically claim optional marker;
2. observe graph, local state, gate, presweep, and reviews;
3. compute typed result;
4. restore claim on refusal/throw;
5. write last-settle continuation on verdict;
6. consume only the claimed marker.

Renderer behavior adds the exact cord line immediately after the loop line only when the field is
non-null. It does not call `red()` and does not enter refusal or exception rendering.

### `src/settle/settle-core.test.ts`

Added pure coverage for:

- no prior claim plus valid trace;
- trace strictly newer than claim;
- absent trace;
- claim newer than trace;
- claim equal to trace;
- malformed newest line falling back to an earlier admitted record;
- invalid-only diagnostic bytes returning null;
- exact preservation of leading/trailing spaces, tab, and embedded newline;
- full verdict integration carrying the exact reason with no exception.

The default aggregate fixture now supplies an absent cord observation, keeping every existing
settle behavior explicit and green.

### `src/settle/settle.test.ts`

The manual verdict fixture now proves the exact cord line appears on a normal verdict. It also proves
the line is not ANSI-red and does not increase exception color counts.

The immediate-repeat renderer fixture explicitly carries null cord state and proves no line.

The existing no-log marker lifecycle now explicitly proves:

- `cordFailureReason` is null;
- rendered output has no cord line;
- marker provenance and consumption remain unchanged.

The fresh-failure lifecycle creates a real temporary Git repository, establishes a prior successful
settle, writes one producer-compatible trace record, and uses filesystem `utimes` for deterministic
ordering. It proves:

- trace newer than prior claim returns `kind: verdict`;
- the typed reason is exact;
- the rendered line is exact;
- the failure log remains byte-identical;
- an immediate repeated settle suppresses the already-observed warning.

The newer-success lifecycle writes both a failure log and valid marker, sets the marker mtime newer,
then proves:

- normal loop provenance is present;
- cord failure is null;
- no cord line renders;
- successful marker consumption still occurs.

### `docs/knowledge/lisa-loop-settled-contract.md`

Updated the durable crossing contract to describe implemented consumer behavior rather than defer it
to a future ticket. It now records:

- tolerant newest-valid JSONL scanning;
- filesystem mtime freshness watermark;
- exact visible line;
- equal/newer claim suppression;
- one-verdict acknowledgement through the normal continuation;
- non-blocking distinction between diagnostic trace corruption and provenance-marker corruption;
- read-only treatment of the append-only trace;
- settle core/shell tests as executable proof.

The no-retry/no-delivery-guarantee honest boundary is preserved.

## Acceptance review

### Log newer than last claim renders exact reason

Pass.

Both pure and filesystem lifecycle tests establish a strictly newer trace. The returned result is a
verdict whose `cordFailureReason` equals the producer reason, and rendering contains the required
line.

### Reason is verbatim

Pass.

The standard lifecycle asserts exact classifier text. Pure coverage additionally admits a reason
with spaces, a tab, and embedded newline through JSON and expects byte-for-byte string equality
after parsing. Production code validates nonblankness but returns the original string.

### No log renders no cord line

Pass.

The pre-existing valid-marker lifecycle has no trace file and now explicitly asserts both null typed
state and absence of `cord:` in rendered output.

### Successful claim newer than log renders no cord line

Pass.

The filesystem lifecycle sets trace mtime to 100 seconds and valid marker mtime to 200 seconds,
then asserts loop provenance, null cord state, no rendered line, and successful marker consumption.

### Visible verdict line, never a refusal

Pass.

Fresh-trace lifecycle asserts `kind: verdict`. Pure integration asserts no exception. Renderer tests
prove ordinary uncolored text. Invalid diagnostic bytes resolve to null rather than refusal. Existing
malformed provenance marker refusal tests remain green and separate.

### Repository gate

Pass.

`bun run check` completed successfully:

- BAML client generation: passed;
- strict TypeScript (`tsc --noEmit`): passed;
- tests: 1,941 passed, 1 intentionally skipped, 0 failed;
- expectations: 6,363;
- scope: 1,942 tests across 126 files;
- elapsed Bun test time: 17.81 seconds.

Focused settle verification separately completed with 41 passed, 0 failed, and 166 expectations.
`git diff --check` was clean on all five committed paths.

## Architecture and scope review

- Pure core / impure shell remains intact.
- The append-only trace remains read-only to settle.
- The successful singleton marker remains the only consumed seam state.
- No new persistent schema, version, migration, sidecar, or clock was introduced.
- No executor, budget, network, play, or run-ledger path entered settle.
- No Lisa hook, environment contract, notification content, or containment changed.
- No retry, queue, replay, rotation, or delivery claim was added.
- No CLI argument or new user gesture was introduced.
- No sweep or epic-list/baseline behavior changed.
- Ticket phase/status frontmatter was not edited by this worker.

## Open concerns and honest limitations

- Freshness relies on local filesystem modification times. Copy/restore tooling can change those
  metadata values; this is acceptable for local diagnostic state but is not a distributed ordering
  protocol.
- Equality is suppressed because acceptance says “newer.” On a filesystem with coarse mtime
  precision, two very close writes can compare equal and conservatively read as acknowledged.
- Contents and metadata are read in two operations. A concurrent append between them can defer or
  repeat advisory display, but cannot mutate evidence, corrupt marker ownership, or block settle.
- A malformed newest trace line falls back to the most recent earlier valid record. This preserves
  useful evidence and autonomy but does not itself announce trace corruption.
- Reasons containing embedded newlines are preserved verbatim and can occupy multiple terminal
  rows. That follows the producer/verbatim contract rather than silently sanitizing evidence.
- A recorder that never starts, or a filesystem that rejects both marker and trace writes, still
  cannot leave evidence. This is the parent story's explicit honest boundary.

None of these limitations blocks the ticket acceptance.

## Worktree review

All five ticket-owned committed paths are clean and the ordinary Git index is empty. Remaining
modified/untracked paths are Lisa-owned provenance, ticket-transition, and admitted-work publication
state. They were deliberately excluded from the ticket commit.

## Final assessment

The cord failure is now visible at the next free local verdict, exact producer diagnostics survive
the crossing, later success clears stale evidence, and settle remains autonomous and non-blocking.
Ready for Lisa completion publication.
