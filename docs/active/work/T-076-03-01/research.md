# Research — T-076-03-01

## Assignment and workflow constraints

- The ticket begins in `research` and all remaining RDSPI phases must run continuously.
- Phase artifacts belong in `.lisa/attempts/T-076-03-01/1/work/` for this lease.
- Lisa owns publication into `docs/active/work/T-076-03-01/`.
- Ticket `phase` and `status` frontmatter are Lisa-owned and must not be edited.
- Ticket source commits must use `lisa commit-ticket` with exact repository-relative includes.
- Ordinary staging and ordinary `git commit` are prohibited for ticket work.
- The repository already has Lisa-owned modifications in provenance and ticket files.
- Those unrelated changes must remain untouched.

## Story contract

- Parent story `S-076-03` scopes the change to `src/doctor/`.
- The story extends executor dispensability from the primary seat to the reviewer seat.
- A reviewer is relevant only when complement resolution would return one under current config.
- Default configuration is deliberately unprovisioned after `T-076-01-01`.
- Default doctor output must therefore expose an inert cross-review state rather than omit it.
- The required inert wording is `cross-review: not provisioned — casts skip review`.
- That inert state is green because a default cast will not dial a reviewer.
- A provisioned reviewer must receive the same shallow dispensability probe as an active executor.
- A reachable reviewer produces a green named check.
- An unreachable reviewer produces a red named check with a repair hint.
- The red name must identify the reviewer seat.
- The story requires reuse of complement resolution from `S-076-01`.
- The story requires reuse of the executor probe from `T-074-01-01`.
- A second probing protocol is outside the contract.
- Auto-provisioning and unrelated doctor changes are outside the slice.
- The honest boundary is probe-level and unmetered; no cast or metered dispense belongs here.

## Charter and vision grounding

- P3 makes doctor a gate whose green result must not omit a configured dependency.
- P5 requires this readiness check to operate from local machine state.
- The story restates green as “everything this cast will dial is reachable.”
- The change does not add a run-time approval or conversation.
- The change does not move authoring configuration to the counter.
- The change remains executor-neutral because it consumes the shared executor seam.

## Existing doctor model

- `src/doctor/doctor-core.ts` owns the pure `Check` data model.
- A check contains `name`, `ok`, and an optional `hint`.
- `passed(name)` returns a green check without a hint.
- `failed(name, hint)` returns a red check with a required hint.
- `renderDoctorReport` lists both green and red checks.
- The renderer derives overall doctor success from all returned checks.
- Adding a check requires no renderer change.
- Visible green lines are therefore already supported.
- A green inert cross-review line can be represented as an ordinary passed check.
- A provisioned reviewer failure can be represented as an ordinary failed check.

## Existing doctor probe shell

- `src/doctor/doctor-probe.ts` owns the world-touching dependency probe.
- It currently produces five ordered checks.
- Their order is lisa PATH, Claude PATH, BAML, active executor config, active executor probe.
- `probeDoctor` runs independent checks through `Promise.all`.
- Promise input order preserves report order.
- Each check is wrapped with `safeCheck`.
- `safeCheck` converts thrown values into red checks instead of rejecting.
- `DoctorProbeDeps` supplies injected world readers.
- `DEFAULT_PROBE_DEPS` binds the real PATH, BAML, environment, and executor probe effects.
- Callers pass `Partial<DoctorProbeDeps>` and receive real defaults for omitted dependencies.
- The existing injected `executorProbe(env)` returns `ExecutorProbeResult`.
- Its real implementation selects the active executor and calls only `probe()`.
- `executorDispensableCheck(id, result)` is a pure result-to-check mapper.
- It preserves provider reason and hint text in the single doctor hint field.
- It provides actionable fallback text for an incomplete failure result.
- The active executor check is named `executor dispensable: <id>`.
- Unknown executor construction or probe throws are contained by `safeCheck`.

## Existing complement resolution

- `src/cross-review/resolve-complement.ts` owns reviewer routing policy.
- `resolveComplementExecutor(seatOfExecution, registry?)` is the canonical resolver.
- It returns `ComplementExecutor | null`.
- A resolved complement contains a known `AgentSeat` and an `Executor`.
- Registry executor ids are projected to seats through `resolveSeatOfExecution`.
- Unknown executor ids do not become review seats.
- The author seat must itself exist in the configured registry.
- Exactly one different configured seat must exist.
- Missing, incomplete, or ambiguous configurations return `null`.
- The omitted registry uses a private one-seat Claude registry.
- That default represents a fresh installation after `T-076-01-01`.
- Consequently `resolveComplementExecutor("claude")` returns `null`.
- Consequently `resolveComplementExecutor("codex")` also returns `null`.
- An explicit two-seat registry resolves the sole complementary seat.
- Claude author plus `claude` and `openai-compat` resolves the Codex seat.
- Codex author plus the same registry resolves the Claude seat.
- Resolver construction uses `executorFor` with the selected complement id.
- The returned reviewer implements the shared `Executor` contract.
- Resolution itself does not probe or dispense.

## Seat resolution

- `src/engine/cast-core.ts` owns executor-id to seat projection.
- `resolveSeatOfExecution("claude")` returns `claude`.
- `resolveSeatOfExecution("openai-compat")` returns `codex`.
- Unknown ids return `undefined`.
- Doctor already resolves the active executor id through `resolveExecutorId({}, env)`.
- That id can therefore be projected through the same seat function used by casts.
- The current active-executor environment remains the source of author-seat identity.

## Executor probe contract

- `src/executor/executor.ts` defines `ExecutorProbeResult`.
- The result has `ok` plus optional `reason` and `hint`.
- Every `Executor` requires `probe(): Promise<ExecutorProbeResult>`.
- The interface documents probe as shallow and unmetered.
- `dispense()` is a separate method and is not needed for doctor.
- Claude probes local auth/config state without a metered model turn.
- OpenAI-compatible probes endpoint reachability without chat completion.
- Provider-specific repair guidance already arrives in the structured probe result.
- A reviewer resolved by cross-review can therefore be probed without a new mechanism.

## Current cast integration

- `src/engine/cast.ts` accepts optional `crossReviewRegistry` in cast options.
- When omitted, cast calls `resolveComplementExecutor(seatOfExecution)`.
- When present, cast passes the explicit registry into the same resolver.
- Cross-review runs only after a gated effect lands and a patch exists.
- Default resolution is inert, so default casts skip review.
- An explicit two-seat registry provisions review for tests or configured callers.
- The ticket does not authorize changes to cast orchestration.
- The story scopes only the doctor's representation of the same resolution semantics.

## Test surface

- `src/doctor/doctor-probe.test.ts` is the primary unit-test surface.
- It already injects PATH, BAML, environment, and primary-probe facts.
- Existing deterministic cases currently expect five checks.
- Adding the reviewer state will make the stable doctor-probe count six.
- The `byName` helper supports exact names and base-name prefixes.
- Current tests prove active executor probe success, failure detail, and thrown-effect containment.
- The guarded-live test checks shape rather than host-specific verdict.
- Default live behavior can deterministically assert the inert reviewer line because default resolution is inert.
- `src/doctor/preflight.test.ts` composes `probeDoctor` with the pure renderer.
- Deterministic preflight cases pass partial injected doctor dependencies.
- They will inherit the default inert reviewer result without network or subprocess work.
- `src/doctor/doctor-cli.smoke.test.ts` asserts report/exit invariants rather than fixed counts.
- No CLI parser or renderer test currently assumes exactly five dependency checks.
- `src/cross-review/resolve-complement.test.ts` already pins default inert and explicit two-seat behavior.

## Baseline verification

- Focused baseline command:
  `bun test src/doctor/doctor-probe.test.ts src/doctor/preflight.test.ts src/cross-review/resolve-complement.test.ts`.
- Result: 28 passed, 0 failed, 115 expectations.
- The live probe smoke completed successfully on the current host.
- Baseline source is clean for the expected doctor-owned files.
- Existing working-tree changes are confined to Lisa-owned provenance and ticket files.

## Constraints and risks surfaced

- Doctor must not infer provisioning from the built-in adapter catalog.
- Doing so would regress the inert default fixed by `T-076-01-01`.
- Doctor must not duplicate the resolver's seat-counting algorithm.
- Doctor must not call `dispense()` to establish reviewer reachability.
- Reviewer check naming must distinguish it from the primary executor check.
- The inert line must remain visible even though it is green.
- A thrown resolver/factory/probe failure must remain returned red data.
- Tests must avoid real reviewer process or network calls.
- The injected configuration must model the same registry semantics cast uses.
- The new dependency shape must preserve partial-dependency calls in preflight tests.
- No ticket-owned work is expected outside `src/doctor/doctor-probe.ts` and its unit test.

## Research conclusion

- All required primitives already exist.
- The doctor renderer already supports visible green inert state and actionable red state.
- Canonical complement resolution already defines provisioned versus inert behavior.
- Resolved reviewers already expose the existing unmetered executor probe.
- The implementation surface is a doctor-level composition and its deterministic tests.
