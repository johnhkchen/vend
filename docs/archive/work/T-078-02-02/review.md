# Review — T-078-02-02

## Disposition

Pass. The doctor charter-convention diagnostic is implemented, committed, fully tested, and meets
the ticket acceptance contract. The full repository gate is green.

## Outcome

`vend doctor` now inspects the canonical project charter and adds one convention line:

```text
✓ charter convention: green — 7 labeled invariants found
```

for a labeled charter, or:

```text
✓ charter convention: amber — no labeled invariants found; label charter invariants like `P1 — Author once, run forever` so casts can cite them in `advances`
```

for an unlabeled charter.

Both lines are non-blocking checks. Amber is explicit diagnostic text and leaves doctor's exit code
unchanged at zero when all actual health checks pass.

## File inventory

### Created: `src/doctor/charter-convention-probe.ts`

The new doctor-only module:

- imports `matchIds` from `src/gate/gates.ts`;
- imports the canonical `CHARTER_PATH` from project context;
- exports a stable check prefix;
- exports one stable operator how-to;
- exposes an injected `readCharter` dependency;
- defaults to reading `docs/knowledge/charter.md` under `process.cwd()`;
- maps charter text to one passing doctor check;
- reports the distinct P-label count;
- handles singular and plural count wording;
- reports zero labels as amber with a concrete example and `advances` guidance;
- catches missing/unreadable charter faults;
- reports those faults as actionable, non-blocking amber;
- never prints, exits, rewrites, or casts.

### Created: `src/doctor/charter-convention-probe.test.ts`

The filesystem-free unit suite covers:

- distinct count through the shared detector;
- duplicate-label deduplication;
- singular count wording;
- unlabeled amber wording;
- exact how-to presence;
- amber's passing `Check` shape;
- `renderDoctorReport` exit zero for amber;
- injected labeled charter bytes;
- injected read failure;
- canonical path and backend detail in a read-fault line;
- exit zero for the read-fault diagnostic.

### Modified: `src/cli.ts`

The normal-workspace `doctor` branch now:

- lazily imports `probeCharterConvention`;
- runs it concurrently with independent doctor-only probes;
- appends its one check after dependency, board, and resumable-decompose checks;
- preserves every pre-existing check's relative order;
- renders and exits through the existing shared core.

The branch comment now records the intentional split:

- broken dependencies, orphan epics, and active drafts can be red;
- an unlabeled charter is amber and exit zero.

The kitchen workspace branch is unchanged.

### Modified: `src/doctor/doctor-cli.smoke.test.ts`

The existing real-CLI smoke suite now creates temporary cwd fixtures carrying explicit charter
bytes.

The labeled fixture:

- contains P1 and P3;
- repeats P3 in prose;
- proves the shared detector count is distinct;
- observes the real `green — 2 labeled invariants found` line;
- observes exit zero and no stack trace.

The unlabeled fixture:

- contains ordinary invariant prose with no P-number tokens;
- observes the real amber line;
- observes the complete shared how-to;
- proves the spawned CLI exits zero;
- proves no stack trace or unhandled failure appears.

Every temporary root is removed in `finally`.

## Acceptance review

### Green line on a labeled charter

Pass.

The CLI smoke writes a charter with two distinct P labels and a duplicate citation, spawns the real
CLI with that directory as cwd, and observes:

```text
✓ charter convention: green — 2 labeled invariants found
```

The post-commit live sanity run against Vend's own charter observes seven labeled invariants.

### Invariant count uses the shared detector

Pass.

Production code calls:

```ts
matchIds(charter, "P").size
```

from the detector exported by `T-078-02-01`. No duplicate regex, parser, or hard-coded P-label list
exists in the doctor module. The repeated-P fixture proves detector deduplication reaches the health
surface.

### Amber line on an unlabeled charter

Pass.

Both unit and CLI smoke fixtures contain no `P\d+` token. The real CLI output contains:

```text
charter convention: amber — no labeled invariants found
```

The line explicitly states the observed cause rather than presenting an empty count without context.

### Amber includes the labeling how-to

Pass.

The stable guidance is:

```text
label charter invariants like `P1 — Author once, run forever` so casts can cite them in `advances`
```

It teaches the label shape, attaches the label to a human-readable invariant, and explains why casts
need it. The smoke imports the production constant, then asserts that the real output contains it.

### Amber keeps doctor exit zero

Pass.

The pure mapper returns `passed(...)` for both green and amber. Therefore the existing doctor core
cannot treat a convention signal as a failed prerequisite.

Two independent proofs pin the contract:

1. rendering the unit-level amber check returns `EXIT_OK`;
2. spawning the real doctor CLI in the unlabeled temp root returns exit code `0`.

### Diagnostic never blocks casts

Pass.

The convention probe is not part of `doctor-probe.ts` and is not imported by `preflight.ts`.
Repository search finds the call only in the normal `doctor` CLI branch. Cast preflight remains the
existing dependency-only composition.

## Architecture review

### Pure core / impure shell

The charter judgment is a pure function over a string. The only filesystem read is the injected
default backend in the same small module. Tests exercise the pure mapping and the effect wrapper
using plain values.

### Single source of truth

Two existing shared seams are reused:

- `matchIds` defines P-label detection;
- `CHARTER_PATH` defines the canonical charter location.

The doctor owns only presentation copy and composition.

### Returned diagnostic data

A missing or unreadable charter never rejects the doctor promise. The caught error is rendered into
an amber passing check with the path, detail, and repair guidance. This preserves the doctor probe
house convention while honoring the stronger non-blocking story boundary.

### Binary doctor model

`doctor-core.ts` remains unchanged. The existing renderer has only passing and failed checks, with
any failure forcing exit one. This ticket makes green/amber explicit in the passing check name,
which keeps the requested state visible in plain output without introducing a repository-wide
third-status framework.

The general `✓` prefix therefore means “this line did not fail doctor”; the explicit `amber` text
means the operator has a convention repair available. This is intentional and tested.

## Scope review

The implementation stays inside the parent story boundary.

Not changed:

- gate verdicts;
- detector semantics;
- epic schema;
- charter schema;
- init charter content in this ticket;
- real project charters;
- automatic labeling or migration;
- cite degradation behavior;
- cast preflight;
- kitchen charter/doctor behavior;
- help behavior;
- ticket phase or status frontmatter by the worker.

No model was called and no budget was allocated.

## Test results

### Focused probe suite before unit-1 commit

```text
5 passed
0 failed
16 expectations
```

### Focused probe plus real CLI smoke after wiring

```text
10 passed
0 failed
43 expectations
```

The same focused result passed again after both commits.

### Full repository gate before unit-1 commit

```text
BAML generation: passed
TypeScript: passed
1,824 tests passed
1 integration test skipped because dist/ is absent
0 failed
5,916 expectations
120 files
```

### Full repository gate before unit-2 commit

```text
BAML generation: passed
TypeScript: passed
1,826 tests passed
1 integration test skipped because dist/ is absent
0 failed
5,927 expectations
120 files
```

The skip is the established conditional release-artifact test and is unrelated to this ticket.

### Live sanity check

```text
doctor: ok — 9 check(s) passed
...
✓ charter convention: green — 7 labeled invariants found
live-exit=0
```

## Commit review

### `7e445fa8ec7c081c04b02325570787ef35d01b04`

`feat(doctor): add charter convention probe`

Exact included paths:

- `src/doctor/charter-convention-probe.ts`
- `src/doctor/charter-convention-probe.test.ts`

### `28857a3aafb4fc1729a01c8a8303774ec87e79b6`

`feat(doctor): surface charter convention health`

Exact included paths:

- `src/cli.ts`
- `src/doctor/doctor-cli.smoke.test.ts`

Both commits were created through `lisa commit-ticket`, after a green full gate. `git diff --check`
passes across all four ticket source paths.

## Worktree review

All four ticket-owned source paths are clean and committed.

The remaining worktree entries are Lisa-managed provenance, ticket/frontmatter transition, and
published work-artifact state. They were not staged, reverted, or included by this ticket worker.

## Open concerns and limitations

No blocking concern remains.

One deliberate limitation is recorded: amber is an explicit plain-text state on a passing binary
check, not a typed third doctor severity or ANSI color. That is sufficient for this ticket's smoke
contract, remains visible when output is redirected, and avoids expanding the doctor core for a
single diagnostic. If future stories introduce multiple warning-class checks, a dedicated tri-state
doctor model can be evaluated then; it is not needed for this acceptance.

## Final assessment

The convention now introduces itself at the requested health surface. A labeled charter gets a
shared-detector count; an unlabeled or unreadable charter gets a concrete amber repair; the same
condition never blocks doctor or cast preflight. Tests cover the pure judgment, effect failure,
real cwd wiring, report exit semantics, and live repository behavior. Disposition: pass.
