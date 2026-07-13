# Research — T-074-01-01

## Ticket and story contract

- The ticket adds a dispensability probe to the executor boundary.
- The parent story distinguishes dispensability from binary presence.
- This ticket owns the boundary and its two built-in implementations only.
- Doctor rendering and cast-time refusal are dependent tickets and remain untouched.
- The probe must be near-zero-cost and must not dispense or spend tokens.
- Results are structured data with `ok`, optional `reason`, and optional `hint`.
- Claude's negative fixture must represent an unreadable config store/Keychain.
- OpenAI compatibility must check endpoint and authentication reachability.
- Existing Claude dispense behavior is an explicit regression oracle.
- Source commits must use `lisa commit-ticket` with exact include paths.
- Phase artifacts belong in this private attempt directory, not `docs/active/work`.

## Executor seam

- `src/executor/executor.ts` owns the `Executor` interface.
- The interface currently has `readonly id` and `dispense(opts)` only.
- It type-imports transport shapes from `claude.ts` and has no runtime import back to Claude.
- `ExecutorTimeoutError` is the shared runtime error base in the seam module.
- `DispenseOptions`, `ResultMessage`, and `StreamMessage` are re-exported types.
- The seam is intentionally executor-neutral and is the correct home for the result type.
- A required `probe()` method will affect every structural test double typed as `Executor`.

## Claude executor

- `src/executor/claude.ts` is mostly pure helpers around one impure `dispense` function.
- `dispense` spawns `claude -p`, streams JSON, and returns a metered result.
- `ClaudeExecutor` is currently a stateless delegate to that free function.
- `CLAUDE_CLI` supports an environment override and defaults to `claude`.
- The installed CLI exposes `claude auth status --json`.
- That command reports login/auth-provider facts without invoking `claude -p`.
- The installed CLI help explicitly separates Keychain reads from bare mode.
- Therefore auth status is the local CLI boundary that exercises config-store readability.
- A denied Keychain/config store can be represented as a failed fact read.
- A readable store with `loggedIn: false` is a distinct non-dispensable state.
- Existing Claude tests never launch a live Claude dispense.
- The test style favors pure helpers and fake/injected world facts.

## OpenAI-compatible executor

- `src/executor/openai-compat.ts` implements streaming `/chat/completions` via `fetch`.
- Its base URL defaults to `http://localhost:11434/v1`.
- Optional bearer auth comes from `VEND_OPENAI_API_KEY`.
- Request construction is already pure and environment-injectable.
- `OpenAICompatExecutor` delegates `dispense` to the existing free function.
- An authenticated `GET {base}/models` checks endpoint and auth without completion tokens.
- `/models` is the OpenAI-compatible discovery endpoint and needs no prompt/body.
- A non-2xx response can preserve its HTTP status as the named failure reason.
- Network exceptions must become returned probe data, not escape as raw errors.
- The existing openai tests prohibit live fetches and use fabricated inputs.

## Pure-core / impure-shell conventions

- `src/doctor/doctor-probe.ts` is the closest repository pattern.
- It defines an injectable dependency interface with real defaults.
- Tests pass fabricated facts to cover positive and negative branches.
- Expected environmental failures are returned data, not exceptions.
- `doctor-core.ts` demonstrates required actionable hints on failure.
- Executor probe classification should likewise be pure over plain fact objects.
- Process/network access belongs in narrow reader functions.
- Executor classes can accept fact-reader dependencies with production defaults.

## Selection and consumers

- `src/executor/select.ts` lazily constructs fresh built-in executors.
- The built-ins are `claude` and `openai-compat`.
- No selection logic needs to change when constructors retain zero-argument defaults.
- `src/engine/cast.ts` currently invokes only `dispense`; it is out of this ticket.
- `src/doctor/doctor-probe.ts` currently checks PATH and config presence only.
- The dependent doctor ticket will consume `probe()` later.

## Compatibility surface

- Required interface expansion makes existing `Executor` test doubles incomplete.
- Structural doubles appear in executor selection, cast, cross-review, kitchen, and play tests.
- Those doubles are fixtures, not production implementations.
- They need a deterministic successful probe to preserve their existing test purpose.
- Adding that fixture method must not make current cast paths invoke it.
- Existing `claude.test.ts` is the dispense-regression gate named by acceptance.

## Verification constraints

- Focused tests should cover both built-in probe classifiers and class delegation.
- No focused test may invoke real Claude auth, Keychain, endpoint, or fetch.
- Typecheck will enumerate every structural double requiring the new method.
- `bun run check` is the repository gate and includes BAML generation, typecheck, and all tests.
- The final commit must include only ticket-owned source/test paths.
- Lisa-owned ticket/provenance modifications already exist and must remain untouched.

## Assumptions and honest boundary

- `claude auth status --json` is treated as the CLI's supported auth/config readability check.
- A successful parse with `loggedIn: true` means Claude is dispensable at this shallow layer.
- The probe does not prove a live model request or available subscription capacity.
- `GET /models` proves basic endpoint/auth reachability, not agentic parity or model fitness.
- HTTP success is sufficient for this ticket; response-schema validation is unnecessary.
- The field-reported denied-Keychain environment remains a deferred live verification.
- No credential values should appear in probe reasons, hints, tests, or logs.
