# T-061-01 — Structure

_Phase: Structure. The shape of the change — files, boundaries, ordering. Not code._

## Files touched

| File | Action | Why |
|------|--------|-----|
| `package.json` | modify | Set `version`, drop `private`, add `bin.vend` (the AC). |
| `src/cli.ts` | modify | Prepend `#!/usr/bin/env bun` shebang so the `bin` target is genuinely executable (Design 3B). One added line; existing header preserved. |
| `src/packaging.test.ts` | **create** | Lock the three manifest invariants so the gate (`bun run check`) actively proves the AC and guards regression. |

No files deleted. No other files touched.

## `package.json` — exact field-level changes

Within the existing object, in place:
- `"version": "0.0.0"` → `"version": "0.1.0"`.
- Remove the line `"private": true,` entirely (key absent, not `false`).
- Insert a `bin` member: `"bin": { "vend": "./src/cli.ts" }`. Placement after
  `"type": "module"` and before `"engines"` — groups "how this package runs"
  fields. (JSON key order is cosmetic; chosen for readability.)

Everything else — `name`, `type`, `engines`, all `scripts`, `dependencies`,
`devDependencies` — is unchanged. Net: one value change, one deletion, one
addition. Trailing-comma/format kept valid JSON.

## `src/cli.ts` — shebang insertion

- New line 1: `#!/usr/bin/env bun`
- Old line 1 (`// The \`vend\` CLI entry point (T-002-03) — ...`) shifts to line 2,
  byte-for-byte unchanged; the whole header block follows intact.
- No export, signature, or logic change. Pure prepend.

Boundary respected: this does **not** add `--version` handling. That surface (and
embedding the semver for the compiled binary) is T-061-02, which depends on this
ticket. T-061-01 supplies the manifest value only.

## New test — `src/packaging.test.ts`

**Purpose:** make "and `bun run check` still passes" mean something — turn the AC's
manifest invariants into executed assertions. Additive, no runtime coupling.

**Public interface:** none — it is a `bun:test` file, discovered by `bun test`.
Exports nothing.

**Internal organization (blueprint, not code):**
1. Resolve the repo-root manifest **at runtime** (no JSON import — tsconfig does
   not enable `resolveJsonModule`, and a runtime read avoids any typecheck
   coupling). Idiom: `join(import.meta.dir, "..", "package.json")`, read via
   `Bun.file(...).text()`, `JSON.parse`. `src/` is one level under root, so `".."`
   is correct.
2. Assertions (one `test` block per invariant, or grouped under a `describe`):
   - **version is a real semver, not 0.0.0**: `version` is a string matching
     `^\d+\.\d+\.\d+$` and `!== "0.0.0"`.
   - **private is absent**: `"private" in pkg` is `false`.
   - **bin.vend resolves to the entrypoint**: `pkg.bin.vend === "./src/cli.ts"`
     **and** the file it points at exists on disk
     (`Bun.file(join(root, pkg.bin.vend)).exists()` is `true`). "Resolves" is
     proven, not just asserted as a string.

**Why a separate file** (not appended to `smoke.test.ts`): `smoke.test.ts` is the
scaffold's trivial gate; packaging invariants are a distinct concern and read
better as their own named file. Mirrors the project's one-concern-per-test-file
layout (`init-core.test.ts`, `committed-core.test.ts`, …).

**What this test deliberately does NOT assert:** anything about `vend --version`
runtime output (T-061-02's job), or npm-publish completeness fields. Keeping the
test scoped to T-061-01's AC prevents it from failing on work that belongs to the
dependent ticket.

## Ordering of changes

1. Edit `package.json` (the substance of the AC).
2. Add shebang to `src/cli.ts` (completes "bin actually runs").
3. Add `src/packaging.test.ts` (locks 1 & 2).
4. Run `bun run check` — must be green.
5. Sanity-run the entrypoint via the declared bin path to confirm it executes.

Steps 1–2 are independent; 3 verifies both; order 1→2→3 reads cleanly in one
commit. The whole change is small enough for a single atomic commit.

## Risk surface & containment

- **Gate breakage from the shebang:** ruled out in Research (tsc tolerates a
  leading shebang; no export changes → `cli.test.ts` unaffected).
- **Invalid JSON after edits:** contained by step 4 (typecheck/test won't even
  start parsing if `package.json` is malformed; `bun` would error) and by the new
  test parsing the manifest.
- **`bin` path drift:** the new test asserts the target file *exists*, so a future
  rename of `src/cli.ts` that forgets the manifest fails the gate — a feature.
- **Over-reach into T-061-02:** contained by explicit non-goals above; no
  `--version` code is added.
