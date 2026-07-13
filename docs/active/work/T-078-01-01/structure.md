# Structure — T-078-01-01

## File inventory

| File | Action | Responsibility |
|---|---|---|
| `src/cli.ts` | modify | Global help-flag guard at the pure pre-dispatch parse boundary |
| `src/cli.test.ts` | modify | Exhaustive parse sweep and field-reproduction zero-spend e2e |
| attempt `research.md` | create | Existing-system map and constraints |
| attempt `design.md` | create | Options, tradeoffs, and selected approach |
| attempt `structure.md` | create | File and test blueprint |
| attempt `plan.md` | create | Ordered implementation and verification steps |
| attempt `progress.md` | create during implementation | Execution record and deviations |
| attempt `review.md` | create during review | Acceptance assessment and handoff |
| attempt `review-disposition.json` | create during review | Machine-readable pass/block result |

No production files are created or deleted.

## `src/cli.ts` change

### Boundary

Modify only the opening control flow of exported `parseArgs(argv)`.

### New ordering

```text
parseArgs(argv)
  ├─ argv contains --help or -h ──► { cmd: "help" }
  ├─ argv is empty ───────────────► { cmd: "browse", all: false }
  ├─ argv[0] is help ─────────────► { cmd: "help" }
  ├─ argv[0] is --version ────────► { cmd: "version" }
  ├─ canonical/alias verb table ──► per-command pure parser
  └─ otherwise ──────────────────► selection/browse parser
```

### Interface impact

- Function signature remains `parseArgs(argv: readonly string[]): ParsedCommand`.
- `ParsedCommand` remains unchanged.
- `USAGE` remains unchanged.
- No helper is introduced because the expression is one clear membership predicate.
- No export is added.

### Comment contract

Update the local comment to state:

- both flags are global;
- their presence short-circuits before every verb parser;
- this keeps help structurally free; and
- the word `help` remains the command spelling at the head.

## `src/cli.test.ts` pure coverage

### Existing test adjustment

The current basic help test may retain its head-form assertions. Add `-h` to the basic discovery
coverage so the new conventional spelling is visible in the smallest case.

### New parse sweep

Place a focused test near the existing help assertions in `describe("parseArgs")`.

Use a readonly array of representative invocations. Each row should identify the canonical verb
for useful failure messages and carry a valid argv sequence:

```ts
const verbInvocations = [
  ["help"],
  ["run", "decompose-epic", "epic.md", "--budget", "1,2"],
  ["chain", "signal", "--budget", "1,2"],
  ["expand", "fragment", "--budget", "1,2"],
  ["annotate", "T-001", "feedback", "--seat", "dev"],
  ["survey", "--budget", "1,2"],
  ["steer", "--budget", "1,2"],
  ["svg", "--seat", "dev", "--out", "board.svg"],
  ["shelf"],
  ["init", "--template", "kitchen"],
  ["doctor"],
  ["user-guide"],
  ["envelope", "decompose-epic", "--tier", "leaf"],
  ["audit", "decompose-epic", "--tier", "leaf", "--window", "1"],
] as const;
```

For each invocation:

1. iterate `flag` across `--help` and `-h`;
2. iterate insertion index from zero through the invocation length;
3. construct a new argv with the flag inserted;
4. assert `parseArgs(argv)` equals `{ cmd: "help" }`.

Include verb, flag, and index in an assertion message if Bun's matcher supports the chosen form;
otherwise the loop structure and test name remain sufficient.

### Coverage boundary

- Canonical verb rows match `COMMAND_VERBS` exactly.
- Selection/browse is not a literal verb and is outside “every verb” wording.
- The global position-zero cases also cover flags before any verb.
- The field reproduction gets its own process-level test.

## `src/cli.test.ts` e2e coverage

### Imports

Add `chmod` from `node:fs/promises` alongside existing fixture functions.

### Fixture paths

Inside a `mkdtemp` root, define:

- absolute CLI path from repository cwd;
- `executor-sentinel.sh`;
- `executor-invoked` marker;
- `.vend/runs.jsonl` path.

### Sentinel executable

Write a minimal POSIX shell script that writes the marker named by an environment variable and exits
nonzero. Mark it executable with mode `0o755`. It is a safe test double for the only external metered
process boundary.

### Spawn

Spawn `[process.execPath, cliPath, "chain", "--help"]` with:

- `cwd` set to the temp root;
- stdout and stderr piped;
- environment cloned from `process.env`;
- `CLAUDE_CLI` set to the sentinel path; and
- a marker environment variable set to the marker path.

### Assertions

Await stdout, stderr, and exit concurrently. Assert exact help behavior. Then assert both the marker
and run-log paths do not exist. Always remove the temp root in `finally`.

## Commit structure

The story says the guard and regression are one seam and one session. Commit `src/cli.ts` and
`src/cli.test.ts` together as one meaningful ticket-owned source unit using:

```text
lisa commit-ticket \
  --ticket-id T-078-01-01 \
  --message "fix(cli): make help global and free" \
  --include src/cli.ts \
  --include src/cli.test.ts
```

Do not stage files with ordinary Git commands. Attempt artifacts remain in the ignored private
attempt directory for Lisa publication.

## Verification structure

1. Focused parser/CLI suite: `bun test src/cli.test.ts`.
2. Typecheck/build: `bun run build` if useful before the full gate.
3. Required project gate: `bun run check`.
4. Inspect exact ticket-owned diff.
5. Inspect repository status to ensure no ticket-owned files remain modified or untracked.
6. Record command outcomes in `progress.md` and `review.md`.

## Unchanged boundaries

- No per-command parser is modified.
- No dispatch arm is modified.
- No executor module is modified.
- No ledger module is modified.
- No usage text is modified.
- No ticket or story frontmatter is modified by this worker.
