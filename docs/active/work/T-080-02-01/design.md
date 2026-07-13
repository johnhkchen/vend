# Design — T-080-02-01

## Goal

When the tracked Lisa provenance ledger has uncommitted changes, `vend sweep` must present and land
one closeout commit containing both the eligible epic-card flips and that ledger. When the ledger is
clean, sweep remains cards-only.

The design must preserve the existing presweep andon and exact-plan commit invariant.

## Decision frame

There are three separate judgments:

1. whether sweep is eligible at all;
2. whether the exact provenance file is dirty and should travel;
3. whether the applied commit exactly matches the plan presented to the operator.

Presweep already owns the first. This ticket must add the second without weakening the third.

## Option 1 — widen `SWEEP_PREFIXES` to include `.lisa/`

### Shape

Add `.lisa/` or `.lisa/provenance.jsonl` to the presweep scope and let existing dirty-tree handling
react.

### Advantages

- Minimal new observation logic.
- Reuses the existing porcelain classifier.

### Rejection

- Presweep treats dirty in-scope paths as offenders and refuses sweep; it does not carry them.
- This would block precisely the dirty-provenance closeout the ticket requires.
- General `.lisa/` scope would capture runtime state beyond the honest boundary.
- The parent story explicitly forbids widening `SWEEP_PREFIXES`.

## Option 2 — make `commitSweep` re-observe provenance immediately before commit

### Shape

Keep the prepared plan cards-only. After confirmation, have `commitSweep` query Git and append the
provenance path if dirty.

### Advantages

- Captures the latest provenance state at commit time.
- Requires little change to `computeSweep`.

### Rejection

- The presented file list could differ from the landed commit.
- Human consent would no longer cover the complete pathspec.
- The pure core would cease to be the authoritative commit assembler.
- Pathspec equality could only validate card paths, leaving hidden commit cargo outside the plan.

## Option 3 — always include provenance

### Shape

Append `.lisa/provenance.jsonl` to every successful sweep plan.

### Advantages

- No dirty-state parsing.
- One stable pathspec shape.

### Rejection

- `git commit --only` with an unchanged path adds no changed file, but the presented plan would
  falsely claim the clean file is part of the commit.
- Acceptance explicitly requires cards-only pathspec when provenance is clean.
- It hides the meaningful distinction between carried state and absent state.

## Option 4 — observe once, pass a plain fact into pure assembly

### Chosen

`prepareSweep` uses its existing `git status --porcelain` snapshot to determine whether the exact
canonical provenance path appears. It passes a boolean fact into `computeSweep`.

The pure core records optional cargo explicitly and builds the authoritative pathspec from epic
flips plus that cargo. The shell presents and commits that exact plan.

### Rationale

- The presented and committed file lists remain identical.
- Pure core remains the only pathspec assembler.
- Presweep remains unchanged and independently consumes the same snapshot.
- Exact-path matching honors the one-file story boundary.
- One snapshot avoids timing disagreement between presweep and provenance observation.

## Decision 1 — canonical path constant

Export from `sweep-core.ts`:

```ts
export const SWEEP_PROVENANCE_PATH = ".lisa/provenance.jsonl" as const;
```

The core owns commit assembly, so it is the correct authority for the only permitted ancillary
path. The shell imports it for observation; tests import it for exact assertions.

The constant prevents drift between status classification, plan data, and commit validation.

## Decision 2 — explicit plan cargo

Extend `SweepFlipSet` with:

```ts
readonly provenancePath: typeof SWEEP_PROVENANCE_PATH | null;
```

This is preferable to a generic `extraPaths` array. The honest boundary permits one known file, not
an extensible commit-anything mechanism.

It is also preferable to only a boolean because the plan becomes self-describing: renderers and
effect boundaries can see the exact declared cargo without reconstructing its path.

`null` means provenance was clean in the prepared snapshot. The canonical string means it was
dirty and is part of the operator-visible commit.

## Decision 3 — core input fact

Extend `ComputeSweepInput` with:

```ts
readonly provenanceDirty: boolean;
```

The core receives a plain observation rather than porcelain text. Git output parsing is shell
concern; commit assembly is core concern.

The field is required, not optional. Required input forces every caller and fixture to declare
which snapshot state it is modeling and prevents an implicit default from hiding missed wiring.

Refusal results do not carry provenance because no commit will be assembled or presented.

## Decision 4 — pathspec ordering

Successful pathspec ordering is:

1. sorted epic-card flip paths;
2. `.lisa/provenance.jsonl` when dirty.

The append order keeps all existing card ordering stable and makes the optional cargo visually
obvious at the end of `files:`.

No global lexicographic resort is needed. The pathspec is semantic assembly order, and Git accepts
either order.

## Decision 5 — commit message

Keep the existing message unchanged:

```text
sweep: close E-100

E-100 cleared by T-100-01, T-100-02
```

The message already records why each epic was cleared. The plan's `files:` block and Git commit stat
truthfully record whether the Lisa ledger traveled.

Adding a new prose line is not required by ticket or story acceptance and would change stable user
output without a stated wording contract. The provenance file itself is the authoritative detailed
record.

## Decision 6 — exact dirty observation

In `prepareSweep`, parse each existing porcelain line with `parsePorcelainLine` and compare the
result by exact equality to `SWEEP_PROVENANCE_PATH`.

This recognizes staged, unstaged, deleted, and untracked states represented by porcelain. The
acceptance fixture specifically uses a tracked modified file.

Exact equality avoids accidentally carrying `.lisa/provenance.jsonl.backup` or any neighboring
runtime file.

The helper may remain private in the shell because it is small observation plumbing and is proven
through `prepareSweep` integration tests.

## Decision 7 — strengthened commit invariant

`commitSweep` derives its expected pathspec as:

```text
flip paths + (plan.provenancePath when non-null)
```

It rejects when flips are empty or `plan.pathspec` differs in value, length, or order.

This retains the original invariant rather than weakening it to “card paths are a prefix” or “the
provenance path may appear.” A fabricated extra path, omitted declared provenance path, duplicated
path, or reordered plan all fail before any card read/write.

The error wording should describe exact declared plan paths rather than only flip paths.

## Decision 8 — commit and rollback behavior

No new Git commands are required.

The existing:

```text
git add -- <plan.pathspec>
git commit --only -m <plan.message> -- <plan.pathspec>
```

will stage and commit the dirty provenance file together with cards.

If the commit fails, the existing scoped reset uses the full pathspec and therefore unstages
provenance along with the restored cards. It does not rewrite provenance bytes, because sweep did
not author those bytes. This preserves the preexisting dirty ledger while returning its index state
to HEAD.

## Decision 9 — pure core tests

Update successful assembly coverage to explicitly pass `provenanceDirty: false`, expect
`provenancePath: null`, and retain the cards-only pathspec.

Add a sibling case with `provenanceDirty: true` expecting:

- canonical `provenancePath`;
- epic path followed by provenance in `pathspec`;
- unchanged clearance message.

Update all refusal and invariant callers to state the observation boolean.

## Decision 10 — shell fixture tests

Add a disposable real Git fixture to `src/sweep/sweep.test.ts`.

The fixture creates one valid all-done epic graph and a tracked provenance ledger, commits a clean
baseline, and returns direct Git helpers.

### Dirty case

Append a ledger entry, call `prepareSweep`, render it, and assert both paths appear. Call
`commitSweep`, then assert:

- returned SHA equals HEAD;
- `git show --stat --oneline HEAD` names both files;
- exact changed-file list equals epic card plus provenance;
- epic status is done;
- working tree is clean.

### Clean case

Leave ledger untouched, prepare, and assert `provenancePath` is null and pathspec is cards-only.

No commit is needed to prove this assembly branch because the existing CLI fixture already proves
cards-only commit mechanics; however a direct plan assertion is required.

### Mismatch case

Prepare a valid clean plan, fabricate a pathspec containing provenance while leaving
`provenancePath: null`, call `commitSweep`, and assert `SweepApplyError` before mutation. Verify HEAD,
card bytes, and porcelain remain unchanged.

## Scope and non-goals

No changes to:

- `src/ci/presweep-core.ts` or its prefixes;
- `src/cli.ts` or CLI behavior;
- settle output;
- seam recorder files;
- arbitrary `.lisa/` state policy;
- archive behavior;
- confirmation semantics;
- commit-message wording.

## Verification

Run focused sweep tests and typecheck during implementation, inspect diff hygiene, run full
`bun run check`, commit the exact four `src/sweep/` paths through Lisa, and verify the commit file
list and owned-path cleanliness before Review.
