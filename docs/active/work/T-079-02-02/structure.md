# Structure — T-079-02-02

## Change summary

The ticket adds one sweep effect/presentation module and focused tests, then wires it into the CLI
parser/help/dispatch surface. The committed pure sweep core remains authoritative and unchanged.

## File inventory

| Path | Action | Responsibility |
|---|---|---|
| `src/sweep/sweep.ts` | create | Observe presweep, render assembly/refusal, read one key, rewrite epic status, exact Git commit |
| `src/sweep/sweep.test.ts` | create | Pin narrow frontmatter rewrite and deterministic terminal rendering |
| `src/cli.ts` | modify | Add free sweep grammar, help/suggestion entry, and lazy interactive dispatch |
| `src/cli.test.ts` | modify | Prove parser behavior and fixture-repo accept/decline/andon acceptance |
| private RDSPI artifacts | create | Attempt-local Research through Review evidence |

No source files are deleted. `src/sweep/sweep-core.ts` is consumed but not modified.

## `src/sweep/sweep.ts`

### Imports

Runtime imports are limited to:

- `node:fs/promises` for card reads/writes;
- graph loader and frontmatter parser;
- presweep pure classifiers;
- sweep core computation and types.

It imports no play, executor, budget, shelf, run-log, or BAML module.

### Error type

```ts
export class SweepApplyError extends Error
```

This names malformed/stale card application failures. It is an operational refusal at the CLI
boundary and includes the repository-relative path/detail. It is not a new eligibility result.

### Command helper

```ts
interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function runGit(root: string, args: readonly string[]): Promise<CommandResult>
```

`runGit` executes `git` directly in `root`, captures both streams, and awaits exit. A sibling helper
formats nonzero results with the command and useful output.

### Pure card renderer

```ts
export function renderEpicStatusFlip(
  contents: string,
  flip: EpicFrontmatterFlip,
): string
```

Internal structure:

- locate the leading frontmatter fence and closing fence;
- use `parseFrontmatter` for semantic ID/status verification;
- split only the frontmatter block while preserving separators;
- identify exactly one top-level `status:` line;
- replace it with `status: done`, preserving line ending and all unrelated bytes;
- throw `SweepApplyError` on structural or stale mismatch.

The function performs no filesystem work and does not mutate inputs.

### Preparation API

```ts
export interface PrepareSweepOptions {
  readonly root?: string;
}

export async function prepareSweep(
  options?: PrepareSweepOptions,
): Promise<SweepResult>
```

Ordering:

1. resolve root to option or `process.cwd()`;
2. load the canonical graph;
3. execute `git status --porcelain`;
4. reject Git environment failure;
5. compute `donePhaseIds` and `classifySweep`;
6. call `computeSweep` once and return its value unchanged.

There are no writes or index changes in this API.

### Commit API

```ts
export interface CommitSweepOptions {
  readonly root?: string;
}

export async function commitSweep(
  plan: SweepFlipSet,
  options?: CommitSweepOptions,
): Promise<string>
```

Internal records hold `{ path, original, replacement }` for each flip.

Before writing:

- require nonempty pathspec/flips;
- require exact pathspec-to-flips equality;
- read all files;
- render all replacements;
- ensure every replacement differs.

After preparation:

- write replacements at `join(root, path)`;
- `git add -- ...pathspec`;
- `git commit --only -m message -- ...pathspec`;
- `git rev-parse HEAD`;
- return trimmed SHA.

On failure after the first write, best-effort restore original files and reset only selected index
paths to HEAD, then throw the primary error with rollback detail if necessary.

### Render APIs

```ts
export function renderSweepPlan(plan: SweepFlipSet): string
export function renderSweepRefusal(refusal: SweepRefusal): string
```

Both are pure and newline-terminated. Plan order follows `pathspec`; refusal preserves core reason
and next action and adds offender lines only for `presweep-offenders`.

### Confirmation API

```ts
export function readSweepConfirmation(
  input?: NodeJS.ReadStream,
): Promise<boolean>
```

The implementation owns raw-mode enable/restore, first-byte classification, resume/pause, and
end/error cleanup. It returns true only for `y`/`Y`.

## `src/sweep/sweep.test.ts`

### Card rewrite tests

Build canonical epic Markdown strings and plain `EpicFrontmatterFlip` values.

Assertions cover:

- exact changed bytes for a normal LF document;
- CRLF preservation;
- body content containing `status:` is untouched;
- ID mismatch;
- stale status mismatch;
- no top-level status;
- duplicate top-level status.

### Rendering tests

Construct a plain `SweepFlipSet` and assert:

- header;
- exact ordered file lines;
- message copied verbatim;
- final newline.

Construct `presweep-offenders` and `no-epics-ready` refusals and assert named codes, offender lines,
reasons, next actions, and absence of invented file/message claims.

Confirmation is exercised through the CLI fixture with real piped stdin; no fake stream class is
required unless a focused failure reveals untested cleanup behavior.

## `src/cli.ts`

### Usage

Add `vend sweep` directly after `vend settle` in the free command group.

### Parsed command union

Add:

```ts
| { readonly cmd: "sweep" }
```

### Command inventory and parser table

Add `sweep` to `COMMAND_VERBS` and route the head token to `parseSweepArgs`.

```ts
function parseSweepArgs(argv: readonly string[]): ParsedCommand
```

Only one token is accepted. A second token returns
`unexpected sweep argument: <token>`.

### Dispatch arm

Place beside settle:

1. lazy-import `prepareSweep`, renderers, confirmation reader, and `commitSweep`;
2. try preparation;
3. on core refusal, write rendered refusal to stderr and exit 1;
4. write plan presentation and `commit? [y/N] ` to stdout;
5. await one key and write newline;
6. on false, write decline receipt and exit 0;
7. on true, call `commitSweep`, write SHA receipt, exit 0;
8. catch preparation/commit errors into concise stderr and exit 1.

No budget echo or run summary is used.

## `src/cli.test.ts`

### Imports

Existing filesystem imports cover fixture creation. Add `readFile` only if direct Bun file reads do
not suffice. Existing `Bun.spawn`/`spawnSync` patterns remain.

### Parser block

Add `parseArgs — sweep` tests:

- bare success;
- positional rejection;
- flag rejection;
- budget rejection;
- free help placement.

Update grouped help inventory with `vend sweep` and the total command count.

### Fixture helper

Define a local async fixture builder returning:

- `root`;
- absolute CLI path;
- relevant epic/ticket paths;
- `git(...args)` helper;
- `invoke(input?)` helper that pipes at most one byte.

The board contains:

- `E-900` with two phase-done tickets;
- `E-901` with one done and one implement ticket;
- one story per epic;
- valid ticket dependency edges.

All files are committed as `fixture baseline` before scenarios.

### Decline scenario

Record baseline HEAD and card bytes. Invoke with `n`. Assert plan contents, exit 0, decline receipt,
same HEAD, empty porcelain, and byte-identical cards.

### Confirm scenario

Invoke with `y`. Assert plan contents and success receipt, different HEAD, exact commit file list,
exact `%B` provenance, done status only in `E-900`, unchanged `E-901`, and empty porcelain.

### Offender scenario

Modify a ticket or selected board path after baseline. Invoke without needing confirmation. Assert
exit 1, stderr named `presweep-offenders`, offender path and next action, empty stdout or no prompt,
same HEAD, and no new commit.

## Commit boundary

After green focused and full gates, commit exactly:

```text
lisa commit-ticket \
  --ticket-id T-079-02-02 \
  --message "feat(sweep): add one-keystroke closeout commit" \
  --include src/sweep/sweep.ts \
  --include src/sweep/sweep.test.ts \
  --include src/cli.ts \
  --include src/cli.test.ts
```

Private artifacts are excluded; Lisa owns admission/publication.

## Unchanged boundaries

- sweep eligibility and message assembly;
- settle core/shell;
- presweep classifier;
- graph schema;
- board archiving;
- ticket/story state;
- executor and budget layers;
- run ledger;
- Lisa-owned ticket frontmatter.

