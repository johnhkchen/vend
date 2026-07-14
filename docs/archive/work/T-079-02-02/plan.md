# Plan — T-079-02-02

## Goal

Land the free `vend sweep` command as one coherent source unit: present the committed core's exact
assembly, accept one key, and commit only the selected epic cards, with fixture proof for accept,
decline, and presweep andon paths.

## Step 1 — create sweep effect contracts

Create `src/sweep/sweep.ts` with imports, `CommandResult`, `SweepApplyError`, option interfaces, and
direct Git command helper.

Keep all paths repository-relative until the filesystem boundary. Do not import executor, play,
budget, shelf, run-log, or BAML modules.

Verification: `bun run build` after the exported skeleton exists.

## Step 2 — implement and test the pure epic-card rewrite

Implement `renderEpicStatusFlip`:

- leading fenced-frontmatter requirement;
- semantic ID/from-status checks through `parseFrontmatter`;
- exactly one top-level status line;
- exact replacement with `status: done`;
- preservation of all unrelated bytes/newline style.

Create `src/sweep/sweep.test.ts` and add normal, body-preservation, CRLF, wrong-ID, stale-status,
missing-status, and duplicate-status cases.

Run:

```bash
bun test src/sweep/sweep.test.ts
bun run build
```

## Step 3 — implement preparation and renderers

Add `prepareSweep`:

- load graph from root;
- run Git porcelain;
- classify presweep from graph phases;
- delegate once to `computeSweep`.

Add `renderSweepPlan` and `renderSweepRefusal`. Extend focused tests with exact plan and refusal
output assertions.

Verify that preparation contains no filesystem writes and renderers contain no effects.

Run the focused sweep tests again.

## Step 4 — implement exact commit effect

Add `commitSweep` with the ordering:

1. validate plan/pathspec invariant;
2. read and transform every selected card;
3. write replacements;
4. stage exact pathspec;
5. commit exact pathspec using `--only` and core message;
6. read HEAD SHA;
7. best-effort scoped restore/reset on failure.

Do not add a broad path or ambient `git commit` command.

Run focused tests and typecheck.

## Step 5 — implement one-byte confirmation reader

Add `readSweepConfirmation`:

- raw TTY mode where supported;
- resolve on first data/end/error;
- true only for `y`/`Y`;
- pause and restore raw mode in `finally`.

The CLI fixture in Step 8 will exercise real piped one-byte behavior.

## Step 6 — wire CLI parser/help

Modify `src/cli.ts`:

- add `vend sweep` to free usage;
- add `{ cmd: "sweep" }`;
- add literal command inventory entry;
- add parser routing and no-argument `parseSweepArgs`.

Modify `src/cli.test.ts` with bare/invalid/budget/help assertions. Update grouped command inventory.

Run:

```bash
bun test src/cli.test.ts
bun run build
```

## Step 7 — wire interactive dispatch

Add a lazy sweep dispatch arm adjacent to settle:

- prepare and render;
- refusal to stderr/exit 1;
- plan and prompt to stdout;
- await one key;
- decline receipt/exit 0 without calling commit;
- confirmed commit and SHA receipt/exit 0;
- concise operational error/exit 1.

Keep the command free and independent of executor/run state.

## Step 8 — add fixture repository acceptance

In `src/cli.test.ts`, build isolated valid boards with:

- one two-ticket all-done epic;
- one two-ticket partial epic;
- committed baseline and local Git identity.

Add three tests:

### Decline

- pipe exactly `n`;
- assert file list and provenance presented;
- assert decline receipt;
- assert HEAD unchanged;
- assert empty porcelain;
- assert both epic bytes unchanged.

### Confirm

- pipe exactly `y`;
- assert assembly presented before receipt;
- assert HEAD advanced;
- inspect `diff-tree` and assert only `docs/active/epic/E-900.md`;
- inspect `%B` and assert exact core provenance;
- assert only E-900 status changed to done;
- assert E-901 stayed open;
- assert worktree clean.

### Presweep andon

- dirty one in-scope board file after baseline;
- record HEAD;
- invoke sweep;
- assert nonzero exit and named `presweep-offenders` with exact path/action;
- assert no confirmation prompt;
- assert HEAD unchanged and no sweep commit.

Run the focused CLI test repeatedly if subprocess timing/input cleanup is flaky; a one-byte pipe must
terminate deterministically.

## Step 9 — inspect implementation boundaries

Review the diff for:

- mutation before confirmation;
- eligibility or message duplication;
- broad Git paths;
- shell command interpolation;
- card-body reconstruction;
- un-restored raw mode;
- accidental executor/budget/run-log imports;
- changes to committed core/upstream policy;
- changes to unrelated shared worktree files.

Run `git diff --check` over the four owned source paths.

## Step 10 — focused verification

Run:

```bash
bun test src/sweep/sweep.test.ts src/cli.test.ts
bun run build
```

Repair every ticket-owned failure. If an upstream contract makes acceptance impossible, document the
deviation before changing scope; no such change is currently expected.

## Step 11 — full repository gate

Run `bun run check` before commit as required by AGENTS.md.

If a failure belongs to unrelated concurrent state, establish ownership without editing another
ticket's files. Block honestly if the required gate cannot become green.

## Step 12 — commit through Lisa

Commit the single meaningful source unit exactly:

```bash
lisa commit-ticket \
  --ticket-id T-079-02-02 \
  --message "feat(sweep): add one-keystroke closeout commit" \
  --include src/sweep/sweep.ts \
  --include src/sweep/sweep.test.ts \
  --include src/cli.ts \
  --include src/cli.test.ts
```

Do not use ordinary `git add` or `git commit` for ticket work.

After commit, inspect:

- HEAD subject/hash;
- commit file list exactly equals the four includes;
- all four owned paths are clean;
- unrelated Lisa/ticket modifications remain untouched.

## Step 13 — post-commit verification

Run the focused sweep and CLI tests post-commit. Run full `bun run check` post-commit if the Lisa
commit hook does not provide a trustworthy full-gate result or repository state changed materially.

Record exact results and commit hash in `progress.md`.

## Step 14 — Review

Create `review.md` with:

- disposition;
- summary and file inventory;
- acceptance mapping;
- architecture/scope review;
- focused/full test evidence;
- commit evidence;
- shared-worktree ownership review;
- open concerns and honest boundary.

Create `review-disposition.json` with exactly:

```json
{"disposition":"pass","reason":null}
```

only if acceptance, green gate, committed source, and clean ticket-owned paths are all proven.
Otherwise write the exact block shape with a nonempty actionable reason.

After Review, remain on this ticket and stop for Lisa completion handling.

