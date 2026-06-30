# T-062-02 — Research

**Ticket:** task — `compile-self-contained-binary` (E-061 / S-062), `depends_on: [T-061-02, T-062-01]`
**Goal:** produce a single self-contained `vend` binary via `bun build --compile` for the
pinned target that bundles BAML's native addon and runs with no repo checkout.

Descriptive only — what exists, where, how it connects, and the one real risk. No solution
proposed here (that is Design).

## What the AC actually demands

> On a directory with no node_modules/checkout, the compiled binary runs `vend --version`
> (real semver) and exercises a BAML-backed path proving the native addon loads.

Two observable obligations from the SAME binary, run from a dir with no `node_modules` and
no repo:
1. `vend --version` → a real semver (not `0.0.0`).
2. a **BAML-backed path** that proves the native `.node` addon dlopen'd.

So the deliverable is twofold: a **producer** (a repeatable way to build the binary for the
pinned target) and a **proof** (a test that runs the artifact from an empty dir).

## The pinned target (upstream T-062-01, already landed)

`.github/release-target.env` is the machine-readable SSOT, and the pin file's own header says
downstream tickets **"must reference keys by name, not hard-code the literals."** Keys this
ticket consumes:

- `BUN_COMPILE_TARGET=bun-darwin-arm64` — the string passed to `bun build --compile --target=`.
- `RELEASE_ASSET_TRIPLE=aarch64-apple-darwin` / `RELEASE_TARBALL=…` — consumed by T-062-03, not here.
- `BUN_VERSION=1.3.9` — CI pin (the dev machine runs `1.3.8`, one patch below; see Constraints).

`docs/active/work/T-062-01/target.md` is the human record; `release-target-check.yml` is a
standing arch/pin-drift guard (not a release pipeline).

## The entrypoint and the version embed (upstream T-061-02, done)

- CLI entry: `src/cli.ts` (`#!/usr/bin/env bun`; `bin.vend` in `package.json` points here).
- `parseArgs` intercepts `--version` at the top → `{ cmd: "version" }`; the `import.meta.main`
  arm prints `VERSION` and exits 0.
- `src/version.ts`: `import pkg from "../package.json"; export const VERSION = pkg.version`.
  T-061-02 **already proved** the JSON import survives `bun build --compile` (its
  `version.test.ts` compiles a tiny BAML-free harness). So the `--version` half of THIS AC is
  de-risked; the novelty here is compiling the **whole** `cli.ts` graph — including BAML.

## How BAML's native addon loads (the crux)

`src/baml/*-bridge.ts` and `src/play/note.ts` import `baml_client/sync_client.ts`; the doctor
probe (`src/doctor/doctor-probe.ts`) imports `@boundaryml/baml` directly. The npm package
`@boundaryml/baml`'s `native.js` is an auto-generated **NAPI-RS** loader. Its resolution order:

1. `process.env.NAPI_RS_NATIVE_LIBRARY_PATH` → `require(that path)` if set.
2. else, per `process.platform`/`arch`, a try-chain: `require('./baml.darwin-arm64.node')`
   (relative to `native.js`; **fails** — the file isn't there) → `require('@boundaryml/baml-darwin-arm64')`
   (the optionalDependency package; **succeeds** in dev — its `main` is the `.node`).

The addon: `node_modules/@boundaryml/baml-darwin-arm64/baml.darwin-arm64.node`, **45 MB**
(measured; the epic's "~108 MB" is stale/upper-bound — the binary lands ~103 MB total). BAML
runtime files are **inlined** (`baml_client/inlinedbaml.ts` → `getBamlFiles()`), so
`BamlRuntime.fromFiles('baml_src', getBamlFiles(), env)` needs **no `baml_src/` on disk** at
runtime — the first arg is a label, not a path read. This matters: it means the only
non-JS artifact the binary needs is the `.node` addon itself.

**The open question for Design:** does `bun build --compile` embed a `.node` addon that is
reached through this NAPI-RS `require('@boundaryml/baml-darwin-arm64')` indirection, and does
the loader still find it at runtime inside the single-file binary?

## Decisive experiment (run this session, on the pinned target)

`bun build --compile --target=bun-darwin-arm64 src/cli.ts --outfile <tmp>/vend`:

- **bundled 85 modules; compiled in ~0.15 s; output 103 MB** (≈ 57 MB bun runtime + 45 MB
  addon → the addon WAS embedded).
- From a **freshly-created empty dir** (no `node_modules`, no `package.json`, no repo):
  - `vend --version` → `0.1.0`, exit 0.
  - `vend doctor` → includes `✓ BAML native addon loadable`, exit 0.

So Bun auto-embeds the `.node` addon AND the NAPI-RS loader resolves it at runtime from inside
the compiled binary — **no `NAPI_RS_NATIVE_LIBRARY_PATH`, no sidecar `.node`, no extraction
glue required.** The happy path holds empirically on the exact pinned target. This collapses
the ticket's main risk; Design's job is to make it **repeatable** and **tested**, not to invent
addon-embedding machinery.

## The BAML-backed proof path (for the test)

`vend doctor`'s `bamlAddonLoadable()` does `await import("@boundaryml/baml")` and asserts
`typeof BamlRuntime === "function"`. If the `.node` failed to dlopen, the import throws → the
check reds (`✗ BAML native addon loadable`). So a **green `✓ BAML native addon loadable`** line
is a genuine proof the native addon loaded — and it is **PATH-independent** (an import, not a
`which`), unlike doctor's `lisa`/`claude` checks. That makes it a non-flaky assertion target
even on a CI box lacking lisa/claude (where `doctor`'s overall exit code would be 1).

## Build-script conventions to mirror

- Impure CLI-style scripts live in `src/ci/*.ts` (`check-committed.ts` et al.): a thin
  `import.meta.main` shell that shells out (`Bun.spawnSync`), writes stderr, and `process.exit`s
  with documented codes, delegating judgment to a pure `*-core.ts`. `package.json` wires each as
  a `bun run src/ci/<x>.ts` script.
- Smoke tests that exercise the wired CLI shell out with `Bun.spawnSync(["bun","run",CLI,…])`
  and assert the observable contract, using an **invariant** rather than a hard green to stay
  non-flaky on minimal CI (`src/doctor/doctor-cli.smoke.test.ts`).
- `dist/` is already gitignored — the natural output dir for the binary.

## Constraints & assumptions

- **Single platform only** (PE-7): the arm64-mac pin. No 4-target matrix — BAML cross-compile
  risk is explicitly out of scope.
- **Reference the pin by key**, never hard-code `bun-darwin-arm64` (the pin header's rule).
- **Bun floor `1.3.9`** is pinned for CI; the dev box runs `1.3.8` and the compile worked, so
  the floor is a CI guarantee, not a local blocker.
- **Release wiring (tarball / sha256 / GitHub release) is T-062-03**, not here. This ticket
  ends at "a binary exists and is proven self-contained."
- **Pre-existing red gate:** T-062-01's review recorded ~8 failing tests at HEAD (unminted
  epics E-062..E-065 referenced by stories; executor/MCP env smokes). None are reachable from
  this ticket's files; new tests here must stand on their own.
