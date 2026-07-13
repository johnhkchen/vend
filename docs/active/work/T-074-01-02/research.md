# Research — T-074-01-02

## Ticket contract

- The ticket adds one named `vend doctor` check.
- Its required name is `executor dispensable: <id>`.
- The check is green when the active executor's shallow probe returns `ok: true`.
- It is red when the probe returns `ok: false`.
- A red result must carry an actionable fix-it hint.
- For Claude, that hint must name `claude login` and sandbox Keychain access.
- The check must not spend tokens.
- `src/doctor/doctor-probe.test.ts` must cover both result branches with injected facts.
- The ticket starts in Research and all six RDSPI phases must run continuously.
- Phase artifacts belong in this attempt-private directory, not `docs/active/work/`.
- Ticket frontmatter phase/status are Lisa-owned and must not be edited.
- Ticket-owned source must be committed only through `lisa commit-ticket` with exact includes.

## Story boundary

- Parent story `S-074-01` makes executor dispensability a capability distinct from PATH presence.
- This ticket is the doctor consumer of the probe boundary established by `T-074-01-01`.
- The sibling `T-074-01-03` owns cast-time classification and the missing-capability andon.
- Funding, shelf behavior, and `TIER_BUDGET` belong outside this story slice.
- The story explicitly calls the probe FREE and near-zero-cost.
- It is not a live metered dispense and does not prove quota, model fitness, or completion success.
- A real denied-Keychain field verification is deferred; this ticket is fixture-proven.
- P3 requires the doctor gate to expose the actual capability failure.
- P5 requires the check to work from local machine state without a cloud control plane.

## Existing doctor architecture

- `src/doctor/doctor-core.ts` owns the pure `Check` model and report rendering.
- A `Check` has `name`, `ok`, and an optional `hint`.
- `passed(name)` creates a green check without a hint.
- `failed(name, hint)` creates a red check with a required hint.
- `renderDoctorReport` lists every check and derives the overall exit code.
- The renderer is generic; it requires no change for an additional check.
- `src/doctor/doctor-probe.ts` is the thin impure shell that gathers world facts.
- `DoctorProbeDeps` injects PATH, BAML, and environment facts for deterministic tests.
- `DEFAULT_PROBE_DEPS` binds those dependencies to real host readers.
- `probeDoctor` merges partial injected dependencies over the defaults.
- It runs independent checks concurrently through `Promise.all`.
- Promise input order defines stable report ordering.
- `safeCheck` converts thrown values into red checks instead of rejecting.
- The existing checks cover lisa PATH, Claude PATH, BAML loadability, and executor config presence.
- Executor config selection already uses `resolveExecutorId({}, env)`.
- The config check names the selected id in its check name.
- Unknown executor ids become returned red config checks rather than raw stacks.

## Executor boundary now available

- `T-074-01-01` is committed at `5f49a6086134a780b9c5b3bcd95af50137068765`.
- `src/executor/executor.ts` exports `ExecutorProbeResult`.
- The result contains `ok`, optional `reason`, and optional `hint`.
- `Executor` requires `probe(): Promise<ExecutorProbeResult>`.
- The interface documents the method as shallow and unmetered.
- `src/executor/select.ts` exports `executorFor` and `resolveExecutorId`.
- `executorFor({}, env)` constructs exactly the executor selected by the same environment used by doctor.
- The built-in ids are `claude` and `openai-compat`.
- The selector is the canonical seam; doctor should not recreate its registry logic.
- Unknown selection throws from `executorFor`, which `safeCheck` can degrade.

## Built-in probe behavior

- `ClaudeExecutor.probe()` reads `claude auth status --json` through an injected reader.
- It does not invoke `claude -p`.
- It parses only the `loggedIn` fact and does not surface account identity.
- Unreadable config/Keychain returns a structured non-ok result.
- Logged-out state also returns a structured non-ok result.
- `CLAUDE_PROBE_HINT` is `run \`claude login\`; if sandboxed, allow Claude Code Keychain access`.
- The hint therefore already satisfies the ticket's required repair language.
- `OpenAICompatExecutor.probe()` performs an authenticated `GET /models` reachability check.
- It does not call `/chat/completions` and sends no prompt.
- Its failures also carry a structured reason and actionable hint.
- Both implementations catch reader failures and return structured non-ok data.

## Current tests and affected expectations

- `src/doctor/doctor-probe.test.ts` injects all existing world facts.
- Its all-green test currently expects four checks.
- Missing-lisa and missing-BAML tests also assert four returned checks.
- The guarded-live smoke expects four well-formed checks.
- These count and ordering assertions must become five-check assertions.
- Existing tests use a `byName` helper that accepts exact names or `name:` suffixes.
- A new exported base name will fit that helper.
- Both probe-result branches can be tested without process/network effects by injecting a probe reader.
- `src/doctor/preflight.test.ts` passes partial `DoctorProbeDeps`.
- Adding a required dependency with a real default preserves those call sites structurally.
- Their nominal injected environments would otherwise use the real executor probe.
- To keep those tests hermetic, their injected deps may need an explicit successful executor probe.
- The guarded-live preflight intentionally remains host-dependent only in verdict, not shape.
- `src/doctor/doctor-cli.smoke.test.ts` asserts invariants rather than a fixed check count.
- Its bogus-executor case should remain safe because both config and dispensability checks are wrapped.

## Purity and effect constraints

- Mapping an `ExecutorProbeResult` to `Check` is pure and should be independently testable.
- Selecting and invoking the active executor is impure construction/effect composition.
- The existing module already owns that effect boundary.
- No change to `doctor-core.ts` is required.
- No direct Claude import is necessary in doctor; the selector remains executor-agnostic.
- The doctor check should preserve the executor-provided failure information.
- `Check` has only one failure-text field (`hint`), so reason and repair text must be combined there if both are surfaced.
- A malformed non-ok probe without a hint still needs a non-empty fallback because `failed` requires one.
- No token counter is available or needed: avoiding `dispense` is the enforceable proof of no token spend.

## Repository and workflow state

- Baseline focused doctor suites pass: 20 tests, 0 failures, 97 assertions.
- The working tree already contains Lisa-owned changes to provenance and ticket files.
- Those changes are outside this ticket's source ownership and must remain untouched.
- The implementation's expected owned source paths are `src/doctor/doctor-probe.ts` and its test.
- If preflight tests require hermetic fixture updates, that test path becomes ticket-owned too.
- No ordinary Git staging or commit command is permitted.

## Research conclusion

- The required capability already exists behind the canonical executor selector.
- Doctor needs a small injected effect dependency plus a pure result-to-check mapping.
- Existing renderer and CLI composition accept an additional check without architectural change.
- The principal regression risks are accidental live probes in nominal unit tests, loss of reason/hint text, unstable check naming/order, and calling `dispense` instead of `probe`.
