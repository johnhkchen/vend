# T-040-04 — Review: init-idempotency-and-validate

Handoff document. The closing slice of E-040 (`vend-init-scaffold`): an end-to-end, guarded-live
proof that `vend init` turns a bare lisa project into a lisa-valid vend+lisa project with an
honestly-empty board, and that a re-run is a no-op. Read this to understand the work without the diff.

## What changed

**Source (1 file created, 0 modified, 0 deleted):**

- `src/init/init-idempotency.test.ts` — a guarded-live end-to-end test, ~125 lines, 2 tests:
  - **Test A** — `lisa init` + one seed ticket (a *valid* bare lisa project) → assert `lisa validate`
    exit 0 → `runInit` #1 → assert every `SCAFFOLD_MANIFEST` path exists, `lisa validate` exit 0, and
    `countDemandRows` of both `demand.md` and `demand-cleared.md` is 0 → `runInit` #2 → assert
    `created === []`, `skipped.length === 17`, and `lisa validate` exit 0.
  - **Test B** — one-way to lisa: the pre-existing lisa ticket is byte-identical after `vend init`.
  - Gated by `describe.skipIf(!Bun.which("lisa"))`; helpers `lisaInit` / `lisaValidate` (spawn the
    real binary) / `exists`; constants `SEED_TICKET` / `TICKET_REL`. Drives `runInit` directly (the
    seam that IS `vend init`), not the untested CLI shell.

**No production verb changed.** `init-core.ts`, `init-effect.ts`, `cli.ts` are untouched — the
machinery under proof (T-040-01..03) was already complete and correct; this slice commits the proof.

**Artifacts:** `research.md`, `design.md`, `structure.md`, `plan.md`, `progress.md`, this file.

## Test coverage

- **New file:** 2 pass / 0 fail / 27 expect() calls (29 ms), live against `lisa` 0.2.11.
- **Init suite:** 30 pass / 0 fail across 3 files.
- **Full suite:** **1047 pass / 0 fail** / 2733 expect() calls (1.40 s). `tsc --noEmit` clean.
- **AC mapping — every clause discharged** (see progress.md for the per-clause oracle): twice-run in
  a fresh bare-lisa temp project ✅; first run creates the tree ✅; `lisa validate` passes ✅; second
  run zero new writes ✅; `lisa validate` still passes ✅; board (and archive) has no fabricated
  demand rows ✅; plus a bonus one-way-to-lisa byte-identity assertion ✅.
- **No regression possible by construction:** no source touched; the suite count rose by exactly the
  2 added tests.

## Design decisions worth a reviewer's eye

1. **"Bare lisa project" = a *valid* lisa project (≥1 ticket), not raw `lisa init` output.** This is
   the load-bearing call (design D1), forced by a go-and-see finding: `lisa validate` FAILS on a
   ticketless project ("no tickets found"), and passes once a ticket exists. Since `vend init` neither
   creates nor should create tickets, the only coherent reading of "turns a bare lisa project into a
   lisa-VALID one" is that the *input* is already valid and `vend init` *preserves* validity. The seed
   ticket is **lisa work, not vend demand** — orthogonal to the demand board, which the test
   independently asserts is empty. This is the crux a reviewer should sanity-check.

2. **Drove the real `lisa` binary, guarded.** The proof's entire value is the live external contract,
   so a stubbed `lisa validate` was rejected. The guard (`skipIf(!Bun.which("lisa"))`) keeps a
   lisa-less CI box green by skipping, not failing — the AC's "guarded-live" word made literal. The
   pure dimensions (manifest, planner, no-clobber, idempotency) remain covered unconditionally by
   `init-core.test.ts` / `init-effect.test.ts`, so the skip path loses no pure coverage.

3. **Called `runInit(root)` directly, not the CLI subprocess.** `runInit` IS `vend init`; testing the
   seam (not the `import.meta.main` shell) is the house discipline, is faster, and yields structured
   `{created, skipped}` assertions instead of brittle stdout parsing. The CLI shell was live-smoked in
   T-040-03.

4. **A new file, not a block in `init-effect.test.ts`.** Quarantines the lisa-binary dependency behind
   its own `skipIf` so the pure init tests stay unconditional and mock-free — mirrors how
   `head-build-core.test.ts` isolates its git-spawning integration proof.

## Open concerns / limitations

- **lisa-version coupling (accepted).** The test pins `lisa`'s exit-code + "≥1 ticket" semantics
  (v0.2.11). A future lisa that changes these would surface here — which for an end-to-end proof is
  the intended behavior, not a flake. The guard means it can never break a box that lacks lisa.
- **CLI `import.meta.main` arm still unit-untested** (uniform house rule). Its logic is `runInit`'s
  tested switch + `process.exit`; live-smoked in T-040-03 and exercised again by the go-and-see here.
- **`--check-tools` deliberately not used** — zellij/claude runtime readiness is `vend doctor` (E-042),
  out of scope for this scaffold-validity proof.

## Critical issues needing human attention

None. The gate is green, the AC is fully discharged against the real `lisa` binary, no production
code changed, and the epic's "done looks like" is now proven and committed-ready.
