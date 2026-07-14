# Research — T-074-01-03

## Ticket contract

The ticket adds a cast-time refusal when the active executor's shallow probe reports that the
executor is not dispensable from the current environment.

The refusal must reuse the existing `missing-capability` run outcome and amber-andon behavior.

The returned `RunSummary` must carry:

- `outcome: "missing-capability"`;
- `materialized: false`;
- zero measured usage;
- no produced artifact or captured diff.

The durable run log must receive exactly one line carrying:

- `outcome: "missing-capability"`;
- normalized empty usage;
- zero cost;
- no gate rows;
- the ordinary cast envelope/project metadata;
- the executor probe's named cause and actionable hint on the cast surface.

The acceptance criterion explicitly names a new pure classifier case in `cast-core.test.ts` and
the corresponding effect path in `cast.ts`.

The passing-probe path must preserve current cast behavior byte-for-byte after the probe gate.

## Story boundary

Parent story `S-074-01` makes executor dispensability a shared executor-boundary capability with
two consumers: doctor and cast.

Ticket `T-074-01-01` already established the boundary method and both production implementations.

Ticket `T-074-01-02` owns the doctor consumer and is intentionally disjoint from this ticket.

This ticket owns only `src/engine/cast.ts`, `src/engine/cast-core.ts`, and their relevant tests.

The story excludes budget-tier changes, funding changes, sandbox escape, credential handling,
executor behavior changes, and a full open-model validation matrix.

The probe is explicitly shallow, unmetered, and not proof of a successful live model turn.

The denied-Keychain live scenario remains deferred; this ticket is fixture-proven.

## Executor boundary as currently committed

`src/executor/executor.ts` exports `ExecutorProbeResult`:

```ts
interface ExecutorProbeResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly hint?: string;
}
```

`Executor` requires `probe(): Promise<ExecutorProbeResult>` in addition to `id` and `dispense`.

Expected environment failures are returned data rather than thrown exceptions.

`ClaudeExecutor.probe()` reads injected or production auth/config facts and returns a classified
result. Its failure language names login or config-store/Keychain access and supplies repair text.

`OpenAICompatExecutor.probe()` reads injected or production endpoint facts and returns a
classified result. Its failure language names endpoint/auth reachability and supplies repair text.

Both built-in `probe()` methods catch reader exceptions and convert them to structured failures.

Every structural fake executor in the repository now implements `probe()`, normally returning
`{ ok: true }`.

## Current cast orchestration

`src/engine/cast.ts` is the impure cast shell.

`castPlay` currently performs these relevant operations in order:

1. Resolve project root, project id, start timestamp, and run id.
2. Read the project MCP registry.
3. Resolve play tool requirements.
4. Early-return through a `missing-capability` andon if a required MCP is absent.
5. Render the prompt.
6. Resolve the effective turn cap.
7. Create the transcript directory and stream sink.
8. Resolve the active executor from an injected instance or the selector.
9. Resolve its accounting seat.
10. Call `executor.dispense()`.
11. Classify timeout, budget, and gate state.
12. Optionally effect and cross-review output.
13. Append exactly one ordinary terminal run-log record.
14. Return a `RunSummary`.

There is currently no `executor.probe()` call in `castPlay`.

A non-timeout error thrown by `dispense()` is deliberately rethrown. This is why a broken
environment may still expose a raw stack when the failure occurs before a result exists.

Executor resolution happens after prompt rendering and transcript setup. The MCP andon happens
earlier, before those operations.

## Existing missing-capability andon

The required-MCP refusal in `cast.ts` is the existing cast-time missing-capability pattern.

When `resolveTools` reports missing required MCP ids, `castPlay`:

- writes one human-readable `· andon: missing-capability` line;
- appends one run-log record directly;
- records `usage: {}`, `costUsd: 0`, and `gateResults: []`;
- returns `materialized: false` with empty actual usage;
- does not render, dispense, parse, gate, effect, cross-review, or reach the terminal append.

The direct append plus immediate return ensures exactly one ledger line.

`appendRunLog` normalizes the empty usage object into four zero token counters in persisted JSON.

`resolveLoggedModel(undefined, opts.model)` preserves the existing model fallback rule on an
early refusal.

The existing early record does not include an executor seat because no executor has been resolved.

The run-log schema has no dedicated cause or hint fields. Existing andon detail is surfaced on
stdout, while the outcome makes the refusal countable in the ledger.

## Pure cast core

`src/engine/cast-core.ts` contains cast decisions that can be tested without filesystem, clock,
network, subprocess, or BAML effects.

`classify` currently accepts three facts:

- `timedOut`;
- `budgetOutcome`;
- `gateVerdict`.

Its priority is timeout, gate stop, exhausted budget, then success.

Its `Verdict` carries outcome, materialization authorization, gate rows, and the optional
over-envelope warning.

`classify` has no input representing a pre-dispense capability refusal.

`resolveTools` is a separate pure classifier for play tool declarations. Its failure variant is
`{ ok: false, missing }`, which the impure shell translates into the MCP andon.

`resolveSeatOfExecution` maps only known production executor ids to accounting lanes.

`cast-core.test.ts` already pins every `classify` priority branch and the tool-resolution behavior.

The classifier tests use plain fabricated values and do not instantiate an executor.

## Cast integration tests

`src/engine/cast.test.ts` exercises `castPlay` end to end using injected fake executors and temp
run-log/transcript paths.

The shared `stubExecutor` streams deterministic messages, returns a metered result, and now has a
successful probe method.

The first integration test proves the complete successful parse/gate/effect/log path and inspects
the single persisted ledger line.

Other tests use local executor objects for timeout, progress, and cross-review behavior.

The test file already provides helpers for temp directories, stdout capture, and JSONL inspection.

No existing cast integration test exercises a failing executor probe because production cast does
not yet consume the method.

## Persistence and compatibility constraints

`RunOutcome` already includes `missing-capability`; no log schema change is required.

`RunSummary` already supports the required outcome and materialization state; no public shape
change is required for the acceptance result.

The empty actual usage convention already exists on early MCP refusal and timeout paths.

The cast terminal append is structurally capable of logging any `RunOutcome`, but a pre-dispense
refusal needs an early return to avoid executing later parse/effect logic and a second append.

The passing path must still call `dispense()` with the same prompt, model, turn cap, tool flags,
stream callback, and timeout values.

No probe result is metered into budget usage or cost.

## Repository and workflow constraints

The working tree contains Lisa-owned ticket/provenance changes and sibling ticket artifacts.

Those paths are outside this ticket and must not be staged, committed, reverted, or rewritten.

Attempt artifacts belong only under `.lisa/attempts/T-074-01-03/1/work/`.

Source units must be committed through `lisa commit-ticket` with exact repository-relative include
paths; ordinary `git add` and `git commit` are forbidden for ticket work.

`bun run check` is the repository gate and must pass before the ticket is reviewed as complete.

## Observed assumptions

The executor probe is contractually near-zero-cost but asynchronous and effectful.

The active executor can be either explicitly injected or selected by id/environment.

The exact injected executor instance must be probed; resolving a separate instance could disagree
with the one later used for dispense.

Probe failures are expected to carry reason and hint, but the shared type permits either field to
be absent, so cast-side rendering must remain total over malformed or minimal non-ok results.

The named reason and hint are human surface data; the existing ledger contract counts the outcome
and zero spend rather than storing free-form failure prose.

The ticket does not request retry, fallback to another executor, or user approval.
