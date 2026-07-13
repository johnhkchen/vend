# Progress — T-079-02-02

## Implementation status

All planned source work is implemented and pre-commit verification is green.

The implementation stayed within the four planned ticket-owned source/test paths:

- `src/sweep/sweep.ts`;
- `src/sweep/sweep.test.ts`;
- `src/cli.ts`;
- `src/cli.test.ts`.

The committed dependency `src/sweep/sweep-core.ts` was consumed without modification.

## Source unit — sweep effect shell

Created `src/sweep/sweep.ts` as the impure shell over the committed pure core.

### Read-only preparation

`prepareSweep` now:

1. loads the canonical graph from the target/current root;
2. runs `git status --porcelain` without a shell;
3. derives phase-done IDs with `donePhaseIds`;
4. classifies the shared presweep verdict;
5. calls `computeSweep` once;
6. returns the core result unchanged.

This path performs no writes, staging, or commits. Core refusals therefore reach CLI rendering
before any mutation.

### Checked card transition

Added pure `renderEpicStatusFlip`.

It requires leading fenced frontmatter, verifies the selected epic ID and prepared `from` status via
the canonical parser, requires exactly one top-level status line, and changes only that line to
`status: done`.

All unrelated frontmatter/body bytes are preserved. A semantic validation copy normalizes CRLF to
LF because the existing graph parser accepts LF fences only; the actual rewrite remains against the
original bytes, so CRLF documents are preserved.

Malformed, mismatched, or stale cards throw `SweepApplyError` before Git work.

### Exact commit effect

Added `commitSweep`.

Before writing, it verifies that the nonempty pathspec exactly equals ordered flip paths, reads every
selected card, and prepares every replacement in memory.

After all cards validate, it executes:

```text
git add -- <exact core pathspec>
git commit --only -m <core provenance> -- <exact core pathspec>
git rev-parse HEAD
```

The explicit add meets the pathspec-limited staging contract. `--only` independently prevents an
unrelated index entry from entering the landed sweep commit.

If a pre-commit Git/write step fails after mutation, the shell makes a best-effort restoration of
original card bytes and resets only the selected index paths. A successful commit is never rolled
back merely because the later SHA query fails.

### Presentation and confirmation

Added pure plan/refusal renderers.

Plan output contains the exact ordered file list and preserves the core provenance message verbatim.
Refusal output includes the named code, reason, exact recovery action, and offender list where
present.

Added `readSweepConfirmation`, which reads the first byte and returns true only for `y`/`Y`. It uses
raw mode for a TTY so Enter is not required, restores the prior raw-mode state in `finally`, and uses
the same first-byte path for piped fixture input.

## Source unit — CLI wiring

Modified `src/cli.ts` to add `sweep` as a free, no-argument command.

Changes include:

- free usage line;
- parsed command union member;
- canonical command/suggestion inventory entry;
- parser routing and strict no-trailing-token parser;
- lazy interactive dispatch adjacent to `settle`.

Dispatch ordering is:

1. prepare;
2. refusal -> stderr/exit 1;
3. present complete assembly;
4. prompt `commit? [y/N]`;
5. read one byte;
6. decline -> explicit no-change receipt/exit 0;
7. confirm -> exact commit and SHA receipt/exit 0.

The sweep path imports no play, executor, budget, funding, or run-log module.

## Test coverage implemented

Created `src/sweep/sweep.test.ts` with eight focused cases.

Pinned behavior includes:

- only the top-level status line changes;
- a body `status:` lookalike is untouched;
- CRLF bytes remain CRLF;
- mismatched epic identity refuses;
- stale source status refuses;
- missing and duplicate status fields refuse;
- plan rendering carries exact files/message;
- refusal rendering carries code/offenders/action without success claims.

Extended `src/cli.test.ts` with parser/help coverage and three fixture repositories.

### Decline fixture

Pipes exactly `n` after plan presentation. Assertions prove:

- exit 0 and no stderr;
- exact selected file and provenance are visible;
- confirmation prompt is visible;
- decline receipt is visible;
- HEAD is unchanged;
- porcelain is empty;
- both epic cards are byte-identical to baseline.

### Confirm fixture

Pipes exactly `y` without newline. Assertions prove:

- exit 0 and no stderr;
- plan and prompt precede the receipt;
- HEAD advances;
- receipt names a 40-character commit SHA;
- `git diff-tree --no-commit-id --name-only -r HEAD` contains exactly
  `docs/active/epic/E-900.md`;
- `%B` equals the pure core's provenance naming `T-900-01, T-900-02`;
- E-900 becomes done;
- partial E-901 remains byte-identical/open;
- the fixture worktree is clean.

### Presweep andon fixture

Leaves one in-scope ticket dirty after baseline. Assertions prove:

- exit 1;
- stdout is empty;
- stderr names `presweep-offenders`;
- stderr names the exact dirty board path and recovery action;
- no confirmation prompt appears;
- HEAD is unchanged;
- history still contains only the baseline commit.

## Deviations and repairs

### CRLF parser compatibility

The first focused run found that `parseFrontmatter` rejects CRLF fences. The design intent was to
preserve CRLF, so implementation normalized only the semantic validation copy and retained the
original-byte rewrite. The CRLF test then passed.

### Fixture stdin API

The first confirm fixture used `child.stdin.end("y")`, which Bun's sink treated as end without a
write. Repository precedent uses `write()` followed by awaited `end()`. The fixture was changed to
that established pattern; production input code was unchanged. The exact one-byte confirm then
passed.

No scope or architecture deviation was required.

## Verification evidence — pre-commit

### Focused sweep test

```text
bun test src/sweep/sweep.test.ts
8 pass, 0 fail, 14 expect calls
```

### Combined focused acceptance and typecheck

```text
bun test src/sweep/sweep.test.ts src/cli.test.ts
143 pass, 0 fail, 456 expect calls

bun run build
tsc --noEmit — exit 0
```

### Diff hygiene

```text
git diff --check -- src/sweep/sweep.ts src/sweep/sweep.test.ts src/cli.ts src/cli.test.ts
exit 0
```

### Full repository gate

```text
bun run check
BAML generation — pass
TypeScript no-emit typecheck — pass
1913 tests pass, 1 intentional skip, 0 fail, 6222 expect calls
exit 0
```

## Shared worktree handling

Unrelated Lisa-owned/shared changes remain present, including `.lisa/provenance.jsonl`,
Lisa-managed ticket frontmatter, and a `docs/active/work/T-079-02-02/` publication path. This worker
did not edit or stage them and will exclude them from the exact Lisa source commit.

## Commit evidence

The source unit was committed through Lisa with exact includes:

```text
lisa commit-ticket \
  --ticket-id T-079-02-02 \
  --message "feat(sweep): add one-keystroke closeout commit" \
  --include src/sweep/sweep.ts \
  --include src/sweep/sweep.test.ts \
  --include src/cli.ts \
  --include src/cli.test.ts
```

Result:

```text
b115159d31a5b6849db4c615fc7a0a70af716f61
```

`git diff-tree --no-commit-id --name-only -r HEAD` returned exactly:

```text
src/cli.test.ts
src/cli.ts
src/sweep/sweep.test.ts
src/sweep/sweep.ts
```

No ordinary `git add` or `git commit` was used for ticket source work.

## Verification evidence — post-commit

```text
bun test src/sweep/sweep.test.ts src/cli.test.ts
143 pass, 0 fail, 456 expect calls
```

`git status --short` contains no ticket-owned source/test path. Only unrelated Lisa-managed/shared
paths remain modified or untracked.

## Remaining step

Write Review and the passing disposition artifact, then stop on this ticket for Lisa closeout.

