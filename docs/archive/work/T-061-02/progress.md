# T-061-02 — Progress

_Phase: Implement. What was done, what deviated, current state._

## Status: complete — gate green, no regressions

All three planned changes are applied to the working tree and verified. The work is
**not committed**: the session is on the default branch `main`, and committing was
not requested (the ticket instruction is to produce artifacts and let Lisa handle
transitions). The diff is staged for Lisa / a human to commit.

## Steps executed (vs. plan)

### Step 1 — `src/version.ts` (the embed) ✅
Created. `import pkg from "../package.json"; export const VERSION: string =
pkg.version;` with the build-embed rationale in the doc-comment.
- Verified: `bunx tsc --noEmit -p tsconfig.json` → exit 0. The JSON import
  typechecks under the project tsconfig with **no `resolveJsonModule` change**
  (confirmed in Research; held in the full project context too).

### Step 2 — `src/cli.ts` wiring ✅
Five additive edits, exactly as Structure specified:
1. `import { VERSION } from "./version.ts";` (top, value import — cheap/BAML-free).
2. `| { readonly cmd: "version" }` added to `ParsedCommand` (beside `shelf`).
3. `if (argv[0] === "--version") return { cmd: "version" };` at the top of
   `parseArgs`, before the verb table.
4. Dispatch arm printing `${VERSION}\n` to stdout, `process.exit(0)`, near the top
   of the `import.meta.main` block (after the `usage` arm).
5. `vend --version` line appended to `USAGE`.
- Verified: tsc exit 0 (union exhaustiveness holds). Manual smokes:
  - `bun run src/cli.ts --version` → `0.1.0`
  - `bun run src/cli.ts --version extra junk` → `0.1.0` (short-circuit)
  - `bun run src/cli.ts frobnicate` → `unknown command: frobnicate` (interception
    is specific to `--version`)

### Step 3 — `src/version.test.ts` ✅
Created with four describe blocks (6 tests):
- **VERSION embed** — `VERSION === pkg.version`, semver regex, `!== "0.0.0"`.
- **parseArgs --version** — parses to `{ cmd: "version" }`; short-circuits trailing
  tokens; an unknown flag is still a usage error (negative guard).
- **wired CLI surface** — `bun run src/cli.ts --version` exits 0, stdout == `VERSION`.
- **compiled-binary survival** — compiles a BAML-free harness around `version.ts`
  via `bun build --compile`, runs it from an empty temp `cwd` (no `node_modules`, no
  `package.json`), asserts stdout == `VERSION`. `finally` cleans both temp dirs;
  30 s timeout against cold-compile flake.
- Verified: `bun test src/version.test.ts` → **6 pass / 0 fail**.

### Step 4 — full gate + regression check ✅
- `bunx tsc --noEmit` → exit 0.
- `bun test` → **1355 pass / 8 fail**. The 8 failures are the SAME pre-existing
  live-board smoke tests from the Research baseline (`loadWorkGraph`, `writeBoardSvg`,
  `one-way authority`, `T-021-05/06/08`), all choking on the transient dangling board
  reference (`story 'S-064' has no epic 'E-064'`). **Zero new failures**; pass count
  rose by exactly the 6 added tests (1349 → 1355).
- The Design 1b macro fallback was **not needed** — the static JSON import held.

## Deviations from plan

- **None substantive.** Added one extra assertion beyond the plan's minimum: a
  `bun run src/cli.ts --version` real-CLI smoke (in addition to the compiled-binary
  test), so the wired dispatch arm is observed directly, matching the
  `doctor-cli.smoke.test.ts` precedent. Strengthens coverage; no scope change.
- **Commits not made.** Per the on-`main` / not-requested policy (see Status); the
  plan's commit sequence is left for Lisa/human to apply to the working-tree diff.

## Files changed
- `src/version.ts` (new)
- `src/cli.ts` (5 additive edits)
- `src/version.test.ts` (new)

No `tsconfig.json`, `package.json`, or other files touched.
