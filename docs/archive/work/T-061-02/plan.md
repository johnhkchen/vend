# T-061-02 — Plan

_Phase: Plan. Ordered, independently-verifiable steps + the testing strategy._

## Testing strategy (what proves the AC)

The AC has two clauses; each maps to a concrete assertion in `src/version.test.ts`:

| AC clause | Test | Kind |
|-----------|------|------|
| prints the package.json semver (not `0.0.0`) | `VERSION === pkg.version`, matches `^\d+\.\d+\.\d+$`, `!== "0.0.0"` | unit (pure) |
| `vend --version` is wired | `parseArgs(["--version"]) toEqual { cmd: "version" }` | unit (pure) |
| resolves from a compiled binary, no `node_modules` | compile a `version.ts` harness, run in an empty cwd, assert stdout == `VERSION` | integration |

Whole-suite gate: `bun run check` (baml:gen → tsc → bun test). Acceptance =
new tests green **and the fail count stays at the 8 pre-existing board failures**
(Research §gate baseline) — this ticket adds zero regressions.

Manual smoke (not automated, but in the trail): `bun run src/cli.ts --version`
prints `0.1.0`; `bun run src/cli.ts --version extra args` still prints `0.1.0`
(short-circuit); `bun run src/cli.ts frobnicate` still prints the usage error
(interception is specific).

---

## Step 1 — Create `src/version.ts` (the embed)

- Add the module: `import pkg from "../package.json"; export const VERSION: string =
  pkg.version;` with the doc-comment explaining the build-embed rationale.
- **Verify in isolation:** `bunx tsc --noEmit -p tsconfig.json` exits 0 (the import
  typechecks, `pkg.version` is `string`). Confirmed feasible in Research.
- Commit: `feat(cli): src/version.ts — build-embedded package semver (T-061-02)`.

Independently verifiable: typecheck passes; nothing imports it yet, so no other
behavior changes.

## Step 2 — Wire `--version` into `src/cli.ts`

Five edits (Structure §cli.ts), in this order so the file stays compiling between
edits where practical:
1. `import { VERSION } from "./version.ts";` (top, value import).
2. `| { readonly cmd: "version" }` in `ParsedCommand`.
3. `if (argv[0] === "--version") return { cmd: "version" };` at the top of
   `parseArgs`.
4. Dispatch arm printing `${VERSION}\n` to stdout, `process.exit(0)`.
5. `vend --version` line appended to `USAGE`.

- **Verify:** `bunx tsc --noEmit -p tsconfig.json` exits 0 (union exhaustiveness
  holds — the new `version` arm is handled). Manual: `bun run src/cli.ts --version`
  → `0.1.0`.
- Commit: `feat(cli): vend --version prints the embedded semver (T-061-02)`.

Independently verifiable: typecheck + the manual smoke before any test exists.

## Step 3 — Create `src/version.test.ts` (lock the AC)

- **Unit block:** read the manifest at runtime (`Bun.file(join(import.meta.dir,
  "..", "package.json"))`); assert `VERSION === pkg.version`, regex, `!== "0.0.0"`.
- **Parse block:** `expect(parseArgs(["--version"])).toEqual({ cmd: "version" })`;
  a negative guard (`parseArgs(["--nope"])` is a `usage` error, not `version`).
- **Integration block:** in a `try/finally` with a `fs.mkdtemp` scratch dir —
  - write `harness.ts`: `import { VERSION } from "<abs src/version.ts>"; console.log(
    VERSION);` (resolve the abs path via `join(import.meta.dir, "version.ts")`);
  - `bun build --compile <harness> --outfile <tmp>/vbin` via `Bun.spawnSync`; assert
    `exitCode === 0`;
  - run `<tmp>/vbin` via `Bun.spawnSync` with `cwd` set to a **second** empty temp
    dir (guaranteed no `node_modules`/`package.json`); assert `stdout.toString()
    .trim() === VERSION`;
  - `finally`: `rm -rf` the temp dirs.
- Give the compile/run test a generous `test(..., { timeout: 30_000 })` so a cold
  `bun build` cannot flake the gate.
- **Verify:** `bun test src/version.test.ts` all green.
- Commit: `test(cli): assert --version embeds + survives bun --compile (T-061-02)`.

Independently verifiable: the new test file passes on its own.

## Step 4 — Full gate + regression check

- Run `bun run check`. Expect: typecheck clean; `bun test` shows the **same 8**
  live-board failures and **no new ones**; the 3 new assertions pass.
- Diff the failure set against the Research baseline to confirm attribution (none in
  cli/packaging/version).
- If `tsc` unexpectedly rejects the JSON import in the full project context (it did
  not in the isolated Research run), **fallback**: switch `version.ts` to the Bun
  macro form (Design 1b) — a `with { type: "macro" }` reader that inlines the
  literal — which needs no `resolveJsonModule` either. (Not expected; documented as
  insurance.)

## Step 5 — Manual confirmation (recorded in progress.md)

- `bun run src/cli.ts --version` → `0.1.0`.
- Optional belt-and-suspenders: compile the harness by hand once and run it from
  `/tmp` to eyeball the no-`node_modules` path (the test already does this).

---

## Commit sequence (atomic)

1. `feat(cli): src/version.ts — build-embedded package semver (T-061-02)`
2. `feat(cli): vend --version prints the embedded semver (T-061-02)`
3. `test(cli): assert --version embeds + survives bun --compile (T-061-02)`

(Steps 1–2 may be squashed if a single change reads cleaner; the test lands
separately so the trail shows surface-then-proof.)

## Risks & mitigations (carried from Structure)

- **Compile test slow/flaky** → BAML-free harness, ~0.1s, 30 s timeout, temp-dir
  isolated with `finally` cleanup.
- **Embed mechanism regresses** → the integration test *is* the canary; it fails
  loudly if a future Bun stops bundling JSON into `--compile`.
- **Scope creep into T-062-x** → no build/CI/manifest changes in this ticket.

## Definition of done

- `src/version.ts`, the `cli.ts` wiring, and `src/version.test.ts` are committed.
- `bun run check` adds no new failures; the 3 new assertions pass.
- `vend --version` prints `0.1.0` in dev and (proven by test) from a compiled binary
  with no `node_modules`.
