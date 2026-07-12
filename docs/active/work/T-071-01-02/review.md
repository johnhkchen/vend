# T-071-01-02 Review — cast stamps seat of execution

## Review verdict

PASS. The ticket acceptance criteria are met. Known executor lanes are now recorded at cast
settlement, lane-less executors remain honestly unknown, focused and full tests are green, and
the four-file implementation is committed.

## What changed

### `src/engine/cast-core.ts`

Added the pure `resolveSeatOfExecution` projection:

- `claude` executor id → `claude` seat;
- `openai-compat` executor id → `codex` seat;
- every other id → `undefined`.

The return type is `AgentSeat | undefined`, where `AgentSeat` is derived from the canonical
`KNOWN_SEATS` tuple. The import is type-only, so the core retains its runtime purity and does
not load play routing policy.

The mapping is deliberately explicit. Future executor ids do not silently consume an existing
lane; someone must name the accounting relationship before records claim it.

### `src/engine/cast.ts`

After the existing explicit-instance-or-selector resolution, `castPlay` now resolves execution
provenance from `executor.id`. The value is computed before dispense and retained through the
terminal flow.

The final `appendRunLog` input conditionally includes the fact only when the pure resolver
returns a known lane. The projection mirrors `turnsUsed`:

- known value → write the key;
- unknown value → omit the key entirely.

This means a known executor attempt that times out can still name its lane, while the existing
pre-execution missing-capability andon remains lane-less because no executor is resolved or run.

### `src/engine/cast-core.test.ts`

Added pure coverage for both acceptance mappings and the unknown state. Case mismatch and empty
identity are also rejected, pinning exact stable-id matching rather than accidental aliasing.

### `src/engine/cast.test.ts`

The existing token-free stub helper now accepts an optional executor id. The established
end-to-end cast proof uses a Claude-id stub and asserts the written JSONL record carries the
Claude lane.

A new cast using the generic `stub` id proves the negative contract: the serialized record has
no `seatOfExecution` own key, and property access is undefined.

## Acceptance evaluation

### Stub cast writes the executor's known lane

Met. The integration test runs the real `castPlay` shell with a no-token injected stub whose
stable id is `claude`, then reads the emitted record and observes `seatOfExecution: "claude"`.

### Mapping is pinned in `cast-core`

Met. Pure tests assert:

- Claude → Claude;
- OpenAI-compatible → Codex;
- unknown → undefined.

### Field is spread only when known

Met. Production uses an explicit `!== undefined` conditional spread. The lane-less integration
test proves omission in actual serialized JSON, not merely a resolver return value.

### Repository gate

Met. `bun run check` completed with BAML generation and typecheck successful, 1,630 tests
passing, 1 intentional missing-dist skip, and zero failures.

## Test coverage assessment

Coverage is proportionate and closes both policy and wiring risks:

- pure unit coverage catches mapping drift cheaply;
- integration coverage catches a missing/incorrect spread at the actual fs boundary;
- negative integration coverage catches dishonest defaulting or `undefined` serialization;
- the full suite checks compatibility with all existing cast outcomes and run-log consumers.

No live executor test is needed or desirable for this story. The honest story boundary calls for
a stub executor and FREE proof, and executor adapter dispatch itself is already covered elsewhere.

## Architecture assessment

The implementation follows the repository's pure-core/impure-shell rule:

- mapping judgment receives a plain executor id and returns a plain optional seat;
- cast shell owns executor selection, execution, and persistence;
- run-log remains a raw optional-fact store and does not acquire routing policy;
- executor interface and adapters do not acquire Lisa-specific seat vocabulary.

P6 remains intact because `castPlay` still depends only on the general `Executor` contract. P7
advances because recorded burn is attributable for both built-in identities. P4 advances because
the fact is stamped autonomously without a run-time approval/configuration gesture.

## Compatibility and scope

- Historical records are unchanged and continue to revive via T-071-01-01 behavior.
- Lane-less/custom executor records retain their previous serialized shape.
- Known built-in paths gain only the intended optional provenance key.
- No schema version bump is required.
- No executor selection behavior changed.
- No new lane or alias was introduced.
- No materialize, decompose effect, reader, heat inference, 429 capture, or Lisa dispatch work
  was pulled into this ticket.

## Open concerns and limitations

There are no critical issues.

One intentional maintenance point remains: adding a new built-in executor requires adding an
explicit lane mapping if its burn should be attributed. Until then, its records are lane-less.
This is preferable to false attribution and is covered by the unknown-id test.

The missing-capability andon remains lane-less because it occurs before executor resolution and
does no executor work. If future accounting wants to distinguish selected-but-not-run capacity,
that would be a different provenance field/contract, not `seatOfExecution`.

## Commit and handoff

- Commit: `44c7f2b5b099ca32af9ff0a64ceb7c15fa2471b6`
- Subject: `feat(engine): stamp cast execution lane (T-071-01-02)`
- Commit contains exactly the four reviewed implementation/test files.
- Ticket-owned source paths are clean; no ordinary-index staged files remain.

Lisa can publish this review and complete the ticket.
