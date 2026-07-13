# Structure — T-072-03-02

## Change inventory

| Path | Action | Ownership |
|---|---|---|
| `src/cli.ts` | modify | funding-line composition and dispatch-shell writes |
| `src/cli.test.ts` | modify | subprocess acceptance harness |
| `.lisa/attempts/T-072-03-02/1/work/progress.md` | create | implementation ledger |
| `.lisa/attempts/T-072-03-02/1/work/review.md` | create | final handoff |

No production file is created or deleted.

## `src/cli.ts` import boundary

Add one static value import:

```ts
import { formatBudget } from "./shelf/menu.ts";
```

Keep the existing `ValueTier` import type-only. The two imports may share a
module path but should remain separate so TypeScript and readers can distinguish
runtime from type dependencies.

The runtime import is permitted because `menu.ts` is the addon-free pure shelf
model and already owns the required format contract.

## Pure funding-line composition

Add a small private function near `parseBudgetArg`, where budget presentation and
parsing concepts are easy to discover:

```ts
function formatFundingLine(budget: Budget): string {
  return `funding ~${formatBudget(budget)}`;
}
```

Properties:

- input is the numeric `Budget`;
- return value has no trailing newline;
- copy is exactly `funding ~` plus the shelf formatter;
- function has no output side effect;
- function is not exported;
- no raw argv text reaches it.

The newline belongs to the shell write, consistent with other CLI output.

## Dispatch-shell integration

Every explicit-budget arm uses the same local expression:

```ts
process.stdout.write(`${formatFundingLine(parsed.budget)}\n`);
```

Optional budget arms guard the expression:

```ts
if (parsed.budget !== undefined) {
  process.stdout.write(`${formatFundingLine(parsed.budget)}\n`);
}
```

No generic global write should be placed before command branching because:

- not every `ParsedCommand` carries `budget`;
- some commands are free;
- command-specific placement makes the “before dispatch” boundary explicit;
- parse errors and read-only commands must never print funding.

## `select` arm

Placement:

1. lazy-import `pressShelf`;
2. if an override exists, print the funding line;
3. call `pressShelf`;
4. preserve the existing result switch unchanged.

The single line represents the one uniform explicit override supplied for the
gesture, not individual planned action defaults.

No `press.ts` or `press-core.ts` changes are needed.

## `chain` arm

Placement:

1. lazy-import `castProposeDecomposeChain`;
2. if a uniform override exists, print the funding line;
3. call the chain with existing options;
4. preserve summaries, halt message, and exit code.

The line is one per gesture even though the chain may cast two steps. It confirms
the one parsed override applied to both.

No chain budget resolution code changes.

## `expand` arm

Placement:

1. lazy-import cast and play default;
2. resolve `budget = parsed.budget ?? expandFragmentPlay.budget` as today;
3. print only if `parsed.budget` exists;
4. call `castExpandFragment` with the unchanged effective budget.

The write must use `parsed.budget`, not the defaulted `budget`, to preserve the
ticket's parsed-input boundary.

## `survey` arm

Mirror the `expand` structure:

1. lazy import;
2. existing effective-budget resolution;
3. guarded explicit-budget echo;
4. unchanged cast and result handling.

## `steer` arm

Mirror the `survey` structure exactly. The repository already uses deliberate
small duplication across these command arms to keep their behavior locally
readable.

## `run` fallback arm

Placement:

1. lazy-import `runPlay`;
2. unconditionally print the funding line from required `parsed.budget`;
3. call `runPlay` with the unchanged options object;
4. preserve `no-play` handling;
5. preserve summary and exit behavior.

This is the acceptance path exercised through the subprocess harness.

## `annotate` exclusion

Do not modify the `annotate` arm.

- Its parser exposes no `--budget`.
- Its budget comes from `expandFragmentPlay.budget`.
- There is no parsed budget to echo.
- Adding a default echo would expand this ticket into default-funding display.

## Browse and free-command exclusion

Do not modify help, version, browse, shelf, guide, init, doctor, envelope, audit,
or SVG arms. They do not begin a cast funded by a parsed budget.

## `src/cli.test.ts` test placement

Add a new `describe` block near the existing CLI subprocess suites at the bottom
of the file. This keeps integration-shell tests together and leaves the pure
parser suite focused.

Suggested title:

```ts
describe("funding echo (T-072-03-02)", () => { ... });
```

## Harness helper shape

The test can define a local async helper:

```ts
async function invokeWithBudget(budget: string) {
  const proc = Bun.spawn(
    [process.execPath, "src/cli.ts", "missing-play", "ignored.md", "--budget", budget],
    { cwd: process.cwd(), stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, exitCode] = await Promise.all([...]);
  return { stdout, stderr, exitCode };
}
```

The play name should be obviously absent from the registry and stable.

## Harness assertions

For humane input:

- exit code is `2`;
- stdout is exactly `funding ~40m/350k\n`;
- stderr contains only the existing unknown-play refusal.

For raw input:

- exit code is `2`;
- stdout equals humane stdout exactly;
- stderr equals humane stderr exactly.

Exact stdout equality simultaneously proves:

- one line;
- canonical time unit;
- canonical token unit;
- tilde and separator copy;
- newline count;
- raw/humane convergence.

## Public interfaces

No public type or exported function changes.

- `ParsedCommand` is unchanged.
- `parseBudgetArg` is unchanged.
- `formatBudget` is consumed through its existing export.
- dispatch function signatures are unchanged.
- exit-code contracts are unchanged.

## Dependency direction

```text
cli parser -> Budget values
cli funding helper -> shelf/menu formatBudget
cli shell -> command-specific lazy dispatch modules
```

The engine and play layers do not import back from the CLI. No cycle is created.

## Commit units

The source and acceptance test form one meaningful ticket-owned unit because the
output behavior is not useful without its CLI proof and the assignment requires
all ticket-owned files to be committed.

Commit exact paths together:

- `src/cli.ts`;
- `src/cli.test.ts`.

Phase artifacts remain private attempt files and are not passed to
`lisa commit-ticket`; Lisa publishes admitted artifacts separately.

## Expected final diff

- one value import;
- one private pure helper;
- six dispatch-arm writes: five guarded optional overrides and one required run
  budget;
- one subprocess test block with two invocations;
- no unrelated formatting or refactoring.

## Structural non-goals

- no new module for a one-line formatter;
- no shared dispatch runner extraction;
- no changes below the CLI shell;
- no formatter algorithm changes;
- no parser changes;
- no default-budget resolution changes;
- no new dependency package;
- no documentation or usage-banner change.
