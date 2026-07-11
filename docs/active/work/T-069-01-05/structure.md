# Structure — T-069-01-05

## Change map

This ticket modifies two source-controlled implementation files and creates six work artifacts.

Production and test changes:

```text
src/
├── cli.ts       modified — parsed types, usage, two parsers, two dispatch calls
└── cli.test.ts  modified — agent parse/error/help coverage
```

Work artifacts:

```text
docs/active/work/T-069-01-05/
├── research.md   created
├── design.md     created
├── structure.md  created
├── plan.md       created
├── progress.md   created during implementation
└── review.md     created after verification
```

No file is deleted.

## `src/cli.ts` public surface

The module's existing exports remain:

- `USAGE`;
- `ParsedCommand`;
- `parseBudgetArg`;
- `parseArgs`;
- `splitAfter`.

No new function is exported.

The externally observable changes are:

- `USAGE` advertises the optional agent flag on run and chain;
- `ParsedCommand` can carry `agent` on its run and chain variants;
- `parseArgs` recognizes and carries that flag on those two commands;
- executable CLI dispatch forwards the field.

All other command variants and parser exports keep their existing interfaces.

## Parsed-command union changes

### Run variant

Add one optional property after the existing `after` field:

```ts
readonly agent?: string;
```

Its comment defines:

- this is a Lisa executor-routing seat;
- it is raw CLI input;
- validation occurs at the materialization boundary;
- it is unrelated to present-layer `Seat`.

### Chain variant

Expand the current compact one-line variant into a multi-line object for readable field comments,
or retain the compact form with the added field if formatting remains clear:

```ts
{
  readonly cmd: "chain";
  readonly signal: string;
  readonly budget?: Budget;
  readonly after?: readonly string[];
  readonly agent?: string;
}
```

The field type deliberately matches `ChainProposeDecomposeOptions.agent` and `RunOptions.agent`.

## Usage constant changes

Modify only the first two string fragments.

Run line shape:

```text
vend run <play> <epic.md> --budget <ms>,<tokens> ... [--after <ticket>] [--agent <seat>]
```

Chain line shape:

```text
vend chain <signal> [--budget <ms>,<tokens>] [--after <ticket>] [--agent <seat>]
```

The ordering places the new value flag next to the existing allocation/materialization option. No
other help line changes.

## `parseChainArgs` internal structure

Existing state:

```ts
const positional: string[] = [];
let budgetVal: string | undefined;
let sawBudgetFlag = false;
const after: string[] = [];
```

New state:

```ts
let agent: string | undefined;
```

Existing loop branch order becomes:

1. `--budget`;
2. `--after`;
3. `--agent`;
4. positional fallback.

The new branch consumes the next token. It returns the ticket-specified usage result if the token
is absent or starts with `--`; otherwise it assigns the raw string.

The final object retains:

1. required command and signal;
2. optional parsed budget;
3. optional de-duplicated after list;
4. optional agent string.

No changes occur in budget parsing, signal joining, or `splitAfter`.

## `parseRunArgs` internal structure

The fixed positional prelude remains unchanged:

- resolve play;
- resolve epic path;
- locate and require budget;
- parse budget;
- derive boolean flags.

The optional value scan gains:

```ts
let agent: string | undefined;
```

Loop control becomes an explicit two-branch recognizer for `--after` and `--agent`. Each branch
consumes its own value. Tokens unrelated to these value flags remain ignored by this loop, retaining
the parser's existing behavior.

The final command object adds a conditional `agent` spread after the conditional `after` spread.

No changes occur to `skipGates`, `intervened`, budget semantics, play registry semantics, or after
de-duplication.

## Dispatch shell structure

### Chain arm

The call remains direct and lazy-imported:

```ts
castProposeDecomposeChain({
  signal: parsed.signal,
  budget: parsed.budget,
  after: parsed.after,
  agent: parsed.agent,
});
```

No output, exit-code, halt, or import behavior changes.

### Run arm

The generic registry dispatch retains all current fields and adds:

```ts
agent: parsed.agent,
```

No play-specific conditional is introduced. An arbitrary play name still parses generically; the
current `RunOptions` assembly behavior remains the existing boundary.

No output, exit-code, no-play error, or summary behavior changes.

## Downstream boundaries unchanged

`src/play/chain-propose-decompose.ts` remains unchanged. It already owns:

- `ChainProposeDecomposeOptions.agent?: string`;
- passing that value only to the decompose step;
- keeping the propose step free of ticket-routing metadata.

`src/play/decompose-epic.ts` remains unchanged. It already owns:

- `RunOptions.agent?: string`;
- translating run-shaped options into context sources;
- keeping validation downstream.

`src/play/project-context.ts`, `src/play/decompose-effect.ts`, `src/play/materialize.ts`, and
`src/agent-seat.ts` remain unchanged. Their transport and validation responsibilities were settled
and tested by dependency tickets.

## `src/cli.test.ts` organization

Tests stay in the existing `describe("parseArgs")` suite because they exercise the same pure public
entry point.

Place chain agent coverage beside existing chain and chain `--after` tests.

Place run agent coverage beside the existing run `--after` test so coexistence with the required
budget is visible.

Add a focused usage assertion near the agent tests. It can derive the exact run and chain lines via:

```ts
const lines = USAGE.split("\n");
const runLine = lines.find(...);
const chainLine = lines.find(...);
```

Then assert both contain `[--agent <seat>]`. Matching per line is stronger than counting two
occurrences anywhere because the ticket requires the flag on both gestures specifically.

Suggested test names:

- `chain --agent carries the Lisa routing seat`;
- `run decompose-epic --agent carries the Lisa routing seat alongside --budget`;
- `dangling --agent is a usage error on both board-writing gestures`;
- `usage advertises --agent on run and chain`.

Existing exact-equality tests continue serving as omission regression coverage.

## Dependency direction

The CLI continues to depend on play shells only through lazy imports inside `import.meta.main`.

Pure parser code imports no agent-seat value module and no BAML-bearing play module. This preserves
the addon-free test boundary:

```text
cli.test.ts
    ↓
pure exports in cli.ts
    X no runtime play import
```

The executable-only transport remains:

```text
parsed chain.agent ──► ChainProposeDecomposeOptions.agent
                         └──► decompose inputs

parsed run.agent   ──► RunOptions.agent
                         └──► decompose inputs
```

Both converge at the dependency-provided materializer path; this ticket adds no new convergence
module.

## Compatibility boundaries

- Commands without `--agent` retain exact parsed shapes.
- `--seat` remains typed as `Seat` and validated against `designer | dev`.
- `--agent` remains a raw string.
- Existing chain multi-word signal behavior remains intact.
- Existing required run budget remains required.
- Existing repeatable/comma-separated after behavior remains intact.
- Existing lazy-loading behavior remains intact.
- Existing process exit behavior remains intact.

## Verification boundaries

Focused parser tests prove grammar, error text, omission, coexistence, and help text.

Typechecking proves both dispatch calls accept the new fields and that discriminated-union narrowing
exposes them only in the appropriate arms.

The full suite proves no regression to other commands and composes this ticket with dependency
tests for downstream transport, materialization, and unknown-seat refusal.

## Commit boundary

One implementation commit is sufficient because parser, usage, dispatch, and their tests form one
atomic user-visible capability. The Review artifact can be committed as a final documentation
handoff after the full gate, following the repository's established ticket history pattern.

Only this ticket's paths should be staged. Lisa-managed frontmatter and provenance changes remain
unstaged.
