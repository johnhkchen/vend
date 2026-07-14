# T-035-01 — Progress

Status: **implementation complete, all gates green.** Followed `plan.md`; no deviations of
substance (one minor type-annotation fix, noted below).

## Completed

- **Step 1 — `src/executor/executor.ts` (new).** `ExecutorTimeoutError` base class,
  `Executor` interface (`id` + `dispense`), type-only re-export of
  `DispenseOptions`/`ResultMessage`/`StreamMessage`. Seam-free; no runtime imports. ✓ `tsc`.
- **Step 2 — `src/executor/claude.ts` (modified).** `ClaudeTimeoutError` reparented to
  `extends ExecutorTimeoutError` (identity byte-preserved: `code="ETIMEDOUT_CLAUDE"` via
  `override`, `name`, message, `(timeoutMs, cli)` ctor unchanged; inherited `timeoutMs`
  field dropped). Appended `ClaudeExecutor implements Executor` — a one-line delegate over
  the still-exported free `dispense`. ✓ `claude.test.ts` **byte-green (38 pass)**.
- **Step 3 — `src/executor/select.ts` (new).** `executorFor(opts, env, registry)` with
  precedence opt → `VEND_EXECUTOR` → default `"claude"`; injectable `ExecutorRegistry`;
  `builtinExecutors = { claude }`; loud throw on unknown id. ✓ `tsc`.
- **Step 4 — `src/engine/cast.ts` (modified).** Imports swapped (free `dispense` +
  `ClaudeTimeoutError` → `ExecutorTimeoutError` + `executorFor` + `type Executor`); added
  `CastOptions.executor?` (instance, precedence) + `CastOptions.executorId?` (name);
  resolve `const executor = opts.executor ?? executorFor(...)`; call `executor.dispense(...)`
  (same args); timeout `instanceof` → `ExecutorTimeoutError`. ✓ full suite.
- **Step 5a — `src/executor/select.test.ts` (new).** Default→Claude, env path, injected
  alternate, precedence (opt>env>default), unknown-id throw, empty-registry throw,
  `builtinExecutors`, and the `ExecutorTimeoutError`/`ClaudeTimeoutError` `instanceof`
  generalization assertions. ✓
- **Step 5b — `src/engine/cast.test.ts` (new).** Stub executor injected through `castPlay`
  casts an echo play end-to-end: onMessage fires (sample system/assistant/result stream),
  `outcome==="success"`, `materialized===true`, `produced` + `actuals.usage` correct, exactly
  one run-log record stamped with the stub's model. Second case: an executor that throws
  `ExecutorTimeoutError` ⇒ `outcome==="timed-out"`, nothing materialized. ✓

## Verification

- `bun run check:typecheck` — clean.
- `bun test src/executor/claude.test.ts` — 38 pass (the no-behavior-change oracle, byte-green).
- `bun test src/executor/select.test.ts src/engine/cast.test.ts` — 14 pass.
- `bun run check` (baml:gen + typecheck + full suite) — **963 pass / 0 fail** (was 949;
  +14 new). No existing test changed.

## Deviation from plan

- `select.ts` `env` param: planned `{ VEND_EXECUTOR?: string }`, but a computed-key type
  literal didn't unify with Node's `ProcessEnv` (TS2559). Switched to
  `Record<string, string | undefined>` indexed by the `EXECUTOR_ENV` const — same behavior,
  cleaner assignability. No other deviations.

## Back-compat confirmation

- No env, no opt ⇒ `executorFor()` ⇒ `ClaudeExecutor` ⇒ free `dispense` with the identical
  args object ⇒ existing casts byte-identical. The `parse→gate→effect→log` pipeline untouched.
- The other `dispense` caller (`src/probe/run-equivalence-judge.ts`) left on the free
  function as designed — compiles + suite green.
