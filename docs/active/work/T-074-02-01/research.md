# Research — T-074-02-01 underfunding decision core

## Ticket contract

- The ticket asks for one pure function: `underfundingWarning(funded, floor)`.
- Inputs are funded and measured-floor budgets.
- The decision is token-only; the acceptance criterion explicitly says funded tokens.
- The output is either a warning naming funded versus floor, or no warning.
- The field-report fixture is 12,500 funded against an approximately 400,000-token floor.
- An adequately funded and a near-floor allocation must remain silent.
- The core must perform no I/O and must not load the BAML native addon.
- This ticket settles the decision, threshold, and message shape only.
- Counter-time ledger reads, measured/prior discrimination, printing, and dispatch belong to
  dependent ticket T-074-02-02.

## Story boundary

- S-074-02 covers the funding counter shared by shelf press and named play dispatch.
- The later shell will derive the floor through existing shelf/recalibration machinery.
- Only `recalibrate(...).source === "measured"` is eligible for a warning at story level.
- Cold-start priors deliberately do not warn.
- Warning is advisory: it must not block a deliberate thin probe.
- No tier denomination may change.
- No automatic budget escalation or funding is in scope.
- Executor reachability and cast-time andons belong to sibling story S-074-01.
- Live proof against the real steer history is deferred; this ticket is fixture proof.

## Existing budget model

- `src/budget/budget.ts` owns `Budget`.
- `Budget` has independent positive-integer `timeMs` and `tokens` dimensions.
- P7 and IA-8 require those dimensions not be conflated.
- This decision intentionally observes only `tokens`; time underfunding is not in the AC.
- Budget is a structural plain value, suitable for a type-only import into a pure core.
- Type-only imports are erased by TypeScript under the repository's
  `verbatimModuleSyntax` setting.

## Existing measured-floor path

- `src/ledger/recalibrate.ts` computes a play's measured envelope from successful run-log
  records at a value-tier percentile.
- It returns `RecalibrateResult` with `source: "measured" | "prior"`.
- Its envelope contains tokens and wall-clock independently.
- `src/shelf/shelf-row.ts` calls `recalibrate` and translates its source into a
  discriminated `ShelfConfidence` union.
- A measured shelf row carries the recalibrated envelope and run count.
- A default row carries the authored prior and no measured-run count.
- T-074-02-02 can therefore keep provenance gating outside this decision function and call
  it only with a real measured floor.
- Keeping provenance outside matches the requested two-argument API.

## Existing pure-core boundary

- Pure decisions conventionally live in `*-core.ts` files beside their domain.
- `src/shelf/press-core.ts` is the addon-free decision heart of the press.
- It imports `Budget` and executor-side values type-only where possible.
- Its tests directly import the core and avoid `src/shelf/press.ts`, whose dispatch import
  reaches play code and the native addon.
- `src/shelf/shelf-row.ts` is also pure and addon-free, despite value-importing the pure
  recalibration and formatting modules.
- A standalone `src/shelf/underfunding-core.ts` fits the story's named “new pure
  underfunding-decision core” and lets both future counter seams consume one policy.

## Existing return conventions

- Repository pure parsers and optional decisions commonly return `T | null`.
- Examples include `parsePorcelainLine`, `epicNumOf`, `findUnknownSeat`, and lane-heat
  detection.
- `undefined` is used in a smaller number of optional formatting/event paths.
- For a deliberate decision result, `string | null` is the clearer established value
  contract: warning text is present, or explicitly absent.
- Expected states are values rather than exceptions throughout press and budget cores.

## Existing display language

- Warning/andon surfaces use the `⚠` glyph in `work-core.ts` and probe reports.
- `src/shelf/menu.ts` exports `formatBudget`, but it renders both time and tokens.
- Its private token formatter rounds thousands to whole `k`, which would render 12,500 as
  `13k` and lose a meaningful part of the field-report ratio.
- `src/budget/wallet.ts` has a private `fmtTokens` that preserves one decimal (`12.5k`).
- Because it is private, importing it is not an available seam.
- A tiny local token-only formatter is consistent with the warning's token-only decision
  and can preserve funded/floor values humanely.
- Message wording must name both quantities, not merely state “underfunded.”

## Existing threshold precedents

- `TIMEOUT_HEADROOM` and `MEASUREMENT_HEADROOM` use a factor of 2.
- Their comments characterize 2× as one warranted class-level factor rather than a
  data-point patch.
- `fundingEnvelope` uses more policy for auto-widening, but this warning must neither call
  it nor mutate funding.
- The repository also has ratio decisions such as lane heat, expressed as a named exported
  constant plus a strict comparison.
- No existing underfunding-warning factor exists.
- The field-report ratio is roughly 32×, so any modest “far below” factor catches it.
- The ticket requires the new ticket to choose and settle that factor for its dependent.

## Test conventions

- Unit tests are colocated as `src/<domain>/<name>.test.ts`.
- They import `describe`, `expect`, and `test` from `bun:test`.
- Pure-core tests use fabricated plain-value fixtures and avoid filesystem, clock, process,
  network, executor, and BAML imports.
- Threshold tests in the repository pin both sides and equality when a comparison is
  load-bearing.
- A direct targeted command can run only the new test file.
- The repository-wide completion gate is `bun run check`: BAML codegen, typecheck, and all
  tests.

## Working-tree and attempt constraints

- Phase artifacts must be written only under
  `.lisa/attempts/T-074-02-01/1/work/`; Lisa publishes admitted artifacts later.
- Ticket frontmatter phase/status must not be edited by this worker.
- Ticket-owned source units must be committed with `lisa commit-ticket`, exact repeated
  `--include` paths, and no ordinary `git add`/`git commit`.
- Existing modifications to `.lisa/provenance.jsonl`, T-074-01-01, and this ticket are
  Lisa/concurrent state and must remain untouched.
- The attempt assignment is already present and is not ticket-owned source.

## Constraints carried into design

- Preserve the exact requested two-argument public function.
- Keep measured/prior provenance outside the function.
- Compare tokens only.
- Make the threshold named and test-visible.
- Return warning text or `null`; never throw for ordinary adequately funded input.
- Render both funded and floor values in the warning.
- Stay addon-free by importing only the `Budget` type.
- Add no shell wiring, ledger load, dispatch, or printing in this ticket.
