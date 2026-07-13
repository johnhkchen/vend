# Plan — T-079-01-02

## Execution constraints

- Stay within S-079-01's typed-gesture slice.
- Preserve the committed settle-core contract.
- Keep judgment pure and effects thin.
- Never invoke a real executor or write the run ledger.
- Do not touch concurrent T-079-03/Lisa-owned paths.
- Do not edit ticket phase/status frontmatter.
- Commit source only through `lisa commit-ticket` with exact includes.
- Do not pass Review unless the full repository gate is green.

## Step 1 — establish ticket-local baseline

Inspect:

- `git status --short`;
- current exact diffs for the four planned paths;
- focused dependency tests (`bun test src/settle/settle-core.test.ts`).

Record ambient unrelated changes in `progress.md`. If a planned file already contains unrelated
uncommitted changes, stop and resolve ownership before editing. Otherwise continue.

Verification:

- dependency core tests are green;
- no preexisting ticket-owned diff exists;
- unrelated paths are explicitly known.

## Step 2 — create the settle effect shell

Create `src/settle/settle.ts` with public APIs:

- `reviewConcernFromDisposition`;
- `renderSettleResult`;
- `runSettle`;
- ANSI constants used by tests.

Implement strict review-disposition parsing first. Return null only for canonical pass. Convert
reasoned block to a named concern with the exact record-pass action. Convert malformed present data
to a named repair concern.

Verification:

- no filesystem/process calls occur in the pure disposition helper;
- block/pass/malformed shapes satisfy `ReviewConcern` requirements;
- type-only imports are used where appropriate.

## Step 3 — implement deterministic rendering

In the same module, implement the pure renderer for:

- first-settle full delta;
- repeated nonempty delta;
- repeated empty delta;
- per-epic cleared counts and sweep-ready suffix;
- green/red gate line;
- green/red presweep line;
- named review concerns or explicit none;
- ordered ANSI-red exceptions with verbatim next actions;
- typed marker refusal with exact repair action.

Keep output newline-terminated and compact. Add a `color: false` option only for deterministic plain
text tests; production defaults to red exceptions.

Verification:

- renderer never sorts or regenerates exceptions;
- every required acceptance line is present;
- ANSI reset immediately follows every red line;
- no terminal state leaks into later lines.

## Step 4 — implement effect assembly

Add internal effects to:

1. load the canonical board;
2. read optional `.vend/last-settle.json`;
3. scan present work-directory review dispositions;
4. run and summarize current `bun run check`;
5. run Git porcelain and reuse presweep core;
6. call `computeSettleVerdict` once;
7. atomically publish `nextMarker` only for a verdict.

Run the gate before Git status so generated/test activity has settled. Keep root injectable through a
simple options object for reuse and direct testing, while the CLI defaults to cwd.

Verification:

- the module imports no executor/play/budget/run-log code;
- only the marker path is written;
- malformed marker returns without write;
- temporary marker files are cleaned on publication failure;
- a gate failure remains verdict data with an exact next action.

## Step 5 — add focused settle tests

Create `src/settle/settle.test.ts`.

Disposition cases:

- exact pass;
- trimmed reasoned block;
- malformed JSON;
- missing/blank block reason;
- invalid pass reason/extra shape.

Renderer cases:

- complete fixture verdict with all required line classes;
- every exception line red with reset;
- exact next actions visible;
- empty repeated delta;
- explicit no concerns/exceptions;
- malformed marker refusal.

Run:

```text
bun test src/settle
```

Fix all failures before touching CLI wiring.

## Step 6 — wire parser, help, and suggestion inventory

Modify `src/cli.ts`:

- add `vend settle` under free commands;
- add `{ cmd: "settle" }` to `ParsedCommand`;
- add `settle` to `COMMAND_VERBS`;
- route it in `parseArgs`;
- implement no-argument `parseSettleArgs`.

Modify parser/help tests in `src/cli.test.ts`:

- bare settle parses;
- positional/unknown flag reject;
- `--budget` rejects;
- usage contains settle in the free group only;
- command inventory total becomes 18.

Run the focused CLI parser test file. Existing tests execute the whole file, so accept the full
`src/cli.test.ts` runtime.

Verification:

- `parseArgs(["settle"])` is exact;
- no budget field exists on the command type;
- help grouping remains exhaustive and nonduplicated;
- typo suggestions can select settle.

## Step 7 — wire the CLI effect dispatch

Add a dedicated `parsed.cmd === "settle"` arm before generic run dispatch.

Behavior:

- lazy-import `runSettle` and `renderSettleResult`;
- write a verdict to stdout and exit 0;
- write a typed core refusal to stderr and exit 1;
- catch operational observation failures, print one concise line, and exit 1.

Do not print funding, call `runPlay`, inspect executor configuration, or load run-log modules.

Verification:

- TypeScript narrowing leaves the final generic branch as `run`;
- settle has a structurally separate return/exit path;
- static imports at CLI top remain addon-light.

## Step 8 — add fixture-repository subprocess acceptance

In `src/cli.test.ts`, build an isolated fixture:

- canonical epic/story/tickets, including one phase-done ticket;
- canonical blocked review disposition named `missing release proof`;
- local package check printing `7 pass`;
- initialized Git repository with all board/source artifacts committed;
- executable sentinel configured as `CLAUDE_CLI`.

Invoke `vend settle` through the absolute source CLI path.

First invocation assertions:

- exit code 0;
- stderr empty;
- delta names the done ticket;
- epic count is exact;
- gate line is green and carries 7 tests;
- presweep line is green;
- review concern names ticket and reason;
- review exception is ANSI red;
- exact resolution action appears;
- `.vend/last-settle.json` has the canonical done frontier;
- executor sentinel absent;
- `.vend/runs.jsonl` absent.

Second invocation assertions:

- exit code 0;
- delta is exactly `none since last settle`;
- executor sentinel remains absent;
- `.vend/runs.jsonl` remains absent.

Always remove the temporary repository in `finally`.

## Step 9 — focused verification and repair

Run:

```text
bun test src/settle src/cli.test.ts
bun run check:typecheck
git diff --check -- src/settle/settle.ts src/settle/settle.test.ts src/cli.ts src/cli.test.ts
```

Inspect exact path diffs for correctness, scope, and accidental formatting churn. Record test counts
and any plan deviations in `progress.md`.

If failures arise from concurrent unrelated work, distinguish them with path evidence; do not edit
other-ticket files to force green.

## Step 10 — full repository gate

Run:

```text
bun run check
```

This must pass BAML generation, typecheck, and the full Bun suite. Record:

- exit code;
- test count;
- assertion count if emitted;
- skips;
- whether generated files changed.

Reinspect ticket-owned diffs after the gate.

## Step 11 — create the ticket source commit

Use exactly:

```text
lisa commit-ticket \
  --ticket-id T-079-01-02 \
  --message "feat(settle): add free one-screen verdict command" \
  --include src/settle/settle.ts \
  --include src/settle/settle.test.ts \
  --include src/cli.ts \
  --include src/cli.test.ts
```

Do not include private artifacts, board files, provenance, hook, seam, or other worktree paths.

Verification:

- command succeeds and reports a commit id;
- `git show --stat --oneline HEAD` contains only the four exact paths;
- none of those paths remains staged, modified, or untracked;
- ambient unrelated changes remain unchanged.

## Step 12 — post-commit verification

Run at minimum:

```text
bun test src/settle src/cli.test.ts
```

If the commit command/hook changed code or the repository moved concurrently, rerun the full gate.
Record final HEAD and exact path cleanliness in `progress.md`.

## Step 13 — Review artifacts

Write `review.md` summarizing:

- outcome and acceptance mapping;
- files and public interfaces;
- gate-source choice;
- review-concern policy;
- marker mutation boundary;
- no-executor/no-run-log proof;
- focused/full test evidence;
- commit id and exact includes;
- open concerns and honest fixture-only boundary.

Write `review-disposition.json` exactly as pass/null only if:

- every acceptance clause is proven;
- focused tests and full gate are green;
- commit exists through Lisa;
- ticket-owned paths are clean;
- no critical issue remains.

Otherwise write a block with a nonempty actionable reason.

## Acceptance checklist

- [ ] `vend settle` is a bare free command with no budget.
- [ ] Fixture command exits 0.
- [ ] Delta line and immediate empty re-delta are proven.
- [ ] Per-epic cleared counts are visible.
- [ ] Current repository gate line is visible.
- [ ] Canonical presweep line is visible.
- [ ] Open review concern is named from structured artifact data.
- [ ] Exceptions are ANSI red.
- [ ] Every exception has exact next action text.
- [ ] Last-settle marker advances atomically.
- [ ] `.vend/runs.jsonl` remains untouched.
- [ ] Executor sentinel remains untouched.
- [ ] Full `bun run check` is green.
- [ ] Source unit is committed with exact Lisa includes.
- [ ] Review artifacts are complete and honest.
