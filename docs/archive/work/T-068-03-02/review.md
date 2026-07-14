# Review — T-068-03-02 doctor-orphan-check

## Verdict

Acceptance met. Normal-workspace `vend doctor` now loads the canonical work graph, reports orphan
epics as a red named check with an actionable fix-it hint, and exits non-zero through the existing
doctor renderer. A clean board receives a green hygiene check and keeps doctor green when the other
checks are green.

The implementation is read-only. It does not delete cards, retry decompose, implement rollback, or
change terminal-failure classification.

## What changed

### Created

`src/doctor/board-hygiene-probe.ts`

- Defines the dedicated board-hygiene doctor probe.
- Uses `loadWorkGraph()` as its real board backend.
- Accepts an injected `loadGraph()` backend for deterministic tests.
- Calls the pure `findOrphanEpics()` detector from T-068-03-01.
- Emits one green check for a clean board.
- Emits one red check naming all orphan ids for a half-minted board.
- Supplies a finish-decompose-or-verified-removal fix-it hint.
- Converts graph load/parse/integrity failures into a red check rather than a thrown stack trace.

`src/doctor/board-hygiene-probe.test.ts`

- Builds canonical in-memory graphs through the real `buildGraph`.
- Proves orphan, clean, multiple-orphan, and loader-fault branches.
- Passes returned checks through `renderDoctorReport` to prove exit codes.
- Uses no filesystem, clock, native addon, or host board facts.

### Modified

`src/cli.ts`

- The non-kitchen `doctor` path now runs the existing dependency probe and the new board probe
  concurrently.
- Dependency checks retain their established ordering; board hygiene is appended as the fifth
  normal-workspace check.
- The kitchen-workspace branch remains unchanged.
- Rendering, printing, and exit-code calculation remain unchanged.

### Work artifacts

Created all six required artifacts under `docs/active/work/T-068-03-02/`:

- `research.md`
- `design.md`
- `structure.md`
- `plan.md`
- `progress.md`
- `review.md`

No files were deleted. The ticket's phase/status frontmatter was not edited by this worker.

## Acceptance-criterion mapping

> `vend doctor` over a board with an orphan epic emits a red Check naming the epic id + a fix-it
> hint and exits non-zero.

Proved by the primary injected-board test:

- fixture board contains populated E-001 and childless E-002;
- `probeBoardHygiene` returns exactly one red check;
- check name contains `orphan epic E-002`;
- hint contains E-002 and `finish decomposing` guidance;
- `renderDoctorReport(checks)` returns `ok: false` and `exitCode: 1`;
- rendered text includes both the id and the hint.

The CLI uses that same probe output and same renderer, so no parallel exit decision exists.

> a clean board keeps doctor green.

Proved by the clean injected-board test:

- fixture board contains a complete epic → story → ticket chain;
- probe returns `{ name: "board hygiene: no orphan epics", ok: true }` with no hint;
- the rendered report returns `ok: true` and `exitCode: 0`.

The live repository observation also produced all green:

```text
doctor: ok — 5 check(s) passed
  ✓ lisa on PATH
  ✓ claude on PATH
  ✓ BAML native addon loadable
  ✓ active executor config: claude
  ✓ board hygiene: no orphan epics
```

Observed live exit code: 0. Stderr: empty.

## Architecture assessment

The pure-core/impure-shell rule is preserved:

- orphan judgment remains in pure `src/graph/orphan.ts`;
- canonical filesystem reading remains in `src/graph/load.ts`;
- graph-fact-to-check wording and load-error degradation live in the thin new doctor probe;
- report text and exit-code verdict remain in pure `src/doctor/doctor-core.ts`;
- the CLI only selects, composes, prints, and exits.

The board check intentionally does not extend `probeDoctor()`. That existing probe is also used by
`castPreflight()`. Adding orphan hygiene there would make a half-minted board block every cast,
including work capable of repairing it. The ticket/story require a `vend doctor` hygiene surface,
not a new cast precondition. The dedicated probe keeps that boundary explicit and tested: existing
preflight tests remained unchanged and green.

Kitchen workspaces also remain outside the board check. Their standalone Astro/EmDash shape has no
canonical lisa board; the existing three kitchen checks are still the complete relevant surface.

## Test coverage

New coverage: 4 tests.

1. One orphan → red check, id + fix-it, rendered exit 1.
2. Fully populated board → green check, no hint, rendered exit 0.
3. Multiple orphans → one red check, every id, deterministic id order, plural wording.
4. Throwing loader → returned red board-readable check with repair hint; no rejection.

Focused regression run:

```text
bun test src/doctor/board-hygiene-probe.test.ts \
  src/doctor/doctor-cli.smoke.test.ts \
  src/doctor/preflight.test.ts
```

Result: 10 pass, 0 fail, 44 assertions across 3 files.

This covers the new probe, the observable CLI report/exit invariant, and the deliberate unchanged
cast-preflight boundary.

Full gate:

```text
bun run check
```

Result:

- BAML client generation: green;
- TypeScript (`tsc --noEmit`): green;
- full suite: 1,595 passed, 1 pre-existing integration skip, 0 failed;
- 4,751 assertions across 108 files.

`git diff --check` was also clean before commit.

## Commits

- `5c8624a` — `feat(graph): detect orphan epics (T-068-03-01)`
- `adee04b` — `feat(doctor): report orphan epics as board hygiene failures (T-068-03-02)`

The first commit was required because this ticket's dependency was present only as completed,
reviewed, uncommitted source/tests/artifacts in the shared worktree. Committing T-068-03-02 alone
would have left HEAD with an unresolved import. The dependency files were committed intact after
the full gate; no unrelated Lisa-managed board/provenance files were included.

This `review.md` is committed separately as the final RDSPI handoff.

## Open concerns and limitations

1. The check reports but does not repair, by story contract. An operator must decide whether to
   complete decompose or safely remove the half-minted epic.
2. All orphan ids share one check. This keeps doctor compact and one board scan sufficient; if
   per-epic remediation tracking is later needed, the probe can return one check per id without
   changing the detector.
3. The detector defines an orphan as zero child stories, which is equivalent to zero stories and
   zero descendant tickets under the current `WorkGraph` model. A future direct epic→ticket edge
   would require revisiting that invariant; T-068-03-01 documents and tests it.
4. A malformed or integrity-broken board produces a generic board-readable red check containing
   the underlying graph error. This is intentionally safe/no-stack-trace, but the full error may
   be long when many graph edges are broken.
5. No subprocess test fabricates an orphan filesystem board. The requested probe test uses injected
   board facts, and existing CLI smoke tests prove wiring/report/exit behavior. Together they cover
   the seam without duplicating graph-loader integration coverage.

No critical issue requires human intervention. The ticket is ready for Lisa's phase transition.
