# T-076-01-01 — Research

## Assignment contract

- The ticket starts in `research` and requires all remaining RDSPI phases in one continuous pass.
- Attempt artifacts belong only in `.lisa/attempts/T-076-01-01/1/work/`.
- Lisa owns publication into `docs/active/work/` and ticket phase/status transitions.
- Ticket frontmatter must not be edited by this worker.
- Ticket-owned source must be committed only with `lisa commit-ticket` and exact repeated
  repository-relative `--include` paths.
- Ordinary `git add` and `git commit` are forbidden for ticket work.
- The full completion gate is `bun run check`.

## Product and story contract

- Vend's run remains a two-gesture transaction under P2; a fresh install cannot acquire a hidden
  requirement for a second live service during settlement.
- Gates are the contract under P3; a reviewer selected from an unprovisioned endpoint is not an
  enforceable gate.
- S-076-01 limits this ticket to complement-resolution semantics.
- The dependent T-076-01-02 owns the `crossReviewSkipped` run-record marker and cast wiring.
- S-076-02 owns failure handling for a reviewer that was provisioned but is unreachable.
- S-076-03 owns doctor coverage.
- Provisioning UI is explicitly outside this slice.
- This ticket must keep the default path inert and preserve explicit reviewer provisioning.

## Field failure represented by the ticket

- `castPlay` captures a landed diff and knows the authoring executor seat.
- On the settlement path it calls `resolveComplementExecutor(seatOfExecution)` when no explicit
  `crossReviewRegistry` was supplied.
- The resolver currently defaults its `registry` argument to `builtinExecutors`.
- `builtinExecutors` contains both `claude` and `openai-compat` factories.
- The resolver projects those ids to the two known author/reviewer seats.
- A Claude-authored default cast therefore always sees exactly one complement: Codex.
- It constructs `OpenAICompatExecutor` through `executorFor`.
- The later review dispense reaches an OpenAI-compatible endpoint.
- `OpenAICompatExecutor` defaults that endpoint to `http://localhost:11434/v1`.
- No operator setting is required before the resolver constructs this reviewing executor.
- Consequently the documented “one-seat registry” inert branch is unreachable under the rc.4
  built-in default.

## Relevant source topology

### `src/cross-review/resolve-complement.ts`

- Owns cross-review routing policy.
- Imports `resolveSeatOfExecution` rather than duplicating executor-id-to-seat mapping.
- Imports only the provider-neutral `Executor` type.
- Imports `executorFor`, `ExecutorRegistry`, and currently `builtinExecutors`.
- Enumerates registry keys lazily; it does not invoke every factory.
- Ignores registry ids that do not map to a known seat.
- Requires the authoring seat itself to be represented in the registry.
- Requires exactly one different known seat.
- Constructs only the selected complement through `executorFor` with an explicit id and `{}` env.
- Returns `null` for missing, unknown, incomplete, or ambiguous configuration.
- Performs no dispense, filesystem, clock, or network operation itself.

### `src/executor/select.ts`

- Defines `ExecutorRegistry` as a name-to-nullary-factory record.
- Defines `builtinExecutors` with factories for Claude and OpenAI-compatible execution.
- The factories are lazy so unselected adapters are not constructed.
- Defines `DEFAULT_EXECUTOR_ID = "claude"`.
- Defines `VEND_EXECUTOR` as the execution selector environment convention.
- `resolveExecutorId` applies explicit option, then environment, then Claude default precedence.
- `executorFor` looks up exactly the selected id and constructs exactly that executor.
- Unknown ids are loud configuration errors.
- The built-in registry is therefore an adapter catalog for ordinary executor selection.
- Presence in that catalog does not prove an operator configured the adapter as a reviewer.

### `src/executor/openai-compat.ts`

- Defines `VEND_OPENAI_BASE_URL`, `VEND_EXECUTOR_MODEL`, and optional API-key environment names.
- Defines `DEFAULT_OPENAI_BASE_URL` as the local Ollama URL.
- The adapter's request/probe helpers use the environment URL or that local default.
- Construction itself performs no network access.
- Dispense/probe is where the constructed adapter becomes dialable.
- The local URL default remains legitimate when an operator explicitly selects OpenAI-compatible
  execution through the ordinary executor-selection path.
- The defect is not the existence of the adapter or its local-first endpoint default.
- The defect is default cross-review interpreting catalog availability as reviewer provisioning.

### `src/engine/cast.ts`

- `CastOptions.executor` injects an author executor instance.
- `CastOptions.executorId` selects the author through `executorFor`.
- `CastOptions.crossReviewRegistry` is the established explicit complement-capability injection.
- Production callers that omit it enter the resolver's default path.
- Hermetic cast and end-to-end tests pass a two-seat registry explicitly.
- The settlement branch invokes review only when gates are enabled, the effect landed, a diff was
  captured, and the author has a known seat.
- T-076-01-02 will later attach a skip marker when that relevant branch resolves `null`.
- This ticket need not alter cast orchestration to make default resolution inert.

## Existing provisioning convention

- The executor subsystem represents configured/available executor capability with an injectable
  `ExecutorRegistry`.
- `executorFor` has accepted an injected registry since T-035-01.
- `resolveComplementExecutor` has accepted an injected registry since T-073-01-02.
- `CastOptions.crossReviewRegistry` threads that explicit registry to the resolver.
- Existing unit and integration tests provision both review seats by passing a registry containing
  `claude` and `openai-compat` factories.
- A registry entry retains lazy construction and provider neutrality.
- No parallel reviewer-id switch, secret shape, or new environment variable is necessary.
- This is the only existing cross-review provisioning surface.
- A user-facing UI or persisted reviewer configuration is explicitly deferred by the story.

## Current tests

- `src/cross-review/resolve-complement.test.ts` uses inert stub executors.
- Its two-seat fixture has `claude` and `openai-compat` keys.
- It proves Claude author → Codex reviewer.
- It proves Codex author → Claude reviewer.
- It proves a one-seat injected registry returns `null`.
- It proves absent/unknown author seats are inert.
- It proves an opposite-only registry is incomplete.
- It does not characterize the no-registry-argument default.
- That missing characterization is exactly the rc.4 regression gap.
- `src/executor/select.test.ts` separately proves the built-in catalog retains both adapters and
  that explicit `VEND_EXECUTOR=openai-compat` selection works.
- Focused baseline: 20 tests pass across the resolver and selector suites.

## Exact default behavior required

- `resolveComplementExecutor("claude")` must return `null`.
- This is the exact field-failure shape: Claude author plus omitted/default review registry.
- `resolveComplementExecutor("codex")` must also return `null` under default configuration.
- The default must contain no constructible OpenAI-compatible complement.
- Passing an explicit two-seat registry must continue to resolve in both directions.
- Explicit provisioning must remain lazy and must not dispense during resolution.
- Ordinary author-executor selection through `builtinExecutors` must remain unchanged.

## Purity and architecture constraints

- The resolver remains deterministic over its seat and registry arguments.
- It should not read environment variables or inspect endpoint reachability.
- Reachability is a different fact handled by executor probes and S-076-02/S-076-03.
- The pure-core/impure-shell split keeps provisioning declaration distinct from live health.
- Concrete executor imports remain confined to the selector/catalog layer.
- Cross-review continues to depend on the provider-neutral `Executor` contract.
- The default must not be implemented by eagerly constructing an author or reviewer.
- Registry factories preserve the established lazy behavior.

## Repository and workflow observations

- The ticket/story/epic board files were initially visible as Lisa-owned untracked state.
- They are not ticket-owned implementation paths and must never be included in the source commit.
- No source diff existed at research start.
- `lisa commit-ticket --help` confirms required flags:
  `--ticket-id`, `--message`, and repeated exact `--include`.
- The commit helper operates without touching the ordinary index.

## Constraints and assumptions surfaced

- “Built in” means Vend ships an adapter; it does not mean a reviewer is provisioned.
- The default execution seat remains Claude.
- A default one-seat review registry accurately represents the default configured capability.
- An explicit two-seat registry is the existing authoring/configuration mechanism for cross-review.
- Removing OpenAI-compatible execution from `builtinExecutors` would regress P6 and explicit
  `VEND_EXECUTOR=openai-compat` selection, so it is not within scope.
- Changing the OpenAI adapter's endpoint default globally would alter explicit execution behavior
  beyond the resolver problem and is not required by the story.
- Altering run-record schema or cast settlement here would overlap the dependent ticket.

## Verification surface

- Add direct no-argument/default-registry assertions for both known author seats.
- Retain the explicit two-seat resolution assertions as provisioning coverage.
- Add a factory-spy assertion if needed to prove default resolution constructs no dialable reviewer.
- Run the focused resolver and selector tests.
- Run `bun run check` before committing.
- Commit only the resolver source and adjacent test through `lisa commit-ticket`.
- Confirm those exact paths are clean after the commit.
