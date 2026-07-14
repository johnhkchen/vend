# Plan — T-069-01-02

## Objective

Implement optional executor-seat stamping in ticket materialization with a typed, before-any-write
unknown-seat refusal, while keeping output byte-identical when no seat is supplied.

## Preconditions

- Parent story `S-069-01` has been read.
- Ticket `T-069-01-02` has been read.
- `AGENTS.md`, the RDSPI workflow, vision, and charter have been read.
- Dependency ticket `T-069-01-01` is committed and its exports are available.
- Research, design, and structure artifacts are complete.
- Existing dirty Lisa board files are identified and will not be staged.

## Step 1 — Import the canonical seat contract

Modify `src/play/materialize.ts` to import `findUnknownSeat` and `KNOWN_SEATS` from
`src/play/agent-seat.ts`.

Verification:

- Import path uses explicit `.ts` suffix.
- No local duplicate seat list is introduced.
- No executor registry dependency is introduced.

## Step 2 — Add the typed refusal

Add exported `UnknownSeatError` alongside the existing materialize error classes.

Implementation details:

- Extend `Error`.
- Store the rejected string as readonly `seat`.
- Set `name` explicitly.
- Build the message from the rejected value and `KNOWN_SEATS`.
- Keep construction pure.

Verification:

- TypeScript exposes the class and payload.
- The message does not hardcode a second known-seat list.
- The error is distinguishable from enum `RangeError`, collisions, bare codes, and fs failures.

## Step 3 — Extend the pure renderer

Add optional `agent?: string` as the final `renderTicketFile` parameter.

Implementation details:

- Leave all existing arguments and return types unchanged.
- Insert a conditional array spread after `priority:`.
- Check `agent !== undefined`, not truthiness.
- Do not add validation inside the renderer.
- Do not change story rendering or body generation.

Verification:

- A no-agent render matches the existing golden without modification.
- A codex render places exactly one line between priority and phase.
- The pure renderer remains filesystem- and clock-free.

## Step 4 — Extend and guard materialization

Add optional `agent?: string` as the final `materialize` parameter.

Implementation details:

- Validate at function entry.
- Skip validation only when the parameter is `undefined`.
- Call `findUnknownSeat` once.
- Throw `UnknownSeatError` on a non-null result.
- Keep collision detection next.
- Pass the optional value to every ticket renderer.
- Leave story rendering unchanged.
- Leave all write loops unchanged.

Verification:

- Existing three-argument callers typecheck unchanged.
- Invalid input reaches no target-directory read/create/write logic.
- Valid and absent values preserve existing guard ordering after seat validation.

## Step 5 — Update production comments

Adjust comments in `materialize.ts` to match behavior.

Required documentation:

- The module now has three pre-write guards.
- Unknown seat is the first guard.
- The renderer owns conditional stamp placement.
- Omission preserves prior bytes.
- One checked seat applies uniformly to all tickets.

Verification:

- No comment still claims only two guards.
- No comment claims the materializer is untested if existing fixture coverage says otherwise.
- Documentation does not promise later effect relabeling in this ticket.

## Step 6 — Add pure golden coverage

Modify `src/play/materialize.test.ts`.

Test actions:

- Import `UnknownSeatError`.
- Preserve the existing full-file no-seat golden exactly.
- Add an explicit absence assertion if it improves diagnosis.
- Add a full-file `codex` golden.
- Pin priority-agent-phase adjacency and all other bytes.

Verification:

- The old literal is unchanged.
- The new literal differs by one line only.
- No BAML value import is introduced.

## Step 7 — Add known-seat filesystem coverage

Within the existing temp-root materialize suite:

- Build a plan with multiple tickets.
- Materialize with `codex`.
- Assert both ticket files are created.
- Read every ticket body.
- Assert exact adjacency after priority.
- Assert exactly one stamp per ticket.
- Assert the story file has no agent line.

Verification:

- This proves the public impure path threads the value to every ticket.
- Cleanup continues through the existing `afterEach` hook.

## Step 8 — Add unknown-seat zero-write coverage

Within the same suite:

- Use fresh, nonexistent target directories.
- Materialize with `gpt`.
- Capture the error.
- Assert `UnknownSeatError` type.
- Assert `.seat === 'gpt'`.
- Assert name and message.
- Assert both target directories remain nonexistent.

Verification:

- Zero created files is observed through filesystem state.
- No cleanup-based behavior can make the test pass accidentally because the function has no cleanup.
- The failure precedes collision and render work by implementation order.

## Step 9 — Focused verification

Run:

```bash
bun test src/play/materialize.test.ts
```

Expected:

- All old materialization tests pass.
- Both new golden/fixture branches pass.
- No native addon issue occurs.

If focused verification fails:

- Fix only behavior within the ticket scope.
- Record any material plan deviation in `progress.md` before changing direction.
- Re-run until green.

## Step 10 — Static and diff verification

Run:

```bash
bun run build
git diff --check
git diff -- src/play/materialize.ts src/play/materialize.test.ts
```

Review criteria:

- Optional signatures preserve callers.
- There is no duplicate seat vocabulary.
- No unrelated file changed.
- No whitespace errors exist.
- The diff matches the structure artifact.

## Step 11 — Record implementation progress

Create `docs/active/work/T-069-01-02/progress.md` containing:

- completed steps;
- focused test results;
- static results;
- deviations and rationale;
- remaining work;
- explicit scope/worktree hygiene.

Do not edit ticket phase or status.

## Step 12 — Commit the implementation unit

Stage only:

- `src/play/materialize.ts`
- `src/play/materialize.test.ts`
- completed `T-069-01-02` work artifacts available at that point.

Commit with a ticket-scoped message. Do not stage `.lisa`, epic, story, or ticket frontmatter files.
The pre-commit hook must not be bypassed.

## Step 13 — Full repository gate

Run:

```bash
bun run check
```

Required outcome:

- BAML generation succeeds.
- Typecheck succeeds.
- Full test suite succeeds.
- No generated drift is left behind.

If generated files change, inspect whether they are deterministic tool output or unrelated drift;
do not commit unrelated changes.

## Step 14 — Acceptance review

Check each ticket condition directly:

1. `codex` stamps every ticket.
2. The stamp is immediately after priority.
3. Omission has no `agent:` key.
4. Omission matches the pre-change exact golden.
5. `gpt` throws `UnknownSeatError`.
6. Invalid input creates zero files/directories.

Also confirm story scope boundaries were preserved.

## Step 15 — Write review handoff

Create `docs/active/work/T-069-01-02/review.md` with:

- outcome and acceptance status;
- production/test/artifact file inventory;
- exact test commands and results;
- coverage assessment and gaps;
- pure-core/impure-shell assessment;
- compatibility assessment;
- open concerns and story-level remainder;
- critical issues for human attention.

Be explicit if any acceptance item is red.

## Step 16 — Final artifact commit and stop

If review/progress changed after the implementation commit:

- stage only this ticket's artifact paths;
- commit without bypassing hooks;
- verify `git status --short` shows only pre-existing Lisa/orchestration changes.

Then stop. Lisa owns phase and status transitions.

## Testing strategy summary

### Unit/golden

- Exact legacy bytes without a seat.
- Exact routed bytes with `codex`.
- Typed error data.

### Integration at filesystem shell

- Every generated ticket receives the stamp.
- Story output remains unstamped.
- Unknown input creates no targets.
- Existing collision/bare-code/success cases remain green.

### Repository regression

- TypeScript build.
- Full `bun run check` gate.
- Diff whitespace check.

## Definition of done

- All six RDSPI artifacts exist.
- Code and tests implement the structure exactly or deviations are documented.
- All acceptance criteria are demonstrably met.
- `bun run check` is green.
- Ticket changes are committed.
- Lisa-owned files remain untouched by the commits.
- Ticket frontmatter phase/status are not manually changed.
