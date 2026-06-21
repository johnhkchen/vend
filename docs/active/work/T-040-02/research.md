# T-040-02 — Research: the init scaffold write effect

Descriptive map of what already exists and how it constrains the write effect. No
solutions proposed here — only the terrain.

## The ticket in one line

Apply a scaffold plan against the filesystem: create the missing dirs/files
**write-if-absent**, never clobbering existing content, materializing the full vend
scaffold (board, cleared archive, epic/stories/tickets/work dirs, `pm/` desk, knowledge
stubs, `.vend/` state). Depends on T-040-01 (the pure planner), which is `phase: done`.

## The dependency: T-040-01's pure core (committed, present)

`src/init/init-core.ts` already ships the addon-free heart this effect plugs into:

- `type ScaffoldEntry = {kind:"dir",path} | {kind:"file",path,contents}` — the single
  shape both the planner and *this* effect derive from. Paths are project-root-relative,
  POSIX, no leading `./`.
- `type InitAction = {op:"create",entry} | {op:"skip",path,kind}`.
- `type InitPlan = {actions, creates: ScaffoldEntry[], skips: string[]}`.
- `const SCAFFOLD_MANIFEST: readonly ScaffoldEntry[]` — 17 entries (10 dirs, 7 files),
  ordered **parent-before-child** (explicitly "creation-safe for a naive sequential write
  effect" — a courtesy left for *this* ticket, per the core's header comment).
- `function planInit(existing, manifest = SCAFFOLD_MANIFEST): InitPlan` — PURE, total,
  deterministic. Present ⇒ skip, absent ⇒ create. `creates` is exactly what this effect
  must write; `skips` is what it must leave untouched.
- `function isLisaProject(existing): boolean` — the lisa-detection predicate, kept
  separate. The core's design (D4) names the composition: "the T-040-02 shell composes
  them — refuse if not a lisa project, else apply planInit." (See the boundary note below
  on where that refusal actually lands.)
- `function countDemandRows(contents): number` — the "honestly empty" measure; the seeds
  return 0.
- `normalizePath` (internal) — strips a leading `./` and a single trailing `/`, so a real
  `readdir`/`stat` listing matches a manifest path regardless of trailing-slash quirks.

The core's header is explicit that **this** module owns the first `node:fs` import in the
`src/init/` package: "The filesystem WRITE EFFECT (mkdir / write-if-absent / no-clobber)
is the sibling ticket T-040-02 — a thin impure shell that APPLIES a plan this module
produces."

## The house pure/impure split (the precedent this effect must mirror)

The repo splits every world-touching play into three layers; the relevant two here:

- **Pure core** keeps a LOUD, unit-tested contract, no fs. (`init-core.ts`,
  `committed-core.ts`, `propose-core.ts`, `expand-core.ts`.)
- **Effect** is the addon-free-but-IMPURE verb: imports only `node:fs/promises`,
  `node:path`, and the pure core (type-only BAML imports if any). It is tested as an
  ordinary `bun test` against a **real temp-dir projectRoot**.

Canonical effect siblings, read in full:

- `src/play/propose-effect.ts` — `proposeEpicEffect(card, ctx)`: `const dir =
  join(ctx.projectRoot, EPIC_DIR); await mkdir(dir, {recursive:true}); await
  writeFile(path, body, "utf8")`. Returns `EffectResult` data, never throws across the
  boundary for a clean refusal (returns `{ok:false, outcome:"id-collision"}`); a genuine
  fs failure *does* throw.
- `src/play/expand-effect.ts` — same shape; staging writes are idempotent by overwrite
  (a draft you iterate on). NOTE the divergence: expand *overwrites* deliberately; this
  effect must **never** overwrite (no-clobber is the headline AC).
- `src/play/project-context.ts` — `listIdsIn` / `assembleInputs`: the impure reader half;
  `readdir` with an ENOENT→[] tolerance so a fresh project doesn't throw.

## The fs idioms already in the codebase

- Writes: `import { mkdir, writeFile } from "node:fs/promises"`; `mkdir(dir,
  {recursive:true})` then `writeFile(path, contents, "utf8")`.
- Existence / tolerance: the ENOENT guard is uniform —
  `(err as NodeJS.ErrnoException).code === "ENOENT"` (`src/present/presets.ts:161`,
  `src/log/run-log.ts:543`, `src/graph/load.ts`, `src/play/work.ts:96`). A missing file
  is "not there", not a fault; any *other* code propagates.
- Temp-dir tests: `mkdtemp(join(tmpdir(), "vend-<name>-"))` seeded with `mkdir`/`writeFile`,
  asserted with `readFile`, torn down in a `finally` with `rm(root, {recursive:true,
  force:true})`. Exact precedent: `src/play/propose-effect.test.ts` (`seedRoot` helper),
  also `expand-effect.test.ts`, `survey-effect.test.ts`, `materialize.test.ts`.

## Build / test / gate reality

- Runtime: Bun + TypeScript, `verbatimModuleSyntax` (type-only imports erased — so a
  type-only BAML import never loads the native addon; not relevant here since the effect
  needs no BAML at all).
- Scripts: `bun run check` = `baml:gen && check:typecheck (tsc --noEmit) && check:test
  (bun test)`. That green run is the merge gate. `check:committed` (the on-stop hook) then
  enforces "done means committed".
- `EffectResult` (`src/engine/play.ts:99`) is the *play* return contract (`ok`, `outcome`,
  `detail`, `artifacts`, `produced`). This effect is **not a play** (it casts nothing,
  spends no mana — exactly as `init-core` is not a play and lives in `src/init/`, not
  `src/play/`). So it is free to define its own slim result type rather than borrow the
  cast-loop's `EffectResult`.

## Boundaries & constraints (load-bearing)

- **No-clobber is absolute** (AC + epic A5): a pre-seeded file must end byte-identical; a
  second apply adds no files and changes none. The planner's skip already encodes this from
  a listing snapshot — but the effect writes in a window after that snapshot, so a
  belt-and-suspenders write-if-absent at the fs layer is warranted.
- **One-way vend → lisa** (E-040): the manifest creates only vend-owned paths; the root
  `.gitignore` is never mutated (the `.vend/.gitignore` localizes that intent). This effect
  inherits that for free — it writes *only* manifest paths.
- **Where the `isLisaProject` refusal lands:** E-040 has a dedicated CLI ticket
  (`init-cli-command`, T-040-03) that owns arg-parse + dispatch + the lisa-detection gate
  and the fix-it hint on a non-lisa dir. T-040-02's AC is purely the apply/no-clobber/
  idempotency contract. So the refusal is the CLI's composition (`isLisaProject` from core
  + this effect); whether to *also* expose a guarded convenience here is a Design question.
- **Pure-core untouched:** re-opening `init-core.ts` to add an fs verb would violate the
  reviewed-pure-module rule (the exact reason `propose-effect.ts` exists apart from
  `propose-core.ts`). The effect is a NEW file.

## Open questions for Design

1. How does the effect learn `existing`? Probe each manifest path (`stat`) vs. a full
   recursive `readdir` walk vs. accept a caller-supplied listing.
2. No-clobber primitive: trust `plan.creates`, or also use the `wx` (`O_EXCL`) write flag
   as a TOCTOU-safe net (and reclassify an EEXIST create → skip in the result)?
3. Result shape: a slim `{created, skipped}` vs. echoing the full `InitPlan`.
4. Does the effect embed the `isLisaProject` gate, or stay a pure-apply seam the CLI
   composes?
