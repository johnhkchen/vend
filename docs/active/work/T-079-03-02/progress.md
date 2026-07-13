# Progress — T-079-03-02 settle rides the cord

## Outcome

Implementation is complete. A Lisa whole-loop marker now becomes typed settle provenance, is printed
by the existing free verb, and is consumed exactly once after a successful terminal verdict. The
existing `on-notify complete` hook records the marker and invokes settle on the event path. A later
settle explicitly reports `loop: none pending` and cannot repeat the consumed provenance.

## Starting state

- Ticket phase on assignment: `research`.
- Parent story and both dependency tickets were complete and read first.
- Producer dependency already supplied the v1 marker schema, strict parser, recorder, hook crossing,
  fixture, and durable contract.
- Settle dependency already supplied the free no-argument CLI, pure verdict core, effect shell,
  one-screen renderer, last-settle frontier, and fixture acceptance test.
- Baseline focused suite: 56 passing tests across `src/settle` and `src/seam`.
- Existing unrelated worktree state was observed and left untouched.

## Phase artifacts completed

- `research.md`: mapped story scope, dependency contract, seam producer, settle consumer, hook, tests,
  state ordering, and file ownership.
- `design.md`: compared CLI-local, parse/inject, and atomic-claim approaches; selected atomic claim,
  typed provenance, and existing-hook triggering.
- `structure.md`: defined file changes, public/internal interfaces, ordering, dependencies, and commit
  units.
- `plan.md`: sequenced pure contract, lifecycle, rendering, event wiring, integration tests, commits,
  gate, and review.
- All artifacts were written only to the private attempt directory as assigned.

## Pure settle contract completed

Modified:

- `src/settle/settle-core.ts`
- `src/settle/settle-core.test.ts`

Changes:

- `ComputeSettleInput` now accepts optional raw Lisa loop-marker bytes.
- The existing dependency parser is the only schema admission path.
- `SettleVerdict` now carries `LisaLoopSettledMarker | null` as `loop`.
- `SettleRefusal` now includes `malformed-loop-settled-marker` alongside the existing last-settle
  refusal.
- Invalid JSON and closed-schema mismatches return named actionable refusal data.
- Valid project/count/duration facts pass through unchanged.
- Absent state is represented honestly as `loop: null`.
- Existing board, delta, gate, presweep, concern, exception, and continuation computation remains
  unchanged.

Verification:

- Pure settle tests passed after the widening.
- Typecheck exposed only the expected old verdict/input fixtures, which were then updated.

## Settle effect lifecycle completed

Modified:

- `src/settle/settle.ts`
- `src/settle/settle.test.ts`

Changes:

- `runSettle` atomically renames an optional stable loop marker to a unique claimed sibling before
  the long-running repository observation.
- Only the claimant receives and can print that marker's provenance.
- A typed refusal or thrown observation/persistence failure restores the claim.
- Restoration uses a hard link so it never replaces a newer producer marker at the stable path.
- A newer stable singleton wins and the superseded older claim is removed.
- A verdict writes `.vend/last-settle.json` before removing the claimed loop marker.
- Gate-red results continue to be terminal verdicts with red exceptions and therefore consume the
  marker after successful observation.
- Malformed bytes are restored byte-for-byte at `.vend/loop-settled.json` for diagnosis.
- Rendering prints `loop: <project> — <count> ticket(s) done in <seconds>s` for provenance.
- Rendering prints `loop: none pending` when the marker has already been consumed or never existed.

Coverage added:

- valid marker becomes exact typed provenance;
- invalid JSON and schema mismatch refuse;
- exact singular provenance line;
- valid marker is consumed after verdict;
- immediate repeat has `loop: null` and explicit none-pending output;
- malformed bytes remain pending byte-for-byte;
- no `.settling` sibling remains after handled refusal.

## Existing complete event wired

Modified:

- `.lisa/hooks/on-notify`
- `src/seam/lisa-loop-settled.test.ts`

Changes:

- The `complete` hook still invokes the dependency recorder first.
- Settle is invoked only when recording succeeds and the existing CLI entry is readable.
- Settle stdout/stderr is preserved so the terminal verdict reaches the event path.
- Recorder and settle failures remain contained; the hook still reaches optional ntfy behavior and
  exits successfully.
- Attention handling, ntfy topic resolution, and notification messages were not changed.
- No watcher, daemon, configuration flag, budget, executor, or new Lisa event was added.

Event fixture coverage now proves:

- no ntfy topic is required;
- one `complete` event prints exactly one provenance line;
- the line contains fixture project basename, five tickets, and 120 seconds;
- the pending marker is consumed;
- a second CLI settle exits 0, prints `loop: none pending`, and omits the old project provenance;
- the marker never reappears.

## Plan deviation

The initial renderer design omitted the loop line when no marker was pending. Acceptance says a
second settle “shows none pending,” so review tightened this to the explicit `loop: none pending`
line. The private design, structure, and plan artifacts were updated to reflect the decision before
final review. This was a presentation clarification, not a lifecycle or scope change.

The planned test assertion for claim cleanup initially used a local `find` subprocess. It remains a
test-only observation and passed, but no production dependency was introduced.

## Commits

All ticket-owned source commits used `lisa commit-ticket` with exact repeated `--include` paths.
No ordinary `git add`, `git add -A`, or `git commit` was used.

1. `9896aa5` — `feat(settle): consume Lisa loop provenance`
   - `src/settle/settle-core.ts`
   - `src/settle/settle-core.test.ts`
   - `src/settle/settle.ts`
   - `src/settle/settle.test.ts`
2. `d2a906c` — `feat(seam): trigger settle on Lisa completion`
   - `.lisa/hooks/on-notify`
   - `src/seam/lisa-loop-settled.test.ts`
3. `9738703` — `fix(settle): show empty loop state explicitly`
   - `src/settle/settle.ts`
   - `src/settle/settle.test.ts`
   - `src/seam/lisa-loop-settled.test.ts`

## Verification record

Focused final verification:

```text
bun test src/settle src/seam
62 pass, 0 fail, 183 expect() calls
```

Type verification:

```text
bun run check:typecheck
passed
```

Full repository gate after the final commit:

```text
bun run check
BAML generation passed
TypeScript typecheck passed
1899 pass, 1 intentional skip, 0 fail, 6148 expect() calls
1900 tests across 125 files
```

The intentional skip is the existing real-dist acceptance test when no `dist/` artifacts exist.

## Worktree ownership check

Ticket-owned source paths are clean after all three commits.

Remaining `git status --short` entries are Lisa-managed active-loop state:

- `.lisa/provenance.jsonl` modified;
- `docs/active/tickets/T-079-02-02.md` modified;
- `docs/active/tickets/T-079-03-02.md` modified;
- `docs/active/work/T-079-02-02/` untracked publication state;
- `docs/active/work/T-079-03-02/` untracked publication state.

None was edited, staged, restored, or included by this implementation. The private attempt artifacts
remain the only artifact paths authored directly; Lisa controls shared publication and ticket phase.

## Remaining boundary

- The story explicitly defers observing a real live Lisa loop; the complete event is fixture-driven
  through the actual project hook and actual CLI.
- A force-killed process after atomic claim but before its `finally` restoration can leave a unique
  ignored `.settling` sibling. Normal refusals and thrown errors restore automatically, and a later
  producer event can still publish the stable singleton. Crash scavenging is not part of this ticket.
- No open acceptance concern remains.
