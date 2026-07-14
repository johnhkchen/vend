# T-040-02 — Plan: ordered, verifiable steps

The work is one cohesive impure module + its guarded-live test, landing in a single
commit (the house "one effect + its temp-dir test" unit). Steps are ordered so each is
checkable; the whole lands green under `bun run check`.

## Testing strategy

- **Unit/guarded-live test** is the deliverable proof — `src/init/init-effect.test.ts`, an
  ordinary `bun test` against a **real temp-dir projectRoot** (the `propose-effect.test.ts`
  discipline). No mocks: a real `mkdtemp` dir, real `mkdir`/`writeFile`, asserted with real
  `stat`/`readFile`, torn down in `finally`. This is exactly what the AC asks for ("a
  guarded-live temp-dir test seeded as a bare lisa project").
- **No new unit-test surface in the core** — `init-core.ts` is untouched; its pure tests
  already cover `planInit`. This effect's test exercises the impure apply + no-clobber +
  idempotency end-to-end.
- **Verification gate**: `bun run check` (baml:gen → `tsc --noEmit` → `bun test`) green,
  then the on-stop `check:committed` requires the work committed.

## Steps

### Step 1 — Write the effect module `src/init/init-effect.ts`

- Header comment stating the rule (mirror `propose-effect.ts`): logic lives in the pure
  core; this is the thin impure shell that applies a plan; addon-free; no-clobber absolute;
  the lisa-gate is the CLI's job.
- Imports: `{ mkdir, writeFile, stat }` from `node:fs/promises`; `{ dirname, join }` from
  `node:path`; `{ SCAFFOLD_MANIFEST, planInit, type ScaffoldEntry }` from `./init-core.ts`.
- `export interface InitApplyResult { created; skipped }`.
- `async function pathExists(abs)`: `stat` → true; catch → `code === "ENOENT"` ? false :
  rethrow.
- `export async function applyInitScaffold(projectRoot, manifest = SCAFFOLD_MANIFEST)`:
  scan present manifest paths → `planInit(existing, manifest)` → apply `plan.creates`
  (dir: recursive mkdir; file: recursive mkdir of parent then `wx` write, EEXIST→skip,
  else throw) → return `{created, skipped}`.

**Verify:** `tsc --noEmit` clean (types line up with `init-core` exports); the module
imports no BAML/engine/addon.

### Step 2 — Write the guarded-live test `src/init/init-effect.test.ts`

- Temp-dir kit + `seedBareLisa()` helper (mkdtemp + write `CLAUDE.md`).
- Block 1 — bare → full tree: every manifest path exists; file contents verbatim; board +
  archive `countDemandRows === 0`; `created.length === manifest.length`, `skipped` empty;
  `CLAUDE.md` untouched.
- Block 2 — no-clobber: pre-seed a sentinel at `docs/knowledge/vision.md`; apply; the file
  stays byte-identical and lands in `skipped`; the rest of the tree is created.
- Block 3 — idempotent second apply: apply, snapshot, apply again; `created` empty,
  `skipped.length === manifest.length`, all files byte-identical to snapshot.
- Block 4 — focused 2-entry fixture manifest: both created on a fresh root; pre-seed the
  file then re-apply → file skipped + byte-identical.

**Verify:** `bun test src/init/init-effect.test.ts` green; all four blocks pass.

### Step 3 — Full gate

- `bun run check` (baml:gen + `tsc --noEmit` + `bun test`) green across the whole repo (no
  regression in the existing pure `init-core` tests or any sibling).

**Verify:** check exits 0.

### Step 4 — Commit

- Single commit: `feat(init): apply scaffold plan to the filesystem, no-clobber (T-040-02)`.
- Body notes: impure effect mirrors `propose-effect.ts`; no-clobber via recursive mkdir +
  `wx` flag; reuses the pure `planInit`/`SCAFFOLD_MANIFEST`; CLI arm + lisa-gate deferred to
  T-040-03.
- Per CLAUDE.md / project convention, the commit is left for Lisa's serialized loop to make
  (the repo's `check:committed` on-stop gate handles "done means committed"); this session
  produces the work + artifacts and stops after Review. **Deviation note for Implement:** do
  not hand-commit if the project's Lisa loop owns serialization — record completion in
  `progress.md` and let the sweep commit, matching the T-038-01 / T-039-01 precedent.

## Risks & mitigations

- **TOCTOU between scan and write** → mitigated by the `wx` exclusive flag (EEXIST→skip), so
  no-clobber holds even if a file appears late or two applies race.
- **A future manifest edit breaking parent-before-child order** → mitigated by the per-file
  recursive `mkdir(dirname)` (the effect never relies on the order invariant).
- **An unexpected fs error swallowed** → only EEXIST is caught (and reclassified to skip);
  every other error propagates, so a real fault is loud (the `propose-effect` rule).

## Done when

All four test blocks green, full `bun run check` green, work recorded in `progress.md`,
`review.md` written. The effect turns a bare lisa temp dir into the full vend scaffold,
leaves any pre-existing file byte-identical, and a second apply is a no-op.
