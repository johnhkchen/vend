# Structure — T-079-01-02

## Change summary

The ticket adds one settle effect/formatting module and its focused tests, then wires that module
into the existing CLI parser/help/dispatch surface. No existing core policy module changes.

## File inventory

| Path | Action | Responsibility |
|---|---|---|
| `src/settle/settle.ts` | create | Observe gate/Git/review/marker facts, call the pure core, render, atomically persist marker |
| `src/settle/settle.test.ts` | create | Pin artifact parsing, terminal grammar, colors, and refusal/empty-delta behavior |
| `src/cli.ts` | modify | Add free settle command type, parse/help/suggestion entry, and lazy dispatch arm |
| `src/cli.test.ts` | modify | Prove parser grammar and fixture-repo end-to-end acceptance |
| private RDSPI artifacts | create | Attempt-local Research through Review handoff |

No files are deleted.

## `src/settle/settle.ts`

### Imports

The module imports only:

- `node:crypto` for a unique atomic-write temporary name;
- `node:fs/promises` for marker/review reads and atomic publication;
- `node:path` for root-relative paths;
- `loadWorkGraph` from the canonical graph loader;
- `classifySweep` and `donePhaseIds` from presweep core;
- `computeSettleVerdict`, marker constants/serializer, and settle types from settle core.

It must not import any play, executor, budget, funding, or run-log module.

### Public constants

```ts
export const ANSI_RED = "\x1b[31m";
export const ANSI_RESET = "\x1b[0m";
```

They make color behavior inspectable without hardcoded test duplication.

### Review disposition boundary

```ts
export function reviewConcernFromDisposition(
  ticketId: string,
  relativePath: string,
  contents: string,
): ReviewConcern | null
```

This function is pure. It validates strict pass/block JSON and returns:

- null for a canonical pass;
- one concern for a canonical reasoned block;
- one repair concern for invalid JSON or shape.

Internal helpers validate nonblank strings and build the malformed-artifact concern. The input path
is repository-relative so next actions remain portable and one-screen output does not leak temporary
absolute fixture paths.

### Review discovery

```ts
async function loadReviewConcerns(root: string): Promise<ReviewConcern[]>
```

This thin effect:

1. reads `docs/active/work` with directory entries;
2. tolerates a missing work root as no concerns;
3. sorts ticket directory names;
4. reads only present `review-disposition.json` files;
5. delegates every present file to `reviewConcernFromDisposition`.

Unexpected read errors other than absence propagate; unreadable present state is not silently green.

### Gate observation

```ts
async function runRepositoryGate(root: string): Promise<SettleGateResult>
```

It spawns `bun run check` with `cwd: root`, captures stdout/stderr, waits for completion, and maps the
result to the core's settle gate shape. Internal pure helpers select the last nonblank output line and
extract the last `<n> pass` count.

The function always returns a valid `SettleGateResult` for command exit outcomes. Spawn exceptions are
also converted into a failed gate result with the same exact rerun action.

### Presweep observation

```ts
async function runPresweep(root: string, tickets: readonly TicketNode[]): Promise<SweepVerdict>
```

It spawns `git status --porcelain`, rejects on nonzero exit with a concise error, and delegates
classification to `classifySweep` using `donePhaseIds(tickets)`.

### Marker input

```ts
async function readOptionalText(path: string): Promise<string | null>
```

ENOENT becomes null. Every other read error propagates.

### Atomic marker output

```ts
async function writeMarkerAtomically(root: string, contents: string): Promise<void>
```

It creates the parent, writes a unique exclusive temp file, renames over the destination, and removes
the temp on failure. The destination is always the core-owned marker constant under `root`.

### Main effect API

```ts
export interface RunSettleOptions {
  readonly root?: string;
}

export async function runSettle(options?: RunSettleOptions): Promise<SettleResult>
```

Ordering:

1. resolve root (`process.cwd()` default);
2. load graph, optional marker, and review concerns;
3. run current repository gate;
4. run Git presweep after gate completion;
5. call `computeSettleVerdict` once;
6. if verdict, atomically write `nextMarker`;
7. return result unchanged.

The graph/marker/review reads may begin together, but the gate and presweep remain sequential to avoid
transient gate writes affecting Git status.

### Pure renderer API

```ts
export interface RenderSettleOptions {
  readonly color?: boolean;
}

export function renderSettleResult(
  result: SettleResult,
  options?: RenderSettleOptions,
): string
```

The result is newline-terminated. Internal helpers format:

- id lists (`none` or comma-separated ids);
- counted ticket/path nouns;
- red wrapping conditional on `color !== false`;
- delta variants;
- epic readiness suffix;
- presweep detail;
- refusal and exception lines.

The renderer preserves core ordering exactly.

## `src/settle/settle.test.ts`

### Test groups

`reviewConcernFromDisposition`:

- canonical pass;
- canonical block with trimming;
- invalid JSON;
- invalid pass reason;
- block without a nonblank reason;
- unexpected keys/disposition.

`renderSettleResult`:

- a complete verdict with first delta, multiple epics, failed gate, presweep offender, and review
  concern;
- red prefix/reset on every exception;
- exact `nextAction` preservation;
- color-disabled deterministic text;
- immediate-repeat empty delta;
- no-review/no-exception explicit lines;
- malformed-marker refusal.

Tests construct plain `SettleResult` values. The pure core's own tests already establish computation;
this suite pins only this ticket's translation and presentation.

## `src/cli.ts`

### Usage banner

Add `vend settle` to the `free (no tokens)` section near other whole-project readouts.

### Parsed command union

Add:

```ts
| { readonly cmd: "settle" }
```

### Literal command inventory

Add `settle` to `COMMAND_VERBS` so typo suggestions teach the canonical spelling.

### Parser table

Route head token `settle` to:

```ts
function parseSettleArgs(argv: readonly string[]): ParsedCommand
```

The helper follows `parseDoctorArgs`: only length 1 is valid; otherwise return
`unexpected settle argument: <token>`.

### Dispatch arm

Before executor-bearing generic run dispatch:

```ts
if (parsed.cmd === "settle") {
  const { renderSettleResult, runSettle } = await import("./settle/settle.ts");
  try {
    const result = await runSettle();
    const output = renderSettleResult(result);
    (result.kind === "verdict" ? process.stdout : process.stderr).write(output);
    process.exit(result.kind === "verdict" ? 0 : 1);
  } catch (error) {
    process.stderr.write(...);
    process.exit(1);
  }
}
```

No budget echo, play lookup, executor selection, or run summary occurs.

## `src/cli.test.ts`

### Imports

Existing fs/temp/path imports already cover most fixture work. Add any required helper import such as
`readFile`; prefer `Bun.file` where already idiomatic. No production test seam is required.

### Parser block

Add a dedicated `parseArgs — settle` describe block proving:

- bare command success;
- positional rejection;
- flag rejection;
- `--budget` rejection;
- usage presence.

### Help inventory adjustment

Add `vend settle` to `freeCommands` and update the total from 17 to 18.

### Fixture subprocess block

Create a temporary repository tree with:

- `docs/active/epic/E-900.md`;
- `docs/active/stories/S-900-01.md`;
- done `T-900-01` and active `T-900-02`;
- `docs/active/work/T-900-01/review-disposition.json` blocked with a named fixture concern;
- a local `package.json` whose check prints `7 pass` and exits 0;
- an executable executor sentinel.

Initialize and commit the fixture with direct Git subprocesses. Git writes are fixture setup, not
ticket source commits. Invoke the absolute CLI source path with sentinel environment variables.

Assertions cover first output, ANSI red, exact action, green gate/presweep, marker bytes, no executor
marker, no run log, second empty delta, and unchanged no-executor/no-run-log facts.

## Commit boundary

The four source/test paths form one meaningful CLI feature unit and are committed together only after
focused and full gates pass:

```text
lisa commit-ticket \
  --ticket-id T-079-01-02 \
  --message "feat(settle): add free one-screen verdict command" \
  --include src/settle/settle.ts \
  --include src/settle/settle.test.ts \
  --include src/cli.ts \
  --include src/cli.test.ts
```

Private attempt artifacts are not included; Lisa owns their admission/publication.

## Unchanged boundaries

- `src/settle/settle-core.ts` remains the sole verdict policy.
- `src/ci/presweep-core.ts` remains the sole presweep classifier.
- `src/graph/load.ts` remains the sole board filesystem loader.
- `.vend/runs.jsonl` remains exclusively owned by run-log/cast paths.
- Executors and budgets are unreachable from settle dispatch.
- Board cards and shared work artifacts remain read-only.
- No loop hook or event-trigger behavior is introduced.
