# T-070-01-02 — Structure

## Change map

This ticket modifies three production files and two test files. It creates the six RDSPI work
artifacts and deletes no files.

## `src/engine/play.ts`

Add the public data contract:

```ts
export interface SeatDefaulted {
  readonly requested: string;
  readonly applied: "claude";
  readonly reason: string;
}
```

Extend `EffectResult` with optional `seatDefaulted?: SeatDefaulted`. The field is optional so
unrelated effects stay source-compatible. The interface remains data-only and addon-free.

## `src/play/materialize.ts`

### Imports and constant

- Include the `AgentSeat` type from `agent-seat.ts`.
- Add a type-only import of `SeatDefaulted` from `engine/play.ts`.
- Add `const DEFAULT_AGENT_SEAT: AgentSeat = "claude"`.

### Result contract

Extend `MaterializeResult` with optional `seatDefaulted?: SeatDefaulted`.

Delete `UnknownSeatError`; no production path constructs or consumes it after this ticket.
The canonical membership oracle remains, and ledger vocabulary remains untouched.

### Internal disposition

At the start of `materialize`, replace the throw guard with effective-seat/report derivation.
For a present unknown request, set effective agent to undefined and build the marker. Known and
omitted values leave their compatibility paths unchanged.

### Rendering and return

- Pass the effective agent to `renderTicketFile`.
- Return only paths for default and known-seat calls.
- Conditionally spread `{ seatDefaulted }` only for the degraded call.
- Update comments from refusal to defaulting disposition.

## `src/play/decompose-effect.ts`

- Remove `UnknownSeatError` from imports.
- Destructure `seatDefaulted` from the materializer result.
- Conditionally include it in the returned `EffectResult`.
- Delete only the unknown-seat catch arm.
- Retain collision, bare-code, and generic error behavior.

## `src/play/materialize.test.ts`

- Remove the deleted error import.
- Assert known-seat results omit `seatDefaulted`.
- Replace the exception test with paired default/`kodex` mints.
- Use multiple tickets to prove every ticket behavior.
- Assert exact marker data and exact file-body equality.
- Explicitly reject `agent:` in degraded tickets.

## `src/play/decompose-effect.test.ts`

- Retain production input assembly and the valid `codex` test.
- Add marker absence to the valid path.
- Replace unknown-seat failure with `kodex` degraded success.
- Require one validator call, `ok:true`, no outcome, and exact marker.
- Mint a no-agent baseline in another root and compare all bytes.

## Work artifacts

- `research.md`: observed behavior and constraints.
- `design.md`: options, decision, and rationale.
- `structure.md`: file-level blueprint.
- `plan.md`: ordered implementation and tests.
- `progress.md`: implementation ledger and gate evidence.
- `review.md`: acceptance assessment and handoff.

## Unchanged files

- `src/play/agent-seat.ts`: seats and oracle remain unchanged.
- `src/log/run-log.ts`: T-070-01-01 owns schema.
- `src/engine/cast.ts`: T-070-01-03 owns persistence/warning.
- BAML, CLI, epic/story/ticket frontmatter, and Lisa configuration.

## Dependency direction

`engine/play.ts` owns the shared report type. `materialize.ts` has a type-only dependency on it;
there is no runtime edge. `decompose-effect.ts` forwards the value. The later cast ticket consumes
only `EffectResult`, preserving the generic engine boundary.

## Ordering

1. Extend the shared effect contract.
2. Change materializer disposition and result.
3. Forward the report and remove refusal relabeling.
4. Invert direct materializer coverage.
5. Invert effect-level coverage.
6. Run focused tests and the full gate.

## Acceptance trace

| Acceptance clause | Owner | Proof |
|---|---|---|
| `kodex` writes full board | materialize disposition | real-fs materializer/effect tests |
| no `agent:` key | effective agent undefined | explicit absence + byte comparison |
| byte-identical default | unchanged renderer path | paired-root exact comparisons |
| `ok:true` | normal effect path | effect assertion |
| report via `EffectResult` | shared field + forwarding | exact object assertion |
| no exception | removed error/throw | direct call completes |
| no `unknown-seat` produced | removed catch outcome | outcome absence |
| `codex` still stamps | known branch | existing tests |

## Review boundary

Review must state that this ticket reports but does not persist or print the marker. Historical
`unknown-seat` records remain readable because vocabulary cleanup is deliberately outside scope.
