# Research — T-080-02-01

## Assignment boundary

This attempt begins at `phase: research` and must complete every remaining RDSPI phase in one
continuous pass.

Phase artifacts belong under `.lisa/attempts/T-080-02-01/1/work/`. Lisa publishes admitted
artifacts after validating the attempt lease. The shared `docs/active/work/T-080-02-01/` path must
not be written by this worker.

Ticket phase and status frontmatter are Lisa-owned state and must not be edited.

Ticket source commits must use `lisa commit-ticket` with exact repository-relative `--include`
paths. Ordinary `git add` and `git commit` are prohibited for ticket work.

## Product and story contract

Vend makes repeatable agent work trustworthy through local, autonomous gates. This ticket advances
P3 and P4: the one-keystroke sweep must preserve the provenance that the manual closeout ritual
preserved, without asking the operator to perform a second repair commit.

Parent story `S-080-02` covers two truthfulness fixes. This ticket owns only sweep provenance
carriage. Its sibling owns settle verdict filtering and first-settle wording.

The story explicitly limits provenance carriage to `.lisa/provenance.jsonl`. It does not establish
a policy of committing arbitrary dirty `.lisa/` state.

The story also says `SWEEP_PREFIXES` must not widen. Provenance is cargo for an otherwise-eligible
closeout, not a new presweep offender.

The deliberate sweep confirmation keystroke remains. Automatic sweep is outside the slice.

## Ticket acceptance

Tests must prove two successful plan shapes:

- tracked `.lisa/provenance.jsonl` dirty: the presented pathspec contains the epic card and the
  provenance file, and the landed closeout commit stat lists both;
- tracked `.lisa/provenance.jsonl` clean: the pathspec contains only epic cards.

Tests must also preserve the `commitSweep` defensive invariant: a plan whose pathspec differs from
its declared contents is refused before mutation.

The final repository gate is `bun run check`.

## Existing pure sweep core

`src/sweep/sweep-core.ts` is the pure assembly boundary.

`computeSweep` takes a `WorkGraph` and `SweepVerdict`. It validates that the verdict's `ok` flag and
offender list agree, rejects presweep offenders, rejects stale done-ticket observations, derives
epic clearance, excludes already-done epics, and returns either a named refusal or `SweepFlipSet`.

Each `EpicFrontmatterFlip` contains:

- epic identity;
- exact repository-relative epic-card path;
- checked `status` transition from observed value to `done`;
- cleared ticket IDs used in the commit message.

The current successful `SweepFlipSet` contains ordered flips, a pathspec equal to the flip paths,
and a deterministic message.

`provenanceMessage` currently renders a subject naming all closing epics and one body line per epic
naming its cleared tickets. This is clearance provenance in the Git message; the new Lisa ledger
file is separate commit cargo.

The core is effect-free and is directly tested by `src/sweep/sweep-core.test.ts` with plain graph
fixtures.

## Existing sweep shell

`src/sweep/sweep.ts` is the impure shell around the pure assembly.

`prepareSweep` currently:

1. loads the work graph;
2. runs `git status --porcelain` once;
3. classifies presweep from the done-ticket IDs and porcelain text;
4. calls `computeSweep`.

The Git snapshot already contains the fact needed by this ticket: whether the exact provenance path
has staged, unstaged, deleted, or untracked changes.

`commitSweep` validates the presented plan before reading or writing cards. Today it requires the
pathspec to equal the nonempty ordered flip paths.

It then reads and validates every epic card before the first write, rewrites only checked status
lines, stages the plan pathspec, and invokes `git commit --only` with that same pathspec.

On a pre-commit failure it restores attempted card writes and resets only the selected paths. The
rollback pathspec is therefore also affected when provenance joins a plan.

`renderSweepPlan` renders every `plan.pathspec` entry. Adding provenance to the authoritative
pathspec automatically makes it visible before confirmation without changing CLI code.

## Porcelain parsing

`src/ci/committed-core.ts` exports `parsePorcelainLine`, the shared pure parser for porcelain-v1
lines.

It handles ordinary modified/untracked entries, rename destinations, and one layer of Git C-style
quoting. `classifyPorcelain` builds on it for prefix-scoped gates.

Using prefix classification with `.lisa/provenance.jsonl` would be broader than the story because a
prefix match could also select a similarly named suffix file. Exact equality after
`parsePorcelainLine` preserves the one-file policy.

No new Git invocation is necessary: `prepareSweep` can derive the exact dirty-path fact from the
same porcelain snapshot used by presweep.

## Presweep boundary

`src/ci/presweep-core.ts` defines `SWEEP_PREFIXES` as source prefixes plus `docs/active/`.

It intentionally excludes general `.lisa/` runtime state. When tickets are phase-done, source and
board dirt causes an andon; out-of-scope runtime dirt does not.

The ticket does not change this. Dirty provenance must not make `classifySweep` fail. It must be
observed independently, passed into sweep assembly, and carried only if the board is otherwise
eligible.

## Commit path invariant

The existing invariant derives the only legal pathspec from flip paths. Provenance introduces a
second legal shape, but accepting either shape implicitly would weaken the contract: a caller could
append the canonical file without declaring that it was part of the prepared plan.

The plan therefore needs an explicit representation of optional provenance cargo. The commit shell
can derive one exact expected pathspec from flips plus that field and retain strict equality.

The canonical provenance path should be single-sourced so observation, assembly, and invariant
cannot spell it differently.

## Existing tests

`src/sweep/sweep-core.test.ts` pins successful assembly, all named refusals, presweep invariants,
ordering, and non-mutation of caller arrays.

Its successful expected object currently proves a cards-only pathspec. It has no dirty-provenance
input or optional-cargo assertion.

`src/sweep/sweep.test.ts` pins epic byte rewriting and terminal rendering. It currently has no real
Git fixture and does not directly test `prepareSweep` or `commitSweep`.

`src/cli.test.ts` already has a larger real fixture for the original sweep acceptance. That fixture
proves decline, cards-only confirmation, and presweep refusal through the CLI.

This ticket is scoped to `src/sweep/*`. A focused real Git fixture in `sweep.test.ts` can exercise
the APIs directly, prove the landed commit stat, and avoid changing the CLI or duplicating its
interactive concerns.

## Real Git fixture requirements

A commit fixture needs valid epic, story, and ticket cards because `prepareSweep` calls the real
graph loader.

It needs one open epic whose tickets are all `phase: done`, producing one deterministic flip.

It needs a tracked `.lisa/provenance.jsonl` in the baseline commit. The dirty case can append one
line after baseline; the clean case leaves it untouched.

It needs local Git user name/email because `commitSweep` creates a real commit.

The test can inspect `git show --stat --oneline HEAD` for the user-facing stat requirement and
`git diff-tree --name-only` for exact changed-file equality.

Every fixture must use `mkdtemp` and remove itself in `finally` so tests do not affect the shared
repository.

Git commands inside the isolated test repository are exercise/setup, not ticket source commits.

## Current shared worktree

The shared worktree contains Lisa-owned modifications to this ticket and a sibling ticket.

`.lisa/provenance.jsonl` is tracked in the repository but currently clean in the observed status.
Its runtime state may change during the attempt and must not be manually edited or included in the
ticket implementation commit.

Ticket-owned source candidates are limited to:

- `src/sweep/sweep-core.ts`;
- `src/sweep/sweep-core.test.ts`;
- `src/sweep/sweep.ts`;
- `src/sweep/sweep.test.ts`.

No settle, seam-recorder, CLI, graph, presweep, or provenance-ledger implementation file needs to
change.

## Constraints carried into Design

- Keep pure assembly in `sweep-core.ts` and Git/fs observation in `sweep.ts`.
- Observe the exact provenance path from the existing porcelain snapshot.
- Do not widen `SWEEP_PREFIXES`.
- Carry only `.lisa/provenance.jsonl`, never arbitrary `.lisa/` dirt.
- Make optional provenance explicit in the plan so pathspec equality remains exact.
- Keep the file visible through the existing plan renderer before confirmation.
- Preserve the existing clearance commit message unless acceptance requires new prose.
- Test clean, dirty, and fabricated/mismatched plan paths.
- Prove a real closeout commit stat lists the epic card and provenance file together.
- Keep all test Git effects inside disposable repositories.
- Finish with `bun run check`, Lisa transaction commit, and clean owned paths.
