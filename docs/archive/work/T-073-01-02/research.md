# T-073-01-02 — Research

## Assignment and contract

- The ticket starts in `research` and requires every remaining RDSPI phase in one pass.
- Phase artifacts belong only in `.lisa/attempts/T-073-01-02/1/work/`.
- Lisa, not this worker, owns ticket frontmatter transitions and publication.
- Ticket-owned source must be committed with `lisa commit-ticket` and exact include paths.
- The ticket advances P6: executor choice must remain behind the executor abstraction.
- Acceptance is one focused unit-test matrix:
  - a Claude-authored run resolves the Codex/openai-compat reviewing seat;
  - a Codex-authored run resolves the Claude reviewing seat;
  - a configuration with only one seat yields `null`.

## Story boundary

- S-073-01 routes a completed cast's diff to the other executor seat and records a verdict.
- This ticket owns only complement resolution.
- T-073-01-01 independently captures the diff.
- T-073-01-03 consumes this resolver and owns prompt dispense/verdict parsing.
- T-073-01-04 owns ledger persistence of the verdict.
- Verdict enforcement belongs to S-073-02, not this ticket.
- Adding an executor, an agentic open-model loop, or a live metered proof is out of scope.
- The reviewing OpenAI-compatible executor is intentionally context-complete and single-turn.

## Existing seat vocabulary

- `src/play/agent-seat.ts` owns `KNOWN_SEATS = ["claude", "codex"] as const`.
- `AgentSeat` is derived from that tuple.
- Those seats originally describe Lisa allocation metadata.
- The cast ledger now uses the same vocabulary to identify the lane whose budget was burned.
- Exact identifiers are intentional; the codebase does not normalize case or whitespace.

## Existing executor-to-seat projection

- `src/engine/cast-core.ts` exports `resolveSeatOfExecution(executorId)`.
- It maps executor id `claude` to seat `claude`.
- It maps executor id `openai-compat` to seat `codex`.
- Unknown or injected executor ids return `undefined`.
- The function is pure and is already tested in `cast-core.test.ts`.
- `src/engine/cast.ts` calls it on the actual resolved executor's stable `id`.
- The resulting `seatOfExecution` is conditionally appended to the run log.
- The story explicitly directs this ticket to reuse this projection rather than duplicate it.

## Existing executor selection seam

- `src/executor/select.ts` owns executor construction and configuration.
- `ExecutorRegistry` is a record from executor id to a nullary factory.
- `builtinExecutors` currently contains `claude` and `openai-compat`.
- Factories are lazy and return fresh executor instances.
- `executorFor({ executor: id }, env, registry)` constructs the selected executor.
- Explicit selection wins over environment and the Claude default.
- Unknown ids fail loudly instead of silently falling back.
- The injectable registry is the established way to unit-test configuration without I/O.

## Existing executor contract

- `src/executor/executor.ts` defines the provider-neutral `Executor` interface.
- An executor exposes a stable `id` and `dispense(options)`.
- No new executor method is needed for review.
- `ClaudeExecutor` and `OpenAICompatExecutor` both satisfy this interface.
- Constructing either built-in is inert; model/network work begins only on `dispense`.
- Therefore a resolver test can use real built-ins or injected stubs without spending tokens.

## Dependency direction and purity

- `select.ts` sits above both concrete executors to avoid runtime cycles.
- `cast-core.ts` contains pure engine decisions and does not import the selector.
- A cross-review routing module may depend on both:
  - the pure seat projection from engine core;
  - the executor registry/selector from the executor layer.
- Neither lower layer should depend back on cross-review.
- The new module is a policy core: it receives plain seat/config values and returns a value.
- Executor factory invocation is construction, not network/filesystem I/O.
- Tests can inject a registry of stable stub objects for identity assertions.

## Configuration meaning

- There is no separate persisted “review seats” configuration today.
- The executor registry is the concrete configured-capability set available to the resolver.
- A registry entry is usable for routing only if `resolveSeatOfExecution` maps its id.
- Unknown registry entries cannot honestly claim a known budget/review seat.
- “Only one seat configured” therefore means the recognized configured-seat set has one lane.
- A complement exists only when both the run's seat and another recognized seat are configured.
- This prevents a one-entry registry for only the opposite seat from being misreported as a
  complete two-seat configuration.

## Test location and conventions

- Source modules use adjacent `*.test.ts` Bun tests.
- Tests import `expect`/`test` or `describe` from `bun:test`.
- Existing selector tests use an injected `ExecutorRegistry` and do not dispense.
- Ticket scope is disjoint from the parallel diff-capture ticket's engine files.
- A new `src/cross-review/` directory avoids touching the files assigned to T-073-01-01.
- The story already names a new cross-review module as routing owner.

## Repository state constraints

- `docs/active/tickets/T-073-01-01.md` is modified by another Lisa worker.
- `docs/active/tickets/T-073-01-02.md` is modified by Lisa from `ready` to `research`.
- Those are orchestration-owned changes and must not be included or reverted.
- No ticket-owned source changes existed at research start.

## Verification surface

- Focused unit test should prove both directions and inert one-seat behavior.
- Identity and stable executor id can prove the returned executor is invokable/configured.
- Tests must never call `dispense`.
- `bun run check` remains the full repository gate: BAML codegen, TypeScript, all tests.
- Final status must show no ticket-owned modified/untracked source files.

## Constraints and assumptions surfaced

- Current seat cardinality is exactly two; “complement” means the other of those two.
- Registry enumeration order must not define policy.
- Duplicate registry ids mapping to the same seat should collapse at the seat level.
- Unknown run seats, absent run seats, or a run seat absent from configuration should be inert.
- Unknown executor ids in a registry should be ignored because the authoritative projection cannot
  assign them a seat.
- The resolver should not read `process.env`: cross-review needs the whole configured registry,
  while `VEND_EXECUTOR` selects one execution default rather than declaring two-seat capability.
- The returned executor must be created through `executorFor`, preserving the established seam.
