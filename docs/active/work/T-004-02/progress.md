# Progress — T-004-02 refuse-materialize-on-collision

## Status: complete

All five plan steps executed; full green bar verified (`tsc --noEmit` clean,
`bun test` 125 pass / 0 fail).

## Steps

### Step 1 — `run-log.ts` outcome ✅
Appended `"id-collision"` to `RUN_OUTCOMES` and extended the tuple doc comment to
name the new state (← `materialize`'s cross-board guard). `RunOutcome` and
`assertOutcome` pick it up automatically.

### Step 2 — `project-context.ts` `listIdsIn` ✅
Extracted the `readdir → *.md → strip` listing into an exported
`listIdsIn(dir: string)`; private `listIds(root, dir)` now delegates
`listIdsIn(join(root, dir))`. `buildProjectSnapshot`/`assembleInputs` behavior
byte-identical.

### Step 3 — `materialize.ts` guard + `IdCollisionError` ✅
Added the two imports (`detectCollisions`, `listIdsIn`), exported
`IdCollisionError` (carries `readonly collisions`), and prefixed `materialize`
with the gather → `detectCollisions` → throw-before-write guard. Updated the
module header to describe the new read-then-write verb. No import cycle
(`project-context` imports only node builtins).

### Step 4 — `materialize.test.ts` fixture ✅
Added a `workPlan()` plain-object helper (reusing the existing `ticket()`/`story()`
draft fixtures) + a `mkdtemp`/`afterEach`-cleanup harness, and two real-fs tests:
populated board → `rejects` `IdCollisionError` naming `["T-001-01"]`, sentinel
unchanged, no new files, stories dir never created; fresh board → both files
written. No BAML addon (type-only `WorkPlan` import, plain-object plan).

### Step 5 — `decompose-epic.ts` catch + relabel ✅
Imported `IdCollisionError`; introduced `let outcome = verdict.outcome`; wrapped
`materialize` + `lisaValidate` in `try`, catching `IdCollisionError` → set
`outcome = "id-collision"` + stdout andon naming the ids, re-raising any other
error; swapped the `appendRunLog` field and the return to the mutable `outcome`.
`verdict.gateLog` logged unchanged (the gates passed).

### Step 6 — green bar + commit ✅
- `bun run check:typecheck` → no errors.
- Targeted (materialize, decompose-epic-core, run-log, project-context, id-guard)
  → 56 pass / 0 fail.
- `bun test` (full) → **125 pass / 0 fail** (was 122; +2 new materialize
  fixtures, +1 baseline drift — no regression).
- Committed all five files as one atomic change.

## Deviations from plan

- **Test A error capture.** Used a `.catch((e) => { caught = e })` capture +
  `toBeInstanceOf` / `.collisions` `toEqual`, rather than `rejects.toBeInstanceOf`,
  so the same caught instance is asserted for both type and payload in one place
  (the Plan §Risks fallback). Cleaner than two separate `rejects` matchers.
- **Stories-dir non-creation assertion added.** Beyond "no new files", Test A also
  asserts the stories dir was never created (`readdir … catch → "ENOENT"`),
  proving the throw truly preceded every `mkdir` — a stronger "zero partial
  materialization" check than the plan specified.

No other deviations; the structure and step ordering held exactly.

## Notes

- `cli.ts` exit mapping unchanged: `outcome === "success" ? 0 : 1` already maps
  `id-collision` → exit 1.
- The runner relabel is the untested impure seam ("proven live"), consistent with
  `runDecomposeEpic` never being unit-tested; the guard's logic is covered by the
  materialize fixture + id-guard unit tests.
