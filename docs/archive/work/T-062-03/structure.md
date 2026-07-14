# T-062-03 — Structure

The file-level blueprint. Mirrors T-062-02's `src/release/` shape (pure core + impure
shell + unit test + smoke test) and adds one workflow file. No code here — the shape.

## Files created

### 1. `src/release/release-core.ts` — pure packaging judgment (NEW)
The single owner of every release string/argv. No I/O, no `process`, no BAML. Imports
nothing from the runtime graph. Public surface:

```
export const SHA256SUMS = "sha256sums.txt";
export const TARBALL_KEY = "RELEASE_TARBALL";          // pin key the shell reads

export function tagToVersion(ref: string): string;     // strip one leading "v"
export function assertTagMatchesVersion(tag: string, version: string): void;  // throws on mismatch
export function tarArgv(o: { tarball: string; cwd: string; member: string }): string[];
export function sha256Line(hash: string, filename: string): string;           // `${hash}  ${filename}`
```

- `tagToVersion`: `s.startsWith("v") ? s.slice(1) : s`. Trims surrounding whitespace first.
- `assertTagMatchesVersion`: compares `tagToVersion(tag)` to `version`; on mismatch throws
  `Error("release tag <tag> (version <x>) does not match package version <version>")`.
- `tarArgv`: returns `["tar", "-c", "-J", "-f", o.tarball, "-C", o.cwd, o.member]`. The
  `-C cwd member` form archives the bare `member` (e.g. `vend`) at the root.
- `sha256Line`: returns `` `${hash}  ${filename}` `` — exactly two spaces (the
  `shasum -c` / coreutils consumable format). No trailing newline (the shell adds it).

### 2. `src/release/package.ts` — impure release-packager shell (NEW)
Thin shell mirroring `compile.ts`. Reuses `compile-core.ts` constants
(`PIN_PATH`, `DEFAULT_OUTFILE`, `parseReleaseTarget`, `requireKey`) and
`release-core.ts`. Reads `VERSION` from `../version.ts`. Behavior, in order:

1. `git rev-parse --show-toplevel` → root; fail → `exit 2`.
2. Resolve `distDir = argv positional ?? join(root, "dist")`.
3. Read pin file (`join(root, PIN_PATH)`); missing → `exit 2`. Parse; `requireKey(pin,
   TARBALL_KEY)` → `tarball` (missing → `exit 2`).
4. Resolve `tag = flag --tag <v> ?? process.env.GITHUB_REF_NAME`. If set:
   `try { assertTagMatchesVersion(tag, VERSION) } catch → stderr + exit 1`.
5. `binary = join(distDir, basename(DEFAULT_OUTFILE))` (= `<distDir>/vend`). If not
   `await Bun.file(binary).exists()` → stderr "run `bun run compile` first" + `exit 2`.
6. `tarballPath = join(distDir, tarball)`. Run `tarArgv({ tarball: tarballPath, cwd:
   distDir, member: basename(binary) })` via `Bun.spawnSync` (inherit stderr). Nonzero →
   `exit 1`.
7. Read tarball bytes, `new Bun.CryptoHasher("sha256").update(bytes).digest("hex")`.
   Write `join(distDir, SHA256SUMS)` = `sha256Line(hash, tarball) + "\n"`.
8. stdout: asset name, size, sha; `exit 0`.

Exit-code vocabulary identical to `compile.ts`: `0` ok, `1` operation failed (tar / tag
mismatch), `2` precondition (not a repo / no pin / no key / no binary).

`import.meta.main` guard so importing the module in a test is side-effect-free (compile.ts
idiom). Pure helpers for argv flag parsing kept trivial/inline.

### 3. `src/release/release-core.test.ts` — pure-core unit tests (NEW)
Fast, addon-free. Covers:
- `tagToVersion`: `"v0.1.0"→"0.1.0"`, `"0.1.0"→"0.1.0"`, `" v1.2.3 "→"1.2.3"`,
  `"vvv"→"vv"` (only one `v` stripped).
- `assertTagMatchesVersion`: matching pair returns; mismatch throws naming both;
  `"v0.1.0"` vs `"0.1.0"` matches (the `v` is normalized).
- `tarArgv`: exact vector `["tar","-c","-J","-f",<tarball>,"-C",<cwd>,<member>]`.
- `sha256Line`: exactly two spaces; round-trips `parse`-free (`split(/ {2}/)`).
- **Live-pin drift guard**: read `.github/release-target.env`, assert
  `requireKey(pin, "RELEASE_TARBALL") === "vend-cli-aarch64-apple-darwin.tar.xz"` and that
  it equals `${RELEASE_TARBALL_PREFIX}-${RELEASE_ASSET_TRIPLE}.tar.xz`. Reds in the gate if
  the pin shifts shape — same discipline as `compile-core.test.ts`.

### 4. `src/release/package.smoke.test.ts` — integration round-trip (NEW)
Discharges the AC's integrity substance **without** a real release or a 90 s compile:
- `beforeAll`: `mkdtemp` a dist dir; write a fixture `vend` file (a few KB of bytes) into
  it — stands in for the compiled binary (we are testing *packaging*, not compiling; the
  real compile is already proven by `compile.smoke.test.ts`).
- Run `bun run src/release/package.ts <distDir>` (no tag) via `Bun.spawnSync`. Assert
  exit 0.
- Assert `<distDir>/vend-cli-aarch64-apple-darwin.tar.xz` exists and is non-empty.
- Assert `<distDir>/sha256sums.txt` exists and matches `^[0-9a-f]{64}  vend-cli-…tar.xz$`.
- **Re-verify (the AC):** `Bun.spawnSync(["shasum","-a","256","-c","sha256sums.txt"],
  { cwd: distDir })` exits 0 and prints `…: OK`.
- **Negative:** truncate/append a byte to the tarball, re-run `shasum -c`, assert it now
  exits nonzero (`FAILED`) — proving the sum is bound to the exact bytes.
- A second test: run with a **mismatched** `--tag v9.9.9`, assert exit 1 and a stderr
  message naming the version — proving the tag guard fires.
- `afterAll`: `rm` the temp dir.

### 5. `.github/workflows/release.yml` — the release pipeline (NEW)
Single job, `macos-14`, `permissions: contents: write`. Steps as enumerated in design.md:
checkout → load pin into `$GITHUB_ENV` → assert runner == `CI_RUNNER` → `setup-bun@v2`
(`bun-version: ${{ env.BUN_VERSION }}`) → `bun install` → `bun run compile` → `bun run
src/release/package.ts` → `gh release create "$GITHUB_REF_NAME" --title "$GITHUB_REF_NAME"
--generate-notes "dist/$RELEASE_TARBALL" "dist/sha256sums.txt"` with `GH_TOKEN:
${{ github.token }}`.

## Files modified

### 6. `package.json` — add a script (MODIFIED)
Add `"package": "bun run src/release/package.ts"` beside `"compile"`, so the workflow and
local use share one entry point (and `just` can wrap it if desired). One-line addition.

### 7. `justfile` — add a `package` recipe (MODIFIED, optional-but-consistent)
Mirror the existing `compile:` recipe with a `package:` recipe (`bun run
src/release/package.ts`) and a `release-local:` convenience that chains `compile` then
`package`. Keeps the local story symmetric with CI.

## Files NOT touched (and why)

- `.github/workflows/release-target-check.yml` — its header reserves the release job for a
  *separate* file; left intact as the standing guard.
- `.github/release-target.env` — SSOT pin; read-only to this ticket. No new keys needed
  (every key already exists).
- `src/release/compile*.ts` — reused as-is, not modified.

## Ordering of changes

`release-core.ts` (pure, no deps) → its unit test → `package.ts` (depends on core +
compile-core + version) → its smoke test → `package.json`/`justfile` wiring →
`release.yml`. Each step is independently green under `bun run check` except the workflow
(YAML, not exercised by the gate — validated by `actionlint`/inspection).

## Public-interface summary

| Symbol | Module | Kind |
|--------|--------|------|
| `SHA256SUMS`, `TARBALL_KEY` | release-core | const |
| `tagToVersion`, `assertTagMatchesVersion`, `tarArgv`, `sha256Line` | release-core | pure fn |
| `package.ts` | release shell | CLI (`bun run … [distDir] [--tag v]`) |
| `package` npm script / `just package` | wiring | entry point |
