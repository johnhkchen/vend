# T-002-01-02 — Research: test-gate-subclass-and-router

*Descriptive map of the terrain this ticket touches. What exists, where, how it
connects. No solutions — those are Design's job.*

## What this ticket is (and is not)

Add the **first real gate** to the `/ci` Dagger module: a `Test` sub-class
(`/ci/src/test.ts`) that spins a Bun container, mounts the app source, and
**invokes `bun run check:test`** — and route it from the thin `/ci/src/index.ts`.
The ticket context says it plainly: *"the one gate's code (no Docker needed to
build it)."* This is the **code** ticket.

The **behavioural** proof — `dagger call test` actually running the suite
in-container, agreeing with standalone, and being able to fail — is a separate
spike, **T-002-01-03 (`verify-no-drift`)**, which `depends_on` this one. That
boundary is load-bearing for scope: this ticket writes and *compiles* the gate;
the next one *runs* it. Do not pull the run/verify work forward (the over-build
reflex `ci-strategy.md` rule 6 warns about).

## The `/ci` module as it stands (after T-002-01-01)

`f6c9568` landed the bootstrap shell. Six files, hand-authored, no codegen:

```
ci/
├── dagger.json        name: ci · engineVersion: "v0.21.4" (PINNED) · sdk.source: typescript
├── package.json       { "type": "module", "dependencies": { "typescript": "5.9.3" } }
├── tsconfig.json      experimentalDecorators · paths: @dagger.io/dagger -> ./sdk
├── .gitignore         /sdk, **/node_modules, **/.pnpm-store, .env
├── .gitattributes     /sdk/** linguist-generated
└── src/index.ts       @object() export class Ci {}  — EMPTY, imports only `object`
```

Current `ci/src/index.ts` (verbatim, minus its header): `import { object } from
"@dagger.io/dagger"` then `@object() export class Ci {}`. No `@func()`, no
`dag`, no `Container`/`Directory`. The header comment already states the router
contract and explicitly names *this* ticket as the one that adds `test()`
delegating to `src/test.ts`.

**`ci/sdk/` does not exist.** Confirmed: `ls ci/sdk` → *No such file*. It is
gitignored. The `@dagger.io/dagger` import therefore does **not** resolve under
the `/ci` toolchain yet — `paths` maps it to `./sdk/index.ts`, which is absent.
T-002-01-01's progress handoff is explicit: *"First populate `sdk/` via codegen
at the pinned `v0.21.4` (no bump) so the module compiles in its own toolchain. Do
NOT add `@dagger.io/dagger` to package.json deps — it resolves via the generated
`sdk/` path-mapping."* That codegen step is owned **here**.

## Tooling on the machine (verified today)

- `dagger v0.21.4` (engine image `v0.21.4`), darwin/arm64. Matches the pin exactly.
- Docker daemon **up** (a prior session provisioned the engine and ran an alpine
  container end-to-end). Cold-start `connect` ≈ **18.4s** (`ci-strategy.md`).
- `bun 1.3.9` locally; app `engines.bun >= 1.3.9`.

## The contract surface: `bun run check:test`

From the app's root `package.json`:

```jsonc
"check:test":      "bun test",
"check:typecheck": "tsc --noEmit",
"baml:gen":        "baml-cli generate --from baml_src",
"check":           "bun run baml:gen && bun run check:typecheck && bun run check:test",
```

`check:test` is exactly `bun test`. It is the **only** place the test-gate logic
lives (the Central Rule). The gate must *invoke* this string, never reimplement it.

### A non-obvious dependency: tests need generated `baml_client/`

This is the single most important runtime fact for the gate:

- `baml_client/` is **gitignored** (root `.gitignore`: `baml_client/`) and is
  **generated** by `bun run baml:gen` (`baml-cli generate --from baml_src`).
- App tests **import it.** `grep` for `baml_client`/`@boundaryml` across `src`
  hits `src/baml/decompose.test.ts`, `src/gate/gates.test.ts`,
  `src/play/materialize.test.ts`, `src/play/decompose-epic.test.ts`, and the
  modules they cover.
- Therefore `bun test` **cannot pass in a fresh tree** without `baml_client/`
  present. Standalone on this machine it passes (229/229) only because
  `baml_client/` was already generated locally.

Consequence for a *hermetic* container: the source mount will not carry
`baml_client/` (gitignored, and we will exclude it to keep the build
cross-platform-clean), so the container must **regenerate it** (`bun run
baml:gen`) before `bun run check:test`. `baml:gen` and `bun install` are
**environment prep, not check logic** — the check stays exactly `bun run
check:test`. (Design weighs whether to include them; this is the constraint.)

- `bun.lock` **is committed** (3.8 KB) → `bun install --frozen-lockfile` is viable
  and reproducible in-container.
- Root deps: `@boundaryml/baml` (brings `baml-cli`); dev `@types/bun`,
  `typescript`. Node_modules is platform-specific (darwin locally) → must **not**
  be mounted into a linux container; install fresh instead.

## The boundaries this ticket must hold (from `ci-strategy.md` + playbook)

1. **The Central Rule** — Dagger invokes, never defines. No check logic in the
   sub-class; it only runs a container and calls `bun run check:test`.
2. **One gate = one sub-class = one file** — `Test` lives in its own
   `src/test.ts`. TS cannot split the main module file; that constraint *is* the
   anti-mess architecture.
3. **`index.ts` stays a thin router** — it routes `test()` and *nothing else
   yet*. No container logic leaks into it.
4. **`/ci` imports nothing from the app** — the only contract is the `bun run
   check:*` command *string*, never a code import. (App imports nothing from
   `/ci` either; app `tsconfig` is `include: ["src"]`, never sees `/ci`.)
5. **Engine pinned `v0.21.4`; Node runtime** — Bun runs *inside* containers, not
   as the orchestrator. `dagger develop` is a reviewed step, not casual; no bump.

## The playbook instance (`ci-structural-gate.md`, X = test)

Steps 3–4 are this ticket's core: *"Add one sub-class `/ci/src/X.ts` … spins a
Bun container and invokes `bun run check:X`. No logic — trigger + report only,"*
then *"Route it in `/ci/src/index.ts` — add `X()` to the thin router and nothing
else."* Steps 1–2 (the `check:test` script exists and passes standalone) are
already satisfied from E-001. Step 6 (run-it-three-ways no-drift) is T-002-01-03.

## Open questions Design must resolve

- **Router shape.** `Ci.test()` returns a `Test` sub-object (ci-strategy:
  "return them from the main object") vs. flat delegation `Ci.test(source) ->
  string`. Interacts with T-003's literal `dagger call test`.
- **How to satisfy AC4 ("compiles within the `/ci` toolchain")** given `sdk/` is
  absent. Generating it needs `dagger develop` — which the andon fences as
  "casual." Tension to reconcile (AC3 says *casually*, implying a deliberate run
  is allowed; the predecessor handoff assigns sdk-population here).
- **Container image + prep steps** (`bun install --frozen-lockfile`,
  `bun run baml:gen`) — necessary for the gate to be real, but must stay clearly
  *prep*, not check logic.
- **Source binding** — `@argument` `defaultPath`/`ignore` vs. an explicit
  required `source`; and what the module's context root resolves to.
