# T-040-02 — Review: the init scaffold write effect

Handoff for a human reviewer — what changed, how it's covered, what to watch. Read the
ticket + this file and you can review the diff without re-deriving the design.

## What this ticket delivered

The impure write effect that turns the pure scaffold *plan* (T-040-01) into files on disk:
`applyInitScaffold(projectRoot)` scans which manifest paths exist, asks `planInit` for the
create-vs-skip set, and materializes only the creates — **write-if-absent, never
clobbering**. A bare lisa project becomes the full vend scaffold (board, cleared archive,
`epic/ stories/ tickets/ work/`, `pm/` desk, knowledge stubs, `.vend/` state) in one call;
a re-run is a no-op.

## Files changed

| File | Op | Notes |
|---|---|---|
| `src/init/init-effect.ts` | **create** | ~95 lines. `InitApplyResult`, `pathExists` (internal), `applyInitScaffold`. Imports only `node:fs/promises`, `node:path`, `./init-core.ts`. |
| `src/init/init-effect.test.ts` | **create** | ~155 lines, 4 describe blocks, real temp-dir (`mkdtemp`). |

`init-core.ts` reused **unchanged** — no reviewed/committed module reopened. No CLI,
`package.json`, or gitignore changes (those are T-040-03).

## How the AC is met

> A guarded-live temp-dir test seeded as a bare lisa project: applying the effect creates
> the full tree; a pre-seeded file is left byte-identical (no clobber); a second apply adds
> no files and changes none.

- **Full tree** — block 1 seeds a bare lisa temp dir (`CLAUDE.md`), applies, and asserts
  *every* `SCAFFOLD_MANIFEST` path exists, each file's contents equal its seed verbatim, the
  board + archive have `countDemandRows === 0` (honestly empty), `created.length ===
  manifest.length`, `skipped` empty, and the pre-existing `CLAUDE.md` is untouched.
- **No clobber** — block 2 pre-seeds a sentinel at `docs/knowledge/vision.md`, applies, and
  asserts the file is byte-identical and reported in `skipped` (the surrounding gap still
  filled). Block 4's fixture additionally mutates a created file and re-applies, proving a
  *user edit* survives byte-identical.
- **Idempotent second apply** — block 3 applies, snapshots all file contents, applies again,
  and asserts `created` empty, `skipped.length === manifest.length`, every file
  byte-identical to the snapshot, nothing missing.

## Test coverage

- `bun test src/init/` → **24 pass / 0 fail**, 139 assertions (the 4 new blocks + the
  existing pure `init-core` tests).
- `bun run check` (baml:gen → `tsc --noEmit` → `bun test`) → **1024 pass / 0 fail** across
  68 files. No regression.
- Coverage shape mirrors the canonical effect tests (`propose-effect.test.ts`): real
  filesystem, no mocks, `finally` teardown. The full-17 manifest *and* a focused 2-entry
  fixture are both exercised, so the create/skip partition is proven independent of the
  manifest's current size.

## Design decisions worth a reviewer's eye

- **Two-layer no-clobber** (Design D3): the plan skips present paths, *and* file writes use
  the exclusive `wx` (O_CREAT|O_EXCL) flag, catching EEXIST → reclassify create→skip. This
  closes the TOCTOU window between scan and write; no read-modify-write, no truncation ever.
  Dirs use `mkdir({recursive:true})` (inherently idempotent).
- **Scan probes manifest paths, not a full walk** (D2): `planInit` only inspects manifest
  paths, so the effect `stat`s the ≤17 of them rather than recursively reading the whole
  project. The create/skip decision stays solely in the pure planner.
- **Slim `{created, skipped}` result, not `EffectResult`** (D4): this is not a play (no cast
  loop), so it does not borrow the engine's cast-result type.
- **Error discipline**: only ENOENT (probe) and EEXIST (write) are caught — both are
  expected idempotent cases. Every other fs error propagates, so a real fault is loud (the
  house "a genuine fs failure throws" rule).

## Open concerns / known limitations (none blocking)

1. **The `isLisaProject` refusal is not here** — by design (D5). `applyInitScaffold` will
   scaffold *any* directory it's handed. The lisa-detection gate + the "run `lisa init`
   first" fix-it hint + arg-parse + exit codes belong to **T-040-03 `init-cli-command`**,
   which composes `isLisaProject` (core) with this effect. A reviewer should confirm that
   composition lands in T-040-03 so a non-lisa dir is refused at the CLI, not silently
   scaffolded.
2. **No partial-failure rollback** — if an fs error throws mid-apply (e.g. permissions),
   already-created entries remain. This is acceptable and matches the idempotent contract:
   a re-run after fixing the cause converges (the no-clobber writes skip what landed). Worth
   a one-line mention in the CLI's user-facing error path (T-040-03).
3. **Knowledge stubs are placeholders** — rich `charter.md` / `vision.md` content is the
   explicitly-deferred follow-up epic (PE-7); this effect writes the manifest's stub seeds
   verbatim.

## Recommendation

Ready to merge once Lisa's sweep commits it. The AC is fully met with a real guarded-live
test, the full repo gate is green, and the pure/impure + one-way-to-lisa boundaries hold.
Next in E-040: **T-040-03** wires the `vend init` CLI arm (lisa-gate + dispatch) on top of
this effect.
