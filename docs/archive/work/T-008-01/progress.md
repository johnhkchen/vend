# T-008-01 — Progress: `check:committed`

*Implementation log. What landed, in what commits, deviations from the plan, and
the verify-the-verifier results.*

---

## Status: implementation complete, all ACs met, gate passes on itself.

## Steps executed (per plan.md)

- **Step 1 — pure core `src/ci/committed-core.ts`** ✅
  `SOURCE_PREFIXES`, `parsePorcelainLine`, `classifyPorcelain`. Pure, addon-free,
  no I/O. Matches structure.md exactly.
- **Step 2 — unit tests `src/ci/committed-core.test.ts`** ✅
  16 tests covering the three AC fixtures + scope edges (root/docs out of scope,
  `ci/` in scope, ignored-runtime absent), rename→destination, quoted path,
  staged-uncommitted, dedup/sort, and `parsePorcelainLine` units. `bun test
  src/ci/committed-core.test.ts` → **16 pass / 0 fail**.
- **Step 3 — impure entry `src/ci/check-committed.ts`** ✅
  `import.meta.main` shell: `git rev-parse --show-toplevel` (exit 2 on failure),
  `git status --porcelain` (exit 2 on git error), `classifyPorcelain`, offenders→
  stderr+exit 1, clean→stdout+exit 0. Smoke-only, not unit-tested (house pattern).
- **Step 4 — wire `package.json`** ✅
  Added `"check:committed": "bun run src/ci/check-committed.ts"`. NOT added to the
  aggregate `check` (design D6).
- **Step 5 — verify the verifier** ✅ (see results below)
- **Step 6 — final gate sweep** ✅ typecheck clean, 282 tests pass,
  `check:committed` → 0 on the committed tree.

## Commits (atomic boundaries, per plan commit map)

| Commit | Contents |
|---|---|
| 1 | `committed-core.ts` + tests + RDSPI artifacts (research/design/structure/plan) |
| 2 | `check-committed.ts` + `package.json` script |

Each commit left the tree green. Per E-008's own thesis, this ticket ends with
HEAD consistent and source committed — proven by running the gate on itself.

## Verify-the-verifier results (the keystone)

| Scenario | Expected | Actual |
|---|---|---|
| Dirty tree (uncommitted `src/ci/*`) | exit 1, lists offenders | ✅ exit 1, listed `src/ci/` |
| Committed tree | exit 0 | ✅ exit 0, "all source committed" |
| After `bun run baml:gen` (regen gitignored `baml_client/`) | exit 0 | ✅ exit 0 (runtime never in porcelain — AC#1 runtime clause) |
| Stray `touch src/ci/_scratch.ts` | exit 1, flags it | ✅ exit 1, listed `src/ci/_scratch.ts` |

Final `git status --porcelain`: only ` M docs/active/tickets/T-008-01.md` (Lisa's
phase-tracking edit — deliberately not touched). No uncommitted **source**.

## Full-suite gate

- `bun run check:typecheck` → clean (no errors).
- `bun test` → **282 pass / 0 fail** (20 files; +16 new from this ticket — the
  prior baseline was 266).
- `bun run check:committed` → exit 0.

## Deviations from plan

- **None material.** One observation: an untracked *whole directory* surfaces in
  porcelain as a single trailing-slash entry (`src/ci/`) rather than per-file,
  so the dirty-tree smoke listed `src/ci/` (not the three filenames). This is
  correct behavior — the directory prefix still matches `SOURCE_PREFIXES` and the
  andon fires. Per-file granularity returns once files are tracked (the
  `_scratch.ts` negative confirmed per-file reporting). No code change needed.

## Notes for Review

- Scope is deliberately `src/` / `baml_src/` / `ci/` only (design D7) — root
  config files (`package.json`, `tsconfig.json`) do not trip the gate. Flagged as
  an open concern, not a defect.
- Full porcelain C-unescaping is out of scope; one wrapping-quote layer is
  stripped (design D5). No such paths exist in this tree.
