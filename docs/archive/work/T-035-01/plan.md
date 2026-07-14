# T-035-01 — Plan: ordered, independently verifiable steps

Each step typechecks on its own (dependencies built first) and is committable atomically.
Verification gate for the whole ticket: `bun run check` (baml:gen + typecheck + test) green,
with `claude.test.ts` byte-green throughout.

## Step 1 — `src/executor/executor.ts` (the contract)

Create the module: `ExecutorTimeoutError` (base), `Executor` interface, and the type-only
re-export of `DispenseOptions`/`ResultMessage`/`StreamMessage` from `claude.ts`.

- Verify: `tsc --noEmit` clean (the type-only import cycle is erased; no runtime edge yet
  back into `executor.ts`).
- Commit: `feat(executor): Executor interface + ExecutorTimeoutError base (T-035-01)`.

## Step 2 — `src/executor/claude.ts` (subclass + ClaudeExecutor)

- Import `ExecutorTimeoutError` (value) and `Executor` (type) from `./executor.ts`.
- Reparent `ClaudeTimeoutError extends ExecutorTimeoutError`: drop the local `timeoutMs`
  field (inherited), keep `override readonly code = "ETIMEDOUT_CLAUDE"`, ctor `super(timeoutMs,
  <same message>)` then `this.name`.
- Append `ClaudeExecutor implements Executor`.
- Verify: `bun test src/executor/claude.test.ts` — **byte-green** (the assertions on `name`,
  `code`, `timeoutMs`, message, and `instanceof ClaudeTimeoutError` all still hold). `tsc`
  clean. Confirm no runtime cycle (claude→executor only).
- **Testing strategy**: rely on the existing `claude.test.ts` as the no-behavior-change
  oracle for `ClaudeTimeoutError`. `ClaudeExecutor` is a one-line delegate proven by the
  cast integration test (Step 5) — no separate unit test needed (mirrors `dispense` being
  the untested impure verb whose logic lives in tested helpers).

## Step 3 — `src/executor/select.ts` (the selector)

- `ExecutorFactory`, `DEFAULT_EXECUTOR_ID`, `builtinExecutors` (`claude` only),
  `executorFor(opts, env, registry)` with the unknown-id throw.
- Verify: `tsc` clean (`noUncheckedIndexedAccess` ⇒ the `if (!make)` guard is required).
- Commit (with Step 2): `feat(executor): ClaudeExecutor + executorFor selector (T-035-01)`.

## Step 4 — `src/engine/cast.ts` (route through the selector)

- Swap imports (drop `dispense`/`ClaudeTimeoutError`, add `ExecutorTimeoutError`,
  `executorFor`, `type Executor`).
- Add `CastOptions.executor?` / `CastOptions.executorId?`.
- Resolve `const executor = opts.executor ?? executorFor(...)`; call `executor.dispense(...)`;
  flip the `instanceof` to `ExecutorTimeoutError`.
- Verify: `tsc` clean; **full suite green** — every existing cast path unchanged because no
  opts ⇒ Claude ⇒ same argv. Spot-check that `src/probe/run-equivalence-judge.ts` still
  compiles (it imports the still-exported free `dispense`).
- Commit: `refactor(engine): castPlay routes through executorFor, default Claude (T-035-01)`.

## Step 5 — Tests

### 5a `src/executor/select.test.ts` (pure)
- `executorFor()` → Claude; `.id === "claude"`.
- env path: `executorFor({}, { VEND_EXECUTOR: "claude" })` → Claude.
- injected alternate: `executorFor({ executor: "stub" }, {}, { stub: () => stubInstance })`
  returns the stub (selection-when-requested, no OpenAI needed).
- precedence: opt > env > default.
- unknown id throws, message lists known ids.
- `ExecutorTimeoutError` base fields; `ClaudeTimeoutError` is `instanceof` **both** the base
  and itself; `code`/`timeoutMs`/`name` correct.

### 5b `src/engine/cast.test.ts` (integration — the headline AC)
- Build a minimal `Play` and a `stubExecutor` (fires `onMessage` with sample stream
  messages, returns a success `ResultMessage` carrying `usage` + `model`).
- Cast in an OS temp dir (`mkdtemp`), injecting `opts.executor = stubExecutor`,
  `transcriptDir`/`runLogPath` pointed at the temp dir.
- Assert: `onMessage` fired (stub records it AND the transcript file exists), `outcome ===
  "success"`, `materialized === true`, `actuals.usage` reflects the stub's usage, and
  `runs.jsonl` holds exactly one record stamped with the stub's model id.
- Second case: a `timeoutExecutor` whose `dispense` throws `new ExecutorTimeoutError(ms,
  "stub timed out")` ⇒ `outcome === "timed-out"`, `materialized === false`, one log record.
- Cleanup temp dirs in `finally`/`afterEach`.

- Verify: `bun test src/executor/select.test.ts src/engine/cast.test.ts` green.
- Commit: `test(executor,engine): executorFor selection + stub-executor cast pipeline (T-035-01)`.

## Step 6 — Full gate + review

- `bun run check` (baml:gen + typecheck + full suite) green; `bun run check:head` if
  committing (per-commit green gate, E-033).
- Confirm AC checklist (below), then write `review.md`.

## Acceptance-criteria → step map

- AC1 (`Executor` interface + `ExecutorTimeoutError` generalized, `instanceof` holds, agentic
  options documented as hints) → Steps 1, 2; asserted in 5a.
- AC2 (`ClaudeExecutor` no behavior change; `castPlay` calls `executorFor(...).dispense(...)`,
  default Claude, byte-identical) → Steps 2, 4; oracle = green `claude.test.ts` + full suite.
- AC3 (unit: `executorFor` default + alternate; stub executor cast end-to-end; `check:*`
  green) → Step 5a + 5b + Step 6.

## Risks & mitigations

- **Class-field init order** (subclass `code` must win): ESNext target ⇒
  `useDefineForClassFields` on ⇒ subclass initializer runs post-`super()`. Verified by the
  existing `claude.test.ts` `code` assertion staying green.
- **Hidden cycle** if the selector lands in `executor.ts`: avoided by the dedicated
  `select.ts`. Re-grep import edges after Step 4.
- **A second, un-rerouted `dispense` caller** (probe judge): intentionally left on the free
  function; confirmed it still compiles in Step 4.
