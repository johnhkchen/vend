# Research — T-074-02-02 wire counter-time underfunding warning

## Assignment and phase

- Ticket: `T-074-02-02`.
- Parent story: `S-074-02`.
- Starting phase: `research`.
- This attempt must complete every remaining RDSPI phase continuously.
- Phase artifacts belong only under `.lisa/attempts/T-074-02-02/1/work/`.
- Lisa owns ticket phase/status transitions and publication to `docs/active/work/`.
- Ticket-owned commits must use `lisa commit-ticket` with exact include paths.

## Story contract

- The feature lives at the funding counter, before a cast is dispatched.
- It advances P7: budget is a hard contract.
- Severe underfunding is advisory, not a refusal.
- The operator-funded budget must remain unchanged.
- The cast must still proceed after a warning.
- A warning is eligible only for a recalibration with measured provenance.
- Cold-start/prior envelopes are intentionally silent.
- Adequate and near-floor allocations are intentionally silent.
- Silence must preserve current stdout bytes.
- The warning costs no model tokens.
- It is computed from the local run log already used by shelf calibration.
- Executor dispensability and cast andons are outside this story.
- Auto-funding, denomination changes, and blocking thin probes are outside this story.

## Settled dependency from T-074-02-01

- `src/shelf/underfunding-core.ts` now exists.
- It exports `underfundingWarning(funded, floor): string | null`.
- It exports `UNDERFUNDING_FACTOR = 2`.
- The comparison is token-only.
- It warns strictly below half the measured token floor.
- Exactly half, near-floor, at-floor, and above-floor funding are silent.
- The field-report fixture is pinned at 12,500 funded versus a 400,000 floor.
- Its exact message is:

```text
⚠ underfunded: 12.5k tokens funded vs 400k measured floor; proceeding with funded budget
```

- The core deliberately does not know whether a floor is measured.
- The wiring ticket therefore owns provenance discrimination.
- The core performs no I/O and imports `Budget` type-only.

## Existing calibration path

- `src/ledger/recalibrate.ts` owns percentile calibration.
- `recalibrate(play, records, tier, prior)` filters records per play.
- It returns `{ envelope, confidence, source }`.
- `source` is the discriminant `"measured" | "prior"`.
- Fewer than three successful runs returns the authored prior.
- Enough successful runs returns a percentile-derived measured envelope.
- The rarity-derived value tier selects the percentile.
- Time and token dimensions are calibrated independently.
- The warning policy intentionally reads only calibrated tokens.

## Existing shelf composition

- `src/shelf/shelf-row.ts` is the existing shelf/recalibration composition.
- `shelfRows(plays, records)` accepts already-read records.
- It derives a tier from each play's card rarity.
- It calls `recalibrate` with the play's authored budget as prior.
- It maps `source: "measured"` to `confidence.kind: "measured"`.
- It maps `source: "prior"` to `confidence.kind: "default"`.
- A row carries the recalibrated envelope and honest confidence.
- Calling `shelfRows([play], records)` is the narrowest reuse of existing policy.
- Re-implementing rarity mapping or recalibration at the counter would risk drift.

## Existing press path

- `src/shelf/press-core.ts` contains pure menu selection decisions.
- `planRuns` resolves selected actions to epic path and funded budget.
- An explicit `--budget` overrides each selected action's warranted budget.
- `src/shelf/press.ts` is the impure press shell.
- It reads the persisted menu, re-gathers freshness inputs, validates selection, and loops planned runs.
- Every planned run calls `runPlay("decompose-epic", opts)`.
- Therefore selection dispatch already crosses `src/play/dispatch.ts`.
- The press must not print separately if shared dispatch owns the warning.
- Printing separately would risk duplicate warnings and divergent ordering.

## Existing named dispatch path

- `src/play/dispatch.ts` exports `runPlay`.
- It looks up the play in the registry.
- A registry miss returns a typed `no-play` result and does not cast.
- A hit calls `assembleAndCast` for the currently supported named run shape.
- The module value-imports `decompose-epic.ts` and therefore the BAML addon.
- Pure/addon-free tests deliberately do not import this module.
- The warning must happen after a successful lookup, because an unknown play has no floor.
- It must happen before `assembleAndCast`.

## Existing steer path

- `src/play/steer.ts` defines and registers `steerProjectPlay`.
- Its authored budget is 2,400,000 ms / 400,000 tokens.
- Its card rarity is `rare`, which the shelf maps to the `high` tier.
- `castSteer` assembles project inputs and calls generic `castPlay` directly.
- `src/cli.ts` handles `vend steer` in its own branch.
- It chooses the explicit budget or the play's authored budget.
- It prints the canonical funding echo only when `--budget` was explicit.
- It then calls `castSteer` directly.
- Contrary to the story's shorthand, steer does not currently call `dispatch.runPlay`.
- Forcing Steer through the current `runPlay` would require widening its decompose-specific input API.
- The wiring therefore needs a shared counter primitive usable by both dispatch and steer.

## Run-log boundary

- `src/log/run-log.ts` exports `DEFAULT_RUN_LOG_PATH = ".vend/runs.jsonl"`.
- `loadRunLog({ path })` is the canonical impure read.
- A missing file returns an empty record set.
- Other filesystem errors propagate.
- Records are plain values after loading.
- Project-root-aware callers must join the root with the default relative path.
- `runPlay` already receives optional `projectRoot`.
- `castSteer` also accepts optional `projectRoot`, though the CLI uses cwd today.

## Output and ordering constraints

- `src/cli.ts` writes the existing funding echo before calling the cast path.
- The new warning should therefore appear after that echo and before executor output.
- A silent decision must perform no stdout write at all.
- Adding an empty line or placeholder would violate byte identity.
- Warning output should receive exactly one newline at the I/O boundary.
- The warning string core itself contains no trailing newline.
- The wrapper must invoke the cast regardless of whether a warning exists.
- Awaiting the write before invoking the cast makes ordering explicit.

## Testing patterns and constraints

- Bun tests avoid value-importing concrete play modules that load BAML.
- Tests build small `Play` stubs directly.
- `src/shelf/shelf-row.test.ts` already provides a fixture pattern for valid stub plays.
- It also uses `buildRunRecord` for calibrated success records.
- Three successes meet the default measured threshold.
- A generic callback wrapper can test event ordering without a real executor.
- A writer callback can capture output without patching global stdout.
- A dispatch callback can prove it is called after the warning.
- Silent cases can prove the writer is never called.
- Returned callback results can prove the wrapper does not replace cast outcomes.

## Repository state

- The branch began ahead of origin with earlier ticket commits.
- Existing modified files belong to Lisa or another ticket:
  - `.lisa/provenance.jsonl`;
  - `docs/active/tickets/T-074-01-01.md`;
  - `docs/active/tickets/T-074-02-02.md`;
  - `docs/active/work/T-074-01-01/`.
- These files must remain untouched by ticket commits.
- The predecessor implementation is committed at `fc838e4`.
- Its Lisa completion commit is `7434ea9`.

## Constraints carried into design

- Reuse `shelfRows`; do not duplicate recalibration policy.
- Gate on measured confidence before calling the settled decision core.
- Keep the counter wrapper addon-free so behavior can be tested directly.
- Keep existing CLI funding echoes unchanged.
- Keep funded budgets unchanged.
- Preserve unknown-play behavior.
- Make warning-before-dispatch and proceed-after-warning structural and testable.
- Wire both selection/named dispatch and the direct steer gesture through the same primitive.
- Do not alter executor, budget tiers, authored play budgets, run-log schema, or cast andons.
