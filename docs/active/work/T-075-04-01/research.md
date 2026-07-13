# Research — T-075-04-01

## Ticket contract

- Ticket: `T-075-04-01`, `write-line-plural-grammar`.
- Parent story: `S-075-04`, `write-line-grammar-and-grouping-probe`.
- Current ticket phase is `research`.
- The assignment requires all remaining RDSPI phases in one continuous pass.
- Phase artifacts belong in this attempt-private directory.
- Lisa, not the worker, owns ticket phase and status transitions.
- Ticket-owned source must be committed only through `lisa commit-ticket`.
- Each committed path must be supplied as an exact repository-relative `--include`.
- The ticket acceptance criterion requires a CLI test for singular and plural output.
- Required singular text is `1 group, 1 card, 1 link`.
- Required plural behavior applies when each count is greater than one.

## Story boundary

- The story has two distinct areas: write-line grammar and grouping degeneracy.
- This ticket owns only the grammar edit.
- The grammar edit is described as free and unconditional.
- Grouping degeneracy diagnosis belongs to `T-075-04-02`.
- The fix-or-document grouping branch belongs to `T-075-04-03`.
- Structural grouping changes are explicitly outside this story slice.
- Renaming CLI commands is outside the slice.
- New SVG features are outside the slice.
- The designer render-and-watch probe is outside the slice.
- This ticket should therefore not modify projection, grouping, or SVG rendering behavior.

## Governing project constraints

- Vend is local-first and the SVG command is a local file-output seam.
- P5 requires the command to remain fully local and offline.
- P3 requires the grammar behavior to be pinned by an enforceable test.
- The project favors a pure core and impure shell.
- Logic should be expressible as a pure function over plain values.
- Filesystem, process output, and process exit belong in the thin shell.
- The repository gate is `bun run check`.
- The gate performs BAML generation, TypeScript checking, and the full test suite.
- Bun must not be upgraded as part of this work.

## Relevant command implementation

- The CLI entry point is `src/cli.ts`.
- `parseArgs` recognizes `svg` and delegates to `parseSvgArgs`.
- `parseSvgArgs` is a pure parser for `--seat` and `--out`.
- The parser defaults the SVG seat to `designer`.
- The impure dispatch shell begins under `if (import.meta.main)`.
- Importing `src/cli.ts` from a test does not execute that shell.
- The SVG dispatch arm is near line 940.
- It lazily imports `writeBoardSvg` from `src/present/svg-file.ts`.
- It lazily imports `dirname` and `basename` from `node:path`.
- It passes the selected seat to `writeBoardSvg`.
- When `--out` is present, it splits the full path into output directory and filename.
- The returned `result` is then printed to stdout.
- The SVG arm exits with code zero after writing.

## Existing defective write line

- The existing line is assembled directly inside `process.stdout.write`.
- Its shape is `wrote <path> — <groups> groups, <cards> cards, <links> links\n`.
- The labels are unconditionally plural.
- Count values are interpolated correctly.
- The defect appears only when a count equals one.
- The output path and em dash punctuation are already established behavior.
- Comma and space separators are already established behavior.
- The trailing newline is already established behavior.
- No parsing or rendering failure contributes to the grammar defect.

## Count source

- `src/present/svg-file.ts` defines `SvgFileResult`.
- `SvgFileResult` contains `path`, `svg`, `groupCount`, `cardCount`, and `linkCount`.
- All count fields are typed as numbers.
- `writeBoardSvg` computes `groupCount` from `projection.groups.length`.
- It computes `cardCount` by reducing the cards in all groups.
- It computes `linkCount` from `projection.links.length`.
- The write-line consumer does not need to recompute any count.
- The count source is not part of the defect.
- `src/present/svg-file.test.ts` already verifies the count values against projections.
- That test also covers empty-board counts and live-board grouping behavior.

## Existing CLI test organization

- The adjacent CLI test is `src/cli.test.ts`.
- It uses Bun's `describe`, `expect`, and `test` APIs.
- It imports pure exports from `src/cli.ts` at the top of the file.
- Its header explains why importing the CLI is safe under `import.meta.main`.
- Existing tests concentrate on argument parsing and pure CLI helpers.
- SVG parser tests live in `describe("parseArgs — svg (T-055-03 file-output seam)")`.
- Those tests cover default seat selection.
- They cover explicit designer and dev seats.
- They cover the output path option.
- They cover invalid seats, missing output paths, and positional arguments.
- There is no current test for the SVG completion write line.
- There is no subprocess test harness around the complete SVG CLI command.

## Existing helper patterns in `src/cli.ts`

- `parseBudgetArg` is exported and tested directly.
- `suggestCommand` is exported and tested directly.
- `splitAfter` is exported and tested directly.
- `formatFundingLine` is a small pure formatter but is not exported.
- The file already mixes pure parsing/formatting with the guarded impure dispatch shell.
- Adding a pure exported formatter is consistent with the current test seam.
- The file does not currently have a generic pluralization helper.
- No shared pluralization utility was found elsewhere in the relevant command path.

## Testability boundary

- Directly testing the process-output arm would require a subprocess or injectable effects.
- A subprocess would also require a board fixture and a real SVG file write.
- Existing `svg-file` tests already cover the file effect independently.
- The requested behavior is deterministic string formatting over a plain result-like value.
- A pure formatter can accept the path and three counts.
- A unit test can then assert the complete line byte-for-byte.
- The production stdout call can write exactly the formatter's returned string.
- This preserves the impure shell as a single output effect.

## Grammar cases

- English singular applies only when the corresponding count is exactly `1`.
- A count greater than one uses the plural noun.
- The ticket explicitly names `N>1` for plural behavior.
- The existing system can also produce zero, especially for an empty graph.
- Existing English CLI style implies zero should remain plural.
- Counts are non-negative in normal production because they derive from array lengths.
- Fractional and negative counts are not produced by `writeBoardSvg`.
- The formatter can still be total over `number` inputs without adding validation.
- Each noun must pluralize independently.
- Mixed count lines are possible and must not reuse one count's grammar for another noun.

## Worktree and ownership observations

- The worktree was already dirty when this attempt began.
- `.lisa.toml` and `.lisa/hooks/on-stop.sh` are modified.
- `.lisa/provenance.jsonl` is modified.
- `.lisa/completion-journal.jsonl` is untracked.
- `docs/active/tickets/T-075-03-01.md` is modified.
- `docs/active/tickets/T-075-04-01.md` is modified by Lisa phase handling.
- `docs/active/work/T-075-03-01/` is untracked.
- These paths are not ticket-owned implementation files for T-075-04-01.
- They must remain outside this ticket's commit transaction.
- `src/cli.ts` and `src/cli.test.ts` were clean at research time.

## Commit mechanism

- `lisa commit-ticket --help` confirms the command shape.
- Required arguments are `--ticket-id`, `--message`, and repeated `--include`.
- `--path` may identify the repository root and defaults to the current directory.
- The likely ticket-owned source paths are `src/cli.ts` and `src/cli.test.ts`.
- Phase artifacts remain private under `.lisa/attempts/.../work/`.
- Lisa publishes admitted artifacts after lease verification.
- Ordinary `git add` and `git commit` are prohibited for this assignment.

## Baseline conclusions

- The implementation defect is one unconditional plural suffix per noun.
- The existing count pipeline is correct and already separately tested.
- The smallest testable boundary is a pure write-line formatter in `src/cli.ts`.
- The regression belongs in the adjacent `src/cli.test.ts`.
- No projection, SVG renderer, or filesystem module needs modification.
- Exact line assertions can cover singular and plural grammar while preserving punctuation.
- Full verification must include the targeted CLI test and `bun run check`.
