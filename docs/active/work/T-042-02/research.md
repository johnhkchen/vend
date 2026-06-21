# T-042-02 — Research: doctor-probe-effect

_Ticket: T-042-02 · Story: S-042-01 (doctor-check-engine) · Epic: E-042 (vend-doctor-preflight)_

Descriptive map of the codebase reality this ticket lands in. What exists, where, how it
connects, and the boundaries that constrain the `envinfo`-backed probe effect. No solutions.

## What this ticket is (and is NOT)

The **impure probe effect** that gathers the real-world facts the T-042-01 pure core renders.
It runs the ~3 (really 4) vend-specific checks, each emitting a `Check` and **never throwing**:

1. **lisa on PATH** — the lisa binary is resolvable.
2. **claude on PATH** — the Claude Code binary is resolvable.
3. **BAML native addon loadable** — `@boundaryml/baml`'s platform `.node` binding loads.
4. **active executor config present** — default-Claude needs none; the open-model
   (`openai-compat`) path needs its endpoint var.

`envinfo` is added to `package.json` deps (the binary-resolution backend). The probe RETURNS a
result (a `Check[]`) rather than raising on any failure. **Scope-guard (AC):** a *basic*
executor-config presence check only — NOT a full open-model validation matrix (that is the
named follow-up T-042-04 / a later ticket). This is the impure twin of `doctor-core.ts`.

This ticket does NOT:
- touch `src/cli.ts` (the `doctor` dispatch arm is T-042-03);
- re-implement the report/exit-code logic (that is `renderDoctorReport`, T-042-01, done);
- compose probe→render into a CLI entry (that composition belongs to T-042-03, mirroring how
  `runInit` was added by the CLI ticket T-040-03, not the effect ticket T-040-02).

## The pure core this builds on (T-042-01, DONE)

`src/doctor/doctor-core.ts` is committed and green. It exports exactly the surface this probe
feeds:
- `interface Check { readonly name: string; readonly ok: boolean; readonly hint?: string }`
- `passed(name): Check` — green, no hint.
- `failed(name, hint): Check` — red, hint REQUIRED (enforces the hint-on-failure convention at
  construction). This probe mints every failing check via `failed`, so every red check carries
  an actionable fix-it (E-008 "name the fix").
- `renderDoctorReport(checks): DoctorReport` — pure, takes an arbitrary ordered `Check[]`. The
  probe does NOT call it; it returns the raw `Check[]` for the CLI (T-042-03) to render.
- `EXIT_OK = 0`, `EXIT_FAILED = 1` — not used by the probe (exit codes are the renderer/CLI's).

The core "does not care WHICH checks it got" (research.md, T-042-01) — so the probe owns the
check LIST and the core owns the VERDICT. Clean seam.

## The `*-core` ↔ `*-effect` house pattern (the split this must obey)

Every world-touching capability is a **pure core** (data in, data out — no fs/spawn/clock/
network/process/addon) plus a thin **impure shell** that gathers raw facts and applies the
core's decisions. Confirmed siblings, read directly:

- `src/init/init-core.ts` ↔ `src/init/init-effect.ts` — `planInit(existing, manifest)` pure;
  `applyInitScaffold` / `runInit` are the fs effects, tested **guarded-live against a real
  temp dir** (no mocks — real `mkdtemp`/`writeFile`, asserted with real `stat`/`readFile`,
  torn down in `finally`). `runInit` returns a typed outcome, never throws on a clean refusal.
- `src/executor/openai-compat.ts` — PURE helpers (`buildChatRequest`, SSE parse) are unit-
  tested; the ONE impure verb (`dispenseOpenAICompat`, real `fetch`) is NOT unit-tested.
- `src/probe/consistency.ts` ↔ `src/probe/run-consistency-probe.ts` — pure tally core tested;
  the live N×cast harness (`run-*.ts`) is not.

The doctor probe is the impure half. The KEY tension: it must be testable. The repo's answer
(everywhere) is **dependency injection with real defaults** — `planInit(existing, manifest)`,
`executorFor(opts, env, registry)`, `resolveExecutorId(opts, env)`, `buildChatRequest(opts,
env)` all take their world-facts as parameters defaulting to the real source. That makes the
"with lisa off PATH / addon unloadable / endpoint var unset" AC cases unit-testable by passing
fabricated facts, with the real `envinfo`/addon/`process.env` wired as the defaults.

## `envinfo` — the binary-resolution backend (added by this ticket)

Installed `envinfo@7.21.0` (`bun add envinfo`; saved to `dependencies`). Verified its API
empirically:

- `import envinfo from "envinfo"` → `{ cli, helpers, main, run }`.
- `envinfo.helpers.which(binary)` is the primitive: it returns a **Promise** that resolves to
  the absolute path string when the binary is on PATH, or resolves to **`undefined`** when it
  is not. It does **not reject** for a missing binary (verified: `which("bun")` →
  `"/Users/.../bun"`; `which("definitely-not-real-xyz")` → `undefined`). So
  `Boolean(await envinfo.helpers.which(name))` is the on-PATH predicate, wrapped to coerce any
  unexpected throw to `false` (the probe must never raise).
- (`envinfo.run({ Binaries: [...] })` only knows a FIXED set of well-known binaries — Node,
  Yarn, Watchman, browsers — so it cannot probe arbitrary `lisa`/`claude`. `helpers.which` is
  the right grain.)

## BAML native addon — how loadability is probed

`@boundaryml/baml` ships a NAPI-RS native binding. The platform artifact
`node_modules/@boundaryml/baml-darwin-arm64/baml.darwin-arm64.node` is present; `native.js`
(auto-generated NAPI-RS loader) `require`s it and THROWS if no binding can be loaded. The
public entry `@boundaryml/baml` (package `main: ./index.js`) re-exports the native binding —
verified `import("@boundaryml/baml")` exposes `BamlRuntime` as a `function` (a native-backed
class). The codebase's canonical specifier is `@boundaryml/baml` (`baml_client/globals.ts:21`
imports `BamlRuntime` from it). So the loadability probe is: dynamically `import(
"@boundaryml/baml")` and assert a native-backed symbol (`BamlRuntime`) is a function — if the
addon cannot load, the import throws and is caught → a failed `Check`, never a propagated
crash. Using the public entry (not the `native.js` subpath) keeps the probe on the same
exports-blessed path the rest of the app loads.

## Executor config — the seam for check #4

`src/executor/select.ts`:
- `resolveExecutorId(opts = {}, env = process.env)` → `opts.executor ?? env.VEND_EXECUTOR ??
  "claude"`. `DEFAULT_EXECUTOR_ID = "claude"`, `EXECUTOR_ENV = "VEND_EXECUTOR"`.
- Built-in ids: `"claude"` (default) and `"openai-compat"`.

`src/executor/openai-compat.ts` exposes the open-model env names as constants:
- `OPENAI_BASE_URL_ENV = "VEND_OPENAI_BASE_URL"` (the endpoint; has a local-Ollama DEFAULT
  `http://localhost:11434/v1`, so nothing is *strictly* required at runtime),
- `OPENAI_MODEL_ENV = "VEND_EXECUTOR_MODEL"`, `OPENAI_API_KEY_ENV = "VEND_OPENAI_API_KEY"`.

The ticket frames the open-model path as one that "needs its endpoint vars". The doctor
preflight's job is to give the user CONFIDENCE the path is configured — so the basic presence
check is: when `openai-compat` is selected, `VEND_OPENAI_BASE_URL` must be explicitly SET
(present), even though the runtime would silently fall back to localhost. Default-Claude needs
no config → green unconditionally. (Reuse the EXPORTED env-name constants — never re-literal
`"VEND_OPENAI_BASE_URL"`; the R12 shared-contract rule.)

## House conventions the effect must follow

1. **Returned data, never thrown** — a failing dependency is the EXPECTED outcome of a
   preflight; modelled as a red `Check`, not an exception. The probe wraps each check so even
   an unexpected backend throw becomes `failed(name, <message>)`. The AC is explicit: "returns
   a result rather than raising".
2. **Name the failure (E-008)** — every red `Check` carries an actionable hint via `failed`.
3. **R12 shared constants** — reuse `EXECUTOR_ENV`/`DEFAULT_EXECUTOR_ID`/`OPENAI_BASE_URL_ENV`/
   `OPENAI_EXECUTOR_ID` from the executor modules; do not re-literal them.
4. **Inject world-facts** — the probe takes a `Partial<DoctorProbeDeps>` (onPath, bamlLoadable,
   env) defaulting to the real envinfo/addon/`process.env`, so every AC branch is unit-testable
   with fabricated facts (the `planInit(existing, manifest)` discipline).
5. **Rich header comment** placing the module in its epic and naming its pure twin.

## Test discipline observed

`init-effect.test.ts` is the model: an ordinary `bun test` exercising the effect. For doctor,
determinism wants **mocked deps** (inject `onPath`/`bamlLoadable`/`env`) for the all-ok and the
three single-failure AC cases — no reliance on the host's actual PATH/addon. Plus a small
**guarded-live** test asserting the real defaults run without throwing and yield a well-formed
`Check[]`. The AC permits "mocked OR guarded-live"; doing both is strongest.

## Constraints & assumptions

- TypeScript on Bun; `noUncheckedIndexedAccess` on — guard index lookups.
- `envinfo` has no bundled types beyond its own `.d.ts`? Verified it ships `dist/envinfo.js`
  with `main` only (no `types`), so an import may need a minimal local type or `helpers` typed
  via `any`-narrowing — keep the surface we touch (`helpers.which`) tightly typed at our seam.
- New files live in the existing `src/doctor/` dir beside `doctor-core.ts`.
- The probe returns `Check[]` (the raw set); rendering and exit are downstream (T-042-03).
