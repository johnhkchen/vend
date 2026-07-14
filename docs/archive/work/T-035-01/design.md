# T-035-01 — Design: the `Executor` interface, `ClaudeExecutor`, and `executorFor`

Three decisions, each grounded in the research. The north star: **no env ⇒ Claude ⇒ every
existing cast byte-identical**, the `parse→gate→effect→log` pipeline untouched.

## Decision 1 — where the interface and the generalized error live

**Chosen: a new module `src/executor/executor.ts`** that holds the `Executor` interface and
the `ExecutorTimeoutError` base class, re-exporting the transport types from `claude.ts`.
`claude.ts` imports `ExecutorTimeoutError` (value) from it and makes
`ClaudeTimeoutError extends ExecutorTimeoutError`. The selector goes in its **own** module
`src/executor/select.ts`.

Runtime dependency edges after the change:

```
select.ts ──(value: ClaudeExecutor)──▶ claude.ts ──(value: ExecutorTimeoutError)──▶ executor.ts
select.ts ──(type:  Executor)─────────▶ executor.ts
executor.ts ──(type only: DispenseOptions, ResultMessage)──▶ claude.ts   [erased]
```

No runtime cycle: `executor.ts` value-depends on nothing (its type imports from `claude.ts`
are erased under `verbatimModuleSyntax`); `claude.ts` value-depends only on `executor.ts`;
`select.ts` sits on top of both. This is the whole reason the selector is a **separate**
file — if `executor.ts` itself constructed `ClaudeExecutor`, `executor.ts → claude.ts →
executor.ts` would be a real runtime cycle.

**Rejected — define the interface inside `claude.ts`.** Tempting (fewer files), but it makes
"the abstract seam" and "the Claude implementation" the same module, so a future open-model
adapter (T-035-02) would import Claude's process-spawning module just to get the interface
type. Keeping the contract in its own seam-free module is the "first executor behind an
interface" promise from `vision.md`/`stack.md`.

**Rejected — put `executorFor` in `executor.ts`.** Creates the runtime cycle above. Split out.

## Decision 2 — generalizing `ClaudeTimeoutError` → `ExecutorTimeoutError`

**Chosen: a base class + a Claude subclass.**

```ts
// executor.ts
export class ExecutorTimeoutError extends Error {
  readonly code: string = "ETIMEDOUT_EXECUTOR";
  readonly timeoutMs: number;
  constructor(timeoutMs: number, message: string) {
    super(message);
    this.name = "ExecutorTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

// claude.ts (ClaudeTimeoutError now extends the base — message/code/ctor byte-preserved)
export class ClaudeTimeoutError extends ExecutorTimeoutError {
  override readonly code = "ETIMEDOUT_CLAUDE";
  constructor(timeoutMs: number, cli: string) {
    super(timeoutMs, `\`${cli} -p\` exceeded ${timeoutMs}ms wall-clock and was killed (non-returning subprocess)`);
    this.name = "ClaudeTimeoutError";
  }
}
```

Why this keeps `claude.test.ts` byte-green: `new ClaudeTimeoutError(1234,"claude")` still
yields `name==="ClaudeTimeoutError"`, `code==="ETIMEDOUT_CLAUDE"`, `timeoutMs===1234`, and a
message containing `1234ms` and `claude -p`. Under `useDefineForClassFields` (ESNext target)
the subclass `code` field initializer runs after `super()` and wins over the base's
`"ETIMEDOUT_EXECUTOR"`. `awaitChildClose` keeps throwing `ClaudeTimeoutError` unchanged.

Why it satisfies the generalization: a `ClaudeTimeoutError` **is a** `ExecutorTimeoutError`,
so the only runtime `instanceof` (`cast.ts:197`) flips to `instanceof ExecutorTimeoutError`
and still catches Claude timeouts — *and* any future executor's timeout. AC met.

**Rejected — rename `ClaudeTimeoutError` to `ExecutorTimeoutError` with a type alias
`export const ClaudeTimeoutError = ExecutorTimeoutError`.** A `class` value can't carry the
distinct `name`/`code` Claude needs, and `new ClaudeTimeoutError(timeoutMs, cli)` would have
the wrong constructor arity for the base. Subclassing preserves both the alias relationship
(`instanceof` up the chain) and Claude's identity.

## Decision 3 — the selector and how `castPlay` routes through it

**The `Executor` interface** — exactly the boundary `castPlay` uses, no more:

```ts
export interface Executor {
  /** Stable id for selection + the run-log. */
  readonly id: string;
  /** Dispense a prompt; stream to onMessage; throw ExecutorTimeoutError on wall-clock timeout. */
  dispense(opts: DispenseOptions): Promise<ResultMessage>;
}
```

The doc-comment states the contract the research surfaced: agentic options
(`maxTurns`/`mcpConfig`/`allowedTools`/`strictMcp`) are **hints honored when an executor
can** — Claude honors them; a non-agentic executor ignores them. The universal core is
`prompt` + `timeoutMs` + `onMessage` + `model` → a metered `ResultMessage`.

**`ClaudeExecutor`** (in `claude.ts`, next to `dispense`): `id="claude"`,
`dispense(opts){ return dispense(opts); }`. The free function stays exported (the probe judge
still imports it); the class is a one-line delegate ⇒ provably no behavior change.

**`executorFor`** (in `select.ts`) — an **injectable registry**, defaulting to Claude:

```ts
export type ExecutorFactory = () => Executor;
export const DEFAULT_EXECUTOR_ID = "claude";
export const builtinExecutors: Record<string, ExecutorFactory> = { claude: () => new ClaudeExecutor() };

export function executorFor(
  opts: { executor?: string } = {},
  env: { VEND_EXECUTOR?: string } = process.env,
  registry: Record<string, ExecutorFactory> = builtinExecutors,
): Executor {
  const id = opts.executor ?? env.VEND_EXECUTOR ?? DEFAULT_EXECUTOR_ID;
  const make = registry[id];
  if (!make) throw new Error(`unknown executor "${id}" — known: ${Object.keys(registry).join(", ")}`);
  return make();
}
```

This is the key design move: the registry is a **parameter**, so the "selects an alternate
when requested" AC is provable *now* — a test injects a registry with a stub factory under a
name and asserts `executorFor({executor:"stub"}, {}, reg)` returns it — without waiting for
T-035-02. T-035-02 simply adds `openai` to `builtinExecutors`. `noUncheckedIndexedAccess`
forces the `if (!make)` guard (registry lookup is `Factory | undefined`).

**`castPlay` routing.** Add two optional `CastOptions` fields and resolve once:

```ts
const executor = opts.executor ?? executorFor(opts.executorId ? { executor: opts.executorId } : {});
...
result = await executor.dispense({ prompt, model, maxTurns, ...tflags, onMessage, timeoutMs });
...
if (e instanceof ExecutorTimeoutError) timedOut = true;
```

- `CastOptions.executor?: Executor` — an explicit **instance** (highest precedence). This is
  the injection seam the end-to-end stub test uses, and what a pre-resolving caller/chain can
  use later.
- `CastOptions.executorId?: string` — a **name** resolved via `executorFor` (the env/opt
  path). Omitted ⇒ `executorFor()` ⇒ env `VEND_EXECUTOR` ⇒ Claude.
- No opts ⇒ `executorFor()` ⇒ `ClaudeExecutor` ⇒ `dispense(sameArgs)` ⇒ **byte-identical**.

**Rejected — make `castPlay` take a required `Executor` param.** Cleanest dependency-wise but
breaks every existing caller's signature (a wide, behavior-risky ripple the ticket forbids).
An optional, default-Claude resolution keeps all current call sites unchanged.

**Rejected — resolve the executor by reading env *inside* `castPlay` directly.** That buries
selection policy in the impure orchestrator and makes it untestable without env mutation.
A pure `executorFor` keeps the policy unit-testable and the orchestrator thin.

## What is explicitly NOT done here

No OpenAI executor (T-035-02). No change to `DispenseOptions`/`ResultMessage` shape (kept in
`claude.ts`; `executor.ts` re-exports them for ergonomics). No change to the
`parse→gate→effect→log` pipeline. No change to the probe judge's direct `dispense` use.
