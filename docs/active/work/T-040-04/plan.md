# T-040-04 — Plan: init-idempotency-and-validate

Ordered, independently verifiable steps to produce and prove the one guarded-live test file.
Because there is a single file and no source-dependency chain, the steps are author → verify →
commit, with the testing strategy spelled out up front.

## Testing strategy

- **This ticket IS a test.** The deliverable is the proof, so "testing strategy" = the structure
  of the proof itself plus the gate that confirms it green.
- **Guarded-live, not unit:** the test runs against the real `lisa` binary, gated by
  `describe.skipIf(!Bun.which("lisa"))`. On a box with lisa it executes fully; without lisa it
  skips cleanly (0 failures). The pure machinery it leans on (manifest, planner, no-clobber,
  idempotency, `countDemandRows`) is already exhaustively unit-tested in `init-effect.test.ts`
  and `init-core.test.ts` — this file adds ONLY the live lisa-validity dimension.
- **Verification oracle for each AC clause:**
  - *first run creates the tree* → every `SCAFFOLD_MANIFEST` path `exists()` after `runInit` #1.
  - *`lisa validate` passes* → `lisaValidate(root) === 0` after #1 and after #2.
  - *second run zero new writes* → `result.created === []` && `result.skipped.length === 17`.
  - *board has no fabricated demand* → `countDemandRows(demand.md) === 0` &&
    `countDemandRows(demand-cleared.md) === 0`.
  - *(bonus) one-way to lisa* → the seed ticket is byte-identical after `runInit`.
- **Green-before-merge:** the full `bun test` suite must pass (the new file green or skipped) and
  `tsc --noEmit` clean. The existing 1032+ tests must stay green (this file adds tests, changes no
  source, so no regression is possible by construction — confirmed by running the whole suite).

## Steps

### Step 1 — Author `src/init/init-idempotency.test.ts`

Write the file per Structure: header, `LISA` guard constant, `lisaInit` / `lisaValidate` / `exists`
helpers, `SEED_TICKET` + `TICKET_REL` constants, and the `describe.skipIf(!LISA)` block with Test A
(twice-run end-to-end) and Test B (one-way byte-identity).

- **Verify:** `tsc --noEmit` is clean (types line up: `Bun.which` → `string | null`,
  `Bun.spawnSync(...).exitCode` → `number`, the `runInit` outcome narrowed before reading `.result`).

### Step 2 — Run the new file in isolation, live

`bun test src/init/init-idempotency.test.ts`.

- **Verify (lisa present):** 2 pass, 0 fail. Watch for: the pre-`vend init` `lisaValidate` returning
  0 (proves the seed ticket makes the fixture valid), and the post-runInit validates returning 0.
- **Sanity on the skip path:** confirm the block is a `describe.skipIf` so that on a lisa-less box it
  reports skipped, not failed. (Can't remove lisa here; rely on the `skipIf` semantics + the guard
  constant being correct.)

### Step 3 — Run the full init suite, then the whole gate

`bun test src/init/` then `bun test` (whole suite) and `bun run check:typecheck`.

- **Verify:** init suite green; whole suite green (prior count + 2, or + the new file's 2 with the
  rest unchanged); typecheck clean. No existing test perturbed (no source touched).

### Step 4 — Update progress.md

Record actual results: pass counts, the live validate exit codes observed, any deviation from the
plan, and the green-gate confirmation.

### Step 5 — Commit

One atomic commit: the test file + the T-040-04 work artifacts.
`test(init): prove vend init → lisa-valid + idempotent end-to-end (T-040-04)`.

- **Verify:** `git status` clean afterward except intended files; the commit message names the ticket.

## What could go wrong (and the planned response)

- **`lisa validate` unexpectedly red after `vend init`** → would mean vend's tree collides with
  lisa's. Go-and-see already disproved this, but if it surfaced: inspect the validate stderr, identify
  the colliding path, and (only then) reopen T-040-01's manifest. Not expected.
- **`lisa init` needs a flag / prompts** → go-and-see showed it runs headless cwd-targeted and exits
  0. If a lisa version prompted, the spawn would hang/fail and `lisaInit` would throw — surfaced, not
  masked.
- **Type friction on the `InitOutcome` union** → narrow with `if (outcome.kind !== "scaffolded")
  throw` before touching `.result`, the exact idiom already used in `init-effect.test.ts`.
- **Temp-dir leak on assertion failure** → `rm` in `finally` in both tests.

## Out of scope

- `--check-tools` (zellij/claude) — that is `vend doctor` / E-042, not this scaffold proof.
- Testing the CLI `import.meta.main` shell — house rule leaves it untested; T-040-03 live-smoked it.
- Any production verb change — this slice proves the existing implementation, it does not extend it.
