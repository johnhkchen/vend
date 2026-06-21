# T-040-03 — Plan: ordered, verifiable steps

Two atomic commits. Each step lists its change, its test, and its verification.

## Step 1 — `runInit` composition in `init-effect.ts`

**Change.**
- Extend the `node:fs/promises` import with `readdir`.
- Extend the pure-core import with `isLisaProject`.
- Add the `InitOutcome` discriminated union (`not-lisa` | `scaffolded`), with a header
  doc-comment in the module's voice.
- Add `export async function runInit(projectRoot)`: `readdir` the top-level entries → if
  `!isLisaProject(entries)` return `{kind:"not-lisa", root}` (writes nothing) → else
  `applyInitScaffold` and return `{kind:"scaffolded", result}`.

**Verify.** `tsc --noEmit` clean. No change to `applyInitScaffold`/`pathExists`.

## Step 2 — `runInit` tests in `init-effect.test.ts`

**Change.** Add a `describe("runInit — refuse-or-apply composition")` block reusing the existing
`mkdtemp`/`seedBareLisa`/`exists` helpers + `finally` teardown:
1. **not-lisa writes nothing** — a bare temp dir (no markers) → `{kind:"not-lisa", root}`; assert
   `docs/active/demand.md` does NOT exist after.
2. **bare lisa → full tree** — `seedBareLisa()` → `kind:"scaffolded"`,
   `result.created.length === SCAFFOLD_MANIFEST.length`, `result.skipped` empty, tree present.
3. **idempotent second run** — two `runInit`s on a bare-lisa root; second → `kind:"scaffolded"`,
   `result.created` empty, `result.skipped.length === SCAFFOLD_MANIFEST.length`.
4. **`.lisa.toml` alone is enough** — temp dir with only `.lisa.toml` → `kind:"scaffolded"`.

**Verify.** `bun test src/init/init-effect.test.ts` green. Then `bun test` whole suite green.

**Commit 1.** `feat(init): runInit refuse-or-apply composition (T-040-03)` — Steps 1–2.

## Step 3 — CLI surface in `cli.ts`

**Change.**
- `USAGE`: add `"       vend init\n"` after the `shelf` line.
- `ParsedCommand`: add `| { readonly cmd: "init" }`.
- `parseArgs`: add `if (argv[0] === "init") return parseInitArgs(argv);`.
- Add private `parseInitArgs(argv)`: `argv.length > 1` → usage (`unexpected init argument: …`);
  else `{cmd:"init"}`. Doc-comment mirroring `parseShelfArgs`.
- Dispatch arm in `import.meta.main`: lazy-import `runInit`, call `runInit(process.cwd())`,
  `not-lisa` → stderr `not a lisa project (no CLAUDE.md or .lisa.toml in <root>) — run \`lisa init\` first` + exit 1;
  `scaffolded` → stdout `vend init: scaffolded <c> created, <s> skipped` + exit 0.

**Verify.** `tsc --noEmit` clean. Manual: `parseArgs(["init"])` returns `{cmd:"init"}` (covered by
Step 4). The dispatch arm is the untested shell (house pattern).

## Step 4 — CLI tests in `cli.test.ts`

**Change.**
- Extend the import: `import { parseArgs, parseBudgetArg, USAGE } from "./cli.ts";`.
- New `describe("parseArgs — init (T-040-03 scaffold command)")`:
  - `parseArgs(["init"])` → `{ cmd: "init" }`.
  - `parseArgs(["init", "junk"]).cmd === "usage"`.
  - `parseArgs(["init", "--force"]).cmd === "usage"`.
  - `expect(USAGE).toContain("vend init")`.

**Verify.** `bun test src/cli.test.ts` green. Then full `bun test`.

**Commit 2.** `feat(init): vend init CLI command — parse, usage, dispatch (T-040-03)` — Steps 3–4.

## Testing strategy

| What | How | Where |
|---|---|---|
| `parseInitArgs` (pure) | unit — deep-equal on `ParsedCommand` | cli.test.ts |
| USAGE lists init | unit — `toContain` | cli.test.ts |
| `runInit` refusal writes nothing | guarded-live temp dir | init-effect.test.ts |
| `runInit` apply + tally | guarded-live temp dir | init-effect.test.ts |
| `runInit` idempotent | guarded-live temp dir | init-effect.test.ts |
| both markers detected | guarded-live temp dir | init-effect.test.ts |
| dispatch arm exit codes | NOT unit-tested (house pattern: `import.meta.main` shell) | — |

The dispatch arm's exit-code mapping is the thin untested shell, consistent with every other CLI
arm. Its logic is `runInit`'s tested `kind` switch plus `process.exit` — no branching beyond the
two kinds.

## Verification criteria (AC mapping)

- ✅ `parseArgs(['init', ...])` tests cover **bare `init`** (Step 4: `["init"]`) and
  **unknown-flag→usage** (Step 4: `["init","--force"]`, plus `["init","junk"]`).
- ✅ **USAGE lists the init line** (Step 3 adds it; Step 4 asserts it).
- ✅ **dispatch arm exits 0 after scaffolding** (Step 3: `scaffolded` → exit 0).
- ✅ **exits non-zero with a 'not a lisa project — run lisa init first' hint** when neither marker
  is found (Step 3: `not-lisa` → stderr hint + exit 1; Step 2 proves the `not-lisa` branch).

## Full gate before done

`bun run check` (baml:gen → tsc → bun test) green, no regressions against the ~1024-test baseline.
