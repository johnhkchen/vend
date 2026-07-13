# Structure — T-072-01-02

## Change set

Only two repository source files change:

- `src/cli.ts` — pure suggestion core, unknown-command parse result, and targeted
  error rendering.
- `src/cli.test.ts` — unit, parser, and direct CLI acceptance coverage.

Private workflow artifacts remain under:

- `.lisa/attempts/T-072-01-02/1/work/research.md`
- `.lisa/attempts/T-072-01-02/1/work/design.md`
- `.lisa/attempts/T-072-01-02/1/work/structure.md`
- `.lisa/attempts/T-072-01-02/1/work/plan.md`
- `.lisa/attempts/T-072-01-02/1/work/progress.md`
- `.lisa/attempts/T-072-01-02/1/work/review.md`

No file is created, modified, or deleted outside those paths by this worker.

## `src/cli.ts` organization

### Canonical verb data

Add a private readonly `COMMAND_VERBS` tuple near the other local routing constants.
It contains canonical literal verbs accepted as argv token zero:

```text
help
run
chain
expand
annotate
survey
steer
svg
shelf
init
doctor
user-guide
envelope
audit
```

It intentionally excludes:

- `--help` and `--version`, because they are flags;
- `browse`, `select`, `version`, and `usage`, because they are result kinds rather
  than literal canonical verb tokens;
- `guide` and `setup-guide`, because they are aliases and the correction surface
  should teach the canonical `user-guide` spelling.

The tuple stays private because callers need suggestion behavior, not ownership of
the CLI routing inventory.

### Pure edit-distance implementation

Add a private `editDistance(left, right): number` helper near the routing constants.
It has no filesystem, clock, environment, process, or module side effects.

Internal organization:

1. convert each string to arrays of code points;
2. initialize the previous row `0..right.length`;
3. iterate left code points;
4. build each current row from deletion, insertion, and substitution costs;
5. replace the previous row;
6. return the last cell.

The distance helper is implementation detail. The exported contract is the suggester.

### Exported suggestion interface

Add:

```ts
export function suggestCommand(
  token: string,
  candidates: readonly string[],
  maxDistance = 2,
): string | undefined
```

Responsibilities:

- rank candidate strings using edit distance;
- retain stable first-candidate behavior for equal distances;
- enforce the inclusive maximum distance;
- return `undefined` when no candidate qualifies.

It accepts plain values and returns a plain optional string, matching the pure-core
house rule and enabling direct unit tests without CLI execution.

### `ParsedCommand` usage member

Extend only the existing usage member:

```ts
| {
    readonly cmd: "usage";
    readonly error?: string;
    readonly showUsage?: boolean;
  };
```

`showUsage` semantics:

- omitted: current default, render the banner;
- `false`: error is self-contained and must render as a targeted line only.

No successful command shape changes.

### Unknown-command construction

Within `parseSelectOrBrowse`, after selection-shape rejection:

1. read the first positional token;
2. call `suggestCommand(token, COMMAND_VERBS)`;
3. construct the base unknown-command message;
4. append the suggestion suffix only when a candidate is returned;
5. return `usage` with `showUsage: false`.

The existing budget/selection parsing remains in its current order. This prevents
behavior drift for malformed selection budgets and missing selections.

### Direct shell rendering

In the first `parsed.cmd === "usage"` branch:

- continue writing a present error to stderr;
- write `USAGE` only when `parsed.showUsage !== false`;
- continue exiting with status 2.

This keeps every existing syntax-error rendering path unchanged by default.

## `src/cli.test.ts` organization

### Imports

Add `suggestCommand` to the existing named import from `./cli.ts`.

### Pure suggester suite

Add a focused `describe("suggestCommand", ...)` block near the other pure helper
tests and before the broad parser suite.

Cases:

- deletion near miss: `steeer -> steer`;
- insertion/substitution or another representative near miss to prove edit types;
- closest candidate wins when more than one lies inside the threshold;
- empty or distant input yields `undefined`;
- an optional explicit threshold test proves the boundary is inclusive.

### Parser assertions

Update the two existing `frobnicate` exact objects to include `showUsage: false`.
Update the retired `work` assertion similarly if its exact object is pinned.

Add a near-miss parser assertion:

```ts
parseArgs(["steeer"])
```

It must carry the exact targeted suggestion message and `showUsage: false`.

### Direct CLI acceptance test

Add a subprocess test near the dependency's help subprocess test. Invoke the source
entry point separately with `frobnicate` and `steeer`.

For both invocations assert:

- exit code is 2;
- stdout is empty;
- stderr equals exactly the expected one-line error plus newline;
- the usage banner is absent by exact equality, not only substring checks.

This is a deterministic local integration seam and does not require fixtures.

## Change ordering

1. Add helper and tuple.
2. Extend usage result shape.
3. change unknown parsing.
4. change shell rendering.
5. add pure tests.
6. update exact parser expectations.
7. add subprocess proof.
8. run focused and full verification.
9. commit both source files atomically with exact includes.

## Boundary preservation

- `USAGE` content remains byte-for-byte unchanged.
- Help behavior remains unchanged.
- Command dispatch remains unchanged.
- Command-specific syntax failures still print usage.
- Selection parsing remains unchanged.
- No executor, playbook, budget, shelf, or state module changes.
- The implementation cannot automatically run a correction.

## Atomic source unit

Production and test changes form one meaningful unit. Splitting them would leave
either an unproven behavior or failing expectations. They will be committed together
through one `lisa commit-ticket` transaction with exactly two source include paths.
