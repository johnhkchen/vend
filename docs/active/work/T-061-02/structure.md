# T-061-02 — Structure

_Phase: Structure. The shape of the change — files, boundaries, ordering. Not code._

## Files touched

| File | Action | Why |
|------|--------|-----|
| `src/version.ts` | **create** | Owns the build-embedded semver: `import pkg from "../package.json"; export const VERSION`. The single, BAML-free home for "where the version comes from" (Design 1+2). |
| `src/cli.ts` | modify | Wire the `--version` surface: static import of `VERSION`, a `version` union member, a parse interception, a dispatch arm, a USAGE line (Design 3). |
| `src/version.test.ts` | **create** | Lock the AC: printed value == manifest, parse shape, and survival from a compiled binary with no `node_modules` (Design 4). |

No files deleted. No `tsconfig.json` change (the JSON import typechecks as-is —
Research). No `package.json` change (T-061-01 already set the value).

---

## `src/version.ts` — new module (the embed)

**Public interface:** one named export, `VERSION: string`.

**Body (blueprint, not final code):**
```
import pkg from "../package.json";
/** The package.json semver, EMBEDDED AT BUILD. `bun build --compile` inlines the
 *  imported JSON into the standalone binary, so this is correct post-compile where a
 *  runtime package.json read would fail (no manifest beside the binary). T-061-02. */
export const VERSION: string = pkg.version;
```

**Boundaries / contracts:**
- Pure, no side effects, **no heavy deps** — importable by the compile-harness test
  without pulling BAML.
- `pkg.version` is typed `string` under the current tsconfig (Research-confirmed), so
  the annotation `: string` is honest, not a cast.
- `../package.json` resolves from `src/` to repo root (one level up), matching the
  `packaging.test.ts` `".."` convention.

---

## `src/cli.ts` — five precise edits

All additive; no existing export, signature, or logic changes.

1. **Static import** — after the existing `import type` lines (≈line 16), add:
   `import { VERSION } from "./version.ts";`
   A *value* import (not `import type`), placed with the other top imports. It is
   cheap and BAML-free, so it does not violate the "keep heavy deps off the
   pure-parse path" rule that motivates the lazy `await import`s in dispatch.

2. **Union member** — in `ParsedCommand` (lines 44–116), add a trivial arm:
   `| { readonly cmd: "version" }`
   Placed near the other no-field verbs (`shelf` / `doctor`) for locality.

3. **Parse interception** — at the **top** of `parseArgs`, before the `argv.length
   === 0` browse check is fine, but **after** it is cleaner; the firm rule is *before
   the verb table and before `parseSelectOrBrowse`*. Add:
   `if (argv[0] === "--version") return { cmd: "version" };`
   This stops `--version` from reaching `parseSelectOrBrowse` (which would emit
   `unknown command: --version`). Short-circuits — trailing tokens ignored.

4. **Dispatch arm** — inside `if (import.meta.main)`, near the top (alongside the
   other early, no-effect readouts), add:
   ```
   if (parsed.cmd === "version") {
     process.stdout.write(`${VERSION}\n`);
     process.exit(0);
   }
   ```
   Bare semver + newline to **stdout**, exit **0**. No lazy import (VERSION is
   already statically in scope).

5. **USAGE line** — in the `USAGE` template (lines 18–31), add a row:
   `"       vend --version"`
   Placed at the end (a global flag, not a sub-verb), keeping column alignment.

**Boundary respected:** no change to any `parse*Args`, no change to the budget
parser, no new dependency. The discriminated-union exhaustiveness still holds —
every `parsed.cmd` arm in dispatch remains, plus the new `version` arm.

---

## `src/version.test.ts` — new test (locks the AC)

**Public interface:** none (a `bun:test` file, discovered by `bun test`).

**Internal organization (blueprint):**

1. **Manifest read at runtime** — `const pkg = JSON.parse(await Bun.file(join(
   import.meta.dir, "..", "package.json")).text())`, the `packaging.test.ts` idiom
   (no JSON import in the *test*, to keep the test's own resolution trivial).

2. **Unit — value equals manifest (AC clause 1):**
   - `expect(VERSION).toBe(pkg.version)`
   - `expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)` and `not.toBe("0.0.0")` (guards the
     "real semver" intent even if the manifest regresses).

3. **Pure — parse shape:** `expect(parseArgs(["--version"])).toEqual({ cmd:
   "version" })`, and a negative guard that a bare unknown flag still differs (sanity
   that the interception is specific to `--version`).

4. **Integration — compiled-binary survival (AC clause 2):**
   - Resolve an absolute path to `src/version.ts`.
   - Write a temp harness file (under a `bun:test`-created temp dir, e.g. via
     `fs.mkdtemp`) containing
     `import { VERSION } from "<abs>/src/version.ts"; console.log(VERSION);`
   - `Bun.spawn`/`spawnSync` `bun build --compile <harness> --outfile <tmp>/vbin`;
     assert exit 0.
   - Run `<tmp>/vbin` with **`cwd` = a separate empty temp dir** (no `node_modules`,
     no `package.json`); assert `stdout.trim() === VERSION`.
   - Clean up the temp dir(s) in a `finally` / afterAll.

   This is the only slow test (~0.1s compile, ~57 MB temp binary). It proves the
   embed survives compile — the property a pure unit test cannot reach.

**Why its own file** (not appended to `cli.test.ts` or `packaging.test.ts`):
`cli.test.ts` is deliberately pure (imports only parse helpers, never spawns);
adding a compile-and-run test there would break that file's "never touches the
runner/BAML" contract stated in its header. `packaging.test.ts` is scoped to
*manifest* invariants (T-061-01). The version *surface* is a distinct concern →
its own named file, matching the one-concern-per-file layout.

---

## Ordering of changes (atomic-commit friendly)

1. Create `src/version.ts` (the embed) — self-contained, typechecks alone.
2. Wire `src/cli.ts` (import + union + parse + dispatch + USAGE).
3. Create `src/version.test.ts` (locks 1 & 2, incl. the compile test).
4. `bun run check` — green except the 8 pre-existing board failures; the new tests
   pass and the fail count does not rise.
5. Manual smoke: `bun run src/cli.ts --version` → `0.1.0`.

Steps 1–3 are one logical change; can land as a single commit, or 1+2 then 3 if a
finer trail is wanted. Plan sequences this.

## Risk surface & containment

- **Embed regresses under a future Bun** → the compile-and-run test (step 4) catches
  it directly; it is the canary for the whole ticket.
- **`--version` shadowed by another parse path** → the parse interception is placed
  before the verb table; the pure `parseArgs(["--version"])` test pins it.
- **Test slowness/flake from `bun build`** → single small harness, BAML-free,
  temp-dir isolated with cleanup; ~0.1s, in line with existing shell-out tests.
- **Over-reach into T-062-02 (release/compile wiring)** → contained: this ticket
  adds *no* build script, CI job, or `package.json` change; it only guarantees the
  value survives whatever compile T-062-02 runs.
