# T-040-01 — Progress

## Status: implementation complete, gate green, commit deferred to Lisa

All plan steps executed. The pure scaffold core + its unit test are in place and the
full check passes.

## Steps completed (per plan.md)

- **Step 1 — skeleton + types.** `src/init/init-core.ts` created with the pure-core
  header comment and `ScaffoldEntry` / `InitAction` / `InitPlan` types.
- **Step 2 — seed content.** `EMPTY_BOARD`, `EMPTY_ARCHIVE`, `PM_README`,
  `PROCESS_GATE`, `CHARTER_STUB`, `VISION_STUB`, `VEND_GITIGNORE`. Board + archive are
  header + empty-state only — zero demand rows.
- **Step 3 — markers + manifest.** `LISA_MARKERS` (`as const`) and the 17-entry
  `SCAFFOLD_MANIFEST` (10 dirs + 7 files, parent-before-child order).
- **Step 4 — `normalizePath` + `isLisaProject`.** Internal normalizer (strip `./`,
  trailing `/`); predicate is `LISA_MARKERS.some(has)` over the normalized listing.
- **Step 5 — `planInit`.** Maps the manifest → `InitAction[]` (present⇒skip,
  absent⇒create) + `creates`/`skips` projections; manifest defaults to the canonical one.
- **Step 6 — `countDemandRows`.** Two-shape structural counter (`^vend chain "`,
  `^- **E-\d`); returns 0 on both seeds, ≥1 on a populated board.
- **Step 7 — tests.** `src/init/init-core.test.ts` — 20 tests across the three AC
  clauses + normalization + a focused fixture manifest + manifest sanity.
- **Step 8 — gate.** Run results below.

## Verification

- `bun test src/init/init-core.test.ts` → **20 pass / 0 fail**, 73 expect() calls.
- `bun run check:typecheck` (`tsc --noEmit`) → clean.
- `bun run check` (baml:gen + typecheck + full `bun test`) → **1020 pass / 0 fail**
  across 67 files — no regressions elsewhere.

## Deviations from plan

- **Step 8 `bun run lint`:** the repo has **no `lint` script** yet (`package.json`
  exposes only `check:*` + `build`; CLAUDE.md lists `bun run lint` as an *intended*
  convention not yet scaffolded). Skipped as non-existent, not as a failure. `tsc`
  (strict + `verbatimModuleSyntax`) is the live static gate and passes. No other
  deviations — the module matches structure.md exactly.

## Commit

**Deferred to Lisa**, matching this repo's sweep pattern (cf. T-038-01: "commit
deferred to Lisa"). The working tree carries `src/init/init-core.ts`,
`src/init/init-core.test.ts`, and the `docs/active/work/T-040-01/` artifacts. Intended
message when swept:
`feat(init): pure scaffold manifest, converge planner & lisa predicate (T-040-01)`.
Ticket frontmatter (phase/status) left untouched per the workflow — Lisa advances it.

## Hand-off to T-040-02

`planInit` + `SCAFFOLD_MANIFEST` + `isLisaProject` are the seam. The write effect
(T-040-02) reads a real root listing, calls `isLisaProject` (refuse if false), then
applies `planInit(existing).creates` — mkdir for `dir`, write-if-absent for `file` —
never clobbering. `normalizePath` already absorbs `readdir` trailing-slash quirks.
