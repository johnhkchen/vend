# Review — T-074-01-02

## Outcome

PASS. `probeDoctor` now emits a named `executor dispensable: <id>` check for the canonically
selected executor. Injected facts prove both green and red branches, the Claude failure carries the
required login and sandbox Keychain repair language, the production composition calls only the
unmetered executor probe, and the full repository gate is green.

Source commit:

```text
fcf81c1e024f643d3d199f49ea86e6c3f4dfecff
feat(doctor): check executor dispensability
```

The commit was created only through `lisa commit-ticket` with three exact repository-relative
include paths.

## What changed

### Doctor effect composition

`src/doctor/doctor-probe.ts` now exposes the additional base check name:

```text
executor dispensable
```

`probeDoctor` resolves the selected executor id through the existing canonical selector and appends
a fifth check named:

```text
executor dispensable: <id>
```

The real default dependency constructs the active executor with `executorFor({}, env)` and invokes
its `probe()` method. It does not invoke `dispense`, build a prompt, or inspect a usage record.

### Injectable boundary

`DoctorProbeDeps` now contains a narrow `executorProbe(env)` reader returning the shared
`ExecutorProbeResult` shape. This mirrors the existing injectable PATH/BAML/environment readers and
keeps deterministic tests independent of the host's authentication, Keychain, or endpoint state.

The injected type exposes only probe-result behavior. There is no token-spending method on the
doctor dependency.

### Pure result mapping

New `executorDispensableCheck(id, result)` is pure over plain values:

- `ok: true` becomes `passed("executor dispensable: <id>")` with no hint;
- `ok: false` becomes a red check;
- provider reason and repair hint are preserved in readable order;
- an incomplete non-ok provider result receives a defensive actionable fallback.

The existing `Check` model has one rendered failure-detail field, so reason and repair text are
joined there rather than expanding the report schema. `doctor-core.ts` remains unchanged.

### Never-throw behavior

The new check is run through the existing `safeCheck` wrapper. Built-in executor implementations
already return expected reachability/auth failures as data. If a custom/injected reader nevertheless
throws, doctor resolves with a red `executor dispensable: <id>` check carrying the thrown message.

### Stable ordering

The doctor check order is now:

1. lisa on PATH;
2. claude on PATH;
3. BAML native addon loadable;
4. active executor config;
5. executor dispensable.

All pre-existing relative positions are preserved and the two active-executor checks remain
adjacent.

## Files changed

### `src/doctor/doctor-probe.ts`

- consumes the executor probe boundary;
- adds the injectable reader and real default;
- adds the pure mapping;
- emits the fifth named check;
- updates module documentation to state that the probe is unmetered.

### `src/doctor/doctor-probe.test.ts`

- covers injected ok and non-ok probe results;
- pins the exact selected-id name;
- pins green/no-hint behavior;
- pins Claude failure reason and repair text;
- covers malformed non-ok fallback;
- covers thrown reader degradation;
- updates stable count/order and guarded-live shape assertions to five checks.

### `src/doctor/preflight.test.ts`

- injects successful shallow probe facts in deterministic preflight cases;
- prevents the developer machine's auth/Keychain state from contaminating unrelated assertions;
- leaves the guarded-live case on production defaults.

No production preflight, CLI, renderer, executor, cast, budget, funding, or shelf file changed.

## Acceptance assessment

### Named check from `probeDoctor`

PASS. The fifth returned check is exactly `executor dispensable: <id>`, where `<id>` comes from
`resolveExecutorId` using the same environment passed to the probe reader.

### Red with fix-it hint when probe reports non-ok

PASS. The injected denied-Claude result becomes a red check. Its rendered failure detail includes:

- the config-store/Keychain unreadability reason;
- `claude login`;
- sandbox context;
- Keychain access.

The provider-owned canonical `CLAUDE_PROBE_HINT` supplies the repair language; doctor does not
duplicate or drift it.

### Green when probe reports ok

PASS. Injected `{ ok: true }` produces exactly:

```ts
{ name: "executor dispensable: claude", ok: true }
```

The callback is asserted to run once and the passing check has no hint.

### Both branches use injected facts

PASS. `doctor-probe.test.ts` covers both branches without invoking a subprocess, network endpoint,
or model.

### Check spends no tokens

PASS at the specified shallow boundary. Production doctor calls `.probe()` and contains no
`.dispense(` call. The dependency ticket proves the built-in implementations use Claude auth status
and OpenAI-compatible `GET /models`, not a prompt/model completion.

## Test evidence

### Test-first red

```text
missing EXECUTOR_DISPENSABLE_CHECK export
0 pass, 1 fail, 1 module error
```

### Focused affected suites

```text
24 pass
0 fail
115 assertions
```

Suites:

- `src/doctor/doctor-probe.test.ts`;
- `src/doctor/preflight.test.ts`;
- `src/doctor/doctor-cli.smoke.test.ts`.

### Static checks

```text
bun run check:typecheck: pass
git diff --check: pass
doctor production dispense scan: no matches
```

### Required full gate

```text
bun run check
BAML generation: pass
TypeScript: pass
1721 pass
1 skip
0 fail
5302 assertions
```

The single skip is the pre-existing release acceptance integration requiring built `dist/`
artifacts. It is unrelated to this ticket.

## Scope and compatibility

- Existing `Partial<DoctorProbeDeps>` consumers remain source-compatible through a real default.
- The report renderer required no schema or behavior change.
- CLI arguments and exit-code rules are unchanged.
- Executor ids, selection precedence, implementations, and dispense paths are unchanged.
- No dependency, environment variable, persisted state, or secret handling was added.
- Funding, `TIER_BUDGET`, budgets, and the shelf are untouched.
- The sibling cast andon classifier/logging work remains owned by `T-074-01-03`.

## Honest boundary and open concerns

- The new check is deliberately a shallow reachability/config/auth gate, not a live metered
  completion. It cannot prove quota, model quality, or that a future dispense will finish.
- A real denied-Keychain sandbox remains the story's explicitly deferred field verification. This
  ticket proves the behavior with injected facts and the boundary implementation's existing tests.
- The OpenAI-compatible probe inherits the boundary's documented `/models` assumption. A server
  offering chat completions but not model discovery may report non-dispensable.
- Probe timeout policy remains unchanged and out of scope. If field evidence reveals a hanging
  endpoint/auth command, a separately specified timeout may be warranted.
- No critical issue requires human attention for this ticket.

## Commit and working-tree handoff

`git show --name-only fcf81c1e...` lists exactly:

```text
src/doctor/doctor-probe.test.ts
src/doctor/doctor-probe.ts
src/doctor/preflight.test.ts
```

All three ticket-owned paths are clean after the Lisa commit. Remaining working-tree entries are
Lisa-owned provenance, ticket transition, and work-artifact publication state, including another
concurrent ticket's files. They were neither staged nor included by this ticket.

Review is complete. Stop on `T-074-01-02`; Lisa owns phase/status transition, admitted artifact
publication, completion commit, and seat release.
