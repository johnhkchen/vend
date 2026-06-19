# T-008-01 — Review: `check:committed`

*Self-assessment and handoff. What changed, test coverage, open concerns. Enough
for a human reviewer to understand the work without reading every diff.*

---

## What this ticket delivers

`bun run check:committed` — the structural gate that **fails when uncommitted or
untracked source exists in the working tree** (scoped to `src/`, `baml_src/`,
`ci/`). It is the detector that would have caught the E-001/E-006/E-007 residuals
(`D-005` / `D-010`): a loop ending with source written but never committed,
leaving HEAD broken. T-008-01 builds the standalone gate + the R12 shared
contract; T-008-02 (separate ticket) wires it into a lisa on-stop hook.

---

## Files changed

| File | Action | Summary |
|---|---|---|
| `src/ci/committed-core.ts` | created | Pure classifier. Exports `SOURCE_PREFIXES` (R12 contract), `parsePorcelainLine`, `classifyPorcelain`. No I/O, no addon. |
| `src/ci/committed-core.test.ts` | created | 16 `bun:test` unit tests over porcelain fixtures. |
| `src/ci/check-committed.ts` | created | Thin impure entry: `Bun.spawnSync` git, classify, exit 0/1/2. Smoke-only. |
| `package.json` | modified | Added `check:committed` script (not in the aggregate `check`). |
| `docs/active/work/T-008-01/*` | created | RDSPI artifacts (research, design, structure, plan, progress, this review). |

Committed in two atomic commits (tested-core; wired-entry), each leaving the tree
green. No existing source modified — purely additive.

---

## How it works (one paragraph)

`check-committed.ts` resolves the repo root, runs `git status --porcelain`, and
hands the text to the pure `classifyPorcelain`, which parses each line to its path
field (rename → destination; one quote layer stripped), keeps the paths under
`SOURCE_PREFIXES`, and returns them sorted+deduped. Empty ⇒ clean ⇒ exit 0; any
offenders ⇒ stderr andon + exit 1; a git/environment failure ⇒ exit 2 (distinct,
so a hook can tell "couldn't check" from "found a problem"). Gitignored runtime
(`baml_client/`, `node_modules/`, `.vend/*`) never appears in porcelain (we never
pass `--ignored`), so it is excluded by git itself, not by a denylist.

---

## Acceptance criteria — all met

- **AC#1** — script exits non-zero iff porcelain shows uncommitted/untracked under
  the three prefixes, 0 otherwise; gitignored runtime never fails. ✅ Verified by
  smoke: dirty→1, clean→0, post-`baml:gen`→0, stray `src/ci/_scratch.ts`→1.
- **AC#2** — a pure helper classifies porcelain → offending paths; unit-tested
  with dirty→list, clean→empty, untracked `src/*.ts`→flagged. ✅ `classifyPorcelain`
  + 16 tests including the three named fixtures.
- **AC#3** — `check:test` / `check:typecheck` green; script runs standalone. ✅
  `bun test` 282 pass / 0 fail; `tsc --noEmit` clean; `bun run check:committed`
  runs end-to-end on its own.

---

## Test coverage

- **Pure core: strong.** 16 unit tests cover the three ACs, both scope directions
  (in: `src/`/`baml_src/`/`ci/`; out: root config/docs/runtime), rename→dest,
  quoted path, staged-but-uncommitted, dedup+sort, blank/short lines, and
  `parsePorcelainLine` in isolation. Deterministic, addon-free, fast.
- **Impure entry: smoke only** (by design — the `import.meta.main` shell is not
  unit-tested, matching `cli.ts` / `press.ts`). The verify-the-verifier smoke
  (progress.md) exercises all four real exit paths against the live tree.
- **Gap — exit-code 2 path not exercised.** The git-missing / not-a-repo branch
  (exit 2) is reasoned-through but not run (would require an env without git or a
  non-repo cwd). Low risk; the branch is three lines of straight-line code.

---

## Open concerns (for human attention)

1. **Scope excludes root config (deliberate).** A modified `package.json` /
   `tsconfig.json` does **not** trip the gate — the ACs scope to `src/`/`baml_src/`/
   `ci/` (design D7). This is faithful to the ticket and convenient (committing
   this gate edits `package.json` without self-tripping), but it is a real gap:
   uncommitted root config escapes the andon. Widening is a one-line edit to
   `SOURCE_PREFIXES`. **Decision deferred to the contract owner** — flag if root
   config should be in scope.
2. **Porcelain C-unescaping is partial.** Only one wrapping-quote layer is
   stripped; backslash-escaped bytes inside a quoted path are not decoded (design
   D5). No such paths exist in this tree; over-flagging a weird path is the
   fail-safe direction. Note if exotic filenames become real.
3. **Untracked directory granularity.** A wholly-untracked directory reports as
   one trailing-slash entry (`src/ci/`) rather than per-file — correct (prefix
   still matches, andon still fires), but the message is coarser until files are
   tracked. Cosmetic.
4. **`-z` not used.** Plain porcelain v1 parsing; `-z` (NUL-terminated) would be
   more robust for pathological paths but complicates rename parsing. Acceptable
   for the current contract.

---

## Handoff to T-008-02

T-008-02 wires the **lisa on-stop hook** to invoke `bun run check:committed` and
decides **block-vs-warn** semantics (its R11). Contract it should rely on:
- `SOURCE_PREFIXES` exported from `committed-core.ts` — import scope, don't re-list.
- Exit codes: **0** clean, **1** andon (uncommitted source), **2** environment
  error. The hook should treat 1 as the stop signal; 2 ("couldn't check") is a
  policy choice for R11.
- The gate runs on the **host** working tree — never inside a Dagger container
  (the architectural constraint that makes E-008 a lisa hook, not a `/ci`
  sub-class).

No blocking issues. The gate passes on its own committed tree — the truest
end-state for the epic that says "done means committed."
