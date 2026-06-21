// The `vend doctor` preflight's PROBE EFFECT (T-042-02, story S-042-01, epic E-042
// vend-doctor-preflight) — the thin IMPURE shell that gathers the real-world facts the pure
// core (doctor-core.ts, T-042-01) renders into a verdict.
//
// THE CENTRAL RULE (mirrors src/init/init-effect.ts ↔ init-core.ts): the report/exit-code
// *logic* lives in doctor-core.ts — addon-free, committed, unit-tested. THIS module is the
// world-touching verb: it runs the ~3 vend-specific dependency checks — lisa & claude on PATH,
// the BAML native addon loadable, the active executor's config present — and emits one `Check`
// each. It decides NOTHING about exit codes (that is `renderDoctorReport`) and it does NOT
// print or `process.exit` (that is the CLI dispatch arm, T-042-03). It only produces the
// `Check[]` the renderer consumes.
//
// IMPURE but NARROW: the only world it touches is (1) `envinfo.helpers.which` to resolve a
// binary on PATH, (2) a dynamic `@boundaryml/baml` import to test the native addon loads, and
// (3) `process.env` (injected) for the executor-config presence check. No `node:fs`, no
// `Bun.spawn`, no clock, no `cli.ts`.
//
// NEVER THROWS (the headline AC): "a dependency check failed" is the EXPECTED outcome of a
// preflight — modelled as a red `Check`, never an exception (the house "returned data, never
// thrown" rule). Two layers enforce it: each backend default is `try/catch → false`, and every
// check runs through {@link safeCheck}, which degrades ANY thrown error (a backend quirk, a
// check-body bug) to `failed(name, <message>)`. So `probeDoctor` RESOLVES — it never rejects.
//
// NAME THE FAILURE (E-008): every red `Check` is minted via `failed`, which REQUIRES a fix-it
// hint — so the human/agent reading the preflight sees the broken dep and the exact fix.
//
// TESTABLE TODAY (the planInit/executorFor discipline): the world-facts are INJECTED via
// {@link DoctorProbeDeps}, defaulting to the real backends. A test passes fabricated facts to
// exercise every AC branch ("lisa off PATH", "addon unloadable", "endpoint var unset")
// deterministically, with no dependence on the host's actual PATH or addon.

import envinfo from "envinfo";
import { failed, passed, type Check } from "./doctor-core.ts";
import { DEFAULT_EXECUTOR_ID, EXECUTOR_ENV, resolveExecutorId } from "../executor/select.ts";
import {
  DEFAULT_OPENAI_BASE_URL,
  OPENAI_BASE_URL_ENV,
  OPENAI_EXECUTOR_ID,
} from "../executor/openai-compat.ts";

// ── Check names + fix-it hints (single source of truth, asserted by the tests) ───────────────

/** The lisa-on-PATH check name and its fix-it hint. */
export const LISA_CHECK = "lisa on PATH";
export const LISA_HINT = "install lisa and ensure `lisa` is on your PATH";

/** The claude-on-PATH check name and its fix-it hint. */
export const CLAUDE_CHECK = "claude on PATH";
export const CLAUDE_HINT = "install Claude Code and ensure `claude` is on your PATH";

/** The BAML-native-addon check name and its fix-it hint. */
export const BAML_CHECK = "BAML native addon loadable";
export const BAML_HINT = "reinstall dependencies to rebuild the native addon: `bun install`";

/** The executor-config check's BASE name; the report name is suffixed with the resolved id
 *  (e.g. `active executor config: openai-compat`) so the line names which executor was probed. */
export const EXECUTOR_CHECK = "active executor config";

// ── Injectable world-fact backends ───────────────────────────────────────────────────────────

/**
 * The world-facts the probe reads, injected so every check is unit-testable with fabricated
 * inputs (the `planInit(existing, manifest)` / `executorFor(opts, env, registry)` discipline).
 * Defaults are {@link DEFAULT_PROBE_DEPS} — the real envinfo / addon / `process.env` backends.
 */
export interface DoctorProbeDeps {
  /** Is `binary` resolvable on PATH? Default: {@link whichOnPath} (envinfo-backed). */
  readonly onPath: (binary: string) => Promise<boolean>;
  /** Does the BAML native addon load? Default: {@link bamlAddonLoadable}. */
  readonly bamlLoadable: () => Promise<boolean>;
  /** Environment for the executor-config presence check. Default: `process.env`. */
  readonly env: Record<string, string | undefined>;
}

/**
 * Default on-PATH predicate, envinfo-backed (the ticket's "envinfo-backed probe" mandate).
 * `envinfo.helpers.which` resolves to the absolute path when present, `undefined` when absent;
 * `Boolean(...)` collapses that to the predicate. Wrapped `try/catch → false` so even an
 * unexpected backend throw reads as "not found" rather than raising — the probe never throws.
 */
async function whichOnPath(binary: string): Promise<boolean> {
  try {
    return Boolean(await envinfo.helpers.which(binary));
  } catch {
    return false;
  }
}

/**
 * Default BAML-addon loadability probe. Dynamically imports the public `@boundaryml/baml` entry
 * (the canonical specifier the app already uses, `baml_client/globals.ts`) and confirms a
 * native-backed symbol (`BamlRuntime`, a class the `.node` binding provides) is present. If the
 * platform binding cannot load, the NAPI-RS loader throws during import → caught → `false`.
 */
async function bamlAddonLoadable(): Promise<boolean> {
  try {
    const mod = (await import("@boundaryml/baml")) as { BamlRuntime?: unknown };
    return typeof mod.BamlRuntime === "function";
  } catch {
    return false;
  }
}

/** The real backends: envinfo `which`, the addon import, and `process.env`. */
export const DEFAULT_PROBE_DEPS: DoctorProbeDeps = {
  onPath: whichOnPath,
  bamlLoadable: bamlAddonLoadable,
  env: process.env,
};

// ── The four check verbs (each returns a Check; total over its injected fact) ─────────────────

/** lisa-on-PATH → green when resolvable, else red with {@link LISA_HINT}. */
export async function lisaCheck(onPath: DoctorProbeDeps["onPath"]): Promise<Check> {
  return (await onPath("lisa")) ? passed(LISA_CHECK) : failed(LISA_CHECK, LISA_HINT);
}

/** claude-on-PATH → green when resolvable, else red with {@link CLAUDE_HINT}. */
export async function claudeCheck(onPath: DoctorProbeDeps["onPath"]): Promise<Check> {
  return (await onPath("claude")) ? passed(CLAUDE_CHECK) : failed(CLAUDE_CHECK, CLAUDE_HINT);
}

/** BAML native addon → green when the addon loads, else red with {@link BAML_HINT}. */
export async function bamlCheck(bamlLoadable: DoctorProbeDeps["bamlLoadable"]): Promise<Check> {
  return (await bamlLoadable()) ? passed(BAML_CHECK) : failed(BAML_CHECK, BAML_HINT);
}

/**
 * Active-executor config presence — a BASIC presence check (the AC scope-guard: NOT a full
 * open-model validation matrix). Resolves the selected executor id through the executor seam
 * ({@link resolveExecutorId}, so there is no parallel switch), then:
 *  - `claude` (the default) needs no config → green;
 *  - `openai-compat` needs its endpoint var → green iff {@link OPENAI_BASE_URL_ENV} is SET,
 *    else red with the fix-it (the preflight wants the endpoint EXPLICITLY configured, even
 *    though the runtime would silently fall back to local Ollama);
 *  - any other id → red (an unknown executor is a wiring error, named with the valid options).
 * PURE given `env` — no `await`, no IO of its own.
 */
export function executorConfigCheck(env: DoctorProbeDeps["env"]): Check {
  const id = resolveExecutorId({}, env);
  const name = `${EXECUTOR_CHECK}: ${id}`;

  if (id === DEFAULT_EXECUTOR_ID) return passed(name);

  if (id === OPENAI_EXECUTOR_ID) {
    if (env[OPENAI_BASE_URL_ENV]) return passed(name);
    return failed(
      name,
      `set ${OPENAI_BASE_URL_ENV} to your OpenAI-compatible endpoint (e.g. ${DEFAULT_OPENAI_BASE_URL})`,
    );
  }

  return failed(
    name,
    `unknown ${EXECUTOR_ENV} "${id}" — set it to "${DEFAULT_EXECUTOR_ID}" or "${OPENAI_EXECUTOR_ID}"`,
  );
}

// ── never-throw wrapper ──────────────────────────────────────────────────────────────────────

/** The message of any thrown value, total (an `Error` → its message; anything else → `String`). */
function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Run a check, degrading ANY thrown error to `failed(name, <message>)`. The central guarantee
 * that {@link probeDoctor} returns a result rather than raising — even a backend quirk or a
 * check-body bug becomes a red `Check`, never a propagated crash.
 */
async function safeCheck(name: string, run: () => Promise<Check> | Check): Promise<Check> {
  try {
    return await run();
  } catch (e) {
    return failed(name, messageOf(e));
  }
}

// ── probeDoctor — the one public entry ─────────────────────────────────────────────────────────

/**
 * Run the vend doctor preflight checks against the injected (or real) world and return the
 * ordered {@link Check}[] for the core's `renderDoctorReport` to verdict. The checks run
 * concurrently (independent IO) but the result preserves a FIXED order — lisa, claude, BAML,
 * executor-config — because `Promise.all` preserves input order. NEVER REJECTS: every check is
 * wrapped by {@link safeCheck}. `deps` overrides individual backends ({@link DEFAULT_PROBE_DEPS}
 * supplies the rest), which is how the tests inject fabricated facts.
 */
export async function probeDoctor(deps: Partial<DoctorProbeDeps> = {}): Promise<Check[]> {
  const d: DoctorProbeDeps = { ...DEFAULT_PROBE_DEPS, ...deps };
  return Promise.all([
    safeCheck(LISA_CHECK, () => lisaCheck(d.onPath)),
    safeCheck(CLAUDE_CHECK, () => claudeCheck(d.onPath)),
    safeCheck(BAML_CHECK, () => bamlCheck(d.bamlLoadable)),
    safeCheck(EXECUTOR_CHECK, () => executorConfigCheck(d.env)),
  ]);
}
