# Research — T-069-01-05

## Ticket position

T-069-01-05 is the final ticket in story S-069-01.

Its dependencies are complete in the repository history:

- T-069-01-03 added `agent?: string` to the chain gesture option shape and carries it into the
  decompose step's inputs.
- T-069-01-04 added `agent?: string` to the direct-run option shape and carries it through input
  assembly into the materialization effect.
- Earlier story tickets own the seat vocabulary, write-side validation, ticket stamp, and named
  `unknown-seat` outcome.

The ticket starts in `phase: research`. No work artifact directory exists for this ticket yet.

## Story contract

The story covers one optional CLI field on the two board-writing gestures:

- `vend chain <signal>`;
- `vend run decompose-epic <epic.md> --budget <ms>,<tokens>`.

The value is Lisa allocation metadata. It is not Vend's `VEND_EXECUTOR` selector and it is not the
existing present-layer `--seat designer|dev` option used by `vend svg` and `vend annotate`.

Known seats are `claude | codex`, but the CLI layer is not the validation authority. The raw string
must reach the materializer so an unknown value is refused by the canonical write-side guard and
logged as `unknown-seat` before output is written.

Omission is compatibility-sensitive: a gesture without `--agent` must keep the previous parsed and
dispatched object shape, with no own `agent` property.

The story explicitly excludes:

- Lisa dispatch behavior;
- seats beyond `claude | codex`;
- retroactive ticket changes;
- per-ticket overrides;
- changes to the present-layer `--seat` flag;
- a live metered cast.

## Charter and vision constraints

The CLI is the counter surface for P2, the two-gesture transaction. `--agent` is an optional
allocation choice made on the same command, not a new conversational step.

P4 requires the selected seat to be carried into autonomous work allocation without a later human
handoff.

P6 and N4 distinguish routing metadata from model execution: Vend writes the Lisa seat onto minted
work but does not become the executor.

P3 makes the ticket's parser tests and full repository check part of the delivery contract.

## CLI module boundary

`src/cli.ts` contains both layers of the command surface:

1. pure argument parsing and the exported `ParsedCommand` union;
2. an `import.meta.main` impure dispatch shell using lazy imports.

`src/cli.test.ts` imports only the pure exports. The dispatch shell does not execute during tests,
so parser coverage remains addon-free and does not load the BAML graph.

The file-local `USAGE` string lists the `run` and `chain` forms on its first two lines. Both already
include `[--after <ticket>]`; neither currently mentions `--agent`.

## Parsed command shapes

The `run` variant currently carries:

- `play`;
- `epicPath`;
- required `budget`;
- optional `skipGates`;
- optional `intervened`;
- optional `after`.

The `chain` variant currently carries:

- `signal`;
- optional `budget`;
- optional `after`.

Neither variant currently declares `agent`, so adding it to parser return objects without updating
the union would fail strict typechecking.

Existing optional fields are generally conditionally spread into returned objects. This preserves
the old object shape when a flag is omitted and is directly asserted in several tests.

## Chain parser

`parseChainArgs` scans tokens after the command once.

Recognized value flags are `--budget` and `--after`. Other tokens are accumulated as signal words
and joined with spaces. Budget parsing occurs after the scan. `--after` rejects a missing or
flag-shaped value immediately, then supports repetition, comma splitting, and stable de-duplication.

An unrecognized `--agent` is currently treated as part of the positional signal, as is its following
value. For example, the requested chain command would currently produce signal text containing
`--agent codex` rather than an `agent` field.

The parser's existing missing-value idiom is:

```ts
const val = argv[++i];
if (val === undefined || val.startsWith("--")) return { cmd: "usage", error: "missing ..." };
```

This distinguishes a real value from a following flag and provides the exact behavior requested for
a dangling `--agent`.

## Run parser

`parseRunArgs` fixes the first three positions as command, play, and epic path. It locates the
required `--budget` with `indexOf`, parses it, and uses presence checks for boolean flags.

It then performs a scan specifically for repeatable `--after` values. The same scan boundary can
observe `--agent` without altering positional parsing or budget handling.

The parser currently does not generally reject unknown run flags. That behavior predates this
ticket and is outside its acceptance criteria.

The run result conditionally spreads optional fields. The requested `agent` field fits this
existing omission-preserving pattern.

## Dispatch seams

The chain dispatch arm lazily imports `castProposeDecomposeChain` and currently calls it with:

```ts
{ signal: parsed.signal, budget: parsed.budget, after: parsed.after }
```

`ChainProposeDecomposeOptions` already declares `readonly agent?: string`. Its decompose adapter
passes `agent: opts.agent` into `assembleInputs`; story dependency T-069-01-03 owns that transport.

The generic run dispatch arm lazily imports `runPlay` and currently supplies:

```ts
{
  epicPath,
  budget,
  skipGates,
  intervened,
  after,
}
```

`runPlay` accepts `RunOptions`, which already declares `readonly agent?: string`. T-069-01-04 owns
the downstream mapping into `contextSourcesForRun`, `assembleInputs`, and the effect.

Therefore both dispatch boundaries have settled receiving fields and require only one additional
property each.

## Test landscape

`src/cli.test.ts` already covers:

- base run parsing;
- generic play names;
- required and malformed budgets;
- optional run boolean flags;
- chain signals and budgets;
- `--after` for both gestures;
- dangling `--after` behavior;
- the exported usage string elsewhere in the suite.

The ticket explicitly requires new assertions for:

- chain parsing with `--agent codex`;
- run parsing with budget and `--agent codex`;
- dangling `--agent` returning exactly `missing --agent <seat>`;
- `[--agent <seat>]` appearing on both gesture lines in `USAGE`.

The parser test cannot directly observe the `import.meta.main` dispatch arms. Strict TypeScript
assignability verifies that the parsed field is accepted by both downstream option shapes only at
the call sites; the dependency tickets separately test the downstream transport.

## Repository state

The worktree contains Lisa-managed changes to provenance and ticket frontmatter plus untracked epic
and story files. These are shared project state and are unrelated to this implementation.

The dependency implementations and their work artifacts are committed. `src/cli.ts` and
`src/cli.test.ts` have no pre-existing local diff at the start of this ticket.

Edits for this ticket can therefore remain isolated to:

- `src/cli.ts`;
- `src/cli.test.ts`;
- `docs/active/work/T-069-01-05/`.

No package, generated-code, schema, materialization, executor, or Lisa files are implicated.

## Constraints surfaced by the map

- Preserve raw strings; do not import or duplicate the known-seat vocabulary in the CLI.
- Reject an absent or flag-shaped `--agent` value with the exact ticket message.
- Preserve absence by conditionally spreading `agent`.
- Keep chain signal collection from swallowing the new flag and value.
- Keep run budget, `--after`, gate, and intervention behavior unchanged.
- Thread the parsed value into both dispatch calls.
- Do not change the unrelated `--seat` parser or terminology.
- Keep pure parser tests addon-free.
- Run `bun run check` before committing.
- Do not modify the ticket's phase or status fields; Lisa owns those transitions.
