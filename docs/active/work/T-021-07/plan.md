# T-021-07 — Plan: one-way-authority-guarantee

_Ordered, independently-verifiable steps + testing strategy. Grounded in structure.md._

## Testing strategy (what proves what)

- **G2 static** is proven two ways: pure **unit tests** over fabricated sources (the classifier's
  judgment in isolation, including the self-check and the presets.ts negative), and a **real-source
  scan** test that reads `src/present/*.ts` from disk and asserts zero violations.
- **G1 runtime** is proven by a **byte-hash E2E** over the live `docs/active/**` board: snapshot →
  run `load → project → render` (+ calibration read) → snapshot → assert byte-identical.
- Verification gate per step: `bun run check` (baml:gen → tsc --noEmit → bun test) green, no
  regression against the 685-test baseline (T-021-05).
- Both new test files must **fail meaningfully** if the invariant breaks — confirmed by a transient
  negative probe during Implement (temporarily point a fabricated write at docs/active and watch the
  classifier flag it; revert), not committed.

---

## Step 1 — `authority-guard.ts` (pure classifier core)

Write the module per structure.md §`authority-guard.ts`:

- `WRITE_PRIMITIVES` (frozen) + `PROTECTED_PATH = "docs/active"`.
- `stripComments`, `importedFsNames`, `importsWriter` (import + `Bun.write(`/`createWriteStream(`
  call detection), `referencesProtectedPath`, `classifyAuthorityViolations`.
- `Violation` interface. All pure/total; never throws on a finding.

**Verify:** `tsc --noEmit` clean. (No behavior yet to test alone.)
**Commit:** `feat(present): static one-way-authority guard core (T-021-07)`.

## Step 2 — `authority-guard.test.ts` (unit + real-source scan)

- Fabricated-source cases: positive (writeFile→docs/active), presets-shaped negative (writer→.vend),
  pure-with-docs/active-in-comment negative, Bun.write positive/negative, **self-check** (guard's own
  source → zero).
- Real-source scan: read non-test `src/present/*.ts`, assert `classifyAuthorityViolations === []`,
  and assert the known module set (`project`, `translate`, `spec`, `presets`) was covered.

**Verify:** `bun test src/present/authority-guard.test.ts` green; full `bun run check` green. This is
the moment G2 is proven against the *actual* current source — confirms presets.ts is **not** flagged.
**Commit:** `test(present): one-way-authority static guard — unit + real-source scan (T-021-07)`.

## Step 3 — `one-way-authority.test.ts` (byte-hash E2E, G1)

- `hashTree(root)` helper (recursive SHA-256 map).
- Main test: snapshot `docs/active` → `loadWorkGraph()` → project under DESIGNER/DEV/`groupBy`-varied
  specs, `JSON.stringify` each (render stand-in), assert non-empty → `loadSeatSpec("designer")` +
  project → re-snapshot → assert deep-equal with named diff on mismatch.
- Companion tests: graph reference-unchanged + `Object.isFrozen`; loader imports no writer (run the
  classifier over `src/graph/load.ts` → zero).

**Verify:** `bun test src/present/one-way-authority.test.ts` green; full `bun run check` green.
**Negative probe (not committed):** temporarily add a `writeFile` to a scratch under docs/active in a
local edit, confirm G1 fails with a named-path diff, revert.
**Commit:** `test(present): one-way-authority byte-hash E2E over docs/active (T-021-07)`.

## Step 4 — Full gate + progress/review

- `bun run check` green end-to-end; record final pass count (expect baseline + new cases).
- Write `progress.md` (deviations, if any) then `review.md`.
- Working tree clean (D-005 done-means-committed) before stopping.

---

## Sequencing notes

- Steps 1–2 (G2) and Step 3 (G1) are **independent** — either order works; G2 first because the
  classifier it builds is reused by Step 3's "loader imports no writer" companion test.
- Each step is atomically committable; no step leaves the build red.

## Risk / rollback

- If the comment-stripper mis-handles a real present-source construct and the real-scan test goes
  red on a *false positive*, the fix is local to `stripComments`/`importsWriter` (tighten to
  import/call shape) — no consumer churn (R12: only the classifier knows the detection rule).
- If the live board fails to `loadWorkGraph()` (a pre-existing corrupt edge), G1 surfaces it as a
  load throw — that is a real andon about the board, not this ticket's regression; out of scope to
  fix here but worth flagging in review.

## Verification criteria (AC restated)

- [ ] An E2E test snapshots `docs/active/**` byte-hashes, runs load→project→render, asserts every
      source file byte-unchanged → **Step 3**.
- [ ] A static check fails the build if any presentation module imports a writer/fs-write against
      `docs/active` → **Steps 1–2** (rides `check:test`, so a violation fails `bun run check`).
