# T-040-04 — Research: init-idempotency-and-validate

The closing slice of E-040 (`vend-init-scaffold`). The prior three slices built the
machinery; this one **proves the epic's "done looks like" end-to-end**: `vend init` turns
a bare lisa project into a lisa-valid vend+lisa project with an honestly-empty board, and a
re-run converges to a no-op. Descriptive only — what exists, where, and the constraints the
proof must satisfy.

## The acceptance criterion (verbatim intent)

> A guarded-live test runs `vend init` twice in a fresh bare-lisa temp project: the first
> run creates the tree and `lisa validate` passes; the second run reports zero new writes
> and `lisa validate` still passes; the seeded demand board contains no fabricated demand
> rows.

Three claims to discharge, all in ONE guarded-live test:
1. **First run** → the vend tree exists AND `lisa validate` passes.
2. **Second run** → zero new writes (idempotent A5) AND `lisa validate` still passes.
3. **Board honesty** → the seeded demand board (+ archive) has zero fabricated demand rows.

## What already exists (the machinery under proof)

The implementation is COMPLETE across T-040-01..03; this ticket adds no production verb.

- **`src/init/init-core.ts` (T-040-01, pure):**
  - `SCAFFOLD_MANIFEST` — the 17-entry canonical tree (dirs + seed files), parent-before-child.
  - `planInit(existing, manifest?)` — the converge planner (present⇒skip, absent⇒create).
  - `isLisaProject(existing)` — true iff a root entry is in `LISA_MARKERS` (`CLAUDE.md` | `.lisa.toml`).
  - `countDemandRows(contents)` — counts the two structural demand-row shapes (a `vend chain "…"`
    pull line, a `- **E-NN …` cleared row). **Seeds must return 0.** This is the board-honesty oracle.
- **`src/init/init-effect.ts` (T-040-02/03, impure):**
  - `applyInitScaffold(root, manifest?)` → `{created, skipped}` — scan → plan → write-if-absent
    (dirs via recursive mkdir, files via exclusive `wx`). No-clobber is absolute.
  - `runInit(root)` → `InitOutcome` = `{kind:"not-lisa",root}` | `{kind:"scaffolded",result}` —
    the refuse-or-apply composition the CLI calls. **This is exactly what `vend init` does**
    (the dispatch arm is `runInit(process.cwd())` + a printed tally).
- **`src/cli.ts`** — the `init` arm: `parseInitArgs` (flags-only) + the dispatch shell that
  lazy-imports `runInit`, prints `scaffolded — N created, M skipped`, exits 0 (or the `not-lisa`
  hint + exit 1). Unit-tested at the parser; the `import.meta.main` shell is untested by house rule.

## `lisa` — the external contract this proof leans on (go-and-see, verified live)

`lisa` is a real binary on PATH (`/opt/homebrew/bin/lisa`, v0.2.11). Relevant subcommands:

- **`lisa init`** (cwd-targeted, headless, offline) scaffolds a BARE lisa project:
  `CLAUDE.md`, `.lisa.toml`, `.lisa/` (hooks + signals + .gitignore), `.claude/settings.local.json`,
  and `docs/active/{tickets,stories,work}` + `docs/archive/{tickets,stories,work}` +
  `docs/knowledge/rdspi-workflow.md`. Exits 0.
- **`lisa validate [--path P]`** validates the ticket DAG + project setup. Exit **0** = "All checks
  passed", exit **1** = errors found (the andon). `--check-tools` (NOT used here) additionally
  requires zellij + claude on PATH.

**The load-bearing discovery (go-and-see):** `lisa validate` on a freshly `lisa init`-ed project
**FAILS** (exit 1): `docs/active/tickets/: readiness: no tickets found. Create at least one ticket
file.` Adding ONE ticket flips it to exit 0: "All checks passed. 1 tickets, 1 ready, DAG valid."

→ **A literally ticketless project is never lisa-valid.** So "bare lisa project" in the AC/epic must
mean a *minimal VALID* lisa project (≥1 real ticket), not the raw `lisa init` output. `vend init`
does not — and must not — fabricate a ticket to reach validity; the ticket is pre-existing lisa work.
This is the central constraint Design resolves.

## The coexistence question (go-and-see, verified live)

Ran the full sequence in a temp dir: `lisa init` → seed one ticket → `lisa validate` (exit 0) →
`runInit` → `lisa validate` (exit 0) → `runInit` again → `lisa validate` (exit 0). Observed:

- 1st `vend init`: **11 created, 6 skipped**. The 6 skips are the dirs lisa already owns
  (`docs/active`, `docs/active/stories`, `docs/active/tickets`, `docs/active/work`, `docs/archive`,
  `docs/knowledge`) — no-clobber correctly defers to lisa's tree.
- 2nd `vend init`: **0 created, 17 skipped** — idempotent.
- The trees coexist under `docs/`: lisa's `docs/archive/{tickets,stories,work}` beside vend's
  `docs/archive/demand-cleared.md`; lisa's `docs/knowledge/rdspi-workflow.md` beside vend's
  `charter.md` + `vision.md`. No path collision; the seed `demand.md` is honestly empty.

So the epic's outcome already HOLDS in reality — the gap is a committed, repeatable proof.

## Test-pattern precedents in this repo

- **Guarded-live against a real temp dir** (`src/init/init-effect.test.ts`): `mkdtemp` →
  real fs ops → assert with `stat`/`readFile` → tear down in `finally`. No mocks.
- **Spawning an external binary in a test** (`src/ci/head-build-core.test.ts`): a `git(...)`
  helper over `Bun.spawnSync`, throwing on non-zero; throwaway repos torn down in `afterEach`.
- **Skipping when an external tool is absent:** no existing `skipIf` precedent — but `Bun.which`
  and Bun's `describe.skipIf`/`test.skipIf` are the idiomatic guard. The AC's word "**guarded**-live"
  points exactly here: the test runs live against real `lisa`, guarded to skip when lisa is off PATH.
- **The seam, not the shell:** every CLI `import.meta.main` arm is intentionally untested; the
  composition it calls (`runInit`) is the unit. This proof drives `runInit` directly, the house rule.

## Constraints / assumptions surfaced

- The test depends on `lisa` ≥ ~0.2.11 semantics (exit codes, the "≥1 ticket" readiness rule). A
  guarded-live test that surfaces a lisa contract change is a feature, not a flake.
- Must NOT pass `--check-tools` (would drag in zellij/claude — out of scope for this proof).
- Must NOT fabricate demand to chase validity: the seed ticket is *lisa* work, the demand board
  stays empty (`countDemandRows === 0`). The two are orthogonal — proving both is the point.
- Determinism: `lisa init` and `lisa validate` are offline and headless; the test stays sub-second
  modulo process spawn, no network.
- No production source change is expected — this is an end-to-end proof. If the proof exposed a
  defect, that would reopen T-040-02/03; go-and-see shows it does not.
