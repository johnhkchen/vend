# Review — T-071-02-03

## Outcome

PASS. The ticket acceptance criteria are met and the meaningful source unit is committed as
`faaf6cd96ee0212f1725685163976498b3deb327`.

An omitted routing seat now uses recent project ledger heat to choose the cooler known lane at the
single decompose effect boundary. A decisive hot-Claude fixture stamps Codex on every materialized
ticket and records the exact inference evidence. Ambiguous/both-cool evidence preserves the prior
unrouted bytes. An explicit agent remains authoritative and produces no inference marker.

## Files changed

### `src/engine/play.ts`

- Added the structural, play-generic `SeatInferred` contract.
- Added optional `EffectResult.seatInferred`.
- The engine contract remains independent of known-seat and heat policy modules.

### `src/play/decompose-effect.ts`

- Added the sole inference injection shared by direct and chain board-writing gestures.
- When `ctx.inputs.agent` is absent, it reads `<root>/.vend/runs.jsonl` through `loadRunLog`.
- It passes the resulting records to the pure `inferDefaultSeat` function.
- It chooses the materializer argument in strict precedence order: explicit, inferred, absent.
- It returns the exact inference object as effect provenance.
- Existing graph, dependency, collision, charter-code, validation, and seat-default branches remain.

### `src/engine/cast.ts`

- Captures the effect marker as authoritative data.
- Forwards it verbatim to the final append-only run record.
- Omits the field when inference did not happen.
- Does not inspect play inputs or duplicate heat policy.

### `src/engine/cast.test.ts`

- Extended the fixture plan to two tickets to prove gesture-level every-ticket stamping.
- Added normalized ledger fixtures at the production path.
- Added direct hot, both-cool, and explicit-override casts through a stub executor.
- Added a two-step `castChain` test using the same effect-bearing decompose fixture.
- Added round-trip verification for the marker through the run-log reader.

## Acceptance evaluation

### No `--agent` + hot-Claude fixture

PASS.

- Ledger burn is Claude 300 versus Codex 100.
- Inference chooses Codex.
- Both fixture tickets contain exactly one `agent: codex` field.
- The run record contains:
  - `seat: codex`;
  - the stable recent cost-weighted heat reason;
  - no `seatDefaulted` marker.
- `reviveRecord` preserves the marker.

### Both-cool fixture

PASS.

- Equal 100/100 evidence yields no inferred seat.
- Story and both ticket files are byte-compared with an empty-ledger current-behavior baseline.
- All files are identical.
- Tickets contain no `agent` key.
- The run record contains no `seatInferred` key.

### Explicit `--agent claude`

PASS.

- The same hot-Claude ledger is present.
- Every ticket stamps `agent: claude`.
- No `seatInferred` marker is emitted.
- The implementation does not read/apply inference when the explicit value is present.

### Both gestures, one injection

PASS.

- The direct path casts the decompose-shaped play through `castPlay`.
- The chain path uses `castChain`; its second step uses the same decompose-shaped play and real
  `decomposeEffect`.
- The chained ticket stamps Codex and only the decompose step's record carries the marker.
- No inference logic was added to direct adapters, chain adapters, CLI parsing, or materialization.

## Test coverage

Focused final verification:

- 127 pass, 0 fail.
- 346 expectations across four files.
- Covers heat policy dependency tests, marker schema dependency tests, effect behavior, and cast/chain
  integration.

Full `bun run check`:

- BAML generation succeeded.
- TypeScript typecheck succeeded.
- 1648 pass, 1 skip, 0 fail.
- 4997 expectations across 111 files.
- The one skip is the pre-existing release acceptance test that requires built `dist/` artifacts.

The tests are FREE/tokenless: they inject a stub executor and stub Lisa validation. No live model or
metered mint was used, matching the story's honest boundary.

## Architecture and scope review

- Pure core, impure shell is preserved: heat calculation remains pure; ledger loading stays in the
  board-writing effect shell.
- The generic engine forwards structural provenance and knows nothing about routing policy.
- The existing materializer remains the only ticket frontmatter renderer.
- The existing run-log module remains the only marker normalizer/serializer.
- Direct and chain routes converge at one injection, avoiding policy drift.
- No runtime monitoring, rerouting, quota modeling, 429 handling, new lane, or Lisa dispatch change
  was introduced.

## Deviations and findings

- A separate effect-unit test file change was unnecessary because the acceptance explicitly calls for
  effect-level behavior through a stub executor; the cast tests drive the real effect and materializer.
- Expanding an existing one-ticket fixture exposed nondeterministic directory enumeration. The assertion
  now sorts the returned filenames. This is test determinism only, not a behavior change.
- Lisa automatically advanced/published phase state while private artifacts appeared. Those generated
  paths were excluded from the exact source commit as required.

## Open concerns and limitations

- Inference is based only on the bounded relative ledger evidence defined by T-071-02-01. It does not
  prove provider quota state or reset windows; the story explicitly defers that.
- A missing ledger is treated as empty and remains unrouted, by design.
- Inference is once per materializing gesture, not per ticket and not during execution.
- No live metered mint was performed; the story explicitly reserves that for a later counter-authorized
  step.
- No critical issue or follow-up is required for this ticket.

## Commit and cleanliness

- Commit: `faaf6cd96ee0212f1725685163976498b3deb327`.
- Method: `lisa commit-ticket` with four exact repository-relative include paths.
- Ticket-owned files are clean after commit.
- Unrelated Lisa/config/hook/ticket/publication working-tree state remains untouched.
