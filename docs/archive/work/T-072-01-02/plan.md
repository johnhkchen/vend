# Plan — T-072-01-02

## Goal

Deliver a conservative did-you-mean correction for unknown CLI verbs, proven through
pure unit tests, parser tests, and direct process behavior, without changing any other
command or syntax-error rendering.

## Step 1 — capture the starting state

- Confirm the parent story and ticket contract are reflected in Research and Design.
- Confirm `T-072-01-01` is present at HEAD.
- Record pre-existing dirty paths and do not touch them.
- Confirm source scope is only `src/cli.ts` and `src/cli.test.ts`.

Verification:

- `git status --short` identifies Lisa-owned metadata separately.
- No ticket-owned source file is dirty before implementation.

## Step 2 — add canonical suggestion candidates

In `src/cli.ts`, define the private readonly canonical literal verb tuple beside
other parser routing constants.

Verification:

- every literal canonical first-token verb in `parseArgs` is represented;
- flags, aliases, result-only discriminants, and selection placeholders are excluded;
- no runtime import is introduced.

## Step 3 — add the pure edit-distance suggester

Implement private two-row Levenshtein distance and export `suggestCommand` with
plain token/candidates/threshold inputs.

Verification:

- exact, insertion, deletion, and substitution costs are conventional;
- closest candidate wins;
- tie behavior is deterministic;
- the threshold is inclusive and defaults to two;
- empty candidate lists and distant tokens return `undefined`.

## Step 4 — distinguish targeted unknown errors

Extend the `usage` union member with optional `showUsage`. In
`parseSelectOrBrowse`, construct the unknown-command string from the first positional
token and the optional suggestion. Set `showUsage: false` for this path.

Verification:

- `steeer` produces the exact em-dash suggestion text;
- `frobnicate` names the token but has no false suffix;
- retired `work` remains an unknown command;
- selection-shaped input still routes to selection;
- syntax errors outside this branch retain their existing object shapes.

## Step 5 — update the impure shell

Keep writing the error and exiting 2 for `usage`. Guard only the banner write with
`parsed.showUsage !== false`.

Verification:

- targeted unknowns are exactly one stderr line;
- stdout remains empty;
- exit remains 2;
- missing arguments and malformed syntax still include `USAGE`.

## Step 6 — add pure unit coverage

Import `suggestCommand` into `src/cli.test.ts` and add a focused suite covering:

- `steeer -> steer`;
- representative insertion and substitution misses;
- ranking among multiple candidates;
- inclusive threshold behavior;
- distant input and empty candidates producing `undefined`.

Verification:

- tests exercise the exported pure API directly;
- no subprocess or side effect is required for algorithm cases.

## Step 7 — update parser coverage

Update exact unknown-command assertions to include `showUsage: false`. Add the
near-miss exact message assertion.

Verification:

- parser tests prove both positive and negative threshold behavior in production
  wiring;
- existing run, browse, select, help, and retired-command tests still pass.

## Step 8 — add direct CLI coverage

Use the established `Bun.spawn` pattern to invoke `src/cli.ts` with the two acceptance
examples.

Expected observations:

```text
frobnicate -> stderr "unknown command: frobnicate\n", stdout "", exit 2
steeer     -> stderr "unknown command: steeer — did you mean steer?\n", stdout "", exit 2
```

The distant example intentionally has no suffix because the ticket explicitly forbids
false suggestions when no candidate is within threshold.

## Step 9 — focused verification

Run:

```bash
bun test src/cli.test.ts
```

If it fails:

- fix ticket-owned production/test code;
- do not weaken unrelated expectations;
- record any meaningful deviation in `progress.md`.

Then manually sample the two direct commands if useful to inspect formatting.

## Step 10 — full repository gate

Run:

```bash
bun run check
```

The gate must complete BAML generation, typecheck, and the full test suite. Any
failure must be investigated honestly. Environmental or concurrent failures are
recorded; ticket-owned regressions are fixed before commit.

## Step 11 — inspect ownership and diff

Run read-only checks:

- `git diff -- src/cli.ts src/cli.test.ts`
- `git status --short`
- focused searches if needed to confirm no accidental banner/routing change.

Confirm:

- only intended hunks exist in the two source files;
- Lisa-owned metadata changes remain outside the ticket commit;
- no file is staged through the ordinary index.

## Step 12 — write progress and commit the atomic unit

Update private `progress.md` with implementation facts, verification results, and
deviations. Then commit only through:

```bash
lisa commit-ticket \
  --ticket-id T-072-01-02 \
  --message "feat(cli): suggest nearest unknown verb (T-072-01-02)" \
  --include src/cli.ts \
  --include src/cli.test.ts
```

Do not use `git add`, `git commit`, a broad include, or hook bypass.

## Step 13 — post-commit verification

- Confirm the Lisa commit succeeded.
- Capture the commit identifier.
- Confirm `src/cli.ts` and `src/cli.test.ts` are clean and unstaged.
- Distinguish remaining Lisa-owned worktree changes from ticket-owned files.

## Step 14 — review and stop

Write private `review.md` after the source commit. It must report:

- exact files changed;
- algorithm and threshold behavior;
- output/stream/exit semantics;
- focused and full gate results;
- acceptance coverage;
- deviations and limitations;
- commit identifier and source cleanliness;
- confirmation that shared artifacts and ticket frontmatter were not edited.

Remain on this ticket and stop. Lisa owns artifact publication, completion commit,
phase/status transitions, and seat release.

## Done criteria

- The suggester is pure and directly unit-tested.
- Near misses choose the correct nearest canonical verb.
- Distant inputs receive no false suggestion.
- Unknown CLI verbs render one targeted stderr line and no usage banner.
- Other syntax errors retain the banner.
- Focused tests and `bun run check` are green.
- Source is committed by exact-path `lisa commit-ticket` only.
- No ticket-owned file remains dirty, staged, or untracked.
