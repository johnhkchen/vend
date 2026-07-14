# T-062-02 — Structure

_Phase: Structure. The file-level blueprint — what is created/modified, module boundaries,
public interfaces, ordering. Not code._

## File inventory

| File | Action | Role |
|------|--------|------|
| `src/release/compile-core.ts` | **create** | Pure: parse the pin, build the `bun build` argv. |
| `src/release/compile-core.test.ts` | **create** | Unit tests for the pure core + live-pin drift guard. |
| `src/release/compile.ts` | **create** | Impure `import.meta.main` shell: read pin → spawn `bun build --compile` → exit. |
| `src/release/compile.smoke.test.ts` | **create** | The AC proof: compile real `cli.ts`, run `--version` + `doctor` from an empty dir. |
| `package.json` | **modify** | Add `"compile": "bun run src/release/compile.ts"`. |
| `Justfile` | **modify** | Add a `compile` recipe (the documented invocation surface). |
| `.github/release-target.env` | **read only** | The SSOT pin (T-062-01) — consumed, never edited. |
| `src/cli.ts`, `src/version.ts` | **read only** | The compile entry + the version embed (T-061-02) — unchanged. |

No source is deleted. No ticket frontmatter is touched (Lisa advances phases).

## Module boundaries & public interfaces

### `src/release/compile-core.ts` (pure, no I/O, no BAML)

```ts
/** The pin keys this ticket consumes. */
export const PIN_PATH = ".github/release-target.env";
export const REQUIRED_KEY = "BUN_COMPILE_TARGET";

/** Parse KEY=VALUE lines from the pin file text. Blank lines and `#` comments are
 *  ignored; the first `=` splits (so `=` inside a value is preserved); keys/values are
 *  trimmed. PURE — takes the file text, returns a plain record. */
export function parseReleaseTarget(envText: string): Record<string, string>;

/** Assemble the `bun build --compile` argv for one target. PURE — the SINGLE owner of
 *  the flag spelling, so the producer shell and the smoke test compile identically. */
export function compileArgv(opts: {
  readonly target: string;   // e.g. "bun-darwin-arm64" (from the pin)
  readonly entry: string;    // e.g. "src/cli.ts"
  readonly outfile: string;  // e.g. "dist/vend" (shell) or a temp path (test)
}): string[];

/** Read a required key or throw a typed, message-bearing error (no silent default —
 *  a missing pin must fail loud, never fall back to a hard-coded triple). PURE. */
export function requireKey(pin: Record<string, string>, key: string): string;
```

- Default entry/outfile constants (`CLI_ENTRY = "src/cli.ts"`, `DEFAULT_OUTFILE = "dist/vend"`)
  live here as named exports so the shell and any future caller share them.
- `requireKey` throwing (not defaulting) is the SSOT contract from the pin header.

### `src/release/compile.ts` (impure shell — mirrors `src/ci/*.ts`)

- Header comment in the `check-committed.ts` style: states it is the thin untested shell, the
  judgment lives in `compile-core.ts`, and documents exit codes.
- Behaviour under `import.meta.main`:
  1. Resolve repo root via `git rev-parse --show-toplevel` (so `bun run compile` is
     cwd-independent, like `check-committed.ts`); on failure → stderr + exit 2.
  2. Read `<root>/.github/release-target.env`; if absent → stderr fix-it + exit 2.
  3. `parseReleaseTarget` → `requireKey(pin, "BUN_COMPILE_TARGET")`; a missing key → exit 2.
  4. `outfile` = `<root>/dist/vend` (mkdir `dist/` if needed). `entry` = `<root>/src/cli.ts`.
  5. `Bun.spawnSync(compileArgv({target, entry, outfile}), { stdout:"inherit", stderr:"inherit" })`.
  6. On build exit 0 → print `compile: ok — wrote <outfile> (<size> MB)` to stdout, exit 0;
     else propagate the build's non-zero code.
- **Exit codes** (mirroring `cli.ts`/`check-committed.ts`): `0` success; `1` build failed;
  `2` environment/precondition error (no git, no pin, missing key).
- This file is **smoke-only**, not unit-tested (house rule for `import.meta.main` shells); its
  observable contract is covered by `compile.smoke.test.ts`.

### `src/release/compile.smoke.test.ts` (heavy integration — the AC)

- Imports `VERSION` from `../version.ts` and `compileArgv`, `CLI_ENTRY` from `./compile-core.ts`.
- Resolves the real `bun-darwin-arm64` target by reading + parsing the live pin (so the test
  compiles the *shipped* target, not a literal).
- One `describe` with the compile done once in `beforeAll` to a `mkdtemp` binary path; two
  assertions reuse it:
  - `--version`: `Bun.spawnSync([bin,"--version"], { cwd: emptyDir })` → exit 0, stdout trim
    `=== VERSION`, matches `/^\d+\.\d+\.\d+$/`, `!== "0.0.0"`.
  - `doctor`: `Bun.spawnSync([bin,"doctor"], { cwd: emptyDir })` → stdout **contains**
    `✓ BAML native addon loadable`. (No exit-code assert — non-flaky on lisa/claude-less CI.)
- `emptyDir` and the binary's temp dir are separate `mkdtemp`s, both `rm`-cleaned in
  `afterAll`/`finally`. `cwd: emptyDir` guarantees no `node_modules`/`package.json` is visible —
  the AC's no-checkout clause, enforced not assumed.
- 60 s test timeout for the compile-bearing case.

### `src/release/compile-core.test.ts` (pure units)

- `parseReleaseTarget`: a fixture blob with comments, blanks, a value containing `=` → asserts
  the parsed record; an empty/`#`-only blob → `{}`.
- `compileArgv`: exact vector for sample inputs (flag order + `--target=` spelling pinned).
- `requireKey`: present → value; absent → throws with the key in the message.
- **Live-pin drift guard:** read the real `.github/release-target.env`, parse, assert
  `BUN_COMPILE_TARGET === "bun-darwin-arm64"` — fails loudly if the pin ever changes shape.

## `package.json` change

Add to `scripts`, beside the existing `build`:

```json
"compile": "bun run src/release/compile.ts",
```

Not added to the `check` aggregate — `compile` is a release action, not a gate step (the gate is
`baml:gen && typecheck && test`; the smoke test already exercises the binary inside `test`).

## `Justfile` change

A `compile` recipe under the build group, in the file's documented style:

```
# Build the self-contained, single-file `vend` binary for the pinned target
# (.github/release-target.env). Output: dist/vend. (T-062-02)
compile:
    bun run src/release/compile.ts
```

## Ordering of changes (informs Plan)

1. `compile-core.ts` (pure; nothing depends on it yet) → its unit test.
2. `compile.ts` shell (depends on core) → `package.json` + `Justfile` wiring.
3. `compile.smoke.test.ts` (depends on the whole producer + the real `cli.ts`).
4. Run `bun run compile` to materialize `dist/vend`; manual empty-dir spot check; full gate.

## Boundaries respected

- **engine ⊥ play / SSOT:** the release tooling reads the pin by key — it owns no triple
  literal. Adding platforms later is a pin edit, not a code edit.
- **pure-core / thin-shell:** all judgment (parse, argv) is pure + unit-tested; the shell only
  does I/O and is smoke-covered, exactly as `src/ci/*` and `cli.ts` are.
- **no new runtime deps:** uses only `Bun.spawnSync`, `node:fs`/`node:path`, `bun build` — all
  already in the toolchain.
