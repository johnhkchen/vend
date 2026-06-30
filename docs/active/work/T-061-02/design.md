# T-061-02 — Design

_Phase: Design. Enumerate options, weigh against Research, decide with rationale._

## What must be true at the end (from AC)

`vend --version` prints the `package.json` semver (not `0.0.0`); a test asserts the
printed value equals the manifest version, and it still resolves when run from a
**compiled binary with no `node_modules`.**

Four design decisions: the **embed mechanism**, the **module boundary**, the
**surface/parse shape**, and the **test strategy**.

---

## Decision 1 — The embed mechanism (the crux)

The value must survive `bun build --compile`. Research confirmed the failure mode of
a runtime fs read and proved two survivors.

**Options**
- (a) **Static JSON import** — `import pkg from "../package.json"`; `bun --compile`
  inlines the JSON into the binary.
- (b) **Bun macro** — a `with { type: "macro" }` function that reads the manifest at
  bundle time and inlines only the version *literal*.
- (c) **`--define` at build** — `bun build --define VEND_VERSION='"0.1.0"'`, with a
  dev-mode fallback.
- (d) **Runtime fs read** — the `packaging.test.ts` idiom (`Bun.file(import.meta.dir
  /../package.json)`).

**Decision: (a) static JSON import.** Grounded directly in Research's experiments:

- It **typechecks under the project's exact current `tsconfig.json` with zero config
  change** (`tsc --noEmit` exit 0), and `pkg.version` is correctly typed `string`
  (the `string→number` probe errored). No `resolveJsonModule` addition, no global
  config blast radius.
- **`bun build --compile` provably embeds it**: the harness binary printed `0.1.0`
  from a dir with no `node_modules` and no `package.json`. This is the AC's
  compiled-binary clause, observed — not assumed.
- It is the **canonical, least-surprising** way a CLI bakes in its version; a reader
  sees `import pkg from "../package.json"; export const VERSION = pkg.version` and is
  done.

**Rejected:**
- (d) is the trap the ticket names: it works in dev and **fails post-compile** (no
  manifest beside the binary). Disqualified by the AC.
- (c) couples the embed to a `bun build` flag, but the compile is owned by a *later*
  ticket (T-062-02); T-061-02 must not depend downstream. It also needs a dev
  fallback, adding a second code path. More moving parts for no gain over (a).
- (b) works and embeds only the literal (slightly less in the binary), but it is the
  more exotic mechanism — import attributes + macro evaluation semantics that differ
  subtly across `bun run` / `bun test` / `bun build`. (a) achieves the same survival
  property with a plain import that every contributor already understands, and the
  ~few extra bytes of an inlined manifest object in a 57 MB binary are immaterial.
  Kept on the shelf as the fallback if (a) ever regresses.

---

## Decision 2 — Module boundary: a dedicated `src/version.ts`

**Options**
- (a) New `src/version.ts` that owns the JSON import and exports `VERSION: string`.
- (b) Import the JSON **directly inside `cli.ts`** and export `VERSION` from there.

**Decision: (a) a dedicated `src/version.ts`.** Two grounded reasons:

1. **Cheap, BAML-free compile target for the test.** The AC's compiled-binary
   assertion needs to `bun build --compile` *something* that imports the embed.
   Compiling `cli.ts` drags in the whole reachable graph including the BAML native
   addon (~108 MB, slow — Research §test terrain). A standalone `version.ts` has
   **no heavy deps**, so the test compiles a tiny harness around it in ~0.08s. The
   module under test is the *same* one `cli.ts` consumes, so the embed path is
   production-identical.
2. **Single, named home for the embed.** One module owns "where the version comes
   from"; `cli.ts` and the tests import a stable `VERSION` symbol. Mirrors the
   project's one-concern-per-module habit.

`version.ts` is pure and trivial (no BAML), so `cli.ts` can import it **statically**
at the top (unlike the lazy `await import` used for heavy dispatch deps) — and
`version.test.ts` / `cli.test.ts` import `VERSION` freely without touching the BAML
addon.

---

## Decision 3 — Surface and parse shape

`vend --version` is a flag-style invocation, not a sub-verb with positionals.

**Spelling.** Support **`--version`** (the AC's literal). On `-v`: rejected — `-v`
conventionally means *verbose* and would be a latent collision; the codebase has no
short-flag precedent. Add only what the AC asks; `-v` can come later if wanted.

**Where it is intercepted.** Add, near the **top** of `parseArgs` (before the verb
table), `if (argv[0] === "--version") return { cmd: "version" }`. Placed first so the
token never reaches `parseSelectOrBrowse` (which today turns it into `unknown
command: --version`). It **short-circuits**: trailing tokens after `--version` are
ignored (standard `--version` behavior — the flag wins).

**Union + parser.** Add `| { readonly cmd: "version" }` to `ParsedCommand`. No
dedicated `parseVersionArgs` is warranted — like the no-arg `shelf`/`doctor` it
carries no fields; the inline return in `parseArgs` is the whole parse. (Contrast:
`shelf`/`doctor` route to a one-line `parse*Args` only to reject *extra* args; a
`--version` short-circuit deliberately tolerates extra tokens, so an inline return
is the honest shape.)

**Dispatch arm.** `if (parsed.cmd === "version") { process.stdout.write(
`${VERSION}\n`); process.exit(0); }` near the top of the `import.meta.main` block,
using the statically-imported `VERSION`. Prints the bare semver + newline to
**stdout**, exit **0** (a successful query, like `shelf`/`doctor`'s readouts).

**USAGE.** Add a `vend --version` line to the banner for discoverability.

---

## Decision 4 — Test strategy

The AC names two obligations; mirror them as two tests.

**(A) printed value == manifest version (pure/unit).** Import `VERSION` from
`version.ts`; read the manifest at runtime with the `packaging.test.ts` idiom
(`Bun.file(join(import.meta.dir, "..", "package.json"))`); assert `VERSION ===
pkg.version` and that it matches `^\d+\.\d+\.\d+$` and `!== "0.0.0"`. Plus a pure
parse assertion: `parseArgs(["--version"])` deep-equals `{ cmd: "version" }`
(belongs with the other `parseArgs` cases, but co-locating in `version.test.ts`
keeps the surface's proof in one file — see Structure).

**(B) resolves from a compiled binary with no `node_modules` (integration).** Write
a temp harness `import { VERSION } from "<abs>/src/version.ts"; console.log(VERSION)`
to a scratch path, `bun build --compile` it to a temp binary, run the binary **with
`cwd` set to an empty temp dir that has no `node_modules` and no `package.json`**,
and assert its stdout trims to `VERSION`. This exercises the exact embed mechanism
the shipped CLI uses, proving survival without the BAML-weight of compiling `cli.ts`.

Why a harness and not `cli.ts`: per House pattern the `import.meta.main` dispatch is
the *thin untested shell*; the **risky, testable** unit is the embed in `version.ts`,
which the harness imports verbatim. Compiling `cli.ts` would test the same embed at
~108 MB/slow cost plus pull BAML into the gate — net negative.

The compile test spawns `bun build` and writes ~57 MB to a temp dir; it cleans up
after itself and is the only slow test added (~0.1s compile). Acceptable for the
gate, and consistent with the codebase's existing shell-out/temp-dir tests.

---

## The shape of the change (preview; Structure has the blueprint)

- **New `src/version.ts`** — `import pkg from "../package.json"; export const
  VERSION: string = pkg.version;`
- **`src/cli.ts`** — static `import { VERSION } from "./version.ts"`; a `version`
  union member; a top-of-`parseArgs` interception; a dispatch arm; a USAGE line.
- **New `src/version.test.ts`** — the (A) unit + parse assertions and the (B)
  compile-and-run integration test.

## Out of scope (deferred, by design)

- The actual `bun build --compile` release wiring, tarball, sha, and the matrix →
  **T-062-02 / T-062-03** (this ticket only guarantees the value *survives* such a
  compile).
- `-v` short flag, `--help`, or any other CLI surface.
- Fixing the 8 pre-existing live-board smoke failures (transient board data;
  unrelated — Research §gate baseline).

## Verification intent

`bun run check` green (no *new* failures beyond the 8 pre-existing board ones); the
two new tests pass; a manual `bun run src/cli.ts --version` prints `0.1.0`. Detailed
sequencing in Plan.
