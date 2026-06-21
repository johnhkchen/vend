# T-040-03 — Structure: file-level changes

The blueprint. Two source files modified, two test files extended. No new files, no deletions.

## Files modified

### 1. `src/init/init-effect.ts` — add the `runInit` composition

**Add to the import line** (already `import { mkdir, stat, writeFile } from "node:fs/promises";`):
extend with `readdir`.

**Add `isLisaProject` to the pure-core import** (currently
`import { planInit, SCAFFOLD_MANIFEST, type ScaffoldEntry } from "./init-core.ts";`).

**New exported type — `InitOutcome`:**
```ts
export type InitOutcome =
  | { readonly kind: "not-lisa"; readonly root: string }
  | { readonly kind: "scaffolded"; readonly result: InitApplyResult };
```
Placed just after `InitApplyResult`.

**New exported function — `runInit(projectRoot): Promise<InitOutcome>`:**
1. `const entries = await readdir(projectRoot);` — top-level names only (D4). A genuine fault
   (not ENOENT) propagates; we do not catch (the house "a real fault throws" rule).
2. `if (!isLisaProject(entries)) return { kind: "not-lisa", root: projectRoot };` — typed andon,
   nothing written.
3. `const result = await applyInitScaffold(projectRoot); return { kind: "scaffolded", result };`

A doc-comment header in the module's established voice: the refuse-or-apply seam, why detection is
top-level only, the not-lisa-is-data / fault-throws contract, and the pointer that the CLI owns
the hint string + exit code.

**Internal boundary.** `runInit` is the only addition's surface area. `applyInitScaffold`,
`pathExists`, and `InitApplyResult` are untouched. No behavior of T-040-02 changes.

### 2. `src/cli.ts` — parser + route + USAGE + dispatch arm

**`USAGE`** (lines 16–25): add `"       vend init\n"` after the `shelf` line (the zero-arg
read/setup cluster).

**`ParsedCommand` union** (lines 33–83): add `| { readonly cmd: "init" }` (beside `{ cmd: "shelf" }`).

**`parseArgs` router** (lines 124–139): add `if (argv[0] === "init") return parseInitArgs(argv);`
beside the other verb routes.

**New pure parser `parseInitArgs`** (near `parseShelfArgs`):
```ts
function parseInitArgs(argv: readonly string[]): ParsedCommand {
  if (argv.length > 1) return { cmd: "usage", error: `unexpected init argument: ${argv[1]}` };
  return { cmd: "init" };
}
```
With a doc-comment matching `parseShelfArgs`'s: flags-only, no subject, no `--budget` (nothing is
cast), so any token after `init` is an error.

**New dispatch arm** in `import.meta.main` (placed with the other arms, e.g. after the `shelf`
arm): lazy-import `runInit`, call with `process.cwd()`, switch on `kind` → stderr hint + exit 1
for `not-lisa`, stdout tally + exit 0 for `scaffolded`. (Exact code in design.md D5.)

## Files extended (tests)

### 3. `src/cli.test.ts` — `parseInitArgs` cluster + USAGE assertion

A new `describe("parseArgs — init (T-040-03 scaffold command)", …)` block, mirroring the shelf
cluster:
- `parseArgs(["init"])` deep-equals `{ cmd: "init" }`.
- `parseArgs(["init", "junk"]).cmd === "usage"` (unexpected positional).
- `parseArgs(["init", "--force"]).cmd === "usage"` (unknown flag — same arm catches it).
- A test importing `USAGE` and asserting it contains `"vend init"`. (USAGE is already exported;
  add it to the existing import on line 2: `import { parseArgs, parseBudgetArg, USAGE } from "./cli.ts";`.)

### 4. `src/init/init-effect.test.ts` — `runInit` guarded-live cluster

A new `describe("runInit — refuse-or-apply composition", …)` block, reusing the file's existing
`mkdtemp`/`seedBareLisa`/`exists` helpers and `finally` teardown:
- **not-lisa:** `mkdtemp` a bare dir (NO `CLAUDE.md`), `runInit(root)` → `{kind:"not-lisa", root}`;
  assert NO manifest path was created (e.g. `docs/active/demand.md` absent) — refusal writes nothing.
- **scaffolded:** `seedBareLisa()` (root `CLAUDE.md`), `runInit(root)` → `kind:"scaffolded"`;
  assert the full tree exists and `result.created.length === SCAFFOLD_MANIFEST.length`,
  `result.skipped` empty.
- **idempotent:** run `runInit` twice on a bare-lisa root; the second → `kind:"scaffolded"` with
  `result.created` empty and `result.skipped.length === SCAFFOLD_MANIFEST.length`.
- **detection via `.lisa.toml`:** a temp dir whose only marker is `.lisa.toml` → `scaffolded`
  (proves both markers are honored, not just `CLAUDE.md`).

Imports to add to the test: `readdir` is not needed (the effect owns it); add `runInit` and
`InitOutcome` is inferred. Will need `readFile`/`stat` already imported; `SCAFFOLD_MANIFEST`
already imported.

## Ordering of changes

1. `init-effect.ts` — add `runInit` (the seam the CLI will call).
2. `init-effect.test.ts` — prove `runInit` (refusal writes nothing; apply; idempotent; both markers).
3. `cli.ts` — parser + route + USAGE + dispatch arm.
4. `cli.test.ts` — prove `parseInitArgs` + USAGE line.

Each pair (source+test) is independently green and atomically committable. Step 1+2 form one
commit (the effect composition); step 3+4 form a second (the CLI surface).

## Public interface summary

| Symbol | File | Visibility | Shape |
|---|---|---|---|
| `InitOutcome` | init-effect.ts | exported type | `{kind:"not-lisa",root} \| {kind:"scaffolded",result}` |
| `runInit` | init-effect.ts | exported fn | `(projectRoot: string) => Promise<InitOutcome>` |
| `{ cmd: "init" }` | cli.ts | union arm | payload-free |
| `parseInitArgs` | cli.ts | module-private | `(argv) => ParsedCommand` |

No type in `init-core.ts` changes. No existing export's signature changes.
