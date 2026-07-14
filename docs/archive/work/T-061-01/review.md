# T-061-01 — Review

_Phase: Review. Handoff for a human reviewer — what changed, coverage, concerns._

## What this ticket did

Made `package.json` shippable so E-061's binary/formula pipeline has a real,
installable package to point at. Three manifest fields + the shebang that makes the
declared `bin` actually executable + a test that locks the invariants.

## Files changed

| File | Change | Lines |
|------|--------|-------|
| `package.json` | `version` 0.0.0 → **0.1.0**; removed `private: true`; added `bin.vend → ./src/cli.ts` | +5 / −2 |
| `src/cli.ts` | prepended `#!/usr/bin/env bun` shebang (header otherwise untouched) | +1 |
| `src/packaging.test.ts` | **new** — asserts the three manifest invariants | +27 |
| `docs/active/work/T-061-01/*` | **new** — RDSPI artifacts (research/design/structure/plan/progress/review) | docs |

Final manifest head:
```json
{ "name": "vend", "version": "0.1.0", "type": "module",
  "bin": { "vend": "./src/cli.ts" }, "engines": { "bun": ">=1.3.9" }, ... }
```

## Acceptance criteria — status

> package.json `version` is a non-zero semver (e.g. 0.1.0), `private` key is
> absent, `bin.vend` resolves to the CLI entrypoint, and `bun run check` still
> passes.

- ✅ `version` is `0.1.0` (non-zero semver).
- ✅ `private` key absent (deleted, not set to `false`).
- ✅ `bin.vend` resolves to the entrypoint — points at `./src/cli.ts`, which
  exists and runs (smoke-verified via `bun run ./src/cli.ts`). The shebang makes
  it executable when installed, not merely path-resolvable.
- ⚠️ `bun run check` **does NOT pass** — but the failure is pre-existing and
  unrelated to this ticket. See Open Concerns. This ticket's own changes are
  green: typecheck clean, and the new `packaging.test.ts` passes 3/3.

## Test coverage

- **New:** `src/packaging.test.ts` — 3 tests, 6 assertions, all passing:
  1. `version` is a string, ≠ `0.0.0`, matches `^\d+\.\d+\.\d+$`.
  2. `"private" in pkg` is `false`.
  3. `bin.vend === "./src/cli.ts"` and the target file `exists()` on disk.
  These convert the AC into executed, regression-proof assertions (a future edit
  that reintroduces `private`, zeroes the version, or breaks the `bin` path will
  fail the gate).
- **Unaffected:** the shebang changes no export; `src/cli.test.ts` (pure-parse
  tests) and the rest of the suite are untouched by my change.
- **Gap (intentional):** no test of `vend --version` runtime output. That surface
  — and embedding the semver so it survives a compiled single-file binary — is
  **T-061-02** (`depends_on: [T-061-01]`), explicitly out of scope here.

## Verification performed

- `bun run check:typecheck` → exit 0 (shebang tolerated under strict tsc).
- `bun test src/packaging.test.ts` → 3 pass / 0 fail.
- `bun run ./src/cli.ts` → executes through the entrypoint (bin path + shebang work).
- Isolation proof: stashed `package.json` + `src/cli.ts`, re-ran the failing
  board test → still failed identically ⇒ the red gate is not caused by this change.

## Open concerns — NEEDS HUMAN ATTENTION

1. **The full gate is red from pre-existing board-data debt (blocks commit).**
   `bun run check` fails 8 "live board" tests, all one root cause
   (`src/graph/model.ts:361`, `GraphIntegrityError`):
   ```
   story 'S-062' has no epic 'E-062'
   story 'S-063' has no epic 'E-063'
   story 'S-064' has no epic 'E-064'
   story 'S-065' has no epic 'E-065'
   ```
   Stories S-062–S-065 exist on the board with no epic files. This predates and is
   orthogonal to the manifest work. **Consequence:** the project's test-green
   pre-commit hook will reject any commit until the board is green again — so this
   ticket's (correct, verified) changes are **uncommitted**, by deliberate choice
   not to `--no-verify` past the project's own gate. A human/Lisa should resolve
   the orphan stories (author E-062–E-065, or remove/repair the dangling stories),
   then the suite goes green and these changes can land normally.

2. **Distribution scope is partial by design.** `bin.vend` points at the raw
   `src/cli.ts` (TS). The compiled single-file binary (`bun build --compile`),
   release CI, tarball+sha256, and `vend.rb` tap formula are later E-061 tickets;
   the `bin` here is the npm/Bun-package alias, correct for this slice. Do not
   re-point `bin` at a `dist/` artifact until that artifact actually exists in the
   tree (a `bin` at a non-existent path would not resolve).

3. **No npm-publish completeness fields** (`files`, `repository`, `license`,
   `description`) were added — not required by the AC, and the chosen distribution
   is brew + compiled binary, not `npm publish`. Add them with the release ticket
   only if npm publish is ever wanted.

## Summary

The manifest is now publishable: real semver, no `private`, an executable
`bin.vend`. All three AC field-requirements are met and locked by a passing test;
typecheck is clean. The one unmet clause — `bun run check` passing — is blocked
solely by pre-existing, out-of-scope board orphans (missing epics E-062–E-065),
proven independent of this change. Recommended next action: clear the board
orphans so the suite (and pre-commit hook) goes green, then land this change.
