# T-002-01-02 — Structure: test-gate-subclass-and-router

*The blueprint — file-level changes, boundaries, ordering. Not code; the shape.*

## File manifest

All changes confined to `/ci`. **Zero** app files (`/src`, root `package.json`,
root `tsconfig.json`, root `.gitignore`) created, modified, or deleted.

### Created

```
ci/src/test.ts        The `Test` sub-class — Bun container, mounts source, invokes
                      `bun run check:test`. The ONLY new logic-bearing file. ~40 LOC.
```

### Modified

```
ci/src/index.ts       Add one @func() `test(): Test` to the router, importing Test
                      from "./test". Header comment updated: test() is now wired.
                      Nothing else changes. Router stays thin.
```

### Generated, NOT committed (codegen artifact, gitignored)

```
ci/sdk/**             Dagger TS client. Produced by one deliberate `dagger develop`
                      at pinned v0.21.4 so the module compiles in its own toolchain
                      (AC4). Gitignored (`/sdk`) → never enters the commit.
ci/node_modules/**    install artifact if develop/install creates it — gitignored.
```

### Deliberately NOT created

- No `*.test.ts` under `/ci` (nothing to unit-test; would risk app `bun test`
  collection — a boundary violation). See Plan's testing strategy.
- No `lint.ts`/`typecheck.ts`/`consistency.ts` (later gates; over-build).

### Must remain unchanged (assert by diff)

- `ci/dagger.json` — `engineVersion: "v0.21.4"`, `source` omitted. If
  `dagger develop` mutates it → andon (revert/surface).
- `ci/package.json`, `ci/tsconfig.json`, `ci/.gitignore`, `ci/.gitattributes`.
- All app-side files.

## File-by-file specification

### `ci/src/test.ts` (new)

- **Imports:** `dag`, `object`, `func`, `argument`, `Directory` from
  `@dagger.io/dagger`. (`dag` is the client entrypoint; `argument` carries
  `defaultPath`/`ignore`.)
- **Header comment** stating: the Central Rule (invokes, never defines); that
  `bun install` + `bun run baml:gen` are *prep* (tests import the gitignored,
  generated `baml_client/`), the check itself is exactly `bun run check:test`.
- **Class:** `@object() export class Test`.
- **One method** `@func() async run(source): Promise<string>`:
  - `source` carries `@argument({ defaultPath: "/", ignore: ["**/node_modules",
    "baml_client", ".git"] })`.
  - Body — a single Dagger container chain:
    ```
    dag.container()
      .from("oven/bun:1.3.9-slim")
      .withMountedDirectory("/app", source)
      .withWorkdir("/app")
      .withExec(["bun", "install", "--frozen-lockfile"])
      .withExec(["bun", "run", "baml:gen"])
      .withExec(["bun", "run", "check:test"])
      .stdout()
    ```
  - Returns the suite's stdout. A non-zero `check:test` makes `withExec` throw →
    the gate fails. (That *can-fail* property is **proven** by T-003, not here.)
- **No app import**, no check assertions inlined — trigger + report only.

### `ci/src/index.ts` (modified)

- Add `import { Test } from "./test"`.
- Keep `import { object, func } from "@dagger.io/dagger"` (add `func`).
- Inside `class Ci`, add exactly:
  ```ts
  /** Structural gate: the app test suite, run as independent container inspection. */
  @func()
  test(): Test {
    return new Test()
  }
  ```
- Update the header note: `test()` (T-002-01-02) is now wired and delegates to
  `src/test.ts`; the next gates follow the identical sub-object shape. **Nothing
  else** — no `lint`/`typecheck` stubs.
- Net: `index.ts` gains one import and one 3-line method. Still a thin router.

## Module boundary (unchanged invariant, now exercised by one gate)

```
   app (Bun, repo root)                 /ci (Node Dagger module)
   ────────────────────                 ────────────────────────
   package.json: check:test  ◀───────── Test.run() runs container →
   (the ONLY contract surface)          `bun run check:test`  (a string, not an import)
   src/**, baml_src/**                  src/index.ts  Ci.test(): Test   (thin router)
   baml_client/ (gen, gitignored)       src/test.ts   Test.run(source)  (the gate)
                                         tsconfig paths -> ./sdk  (generated, gitignored)

   CONTRACT  = `bun run check:test` command string only
   FORBIDDEN = /ci importing app source · app importing /ci · widening app tsconfig
             · adding @dagger.io/dagger to any package.json deps
```

## Ordering of changes

1. **Write `ci/src/test.ts`** (the gate) and **edit `ci/src/index.ts`** (route it).
   These are the deliverable; author them first so codegen/compile validates the
   real code.
2. **Generate `sdk/`** — one deliberate `dagger develop` at the pin (Decision 2),
   with the git snapshot/andon guard.
3. **Compile in the `/ci` toolchain** — `tsc --noEmit` against `ci/tsconfig.json`
   (install `typescript` in `/ci` if needed). Must be green (AC4).
4. **Prove the app build untouched** — root `bun run check:typecheck` and
   `bun run check:test` still green (229), `git status` shows only `ci/src/*` +
   artifacts.
5. **Commit** `ci/src/test.ts` + `ci/src/index.ts` (sdk/ excluded by gitignore).

## Interfaces touched

- **`/ci` public surface added:** `Ci.test()` → `Test`; `Test.run(source)`. From
  the CLI: `dagger call test run [--source=.]` (exercised by T-003).
- **App public surface:** unchanged. No new scripts, no tsconfig/package edits.
- **Down-DAG:** T-003 consumes `dagger call test run` to prove agreement +
  can-fail; the same `bun run check:test` is what the play will invoke as andon.
