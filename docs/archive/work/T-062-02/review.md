# T-062-02 — Review

**Ticket:** task — `compile-self-contained-binary` (E-061 / S-062), `depends_on: [T-061-02, T-062-01]`
**Outcome:** a repeatable producer compiles `src/cli.ts` into a single self-contained `vend`
binary for the pinned `bun-darwin-arm64` target; the binary bundles BAML's native addon and,
from a dir with no `node_modules`/checkout, runs `vend --version` (real semver) and proves the
addon loads — all observed, and locked behind a gate test.

## What changed

**Created (owned by this ticket):**

| File | Role |
|------|------|
| `src/release/compile-core.ts` | Pure core: `parseReleaseTarget`, `requireKey` (throws on missing — SSOT), `compileArgv` (the single owner of the `bun build` flag vector), shared constants. |
| `src/release/compile-core.test.ts` | 5 unit tests + a **live-pin drift guard**. Addon-free, fast. |
| `src/release/compile.ts` | Impure `import.meta.main` shell: read pin → spawn `bun build --compile` → exit (0/1/2). The `bun run compile` producer. |
| `src/release/compile.smoke.test.ts` | The AC, observed: compile real `cli.ts`, run `--version` + `doctor` from an empty dir. Also the addon-embedding **canary**. |

**Modified:**

| File | Change |
|------|--------|
| `package.json` | +`"compile": "bun run src/release/compile.ts"` (one additive scripts line). |
| `justfile` | +`compile` recipe (the documented invocation surface). |

**Produced (gitignored):** `dist/vend` — the 103 MB self-contained binary.

No source deleted. No ticket frontmatter touched (Lisa advances phases).

## Acceptance criterion — assessment

> On a directory with no node_modules/checkout, the compiled binary runs `vend --version`
> (real semver) and exercises a BAML-backed path proving the native addon loads.

- **Single self-contained binary via `bun build --compile` for the pinned target** ✓ —
  `bun run compile` reads `BUN_COMPILE_TARGET=bun-darwin-arm64` from `.github/release-target.env`
  (by key, never a literal) and emits `dist/vend` (103 MB = ~57 MB bun runtime + 45 MB embedded
  `.node` addon; the epic's "~108 MB" was an upper bound).
- **Runs `vend --version` (real semver) from a no-node_modules/no-checkout dir** ✓ —
  `compile.smoke.test.ts` runs the binary with `cwd:` a fresh empty `mkdtemp` dir; stdout trims
  to `VERSION` (`0.1.0`), matches `^\d+\.\d+\.\d+$`, `!== "0.0.0"`.
- **Exercises a BAML-backed path proving the native addon loads** ✓ — same empty dir, `vend
  doctor` prints `✓ BAML native addon loadable`. That line is the app's own probe: it
  `import`s `@boundaryml/baml` and asserts `BamlRuntime` is a function — if the `.node` had
  failed to dlopen the import throws and the line reds. Green ⇒ the native addon loaded from
  inside the single-file binary.

**Key finding:** the plain `bun build --compile` auto-embeds the NAPI-RS `.node` addon and its
loader resolves it at runtime with **zero glue** — no `NAPI_RS_NATIVE_LIBRARY_PATH`, no sidecar,
no extract-on-boot. The ticket's main risk (addon embedding) was retired empirically before any
code was written (Research §Decisive experiment).

## Test coverage

| Obligation | Test | Result |
|-----------|------|--------|
| pin read by key; missing key fails loud | `compile-core.test.ts` — `parseReleaseTarget`/`requireKey` | ✓ |
| build command stable/correct | `compile-core.test.ts` — `compileArgv` exact vector | ✓ |
| live pin still pins arm64-mac | `compile-core.test.ts` — drift guard | ✓ |
| `--version` real semver from empty dir | `compile.smoke.test.ts` — version case | ✓ |
| BAML native addon loads from empty dir | `compile.smoke.test.ts` — doctor case | ✓ |
| producer wired & usable | `bun run compile` → `dist/vend` (manual) | ✓ |

New tests: **7 pass** (5 core + 2 smoke). The producer shell (`compile.ts`) is smoke-only, not
unit-tested — the house rule for `import.meta.main` shells (cf. `src/ci/*.ts`, `cli.ts`); its
observable contract is the smoke test.

**Coverage gaps (acknowledged):**
- The smoke test exercises only the **arm64-mac** target (the MVP pin). The 4-target matrix is
  out of scope (BAML cross-compile risk) — a later epic.
- `compile.ts`'s precondition error arms (no git / no pin / missing key, exit 2) are not
  separately tested — they are the thin-shell I/O the house rule leaves to smoke coverage, and
  the judgment they wrap (`requireKey`) IS unit-tested.

## Open concerns / limitations (for the human reviewer)

1. **Gate is red — but not from this ticket.** `bun test` → 1365 pass / **9 fail**. None are in
   files T-062-02 authored:
   - **7** = the pre-existing graph-corruption cascade (stories `S-062..S-065` reference
     not-yet-minted epics `E-062..E-065`): `loadWorkGraph` live smoke, `T-021-05/06/08`,
     `one-way authority` ×2, `writeBoardSvg` ×2. Documented in T-062-01's review as the same
     baseline.
   - **1** = `runInit — template overlay (T-058-01)` — a **sibling Lisa thread's** in-flight
     change to `src/init/` (shown as `M src/init/init-core.{ts,test.ts}` in the shared tree).
     This is the only delta vs T-062-01's "8" baseline, and it is not mine.
   Stated honestly, not laundered: my 7 new tests are green; I introduce **zero** new failures.
2. **No CI run / no Bun-version pin enforced here.** The compile worked locally on bun `1.3.8`
   (one patch below the pinned `BUN_VERSION=1.3.9`). Enforcing the floor on an arm64 CI runner
   and watching Actions go green is **T-062-03**'s job (release CI), as is tarball/sha/release.
3. **No git commit performed (deviation).** The working tree is shared with concurrent threads
   (`package.json`, `src/cli.ts`, `justfile`, `src/init/*` carry *other* threads' uncommitted
   work); a clean own-files-only commit of the shared `package.json` hunk isn't safely separable.
   Per the stop-after-review instruction and the RDSPI file-lock commit-serialization model,
   commits are deferred to Lisa. All of this ticket's own files are isolated and gate-verified.
4. **Addon-embedding depends on Bun behavior.** Decision 1 relies on Bun auto-embedding the
   `.node`. If a future Bun/BAML regresses this, the smoke test's `doctor` assertion reds and the
   gate catches it (the canary). The fallback (`NAPI_RS_NATIVE_LIBRARY_PATH` sidecar) is recorded
   in `design.md` §Decision 1, on the shelf.

## Handoff

T-062-03 (release CI / tarball / sha) should call the **same** producer (`bun run compile` or
`compileArgv` from `compile-core.ts`) so the released binary is byte-built like the tested one,
read `RELEASE_ASSET_TRIPLE`/`RELEASE_TARBALL` from the pin, pin bun to `BUN_VERSION` on a
`macos-14` runner, and tarball/sha256 `dist/vend`. Adding platforms later is a pin edit
(append a target) plus a producer that loops the keys — no code in `compile-core.ts` needs the
literal.
