# Review — T-069-01-05

## Outcome

T-069-01-05 is complete against its ticket acceptance criteria.

Both board-writing CLI gestures now accept `--agent <seat>`, retain the supplied raw string in their
parsed command, and forward it into the cast-path option shape established by the dependency
tickets. A dangling flag returns the required usage error, and both gestures advertise the option
in the usage banner.

The full repository gate is green. The implementation and the first five work artifacts are
committed in `967602d`.

## Acceptance assessment

### Chain parse carries the agent seat

Met.

The focused assertion drives:

```ts
parseArgs(["chain", "sig", "--agent", "codex"])
```

and receives:

```ts
{
  cmd: "chain",
  signal: "sig",
  agent: "codex",
}
```

The `--agent` token and its value are consumed by the chain parser rather than leaking into the
multi-word signal. The ticket's abbreviated expected object necessarily also retains the command's
required `signal` field.

### Run parse carries the agent seat with budget

Met.

The focused assertion drives:

```ts
parseArgs([
  "run",
  "decompose-epic",
  "e.md",
  "--budget",
  "1,2",
  "--agent",
  "codex",
])
```

and receives the existing run fields plus:

```ts
agent: "codex"
```

The required budget continues to parse as `{ timeMs: 1, tokens: 2 }`. No gate, intervention, after,
play-name, or epic-path behavior changed.

### Dangling agent flag is a usage error

Met.

Both parsers return exactly:

```ts
{ cmd: "usage", error: "missing --agent <seat>" }
```

The tests cover:

- chain with `--agent` at end of argv;
- run with `--agent` at end of argv;
- chain with `--agent` immediately followed by `--budget`.

The flag-shaped case proves another option is not silently consumed as the seat value.

### Usage lists the flag on both gestures

Met.

The run and chain lines each contain the exact placeholder:

```text
[--agent <seat>]
```

The test finds each gesture line independently before asserting the placeholder. This prevents one
line with duplicate text from satisfying a global occurrence count.

### Dispatch reaches both cast-path option shapes

Met.

The executable chain arm passes:

```ts
agent: parsed.agent
```

to `castProposeDecomposeChain`, whose `ChainProposeDecomposeOptions` dependency already declares the
field and carries it into the decompose step.

The generic executable run arm passes the same property to `runPlay`, whose `RunOptions` dependency
already declares it and carries it through decompose input assembly.

Strict typechecking passed, confirming both dispatch calls agree with the settled interfaces.

## Changes by file

### Modified: `src/cli.ts`

- Added `[--agent <seat>]` to the run usage line.
- Added `[--agent <seat>]` to the chain usage line.
- Added optional raw `agent` fields to the run and chain `ParsedCommand` variants.
- Added chain parsing for the value flag.
- Added run parsing for the value flag.
- Added the exact missing-value refusal to both parsers.
- Conditionally spread parsed agent values so omission preserves the previous command shape.
- Forwarded the parsed field to chain dispatch.
- Forwarded the parsed field to generic run dispatch.

The existing present-layer `--seat designer|dev` paths were not changed.

### Modified: `src/cli.test.ts`

Added four ticket-focused tests covering:

1. chain parsed transport;
2. run parsed transport alongside budget;
3. dangling/flag-shaped missing values;
4. line-specific usage advertising.

### Created work artifacts

- `research.md`;
- `design.md`;
- `structure.md`;
- `plan.md`;
- `progress.md`;
- this `review.md`.

No production module, test module, or artifact was deleted.

## Architecture review

### Pure core, impure shell

The change preserves the existing CLI boundary.

- Parsing remains pure in `parseArgs` and its local helpers.
- Parser tests import no BAML-bearing play module.
- Runtime play imports remain lazy and inside `import.meta.main`.
- Dispatch remains a thin option-mapping shell.
- Downstream filesystem and cast effects remain outside the parser.

No shared abstraction was introduced for two small command-local branches.

### Validation authority

The CLI deliberately does not import `KNOWN_SEATS` or call the seat guard.

The parsed value remains `string`, matching both downstream option shapes. This allows an unknown
seat to reach materialize's canonical first-operation guard, where dependency T-069-01-04 proves it
becomes a countable `unknown-seat` outcome with zero output.

This ticket therefore does not create a second seat vocabulary or a competing validation boundary.

### Executor terminology

The new field is documented as a Lisa executor-routing seat. It does not select Vend's cast
executor, touch `VEND_EXECUTOR`, or change the executor registry.

The existing `--seat designer|dev` remains a separate present-layer concept and retains its narrow
`Seat` type.

### Compatibility

Existing exact-equality parser tests stayed green. Because `agent` is conditionally spread, commands
without the flag retain their previous parsed shapes.

Dispatch objects may carry `agent: undefined`, consistent with their existing optional-field style.
The dependency-provided context adapters conditionally preserve absence, so no `agent` field is
introduced into assembled inputs or materialized tickets when the CLI flag is omitted.

The usage change is additive. Existing command syntax remains valid.

## Test coverage

### Focused verification

Command:

```bash
bun test src/cli.test.ts
```

Result:

```text
104 pass
0 fail
145 expect() calls
Ran 104 tests across 1 file.
```

This directly covers every ticket acceptance clause at the pure parser/help boundary.

### Full repository gate

Command:

```bash
bun run check
```

Result:

```text
BAML generation: passed
TypeScript typecheck: passed
1615 pass
1 skip
0 fail
4863 expect() calls
Ran 1616 tests across 110 files.
```

The single skip is the repository's documented real-`dist/` integration test, skipped because no
distribution artifacts are present. It is unrelated to this ticket.

The full suite also exercises dependency-provided coverage for:

- chain agent transport into decompose inputs;
- direct-run option transport into decompose inputs;
- known-seat ticket stamping;
- omitted-seat byte compatibility;
- unknown-seat refusal before output;
- named run-log outcome support.

## Coverage gaps and honest boundary

No subprocess test executes `src/cli.ts` with a real cast for `--agent`. The parser is directly
tested, dispatch property names are strict-typechecked, and each downstream half is separately
fixture-proven by the dependency tickets. A live cast would be metered and is explicitly outside the
story's honest boundary.

The impure `import.meta.main` arms are not isolated behind injectable functions, so tests do not spy
on the exact runtime call objects. This is an existing CLI architecture boundary rather than a new
gap. Typechecking plus downstream tests provide proportionate coverage for the two one-property
mappings.

Repeated `--agent` values use last-value-wins behavior. The ticket does not specify repetition, and
this matches the parser's existing single-value budget accumulation style. If future UX requires a
duplicate-flag refusal, that should be a separate grammar decision across commands.

The run parser continues its pre-existing behavior of not generally rejecting unknown flags. This
ticket adds only the requested recognized value flag and does not broaden parser cleanup scope.

## Open concerns

No critical issue or acceptance blocker remains.

One product-level concern remains intentionally deferred: the story proves writing the Lisa routing
seat onto work, not a live Lisa worker selecting and executing that seat. The story states Lisa
already reads the field, and the live metered routing drive requires separate human authorization.

## Repository hygiene

Only ticket-owned source, tests, and work artifacts were staged for the implementation commit.

Lisa-managed provenance/frontmatter changes and the untracked E-069/S-069 board files remain outside
this ticket's commits. The ticket's `phase` and `status` fields were not manually updated.

## Final assessment

The ticket is green and review-ready:

- scope stayed within the CLI join;
- every acceptance clause has direct focused coverage;
- both settled dispatch interfaces receive the raw optional field;
- omission and unrelated seat behavior are preserved;
- the mandatory repository gate passes;
- known limitations are explicit and match the story's honest boundary.
