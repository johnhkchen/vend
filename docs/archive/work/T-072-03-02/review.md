# Review — T-072-03-02

## Outcome

PASS. The ticket acceptance criterion is fully met.

An explicit `--budget` gesture now prints exactly one canonical
`funding ~<time>/<tokens>` line before its dispatch call. The line is derived
from the parsed numeric `Budget` through the shelf's existing `formatBudget`, so
humane and raw input spellings converge on identical output. The behavior is
covered through the real CLI subprocess surface, all repository gates are green,
and the ticket-owned source unit is committed through Lisa.

## Commit

- Commit: `feb8b3edbd2484bbff51c58da37687008868a1f3`.
- Subject: `feat(cli): echo parsed funding humanely (T-072-03-02)`.
- Commit method: `lisa commit-ticket`.
- Exact includes:
  - `src/cli.ts`;
  - `src/cli.test.ts`.
- No ordinary Git staging or commit workflow was used.
- Both ticket-owned source paths are clean after commit.

## Files changed

### `src/cli.ts`

Added a static value import of `formatBudget` from the pure shelf menu model.

Added private pure composition:

```ts
function formatFundingLine(budget: Budget): string {
  return `funding ~${formatBudget(budget)}`;
}
```

The helper deliberately contains no terminal effect and no duplicated unit
logic. It consumes the same numeric `Budget` object produced by `parseBudgetArg`.

Added one funding write before the dispatch call in every explicit-budget arm:

- shelf selection override;
- chain uniform override;
- expand override;
- survey override;
- steer override;
- required-budget run.

Optional arms write only when `parsed.budget !== undefined`. The required `run`
arm always writes because a successful run parse always contains a budget.

No downstream options object, effective budget, cast, exit code, or summary
format changed.

### `src/cli.test.ts`

Added a real subprocess harness using `Bun.spawn` against `src/cli.ts`.

The harness invokes the generic run path with an intentionally unregistered play
and two budget spellings:

```text
--budget 40m,350k
--budget 2400000,350000
```

The missing play is a deterministic no-token boundary probe: parsing and CLI
dispatch execute, the registry returns its typed refusal, and no cast, executor,
run log, transcript, or board write begins.

The test asserts:

- exact stdout `funding ~40m/350k\n`;
- identical stdout for raw and humane input;
- one newline-terminated line and no extra stdout;
- unchanged registry-refusal stderr;
- unchanged exit code `2`.

## Acceptance assessment

### Funded gesture prints one line

PASS.

The subprocess assertion pins exact stdout rather than a substring. Any missing,
duplicated, reordered-on-stdout, or extra confirmation text fails the test.

### Required copy and units

PASS.

The exact accepted output is:

```text
funding ~40m/350k
```

The tilde, slash, time unit, token unit, and newline are all pinned.

### Derived from `formatBudget(parsed budget)`

PASS.

The private helper calls the existing `formatBudget` directly with the numeric
budget. It does not inspect or preserve original argv text.

### Before the cast begins

PASS.

Each write appears before its command-specific dispatch/cast call. The acceptance
harness reaches the `runPlay` boundary and receives a registry miss, proving the
line is emitted even though assembly and cast never begin.

### Raw and humane input are identical

PASS.

The test compares complete subprocess results from `40m,350k` and
`2400000,350000`; their stdout is byte-identical. This proves canonicalization
through the parsed numeric representation.

## Test-first evidence

Baseline before ticket changes:

- 113 focused tests passed;
- 0 failed;
- 211 expectations passed.

After adding the acceptance test and before implementation:

- 113 focused tests passed;
- 1 failed;
- the sole product failure was empty stdout where
  `funding ~40m/350k\n` was required.

There was one harness-construction correction: the first draft omitted the
literal `run` verb and therefore tested unknown-command parsing. The argv was
fixed to enter the intended generic run dispatcher; no production behavior was
changed to accommodate the test.

## Verification evidence

### Focused gate

Commands:

```bash
bun test src/cli.test.ts
bun run build
git diff --check -- src/cli.ts src/cli.test.ts
```

Results:

- 114 tests passed;
- 0 tests failed;
- 213 expectations passed;
- TypeScript passed;
- diff hygiene passed.

### Repository gate

Command:

```bash
bun run check
```

Results:

- BAML generation passed;
- TypeScript passed;
- 1,665 tests passed;
- 1 expected skip for absent local `dist/` artifacts;
- 0 tests failed;
- 5,101 expectations passed across 111 files.

## Compatibility review

- `ParsedCommand` is unchanged.
- `parseBudgetArg` is unchanged by this ticket.
- `Budget` values passed downstream are unchanged.
- `formatBudget` behavior is unchanged and reused through its existing export.
- Free commands never print funding.
- Malformed budgets fail during parsing and never print funding.
- Optional metered gestures without `--budget` preserve their previous output.
- Registry error, run summary, chain halt, and exit-code contracts are unchanged.
- No persistent format, dependency, generated source, or schema changed.

## Explicit-budget boundary

This ticket echoes parsed input, so optional default-funded gestures do not gain
a line when no `--budget` was entered.

That boundary is important for honesty:

- a chain may resolve two different measurement-funded defaults;
- a shelf selection may resolve multiple warranted envelopes;
- those values live downstream of the CLI parse seam;
- compressing them into one line would require a new presentation contract.

An explicit uniform override has one parsed budget, so one gesture-level line is
truthful across run, chain, and selection paths.

## Scope review

The implementation stays within `T-072-03-02` and `S-072-03`.

Deliberately unchanged:

- humane parser grammar from the dependency ticket;
- budget hard-wall and detect-after semantics;
- live spend/progress formatting;
- ledger-funded or warranted default resolution;
- compound duration support;
- CLI help notation;
- annotate's implicit play budget;
- executor, gate, wallet, and run-log behavior.

## Test coverage assessment

Coverage is proportionate and complete for the acceptance criterion.

- The observable CLI surface is exercised, not only a helper.
- Exact output proves formatting and line count.
- Both required input notations are exercised independently.
- The no-play seam proves pre-cast output without external work.
- The full suite covers parser and formatter regressions transitively and
  directly in their existing suites.

Optional dispatch arms are source-wired through the same private formatter and
write expression. Starting their real casts would require external executor work
or substantial shell extraction; the assigned CLI harness explicitly targets the
required `--budget 40m,350k` run invocation, so additional live integration tests
would add cost without materially increasing confidence.

## Open concerns and limitations

No blocking issue or acceptance gap remains.

Intentional limitations:

- only explicit parsed `--budget` values receive this confirmation;
- a shelf override is printed before `pressShelf` performs menu validation,
  because the CLI's dispatch seam encapsulates validation and casting together;
- cross-stream ordering between stdout funding and stderr refusal is not asserted
  by the harness, but source control flow places the write before `runPlay`;
- formatter rounding behavior remains the existing shelf contract.

These limitations are consistent with the story's parsed-input scope and do not
change the funded envelope.

## Working-tree handoff

The ticket-owned source files are clean. Remaining working-tree entries are
Lisa-owned provenance, ticket phase, and automatically published work artifacts.
They were preserved and excluded from the source commit.

The ticket should remain with Lisa for review/publication; no subsequent ticket
has been started.
