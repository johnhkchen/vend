# Research — T-072-03-02

## Assignment and phase state

- The ticket is `T-072-03-02`, `echo-parsed-budget-humanely`.
- Its current phase is `research`, so all six RDSPI phases remain.
- Phase artifacts belong only under
  `.lisa/attempts/T-072-03-02/1/work/`.
- Lisa owns publication into `docs/active/work/T-072-03-02/` and ticket phase
  or status transitions.
- Ticket source commits must use `lisa commit-ticket` with exact repository
  relative include paths.
- The ordinary Git index and unrelated working-tree changes must remain untouched.

## Parent story contract

- The parent is `S-072-03`, `humane-budget-units`.
- The story joins two operator-facing halves:
  - parsing human budget notation;
  - confirming the parsed envelope before dispatch.
- `T-072-03-01` completed the parser half and is present in Git history.
- This ticket owns the confirmation half.
- The required output shape is `funding ~<time>/<tokens>`.
- The exact acceptance example is `funding ~40m/350k`.
- The line must reuse `formatBudget` from `src/shelf/menu.ts`.
- The line must be emitted before the cast begins.
- Raw and humane spellings of the same budget must produce identical output.
- Budget enforcement, hard walls, detect-after behavior, and live-spend
  formatting are outside this story.

## Ticket acceptance

- A CLI invocation carrying `--budget 40m,350k` must be exercised through a
  CLI test or harness.
- That invocation must print exactly one funding confirmation line.
- The line must be based on the parsed numeric `Budget`, not the original text.
- A raw `--budget 2400000,350000` invocation must print the identical line.
- The confirmation must occur before dispatch reaches the cast.

## Epic intent

- `E-072` addresses the CLI meeting the operator at the counter.
- Its humane-units slice removes millisecond arithmetic from the funding
  gesture while preserving raw compatibility.
- The epic explicitly says an operator should type `--budget 40m,350k` and see
  the parse echoed in the shelf's existing vocabulary.
- This advances P2 by keeping funding transactional rather than conversational.
- It advances P7 by making the funded contract legible before spending begins.
- The epic stays within the existing line-oriented terminal surface.

## Current formatter

- `src/shelf/menu.ts` exports `formatBudget`.
- The formatter is pure and total over a `Budget` value.
- It renders wall time as the largest exact whole unit:
  - whole hours as `h`;
  - whole minutes as `m`;
  - otherwise rounded seconds as `s`.
- It renders token counts at or above one thousand as rounded thousands with
  `k`; smaller counts remain plain integers.
- `formatBudget({ timeMs: 2_400_000, tokens: 350_000 })` therefore yields
  `40m/350k`.
- Existing shelf and menu tests already pin the formatter's core vocabulary.
- The formatter imports only the `Budget` type and has no filesystem, native
  addon, executor, or network dependency.

## Current parser result

- `parseBudgetArg` is exported from `src/cli.ts`.
- The dependency ticket extended it to accept `h`/`m`/`s` time suffixes and
  `k`/`m` token suffixes.
- It returns a numeric `{ timeMs, tokens }` object for both raw and humane input.
- `40m,350k` and `2400000,350000` now deep-equal.
- Because original notation is discarded at parsing, formatting the returned
  `Budget` naturally canonicalizes both inputs to one string.
- The confirmation should therefore consume `parsed.budget`, not the raw argv.

## CLI module boundary

- `src/cli.ts` combines pure argument parsing with an `import.meta.main` impure
  dispatch shell.
- Pure tests import the module without entering the dispatch shell.
- Heavy cast dependencies are lazy-imported inside individual command arms.
- `VERSION` is the only current static value import in the top-level import
  block; other top-level menu and present dependencies are type-only.
- A static `formatBudget` import would remain addon-free because `menu.ts` is a
  pure model module.
- The shell writes terminal messages through `process.stdout.write` and errors
  through `process.stderr.write`.

## Metered dispatch arms

- `run` requires a parsed budget.
- `chain` accepts an optional uniform parsed budget.
- `expand`, `survey`, and `steer` accept optional parsed budget overrides.
- `select` accepts an optional parsed budget override applied to planned shelf
  runs.
- `annotate` is metered but exposes no `--budget`; it always uses the play's
  warranted envelope.
- Optional-budget arms resolve their default budgets in different downstream
  modules, sometimes after ledger or menu reads.
- The ticket specifically names the parsed budget, so `parsed.budget` is the
  common value available in every explicit `--budget` dispatch arm.

## Ordering of current dispatch

- Each arm lazy-imports its effect or cast module immediately before calling it.
- `run` lazy-imports `runPlay`, calls it, handles a registry miss, then prints a
  run summary.
- `chain` lazy-imports and calls the two-step chain, then prints step summaries.
- `expand`, `survey`, and `steer` resolve an effective budget and call their
  respective casts before printing a summary.
- `select` calls `pressShelf`, which performs menu reads, freshness checks,
  selection validation, planning, and one or more casts internally.
- No funding confirmation exists in any arm today.
- Printing immediately before the dispatch call places confirmation before any
  cast work while keeping it in the thin impure shell.

## Existing CLI test harness

- `src/cli.test.ts` holds parser tests and CLI subprocess tests.
- It already uses `Bun.spawn([process.execPath, "src/cli.ts", ...])` with piped
  stdout and stderr for help and unknown-command behavior.
- Those subprocess tests assert exact output and exit status.
- A `run` invocation with an unknown play parses successfully, reaches the
  name-based registry, and returns a typed `no-play` refusal without starting a
  cast.
- That path can observe output immediately before dispatch without paying model
  tokens or materializing artifacts.
- It also lets the harness prove the funding line appears before the dispatcher
  reports the unknown play.

## Test isolation and cost

- The unknown-play subprocess does load the lazy dispatch module and registered
  play, including the installed BAML native addon.
- It does not invoke an executor because the registry miss returns before
  `assembleAndCast`.
- No filesystem write, run log append, transcript, or board mutation occurs.
- Running two subprocess cases is sufficient to compare humane and raw argv.
- Exact stdout equality can prove one line per invocation.
- Exact stderr can continue to pin the typed unknown-play refusal if desired.

## Working-tree state

- `src/cli.ts` and `src/cli.test.ts` are clean at research time.
- The working tree has Lisa-owned changes to `.lisa/provenance.jsonl` and the
  current ticket file.
- Those files are not ticket-owned source paths and must not be included.
- The source dependency commit is `6855e08` and its Lisa completion commit is
  also present at HEAD ancestry.

## Verification surfaces

- Focused behavior: `bun test src/cli.test.ts`.
- Static correctness: `bun run build`.
- Diff hygiene: `git diff --check -- src/cli.ts src/cli.test.ts`.
- Repository gate: `bun run check`.
- Commit mechanism: `lisa commit-ticket --ticket-id T-072-03-02` with exact
  includes for `src/cli.ts` and `src/cli.test.ts`.
- Post-commit status must show both source paths clean.

## Observed constraints and assumptions

- “One line” is naturally interpreted as one confirmation per explicit funding
  gesture, not one per cast in a multi-step chain or multi-selection press.
- “Parsed budget” excludes optional default envelopes that were not entered and
  therefore were not returned by `parseBudgetArg`.
- Echoing only explicit `--budget` values avoids inventing a representation for
  heterogeneous chain defaults before the chain resolves them.
- The required `run` example always has a parsed budget because `run --budget`
  is mandatory.
- The line is informational only; it must not alter the budget object passed to
  downstream code.
- Help text changes are not in this ticket's acceptance.
- No new CLI command or public budget semantics are required.
