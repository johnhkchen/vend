# T-040-03 — Review: `vend init` command

Handoff document. What changed, how it is covered, and what a reviewer should weigh. This is the
third and final slice of E-040 (`vend-init-scaffold`); it wires the CLI surface onto the pure core
(T-040-01) and write effect (T-040-02).

## What changed

**Source (2 files):**

- `src/init/init-effect.ts` — added the refuse-or-apply composition:
  - import `readdir` (fs) and `isLisaProject` (pure core).
  - `InitOutcome` = `{kind:"not-lisa", root}` | `{kind:"scaffolded", result}`.
  - `runInit(projectRoot)`: `readdir` the top-level entries → if not a lisa project, return
    `not-lisa` (DATA, nothing written) → else `applyInitScaffold` and return `scaffolded`.
  - `applyInitScaffold`, `pathExists`, `InitApplyResult` are UNCHANGED — T-040-02's behavior is
    untouched; this is a pure addition.

- `src/cli.ts` — added the `init` command surface:
  - `USAGE` gains the `vend init` line.
  - `ParsedCommand` gains the payload-free `{ cmd: "init" }` arm.
  - `parseArgs` routes `init` → `parseInitArgs`.
  - `parseInitArgs` (pure): flags-only, no subject, no `--budget`; any token after `init` is a
    usage error. Modeled on `parseShelfArgs`.
  - dispatch arm (`import.meta.main`): lazy-imports `runInit`, calls it with `process.cwd()`,
    maps `not-lisa` → stderr fix-it hint + exit 1, `scaffolded` → stdout create/skip tally + exit 0.

**Tests (2 files):**

- `src/init/init-effect.test.ts` — `describe("runInit — refuse-or-apply composition")`, 4 tests
  (non-lisa refusal writes nothing; bare-lisa full tree + tally; idempotent second run; `.lisa.toml`
  marker alone detected).
- `src/cli.test.ts` — `describe("parseArgs — init …")`, 4 tests (bare `init`; unexpected
  positional → usage; unknown flag → usage; `USAGE` contains `vend init`). Imported `USAGE`.

No files created or deleted. No existing export signature changed.

## Test coverage

- **Full suite: 1032 pass / 0 fail** (1024 baseline + 8 new). `tsc --noEmit` clean.
- **AC mapping — all satisfied:**
  - _`parseArgs(['init', ...])` tests cover bare `init`_ → `parseArgs(["init"])` → `{cmd:"init"}`. ✅
  - _… and unknown-flag→usage_ → `["init","--force"]` and `["init","--budget","1,2"]` → usage;
    `["init","junk"]` → usage with the exact error. ✅
  - _USAGE lists the init line_ → asserted via `toContain("vend init")`. ✅
  - _dispatch arm exits 0 after scaffolding_ → `scaffolded` → exit 0 (live: 17 created, exit 0;
    idempotent re-run 0 created, exit 0). ✅
  - _exits non-zero with a 'not a lisa project — run lisa init first' hint when neither CLAUDE.md
    nor .lisa.toml is found_ → `not-lisa` → exit 1 with that hint (live-confirmed); the `not-lisa`
    branch is unit-tested in init-effect.test.ts. ✅

- **Coverage gap (by design):** the `import.meta.main` dispatch arm itself is NOT unit-tested —
  the uniform house pattern (the block does not run on import; every other CLI arm is the same).
  Its logic is `runInit`'s tested `kind` switch plus `process.exit`. Mitigated by the live smoke
  recorded in progress.md (all four exit-code paths exercised end-to-end).

## Design decisions worth a reviewer's eye

1. **`runInit` lives in `init-effect.ts`, not inlined in the CLI.** The init-effect header had
   flagged the refusal as "the CLI's composition." I kept the **hint string + exit code in the
   CLI** but moved the **detection composition** (readdir + isLisaProject + apply) into the effect
   so the refusal path is testable — the established `pressShelf`/`castWork`/`runPlay` returned-kind
   discipline. This is a small reopening of T-040-02's module (a pure addition), justified by
   testability; flag if the team prefers the refusal fully inlined in the untested shell instead.
2. **Exit 1 (not 2) for `not-lisa`.** Treated as an environment-precondition refusal, same family
   as `no-board`/`no-menu` (exit 1), rather than a malformed command line (exit 2). The AC only
   requires "non-zero"; exit 1 is the precedent-correct choice.
3. **Top-level `readdir` only.** Both `LISA_MARKERS` are root files; a recursive walk would be
   wasted and could false-positive on a nested `CLAUDE.md`.
4. **No `--budget`, no positional, no `--force`.** Nothing is cast (no budget, cf. `shelf`); the
   cwd is the only target (no positional); no-clobber is unconditional in the effect (no `--force`).

## Open concerns / limitations

- **Scaffolds the cwd only.** No `vend init [dir]` target. Out of AC scope; `applyInitScaffold`/
  `runInit` already take a `projectRoot`, so widening later is a parser-only change.
- **A genuine `readdir` fault propagates** (not masked as `not-lisa`). For `process.cwd()` the root
  always exists, so this is effectively unreachable from the CLI — but the contract is honest.
- **`runInit` is impure and not BAML-bearing**, yet lazy-imported in the dispatch arm for idiom
  uniformity (keeps the pure-parse path import-free). Intentional, not accidental.

## Reviewer bottom line

Small, additive, all gates green, every AC clause covered by a test or a documented untested-shell
path with live proof. No regression to the two prerequisite seams. Ready for review.
