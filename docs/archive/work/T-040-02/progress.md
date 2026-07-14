# T-040-02 — Progress

## Status: implementation complete, green; commit deferred to Lisa's sweep

Followed the plan with no material deviations.

### Completed

- **Step 1 — effect module** `src/init/init-effect.ts` (create): `InitApplyResult`,
  internal `pathExists` (ENOENT-tolerant probe), and `applyInitScaffold(projectRoot,
  manifest = SCAFFOLD_MANIFEST)`. Scans which manifest paths exist → `planInit` → applies
  only `plan.creates` (dirs via recursive mkdir; files via the exclusive `wx` flag with
  EEXIST→skip reclassification). Addon-free; imports only `node:fs/promises`, `node:path`,
  and the pure `./init-core.ts`.
- **Step 2 — guarded-live test** `src/init/init-effect.test.ts` (create): four describe
  blocks — full-tree on a bare lisa temp dir, no-clobber of a pre-seeded file, idempotent
  second apply, and a focused 2-entry fixture manifest. Real temp dirs via `mkdtemp`, torn
  down in `finally`.
- **Step 3 — full gate**: `bun run check` (baml:gen → `tsc --noEmit` → `bun test`) green.
  - `bun test src/init/` → 24 pass / 0 fail (139 assertions).
  - full repo → **1024 pass / 0 fail** across 68 files — no regression.

### Deviations from plan

None affecting code. As planned (Plan Step 4 deviation note), the commit is **left for
Lisa's serialized loop** — this session produces the work + artifacts and stops after
Review, matching the T-038-01 / T-039-01 precedent and the repo's `check:committed`
on-stop gate that owns "done means committed". Did not hand-commit.

### Notes for the reviewer

- `init-core.ts` was reused unchanged — the pure/impure split held; no reviewed module
  reopened.
- The `wx` (O_EXCL) flag is the TOCTOU-safe net beyond the plan's skip; block 2 + the
  fixture block both prove a user-edited file survives an apply byte-identical.
- The `isLisaProject` refusal + CLI dispatch + exit codes are **out of scope** here
  (T-040-03 `init-cli-command`), per the Design D5 boundary.
