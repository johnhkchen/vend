# T-035-01 — Structure: file-level blueprint

The shape of the code, not the code. Five touched files (2 new, 3 modified) + 2 test files.

## New: `src/executor/executor.ts` — the seam-free contract

The abstract executor module. Value-depends on nothing (its transport-type imports from
`claude.ts` are type-only, erased), so nothing can cycle through it.

- `export class ExecutorTimeoutError extends Error`
  - `readonly code: string = "ETIMEDOUT_EXECUTOR"` (overridable by subclasses)
  - `readonly timeoutMs: number`
  - `constructor(timeoutMs: number, message: string)` — sets `name`, `timeoutMs`.
- `export interface Executor`
  - `readonly id: string`
  - `dispense(opts: DispenseOptions): Promise<ResultMessage>`
  - Doc-comment: streams to `onMessage`, throws `ExecutorTimeoutError` on wall-clock timeout;
    agentic options are honor-when-able hints; universal core = prompt + timeoutMs +
    onMessage + model → metered ResultMessage.
- `export type { DispenseOptions, ResultMessage, StreamMessage } from "./claude.ts"`
  — re-export so adapters/consumers import transport types from the seam module, not the
  Claude impl. (Type-only re-export ⇒ no runtime edge.)

## New: `src/executor/select.ts` — the selector

Sits on top of `executor.ts` (type) + `claude.ts` (value `ClaudeExecutor`). Separate file so
it can construct `ClaudeExecutor` without `executor.ts` cycling.

- `export type ExecutorFactory = () => Executor`
- `export const DEFAULT_EXECUTOR_ID = "claude"`
- `export const builtinExecutors: Record<string, ExecutorFactory>` = `{ claude: () => new ClaudeExecutor() }`
- `export function executorFor(opts?, env?, registry?): Executor`
  - id = `opts.executor ?? env.VEND_EXECUTOR ?? DEFAULT_EXECUTOR_ID`
  - throws on unknown id (guarded — `noUncheckedIndexedAccess`)

## Modified: `src/executor/claude.ts`

Minimal, surgical. Behavior of `dispense`/`buildArgs`/the pure helpers unchanged.

1. **Add** `import { ExecutorTimeoutError } from "./executor.ts";` and
   `import type { Executor } from "./executor.ts";`
2. **Change** `ClaudeTimeoutError` to `extends ExecutorTimeoutError`:
   - `override readonly code = "ETIMEDOUT_CLAUDE";`
   - ctor calls `super(timeoutMs, <same message string>)`, then `this.name = "ClaudeTimeoutError"`.
   - Drops the now-inherited `readonly timeoutMs` field declaration + its assignment (the base
     owns it). Message/code/name/arity all preserved ⇒ `claude.test.ts` byte-green.
3. **Add** at end of file:
   ```ts
   export class ClaudeExecutor implements Executor {
     readonly id = "claude";
     dispense(opts: DispenseOptions): Promise<ResultMessage> { return dispense(opts); }
   }
   ```
4. `dispense`, `buildArgs`, `DispenseOptions`, `ResultMessage`, `StreamMessage`, all pure
   helpers — **unchanged** (still exported; the probe judge keeps importing `dispense`).

## Modified: `src/engine/cast.ts`

Three-line semantic change inside `castPlay`; the pipeline below it is untouched.

1. **Imports** (`:24`): drop `dispense` + `ClaudeTimeoutError` from the `claude.ts` import,
   keep `type ResultMessage`. Add:
   ```ts
   import { ExecutorTimeoutError } from "../executor/executor.ts";
   import { executorFor } from "../executor/select.ts";
   import type { Executor } from "../executor/executor.ts";
   ```
2. **`CastOptions`** (`:35`): add two optional fields with doc-comments:
   - `readonly executor?: Executor;` — explicit instance (precedence; the injection seam).
   - `readonly executorId?: string;` — name resolved via `executorFor` (env/opt path).
3. **Resolve once** before the dispense try-block (~`:184`):
   ```ts
   const executor = opts.executor ?? executorFor(opts.executorId ? { executor: opts.executorId } : {});
   ```
4. **Call** (`:188`): `result = await executor.dispense({ ... })` (same args object).
5. **Timeout check** (`:197`): `if (e instanceof ExecutorTimeoutError) timedOut = true;`

No other lines change. `resolveLoggedModel`, `appendRunLog`, actuals — all as-is.

## New test: `src/executor/select.test.ts`

Pure unit tests, no spawn:
- `executorFor()` (no opts/env) → `ClaudeExecutor`, `.id === "claude"`.
- `executorFor({}, { VEND_EXECUTOR: "claude" })` → Claude.
- `executorFor({ executor: "stub" }, {}, { stub: () => stub })` → the injected stub
  (proves selection-when-requested without OpenAI).
- opt beats env beats default (precedence).
- unknown id throws with a message listing known ids.
- `ExecutorTimeoutError`: base fields; `new ClaudeTimeoutError(...) instanceof
  ExecutorTimeoutError` (the generalization assertion) and still `instanceof
  ClaudeTimeoutError`; `code`/`timeoutMs` correct on both.

## New test: `src/engine/cast.test.ts` — the executor-agnostic pipeline proof

The headline AC: a **stub executor** injected through `castPlay` casts a play end-to-end.
- A minimal `Play<{x:string}, {v:string}>`: `render` returns a prompt, `parse` echoes text,
  `gates` returns `{status:"clear"}`, `effect` writes nothing but returns `{ok:true}` (or
  records that it ran), `budget`/`card`/`summary` filled.
- A `stubExecutor: Executor` with `id="stub"` whose `dispense(opts)`:
  - fires `opts.onMessage` with a sample `system`/`assistant`/`result` `StreamMessage`,
  - returns a `ResultMessage` (`subtype:"success"`, `result:"..."`, `usage`, `model`).
- Cast via `castPlay(play, inputs, budget, { subject, projectRoot: tmp, transcriptDir: tmp,
  runLogPath: tmp/runs.jsonl, executor: stubExecutor })` in an OS temp dir.
- Assert: `onMessage` fired (stub saw it / transcript written), a `ResultMessage` flowed
  through (`outcome === "success"`, `materialized === true`, `produced`/`actuals` as expected),
  and `runs.jsonl` got exactly one record naming the stub's model. Proves parse/gate/effect/
  log are executor-agnostic.
- (Optional) a second stub that throws `ExecutorTimeoutError` ⇒ `outcome === "timed-out"`,
  nothing materialized — proves the generalized timeout path routes through the interface.

Temp dirs via `node:fs/promises` `mkdtemp(tmpdir())`, cleaned in a `finally`/`afterEach`.

## Ordering of changes (so each step typechecks)

1. `executor.ts` (no deps) → 2. `claude.ts` (depends on 1) → 3. `select.ts` (depends on 1,2)
→ 4. `cast.ts` (depends on 1,3) → 5. tests. Detailed sequence in `plan.md`.
