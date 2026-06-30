# T-062-02 — Design

_Phase: Design. Enumerate options, weigh against Research, decide with rationale._

## What must be true at the end (from AC)

A single self-contained `vend` binary, built via `bun build --compile` for the pinned target
(`bun-darwin-arm64`), that — from a dir with no `node_modules`/checkout — runs `vend --version`
(real semver) and exercises a BAML-backed path proving the native addon loads. Research proved
the **mechanism** works on the pinned target; Design's job is the **producer** (repeatable
build) and the **proof** (gate test), not addon-embedding machinery.

Four decisions: the **embed approach**, the **producer shape**, the **pin-reading core**, and
the **test strategy**.

---

## Decision 1 — Addon-embedding approach: rely on Bun's automatic `.node` embedding

**Options**
- (a) **Plain `bun build --compile src/cli.ts`** — let Bun embed the `.node` it discovers
  through the NAPI-RS `require('@boundaryml/baml-darwin-arm64')` indirection.
- (b) **Sidecar `.node` + `NAPI_RS_NATIVE_LIBRARY_PATH`** — ship the addon beside the binary and
  point the loader at it via env.
- (c) **Manual extract-on-boot** — embed the `.node` as a Bun asset, write it to a temp path at
  startup, set `NAPI_RS_NATIVE_LIBRARY_PATH` before the first BAML import.

**Decision: (a).** Research's decisive experiment showed the plain compile on the pinned target
produces a 103 MB binary that runs `--version` AND `doctor`'s `✓ BAML native addon loadable`
from an empty dir — the addon embeds and the loader finds it with **zero glue**. (a) is the
least-surprising, least-code path and is *observed working*, not assumed.

**Rejected:**
- (b) defeats "single self-contained binary" — it reintroduces a second file the AC's
  no-checkout clause forbids; only worth it if (a) failed, which it didn't.
- (c) is real complexity (asset embed + temp extraction + env ordering before any `import`) that
  (a) makes entirely unnecessary. Kept on the shelf as the fallback **only if** a future Bun/BAML
  version stops auto-embedding — a risk the gate test (Decision 4) will catch as a canary.

---

## Decision 2 — The producer: a thin `src/release/compile.ts` shell + `package.json` script

**Options**
- (a) **A `package.json` script with the literal flags** — `"compile": "bun build --compile
  --target=bun-darwin-arm64 src/cli.ts --outfile dist/vend"`.
- (b) **A TS script `src/release/compile.ts`** that reads the pin, builds the argv, spawns
  `bun build`, exits — wired as `"compile": "bun run src/release/compile.ts"`.

**Decision: (b).** The pin file's header is explicit: downstream tickets **"must reference keys
by name, not hard-code the literals."** (a) hard-codes `bun-darwin-arm64`, violating that and
guaranteeing drift the moment the pin changes. (b) reads `.github/release-target.env` and is the
exact `src/ci/*.ts` idiom already in the repo (thin `import.meta.main` shell, `Bun.spawnSync`,
documented exit codes, pure `*-core.ts` for judgment). It also gives T-062-03 (release CI) a
sibling home (`src/release/`) and a function to call.

**Why a new `src/release/` dir, not `src/ci/`:** `src/ci/` is the gate (`check:*`) family;
compiling a shippable artifact is a *release* concern, and T-062-03 (tarball/sha/release) is the
named next ticket. A `src/release/` namespace is the honest home for both.

**Output path:** `dist/vend` (already gitignored). Default lives in the shell; the core exposes
an `outfile` parameter so the test can target a temp path (Decision 4).

---

## Decision 3 — Pin-reading + argv as a pure `src/release/compile-core.ts`

The shell must (i) parse `KEY=VALUE` lines from `.github/release-target.env` and (ii) assemble
the `bun build` argv. Both are pure, deterministic, and the exact thing the `*-core.ts` split
exists for.

- `parseReleaseTarget(envText): Record<string,string>` — split on lines, ignore blanks and
  `#`-comments, split each on the first `=`, trim. (Mirrors the env-file shape the
  `release-target-check.yml` guard `cat`s into `$GITHUB_ENV`.)
- `compileArgv({ target, entry, outfile }): string[]` — returns
  `["bun","build","--compile",`--target=${target}`, entry, "--outfile", outfile]`. One place
  owns the flag spelling, so the producer and the test compile **identically** (no drift).

A missing required key (`BUN_COMPILE_TARGET`) is a typed error the shell surfaces as a non-zero
exit with a fix-it line — never a silent default to a hard-coded triple (that would defeat the
SSOT). Both functions are unit-tested addon-free.

---

## Decision 4 — Test strategy: one heavy compile smoke + the pure-core units

The AC is an integration claim ("the compiled binary runs … from a no-node_modules dir"), so it
can only be discharged by **actually compiling and running** the artifact.

**(A) The compile smoke — `src/release/compile.smoke.test.ts`.** Build the **real `src/cli.ts`**
(via `compileArgv`, the same path production uses) to a **temp** outfile, then from a freshly
`mkdtemp`'d empty dir with **no `node_modules`/`package.json`**:
- run `<bin> --version` → assert stdout trims to a `^\d+\.\d+\.\d+$` semver **equal to
  `VERSION`** and `!== "0.0.0"`, exit 0;
- run `<bin> doctor` → assert stdout **contains `✓ BAML native addon loadable`** (the
  PATH-independent BAML proof). Do **not** assert doctor's exit code — on a CI box without
  lisa/claude it is 1 though BAML still loaded (the `doctor-cli.smoke.test.ts` non-flaky
  invariant discipline).

This is the AC, observed. It is also the **canary** for Decision 1: if a future Bun/BAML stops
auto-embedding the addon, the `doctor` assertion reds and the gate catches it. Generous timeout
(60 s) so a cold compile (the addon read + 103 MB write) can't flake; it `mkdtemp`s and cleans up
after itself, the codebase's existing shell-out/temp-dir idiom.

**(B) Pure-core units — `src/release/compile-core.test.ts`.** `parseReleaseTarget` over a sample
env blob (comments/blanks ignored, keys mapped, `=` in values preserved); `compileArgv` returns
the exact flag vector; the real `.github/release-target.env` parses and yields
`BUN_COMPILE_TARGET=bun-darwin-arm64` (a drift-guard tying the test to the live pin).

**Why compile the whole `cli.ts` here when T-061-02 deliberately did not:** T-061-02's concern
was the *version embed*, cheaply proven with a BAML-free harness. THIS ticket's concern *is*
that the full graph — BAML addon included — compiles and self-loads. So the heavy compile is the
point, not avoidable cost. It is the only slow test added (~1–3 s cold); justified by being the
sole proof of the AC.

---

## The shape of the change (preview; Structure has the blueprint)

- **New `src/release/compile-core.ts`** — `parseReleaseTarget`, `compileArgv` (pure).
- **New `src/release/compile.ts`** — `import.meta.main` shell: read pin → parse → `compileArgv`
  → `Bun.spawnSync("bun build …")` → exit with build's code; documented exit codes.
- **New `src/release/compile-core.test.ts`** — pure-core units + live-pin drift guard.
- **New `src/release/compile.smoke.test.ts`** — the AC's compile-and-run integration proof.
- **`package.json`** — add `"compile": "bun run src/release/compile.ts"`.
- **`Justfile`** — add a `compile` recipe (the documented invocation surface) — low-cost,
  high-value for the dogfood.

## Out of scope (deferred, by design)

- Tarball / sha256 / GitHub release / the `vend-cli-aarch64-apple-darwin.tar.xz` asset →
  **T-062-03** (this ticket ends at "a proven self-contained binary exists").
- The 4-target matrix (BAML cross-compile risk) — a later epic.
- Installing a global `vend` on PATH / Homebrew formula — later in E-061.
- Fixing the ~8 pre-existing red tests (unrelated; Research §Constraints).

## Verification intent

`bun run compile` produces `dist/vend`; `dist/vend --version` and `dist/vend doctor` work from
an empty dir; the new smoke + core tests pass; no *new* gate failures beyond the pre-existing
~8. Detailed sequencing in Plan.
