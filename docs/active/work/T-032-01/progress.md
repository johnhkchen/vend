# T-032-01 — Progress

Status: **complete**. Two commits, both green. Zero deviations from the plan.

## Commits

| # | SHA | Title | Gate |
|---|-----|-------|------|
| 1 | `d67263f` | `feat(engine): PlayTools contract + pure resolveTools (T-032-01)` | tsc + 890 tests |
| 2 | `7aa385a` | `feat(executor): buildArgs emits MCP/tool-scoping flags (T-032-01)` | tsc + 896 tests |

## Step log (against plan.md)

### Commit 1 — pure contract + resolver
- **1.1** `PlayTools` interface (`{ mcp?, allow?, skills? }`, all `readonly`/optional) + a new
  per-play tool provisioning doc block added to `src/engine/play.ts` before the `Play`
  interface; `readonly tools?: PlayTools` added to `Play<I, O>` beside `maxTurns?`. ✅
- **1.2** `src/engine/cast-core.ts`: `PlayTools` added to the existing `type` import from
  `./play.ts`; `ResolvedTools` tagged union + pure `resolveTools(declared, available)` added
  beside `resolveMaxTurns`. Re-exported automatically via `cast.ts`'s `export *`. ✅
- **1.3** `src/engine/cast-core.test.ts`: 7-case `resolveTools` block — the 3 required variants
  (undeclared/passthrough, declared+present/strict, declared+missing/andon) + empty-decl,
  allow-only, skills-carried, fresh-array edges. ✅
- **1.4** `bun run check:typecheck` clean; `bun test` 890/0. Committed `d67263f`. ✅

### Commit 2 — buildArgs tool-scoping flags
- **2.1** `src/executor/claude.ts`: `buildArgs` options widened with `mcpConfig?`/
  `allowedTools?`/`strictMcp?`; three guarded pushes appended after `--max-turns`; doc-comment
  updated. `dispense`/`DispenseOptions` untouched (its call passes the same four keys). ✅
- **2.2** `src/executor/claude.test.ts`: 6 new cases — each flag alone, empty-array guard,
  full composition + ordering, byte-identity back-compat. Existing 8 cases unchanged. ✅
- **2.3** `bun run check:typecheck` clean; `bun test` 896/0. Committed `7aa385a`. ✅

## Deviations

**None.** The implementation matches Structure and Plan exactly. One incidental note: the
linter merged the two `import type … from "./play.ts"` lines in `cast-core.test.ts` into one
(`GateVerdict, PlayTools`) — cosmetic, no behavior change.

## Verification snapshot

- `bun run check:typecheck` → clean (no `tsc` errors).
- `bun test` → **896 pass / 0 fail** across 58 files.
- The existing 8 `buildArgs` cases (incl. "argv identical to today") pass unchanged — the
  byte-identity guard for back-compat.
- The six concrete plays (`src/play/*.ts`) compile untouched — `tools?` optionality proven.

## What remains (out of scope — T-032-02)

- Read the project's available MCP server ids (the `.mcp.json` read that feeds `available`).
- Thread `resolveTools`'s output through `dispense` → `buildArgs` at cast time.
- Raise the missing-MCP andon on the `{ ok: false, missing }` branch.
- The `decompose-epic` proof play declaring `tools`, and skills injection (deferred).
