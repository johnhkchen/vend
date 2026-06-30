# T-061-02 — Review

_Phase: Review. The handoff — what changed, test coverage, open concerns._

## What the ticket asked

`vend --version` must print the `package.json` semver (not `0.0.0`), **embedded at
build** so it survives a single-file compiled binary (a runtime manifest read is
unavailable post-compile). AC: a test asserts the printed value equals the manifest
version, and it still resolves from a compiled binary with no `node_modules`.

**Status: done.** `vend --version` → `0.1.0` in dev and (test-proven) from a
compiled binary in an empty cwd. Gate adds zero regressions.

## Files changed

| File | Action | Summary |
|------|--------|---------|
| `src/version.ts` | **new** (15 lines) | `import pkg from "../package.json"; export const VERSION: string = pkg.version`. The build-embedded semver, in its own BAML-free module so the compile test can target it cheaply. |
| `src/cli.ts` | modified (5 additive edits) | Static `import { VERSION }`; `version` union member; `--version` interception at the top of `parseArgs`; a dispatch arm printing `${VERSION}\n` / exit 0; a `vend --version` USAGE line. |
| `src/version.test.ts` | **new** (6 tests) | Embed-equals-manifest, pure parse (incl. short-circuit + negative guard), wired-CLI smoke, and the compiled-binary survival integration test. |

No `tsconfig.json` / `package.json` change. Nothing deleted.

## Key design choice (grounded, not assumed)

The embed mechanism is a **static JSON import**, chosen over a Bun macro, `--define`,
and a runtime fs read. Both viable survivors were tested against the real toolchain
in Research:
- `import pkg from "../package.json"` **typechecks under the project's exact
  tsconfig** (`tsc --noEmit` exit 0) with `pkg.version` correctly typed `string` (a
  `string→number` probe errored) — **no `resolveJsonModule` needed**.
- `bun build --compile` **provably inlines** the JSON: a harness binary printed
  `0.1.0` from a dir with no `node_modules` / no `package.json`.

So the simplest, most idiomatic mechanism is also the proven one. The macro form
(embeds only the literal) is documented as a fallback in `design.md` but was not
needed. A runtime fs read was rejected outright — it is the exact post-compile trap
the ticket names.

## Test coverage

**6 new tests, all passing.** Mapped to the AC:

| AC clause | Covered by | Kind |
|-----------|-----------|------|
| prints the manifest semver, not 0.0.0 | `VERSION === pkg.version` + regex + `!== "0.0.0"` | unit (pure) |
| `vend --version` is wired | `parseArgs(["--version"]) → { cmd: "version" }`; `bun run cli.ts --version` exits 0, stdout == VERSION | unit + CLI smoke |
| resolves from a compiled binary, no `node_modules` | compile a `version.ts` harness, run in an empty cwd, assert stdout == VERSION | integration |

Extra hardening beyond the AC minimum: `--version` short-circuit (trailing tokens
ignored) and a negative guard (an unknown flag is still a usage error, so the
interception is specific). The compiled-binary test is the **canary**: if a future
Bun stops inlining JSON into `--compile`, it fails loudly rather than the regression
slipping into a shipped binary.

**Coverage gaps (acknowledged, low-risk):**
- The compiled-binary test compiles a *harness around `version.ts`*, not the whole
  `cli.ts`. Rationale: `cli.ts` drags in BAML (~108 MB, slow), and the embed under
  test lives entirely in `version.ts` — the harness imports that module verbatim, so
  the embed path is production-identical. The *dispatch* of `--version` is instead
  covered by the dev-mode `bun run cli.ts --version` smoke. The one thing not
  directly exercised is `cli.ts`'s `--version` arm *inside a compiled binary* — but
  that arm is a 2-line `stdout.write` + `exit`, and both halves (the embed survival,
  the dispatch wiring) are each proven separately.
- No test asserts behavior on a host where `bun` is absent from PATH; consistent with
  the rest of the suite, which assumes the Bun toolchain.

## Gate result

- `bunx tsc --noEmit -p tsconfig.json` → exit 0.
- `bun test` → **1355 pass / 8 fail**. The 8 failures are **pre-existing** live-board
  smoke tests (`loadWorkGraph`, `writeBoardSvg`, `one-way authority`, `T-021-05/06/08`)
  failing on a transient dangling board reference (`story 'S-064' has no epic
  'E-064'`) — unrelated to this ticket, none in cli/packaging/version. Pass count rose
  by exactly the 6 added tests; fail count unchanged from the Research baseline.

## Open concerns / handoff notes

1. **Pre-existing board failures (not this ticket).** The 8 live-board failures
   indicate `docs/active/**` currently has a story (`S-064`) whose epic (`E-064`) is
   missing — a board-data inconsistency, mid-epic. Worth a separate look by whoever
   owns the board; it is **not** introduced or fixable here.
2. **Not committed.** The diff sits in the working tree on `main`, uncommitted
   (committing was not requested and the branch is the default). `progress.md` lists
   the intended atomic commit sequence for Lisa/human to apply.
3. **Single source of truth honored.** `VERSION` derives solely from `package.json`
   (which T-061-01 pinned to `0.1.0`); there is no second place to bump. A future
   release bump touches only the manifest, and the embed follows automatically.
4. **Forward link to E-061.** T-062-02 (`compile-self-contained-binary`) runs the
   real `bun build --compile`; this ticket guarantees `--version` survives it. No
   coupling was introduced to T-062-02's build flags — the embed is self-contained.

## Verdict

AC met and proven by test. The change is small, additive, type-safe, and adds no
regressions. Recommend landing as the commit sequence in `plan.md`.
