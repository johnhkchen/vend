# Review — T-080-02-01

## Disposition

Pass.

The ticket acceptance is met, the full repository gate is green, the implementation is committed
through the required Lisa transaction, and every ticket-owned source/test path is clean.

## Outcome

Sweep now carries dirty `.lisa/provenance.jsonl` in the same operator-presented, pathspec-limited
commit as eligible epic-card flips.

When the tracked provenance file is clean, the plan remains cards-only.

The file is optional explicit plan cargo rather than a widened presweep concern or a generic
“commit dirty Lisa state” policy.

## Files modified

### `src/sweep/sweep-core.ts`

Adds the canonical `SWEEP_PROVENANCE_PATH` and extends pure assembly with:

- required `provenanceDirty` input;
- nullable `provenancePath` successful-plan field;
- ordered pathspec assembly of epic cards followed by optional provenance.

Named refusal data, clearance derivation, epic sorting, and commit-message wording remain unchanged.

### `src/sweep/sweep-core.test.ts`

Makes provenance state explicit in every core call.

Pins cards-only clean assembly and adds dirty assembly proof for the canonical optional path.

Retains all refusal, stale-snapshot, impossible-verdict, and immutability coverage.

### `src/sweep/sweep.ts`

Observes the exact provenance path from the existing porcelain snapshot using the shared parser.

Passes a plain dirty fact into the pure core without changing presweep classification.

Strengthens `commitSweep` to derive the complete declared plan path list and reject any equality
mismatch before reading or writing cards.

### `src/sweep/sweep.test.ts`

Adds disposable real Git fixture coverage for:

- tracked dirty provenance presentation and commit;
- clean provenance cards-only assembly;
- fabricated pathspec refusal before mutation.

The fixture directly inspects both commit stat and exact changed-file list.

## Files not changed

The ticket intentionally leaves these authorities untouched:

- `src/ci/presweep-core.ts` and `SWEEP_PREFIXES`;
- `src/ci/committed-core.ts` parser implementation;
- `src/cli.ts` and CLI dispatch;
- settle core/shell;
- seam recorder and contract files;
- graph loader/model;
- `.lisa/provenance.jsonl` in the shared repository;
- arbitrary `.lisa/` state policy;
- board cards and ticket lifecycle frontmatter.

No file was created, deleted, or moved in source.

## Acceptance mapping

### Dirty tracked provenance appears in the presented plan

Met.

The real fixture commits `.lisa/provenance.jsonl` in its baseline, modifies it, invokes the actual
`prepareSweep`, and asserts the returned/rendered pathspec is exactly:

```text
docs/active/epic/E-100.md
.lisa/provenance.jsonl
```

The renderer is unchanged and consumes the authoritative plan pathspec, so the file is visible
before confirmation on the production CLI path.

### Dirty tracked provenance lands with the flipped epic card

Met.

The same fixture calls the actual `commitSweep` and verifies the returned SHA equals HEAD.

It runs `git show --stat --oneline HEAD` and asserts that both the epic card and provenance ledger
are listed.

It also runs `git diff-tree --no-commit-id --name-only -r HEAD` and asserts the complete changed-file
set is exactly those two paths. No inferred working-tree proxy is used.

The epic status is asserted `done`, and the fixture tree is clean after commit.

### Clean provenance keeps cards-only pathspec

Met.

A fresh fixture leaves the tracked ledger clean, invokes real preparation, and asserts:

```text
provenancePath: null
pathspec: ["docs/active/epic/E-100.md"]
```

It also proves rendered output does not mention the provenance path.

### `commitSweep` still refuses a mismatched plan

Met.

A fresh clean plan is copied with provenance appended to `pathspec` but left undeclared by
`provenancePath`.

`commitSweep` rejects with `SweepApplyError`. The test proves HEAD, epic bytes, and porcelain are
unchanged, demonstrating that the invariant runs before mutation.

### `bun run check` green

Met.

The full gate passed before the Lisa commit with 1,922 tests passing, one established intentional
release-only skip, zero failures, and 6,287 assertions.

Focused tests passed again after commit.

## Architecture assessment

### Pure core, impure shell

Held.

The core receives graph, presweep verdict, and one plain boolean. It decides optional plan cargo and
assembles the complete pathspec without fs, Git, process, clock, or network effects.

The shell owns the Git status observation and passes the reduced fact inward.

### One snapshot

Held.

Presweep and provenance carriage derive from the same `git status --porcelain` output. There is no
second observation that could disagree during preparation.

### Exact one-file policy

Held.

The shell compares parsed porcelain paths by equality, not prefix. A similarly named backup or
neighboring `.lisa/` file is not carried.

The plan type allows only the canonical literal or null, not an arbitrary extra path array.

### Presweep semantics

Held.

Dirty provenance remains out of the source-plus-board presweep offender scope. It is carried only
after the ordinary eligibility checks clear.

No `SWEEP_PREFIXES` change occurred.

### Presentation/commit equality

Held.

`renderSweepPlan` and both Git commands use `plan.pathspec`.

Before effects, `commitSweep` independently derives the exact list from flips plus declared cargo
and checks ordered equality. Hidden, omitted, duplicate, or reordered paths are refused.

### Git containment

Held.

The existing path-limited commands remain:

```text
git add -- <exact pathspec>
git commit --only -m <message> -- <exact pathspec>
```

No `.` or broad `docs/active/` / `.lisa/` path was introduced.

## Test evidence

### Focused pre-commit

```text
bun test src/sweep/sweep-core.test.ts src/sweep/sweep.test.ts
19 pass, 0 fail, 67 expect() calls
```

### Typecheck

```text
bun run build
exit 0
```

### Diff hygiene

```text
git diff --check -- src/sweep/sweep-core.ts src/sweep/sweep-core.test.ts src/sweep/sweep.ts src/sweep/sweep.test.ts
exit 0
```

### Full gate

```text
bun run check
BAML generation: pass
TypeScript: pass
1922 pass, 1 skip, 0 fail, 6287 expect() calls
exit 0
```

### Focused post-commit

```text
bun test src/sweep/sweep-core.test.ts src/sweep/sweep.test.ts
19 pass, 0 fail, 67 expect() calls
```

## Commit evidence

Ticket source commit:

```text
cdec0c347bd9018b96a7e577d755e87c15b65a6d
fix(sweep): carry dirty loop provenance
```

Created through `lisa commit-ticket` with exact includes.

Its complete file list is:

```text
src/sweep/sweep-core.test.ts
src/sweep/sweep-core.ts
src/sweep/sweep.test.ts
src/sweep/sweep.ts
```

The ordinary index is empty and all four paths are clean after commit.

## Open concerns

No blocking concern remains.

As with the preexisting card plan, a concurrent external process could change working-tree state
between preparation and confirmed commit. Epic cards have semantic from-state validation before
write; provenance is externally authored cargo and is staged as it exists at commit time. The
ticket's fixture proves the non-racing contract and does not introduce a new repository lock.

On commit failure, rollback resets the full selected index pathspec while rewriting only
sweep-authored epic-card bytes. It deliberately preserves dirty provenance content. This matches
ownership, though a caller with pre-staged provenance could see its staging state reset on failure,
the same scoped rollback behavior already used for selected cards.

Neither limitation weakens the accepted successful path or broadens authority.

## Honest boundary

This review proves the behavior in isolated real Git repositories. It does not perform a live sweep
of the current project board.

It does not claim arbitrary Lisa runtime files are carried, does not change recorder behavior, does
not archive cards, and does not remove the deliberate confirmation keystroke.

Commit-message wording remains the existing epic-clearance provenance. The exact file list and
ledger bytes record whether loop provenance traveled.

## Shared worktree review

After the ticket commit, shared status contains only Lisa-managed ticket frontmatter transitions
and Lisa-published work artifact directories for current attempts.

No ticket-owned sweep source/test path is modified, staged, or untracked.

Concurrent sibling work was neither included nor reverted.

## Final assessment

The one-keystroke closeout no longer drops dirty loop provenance. The operator sees the complete
commit before consent, the exact same pathspec lands, clean provenance stays absent, and the
defensive plan invariant remains strict. The ticket is ready for Lisa completion handling.
