# Review — T-069-01-02

## Outcome

Acceptance is met.

Materialization now accepts an optional Lisa executor-routing seat, stamps a valid supplied seat onto
every generated ticket immediately after `priority:`, preserves the exact legacy ticket bytes when
the seat is omitted, and rejects an unknown seat with a typed error before any board read or write.

The full repository gate is green.

## What changed

### Modified: `src/play/materialize.ts`

- Imported the canonical seat contract from `agent-seat.ts`.
- Added exported `UnknownSeatError`.
- The error carries the rejected value in readonly `.seat`.
- The error name is explicitly `UnknownSeatError`.
- Its message names both the rejected value and canonical known values.
- Added optional trailing `agent?: string` to `renderTicketFile`.
- Added optional trailing `agent?: string` to `materialize`.
- Added a function-entry unknown-seat guard.
- The guard calls `findUnknownSeat` only when the value is supplied.
- An unknown result throws before board listing, clock, rendering, mkdir, or write.
- A valid value is threaded uniformly to every ticket renderer.
- The renderer conditionally inserts `agent: <seat>` after `priority:`.
- The insertion uses an `undefined` check, so absence emits no line.
- Story rendering and ticket body rendering are unchanged.
- Existing collision and bare-code guard ordering remains unchanged after seat validation.
- Module and function comments now describe all three guards accurately.

### Modified: `src/play/materialize.test.ts`

- Imported `UnknownSeatError`.
- Retained the existing no-seat full-file golden literal.
- Added an explicit assertion that no `agent:` key appears when omitted.
- Added an exact full-file golden for `codex`.
- Added a real-filesystem multi-ticket proof.
- That proof checks every ticket has exactly one stamp.
- It checks priority/agent/phase line adjacency.
- It checks the story file remains unstamped.
- Added a real-filesystem `gpt` refusal proof.
- It checks error type, name, payload, and message.
- It checks neither target directory exists after refusal.

### Created work artifacts

- `docs/active/work/T-069-01-02/research.md`
- `docs/active/work/T-069-01-02/design.md`
- `docs/active/work/T-069-01-02/structure.md`
- `docs/active/work/T-069-01-02/plan.md`
- `docs/active/work/T-069-01-02/progress.md`
- `docs/active/work/T-069-01-02/review.md`

### Deleted files

- None.

## Acceptance review

### Valid `codex` seat stamps every ticket

Pass.

The public `materialize` filesystem test supplies a two-ticket plan and `codex`. It reads both
written ticket files and asserts each contains exactly one `agent: codex` line.

### Stamp immediately follows priority

Pass.

Both the exact pure golden and filesystem test pin this sequence:

```text
priority: high
agent: codex
phase: ready
```

The renderer's ordered array also places the conditional element structurally between the priority
and phase entries.

### Missing seat preserves pre-change bytes

Pass.

The existing exact full-file golden still invokes `renderTicketFile` without a third argument and
its expected literal remains agent-free. It passes unchanged. An additional negative assertion makes
the absence contract explicit.

The implementation uses a conditional spread that contributes an empty array when `agent` is
`undefined`; it does not render `agent: undefined`, an empty field, or an extra newline.

### Unknown `gpt` throws `UnknownSeatError`

Pass.

The filesystem test invokes public `materialize` with `gpt` and observes:

- `instanceof UnknownSeatError`;
- `name === 'UnknownSeatError'`;
- `seat === 'gpt'`;
- a message naming `gpt` and `claude, codex`.

### Unknown seat creates zero files

Pass.

The same test starts from fresh target paths and proves both remain nonexistent after rejection.
This is stronger than empty target directories: no directory or file was created. The code places
validation before the first `listIdsIn`, so this result is structural and requires no cleanup.

## Test coverage

### Focused materialization suite

Command:

```bash
bun test src/play/materialize.test.ts
```

Result:

- 34 passed.
- 0 failed.
- 82 assertions.

Coverage includes the ticket's three golden cases plus existing aliases, story output, charter-code
resolution, collision refusal, bare-code refusal, and successful writing.

### Static verification

Command:

```bash
bun run build
```

Result: passed with no TypeScript errors.

This proves existing three-argument materialize callers and two-argument renderer callers remain
source-compatible with the optional trailing parameters.

### Full repository gate

Command:

```bash
bun run check
```

Result:

- BAML generation passed with CLI 0.223.0.
- Typecheck passed.
- 1,607 tests passed.
- 1 existing test skipped because no `dist/` artifacts were present.
- 0 tests failed.
- 4,837 assertions ran across 109 files.
- No generated-file drift remained.

### Diff hygiene

`git diff --check` passed with no whitespace errors.

## Pure-core / impure-shell assessment

The house split is preserved.

- Seat membership remains the pure `findUnknownSeat` oracle over plain strings.
- Exact ticket byte formatting remains pure and deterministic.
- The renderer does not perform validation, filesystem access, or clock access.
- `materialize` remains the thin shell that sequences validation, reads, clock, and writes.
- The supplied seat is validated once rather than once per ticket.
- All files are rendered in memory before existing content validation and mutation.
- Unknown-seat refusal occurs before even the read portion of the shell.

## Compatibility assessment

- Existing callers compile and behave unchanged because new parameters are optional and trailing.
- No-seat ticket output is byte-identical by exact golden.
- Story output never receives routing metadata.
- Ticket body prose is unchanged.
- Existing collision behavior is unchanged for valid or absent seats.
- Existing bare-code behavior is unchanged for valid or absent seats.
- Seat vocabulary is not duplicated; the writer consumes the upstream tuple/oracle.
- Arbitrary input remains a `string` until runtime validation, avoiding dishonest casts.
- `claude` is accepted through the same canonical oracle path as `codex`; upstream tests pin both.
- Empty strings and differently cased values remain unknown and are refused.

## Scope review

The implementation deliberately does not:

- pass `ctx.inputs.agent` from `decomposeEffect`;
- catch or relabel `UnknownSeatError`;
- add `unknown-seat` to `RunOutcome`;
- change run-log serialization;
- add the chain gesture option;
- parse or dispatch `--agent` in the CLI;
- modify BAML drafts;
- modify Lisa dispatch;
- add new seats;
- provide per-ticket seat overrides;
- stamp already-existing tickets;
- touch the unrelated presentation `--seat designer|dev` feature.

Those items match the parent story's downstream tickets and out-of-slice boundary.

## Open concerns and limitations

No ticket-blocking concern remains.

Expected story-level remainder:

- Until `T-069-01-04`, the decompose effect does not pass `ctx.inputs.agent` into `materialize`.
- Until `T-069-01-04`, the effect does not relabel this typed error to `unknown-seat`.
- Until `T-069-01-03`/`T-069-01-05`, public chain and CLI gestures do not expose the field end to end.
- The live metered proof remains explicitly deferred by the story's honest boundary.
- This ticket proves `codex` in the materialize composition; `claude` membership is inherited from
  and directly tested by the canonical upstream contract.

These are planned DAG boundaries, not hidden defects in this ticket.

## Commit and worktree review

- Implementation and pre-review artifacts were committed as `6e7103f`.
- The pre-commit hook was not bypassed.
- Explicit path staging excluded Lisa-owned board and provenance changes.
- Ticket phase and status frontmatter were not manually edited.
- The final review/comment correction will be committed as a ticket-scoped follow-up artifact unit.

## Critical issues for human attention

None.
