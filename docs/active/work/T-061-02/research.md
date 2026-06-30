# T-061-02 — Research

_Phase: Research. Descriptive map of the terrain. No solutions proposed here._

## Ticket in one line

Add a `vend --version` surface that prints the `package.json` semver, **embedded at
build** so it survives a single-file compiled binary (a runtime `package.json` read
is unavailable once `bun build --compile` has produced a standalone binary).

_Advances P5, E-061: `vend --version` reports a real semver._

## The dependency is satisfied (T-061-01, done)

`depends_on: [T-061-01]`, whose `phase` is `done`. That ticket made the manifest
shippable; the relevant residue this ticket builds on:

- `package.json` now reads `"version": "0.1.0"` (a real semver, no longer `0.0.0`),
  has `"bin": { "vend": "./src/cli.ts" }`, and no `private` key.
- `src/cli.ts` line 1 is now `#!/usr/bin/env bun` (the shebang T-061-01 added) — the
  `bin` target is genuinely executable. The header block follows intact below it.
- `src/packaging.test.ts` exists and locks the three manifest invariants. It reads
  the manifest **at runtime** — `JSON.parse(await Bun.file(join(import.meta.dir,
  "..", "package.json")).text())` — explicitly to avoid a JSON import / typecheck
  coupling. Note: that runtime-read pattern is exactly what does **not** survive a
  compiled binary, so this ticket cannot reuse it for the shipped surface (only the
  in-repo test may).

So `0.1.0` is the value the new surface must report; the wiring is this ticket.

## How the CLI is shaped (`src/cli.ts`, ≈985 lines)

House pattern, stated in the file header: **arg parsing is PURE and tested**
(`parseArgs`, `parseBudgetArg`, the per-verb `parse*Args`); the
`if (import.meta.main) { … }` block at the foot (≈line 664) is the **thin untested
impure shell** that calls runners, writes std streams, and `process.exit`s.

Adding a command is a four-touch change, evidenced by every existing verb:

1. **Union member** in `ParsedCommand` (the discriminated union, lines 44–116) —
   e.g. `| { readonly cmd: "shelf" }` for a no-arg verb.
2. **Routing** in `parseArgs` (lines 157–176): an `if (argv[0] === "<verb>")`
   dispatch to a `parse<Verb>Args`, or an inline return for a trivial one.
3. **A `parse<Verb>Args`** that validates and returns the union member (PURE).
4. **A dispatch arm** in the `import.meta.main` block, typically
   `if (parsed.cmd === "<verb>") { …; process.exit(n); }`, with heavy deps brought
   in via lazy `await import(...)` to keep them off the pure-parse path.

Plus the **`USAGE`** banner (lines 18–31) lists every verb; a new surface is added
there for discoverability.

## `--version` is not handled today

`grep -n "version\|--version" src/cli.ts` finds nothing. `parseArgs` routes any
`argv[0]` that is not a known verb to `parseSelectOrBrowse`, which only recognizes
`--all` / `--budget`; a `--version` token falls into `positional`, fails the
`SELECTION_SHAPE` regex, and returns `{ cmd: "usage", error: "unknown command:
--version" }`. So **`vend --version` currently prints a usage error and exits 2.**
The token must be intercepted early in `parseArgs`.

## The embedding constraint — the actual substance of the ticket

The ticket's hard part is not "print a string"; it is "print a string that is still
correct **after `bun build --compile`**." Three ways a value can reach the CLI, and
how each fares post-compile:

- **Runtime fs read** — `Bun.file(join(import.meta.dir, "..", "package.json"))`
  (the `packaging.test.ts` idiom). Works in `bun run src/cli.ts` (dev). **Fails in
  the compiled binary**: there is no `package.json` beside the standalone binary,
  and `import.meta.dir` points into the virtual bundle. This is the trap the ticket
  is explicitly written to avoid ("runtime package.json read is unavailable
  post-compile").
- **Static JSON import** — `import pkg from "../package.json"`. `bun build
  --compile` bundles imported `.json` into the executable as inlined data. Survives.
- **Build-time macro / `--define`** — Bun macros or a `--define` flag inline a
  literal at bundle time. Survives, but `--define` would couple the embed to a build
  flag owned by a *later* ticket (T-062-02).

### Empirically confirmed against this exact toolchain

Rather than assume, the two viable mechanisms were tested against the project's real
`tsconfig.json` and Bun:

1. **`import pkg from "../package.json"` typechecks under the current tsconfig with
   ZERO config change.** `bunx tsc --noEmit -p tsconfig.json` over a file containing
   that import exits 0. It is genuinely type-checked, not skipped: changing the
   target type to `number` (`const N: number = pkg.version`) raises
   `TS2322: Type 'string' is not assignable to type 'number'` — so `pkg.version` is
   correctly typed as `string`. No `resolveJsonModule` flag is needed here (the
   `moduleResolution: "bundler"` setting resolves JSON), despite T-061-01's note
   having avoided that flag for the *test*.
2. **`bun build --compile` embeds the JSON.** A two-line harness
   (`import pkg from "<abs>/package.json"; console.log(pkg.version)`) compiled to a
   standalone binary and run **from a directory with no `node_modules` and no
   `package.json`** printed `0.1.0`. This is precisely the AC's compiled-binary
   property, observed directly.
3. **Compile is cheap for a small module.** Recompiling the tiny harness took
   ~0.08s; the binary is **57 MB** (Bun always embeds its full runtime, regardless
   of program size). The whole-`cli.ts` compile would instead pull the BAML native
   addon (~108 MB per E-061 notes) and be far heavier — relevant to test design.

## `tsconfig.json` facts that bound the design

`strict`, `noUncheckedIndexedAccess`, `module: ESNext`,
`moduleResolution: bundler`, `allowImportingTsExtensions`,
`verbatimModuleSyntax: true`, `noEmit`, `types: ["bun"]`, `include: ["src"]`.
- `package.json` sits at repo root, **outside** `include: ["src"]`. Importing it
  from `src/` still type-checks (confirmed above); it is pulled into the program as
  an imported file, and `noEmit` means no rootDir/outDir emit complaint.
- `verbatimModuleSyntax: true` did not reject the JSON default import (a value
  import, not type-only) — confirmed by the exit-0 typecheck.

## Test-strategy terrain

The AC asks for two things to be asserted:
- (A) the printed value **equals** the manifest version, and
- (B) it **still resolves from a compiled binary with no `node_modules`.**

(A) is a cheap pure/unit assertion (compare the exported constant to the manifest
read at runtime, the `packaging.test.ts` idiom). (B) requires actually invoking
`bun build --compile` and running the artifact in a clean dir — an integration test.
Compiling the *whole* `cli.ts` would drag in BAML and be slow; compiling a **minimal
harness that imports only the version module** exercises the identical embed
mechanism cheaply (~0.08s + a 57 MB temp binary). Existing tests already shell out
and write temp dirs (e.g. `src/ci/*.test.ts`, `init` tests), so a compile-and-run
test is consistent with the codebase's testing repertoire.

## Gate baseline (so new failures are attributable)

`bun test` on the current working tree: **1349 pass / 8 fail**. All 8 failures are
**live-board smoke tests** (`loadWorkGraph — live board smoke`, `writeBoardSvg`,
`one-way authority`, `T-021-05/06/08`) that load the real `docs/active/**` tree and
choke on a transient dangling reference (`story 'S-064' has no epic 'E-064'`) — the
board is mid-epic. **None touch cli / packaging / version.** They are pre-existing,
data-driven, and out of scope; this ticket must not *add* to the fail count, and its
own new tests must pass.

## Sibling / epic context (boundaries)

- **E-061 / S-062**: `.github/release-target.env` pins `BUN_COMPILE_TARGET=
  bun-darwin-arm64` (MVP single platform). **T-062-02** (`compile-self-contained-
  binary`) runs the `bun build --compile` that this ticket's embed must survive;
  **T-062-03** does the release/tarball/sha. T-061-02 owns *how the value is
  embedded*; it must pick a mechanism that those compile tickets carry for free
  (i.e. not depend on a build flag they have not yet added).

## Open questions carried into Design

- **Which embed mechanism** — static JSON import (zero config, proven) vs. a Bun
  macro (embeds only the literal, no manifest object) vs. `--define` (rejected:
  couples to T-062-02)?
- **A dedicated `src/version.ts` module** vs. importing the JSON directly in
  `cli.ts` — does the test need a lightweight, BAML-free compile target?
- **Surface spelling** — `--version` only, or also `-v` (which often means
  verbose)? Where in `parseArgs` is it intercepted, and does it short-circuit extra
  args?
- **How heavy a compile-in-test** is acceptable for the gate, and against which
  module is it run?
