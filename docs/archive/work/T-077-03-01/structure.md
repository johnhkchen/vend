# Structure — T-077-03-01

## Change set

This ticket changes two repository source files and creates the attempt-private
RDSPI artifacts required by Lisa. It does not create a new runtime module or
change any public type.

## Runtime file

### `src/engine/cast-core.ts`

Status: modify.

Owned region:

- `formatCastProgress` near the existing cast-progress pure core.

Unchanged neighboring components:

- `CastProgress`
- `EMPTY_CAST_PROGRESS`
- `CastProgressFormat`
- `assistantTurn`
- `accumulateCastProgress`
- `humanProgressTokens`
- `humanElapsed`
- `TurnSummaryFormat`
- `formatTurnSummary`

Internal organization:

- Keep the existing local `turn` calculation.
- Add a local formatted token fraction derived from
  `humanProgressTokens(state.weightedTokens)` and
  `humanProgressTokens(opts.tokenEnvelope)`.
- Add a local suffix derived from the raw strict comparison
  `state.weightedTokens > opts.tokenEnvelope`.
- Include the explicit `tokens` denomination in the token segment.
- Interpolate the composed token segment into the existing elapsed/token/turn
  template.

Public interfaces:

- No export is added.
- No export is removed.
- `formatCastProgress(state, opts): string` retains its signature.
- `CastProgressFormat` retains its fields and meanings.

Architectural boundary:

- The rule stays in the pure core because all inputs are plain values.
- No filesystem, clock, terminal, or executor dependency enters the function.
- The shell remains responsible only for supplying observed progress, elapsed
  time, envelope, and cap.

## Test file

### `src/engine/cast-core.test.ts`

Status: modify.

Owned region:

- The existing `cast progress — per-turn weighted spend + humane line` describe
  block.

Changes:

- Update existing exact expected progress lines to include `tokens` after the
  token fraction.
- Add one focused regression test pairing an over-envelope case with an
  under-envelope case.
- Pin the complete over-envelope line so the marker's placement is contractual.
- Pin the complete under-envelope line and/or explicitly assert that the marker
  is absent.

Test data shape:

- Reuse `EMPTY_CAST_PROGRESS` as the base plain state.
- Override `weightedTokens` for direct formatter inputs.
- Use a 200,000-token envelope.
- Use 392,000 for the over-envelope example from the story.
- Use a clearly lower value for the under-envelope branch.
- Keep elapsed time and turn values simple and deterministic.

No integration test file is needed. The shell delegates the complete formatting
decision to this function and already passes the envelope.

## Intentionally unchanged runtime file

### `src/engine/cast.ts`

Status: no change.

Reason:

- Its `onMessage` callback already supplies `progress` and `budget.tokens` to
  `formatCastProgress`.
- The returned line is already the exact live terminal surface.
- Changing it would duplicate the pure comparison or add unnecessary wiring.

## Intentionally unchanged budget files

### `src/budget/budget.ts`

Status: no change.

Reason:

- `countTokens` already defines the weighted denomination used in progress.
- Budget settlement already diagnoses overshoot after execution.
- This ticket changes labeling only, not accounting or disposition.

## Attempt-private artifacts

Directory:

`.lisa/attempts/T-077-03-01/1/work/`

Files:

- `research.md` — codebase and contract map.
- `design.md` — options, decision, semantics, and verification strategy.
- `structure.md` — this file-level blueprint.
- `plan.md` — ordered implementation and commit plan.
- `progress.md` — implementation record and gate results.
- `review.md` — final handoff and self-assessment.
- `review-disposition.json` — Lisa's machine-readable pass/block decision.

These files are not written to `docs/active/work/T-077-03-01/`; Lisa owns
publication after lease verification.

## Ticket metadata

### `docs/active/tickets/T-077-03-01.md`

Status: no worker edit.

Reason:

- Lisa owns phase and status transitions.
- Existing worktree modification to this file is treated as orchestration state,
  not ticket source ownership for this attempt.

## Commit boundary

The meaningful source unit is the formatter plus its regression tests. Because
the runtime behavior and its proof form one atomic contract, commit them together
using exact includes:

- `--include src/engine/cast-core.ts`
- `--include src/engine/cast-core.test.ts`

The commit command must be `lisa commit-ticket`; ordinary `git add` and
`git commit` are prohibited for this ticket.

## Dependency direction

The final dependency flow remains:

`cast.ts` effectful message callback
→ `accumulateCastProgress` pure observation fold
→ `formatCastProgress` pure presentation rule
→ terminal write

The formatter continues to depend only on plain progress/configuration values
and local pure helpers. No reverse dependency from core to shell is introduced.

## Deletions and migrations

- No files are deleted.
- No schema is migrated.
- No persisted data changes.
- No API consumer migration is required.
- Existing exact test strings are updated for the deliberate surface wording.

## Completion shape

At completion:

- live under-envelope progress visibly names the fraction as tokens;
- live over-envelope progress adds the detect-after qualification in-line;
- elapsed and turn segments remain structurally identical;
- the focused tests and full `bun run check` pass;
- only the two exact source paths are committed for this ticket;
- unrelated concurrent worktree state remains untouched.
