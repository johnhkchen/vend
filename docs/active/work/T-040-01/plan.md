# T-040-01 — Plan: ordered, verifiable steps

The work is one cohesive pure module + its test → **one atomic commit** gated by a
green `bun run check`. Steps below are the build order within that commit; each is
independently checkable.

## Testing strategy

- **Everything is unit-tested.** The deliverable is pure, so 100% of it is reachable by
  an ordinary `bun:test` file importing only `./init-core.ts` — the
  `committed-core.test.ts` discipline. No integration test here (the fs write effect and
  its guarded-live temp-dir test are **T-040-02**).
- **The AC maps 1:1 to test blocks** (see structure.md §coverage map): create-vs-skip
  set, `isLisaProject`, zero demand rows.
- **Verification gate:** `bun run check` = `baml:gen && tsc --noEmit && bun test` green.
  Also run `bun run lint` (lint + format) clean before commit.

## Steps

### Step 1 — module skeleton + types
Create `src/init/init-core.ts` with the header comment (the pure-core rule) and the
three exported types: `ScaffoldEntry`, `InitAction`, `InitPlan`.
**Verify:** `tsc --noEmit` passes (types compile, `readonly`/discriminated unions well-formed).

### Step 2 — seed-content constants
Add the module-local seed strings: `EMPTY_BOARD`, `EMPTY_ARCHIVE`, `PM_README`,
`PROCESS_GATE`, `CHARTER_STUB`, `VISION_STUB`, `VEND_GITIGNORE`. Board + archive carry
header + empty-state line only, **no demand rows**.
**Verify:** eyeball — no `vend chain "…"` line in `EMPTY_BOARD`, no `- **E-` line in
`EMPTY_ARCHIVE`. (Step 6's test makes this machine-checked.)

### Step 3 — `LISA_MARKERS` + `SCAFFOLD_MANIFEST`
Add the `as const` markers and the 17-entry manifest (10 dirs + 7 files, parent-before-
child order), each file entry pointing at its Step-2 const.
**Verify:** `tsc` passes; manifest length is 17; paths are root-relative POSIX with no
leading `./`.

### Step 4 — `normalizePath` + `isLisaProject`
Internal `normalizePath` (strip leading `./`, one trailing `/`). Export `isLisaProject`
= normalize listing → `Set` → `LISA_MARKERS.some(has)`.
**Verify:** quick REPL/`bun -e` smoke: `isLisaProject(["CLAUDE.md"])===true`,
`isLisaProject(["README.md"])===false`. Formalized in Step 7.

### Step 5 — `planInit`
Normalize `existing` → `Set`; map manifest → `InitAction[]` (present⇒skip, absent⇒
create); derive `creates` + `skips`. Default manifest = `SCAFFOLD_MANIFEST`.
**Verify:** `bun -e` smoke: `planInit([]).creates.length===17`;
`planInit(manifestPaths).creates.length===0`.

### Step 6 — `countDemandRows`
Add the two-shape counter. Confirm it returns 0 on both seed files and ≥1 on a control.
**Verify:** `bun -e` smoke against `EMPTY_BOARD`/`EMPTY_ARCHIVE` → 0.

### Step 7 — the test file (the AC)
Create `src/init/init-core.test.ts` per structure.md's coverage map: the three
create-vs-skip cases (+ normalization robustness + a focused 2-entry fixture manifest),
the five `isLisaProject` cases, the zero-demand-row assertions (+ positive control), and
the manifest-sanity block (unique paths, every file has contents, parent-before-child).
**Verify:** `bun test src/init/init-core.test.ts` green.

### Step 8 — full gate + commit
`bun run check` (baml:gen + typecheck + full `bun test` — no regressions elsewhere) and
`bun run lint` clean. Commit:
`feat(init): pure scaffold manifest, converge planner & lisa predicate (T-040-01)`.
Per the workflow, commit is incremental within Implement; the parallel lisa loop / Lisa
handles the sweep — do not flip ticket frontmatter.

## Risks & mitigations

- **R1 — manifest drift vs. real tree.** The seeds are stubs by design (PE-7), not copies
  of the live files. Mitigation: design.md/D6 fixes the *minimal-but-valid* bar; richer
  content is a deferred epic. Not a blocker.
- **R2 — `countDemandRows` false-positive on prose.** Mitigated by anchoring on the two
  *structural* shapes (`^vend chain "`, `^- **E-\d`), not generic bullets (D5). The
  positive-control test proves the regex fires; the empty-state assertions prove the
  prose doesn't trip it.
- **R3 — normalization mismatch with T-040-02's real `readdir`.** Mitigated by
  `normalizePath` on both sides + an explicit trailing-slash/`./` test. T-040-02 will
  feed real listings through the same predicate.
- **R4 — over-reach into the write effect.** Guardrail: zero impure imports; the first
  `node:fs` line is a T-040-02 review red flag. Enforced by the pure test importing only
  the core.

## Definition of done (this ticket)

- `src/init/init-core.ts` + `.test.ts` exist; `bun run check` + `bun run lint` green.
- `planInit` proven on empty / full / partial listings (correct create-vs-skip).
- `isLisaProject` true only for `CLAUDE.md`/`.lisa.toml`.
- `demand.md` + `demand-cleared.md` seed entries carry zero demand rows.
- review.md handed off; ticket frontmatter left for Lisa.
