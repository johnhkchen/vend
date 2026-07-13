# Review — T-072-01-02

## Verdict

Green. The ticket's implementation, acceptance proof, repository gate, and exact-path
source commit are complete. No required work remains for this attempt. Lisa still owns
artifact admission, completion publication, phase/status transitions, and seat release.

## Ticket and story alignment

- Ticket: `T-072-01-02`, `did-you-mean-on-unknown-verb`.
- Story: `S-072-01`, `cli-teaches-itself`.
- Advances P2 by recovering from ordinary verb typos without another interaction.
- Remains local, deterministic, and token-free.
- Stays inside the story's strict `src/cli.ts` / `src/cli.test.ts` source scope.
- Does not alter command behavior, executor behavior, casting, budgets, shelf state, or
  any out-of-slice story item.

## Files changed

### `src/cli.ts`

- Added the canonical literal verb inventory used for corrections.
- Added pure two-row Levenshtein edit distance over Unicode code points.
- Exported `suggestCommand(token, candidates, maxDistance = 2)`.
- Added stable first-candidate behavior for equal distances.
- Added conservative inclusive threshold enforcement.
- Wired the helper into the existing unknown-command parser path.
- Added the exact ` — did you mean <verb>?` suffix for qualifying near misses.
- Changed direct unknown-command rendering to omit the full usage banner.
- Preserved stderr output and exit status 2.
- Preserved the established pure parser result shape.

### `src/cli.test.ts`

- Added direct pure unit tests for the suggester.
- Covered insertion, deletion, and substitution near misses.
- Covered lowest-distance selection and deterministic ties.
- Covered inclusive threshold behavior.
- Covered no candidate and distant-token silence.
- Added the exact `steeer -> steer` parser expectation.
- Retained `frobnicate` as the no-false-suggestion parser proof.
- Added process-level assertions for exact stdout, stderr, and exit behavior.

No repository source file was created or deleted.

## Acceptance assessment

### Targeted unknown token

Met. Both examples name the actual first unknown positional token.

Direct behavior for the distant example:

```text
unknown command: frobnicate
```

Direct behavior for the near miss:

```text
unknown command: steeer — did you mean steer?
```

Both are exactly one stderr line, produce empty stdout, omit the grouped usage banner,
and exit 2.

### Nearest real verb

Met. Production candidates are fourteen canonical literal verbs routed by
`parseArgs`. `steeer` has distance one from `steer`, so it selects `steer`. Unit tests
also prove the strictly closest candidate wins when multiple candidates are supplied.

Flags, aliases, selection placeholders, and result-only discriminants are excluded so
the correction teaches the canonical spelling shown by help.

### Pure edit-distance suggester

Met. `suggestCommand` takes only plain strings, a readonly candidate list, and an
optional numeric threshold. It reads no filesystem, clock, process, environment, or
module state and performs no side effects.

The internal Levenshtein implementation accounts for insertion, deletion, and
substitution with two rows of dynamic-programming state. Candidate iteration is stable
on equal distances.

### Silence outside threshold

Met. The default threshold is two edits, inclusive. `frobnicate` is beyond that
threshold for every canonical verb and receives no suggestion suffix. Direct unit
tests also pin `undefined` for distant input and an empty candidate list, plus both
sides of an explicit threshold boundary.

The ticket sentence places `frobnicate` beside the suggestion template, but the same
acceptance criterion explicitly requires silence when nothing is within threshold.
The implementation treats `frobnicate` as that required negative example and
`steeer` as the positive example; this is the only internally consistent reading.

## Error-surface compatibility

The pure unknown result remains:

```ts
{ cmd: "usage", error: "unknown command: ..." }
```

This matters because `src/version.test.ts` already pins that exact object for an
unknown flag. The direct shell recognizes the existing stable `unknown command:`
prefix to decide that the error is self-contained. Other usage errors still print the
full banner, so missing arguments and malformed syntax retain their prior recovery aid.

## Test coverage

### Focused initial implementation

`bun test src/cli.test.ts`:

- 111 passed;
- 0 failed;
- 206 expectations.

### Compatibility-focused final run

`bun test src/cli.test.ts src/version.test.ts`:

- 117 passed;
- 0 failed;
- 217 expectations.

### Full gate

`bun run check` completed successfully:

- BAML client generation passed;
- TypeScript typecheck passed;
- 1,659 tests passed;
- 0 tests failed;
- 1 test skipped because optional `dist/` artifacts were absent;
- 5,087 expectations passed across 111 files.

The skip is the repository's explicit release-artifact integration skip and is not
caused by this ticket.

## Deviation and resolution

The initial implementation added optional `showUsage: false` to unknown parse results.
The first full gate found one failure: `src/version.test.ts` requires the exact legacy
two-field result shape for unknown flags. This was correctly treated as a ticket-owned
compatibility regression.

Before continuing, private `design.md`, `structure.md`, and `plan.md` were revised.
The parser field was removed and the adjacent direct shell now recognizes the already
stable unknown-command prefix. The focused compatibility run and final full gate then
passed. No test was weakened and no out-of-scope file was changed.

## Risks and limitations

- The canonical candidate tuple is intentionally explicit. A future literal verb must
  update routing, help inventory, and suggestion inventory together. Existing command
  inventory tests make such drift visible on the presentation side.
- The fixed threshold of two is conservative. It avoids false confidence for distant
  strings but may omit a useful suggestion after three edits; that is preferable to a
  wrong recovery hint under this ticket's no-false-suggestion contract.
- Levenshtein distance does not treat a transposition as one edit. A transposed typo
  costs two and still fits the chosen threshold.
- The shell uses the stable `unknown command:` prefix as its targeted-error marker.
  If that parser contract is renamed later, its rendering condition must change in the
  same module.
- Suggestions apply only to unknown top-level verbs, not flags, playbook names, or
  command-specific arguments. Those are deliberately outside this story.
- Suggestions are advisory only; Vend never auto-runs the corrected command and adds
  no interactive approval step.

No critical issue, follow-up TODO, or unverified acceptance clause remains.

## Commit and ownership review

- Commit: `f828a5f8325b0fdd2079ec9fc2cb4304700c5ec2`.
- Subject: `feat(cli): suggest nearest unknown verb (T-072-01-02)`.
- Method: `lisa commit-ticket`.
- Exact includes: `src/cli.ts`, `src/cli.test.ts`.
- No ordinary `git add` or `git commit` was used.
- No hook was bypassed.
- Both ticket-owned source files are clean and unstaged after commit.
- Existing/concurrent Lisa provenance, ticket frontmatter, and shared work-directory
  changes remain outside the ticket commit.
- This worker wrote phase artifacts only to the private attempt directory.
- This worker did not update ticket phase or status fields.
- This worker did not write phase artifacts directly to the shared work directory.

## Final handoff

The did-you-mean behavior is implemented, fixture-proven, full-gate green, committed,
and honest about its threshold boundary. This attempt should now remain on
`T-072-01-02` and stop pending Lisa's completion publication.
