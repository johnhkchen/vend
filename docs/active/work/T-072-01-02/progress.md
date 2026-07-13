# Progress — T-072-01-02

## Status

Implementation and verification are complete. The ticket-owned source unit is ready
for its exact-path Lisa commit.

## Phase completion

- [x] Read `AGENTS.md`.
- [x] Read `docs/knowledge/vision.md`.
- [x] Read `docs/knowledge/rdspi-workflow.md`.
- [x] Read `docs/knowledge/charter.md` and stack context.
- [x] Read parent story `S-072-01` before ticket research.
- [x] Read ticket `T-072-01-02` and the private assignment.
- [x] Wrote private `research.md`.
- [x] Wrote private `design.md`.
- [x] Wrote private `structure.md`.
- [x] Wrote private `plan.md`.
- [x] Implemented the pure edit-distance suggester.
- [x] Wired bounded suggestions into unknown-verb parsing.
- [x] Removed the usage wall from unknown-verb direct output.
- [x] Added pure, parser, and subprocess tests.
- [x] Ran focused verification.
- [x] Ran the full repository gate successfully.
- [x] Commit exact ticket source paths with `lisa commit-ticket`.
- [ ] Write private `review.md` after the commit.

## Production changes

### `src/cli.ts`

- Added a private canonical `COMMAND_VERBS` tuple containing fourteen literal verbs.
- Excluded global flags, aliases, selection syntax, and result-only command kinds.
- Added a private two-row Levenshtein implementation over Unicode code points.
- Exported pure `suggestCommand(token, candidates, maxDistance = 2)`.
- Implemented stable input-order tie handling.
- Implemented an inclusive maximum-distance threshold.
- Updated the unknown-selection branch to append the correction suffix only when a
  canonical verb is within distance two.
- Preserved the established `{ cmd: "usage", error }` parser result shape.
- Updated the direct shell to omit the banner for errors beginning with the stable
  `unknown command:` prefix.
- Preserved stderr and exit status 2 for unknown commands.
- Preserved the banner for all other usage/syntax errors.

## Test changes

### `src/cli.test.ts`

- Imported the exported pure suggester.
- Added direct unit cases for insertion, deletion, and substitution near misses.
- Added lowest-distance candidate selection coverage.
- Added stable tie-order coverage.
- Added inclusive threshold coverage.
- Added distant-input and empty-candidate silence coverage.
- Added exact parser coverage for `steeer -> steer`.
- Preserved exact distant `frobnicate` and retired `work` result shapes.
- Added direct subprocess cases for both acceptance examples.
- Subprocess assertions pin empty stdout, exact one-line stderr, and exit status 2.

## Observable behavior

`bun src/cli.ts steeer` now yields:

```text
unknown command: steeer — did you mean steer?
```

`bun src/cli.ts frobnicate` now yields:

```text
unknown command: frobnicate
```

Both write only that line to stderr, write nothing to stdout, omit `USAGE`, and exit
2. The distant example intentionally omits a suggestion because the acceptance
contract explicitly requires silence when nothing is within threshold.

## Verification record

### Focused CLI test

Command:

```bash
bun test src/cli.test.ts
```

Result after initial implementation:

- 111 passed;
- 0 failed;
- 206 expectations.

### Typecheck sample

Command:

```bash
bun run build
```

Result: passed (`tsc --noEmit`).

### First full gate

Command:

```bash
bun run check
```

Result: failed with one compatibility assertion in `src/version.test.ts`.

Observed failure:

- the initial design added enumerable `showUsage: false` to unknown parser results;
- `src/version.test.ts` pins `parseArgs(["--nope"])` to the exact existing two-field
  usage object;
- all other reported tests passed.

This was a ticket-owned regression, not an environmental failure.

### Focused compatibility rerun

After revising the private Design, Structure, and Plan and removing the result field:

```bash
bun test src/cli.test.ts src/version.test.ts
```

Result:

- 117 passed;
- 0 failed;
- 217 expectations.

### Final full gate

Command:

```bash
bun run check
```

Result:

- BAML generation passed;
- TypeScript typecheck passed;
- 1,659 tests passed;
- 0 tests failed;
- 1 integration test skipped because no `dist/` artifacts were present, as its test
  message explicitly permits;
- 5,087 expectations passed across 111 files.

## Plan deviation

The initial selected structure used optional `showUsage: false` on targeted usage
results. The first full gate demonstrated that unknown-result exact shape is already a
cross-file compatibility contract. Because story scope permits only `src/cli.ts` and
`src/cli.test.ts`, changing `src/version.test.ts` was not acceptable.

Before continuing, the private Design, Structure, and Plan were revised to choose the
stable `unknown command:` prefix in the adjacent shell. Production and ticket tests
were then updated. This preserves the old pure parser result shape while satisfying
the one-line output contract. No acceptance behavior was weakened.

## Worktree ownership

Pre-existing/concurrent paths visible during implementation include Lisa provenance,
ticket frontmatter, shared work directories, and `src/engine/cast.ts` plus its test.
They are unrelated to this ticket and were not edited or staged by this worker.

The only ticket-owned repository source paths are:

- `src/cli.ts`
- `src/cli.test.ts`

Private artifacts are intentionally not part of the source commit; Lisa owns their
admission and publication.

## Commit intent

One atomic source unit will be committed through:

```bash
lisa commit-ticket \
  --ticket-id T-072-01-02 \
  --message "feat(cli): suggest nearest unknown verb (T-072-01-02)" \
  --include src/cli.ts \
  --include src/cli.test.ts
```

No ordinary `git add`, `git commit`, broad include, or hook bypass will be used.

## Commit result

- Lisa commit completed successfully.
- Commit: `f828a5f8325b0fdd2079ec9fc2cb4304700c5ec2`.
- Subject: `feat(cli): suggest nearest unknown verb (T-072-01-02)`.
- Included exactly `src/cli.ts` and `src/cli.test.ts`.
- Both ticket-owned source files are clean and unstaged after commit.
- Remaining worktree entries are Lisa-owned metadata/publication paths for active
  tickets and were not included.
