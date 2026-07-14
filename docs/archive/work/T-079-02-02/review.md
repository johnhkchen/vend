# Review — T-079-02-02

## Disposition

Pass.

The ticket acceptance is met, the repository gate is green, the implementation is committed through
the required Lisa transaction, and all ticket-owned source/test paths are clean.

## Outcome

`vend sweep` is now a free one-keystroke closeout gesture.

It observes the current board and presweep state, delegates selection/path/provenance to the
committed pure sweep core, presents the complete assembled commit, and waits for one byte of human
consent. Only `y` or `Y` mutates the board and lands a Git commit.

A decline is a successful no-op. A presweep refusal is a named nonzero andon. A confirmed sweep
changes and commits only the exact core-selected epic cards.

## Files created

### `src/sweep/sweep.ts`

Adds the sweep effect/presentation shell:

- read-only `prepareSweep`;
- pure checked `renderEpicStatusFlip`;
- exact `commitSweep`;
- pure plan/refusal renderers;
- raw/piped one-byte confirmation reader;
- scoped Git command and rollback helpers;
- named `SweepApplyError` for stale/malformed card state.

### `src/sweep/sweep.test.ts`

Adds eight focused cases covering narrow frontmatter mutation, CRLF preservation, stale/malformed
refusals, exact plan presentation, and named refusal rendering.

## Files modified

### `src/cli.ts`

Adds:

- `vend sweep` to free help;
- parsed `sweep` command type;
- literal verb/suggestion registration;
- strict no-argument parser;
- lazy interactive dispatch.

The dispatch presents before confirmation, calls the commit effect only for `y`/`Y`, and maps
refusals/operational failures to nonzero exits.

### `src/cli.test.ts`

Adds:

- parser and help inventory coverage;
- a reusable isolated sweep fixture board/repository;
- decline acceptance;
- confirm acceptance with commit inspection;
- presweep-offender acceptance.

## Files not changed

The implementation intentionally leaves these authorities untouched:

- `src/sweep/sweep-core.ts` and its tests;
- settle core/shell;
- presweep classifier and prefixes;
- graph schema/loader;
- ticket/story board state;
- archive behavior;
- executor, play, budget, funding, and run-log code;
- Lisa-owned ticket frontmatter.

No files were deleted.

## Public behavior

### Successful preparation

The terminal presentation includes:

```text
sweep
files:
  <exact epic path>
message:
<core provenance subject>

<epic cleared by ticket IDs>
commit? [y/N]
```

This is the complete commit the machine assembled. It appears before any write or index mutation.

### Confirmation

TTY input is read in raw mode, so `y` is the one keystroke; Enter is not required. Piped input uses
the same first-byte classifier.

Only `y` or `Y` consents. Every other byte or input end declines.

### Decline

Decline prints:

```text
sweep declined — no files changed
```

and exits 0. No file, index, HEAD, or marker is touched.

### Presweep refusal

Refusal prints the pure core's named code, reason, offenders, and next action to stderr, then exits 1.
It never prompts and never constructs or commits an alternate plan.

### Confirmed commit

The effect stages with:

```text
git add -- <exact pathspec>
```

and commits with:

```text
git commit --only -m <exact provenance> -- <exact pathspec>
```

The `--only` boundary prevents unrelated index entries from entering the commit. Success prints the
landed HEAD SHA and exits 0.

## Acceptance mapping

### “On a fixture repo `vend sweep` presents the assembled commit”

Met.

The confirm and decline fixture tests assert the output contains the selected file list and exact
provenance message before the receipt.

### “file list plus provenance message”

Met.

The selected list is `SweepFlipSet.pathspec`; the message is `SweepFlipSet.message`. The shell does
not recompute or edit either.

### “commits only after the confirm keystroke”

Met.

Preparation is a separate read-only API. The CLI calls `commitSweep` only after
`readSweepConfirmation` returns true. The fixture pipes exactly one `y` byte with no newline and
observes a new commit.

### “landed commit touching only the pathspec'd board files”

Met.

The confirm fixture runs:

```text
git diff-tree --no-commit-id --name-only -r HEAD
```

and asserts the entire result equals:

```text
docs/active/epic/E-900.md
```

The partial epic stays byte-identical, and fixture porcelain is empty after commit.

### “asserted by inspecting the commit's file list in the test”

Met explicitly by the `diff-tree` assertion above, not inferred from working-tree state.

### “declining leaves the tree untouched”

Met.

The decline fixture captures baseline HEAD and both epic-card bytes, pipes `n`, then proves:

- HEAD unchanged;
- porcelain empty;
- both cards byte-identical;
- no stderr;
- explicit no-change receipt.

### “presweep offenders produce a named andon”

Met.

The offender fixture dirties `docs/active/tickets/T-901-02.md` and asserts stderr includes
`sweep refusal [presweep-offenders]`, the exact offender path, and the recovery action.

### “non-zero exit”

Met. The offender fixture asserts exit code 1.

### “and no commit”

Met. The fixture asserts HEAD remains the baseline and history contains exactly one commit.

## Architecture review

### Pure core, impure shell

Held.

Eligibility, all-done derivation, pathspec, and provenance remain in `sweep-core.ts`. The new module
owns only observation, checked byte transformation, stdin, filesystem, and Git effects.

`renderEpicStatusFlip`, `renderSweepPlan`, and `renderSweepRefusal` are pure and directly tested.

### Presentation before mutation

Held structurally.

The CLI cannot call `commitSweep` until after `prepareSweep` returned a flip set, it rendered that
set, and confirmation resolved true. Decline and refusal paths have no cleanup dependency because
they have not written anything.

### Narrow board authority

Held.

The card renderer verifies epic ID and prepared current status. It alters exactly one top-level
`status:` line and preserves body/frontmatter bytes rather than serializing YAML.

All selected cards are read and transformed before the first write, preventing a malformed later
card from causing partial application.

### Git containment

Held.

The effect validates that pathspec exactly equals the nonempty ordered flip paths. Both add and
commit receive that exact list after `--`. No broad `.` or `docs/active/` path is present.

### Free gesture boundary

Held.

The command imports no play, executor, budget, funding counter, BAML bridge, or run ledger. The only
human input is the deliberate consent byte required by the story.

## Test evidence

### Focused source test

```text
bun test src/sweep/sweep.test.ts
8 pass, 0 fail, 14 expect calls
```

### Focused composed test and typecheck

```text
bun test src/sweep/sweep.test.ts src/cli.test.ts
143 pass, 0 fail, 456 expect calls

bun run build
exit 0
```

### Diff hygiene

```text
git diff --check -- src/sweep/sweep.ts src/sweep/sweep.test.ts src/cli.ts src/cli.test.ts
exit 0
```

### Full gate

```text
bun run check
BAML generation: pass
TypeScript: pass
1913 pass, 1 intentional skip, 0 fail, 6222 expect calls
exit 0
```

### Post-commit focused verification

```text
bun test src/sweep/sweep.test.ts src/cli.test.ts
143 pass, 0 fail, 456 expect calls
```

## Commit evidence

Ticket source commit:

```text
b115159d31a5b6849db4c615fc7a0a70af716f61
feat(sweep): add one-keystroke closeout commit
```

It was created with `lisa commit-ticket` and exact includes. Its file list is exactly:

```text
src/cli.test.ts
src/cli.ts
src/sweep/sweep.test.ts
src/sweep/sweep.ts
```

Ticket-owned source/test paths are clean after the commit.

## Open concerns

No blocking concern remains.

One narrow operational limitation is worth preserving in the handoff: if `git commit` succeeds but
the following `git rev-parse HEAD` unexpectedly fails, the command reports an operational error even
though the commit exists. The implementation deliberately does not attempt to undo a successful
commit. This requires a severely broken Git environment and is outside the acceptance fixture; it
does not weaken path containment or consent ordering.

The pre-commit failure rollback is best-effort by design. Ordinary decline and presweep refusal do
not use rollback because they mutate nothing.

## Honest boundary

This review proves fixture-local closeout behavior. It does not claim a live real-epic sweep was
performed.

The story still does not archive cards, flip tickets/stories, eliminate the confirmation keystroke,
or perform metered/executor work. Those remain explicitly outside this slice.

## Shared worktree review

Unrelated Lisa-managed/shared paths remain modified or untracked:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-079-02-02.md`;
- `docs/active/work/T-079-02-02/`.

They were not included in the ticket source commit and were not reverted or overwritten. No
ticket-owned source/test path remains modified, staged, or untracked.

## Final assessment

The implementation satisfies the full ticket acceptance and the parent story boundary. Machine
assembly is deterministic and path-limited; human consent remains one keystroke; refusal and decline
remain honest; the landed commit is fixture-proven to contain only the selected board file.

