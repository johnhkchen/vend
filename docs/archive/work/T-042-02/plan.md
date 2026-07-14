# T-042-02 — Plan: doctor-probe-effect

_Ordered, independently-verifiable steps. Grounded in structure.md. Testing strategy inline._

## Step 0 — Dependency (DONE)

`bun add envinfo` → `dependencies: { "envinfo": "^7.21.0" }` in `package.json`, lockfile
updated. **Verify:** `grep envinfo package.json` shows it under dependencies; `bun -e 'import
envinfo from "envinfo"; console.log(typeof envinfo.helpers.which)'` prints `function`. (Already
confirmed in Research.)

## Step 1 — `src/doctor/doctor-probe.ts`: backends + deps

Write the header comment, imports, the `EnvinfoModule` narrowing type, the name/hint constants,
the `DoctorProbeDeps` interface, the `whichOnPath` / `bamlAddonLoadable` default backends (each
`try/catch → false`), and `DEFAULT_PROBE_DEPS`.

**Verify:** `tsc --noEmit` clean for the file so far (backends typed; envinfo narrowed at the
single seam).

## Step 2 — the four check verbs + never-throw wrapper + `probeDoctor`

Add `lisaCheck`, `claudeCheck`, `bamlCheck`, `executorConfigCheck`, the `safeCheck` wrapper +
`messageOf` helper, and the `probeDoctor` `Promise.all` composition (fixed order).

**Verify:** `tsc --noEmit` clean. Live smoke:
`bun -e 'import { probeDoctor } from "./src/doctor/doctor-probe.ts"; console.log(await
probeDoctor())'` prints four `Check`s and does not throw.

## Step 3 — `src/doctor/doctor-probe.test.ts`

Write the seven blocks from structure.md §test-blueprint:
1. all-ok (injected) → four green checks.
2. lisa off PATH → lisa red + `LISA_HINT`, others green, four returned.
3. BAML unloadable → BAML red + `BAML_HINT`, returns a result.
4. open-model endpoint var unset → executor red naming `VEND_OPENAI_BASE_URL`.
5. `executorConfigCheck` matrix: claude/default green; openai-compat+URL green; openai-compat
   no-URL red; bogus id red.
6. never-throws: a throwing `onPath`/`bamlLoadable` ⇒ `probeDoctor` resolves, the check is
   `failed` with the message.
7. guarded-live smoke: real `probeDoctor()` resolves to four well-formed checks (shape only).

**Testing strategy:**
- **Unit (mocked deps)** — blocks 1–6. Deterministic; the entire AC failure matrix is exercised
  by injecting fabricated facts. This is the primary proof (the AC allows "mocked or
  guarded-live").
- **Guarded-live** — block 7. Proves the REAL defaults (envinfo `which`, the addon import,
  `process.env`) compose without throwing and produce well-formed checks; asserts SHAPE not
  host-specific ok/!ok, so it is CI-stable regardless of whether lisa/claude are on PATH.

**Verify:** `bun test src/doctor/doctor-probe.test.ts` green.

## Step 4 — Full gate

`tsc --noEmit` (whole repo) clean; `bun test` (whole suite) green with the new tests added and
no regressions; a final live `bun -e` smoke of `probeDoctor()` against the real environment.

**Verify:** zero type errors; suite pass count rises by the new test count; smoke prints a
plausible report (e.g. lisa/claude may be red on a bare box — that is correct behaviour, not a
test failure).

## Atomicity / commit boundaries

Steps 1–3 are one cohesive unit (a module is incomplete without its tests); a single logical
change. Per the house workflow, the actual `git commit` is **deferred to Lisa** — this session
writes artifacts and source, runs the gates, and stops after `review.md`.

## Risks & mitigations

- **envinfo lacks bundled types** → narrow `helpers.which` with a local `EnvinfoModule` type at
  the one seam (D8); keep the untyped surface to `whichOnPath`. Verify with `tsc`.
- **`@boundaryml/baml` dynamic import side-effects** in tests → block 7 is the ONLY place the
  real addon loads, and only as a shape smoke; the AC failure cases inject `bamlLoadable` and
  never touch the real addon.
- **`process.env` leakage** → AC tests pass an explicit `env` object; they never mutate
  `process.env`, so no cross-test contamination.
- **envinfo `which` resolving a Promise quirk on another platform** → the `try/catch → false`
  guard plus `Boolean(...)` coercion means any non-string/throw reads as "not found", never a
  raise.

## Definition of done (maps to AC)

- [x] envinfo in `package.json` deps.
- [ ] `probeDoctor` returns all-ok in a wired env (block 1).
- [ ] lisa off PATH → lisa `Check` failed w/ hint, probe returns a result (block 2).
- [ ] BAML addon unloadable → BAML `Check` failed w/ hint, probe returns a result (block 3).
- [ ] open-model endpoint var unset → executor `Check` failed w/ hint, probe returns a result
      (block 4).
- [ ] probe NEVER raises — every failure is returned data (blocks 2–4, 6).
- [ ] basic executor-config presence check only; no validation matrix (D4 scope-guard).
