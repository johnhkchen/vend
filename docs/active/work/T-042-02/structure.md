# T-042-02 — Structure: doctor-probe-effect

_File-level blueprint. The shape of the code, not the code. Grounded in design.md._

## Files

| File | Action | Purpose |
| --- | --- | --- |
| `src/doctor/doctor-probe.ts` | CREATE | The impure probe effect — backends, four check verbs, `probeDoctor`. |
| `src/doctor/doctor-probe.test.ts` | CREATE | Mocked-deps unit tests for every AC branch + a guarded-live smoke. |
| `package.json` | MODIFY (done) | `envinfo` added to `dependencies` (`bun add envinfo` → `^7.21.0`). |

No other files change. `src/cli.ts` is untouched (T-042-03). `doctor-core.ts` is untouched
(T-042-01, done) — this module IMPORTS from it.

## `src/doctor/doctor-probe.ts` — internal organization

Top-to-bottom, mirroring `init-effect.ts`'s "header → backends → verbs → public entry" shape.

### 1. Header comment
Places the module in E-042 / S-042-01, names its pure twin `doctor-core.ts`, states the central
rule (gathers raw world-facts → `Check`s the core renders; decides no exit code; NEVER throws),
and the IMPURE-but-narrow surface (envinfo `which`, a dynamic `@boundaryml/baml` import,
`process.env`, and the executor-seam constants — nothing else).

### 2. Imports
```ts
import envinfo from "envinfo";                                  // helpers.which backend
import { failed, passed, type Check } from "./doctor-core.ts";  // pure constructors + type
import {
  DEFAULT_EXECUTOR_ID, EXECUTOR_ENV, resolveExecutorId,
} from "../executor/select.ts";
import { OPENAI_BASE_URL_ENV, OPENAI_EXECUTOR_ID } from "../executor/openai-compat.ts";
```
A minimal local type for envinfo's untyped helper:
```ts
type EnvinfoModule = { helpers: { which: (binary: string) => Promise<string | undefined> } };
```
(applied as a narrowing on the default import, confined to the `whichOnPath` backend).

### 3. Check names + hints (module constants)
Stable `Check` names and fix-it hints as `const` strings, so the test asserts against one
source of truth and a rename moves with it:
- `LISA_CHECK = "lisa on PATH"`, `LISA_HINT = "install lisa and ensure \`lisa\` is on your PATH"`.
- `CLAUDE_CHECK = "claude on PATH"`, `CLAUDE_HINT = "install Claude Code and ensure \`claude\` is on your PATH"`.
- `BAML_CHECK = "BAML native addon loadable"`, `BAML_HINT = "reinstall dependencies to rebuild the native addon: \`bun install\`"`.
- `EXECUTOR_CHECK = "active executor config"` (the report name is suffixed with the resolved id).

### 4. The injectable deps + real defaults
```ts
export interface DoctorProbeDeps {
  readonly onPath: (binary: string) => Promise<boolean>;
  readonly bamlLoadable: () => Promise<boolean>;
  readonly env: Record<string, string | undefined>;
}
async function whichOnPath(binary: string): Promise<boolean>      // envinfo, try/catch→false
async function bamlAddonLoadable(): Promise<boolean>              // import baml, try/catch→false
export const DEFAULT_PROBE_DEPS: DoctorProbeDeps = {
  onPath: whichOnPath, bamlLoadable: bamlAddonLoadable, env: process.env,
};
```

### 5. The four check verbs (each returns a `Check`, total)
- `export async function lisaCheck(onPath): Promise<Check>` — `onPath("lisa") ? passed(LISA_CHECK) : failed(LISA_CHECK, LISA_HINT)`.
- `export async function claudeCheck(onPath): Promise<Check>` — same shape, claude.
- `export async function bamlCheck(bamlLoadable): Promise<Check>` — `await bamlLoadable() ? passed(BAML_CHECK) : failed(BAML_CHECK, BAML_HINT)`.
- `export function executorConfigCheck(env): Check` — pure (no `await`); the D4 id-keyed
  branch: `claude`→passed; `openai-compat`→base-URL-present ? passed : failed; else→failed
  unknown-id. Names are `${EXECUTOR_CHECK}: ${id}`.

### 6. The never-throw wrapper
```ts
async function safeCheck(name: string, run: () => Promise<Check> | Check): Promise<Check>
```
`try { return await run(); } catch (e) { return failed(name, collapse(messageOf(e))); }` —
the central guarantee that a backend or check-body throw degrades to a red `Check`, not a
raised error. Reuses a tiny `messageOf(e)` (`e instanceof Error ? e.message : String(e)`).

### 7. `probeDoctor` — the public entry
```ts
export async function probeDoctor(deps: Partial<DoctorProbeDeps> = {}): Promise<Check[]> {
  const d = { ...DEFAULT_PROBE_DEPS, ...deps };
  return Promise.all([
    safeCheck(LISA_CHECK,   () => lisaCheck(d.onPath)),
    safeCheck(CLAUDE_CHECK, () => claudeCheck(d.onPath)),
    safeCheck(BAML_CHECK,   () => bamlCheck(d.bamlLoadable)),
    safeCheck(EXECUTOR_CHECK, () => executorConfigCheck(d.env)),
  ]);
}
```
Fixed order in → fixed order out (`Promise.all` preserves order). Never rejects.

## `src/doctor/doctor-probe.test.ts` — test blueprint

Imports `probeDoctor` + the verbs + the name/hint constants from `doctor-probe.ts`, and
`type Check` from `doctor-core.ts`. NO real PATH/addon dependence in the AC tests — all facts
injected. Helpers: `const yes = async () => true; const no = async () => false;` and an
`onPathFor(set: Set<string>)` factory so "lisa present, claude present" vs "lisa absent" is one
line.

Blocks:
1. **AC all-ok** — `probeDoctor({ onPath: ()=>true, bamlLoadable: yes, env: {} })` → every
   `Check.ok === true`; the set contains all four names; no `hint`s.
2. **AC lisa off PATH** — `onPath` returns false for `"lisa"`, true otherwise → the lisa
   `Check` is `failed` with `LISA_HINT`; the probe still RETURNS four checks (did not raise);
   the other three are green.
3. **AC BAML addon unloadable** — `bamlLoadable: no` → the BAML check is `failed` with
   `BAML_HINT`; probe returns a result.
4. **AC open-model endpoint var unset** — `env: { VEND_EXECUTOR: "openai-compat" }` (no
   `VEND_OPENAI_BASE_URL`) → the executor `Check` is `failed`, hint names `VEND_OPENAI_BASE_URL`;
   probe returns a result.
5. **executor-config matrix (unit, `executorConfigCheck`)** — default/empty env → claude,
   green; `openai-compat` + base URL set → green; `openai-compat` no base URL → red;
   `VEND_EXECUTOR=bogus` → red unknown-id.
6. **never-throws** — inject an `onPath`/`bamlLoadable` that THROWS → `probeDoctor` resolves
   (does not reject) and the corresponding `Check` is `failed` carrying the error message.
7. **guarded-live smoke** — `probeDoctor()` with the REAL defaults resolves to four well-formed
   `Check`s (names present, each `ok` boolean) without throwing. Asserts shape, NOT specific
   ok/!ok (host-dependent) — so it is stable in CI whether or not lisa/claude are installed.

## Ordering of changes
1. `package.json` dep (already applied).
2. `doctor-probe.ts`.
3. `doctor-probe.test.ts`.
4. `tsc --noEmit` + `bun test` green; live `bun -e` smoke of `probeDoctor()`.

## Boundaries / invariants
- IMPORTS only: `envinfo`, `./doctor-core.ts`, `../executor/select.ts`,
  `../executor/openai-compat.ts`, `node:`-free (uses `process.env` via the injected default).
  No `node:fs`, no `Bun.spawn`, no `cli.ts`.
- The module NEVER calls `renderDoctorReport` or `process.exit` (T-042-03's job).
- Every cross-module literal (env names, executor ids) comes from an exported constant.
