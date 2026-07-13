# Design — T-074-01-02

## Decision summary

Extend `DoctorProbeDeps` with an injectable executor-probe effect. Its real default constructs the
active executor through `executorFor({}, env)` and calls only `probe()`. Add a pure
`executorDispensableCheck(id, result)` mapping, then append that check to `probeDoctor` after the
existing executor-config check.

## Goals

- Use the active executor selected by the canonical executor seam.
- Emit exactly `executor dispensable: <id>`.
- Preserve a green result without a hint.
- Preserve an executor's reason and repair hint on failure.
- Guarantee a red check still has useful text if a provider returns incomplete failure data.
- Keep doctor never-throw behavior.
- Keep tests hermetic through injected probe results.
- Prove no token-spending method is part of the doctor composition.

## Option A — inject a complete `Executor`

Add an `executor` or executor factory to `DoctorProbeDeps`, then call `probe()` inside
`probeDoctor`.

Advantages:

- Tests can provide an object whose `dispense` throws if accidentally called.
- The method call is visible at the composition site.
- The id can come directly from the fake executor.

Costs:

- Every fake must implement the full `Executor` interface, including the large dispense signature.
- The injected object can disagree with `env` selection, creating two sources of active id truth.
- It exposes more capability to doctor than doctor needs.
- Partial-dependency call sites become noisier.

Decision: reject. The test seam should expose the smallest world fact/effect required.

## Option B — inject an `ExecutorProbeResult` value

Add a direct result value to `DoctorProbeDeps` and let `probeDoctor` consume it.

Advantages:

- Very simple tests.
- The pure mapping is obvious.

Costs:

- A static default cannot perform the real asynchronous active-executor probe.
- It blurs the difference between a dependency and the fact it reads.
- It cannot prove the default composition calls the boundary method.

Decision: reject as the production dependency shape.

## Option C — inject a narrow probe reader

Add `executorProbe(env): Promise<ExecutorProbeResult>` to `DoctorProbeDeps`.

The default is equivalent to:

```ts
async (env) => executorFor({}, env).probe()
```

Advantages:

- Production uses the canonical active-executor selector.
- Tests inject only success/failure facts and perform no real subprocess or fetch.
- The dependency cannot dispense because its type exposes only a probe result.
- It naturally accepts the same injected environment used by executor config selection.
- It preserves the current partial-dependency pattern.

Costs:

- The check name's id is resolved separately from the default reader.
- Care is required to use the same `env` for both operations.
- Unknown ids throw from the default reader and rely on `safeCheck`.

Decision: choose Option C. Passing the identical `d.env` to both `resolveExecutorId` and the reader
keeps selection aligned.

## Result mapping

Add a pure function:

```ts
executorDispensableCheck(id: string, result: ExecutorProbeResult): Check
```

It constructs the name from a base constant and id.

- `ok: true` maps to `passed(name)`.
- `ok: false` maps to `failed(name, failureText)`.
- When both reason and hint exist, failure text includes both in that order.
- When only one exists, use that value.
- When neither exists, use a generic active-executor repair message.

The reason-first ordering explains what failed before telling the operator what to do. For Claude,
the resulting line includes the required `claude login` and sandbox Keychain language verbatim from
the executor boundary.

## Naming and safe failure

Export `EXECUTOR_DISPENSABLE_CHECK = "executor dispensable"` as the base name. Resolve the id once
inside `probeDoctor` before building the Promise list, and use
`${EXECUTOR_DISPENSABLE_CHECK}: ${id}` as the `safeCheck` fallback name.

If executor construction/probe unexpectedly throws, `safeCheck` returns a red named check carrying
the thrown message. Built-in probe implementations already degrade expected failures into data, so
this path is a last-resort never-throw guard.

## Ordering

Append the new check after `active executor config`:

1. lisa on PATH;
2. claude on PATH;
3. BAML native addon loadable;
4. active executor config;
5. executor dispensable.

This preserves every existing relative position and keeps the two executor checks adjacent. It
also makes the cheap configuration-presence result visible before the stronger reachability result.
The checks may execute concurrently as today; only report order is contractual.

## Token-spend guarantee

Doctor imports and invokes `executorFor(...).probe()`. It never references `dispense`. The injected
dependency is typed to return `ExecutorProbeResult`, so tests can prove both branches without a
metered executor. The dependency ticket already proves each built-in `probe()` avoids model calls:
Claude uses auth status and OpenAI-compatible uses `GET /models`.

## Test design

Update `doctor-probe.test.ts` to provide `executorProbe` in deterministic cases.

- All-green branch injects `{ ok: true }` and asserts the fifth check is green and hintless.
- Failure branch injects Claude's realistic reason/hint facts and asserts:
  - exact name `executor dispensable: claude`;
  - red status;
  - `claude login` in failure text;
  - sandbox and Keychain access in failure text;
  - the callback ran once;
  - no dispense surface exists in the injected dependency.
- Count/order assertions change from four to five.
- Existing isolated-failure tests inject a successful executor probe.
- Never-throw coverage gains a throwing executor-probe case or is extended to cover it.
- Guarded-live smoke expects five shapes but does not force the host verdict.

`preflight.test.ts` nominal injected cases should add a successful `executorProbe` fixture so they
remain independent of the developer's real auth/endpoint state. This is a structural consequence of
the shared dependency type, not a change to preflight behavior.

## Rejected scope

- Do not alter `doctor-core.ts`; its generic model already supports the check.
- Do not edit executor implementations or duplicate their repair hints.
- Do not add a live metered smoke.
- Do not change cast-core classification or run logging; sibling ticket owns that path.
- Do not change funding, budgets, shelf data, or executor selection semantics.
- Do not add timeout policy absent ticket requirements.

## Verification

- Test-first focused failure demonstrates the missing dependency/check.
- Focused doctor and preflight suites prove behavior and hermetic composition.
- `bun run check` proves codegen, strict typecheck, and full regression suite.
- `git diff --check` catches patch whitespace errors.
- Commit only exact owned paths with `lisa commit-ticket`.
