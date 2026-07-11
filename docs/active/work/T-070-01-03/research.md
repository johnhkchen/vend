# Research — T-070-01-03: cast records and warns on seat default

## Ticket state and contract

- Ticket: `T-070-01-03`.
- Parent story: `S-070-01`, “degrade not discard on invalid seat.”
- Current phase is `research`.
- The ticket depends on `T-070-01-01` and `T-070-01-02`.
- Both dependency implementations and their Review artifacts are present in the current history.
- The acceptance path is fixture-only and token-free.
- No live metered cast is required or authorized by the story.
- The requested raw seat in the acceptance fixture is exactly `kodex`.
- Lisa's applied default is `claude`.
- The cleared board must still materialize in full.
- Its ticket bytes must match a default mint with no `agent:` field.
- The run record must carry requested and applied seat provenance.
- Cast stdout must visibly name the requested-versus-default disposition.
- Historical `unknown-seat` outcomes remain readable; vocabulary cleanup is out of scope.

## Story boundaries

The story names these relevant surfaces:

- `src/log/run-log.ts`: structured ledger marker.
- `src/play/materialize.ts`: seat guard and default disposition.
- `src/engine/play.ts`: generic effect report contract.
- `src/play/decompose-effect.ts`: effect-level forwarding.
- `src/engine/cast.ts`: record write and stdout warning.

The first four surfaces were handled by the dependency tickets. This ticket owns the final cast
fan-in. The story explicitly leaves the following unchanged:

- canonical seat membership in `src/play/agent-seat.ts`;
- Lisa dispatch behavior;
- seats beyond `claude` and `codex`;
- per-ticket seat overrides;
- BAML schema and generated clients;
- graph, story-contract, collision, and bare-code refusal behavior;
- removal of `unknown-seat` from the append-only ledger vocabulary.

The charter grounding is P4 and P2. The degraded cast proceeds autonomously after its quality
gates clear, while the counter gesture remains a seat request rather than a new negotiation.

## Dependency state: run-log schema

`T-070-01-01` added the ledger-side contract in `src/log/run-log.ts`.

`SeatDefaulted` contains:

```ts
{
  requested: string;
  applied: string;
  reason: string;
}
```

Both `RunRecordInput` and normalized `RunRecord` accept an optional `seatDefaulted` property.
`buildRunRecord` normalizes a complete marker and omits absent or malformed optional metadata.
`reviveRecord` preserves a valid marker across the JSONL read boundary. An ordinary record has no
own `seatDefaulted` property, preserving historical serialization shape.

The run-log test suite already covers:

- build, serialize, and revive round-trip;
- absence and legacy records;
- incomplete marker rejection;
- malformed revived marker omission;
- extra-property normalization;
- raw `requested: "kodex"`, `applied: "claude"`, and `reason: "unknown-seat"`.

The schema is deliberately independent from the engine's `SeatDefaulted` type. The two contracts
are structurally assignable plain data, preserving the existing `engine` → `log` dependency without
introducing a reverse import.

## Dependency state: effect report

`T-070-01-02` added `SeatDefaulted` beside `EffectResult` in `src/engine/play.ts`.

Its current engine shape is:

```ts
export interface SeatDefaulted {
  readonly requested: string;
  readonly applied: "claude";
  readonly reason: string;
}
```

`EffectResult` now has optional `seatDefaulted?: SeatDefaulted`. The optional field keeps every
unrelated effect source-compatible and gives the generic cast boundary a play-agnostic report.

`src/play/materialize.ts` checks a supplied raw agent through `findUnknownSeat`. A known seat remains
the effective renderer seat. An unknown seat sets the effective renderer seat to `undefined`, which
reuses the pre-seat/default render path and returns:

```ts
{
  requested: "kodex",
  applied: "claude",
  reason: "unknown-seat",
}
```

The materializer writes all story and ticket files before returning its paths and optional report.
Its tests compare an unknown-seat mint against a separate no-agent mint byte for byte, covering one
story and two tickets. They also prove the degraded tickets contain no `agent:` key.

`src/play/decompose-effect.ts` destructures the report from `materialize`, runs Lisa validation, and
conditionally forwards it on the returned `EffectResult`. Unknown seats are no longer caught or
relabeled as the `unknown-seat` terminal outcome. Collision and bare-code exceptions retain their
existing clean outcome mappings. Unexpected exceptions still propagate.

The effect test drives a real temporary-filesystem mint through input assembly and a validation
stub. It proves successful full materialization, exact marker forwarding, no terminal outcome, and
byte identity with a no-agent baseline.

## Cast orchestration today

`src/engine/cast.ts` contains the generic impure `castPlay` shell. Its sequence is:

1. resolve project and run identity;
2. resolve play tooling and any reduced-grounding disposition;
3. render the prompt;
4. create transcript output;
5. resolve and invoke the executor;
6. meter, parse, and gate the executor result;
7. classify the cast;
8. call the play effect on a materializing verdict;
9. emit effect, andon, and warning output;
10. append one run-log record;
11. return a `RunSummary`.

The effect-handling block currently reads:

- `eff.ok` into `materialized`;
- `eff.produced` when the effect landed;
- `eff.outcome` as an optional terminal relabel;
- `eff.detail` for the effect stdout line.

It does not retain `eff.seatDefaulted`. By the time `appendRunLog` constructs its input, the effect
object is out of block scope. Consequently, dependency behavior is present below the cast boundary
but is currently invisible in both the ledger and the cast warning surface.

The cast already contains two nearby degradation/warning precedents:

- reduced grounding emits a note and conditionally spreads `reducedGrounding: true` onto the record;
- an over-envelope retained clear emits a detailed warning and conditionally spreads
  `overEnvelope: true` onto the record.

Both precedents keep the decision upstream and forward one authoritative fact. The cast does not
recompute either condition from unrelated state.

## Run-log append boundary

The normal end-of-cast `appendRunLog` call receives one object containing identity, model, envelope,
project, optional trust and degradation metadata, outcome, usage, cost, gates, and timestamps.
Optional metadata is included with conditional object spreads.

The early missing-capability path has a separate append and returns before any effect can run. It
cannot receive a seat-default report because materialization never occurs on that path.

Only a materializing verdict calls an effect. A gate stop, timeout, missing capability, or discarded
budget exhaustion therefore has no seat-default report to persist or warn about.

An effect can return `seatDefaulted` with either `ok: true` or `ok: false` structurally. The production
decompose path reports it after materialization and validation. Its intended story path is the
successful degraded clear. The cast contract itself currently does not impose a coupling between
the optional marker and `ok`.

## Existing cast integration tests

`src/engine/cast.test.ts` is BAML-free and injects a stub `Executor` directly into `castPlay`.
The stub streams canned messages and returns a successful `ResultMessage` with deterministic model,
usage, and cost data. Tests use isolated temporary roots, transcript paths, and run-log files.

Current end-to-end cast coverage includes:

- parse → gate → effect → log success through a stub executor;
- gates-cleared token overshoot that writes board-shaped files and records `overEnvelope`;
- optional-MCP absence that records `reducedGrounding`;
- optional-MCP presence that omits the marker;
- generic executor timeout classification.

The file already has a small board-writing fixture, but it writes simplified story/ticket bodies
directly. It does not exercise the production materializer or `decomposeEffect`, does not carry an
agent input, and cannot produce `seatDefaulted`.

`src/play/decompose-effect.test.ts` contains a complete addon-free `WorkPlan` fixture with one story
and one ticket. Its enum members are type-only imports from generated BAML types, so the native addon
does not load. The same fixture shape can be represented in another addon-free test without calling
the BAML parser.

## Stdout behavior and test constraints

`castPlay` writes directly to `process.stdout` for streamed messages, effect results, and warning
notes. There is no injected output writer in `CastOptions`. Existing cast tests assert ledger and
filesystem results but do not capture direct stdout.

The acceptance criterion names the warning line as an observable, so the end-to-end fixture must
observe stdout in addition to reading the JSONL record and materialized files. Any capture must
restore the process writer even if the cast throws, because stdout is process-global test state.

The requested warning is described as having the shape of the reduced-grounding note. That existing
line is a concise bullet, names the degraded condition, says execution is proceeding, and states that
the fact is recorded. No exact warning text is prescribed by the ticket or story.

## Repository and workflow constraints

- The repository uses Bun and TypeScript with `verbatimModuleSyntax` discipline.
- `bun run check` is the required gate: BAML codegen, typecheck, and full tests.
- Generated BAML value imports must not enter ordinary Bun test processes.
- Pure logic belongs in pure modules; filesystem, clock, stdout, and executor work remain shell code.
- The worktree already contains Lisa-managed board changes unrelated to this ticket.
- Ticket `phase` and `status` frontmatter must not be edited.
- Ticket completion requires code, tests, and work artifacts to be committed.
- The final Review artifact is written after implementation and verification.

## Observed gap

The upstream disposition and downstream persistence contracts are complete and compatible. The only
missing link is that `castPlay` does not preserve the effect's `seatDefaulted` value beyond the local
effect block, does not write it into the normal run record, and does not emit a cast-time disposition
note. No change to seat membership, materialization policy, outcome classification, executor
selection, BAML, or ledger normalization is needed to describe the ticket's remaining work.
