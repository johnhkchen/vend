# T-075-03-01 Research — cold-start confidence count

## Assignment and phase state

- The ticket is `T-075-03-01`, titled `cold-start-confidence-count`.
- Its parent story is `S-075-03`, `shelf-honesty-labels`.
- The ticket frontmatter begins at `phase: research` and `status: open`.
- Lisa owns phase/status transitions; this attempt must not edit those frontmatter fields.
- Attempt artifacts belong under `.lisa/attempts/T-075-03-01/1/work/`.
- Lisa later publishes admitted artifacts to `docs/active/work/T-075-03-01/`.
- Ticket-owned source must be committed with `lisa commit-ticket`, not ordinary Git staging.
- The repository currently contains unrelated dirty work from another ticket.
- In particular, `src/ledger/walk-away.ts`, `src/ledger/walk-away.test.ts`,
  `src/shelf/home.ts`, and `src/shelf/home.test.ts` are already modified.
- Those files are not part of this ticket and must remain untouched.

## Story contract

- Story scope names the exact production surface: `src/shelf/shelf-row.ts`.
- It names the corresponding fixture surface: `src/shelf/shelf-row.test.ts`.
- A sibling ticket owns `src/shelf/menu.ts` and the empty-board guidance line.
- The two tickets intentionally fan out because the file sets are disjoint.
- This ticket must not edit menu rendering or Home composition.
- The story distinguishes three confidence states visible at the shelf:
  1. zero successful runs;
  2. one or two successful runs, below the cold-start threshold;
  3. at least the cold-start threshold, producing a measured envelope.
- The current surface collapses states 1 and 2 into the same default label.
- The required distinction is only in the label, not in the budget envelope.
- A zero-run default must continue to read `(default — no runs yet)`.
- A thin default must read `(default — N runs, measured at 3)`.
- A measured confidence remains a runs-bearing discriminated-union arm.
- The story explicitly retains the E-026 invariant: a measured-zero confidence is not
  representable through the shelf confidence type.
- The story's honest boundary says the work is pure, typed, FREE, and fixture-proven.
- It expressly excludes ledger math changes.
- It expressly excludes changing the cold-start threshold.
- It expressly excludes operator audit prose and the SVG face strip.

## Charter and vision constraints

- The ticket advances P3, “Gates are the contract.”
- The concrete gate is a deterministic shelf-row test suite plus the full repository check.
- It also advances P5, “Local-first.”
- The relevant implementation is pure local composition over already-read ledger values.
- The vision says consistency comes from gates rather than live supervision.
- The label is therefore a contract about what evidence exists behind the envelope.
- The display may not invent, hide, or upgrade evidence.
- The run path remains unchanged; this is not new run-time configuration.
- The executor interface is outside this slice.
- Budget enforcement and recalibration policy are outside this slice.

## Current shelf-row module

- `src/shelf/shelf-row.ts` is the pure shelf core.
- It imports `Budget`, `AnyPlay`, `Rarity`, and `RunRecord` as types.
- Its only ledger value import is `recalibrate` from `src/ledger/recalibrate.ts`.
- It imports `formatBudget` plus the `ValueTier` type from `src/shelf/menu.ts`.
- The module performs no filesystem, clock, process, network, or addon work.
- `RARITY_TIER` maps the four play rarities to four shelf value tiers.
- `tierForRarity` is a total lookup over that record.
- `ShelfRow` carries name, summary, envelope, and structured confidence.
- `shelfRows` preserves play order and returns one fresh row per input play.
- For each play, it calls `recalibrate` with the entire already-read records array.
- `recalibrate` performs the per-play filtering itself.
- The play's authored budget is passed as the cold-start prior.
- The result's envelope is passed through unchanged into the shelf row.
- The result's source controls the shelf confidence arm.
- A measured result currently maps to `{ kind: "measured", runs: successes }`.
- A prior result currently maps to `{ kind: "default" }`.
- This mapping is the point where the thin successful-run count is discarded.
- `confidenceLabel` is a private pure renderer over `ShelfConfidence`.
- It uses an exhaustive switch with no default branch.
- The measured arm renders `(measured · N run[s])`.
- The default arm always renders `(default — no runs yet)`.
- `renderShelf` prefixes default envelopes with `~`.
- `renderShelf` leaves measured envelopes unprefixed.
- The confidence qualifier follows the formatted envelope.
- Empty shelves render `(no playbooks)`.

## Current confidence type

- `ShelfConfidence` is a discriminated union on `kind`.
- Its measured arm is `{ kind: "measured"; runs: number }`.
- Its default arm is `{ kind: "default" }`.
- The original type prevents a default confidence from carrying any run count.
- That was appropriate when all defaults were described as having no history.
- The story now requires some defaults to carry a successful-run count.
- Therefore the default arm needs an internal distinction that does not weaken the
  measured/default provenance distinction.
- TypeScript is configured with `strict: true`.
- The source tree is included in `tsconfig.json`, including `.test.ts` files.
- `bun run check:typecheck` therefore checks compile-time assertions in tests.
- `noUncheckedIndexedAccess` is enabled, so indexed test values are possibly undefined.
- `verbatimModuleSyntax` is enabled, so type imports should stay type-only.
- `exactOptionalPropertyTypes` is not explicitly enabled.

## Ledger source of truth

- `src/ledger/recalibrate.ts` owns recalibration and cold-start semantics.
- It exports `COLD_START_MIN_SUCCESSES` with the value `3`.
- Its comment defines values below the threshold as too thin for a percentile.
- `recalibrate` accepts the threshold as an optional override but defaults to the constant.
- The shelf does not pass an override.
- Recalibration filters to the selected play and recency window.
- It counts successful records in that window.
- It separately counts censored budget-exhausted and timed-out records.
- It constructs a `Confidence` object before choosing prior versus measured.
- `Confidence.successes` is the actual successful sample size in the window.
- That count is present even when the source is `prior`.
- If successes are below `minSuccesses`, the result source is `prior`.
- The prior envelope is returned verbatim in that case.
- If successes meet the threshold, the result source is `measured`.
- The measured result carries the same success count.
- No new ledger query or computation is needed for this ticket.
- The story phrase “measured at 3” corresponds to the exported ledger constant.
- Importing the constant avoids redefining the threshold at the shelf.

## Existing shelf-row tests

- `src/shelf/shelf-row.test.ts` uses Bun's `describe`, `expect`, and `test`.
- Tests build play stubs directly and do not load the BAML addon.
- `makeStubPlay` permits summary, budget, and rarity overrides.
- `recordOf` builds deterministic records with a pure run-record helper.
- The measured suite uses five successful records.
- It asserts measured confidence includes `runs: 5`.
- It also pins rarity-to-percentile behavior.
- The cold-start suite has a zero-record case.
- That case currently expects `{ kind: "default" }` and the authored budget.
- The cold-start suite has a two-success case.
- That case also currently expects `{ kind: "default" }` and the authored budget.
- These expectations expose the current collapse directly.
- The rendering suite has fixture helpers for measured and default rows.
- The default fixture currently has no count-bearing state.
- A default rendering test asserts the `~` prefix and “no runs yet” text.
- A seam test passes a real zero-record `shelfRows` result into `renderShelf`.
- There is currently no seam or render assertion for one or two successful runs.
- There is currently no explicit negative compile-time assertion for measured zero.

## Type-level test precedent

- The repository uses `// @ts-expect-error` in `src/gate/gates.test.ts`.
- Those assertions deliberately place an invalid expression on the following line.
- The full typecheck fails if the expression unexpectedly becomes valid.
- That is the available native mechanism for proving an invalid union construction remains
  unconstructable without adding a type-test dependency.
- A measured-zero prohibition cannot be expressed by the current `number` field alone.
- TypeScript's plain `number` type includes zero.
- Therefore the current union does not actually make `{ kind: "measured", runs: 0 }`
  unconstructable, despite comments claiming measured means at least one.
- The ticket acceptance makes that latent mismatch an explicit gate.

## Consumers and compatibility surface

- `src/shelf/home.test.ts` builds a default `ShelfRow` fixture directly.
- That file is concurrently modified by another ticket, so this ticket should not edit it.
- Any new confidence representation should ideally keep `{ kind: "default" }` valid.
- This avoids forcing unrelated consumer churn and preserves the zero-run construction.
- The production Home path calls `renderShelf` with rows; it does not inspect default internals.
- Search finds no other production construction of `ShelfConfidence`.
- Search finds measured fixture construction in shelf-row and Home tests.
- Existing measured counts such as `5` are positive integer literals.
- Existing measured rendering includes a one-run singular-label test.
- A type refinement must preserve literal `1` and `5` constructions.

## Repository and commit constraints

- The branch is ahead of `origin/main` and contains unrelated working-tree changes.
- The relevant shelf-row files had no pre-existing diff at the start of this attempt.
- The ticket's meaningful source unit is expected to be the production module plus its test.
- `lisa commit-ticket` accepts repeated exact repository-relative `--include` paths.
- It commits ticket files without using the ordinary Git index.
- The assignment requires no ticket-owned file remain staged, modified, or untracked.
- The attempt artifacts are private Lisa state and are not ordinary ticket-owned source.
- `bun run check` is the repository gate: BAML generation, TypeScript, then all tests.
- The Bun version must not be upgraded.

## Observed boundary summary

- The ledger already knows both facts the UI needs: successes and threshold.
- The shelf mapping currently throws away successes only on the prior branch.
- The shelf renderer currently treats every prior branch as zero history.
- The confidence type must represent zero-default and thin-default separately.
- The measured arm additionally needs a type-level nonzero constraint to satisfy acceptance.
- The work remains localized to `shelf-row.ts` and `shelf-row.test.ts`.
- Ledger math, menu text, Home composition, CLI behavior, and persistence are outside the ticket.
