# T-035-01 — Review: executor-interface-and-selector

Handoff for a human reviewer. The seam `castPlay` leaned on implicitly is now a real
`Executor` interface; `ClaudeExecutor` sits behind it; casts route through an `executorFor`
selector that defaults to Claude. Back-compat is the contract and it holds.

## What changed

**New files**
- `src/executor/executor.ts` — the seam-free contract: `ExecutorTimeoutError` (base class),
  the `Executor` interface (`id` + `dispense`), and a type-only re-export of the transport
  shapes (`DispenseOptions`/`ResultMessage`/`StreamMessage`). Value-imports nothing, so it
  cannot cycle.
- `src/executor/select.ts` — `executorFor(opts, env, registry)`: precedence
  `opts.executor` → `VEND_EXECUTOR` → default `"claude"`; injectable `ExecutorRegistry`;
  `builtinExecutors = { claude }`; loud `Error` on an unknown id.
- `src/executor/select.test.ts` — pure tests for selection + the timeout-error generalization.
- `src/engine/cast.test.ts` — the integration proof: a stub executor cast through `castPlay`
  end-to-end (success path) + an `ExecutorTimeoutError` path (timed-out).

**Modified files**
- `src/executor/claude.ts` — `ClaudeTimeoutError` now `extends ExecutorTimeoutError`
  (identity byte-preserved); appended `ClaudeExecutor implements Executor`, a delegate over
  the still-exported free `dispense`. `dispense`/`buildArgs`/pure helpers unchanged.
- `src/engine/cast.ts` — imports swapped to the interface; `CastOptions.executor?` (instance)
  + `CastOptions.executorId?` (name) added; `castPlay` resolves the executor once and calls
  `executor.dispense(...)`; timeout `instanceof` keys on `ExecutorTimeoutError`. The
  `parse→gate→effect→log` pipeline below the call is untouched.

**Commits** (both behind the E-033 pre-commit green gate, `precommit: ok`):
- `fe2a15b` feat(executor): Executor interface + ClaudeExecutor + executorFor selector
- `1bce83a` refactor(engine): castPlay routes through executorFor, default Claude

## Acceptance criteria

- **AC1 — interface + generalized error.** ✓ `Executor` (`dispense → ResultMessage`, streams
  to `onMessage`, throws on timeout, carries `id`). `ExecutorTimeoutError` base with
  `ClaudeTimeoutError` as subclass — `new ClaudeTimeoutError(...) instanceof
  ExecutorTimeoutError` AND `instanceof ClaudeTimeoutError` both hold (asserted in
  `select.test.ts`). Agentic options documented as honor-when-able hints on the interface
  doc-comment.
- **AC2 — ClaudeExecutor no behavior change; default Claude byte-identical.** ✓
  `claude.test.ts` byte-green (38 pass, unchanged). `castPlay` calls
  `executorFor(...).dispense(...)`; no env/opt ⇒ Claude ⇒ same `dispense` args.
- **AC3 — unit tests + green gate.** ✓ `executorFor` default + injected-alternate +
  precedence + unknown-id; stub executor cast end-to-end (onMessage fires, ResultMessage
  returned, parse/gate/effect/log run, one run-log record). `bun run check` green.

## Test coverage

- `bun run check` — **963 pass / 0 fail** (was 949; +14 new). `tsc --noEmit` clean.
- The selector's selection logic and the error generalization are fully unit-covered. The
  executor-agnostic pipeline is covered by a real `castPlay` invocation (temp-dir fs, run-log
  read-back), which also exercises the new `opts.executor` injection seam.
- `ClaudeExecutor.dispense` is a one-line delegate to `dispense` (the historically untested
  impure verb); it is exercised by the cast integration test's wiring and is intentionally
  not separately unit-tested (no spawn in CI), consistent with the house pattern.

## Open concerns / limitations

- **`onMessage`-fired assertion is via the stub, not the transcript file.** The transcript
  append is fire-and-forget (`void appendFile`), so asserting its contents would race. The
  test instead proves the callback path by having the stub stream through the real
  `onMessage` castPlay handed it — equivalent proof, no flake. Noted for the reviewer.
- **No live Claude end-to-end here.** By design — the live proof remains the existing
  T-007-03 path; this slice proves the *seam* is correct, not the CLI.
- **`VEND_EXECUTOR` is read but only `claude` is registered.** Setting it to anything else
  throws (loud, intended). The `openai` factory lands in T-035-02; until then the only
  valid values are unset / `claude`.
- **Selection happens per cast** (`executorFor` constructs a fresh executor each call).
  Executors are stateless, so this is fine; if a future executor holds a connection pool,
  memoization belongs in the registry factory, not here.

## Follow-ups (out of scope, tracked elsewhere)

- T-035-02: `OpenAICompatExecutor` (SSE streaming, IA-8 usage mapping) + its
  `builtinExecutors.openai` factory and `VEND_OPENAI_BASE_URL`/`VEND_EXECUTOR_MODEL` wiring.
- Optional kaizen: thread `executorId` through the `vend run` CLI surface so an operator can
  pick an executor without env.
