// The executor selector (T-035-01) — resolves which {@link Executor} a cast runs on,
// defaulting to Claude so that with no env/opt set every existing cast is byte-identical.
// Lives in its OWN module (not executor.ts) on purpose: it value-imports `ClaudeExecutor`
// from claude.ts, and claude.ts value-imports `ExecutorTimeoutError` from executor.ts — so
// putting the selector in executor.ts would form a runtime cycle (executor → claude →
// executor). Sitting on top of both keeps the dependency graph acyclic:
//   select.ts ─▶ claude.ts ─▶ executor.ts   (and select.ts ─▶ executor.ts for the type).
//
// The registry is a PARAMETER (injectable), which is what makes "selects an alternate when
// requested" unit-testable today — a test passes a registry containing a stub factory —
// before the second real executor exists. T-035-02 simply adds its `openai` factory to
// `builtinExecutors`.

import { ClaudeExecutor } from "./claude.ts";
import type { Executor } from "./executor.ts";
import { OpenAICompatExecutor } from "./openai-compat.ts";

/** A nullary factory for an {@link Executor}. Lazy so an unselected executor is never built. */
export type ExecutorFactory = () => Executor;

/** A name → factory map. The built-in one is {@link builtinExecutors}; tests inject their own. */
export type ExecutorRegistry = Record<string, ExecutorFactory>;

/** The default executor id — Claude. No env, no opt ⇒ this ⇒ byte-identical to today. */
export const DEFAULT_EXECUTOR_ID = "claude";

/** Environment variable naming the executor (overridden by an explicit opt). */
export const EXECUTOR_ENV = "VEND_EXECUTOR";

/**
 * The built-in registry. Claude is the default; T-035-02 adds the `openai-compat` adapter
 * (selected by `VEND_EXECUTOR=openai-compat`). A factory (not a singleton instance) so each
 * `executorFor` call yields a fresh executor — executors carry no shared mutable state, but
 * lazy construction also means an unselected adapter never spins up (no stray fetch/spawn).
 */
export const builtinExecutors: ExecutorRegistry = {
  claude: () => new ClaudeExecutor(),
  "openai-compat": () => new OpenAICompatExecutor(),
};

/** Selection inputs for {@link executorFor}. `executor` is an explicit id that wins over env. */
export interface ExecutorSelection {
  /** Explicit executor id — highest precedence. Omitted ⇒ fall through to env, then default. */
  readonly executor?: string;
}

/**
 * Resolve the {@link Executor} for a cast. Precedence: explicit `opts.executor` →
 * `env.VEND_EXECUTOR` → {@link DEFAULT_EXECUTOR_ID} ("claude"). Looks the resolved id up in
 * `registry` (defaults to {@link builtinExecutors}) and constructs it. Throws a typed-message
 * `Error` on an unknown id (the `noUncheckedIndexedAccess` lookup is `Factory | undefined`,
 * so the guard is mandatory) — an unknown executor is a loud wiring error, never a silent
 * fallback to Claude.
 */
export function executorFor(
  opts: ExecutorSelection = {},
  env: Record<string, string | undefined> = process.env,
  registry: ExecutorRegistry = builtinExecutors,
): Executor {
  const id = opts.executor ?? env[EXECUTOR_ENV] ?? DEFAULT_EXECUTOR_ID;
  const make = registry[id];
  if (!make) {
    throw new Error(`unknown executor "${id}" — known: ${Object.keys(registry).join(", ") || "(none)"}`);
  }
  return make();
}
