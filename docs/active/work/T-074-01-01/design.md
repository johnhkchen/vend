# Design — T-074-01-01

## Decision summary

Add a required `Executor.probe(): Promise<ExecutorProbeResult>` method. Keep its shared result
shape in `executor.ts`. Each built-in executor obtains a small environment fact through an
injectable reader, then passes that fact through a pure classifier. Production readers use
`claude auth status --json` and authenticated `GET /models`; tests inject facts directly.

## Result contract

`ExecutorProbeResult` is plain returned data:

```ts
interface ExecutorProbeResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly hint?: string;
}
```

- Success is exactly `{ ok: true }`.
- Failure includes a human-readable named `reason`.
- Failure includes an actionable `hint` where the implementation knows the repair.
- Expected reachability/config failures do not throw.
- The shape is executor-neutral and usable by both future consumers.

## Claude options considered

### A. Inspect known credential files directly

Rejected. Claude auth may live in the OS Keychain, config formats are private, and direct file
inspection would confuse file presence with readability. It would couple Vend to storage details.

### B. Run a tiny prompt

Rejected. It spends tokens, violates the ticket's no-dispense boundary, and turns a preflight into
a metered operation.

### C. Run `claude auth status --json`

Chosen. It is a supported CLI command, performs no completion, and crosses the same auth/config
boundary that is denied in the target sandbox scenario. JSON supplies a stable `loggedIn` fact.

The effect reader returns `ClaudeProbeFacts` rather than a final result. The classifier handles:

- config readable and logged in -> success;
- config readable but logged out -> failure with `claude login`;
- config read/command failure -> config-store/Keychain failure with sandbox-access hint.

The `ClaudeExecutor` constructor accepts a fact reader with the real reader as default. Its
`dispense` method remains byte-for-byte unchanged.

## OpenAI-compatible options considered

### A. Check only environment variables

Rejected. This is the existing doctor config-presence behavior and cannot establish reachability.

### B. Send a minimal chat completion

Rejected. It can consume tokens and is semantically a dispense.

### C. Authenticated `GET /models`

Chosen. It is cheap, standard for OpenAI-compatible servers, exercises the endpoint and bearer
credential together, and does not generate content. The request shares base URL and auth env names
with dispense construction.

The effect reader returns `OpenAICompatProbeFacts`:

- a 2xx response becomes `{ reachable: true }`;
- a non-2xx response carries its status but never its response body/possible secret material;
- a network exception carries a sanitized error message;
- the pure classifier maps those facts into the shared result.

## Exception policy

Environmental unavailability is the expected subject of `probe`, so it is data. Both executor
methods catch an unexpectedly throwing injected/default reader and return a failure result. This
makes the boundary safe for doctor and cast callers: probing cannot replace a raw dispense stack
with a raw probe stack.

Programming errors inside pure classifiers remain structurally impossible because they are total
over small typed facts. No generic retry or timeout policy is added in this ticket.

## Injection strategy

Reader functions, rather than globals, are constructor dependencies:

```ts
type ClaudeProbeFactsReader = () => Promise<ClaudeProbeFacts>;
type OpenAICompatProbeFactsReader = () => Promise<OpenAICompatProbeFacts>;
```

Zero-argument constructors retain selection compatibility. Tests inject `async () => fact` and
assert both the pure result and the class boundary. Production readers remain separately callable
for future targeted testing, but no test uses real credentials/network.

## Interface compatibility

The method is required rather than optional. Optionality would force every consumer to branch on
method presence and would fail to establish dispensability as an executor capability. All typed
test doubles receive a successful no-op probe because their tests model already-available fake
executors. Production behavior remains limited to the two built-ins.

## Reasons and hints

Claude failure language explicitly names `config store/Keychain`, matching the story's andon. Its
hint includes both `claude login` and granting sandbox Keychain access. Logged-out state has the
login hint without falsely claiming a permission denial.

OpenAI failures name the configured endpoint and either HTTP status or connection failure. The
hint asks the caller to verify endpoint and bearer auth configuration. API key values are never
included.

## Scope controls

- Do not edit doctor probe/report files.
- Do not edit cast or cast-core.
- Do not alter executor selection precedence or identifiers.
- Do not alter `dispense`, request bodies, streaming, metering, or timeout behavior.
- Do not add dependencies or configuration variables.
- Do not perform the deferred live denied-Keychain verification.

## Acceptance mapping

- New required interface method: `executor.ts` plus typecheck.
- Structured result: shared exported `ExecutorProbeResult`.
- Claude config-store readability: auth-status reader and Claude facts classifier.
- OpenAI endpoint/auth reachability: `/models` reader and OpenAI facts classifier.
- OK and config-denied tests: injected Claude facts.
- Both built-ins tested: injected facts in the existing executor test files.
- Dispense unchanged: no edits inside either dispense implementation; full existing tests green.
