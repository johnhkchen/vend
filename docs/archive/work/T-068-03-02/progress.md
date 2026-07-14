# Progress — T-068-03-02 doctor-orphan-check

## Status

Implementation complete; focused tests, typecheck, and the full repository gate are green. The
prerequisite detector has been committed; this ticket's implementation commit remains before Review.

## Completed

### Research

- Read AGENTS.md and the full RDSPI workflow.
- Read parent story S-068-03 before designing the ticket.
- Read the ticket, canonical vision, and charter grounding (P3/P4).
- Mapped the pure orphan detector from dependency T-068-03-01.
- Mapped canonical graph loading/model boundaries.
- Mapped doctor core, standard probe, kitchen probe, CLI dispatch, and cast preflight reuse.
- Identified the scope hazard of adding board hygiene to `probeDoctor`: it would also alter the
  cast precondition and could block repair work.
- Wrote `research.md`.

### Design

- Evaluated direct `probeDoctor` extension, CLI inlining, and a dedicated board probe.
- Chose a dedicated probe composed only into the non-kitchen `vend doctor` branch.
- Defined check naming, fix-it behavior, injected loader seam, and loader-error degradation.
- Wrote `design.md`.

### Structure

- Defined two new doctor files and the narrow CLI modification.
- Preserved graph detector, doctor renderer, cast preflight, and kitchen probe boundaries.
- Wrote `structure.md`.

### Plan

- Sequenced probe, deterministic tests, CLI composition, focused verification, live observation,
  full gate, commits, and Review.
- Wrote `plan.md`.

### Implement

- Added `src/doctor/board-hygiene-probe.ts`.
- Added injectable `BoardHygieneProbeDeps.loadGraph` with `loadWorkGraph()` as the default.
- Added pure `orphanEpicCheck(graph)` bridging `findOrphanEpics` into one doctor `Check`.
- Added stable green wording and singular/plural red wording that includes all orphan ids.
- Added a finish-decompose-or-verified-removal fix-it hint.
- Added never-throw conversion for loader/parser/integrity errors.
- Added `src/doctor/board-hygiene-probe.test.ts` with real in-memory `buildGraph` fixtures.
- Modified the normal-workspace `doctor` CLI path to run dependency and board probes concurrently,
  append the board check, and render through the existing core.
- Left the kitchen path and cast preflight unchanged.

## Verification performed

Focused tests:

```text
bun test src/doctor/board-hygiene-probe.test.ts \
  src/doctor/doctor-cli.smoke.test.ts \
  src/doctor/preflight.test.ts
```

Result: 10 pass, 0 fail, 44 assertions across 3 files.

Typecheck:

```text
bun run build
```

Result: clean (`tsc --noEmit`).

Live doctor observation against the current repository:

```text
doctor: ok — 5 check(s) passed
  ✓ lisa on PATH
  ✓ claude on PATH
  ✓ BAML native addon loadable
  ✓ active executor config: claude
  ✓ board hygiene: no orphan epics
```

Exit code: 0. Stderr: empty. This is an observation of the current clean board; injected tests
are the deterministic proof for the orphan failure branch.

`git diff --check`: clean.

Full gate:

```text
bun run check
```

Result: BAML generation clean, TypeScript clean, 1,595 tests passed, 1 pre-existing integration
skip, 0 failed (4,751 assertions across 108 files).

## Deviations from plan

The dedicated-probe boundary, concurrent CLI composition, test cases, and verification order match
the plan. One repository-state deviation was necessary before this ticket could be committed: the
T-068-03-01 detector dependency existed only as uncommitted source/tests/artifacts. Committing this
ticket alone would have produced a broken HEAD with an unresolved import. After the full gate, the
already-reviewed dependency files were committed intact as `5c8624a` before staging this ticket.

## Shared-worktree note

The worktree contains unrelated Lisa-managed frontmatter/provenance changes and files from other
T-068 tickets. They have not been edited or staged by this ticket. The dependency's detector,
tests, and six finished artifacts were the sole exception, committed intact in the prerequisite
commit described above. Its Lisa-managed ticket card remains unstaged with the other board files.

## Remaining

- Commit this ticket's scoped implementation and artifacts.
- Write `review.md` with final gate/commit evidence and open concerns.
- Commit Review and stop without editing ticket frontmatter.
