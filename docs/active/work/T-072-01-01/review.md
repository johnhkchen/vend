# Review — T-072-01-01

## Outcome

Acceptance is met. `vend --help` and `vend help` are now successful FREE discovery
queries. Both parse to a typed `help` command, print one complete command catalog to
stdout, and exit 0. The catalog is explicitly grouped into free/no-token and
metered/token-using gestures.

Ticket-owned source and tests are committed as:

```text
f7888717e40c1d3b3f4cec9bb30f3f12aea14411
feat(cli): add grouped help command (T-072-01-01)
```

## Files changed

### `src/cli.ts`

Modified the CLI's existing pure-core/thin-shell seam:

- Regrouped exported `USAGE` into two labeled sections.
- Preserved all existing detailed command syntax and the newcomer hint.
- Added the previously unadvertised selection gesture.
- Added the help spellings to the free catalog.
- Added `{ readonly cmd: "help" }` to `ParsedCommand`.
- Intercepted `--help` and `help` before verb/selection rejection.
- Added a direct dispatch branch that writes the banner to stdout and exits 0.

No command-specific parser, effect, playbook dispatch, budget, or unknown-command
logic changed.

### `src/cli.test.ts`

Added three acceptance proof layers:

- exact pure parse assertions for both spellings;
- a grouped inventory assertion covering every catalog entry and forbidding entries
  from appearing in the opposite group;
- a real subprocess test proving exact stdout, empty stderr, and exit 0 for both
  spellings.

No files were created or deleted in the source tree.

## Rendered command catalog

The free/no-token section contains:

1. `vend help | vend --help`
2. `vend shelf`
3. `vend doctor`
4. `vend user-guide`
5. `vend --version`
6. `vend envelope`
7. `vend audit`
8. `vend svg`
9. `vend init`

The metered/token-using section contains:

1. `vend run`
2. `vend chain`
3. `vend expand`
4. `vend annotate`
5. `vend survey`
6. `vend steer`
7. `vend <selection>`

The last entry represents the existing selection mini-language rather than inventing
a new `select` word users cannot type. `help` is included in the free section because
the ticket makes it a real parsed verb; a “complete” catalog should advertise its own
entry point.

## Acceptance assessment

### `parseArgs(["--help"])` returns help

Met. Exact unit assertion passes with `{ cmd: "help" }`.

### `parseArgs(["help"])` returns help

Met. Exact unit assertion passes with `{ cmd: "help" }`.

### Neither spelling returns a usage error

Met. Both are intercepted before `parseSelectOrBrowse`; the existing unknown-command
path is unchanged.

### Dispatch prints the regrouped banner

Met. The direct shell writes `${USAGE}\n` to stdout. The subprocess test compares
the bytes to the exported banner for both spellings.

### Dispatch exits 0

Met. Both subprocess invocations return code 0. stderr is exactly empty.

### Every real command appears in free or metered group

Met. The inventory test pins sixteen unique public entries: help plus the story's
eight free entries and seven metered gestures. Each is asserted present in its
assigned section and absent from the other section.

### None is missing

Met at this ticket boundary. The test's explicit inventory is the story contract,
and the banner contains every entry. Existing individual `USAGE` assertions for
annotate, init, doctor, user-guide, and run/chain flags also remain green.

## Verification

Focused baseline before edits:

```text
bun test src/cli.test.ts
104 pass, 0 fail, 145 expectations
```

Focused result after edits:

```text
bun test src/cli.test.ts
107 pass, 0 fail, 190 expectations
```

Full repository gate:

```text
bun run check
BAML codegen: pass
tsc --noEmit: pass
bun test: 1654 pass, 1 skip, 0 fail
5063 expectations across 111 files
```

The skip is the existing release acceptance test that requires real `dist/`
artifacts. It is unrelated to this ticket and is explicitly reported by the suite.

Additional checks:

- `git diff --check -- src/cli.ts src/cli.test.ts`: clean.
- Manual `bun src/cli.ts --help`: status 0, banner on stdout, empty stderr.
- Manual unknown command: status 2, diagnostic/banner on stderr, preserving the
  dependent ticket's baseline.
- `git show` confirms the commit contains exactly the two ticket-owned files.
- Post-commit ticket-owned source diff: empty.
- Ordinary Git index after commit: empty.

## Test coverage evaluation

Coverage is proportionate and closes each failure mode introduced by this change:

- A parser regression is caught by exact discriminated-object checks.
- Alias drift is caught because both spellings are separately asserted.
- A group heading removal/reordering is caught by section-boundary checks.
- A missing command is caught by positive membership assertions.
- A wrongly classified command is caught by positive and negative membership checks.
- Accidental duplicate inventory entries are caught by the uniqueness assertion.
- A dispatch fallthrough is caught by the subprocess exit check.
- Writing successful help to stderr is caught by exact stream checks.
- Banner divergence between pure export and shell output is caught by byte equality.
- Existing CLI behavior is covered by the other 104 focused tests and full suite.

No live model/executor test is warranted: the help route returns before all lazy
imports and is intentionally deterministic, local, and FREE.

## Architecture assessment

The change preserves the house boundary:

- `parseArgs` remains pure and accepts plain argv values.
- `USAGE` remains plain immutable string data.
- Process stream writes and exits remain confined to the direct-execution shell.
- No filesystem, clock, network, registry, or executor dependency enters parsing.
- The static help path avoids the BAML addon and all application effects.

The implementation is deliberately local rather than introducing a command registry
refactor. `src/cli.ts` already owns routing and detailed syntax; a metadata-driven
registry would be a much larger architectural change with no ticket acceptance gain.

## Compatibility review

- Bare `vend` still opens browse.
- `vend --all` still browses hidden rows.
- Selection-shaped input still routes to `select`.
- `--version` keeps its early informational behavior.
- All named command parsers retain their prior behavior.
- Usage errors still print a banner to stderr and exit 2.
- `frobnicate` still reports `unknown command: frobnicate`.
- The existing user-guide discovery footer remains.
- Existing detailed flag advertisements remain, including `--agent`, `--template`,
  tiers, windows, estimates, seats, and output paths.

## Deviations and judgment calls

The implementation clarified one detail from the initial design: help itself is
listed in the free group. The first design draft counted only the story's eight
named free work/query commands. Once `{ cmd: "help" }` became a real verb, excluding
it would make the advertised “complete command list” incomplete. The private design,
structure, and plan were updated before final verification. This is additive and
does not change the story's required eight free classifications.

Both help spellings short-circuit on the first token and ignore trailing tokens,
matching the existing `--version` convention. The acceptance only requires the
single-token forms; this behavior avoids an unnecessary new argument parser and is
documented beside the route.

## Open concerns and limitations

- The command inventory is explicit test data rather than mechanically derived from
  parser control flow. That is intentional for this small ticket, but future real
  commands must update both routing/banner and the inventory assertion. The failing
  test is the prompt to do so.
- Bare browse (`vend`) is not a verb and is not listed as a group entry because the
  story's catalog contract enumerates commands/selection rather than the no-argument
  home surface. Its behavior remains tested separately.
- `guide` and `setup-guide` remain accepted aliases but are not counted as distinct
  real verbs; the canonical catalog continues to advertise `user-guide`.
- The help banner remains the banner printed after parse errors. Regrouping therefore
  changes error presentation, as the story intends, while preserving error text and
  exit semantics.
- Unknown-command nearest suggestions are deliberately absent. T-072-01-02 depends
  on this ticket and owns edit-distance/suggestion behavior.

No critical issue, TODO, unverified acceptance clause, or human intervention is
required for this ticket.

## Workflow and ownership review

- All six RDSPI artifacts were written to the private attempt directory requested by
  the assignment.
- This worker did not write phase/status fields in ticket frontmatter.
- This worker did not write phase artifacts directly to `docs/active/work`.
- Lisa materialized shared work directories during the attempt; they were not added
  to the ticket source commit.
- The commit used `lisa commit-ticket` with exact `--include` paths.
- No `git add`, ordinary `git commit`, hook bypass, or broad include was used.
- The ticket-owned source files are clean after commit.

## Final verdict

Green. The ticket is implemented, fully tested, committed, and honest on scope.
T-072-01-02 can now build its targeted unknown-command suggestion on the preserved
unknown-command path and regrouped banner.
