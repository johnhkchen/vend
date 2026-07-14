# T-071-01-02 Research — cast stamps seat of execution

## Assignment and phase state

- The ticket begins in `research` and the assignment requires all remaining RDSPI phases.
- Attempt artifacts belong only under `.lisa/attempts/T-071-01-02/1/work/`.
- Lisa owns ticket phase/status transitions and publication to `docs/active/work/`.
- Ticket-owned implementation files must be committed with `lisa commit-ticket` and exact paths.
- The working tree contains Lisa/user changes outside this ticket; they must remain untouched.

## Story contract

- Parent story: `S-071-01`, the lane-heat ledger substrate.
- The story covers the run-log field and cast-loop stamp only.
- T-071-01-01 precedes this ticket and owns the run-log schema/read-write support.
- This ticket owns the cast producer side in `src/engine/cast.ts` and `cast-core.ts`.
- Materialize, decompose effect, the reader, Lisa dispatch, and new lanes are out of scope.
- The story is fixture-proven and token-free; it does not require a live metered cast.
- The intended lanes are exactly the existing `KNOWN_SEATS`: `claude` and `codex`.
- Vend's Claude executor burns the `claude` lane.
- The OpenAI-compatible executor represents the `codex` lane for this accounting substrate.

## Charter and vision constraints

- P7 makes budget burn attributable rather than leaving the execution lane unknown.
- P4 favors an automatic durable fact at settlement, without asking for supervision.
- P6 requires the cast loop to remain executor-agnostic; the mapping must be explicit at the seam.
- P5 favors the existing local JSONL ledger with no remote dependency.
- N4 rules out expanding this ticket into executor or Lisa dispatch behavior.

## Existing run-log substrate

- `src/log/run-log.ts` already declares `seatOfExecution?: string` on input and record.
- `buildRunRecord` structurally accepts a non-empty raw string and conditionally spreads it.
- `reviveRecord` applies the same structural normalization when reading JSONL.
- Absence is preserved as absence; no lane is synthesized by the ledger.
- The ledger intentionally does not import or police against `KNOWN_SEATS`.
- This keeps storage factual and lets the producer own mapping policy.
- Commit `e616525` is the landed dependency for T-071-01-01.

## Executor contract and selection

- `src/executor/executor.ts` defines `Executor` with stable readonly `id: string`.
- The interface comment says that id is used for selection and run-log identity.
- `ClaudeExecutor.id` is the literal `"claude"`.
- `OpenAICompatExecutor.id` is `OPENAI_EXECUTOR_ID`, currently `"openai-compat"`.
- `src/executor/select.ts` contains the built-in factories for those two ids.
- The default selector id is `"claude"`.
- `castPlay` accepts either an explicit `Executor` instance or an executor id for selection.
- Explicit instance precedence is already established and tested.
- After resolution, `castPlay` holds one authoritative executor object before dispense.
- Therefore `executor.id` is the common identity for injected stubs and built-in executors.

## Seat contract

- `src/play/agent-seat.ts` owns `KNOWN_SEATS = ["claude", "codex"] as const`.
- It exports `AgentSeat` as the union derived from that tuple.
- This is routing-seat vocabulary, distinct from the Vend executor registry.
- The module is pure and addon-free.
- The ticket needs a projection from executor identity to this seat vocabulary.
- Known mappings from acceptance are `claude → claude` and `openai-compat → codex`.
- Arbitrary executor ids, including generic test stubs, have no justified lane.
- Unknown identity must therefore produce `undefined`, not a guessed/defaulted seat.

## Cast pure core

- `src/engine/cast-core.ts` owns pure cast judgments and projections.
- It currently has type-only imports, no fs, clock, process, network, or native addon.
- Existing total resolvers include `resolveLoggedModel`, `resolveMaxTurns`, and
  `resolveTurnsUsed`.
- Each resolver accepts plain values and is pinned in `cast-core.test.ts`.
- Executor-to-lane mapping is likewise a pure projection of a string id.
- The core can type-import `AgentSeat` without adding a runtime edge.
- A total resolver can return `AgentSeat | undefined` for known/unknown identity.
- This preserves the pure-core/impure-shell house rule.

## Cast impure shell

- `src/engine/cast.ts` resolves the executor after prompt/transcript/tool setup.
- It calls `executor.dispense`, meters, parses, gates, effects, and classifies.
- The normal terminal path performs exactly one `appendRunLog` near the end.
- Optional facts use conditional object spreads at that append.
- `turnsUsed` is the closest precedent: resolve once, spread only when defined.
- `seatDefaulted`, `reducedGrounding`, and `overEnvelope` are other optional precedents.
- The existing missing-capability early return logs before an executor is resolved.
- That record has no resolved executor and is outside the end-of-cast resolved-executor seam.
- It must remain lane-less rather than claiming a lane that never executed.
- Timeout still passes through the final append after an executor was resolved and attempted.
- A known timeout executor can therefore retain its execution lane.

## Current integration tests

- `src/engine/cast.test.ts` is an addon-free integration test of the impure cast shell.
- It injects a stub executor and writes transcript/log files into temporary directories.
- The primary test proves stream, parse, gate, effect, metering, and one run record.
- Its stub currently has id `"stub"`, so it has no known lane under the requested mapping.
- The helper can accept an id to represent a known executor without spawning anything.
- The primary proof can use a Claude-id stub and assert the record contains `"claude"`.
- A separate lane-less cast can keep the generic stub id and assert key omission.
- Existing cleanup removes all temp directories after every test.
- Run records are read directly as JSON, matching other marker integration proofs.

## Pure unit tests

- `src/engine/cast-core.test.ts` already groups tests by each resolver.
- It imports production symbols directly from `cast-core.ts`.
- A focused group can pin all mapping states:
  - `"claude"` returns `"claude"`;
  - `"openai-compat"` returns `"codex"`;
  - an unknown id returns `undefined`.
- Return typing against `AgentSeat` prevents emitting a lane outside the known union.
- The integration test then proves the pure decision is actually forwarded by the shell.

## Boundaries and constraints

- Do not modify `run-log.ts`; its field and omission semantics already satisfy the dependency.
- Do not modify executor implementations or selection behavior.
- Do not add seats or aliases.
- Do not infer lane from model names, environment, or play routing metadata.
- Do not stamp the routing disposition (`seatDefaulted`) as execution provenance.
- Do not fabricate a lane for arbitrary third-party/injected executors.
- Do not change schema version; T-071-01-01 established optional back-compat metadata.
- Do not change ticket frontmatter; current modifications there are Lisa-owned.

## Verification surface

- Focused pure gate: `bun test src/engine/cast-core.test.ts`.
- Focused shell gate: `bun test src/engine/cast.test.ts`.
- Repository gate: `bun run check` (BAML codegen, typecheck, full tests).
- Diff inspection must show only the two source files and two test files owned here.
- Final status inspection must confirm those files are committed and not left staged/dirty.

## Research conclusion

- The dependency is present and the producer seam is narrow.
- `executor.id` is the authoritative input.
- `cast-core.ts` is the established home for the mapping decision.
- `cast.ts` is the established home for conditional forwarding to the ledger.
- `cast-core.test.ts` pins policy; `cast.test.ts` proves end-to-end persistence and omission.
