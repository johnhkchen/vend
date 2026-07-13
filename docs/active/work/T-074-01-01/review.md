# Review — T-074-01-01

## Outcome

PASS. The executor boundary now exposes a required shallow dispensability probe, both built-in
executors implement it without a model dispense, injected-fact unit tests cover success and failure,
the existing Claude suite remains green, and the complete repository gate passes.

Source commit:

```text
5f49a6086134a780b9c5b3bcd95af50137068765
feat(executor): add dispensability probe (T-074-01-01)
```

The commit was created only through `lisa commit-ticket`, with 13 exact include paths.

## What changed

### Shared executor contract

`src/executor/executor.ts` now exports:

```ts
interface ExecutorProbeResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly hint?: string;
}
```

`Executor` now requires `probe(): Promise<ExecutorProbeResult>`. The contract documents that probe
is shallow and unmetered: it answers whether configuration/auth/endpoint state is usable from this
environment, not whether a live metered model turn will succeed.

### Claude

`src/executor/claude.ts` adds:

- an injectable `ClaudeProbeFactsReader`;
- pure `classifyClaudeProbe` logic;
- `readClaudeProbeFacts`, invoking `claude auth status --json`;
- `ClaudeExecutor.probe()`;
- an actionable hint naming both `claude login` and sandbox Keychain access.

The effect reads only the `loggedIn` boolean from auth-status JSON. Account identity fields are not
returned or surfaced. Valid `loggedIn: false` output means the store was readable but login is
absent; missing/invalid output or command failure names the config store/Keychain as unreadable.

The command performs no `claude -p`, no prompt, no result stream, no usage, and no token spend.

### OpenAI-compatible

`src/executor/openai-compat.ts` adds:

- injectable reachability facts and reader;
- pure construction of authenticated `GET {base}/models`;
- pure fact classification for success, HTTP rejection, and connection failure;
- `OpenAICompatExecutor.probe()`;
- an actionable base-URL/bearer-auth hint.

The probe sends no chat-completion request and no prompt. It does not read or expose response-body
content. A 2xx `/models` response proves the configured endpoint/auth are shallowly reachable; an
HTTP status or network error becomes returned failure data.

### Structural fixtures

Because `probe()` is required, existing fake executors in eight test files now implement a
deterministic `{ ok: true }` probe. These are type-compatibility fixture updates only. Existing
production cast code does not call probe in this ticket, and each fixture's dispense output remains
unchanged.

## Acceptance assessment

### New `Executor.probe()` with structured result

PASS. The required method and exported executor-neutral result live in the shared boundary module.

### Claude verifies config-store/Keychain readability with no token spend

PASS. Production uses the CLI's auth-status command rather than a prompt or direct private-store
inspection. Denial is represented as a named structured failure with the required fix-it hint.

### OpenAI-compatible endpoint/auth reachability

PASS. Production performs authenticated `/models` discovery against the same configured base URL
and optional bearer key used by the adapter.

### Injected success and config-store-denied tests

PASS. Claude tests inject readable/logged-in, denied, and readable/logged-out facts. OpenAI tests
inject reachable, HTTP 401, and connection-refused facts. Class-level tests prove injection without
real subprocess/network effects.

### Dispense behavior unchanged

PASS. Neither free dispense implementation was edited. The class methods remain direct delegates.
The named `claude.test.ts` regression oracle and all affected cast/cross-review/play tests pass.

## Test evidence

Baseline before implementation:

```text
75 pass, 0 fail, 152 assertions
```

Test-first red:

```text
2 expected missing-export module failures
```

Focused implementation suites:

```text
68 pass, 0 fail, 141 assertions
```

Affected 10-file regression set:

```text
119 pass, 0 fail, 401 assertions
```

Required full gate (`bun run check`):

```text
BAML generation: pass
TypeScript: pass
1709 pass
1 skip
0 fail
5273 assertions
```

The single skip is the existing release acceptance integration that requires built `dist/`
artifacts; it is unrelated to this ticket.

## Scope and compatibility

- Doctor production remains unchanged for dependent ticket T-074-01-02.
- Cast/cast-core production remains unchanged for dependent ticket T-074-01-03.
- Budgets, funding, shelf, and TIER_BUDGET are unchanged.
- Selector IDs, precedence, and zero-argument construction remain unchanged.
- No dependency, secret, environment variable, or persisted format was added.
- The executor runtime dependency graph remains acyclic.

## Honest boundary and open concerns

- This is deliberately not a live metered dispense. It cannot prove current quota, model fitness,
  or completion success.
- Claude's denied-Keychain branch is fixture-proven. A real denied-Keychain sandbox remains the
  story's explicitly deferred 2026-07-13 field verification.
- `/models` is the basic OpenAI-compatible discovery/auth check. A nonconforming server that offers
  chat completions but omits `/models` will report non-dispensable at this shallow boundary; that is
  an honest compatibility limitation rather than fabricated success.
- The probe readers do not introduce a separate configurable timeout. Network/process timeout
  policy can be added at the consumer or boundary if field evidence shows the cheap probes can hang;
  no such policy was specified by this ticket.

## Working-tree handoff

`git show --name-only HEAD` confirms the commit contains exactly the 13 intended source/test paths.
Those paths are clean. Remaining modified/untracked entries belong to Lisa's provenance, ticket
transition, and work-artifact publication state; they were not included or altered through ordinary
Git staging. No critical issue requires human intervention.
