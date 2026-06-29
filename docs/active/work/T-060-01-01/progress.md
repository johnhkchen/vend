# Progress — T-060-01-01

## Status: COMPLETE — all plan steps done, gate green.

## Steps executed (all per plan, no deviations)

- **Step 1 — `PlayTools.optionalMcp`** ✅
  `src/engine/play.ts`: added `readonly optionalMcp?: readonly string[]` to `PlayTools`,
  documented (present ⇒ scoped like required; absent ⇒ degrade w/ reducedGrounding, not andon;
  declaring it opts into strict scoping). Annotated `mcp` as the required list for contrast.

- **Step 2 — `ResolvedTools` + `resolveTools`** ✅
  `src/engine/cast-core.ts`: added `reducedGrounding: boolean` to the strict success variant;
  updated both doc-blocks. `resolveTools` now splits required vs optional: required-missing ⇒
  andon (unchanged); optional ids filtered into present (scoped) / absent (dropped);
  `reducedGrounding = presentOptional.length < optional.length`; `scopes` now also true when
  `optionalMcp` declared; strict result scopes `[...required, ...presentOptional]`.
  `toolFlags` unchanged (reads `resolved.mcp`, which already excludes absent optionals).

- **Step 3 — reclassify `DECOMPOSE_TOOLS`** ✅
  `src/play/decompose-epic-core.ts`: `mcp: ["codebase-memory-mcp"]` →
  `optionalMcp: ["codebase-memory-mcp"]`; doc-block bullet rewritten with the E-060 #3 rationale.

- **Step 4 — comment fix** ✅
  `src/play/decompose-epic.ts` (~202-206): the "andons before dispense" comment replaced with
  the degrade truth (optional grounding; absent ⇒ reduced-grounding clear, not andon).

- **Step 5 — tests** ✅
  `src/engine/cast-core.test.ts`:
  - added `reducedGrounding: false` to the 3 existing strict `toEqual`s;
  - **rewrote the `ABSENT MCP` live-proof** (the AC test): `resolveTools(DECOMPOSE_TOOLS, [])`
    now asserts the degraded strict result (`mcp:[]`, `allowedTools:["Read","Grep","Glob"]`,
    `reducedGrounding:true`, no andon) and the projected argv (read-only built-ins + strict, no
    `--mcp-config`, no `mcp__codebase-memory-mcp`);
  - added 5 `resolveTools` optional-MCP unit tests (present, absent, mix, required-still-andons
    regression, optional-only opts-into-strict) and 1 `toolFlags` degraded-shape test.

## Verification

- `bun test src/engine/cast-core.test.ts` → 51 pass / 0 fail.
- `bun run check:typecheck` (`tsc --noEmit`) → clean.
- `bun test` (full suite) → **1333 pass / 0 fail**, 81 files.

## Deviations from plan

None. The plan held exactly. `toolFlags` needed no edit as predicted; the present-case argv
live-proof (cast-core.test.ts:301-310) and the WIRING GUARD stayed green unchanged.

## Commit

Single cohesive commit on `main` (the change is small and one logical unit). See review.md.
