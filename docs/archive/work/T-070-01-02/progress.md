# T-070-01-02 — Progress

## Status

Implementation started from the approved Plan after completing Research, Design, and Structure.

## Completed before implementation

- Read AGENTS.md, the RDSPI workflow, vision, charter, parent story, and ticket.
- Mapped seat vocabulary, materializer, shared effect contract, effect adapter, and tests.
- Recorded current dirty worktree state and sibling-ticket ownership.
- Wrote `research.md`.
- Wrote `design.md`.
- Wrote `structure.md`.
- Wrote `plan.md`.

## Planned implementation checklist

- [x] Add shared `SeatDefaulted` and optional `EffectResult.seatDefaulted`.
- [x] Replace materializer unknown-seat refusal with default disposition.
- [x] Return the materializer degradation report.
- [x] Forward the report through `decomposeEffect`.
- [x] Remove effect production of `unknown-seat`.
- [x] Replace materializer refusal coverage with byte-identity coverage.
- [x] Replace effect refusal coverage with successful degradation coverage.
- [x] Run focused tests.
- [x] Run `bun run check`.
- [ ] Commit ticket-owned implementation and artifacts.
- [ ] Write `review.md`.

## Scope guard

No changes will be made to ticket frontmatter, `agent-seat.ts`, run-log schema, cast warning/persistence,
CLI parsing, BAML, or Lisa dispatch. Pre-existing board/Lisa changes will not be included in the
ticket commit.

## Implementation update 1

- Added the shared `SeatDefaulted` contract and optional `EffectResult.seatDefaulted`.
- Replaced `UnknownSeatError` with effective-seat disposition in `materialize`.
- Unknown requests now render through the absent-agent path and return requested/applied/reason.
- Forwarded the report from `MaterializeResult` through `decomposeEffect`.
- Removed production of the `unknown-seat` effect outcome.
- Replaced refusal tests with paired-root, byte-exact default-mint comparisons.
- Preserved the existing `codex` stamping proof and added marker-absence assertions.

Focused command:

```text
bun test src/play/materialize.test.ts src/play/decompose-effect.test.ts
36 pass, 0 fail, 108 expect() calls
```

First full-gate attempt reached typecheck and found one local typing issue: annotating
`DEFAULT_AGENT_SEAT` as the `AgentSeat` union widened its value to `"claude" | "codex"`, which
could not satisfy the report's deliberately exact `"claude"` field. The implementation now uses
`"claude" as const satisfies AgentSeat`, retaining both the literal and the canonical-seat check.

During the full suite, T-070-01-01's tests appeared concurrently and established the canonical
marker reason code as `"unknown-seat"`. This ticket's report was aligned from the prose
`"unknown agent seat"` to that exact code so T-070-01-03 can thread it without adaptation. No
run-log implementation file was touched here.

## Verification update

After the sibling schema finished its concurrent edit:

```text
bun test src/log/run-log.test.ts --test-name-pattern seatDefaulted
6 pass, 0 fail, 16 expect() calls

bun test src/play/materialize.test.ts src/play/decompose-effect.test.ts
36 pass, 0 fail, 108 expect() calls

bun run check
codegen: pass
typecheck: pass
tests: 1621 pass, 1 skip, 0 fail, 4893 expect() calls
```

The one skipped test is the repository's existing optional dist integration, skipped because no
local `dist/` artifacts exist. It is unrelated to this ticket.

## Implementation result

- Unknown `kodex` now writes the complete board through the same renderer path as no-agent minting.
- Direct materializer coverage proves two tickets and one story are byte-identical to baseline.
- Effect coverage proves `ok:true`, no outcome, one validator call, full artifacts, and exact bytes.
- Valid `codex` stamping remains green and carries no false degradation marker.
- Collision and bare-code refusal coverage remains green in the same focused file.
- No production `UnknownSeatError` reference or `unknown-seat` effect production remains.

## Deviations

- The first full-gate attempt exposed the literal-widening issue described above; fixed without
  changing the design.
- The concurrent sibling schema established the stable reason code after Plan; this report was
  aligned to it. This is a compatibility refinement, not a scope change.

## Remaining

- Commit ticket-owned implementation and Research-through-Progress artifacts.
- Write and commit `review.md`.
