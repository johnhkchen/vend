# T-042-02 — Design: doctor-probe-effect

_Decisions, grounded in research.md. One choice per question, with what was rejected._

## The shape of the thing

A new impure module `src/doctor/doctor-probe.ts` exporting:
- `DoctorProbeDeps` — the injectable world-fact backends (onPath, bamlLoadable, env);
- the real default backends (envinfo `which`, the addon import, `process.env`);
- the four individual check verbs (so each AC branch is unit-addressable);
- `probeDoctor(deps?: Partial<DoctorProbeDeps>): Promise<Check[]>` — the one public entry that
  runs all four checks, each guarded to never throw, and returns the ordered `Check[]`.

Every decision serves: *the probe gathers raw world-facts and maps them to `Check`s the
T-042-01 core renders; it decides nothing about exit codes and it never raises.*

## D1 — Testability: inject the world-facts, or mock the modules?

**Decision: dependency injection — `probeDoctor(deps: Partial<DoctorProbeDeps> = {})`** where

```ts
interface DoctorProbeDeps {
  readonly onPath: (binary: string) => Promise<boolean>;       // default: envinfo which
  readonly bamlLoadable: () => Promise<boolean>;               // default: import the addon
  readonly env: Record<string, string | undefined>;           // default: process.env
}
```

The probe merges `deps` over `DEFAULT_PROBE_DEPS`. This is the repo's universal seam —
`planInit(existing, manifest)`, `executorFor(opts, env, registry)`, `buildChatRequest(opts,
env)` all parameterize their world-facts with real defaults. It makes the AC's three failure
cases ("lisa off PATH", "addon unloadable", "endpoint var unset") **unit-testable with
fabricated facts**, deterministically, with no dependence on the host's actual PATH or addon.

**Rejected:** `mock.module()` / monkey-patching envinfo and the dynamic import — brittle,
global, order-dependent, and unlike anything else in the repo. **Rejected:** no injection,
guarded-live only — cannot deterministically produce a "lisa is missing" world on a dev box
that has lisa; would leave the failure-path AC unproven.

## D2 — Binary-on-PATH backend: `envinfo.helpers.which` vs `Bun.which`

**Decision: `envinfo.helpers.which`** as the default `onPath`. The ticket mandates an
"envinfo-backed probe effect" and "envinfo added to package.json deps", so envinfo must be the
backend in fact, not just a listed dep. Verified (research.md): `which(name)` resolves to the
path string when present, `undefined` when absent, and does not reject for a missing binary.
So:

```ts
const whichOnPath = async (binary: string): Promise<boolean> => {
  try { return Boolean(await envinfo.helpers.which(binary)); }
  catch { return false; }   // never let a backend quirk raise — absence reads as "not found"
};
```

The `try/catch→false` guard upholds "never throws" even if envinfo behaves unexpectedly on
some platform.

**Rejected:** `Bun.which` — simpler, but ignores the ticket's explicit envinfo mandate (and
the dep would then be unused, an honesty failure). envinfo stays injectable, so a test never
actually shells out.

## D3 — BAML addon loadability: which specifier, what assertion

**Decision: dynamically `import("@boundaryml/baml")` and assert `typeof mod.BamlRuntime ===
"function"`.** The public entry is the canonical specifier the app already uses
(`baml_client/globals.ts:21`), and it re-exports the native binding; `BamlRuntime` is a
native-backed class, so its presence proves the `.node` loaded. If the platform binding cannot
load, the NAPI-RS loader throws during import → caught → `false`.

```ts
const bamlAddonLoadable = async (): Promise<boolean> => {
  try { const m = await import("@boundaryml/baml"); return typeof m.BamlRuntime === "function"; }
  catch { return false; }
};
```

**Rejected:** importing the `@boundaryml/baml/native.js` subpath — more "direct", but relies on
a subpath the package `exports` map may not keep public; the public entry loads the same
binding and is exports-blessed. **Rejected:** calling a native function (`get_version()`) — not
re-exported by the public entry, and merely loading the class already exercises the binding.

## D4 — Executor-config check: what is "present" (scope-guarded)

**Decision: a basic presence check keyed on the selected executor id.**

```
id = resolveExecutorId({}, env)            // reuse the executor seam — no parallel switch
  claude         → passed("active executor config: claude")          // default needs none
  openai-compat  → env[VEND_OPENAI_BASE_URL] set
                     ? passed("active executor config: openai-compat")
                     : failed(..., "set VEND_OPENAI_BASE_URL to your OpenAI-compatible endpoint…")
  <anything else>→ failed(..., 'unknown VEND_EXECUTOR "<id>" — use "claude" or "openai-compat"')
```

This honours the ticket's framing ("default-Claude needs none; the open-model path needs its
endpoint vars") and the AC's failure case ("the open-model endpoint var unset → the
corresponding Check returns failed"). It reuses `resolveExecutorId`, `DEFAULT_EXECUTOR_ID`,
`OPENAI_EXECUTOR_ID`, `OPENAI_BASE_URL_ENV` from the executor modules (R12 — no re-literals).

**Scope-guard respected:** presence of the endpoint var ONLY. NOT validated: URL well-formed-
ness, reachability, model id, API key — the "full open-model validation matrix" the AC
explicitly defers. The unknown-id arm is still a basic presence judgment (is a known executor
selected), not a validation matrix. Note `VEND_OPENAI_BASE_URL` has a runtime localhost
default, but the preflight deliberately wants it EXPLICITLY set so the user has confirmed their
endpoint — a preflight is about confidence, not silent fallback.

**Rejected:** treating the localhost default as "present" (green when unset) — would make the
open-model failure case unreachable and contradict the AC. **Rejected:** validating the URL /
pinging it — out of scope by the AC's own words.

## D5 — Never-throw: per-check guard

**Decision: wrap each check verb so any thrown error becomes `failed(name, message)`.** A
`safeCheck(name, fn)` helper runs `fn()` and, on throw, returns `failed(name, <collapsed
error message>)`. Belt-and-suspenders with the per-backend `try/catch` (D2/D3): even a bug in a
check body cannot break the probe's "returns a result rather than raising" contract. The result
order is fixed (lisa, claude, BAML, executor-config) regardless of timing.

**Rejected:** relying solely on the backend guards — a future check could forget its own guard;
the central wrapper makes "never throws" a property of `probeDoctor`, not of each author's
diligence.

## D6 — Run checks concurrently or in sequence?

**Decision: concurrently via `Promise.all` over a fixed-order array of guarded thunks.** The
checks are independent IO (PATH lookups, an addon import, an env read); `Promise.all` preserves
input order in its result array, so the returned `Check[]` is deterministic (lisa, claude,
BAML, executor-config) while the slow parts overlap. Each thunk is individually guarded (D5),
so one check's failure never rejects the `all`.

**Rejected:** sequential `await`s — needlessly serial; no ordering benefit (Promise.all already
preserves order).

## D7 — `probeDoctor` returns `Check[]`, not a rendered report

**Decision: return the raw `Check[]`.** Rendering (`renderDoctorReport`) and `process.exit` are
the CLI's job (T-042-03), mirroring how `runInit` (the probe→render-equivalent composition) was
added by the CLI ticket T-040-03, not the effect ticket T-040-02. Keeping the probe at
`Check[]` keeps this ticket's boundary clean and the core's renderer the single place a `Check[]`
becomes a verdict.

**Rejected:** returning a `DoctorReport` (calling the core's renderer here) — convenient, but
pulls the CLI's composition into the effect ticket and duplicates the seam T-042-03 owns.

## D8 — envinfo typing

**Decision:** envinfo ships no `types` field. Declare a minimal local `interface` for the one
helper we touch (`helpers.which`) and import the module with a typed narrowing at our seam, so
the rest of the file stays fully typed under `tsc --noEmit`. Keep the untyped surface to the
single `whichOnPath` default.

## Surface summary (frozen for Structure)

```ts
export interface DoctorProbeDeps {
  readonly onPath: (binary: string) => Promise<boolean>;
  readonly bamlLoadable: () => Promise<boolean>;
  readonly env: Record<string, string | undefined>;
}
export const DEFAULT_PROBE_DEPS: DoctorProbeDeps;
export function lisaCheck(onPath): Promise<Check>;
export function claudeCheck(onPath): Promise<Check>;
export function bamlCheck(bamlLoadable): Promise<Check>;
export function executorConfigCheck(env): Check;
export function probeDoctor(deps?: Partial<DoctorProbeDeps>): Promise<Check[]>;
```
