# T-040-03 — Progress

## Status: Implement complete

All four plan steps executed. Full gate green (`tsc --noEmit` clean; `bun test` → 1032 pass / 0
fail, up from the ~1024 baseline by the 8 new tests). Live smoke of the dispatch arm confirms all
four AC behaviors end-to-end.

## Completed

- **Step 1 — `runInit` in `src/init/init-effect.ts`.** Extended the `node:fs/promises` import with
  `readdir` and the pure-core import with `isLisaProject`. Added the `InitOutcome` discriminated
  union (`not-lisa` | `scaffolded`) and `runInit(projectRoot)`: `readdir` top-level → gate on
  `isLisaProject` → refuse (data, nothing written) or `applyInitScaffold`. Doc-comment in the
  module's voice.
- **Step 2 — `runInit` tests in `src/init/init-effect.test.ts`.** New `describe` block, 4 tests:
  non-lisa refusal writes nothing; bare-lisa scaffolds full tree + truthful tally; idempotent
  second run (0 created); `.lisa.toml`-only root is detected. Reuses the existing
  `seedBareLisa`/`exists` helpers + `finally` teardown.
- **Step 3 — CLI surface in `src/cli.ts`.** USAGE gains `vend init`; `ParsedCommand` gains
  `{ cmd: "init" }`; `parseArgs` routes `init`; `parseInitArgs` (flags-only, no subject, no budget)
  added beside `parseShelfArgs`; dispatch arm lazy-imports `runInit`, maps `not-lisa` → stderr hint
  + exit 1 and `scaffolded` → stdout tally + exit 0.
- **Step 4 — CLI tests in `src/cli.test.ts`.** Imported `USAGE`; new `describe` block: bare `init`
  → `{cmd:"init"}`; unexpected positional → usage; unknown flag (`--force`, `--budget`) → usage;
  `USAGE` contains `vend init`.

## Live verification (dispatch arm — the untested shell)

| Scenario | Result |
|---|---|
| `init` in a non-lisa cwd | `not a lisa project (no CLAUDE.md or .lisa.toml in …) — run \`lisa init\` first`, exit 1 |
| `init` in a bare-lisa cwd | `vend init: scaffolded — 17 created, 0 skipped`, exit 0 |
| `init` re-run (idempotent) | `vend init: scaffolded — 0 created, 17 skipped`, exit 0 |
| `init junk` | usage error + banner, exit 2 |

## Deviations from plan

None of substance. The success line reads `scaffolded — <c> created, <s> skipped` (an em-dash
separator) rather than the plan's draft punctuation — cosmetic, the tally content is as planned.

## Commits

Left to Lisa / the working-tree owner per the session instruction to stop after Review (the user's
prompt: "Lisa handles the rest"). The planned atomic split, if committed, is:
1. `feat(init): runInit refuse-or-apply composition (T-040-03)` — Steps 1–2.
2. `feat(init): vend init CLI command — parse, usage, dispatch (T-040-03)` — Steps 3–4.

## Remaining

Nothing in scope. Review artifact next.
