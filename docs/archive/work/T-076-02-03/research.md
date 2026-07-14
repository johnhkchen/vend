# T-076-02-03 Research — no-network characterization test

## Assignment and workflow constraints

- The ticket starts in `phase: research`.
- All remaining RDSPI phases must run continuously through Review.
- Attempt artifacts belong only under `.lisa/attempts/T-076-02-03/1/work/`.
- Lisa publishes admitted artifacts to `docs/active/work/T-076-02-03/`.
- The ticket frontmatter is Lisa-owned and must not be edited by the worker.
- Ticket source work must be committed with `lisa commit-ticket`.
- Each `--include` must be an exact repository-relative ticket-owned path.
- Ordinary `git add` and `git commit` are forbidden for this assignment.
- Completion requires the full `bun run check` gate to be green.

## Product and charter grounding

- Vend is local-first and must remain useful without a cloud or local model endpoint.
- P3 says gates are the contract.
- This ticket turns a shipped field failure into an executable regression gate.
- P5 says the product is fully usable offline on one machine.
- An unrequested review connection to localhost contradicts that local-first boundary.
- The ticket does not add new review semantics.
- The ticket does not add retry behavior.
- The ticket does not add reviewer provisioning UI.
- The test must preserve the existing two-gesture run path.

## Parent story contract

- Parent story: `S-076-02`.
- Scope is the settlement tail of `src/engine/cast.ts` and the record/artifact write path.
- The story names three settlement invariants.
- Provisioned reviewer failure becomes an amber `missing-capability` outcome.
- A spent cast retains its ledger row even when settlement throws.
- Captured diff evidence and its ledger representation stay consistent.
- The story acceptance explicitly requires this ticket's no-network characterization.
- The primary executor must be mocked so the test spends no tokens.
- Settlement onward should remain real.
- The no-reviewer case must use default complement resolution.
- The provisioned-reviewer case must exercise failure at the cast boundary.
- Successful-review verdict semantics are out of this slice.

## Dependency state

- `T-076-01-01` changed omitted complement resolution to a one-seat default registry.
- The shipped adapter catalog still contains both Claude and OpenAI-compatible executors.
- The default cross-review capability registry contains only Claude.
- Therefore shipped adapter availability is no longer treated as reviewer provisioning.
- `T-076-01-02` added the durable `crossReviewSkipped` marker.
- `T-076-02-01` catches provisioned review dispense and parse failures.
- Those failures settle as `missing-capability` without rejecting `castPlay`.
- `T-076-02-02` wraps the complete post-effect settlement tail.
- Its `finally` block reconciles captured diff availability and appends the run row.
- The dependency chain is complete at repository `HEAD`.

## `castPlay` orchestration

- `src/engine/cast.ts` exports the impure `castPlay` shell.
- A caller may inject the primary `Executor` through `CastOptions.executor`.
- An injected executor still goes through probe, dispense, parse, gate, effect, and settlement.
- The primary executor ID maps to an authoring seat through `resolveSeatOfExecution`.
- A primary executor with ID `claude` produces authoring seat `claude`.
- Cross-review applies only after a successful, materialized, diff-producing effect.
- Cross-review also requires gates to be enabled and a known authoring seat.
- The effect fixture must therefore write real files and report them as artifacts.
- `captureEffectDiff` uses real Git state to materialize the patch.
- The captured reference is `.vend/artifacts/<run-id>.diff`.
- `castPlay` reads that patch before dispensing a reviewer.
- A null reviewer resolution sets `crossReviewSkipped` and does not call a transport.
- A resolved reviewer is handed to `dispenseReviewVerdict`.
- Reviewer errors are converted to `crossReviewFailure` inside settlement.
- The failure later settles through `settleCrossReviewFailure`.
- The terminal outcome becomes `missing-capability`.
- Materialization and the captured diff remain truthful.
- The ordinary terminal append records the final outcome and evidence.

## Default complement resolution

- `src/cross-review/resolve-complement.ts` owns complement policy.
- Its omitted registry is `defaultCrossReviewRegistry`.
- That registry has only the default Claude executor entry.
- It does not expose the built-in OpenAI-compatible adapter as provisioned review capacity.
- `resolveComplementExecutor("claude")` therefore returns `null`.
- No OpenAI-compatible factory is constructed on that path.
- No probe occurs during complement resolution.
- No reviewer `dispense` occurs after a null resolution.
- The default OpenAI-compatible URL is irrelevant to the inert path.
- `src/executor/openai-compat.ts` defines that URL as `http://localhost:11434/v1`.
- The characterization should not depend on whether a developer happens to run Ollama there.
- A default cast must complete identically without contacting that endpoint.

## Explicit reviewer provisioning

- `CastOptions.crossReviewRegistry` is the existing test/programmatic provisioning seam.
- `ExecutorRegistry` is a map from executor IDs to lazy factories.
- Resolution requires the author seat itself to be represented in the registry.
- Resolution also requires exactly one distinct complement seat.
- A two-entry `claude` plus `openai-compat` registry resolves Codex as Claude's reviewer.
- The reviewer factory returns an `Executor` interface value.
- The generic cast engine does not import a concrete reviewer adapter.
- Existing positive tests use a stub reviewer returning pass/fail JSON.
- The existing failure test uses a reviewer whose `dispense` throws an injected error.
- That proves catch/classification, but it does not exercise actual `fetch` rejection.

## OpenAI-compatible transport

- `dispenseOpenAICompat` is the real impure transport function.
- It builds `POST <base>/chat/completions`.
- Its default base is the local Ollama URL on port 11434.
- It accepts an environment record as a parameter.
- Supplying a dedicated environment avoids mutating global `process.env` in the test suite.
- It uses global `fetch` with an `AbortController` timeout.
- A connection refusal rejects from `fetch`.
- Non-timeout failures are rethrown as `Error` values.
- `dispenseReviewVerdict` does not consume transport failures itself.
- `castPlay` catches them at the reviewer boundary.
- Calling `dispenseOpenAICompat` directly from a provisioned executor delegate keeps fetch real.
- A closed loopback port supplies a deterministic local unreachable endpoint.
- Acquiring an ephemeral port from a temporary TCP listener and then closing it avoids assuming
  port 11434 is free.
- The fetch then fails locally and quickly without external network access.

## Existing test infrastructure

- `src/engine/cast.test.ts` is the cast-level integration suite.
- It uses Bun's `test`, `expect`, and `spyOn` APIs.
- Each test receives a temporary project root from `tmp()`.
- `afterEach` removes every registered temporary root.
- `initGitRepo` initializes a real repository with an empty baseline commit.
- It supplies local Git identity flags and does not depend on user configuration.
- `BIG_BUDGET` prevents unrelated budget refusal.
- `stubExecutor` mocks only the primary model execution.
- Giving that stub ID `claude` activates the known authoring lane.
- `boardPlanPlay` is a BAML-free, file-writing fixture.
- It writes a story and ticket under the temporary project.
- Its effect reports both absolute paths as artifacts.
- Real diff capture includes both files in the patch.
- `captureStdout` safely restores the process stdout writer.
- Tests read the real JSONL ledger through `readFile`.
- Tests use `reviveRecord` to verify read-boundary normalization.
- Tests use `Bun.file(path).exists()` for artifact presence checks.

## Existing no-reviewer cast test

- The current test is named `a relevant default-config review records why complement resolution
  was inert`.
- It creates a real temporary Git repository.
- It runs `boardPlanPlay` through a mocked primary Claude executor.
- It omits `crossReviewRegistry`, exercising production default resolution.
- It asserts a successful, materialized summary.
- It asserts one ledger row.
- It asserts the ordinary fixture gate row remains the only gate result.
- It asserts no `crossVendorVerdict` exists.
- It asserts the exact `crossReviewSkipped` marker.
- It asserts the marker survives `reviveRecord`.
- It does not currently assert the summary's exact diff reference.
- It does not currently read or inspect the captured artifact.
- It does not assert that the record and summary share the same reference.
- It does not assert absence of `artifactDiscrepancy`.
- Its subject and name predate this ticket and do not identify the field-failure regression.

## Existing reviewer-failure cast test

- The current test is named `a throwing reviewer settles as a named missing-capability andon
  without a stack`.
- It uses real Git, effect, diff capture, settlement, and ledger append.
- It provisions a two-seat registry.
- Its reviewer is an interface stub whose `dispense` throws a supplied error.
- The whole awaited cast returns a summary.
- The returned outcome is `missing-capability`.
- The record retains usage, cost, gate rows, and the captured diff reference.
- Stdout assertions prove actionable andon copy and no stack.
- The test comment treats an awaited returned value as proof that no rejection escaped.
- It does not exercise the real `fetch` implementation.
- It remains useful focused coverage and need not be removed.

## Run-log and artifact consistency

- A successful diff-producing cast returns `summary.capturedDiff`.
- The terminal row conditionally contains the same `capturedDiff` string.
- `reconcileCapturedDiff` checks the artifact at the append boundary.
- If present, the reference remains under `capturedDiff`.
- If absent, `capturedDiff` is omitted and `artifactDiscrepancy` is recorded.
- The no-reviewer characterization should observe the successful-present branch.
- The reviewer-unreachable characterization should also observe the successful-present branch.
- Both should assert the artifact exists and carries the expected patch paths.
- Both should assert the ledger contains exactly one line.
- Both should assert no discrepancy marker exists.
- The no-reviewer case should assert no reviewer verdict exists.
- The provisioned-unreachable case should assert neither verdict nor skipped marker exists.

## Scope and likely file ownership

- No production defect is visible after the three dependencies.
- `src/engine/cast.test.ts` is the only likely ticket-owned source file.
- No run-log schema change is required.
- No `castPlay` interface change is required.
- No resolver change is required.
- No OpenAI-compatible adapter change is required.
- No manual probe is required if a closed-loopback real-fetch test is stable in suite.
- Existing helper imports may need `node:net` and `dispenseOpenAICompat`.
- New helper code should stay private to the test module.
- The full repository gate remains the authoritative verification.

## Risks and constraints surfaced by research

- Mutating `process.env.VEND_OPENAI_BASE_URL` could interfere with parallel tests.
- Spying on or mocking `fetch` would recreate the coverage gap the ticket is meant to close.
- Assuming localhost:11434 is closed would fail on developer machines running Ollama.
- Using an external TEST-NET address could hang until the cast budget timeout.
- A closed ephemeral loopback port has a very small port-reuse race.
- The loopback reservation must be fully closed before `castPlay` starts reviewer dispense.
- The reviewer transport timeout should remain bounded by the ordinary cast budget.
- The primary executor must stay mocked to avoid tokens and Claude process launch.
- Artifact capture requires a real Git baseline and cannot use a plain temporary directory alone.
- Test assertions should characterize durable outcomes, not implementation call order alone.

## Research conclusion

- The missing proof can be added entirely in `src/engine/cast.test.ts`.
- The existing default-config case is the natural field-failure characterization anchor.
- It needs complete artifact/record consistency assertions and ticket-specific naming.
- A companion case should use explicit two-seat provisioning plus `dispenseOpenAICompat` against a
  closed loopback endpoint.
- This keeps primary dispense mocked while reviewer resolution, reviewer fetch failure,
  settlement, artifact reconciliation, ledger append, and record revival remain real.
- Production source should remain unchanged unless the new characterization exposes a defect.
