# T-042-02 — Progress: doctor-probe-effect

_Implement-phase log. What was built, deviations from plan.md, and verification evidence._

## Completed (all plan steps)

- **Step 0 — dependency.** `bun add envinfo` → `dependencies: { "envinfo": "^7.21.0" }` in
  `package.json`; lockfile updated. ✓ (AC: "envinfo is added to package.json deps".)
- **Step 1 — backends + deps.** `src/doctor/doctor-probe.ts`: header, imports, `DoctorProbeDeps`,
  `whichOnPath` (envinfo-backed, `try/catch→false`), `bamlAddonLoadable` (dynamic
  `@boundaryml/baml` import, asserts `BamlRuntime` is a function, `try/catch→false`),
  `DEFAULT_PROBE_DEPS`.
- **Step 2 — verbs + wrapper + entry.** `lisaCheck`, `claudeCheck`, `bamlCheck`,
  `executorConfigCheck` (the D4 scope-guarded presence matrix), `safeCheck`/`messageOf`, and
  `probeDoctor` (`Promise.all` over four guarded thunks, fixed order, never rejects).
- **Step 3 — tests.** `src/doctor/doctor-probe.test.ts`: the four AC blocks (all-ok; lisa off
  PATH; BAML unloadable; open-model endpoint unset), the `executorConfigCheck` matrix, the
  individual verbs, two never-throws blocks (throwing `onPath`/`bamlLoadable`), and the
  guarded-live smoke. 14 tests.
- **Step 4 — full gate.** Green (evidence below).

## Deviations from plan / structure

1. **envinfo typing via an ambient `.d.ts`, not an inline narrowing.** structure.md §2 proposed
   a local `EnvinfoModule` type narrowing at the `whichOnPath` seam. envinfo ships NO `types`
   field, so `import envinfo from "envinfo"` raised TS2307 at the module level — an inline
   narrowing can't fix a missing module declaration. Resolved by adding
   `src/doctor/envinfo.d.ts`, a focused `declare module "envinfo"` typing only the surface the
   probe touches (`helpers.which`). Picked up automatically by the project `tsc`
   (`include: ["src"]`). Cleaner than the planned inline cast and keeps `doctor-probe.ts` fully
   typed. No behavioural change.

2. **No other deviations.** Surface, check names/hints, ordering, and the `Check[]` return
   (not a rendered report — T-042-03 owns the render/exit composition) are exactly as designed.

## Files touched

| File | Action |
| --- | --- |
| `package.json` | MODIFY — `envinfo@^7.21.0` added to `dependencies`. |
| `bun.lock` | MODIFY — lockfile entry for envinfo. |
| `src/doctor/doctor-probe.ts` | CREATE — the probe effect (4 checks, never throws). |
| `src/doctor/doctor-probe.test.ts` | CREATE — 14 tests (mocked AC matrix + guarded-live smoke). |
| `src/doctor/envinfo.d.ts` | CREATE — ambient types for the one envinfo helper used. |

## Verification evidence

- `bunx tsc --noEmit` → exit 0 (whole repo, clean).
- `bun test src/doctor/doctor-probe.test.ts` → **14 pass / 0 fail**, 71 expect() calls.
- `bun test` (whole suite) → **1061 pass / 0 fail**, 71 files. No regressions.
- Live smoke (real defaults, this box has lisa+claude+addon, default executor):
  ```
  doctor: ok — 4 check(s) passed
    ✓ lisa on PATH
    ✓ claude on PATH
    ✓ BAML native addon loadable
    ✓ active executor config: claude        exitCode: 0
  ```
- Live failure-path smoke (`VEND_EXECUTOR=openai-compat`, no `VEND_OPENAI_BASE_URL`):
  ```
  doctor: FAILED — 1 of 4 check(s) failed
    ✗ active executor config: openai-compat — set VEND_OPENAI_BASE_URL to your OpenAI-compatible
      endpoint (e.g. http://localhost:11434/v1)                exitCode: 1
  ```
  Confirms the probe→core seam end to end: a real red `Check` carries its hint and yields exit 1.

## Commit

Per the house workflow, the `git commit` is **deferred to Lisa**. This session writes the
artifacts + source and leaves the working tree staged-by-existence.
