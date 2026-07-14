# Review — T-075-04-01

## Disposition

Pass. The ticket acceptance criterion is met, the full repository gate is green,
and the complete ticket-owned source unit is committed through Lisa with exact
paths. No actionable blocker or open implementation concern remains.

## Ticket reviewed

- Ticket: `T-075-04-01`.
- Title: `write-line-plural-grammar`.
- Story: `S-075-04`.
- Advances: P5 local-first and P3 gates-as-contract.
- Required behavior: singular group/card/link at count one and plural at N>1.
- Required evidence: a CLI test asserting both grammar cases.

## Summary of changes

### `src/cli.ts`

Added a private pure `countedNoun(count, noun)` helper. It returns the unmodified
regular noun when the count is exactly one and appends `s` for every other count.
The production counts are derived from array lengths, so this covers their full
normal domain while also retaining ordinary zero-count plural grammar.

Added exported pure `formatSvgWriteLine(path, groupCount, cardCount, linkCount)`.
It owns the complete user-visible SVG completion line, including:

- `wrote` prefix;
- returned output path;
- em dash separator;
- group, card, and link counts in established order;
- comma and space separators;
- independently selected noun forms;
- trailing newline.

Updated the real `vend svg` dispatch arm to pass the fields returned from
`writeBoardSvg` to `formatSvgWriteLine` and write the result to stdout. This is
the same formatter directly exercised by the regression tests.

### `src/cli.test.ts`

Imported `formatSvgWriteLine` from the production CLI module and added two exact
string tests beside the existing SVG CLI parser coverage.

Singular case:

```text
wrote board.svg — 1 group, 1 card, 1 link
```

Plural case:

```text
wrote board.svg — 2 groups, 3 cards, 4 links
```

The plural case intentionally uses distinct values so field-order mistakes would
be visible. Both tests also pin the established path position, punctuation,
spacing, and trailing newline.

## Acceptance evaluation

Acceptance criterion:

> A cli test asserts the write line reads '1 group, 1 card, 1 link' at count 1
> and the plural forms at N>1.

Result: met.

- The singular test supplies one for all three counts.
- It expects the exact required singular phrase.
- The plural test supplies two, three, and four.
- It expects `groups`, `cards`, and `links` respectively.
- The production SVG stdout arm uses the tested formatter.
- The regression is part of the existing adjacent CLI test file.

## Architectural review

The change respects the pure-core/impure-shell convention:

- noun selection and line composition are pure functions over plain values;
- filesystem work remains in `writeBoardSvg`;
- stdout remains in the guarded dispatch shell;
- the tests do not invoke filesystem or process-exit effects.

The CLI remains the owner of its terminal copy. `SvgFileResult` stays a neutral
data contract and the present layer gains no dependency on CLI wording.

The existing lazy import boundary remains intact. Importing `src/cli.ts` in the
test does not eagerly import `src/present/svg-file.ts` or execute the dispatcher.

## Compatibility review

Unchanged behavior:

- command name and usage text;
- `svg` argument parsing;
- default designer seat;
- explicit designer/dev seat selection;
- `--out` handling;
- output path splitting;
- graph loading and projection;
- group/card/link count calculation;
- SVG rendering and file bytes;
- successful exit code;
- plural wording for counts greater than one;
- zero-count plural wording.

Changed behavior is limited to a count exactly equal to one, where the relevant
noun now uses its singular form. Mixed count lines are handled independently by
the three calls to `countedNoun`.

## Test coverage

### Focused gate

```bash
bun test src/cli.test.ts
```

Result:

- 116 passed;
- 0 failed;
- 215 expectations.

The focused file covers both new grammar branches for every noun and confirms all
existing CLI parser and smoke behavior remains green.

### Full repository gate

```bash
bun run check
```

Result:

- BAML generation passed;
- TypeScript typecheck passed;
- 1751 tests passed;
- 0 tests failed;
- 1 test skipped under its existing no-`dist/` guard;
- 5514 expectations ran across 116 files.

The skip is unrelated release acceptance coverage that explicitly skips when
local distribution artifacts are absent. It does not reduce coverage of this
ticket's CLI behavior.

### Diff hygiene

```bash
git diff --check -- src/cli.ts src/cli.test.ts
```

Result: passed.

## Commit review

Commit:

```text
18183e1f40591d3506e5e5e534e62816f92ab546
```

Subject:

```text
fix(cli): pluralize svg write counts
```

The commit was made with `lisa commit-ticket` and exact includes:

- `src/cli.ts`
- `src/cli.test.ts`

No ordinary `git add` or `git commit` was used. The commit contains only those
two source paths. Post-commit checks show both paths clean and unstaged.

## Scope review

The ticket stayed inside the story's grammar slice.

Not changed:

- grouping degeneracy;
- status-axis behavior;
- `DESIGNER_PRESET`;
- projection logic;
- SVG layout;
- command naming;
- new SVG features;
- designer render-and-watch behavior.

The sibling diagnosis and fork tickets retain ownership of grouping concerns.

## Worktree review

Unrelated Lisa-managed changes remain in the shared worktree, including config,
hooks, provenance, completion journal, ticket frontmatter, and published work
artifacts. They were present or produced by Lisa orchestration and were excluded
from the exact-path source commit. No ticket-owned source is left modified,
staged, or untracked.

## Open concerns and limitations

No ticket-blocking concerns remain.

The formatter handles regular nouns only, deliberately matching the three nouns
in this command. It is not a general English inflector, and no such abstraction
is warranted by this ticket. The function accepts numbers without runtime
validation because its production inputs are non-negative array-derived counts.

No spawned-process CLI integration test was added. That would require unrelated
board and filesystem setup to control exact counts. The tested pure formatter is
the actual function called by the production stdout arm, while existing
`svg-file` tests separately cover the effectful count and file-output path.

## Final assessment

The user-visible defect is corrected, the exact grammar contract is pinned at the
CLI boundary, the architectural seams are preserved, and all required checks and
commit rules are satisfied. Disposition: pass.
