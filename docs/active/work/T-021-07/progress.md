# T-021-07 — Progress: one-way-authority-guarantee

_What's done, what remains, deviations from plan._

## Status: implementation complete — both AC teeth landed and green.

## Done

- **Step 1 — `src/present/authority-guard.ts`** (pure classifier core). `WRITE_PRIMITIVES` +
  `PROTECTED_PATH` consts (R12 contract), `stripComments`, `importedFsNames`, `importsWriter`
  (import + call-shape + `Bun.write(` detection), `referencesProtectedPath`,
  `classifyAuthorityViolations`. Pure/total, never throws on a finding.
- **Step 2 — `src/present/authority-guard.test.ts`** (G2). 7 unit cases over fabricated sources
  (positive write-to-board; presets-shaped writer-to-.vend negative; comment-only docs/active
  negative; Bun.write positive/negative; namespace-import write; the **self-check** that the guard's
  own source is not flagged) + the **real-source scan** reading every non-test `src/present/*.ts` and
  asserting zero violations, with a non-vacuous "known modules covered" guard.
- **Step 3 — `src/present/one-way-authority.test.ts`** (G1). `hashTree` SHA-256 walker; the byte-hash
  E2E (snapshot → `loadWorkGraph` → project under 3 specs + `loadSeatSpec` → `JSON.stringify` render
  stand-in → re-snapshot → assert byte-identical with named drift); plus reference-unchanged/frozen
  companion and the "loader imports no writer" companion.

**My tests:** `bun test src/present/authority-guard.test.ts src/present/one-way-authority.test.ts` →
**10 pass / 0 fail / 26 expect()**. `tsc --noEmit` reports **zero errors in my three files**.

## Deviation 1 — `bun run check` is red due to a CONCURRENT thread, not this work

The shared gate currently fails on `src/present/paper.ts` / `src/present/paper.test.ts` — the
**T-021-06 paper renderer**, an in-progress, **untracked** file set from another Lisa thread on this
branch (concurrency model: multiple threads, one branch). Its `paper.test.ts` can't yet resolve
`./paper.ts` and has an implicit-`any`. **None of my three files contribute any error.** I commit
**only my files**, so *committed HEAD* typechecks clean (paper.* stay untracked, outside HEAD); the
T-021-06 thread owns committing its own files. The D-005 stop gate polices `src/` — paper.* will show
as that thread's uncommitted source, its responsibility to resolve, not mine.

## Deviation 2 — "render" leg is `JSON.stringify`, not a renderer (planned)

No renderer module existed at design time (design D3). Notably the concurrent T-021-06 `paper.ts` IS
the eventual renderer — but it is uncommitted and currently broken, so coupling to it would be wrong.
My E2E deliberately uses `JSON.stringify(projection)` as the render stand-in and brackets the whole
pipeline with the byte-hash, so when `paper.render(...)` lands the invariant already holds; swapping
the render leg is a one-line change. No deviation from plan — this was the design decision.

## Remaining

- Review artifact (`review.md`).
- Working tree: my src files committed. docs/ artifacts are not in the D-005 SOURCE_PREFIXES, so they
  need not be committed for the stop gate; Lisa detects them for phase transitions.
