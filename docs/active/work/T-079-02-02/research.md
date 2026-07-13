# Research — T-079-02-02

## Assignment and workflow boundary

This attempt starts at `phase: research` and must continue through all remaining RDSPI phases.
Artifacts belong only under `.lisa/attempts/T-079-02-02/1/work/`; Lisa publishes admitted copies.
The worker must not edit ticket phase/status frontmatter.

Ticket-owned source commits must use `lisa commit-ticket` with exact repeated `--include` paths.
Ordinary `git add` and `git commit` are prohibited for repository implementation work. Fixture Git
commands inside tests are test setup and exercise, not ticket source commits.

The final repository gate is `bun run check`, and done requires ticket-owned paths committed and
clean.

## Product and story contract

Vend is a local-first clearing house whose standard interaction minimizes repeated supervision.
This ticket advances P2 and P4 by replacing a manually assembled sweep commit with one presented
machine assembly and one deliberate human consent keystroke.

Parent story `S-079-02` owns the new sweep slice. Its first ticket landed pure eligibility and
assembly. This ticket owns the actual `vend sweep` terminal verb, confirmation, epic-card writes,
and pathspec-limited Git commit.

The story deliberately retains confirmation. The machine selects and assembles; the human consents.
The story excludes archiving, ticket/story flips, automatic confirmation, and metered work.

## Acceptance surface

On a fixture repository, `vend sweep` must:

- present the assembled commit before mutation;
- show its exact file list;
- show the provenance message naming cleared tickets;
- wait for one confirmation keystroke;
- commit only after confirmation;
- land a commit whose changed-file list contains only the pure core's pathspec;
- leave the tree untouched when declined;
- return a named, nonzero presweep andon when offenders exist;
- create no commit for a refusal.

The fixture needs one fully phase-done epic and one partial epic so the composed behavior proves both
positive selection and exclusion.

## Committed sweep core

`src/sweep/sweep-core.ts`, landed by T-079-02-01, exports `computeSweep`.

Its input is a canonical `WorkGraph` plus a `SweepVerdict`. Its successful `SweepFlipSet` contains:

- ordered epic flips;
- exact repository-relative epic-card paths;
- a pathspec derived exactly from those paths;
- a provenance commit message naming every cleared ticket per epic.

Expected unsafe/empty states are named refusal data:

- `presweep-offenders`;
- `stale-presweep`;
- `no-epics-ready`.

The core reuses `deriveEpicClearance` from settle-core, so ticket `phase: done` remains the sole
completion authority. It filters already-done epic cards and rejects an empty plan.

The effect shell must not re-derive eligibility, pathspec, or provenance.

## Presweep boundary

`src/ci/presweep-core.ts` exports `donePhaseIds`, `classifySweep`, and `SWEEP_PREFIXES`.

The presweep implication is: when any ticket is phase-done, source plus `docs/active/` must be clean.
Offenders are parsed from `git status --porcelain` and returned as repository-relative paths.

The existing `src/settle/settle.ts` shell demonstrates the intended observation:

1. load the graph from a supplied/default root;
2. run `git status --porcelain` in that root;
3. call `classifySweep({ doneIds: donePhaseIds(graph.tickets), porcelain })`.

For sweep, presweep must happen before confirmation and before any board write. A failed verdict can
therefore flow straight into `computeSweep` and produce its named refusal with no cleanup required.

The pure core also compares presweep done IDs with the graph's derived done IDs. This protects the
composition from mismatched facts.

## Graph and filesystem boundary

`src/graph/load.ts` loads conventional paths under the target root:

- `docs/active/epic/*.md`;
- `docs/active/stories/*.md`;
- `docs/active/tickets/*.md`.

`src/graph/model.ts` parses fenced YAML frontmatter using `Bun.YAML`, validates required fields,
links the board, and returns a deeply frozen graph.

Linked epic nodes retain semantic status but not complete source bytes. The sweep effect must read
each core-selected card path before applying its specified `status: <from>` to `status: done`
transition.

Live epic cards use leading fenced YAML and a top-level `status:` line. The effect should alter only
that frontmatter field and preserve the body and unrelated frontmatter bytes.

Before writing any card, all selected files can be read and transformed in memory. This prevents a
late malformed card from creating partial mutation.

## Confirmation timing

The acceptance phrase “declining leaves the tree untouched” fixes the ordering:

1. observe graph and Git;
2. compute the complete flip set;
3. render file list and message;
4. read one keystroke;
5. on decline, return without filesystem or Git mutation;
6. on confirm, apply the prepared changes and commit.

Writing first and asking afterward would require rollback and would violate the observable contract
during the prompt. The presented assembly can be exact without a working-tree mutation because the
pure core already supplies both file list and commit message.

For a TTY, stdin raw mode is the natural one-keystroke mechanism. For a pipe (the fixture test), the
same reader can consume the first byte without requiring newline. Raw mode must be restored in a
`finally` block.

Only `y` and `Y` should consent. Every other byte, including newline/end-of-stream, is decline.

## Git commit boundary

The story requires pathspec-limited staging. The effect should execute Git without a shell:

- `git add -- <exact pathspec...>`;
- `git commit --only -m <message> -- <exact pathspec...>`.

`git add --` stages only selected epic cards. `git commit --only ... -- <paths>` additionally makes
the commit itself path-limited even if an unrelated index entry exists outside presweep's scope.

The effect should report any nonzero Git result as an operational error with the command and useful
stderr/stdout tail. It must never broaden the pathspec to `docs/active/` or `.`.

The fixture can prove the landed boundary using `git diff-tree --no-commit-id --name-only -r HEAD`.

## CLI conventions

`src/cli.ts` has a pure parser plus a thin `import.meta.main` dispatch shell. Heavy/effect modules
are lazily imported by their command arm.

The adjacent `vend settle` command establishes the pattern for a free, no-argument repository
gesture:

- list under `free (no tokens)` in `USAGE`;
- add a literal command union member;
- add the canonical verb for typo suggestions;
- parse no trailing arguments or budget;
- lazily import the effect shell;
- print expected success/refusal data without stack traces;
- use nonzero exit for andons/operational failures.

`vend sweep` differs because it is mutating and interactive, but it remains free: no play registry,
executor, budget, funding counter, or run log belongs on its path.

## Existing test conventions

`src/cli.test.ts` already creates a complete fixture Git repository for `vend settle`, runs the
absolute source CLI with fixture cwd, and inspects stdout/stderr/files.

The sweep fixture can use the same technique. `Bun.spawn` accepts `stdin: "pipe"`; the test writes a
single `y` or `n` byte and ends stdin. Fixture repositories configure local user name/email before
committing.

Focused effect tests can live in `src/sweep/sweep.test.ts` and pin pure text transformation and
rendering without subprocess setup. The CLI fixture remains necessary to prove the complete verb,
keystroke, Git, exit-code, and commit-file-list acceptance.

## Current worktree

The shared worktree already contains Lisa-owned modifications to provenance and ticket cards.
These are unrelated and must be preserved.

The expected ticket-owned implementation paths are:

- `src/sweep/sweep.ts` — effect shell, confirmation reader, renderer, narrow card rewrite, Git commit;
- `src/sweep/sweep.test.ts` — focused pure/effect-boundary tests;
- `src/cli.ts` — free verb parser/help/dispatch;
- `src/cli.test.ts` — parser and fixture repository acceptance.

The committed `src/sweep/sweep-core.ts` and its tests should remain unchanged unless implementation
reveals a contract defect. No such defect is visible in research.

## Constraints carried into Design

- Reuse `computeSweep`; do not duplicate eligibility or provenance.
- Present before mutation.
- Decline must perform zero writes and zero Git mutations.
- Presweep refusal must remain named data and exit nonzero.
- Read and validate all selected transformations before the first write.
- Stage and commit exact core-provided pathspecs only.
- Use `git commit --only` to protect the commit from unrelated staged state.
- Keep Markdown transformation pure and narrowly status-field scoped.
- Keep stdin/Git/fs/process effects in the sweep shell.
- Do not archive or change tickets/stories.
- Do not touch executor, budget, or run-ledger surfaces.

