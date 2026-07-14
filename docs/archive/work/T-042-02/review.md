# T-042-02 — Review: doctor-probe-effect

_Self-assessment / handoff. What changed, test coverage, open concerns. Read this instead of
the diff._

## What this ticket delivered

The impure `vend doctor` PROBE — the world-touching twin of the T-042-01 pure core. It runs the
four vend-specific dependency checks and emits one `Check` each, never throwing:

1. **lisa on PATH** — envinfo `which` resolves the binary.
2. **claude on PATH** — envinfo `which` resolves the binary.
3. **BAML native addon loadable** — a dynamic `@boundaryml/baml` import exposes `BamlRuntime`.
4. **active executor config** — a basic presence check keyed on the selected executor id.

`probeDoctor(deps?)` returns the ordered `Check[]`; the T-042-01 core renders it and T-042-03
will print + `process.exit`. The probe decides no exit code and never calls the renderer.

## Files changed

| File | Action | Notes |
| --- | --- | --- |
| `package.json` | MODIFY | `envinfo@^7.21.0` → `dependencies` (the AC's dep requirement). |
| `bun.lock` | MODIFY | envinfo lockfile entry. |
| `src/doctor/doctor-probe.ts` | CREATE | ~165 lines: backends, 4 verbs, `safeCheck`, `probeDoctor`. |
| `src/doctor/doctor-probe.test.ts` | CREATE | 14 tests — mocked AC matrix + guarded-live smoke. |
| `src/doctor/envinfo.d.ts` | CREATE | Ambient types for the one envinfo helper used (envinfo ships none). |

No change to `src/cli.ts` (T-042-03), `doctor-core.ts` (T-042-01, done), or any executor module
(imported read-only). Cross-module literals (env names, executor ids) are reused from the
exported constants — no re-literals (R12).

## Acceptance-criteria mapping

- ✅ **Probe returns all-ok in a wired env** — `probeDoctor — AC (1)`: all four checks green,
  no hints.
- ✅ **lisa off PATH → that Check failed w/ hint, probe returns rather than raising** —
  `AC (2)`: lisa red + `LISA_HINT`, four checks returned, others green.
- ✅ **BAML addon unloadable → that Check failed w/ hint, probe returns a result** — `AC (3)`.
- ✅ **open-model endpoint var unset → that Check failed w/ hint, probe returns a result** —
  `AC (4)`: `openai-compat` selected, `VEND_OPENAI_BASE_URL` unset → red, hint names the var.
- ✅ **never raises** — two `NEVER THROWS` tests: a throwing `onPath`/`bamlLoadable` degrades to
  a red `Check` (the error message becomes the hint); the probe resolves to four checks.
- ✅ **envinfo added to package.json deps.**
- ✅ **Scope-guard honoured** — `executorConfigCheck` is a basic PRESENCE check only (claude
  needs none; openai-compat needs `VEND_OPENAI_BASE_URL` set; unknown id → red). It does NOT
  validate URL form, reachability, model id, or API key — the deferred "full open-model
  validation matrix".

## Test coverage

14 tests, all green. Coverage by surface:
- **`probeDoctor`** — all four AC branches, isolation (one failure leaves the others green),
  the four-check count/order, and never-throws under two distinct throwing backends.
- **`executorConfigCheck`** — the full presence matrix: default/claude, openai-compat with &
  without the base URL, and an unknown id.
- **Individual verbs** (`lisaCheck`/`claudeCheck`/`bamlCheck`) — exact `Check` shape for
  present/absent.
- **Guarded-live smoke** — the REAL defaults (envinfo `which`, the real addon import,
  `process.env`) compose without throwing and yield four well-formed checks; asserts SHAPE, not
  host-specific verdicts, so it is CI-stable whether or not lisa/claude are installed.

Whole repo: `tsc --noEmit` clean; `bun test` → **1061 pass / 0 fail**.

## Design choices a reviewer should sanity-check

1. **Dependency injection over module mocking.** The world-facts are `DoctorProbeDeps`
   parameters (the `planInit(existing, manifest)` / `executorFor(opts, env, registry)`
   discipline), so every AC failure case is deterministic without monkey-patching envinfo or
   the dynamic import. This is the repo's universal seam.
2. **`VEND_OPENAI_BASE_URL` required-when-selected, despite a runtime localhost default.** The
   open-model executor silently falls back to local Ollama, but the PREFLIGHT deliberately
   wants the endpoint EXPLICITLY set — a doctor exists to give confidence the path is
   configured, not to bless a silent fallback. This is the reading of the ticket's "the
   open-model path needs its endpoint vars" + the AC's "endpoint var unset → failed". If the
   team prefers "the localhost default counts as present", the one-line change is in
   `executorConfigCheck`; flag for confirmation.
3. **BAML probed via the public `@boundaryml/baml` entry**, not the `native.js` subpath — the
   exports-blessed specifier the app already uses; `BamlRuntime`'s presence proves the binding
   loaded.
4. **envinfo ambient `.d.ts`.** envinfo ships no types; rather than `any`-cast at the call site,
   a focused `declare module "envinfo"` types only `helpers.which`. Minimal and honest.

## Open concerns / follow-ups (none blocking)

- **`executorConfigCheck` base-URL semantics** — see choice #2; a deliberate, reversible
  judgment call worth a nod from the reviewer.
- **T-042-03 (CLI arm)** will compose `renderDoctorReport(await probeDoctor())` and own the
  `process.exit` + any `--color`. The composition was intentionally NOT added here to keep the
  effect/CLI boundary clean (mirrors `runInit` landing in the CLI ticket T-040-03, not the
  effect ticket T-040-02). Verified end-to-end manually via the live smokes (both exit paths).
- **T-042-04 (cast-precondition reuse)** can call `probeDoctor` to refuse a cast when
  `!report.ok`. No changes needed here for that.
- **Native-addon import cost** — `bamlAddonLoadable` does a real dynamic import; it runs once
  per `probeDoctor()` and only in the live path (AC tests inject the fact). Negligible for a
  preflight, but noted.

## Risks

Low. The module is additive (new files + a new dep), touches no existing runtime path, and the
full suite is green. The only behavioural judgment a reviewer might revisit is the base-URL
presence rule (choice #2), which is localized to one function.
