# Structure — T-074-01-02

## Modified production file

### `src/doctor/doctor-probe.ts`

Responsibilities retained:

- gather host facts;
- compose checks;
- keep all expected dependency failures as returned `Check` data;
- preserve stable report order.

New imports:

- `executorFor` from `src/executor/select.ts` beside the existing selection imports;
- `ExecutorProbeResult` as a type-only import from `src/executor/executor.ts`.

New exported constant:

```ts
EXECUTOR_DISPENSABLE_CHECK = "executor dispensable"
```

New dependency member:

```ts
readonly executorProbe: (
  env: Record<string, string | undefined>,
) => Promise<ExecutorProbeResult>;
```

New default effect:

```ts
async function probeActiveExecutor(env): Promise<ExecutorProbeResult>
```

It constructs the selected executor with `executorFor({}, env)` and invokes `probe()` only.

New pure mapping:

```ts
export function executorDispensableCheck(
  id: string,
  result: ExecutorProbeResult,
): Check
```

The function owns:

- the exact suffixed check name;
- pass/fail conversion;
- reason/hint composition;
- fallback failure text for an incomplete non-ok result.

`DEFAULT_PROBE_DEPS` gains `executorProbe: probeActiveExecutor`.

`probeDoctor` gains:

- resolution of the active id from `d.env`;
- a fifth `safeCheck` entry;
- a call to `d.executorProbe(d.env)`;
- mapping through `executorDispensableCheck`.

No exported signature is removed. Existing callers using `Partial<DoctorProbeDeps>` remain source
compatible.

## Modified primary test file

### `src/doctor/doctor-probe.test.ts`

Add:

- imports for the new constant and pure mapping;
- imported Claude probe hint if useful as canonical fixture data;
- reusable `probeOk` fixture;
- explicit success and non-dispensable branch coverage;
- throwing-probe never-throw coverage.

Update:

- all fixed check counts from four to five;
- stable order assertion to include the new check at index four;
- deterministic probeDoctor calls to inject `executorProbe: probeOk`;
- guarded-live expected shape and named-check membership.

The tests continue to use fabricated facts only for deterministic cases. The guarded-live test
continues to permit either host verdict.

## Potential fixture file

### `src/doctor/preflight.test.ts`

Because `castPreflight` forwards `Partial<DoctorProbeDeps>`, deterministic tests should inject a
successful executor probe alongside PATH/BAML/environment facts. This prevents local Claude auth or
OpenAI endpoint state from contaminating preflight unit expectations.

Only fixture calls change; production preflight logic does not.

## Unchanged files

### `src/doctor/doctor-core.ts`

- Generic `Check` constructors already enforce green/no-hint and red/required-hint.
- Renderer automatically incorporates a fifth check and derives exit code.

### `src/doctor/preflight.ts`

- Already forwards the partial dependency object to `probeDoctor`.
- Requires no behavior or type change.

### `src/doctor/doctor-cli.smoke.test.ts`

- Uses output invariants and named config failure, not a fixed count.
- Expected to pass unchanged.

### `src/executor/executor.ts`

- Probe contract was settled by the dependency ticket.

### `src/executor/select.ts`

- Canonical selector already exposes construction and id resolution.

### Executor implementations

- Already implement unmetered probes and provider-specific hints.
- This ticket consumes rather than modifies them.

### Cast and funding modules

- Owned by sibling tickets/out-of-slice work.

## Dependency flow

```text
probeDoctor
  ├─ resolveExecutorId({}, env) ────────────────┐
  ├─ DoctorProbeDeps.executorProbe(env)         │
  │    └─ default: executorFor({}, env).probe() │
  └─ executorDispensableCheck(id, result) ◀─────┘
       └─ passed/failed → Check
            └─ renderDoctorReport (unchanged caller)
```

Both selector operations consume the same environment object. The narrow injected effect makes
tests independent of subprocess/network state.

## Failure behavior

- Structured `{ ok: false, reason, hint }` becomes one red check.
- The check line includes the active id.
- Reason and hint are joined without changing the `Check` schema.
- Missing optional failure strings receive a generic fallback.
- Unexpected reader/selector exceptions become red checks through `safeCheck`.
- No failure path rejects `probeDoctor`.

## Commit boundary

The meaningful source unit is the doctor consumer and its coverage. Expected exact paths:

- `src/doctor/doctor-probe.ts`;
- `src/doctor/doctor-probe.test.ts`;
- `src/doctor/preflight.test.ts` only if hermetic fixture updates are needed.

The private RDSPI artifacts are not source-commit includes; Lisa publishes them after lease
verification. Existing provenance and ticket-file modifications remain outside the transaction.

## Compatibility

- No persisted format changes.
- No CLI argument changes.
- No dependency changes.
- No executor id changes.
- No token/cost accounting changes.
- No live model request is introduced.
- Existing call sites remain compatible through `Partial<DoctorProbeDeps>` and a real default.
