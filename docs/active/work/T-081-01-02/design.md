# Design — T-081-01-02

## Objective

Make the ledger's primary turn field use the same capped unit as live/final reporting while
preserving Claude's distinct terminal counter as optional, honestly named telemetry.

The resulting ordinary cold-cast record should satisfy:

`record.turnsUsed === progress.turns === final summary agent-turn figure`

and, when Claude supplies terminal `num_turns`:

`record.executorReportedTurns === result.num_turns`.

## Decisions inherited from evidence

- The terminal executor counter earns a place in the ledger.
- It is a real observed fact used to diagnose executor behavior.
- It is not the agent-loop counter bounded by `--max-turns`.
- It must not remain under the ambiguous primary name `turnsUsed`.
- The existing final formatter already supplies the honest internal name
  `executorReportedTurns` and user-facing label `executor conversation events`.
- The existing deduplicated `progress.turns` value is the ticket's required capped unit.
- Historical values are preserved, not recalculated.

## Option 1 — Replace `turnsUsed` with a new `agentTurns` key

### Shape

- Stop writing `turnsUsed` for new casts.
- Add `agentTurns` for `progress.turns`.
- Add `executorReportedTurns` for terminal `num_turns`.
- Continue reading historical `turnsUsed` only as a legacy compatibility field.

### Advantages

- Every key is maximally explicit.
- Historical and new values would occupy different names.
- Consumers could identify historical-unit rows by key presence.

### Costs

- Acceptance refers to the ledger's existing turn field and asks the kitchen line to read the new
  key, not to remove the established signal.
- Existing recalibration prose and any external jq consumers expect `turnsUsed`.
- It creates three turn keys in revived records unless legacy data is hidden.
- Hiding legacy `turnsUsed` on revive would violate byte-identical historical behavior.
- This is a larger schema migration than the ticket needs.

### Decision

Rejected. The explicitness is attractive, but the migration surface and dual-primary semantics do
not fit the narrow story.

## Option 2 — Keep `turnsUsed` as terminal `num_turns`, add `agentTurns`

### Shape

- Preserve current `turnsUsed` writes unchanged.
- Add `agentTurns: progress.turns`.
- Teach consumers to prefer `agentTurns`.

### Advantages

- No semantic change to the existing key.
- Historical rows remain naturally comparable with current rows under `turnsUsed`.
- The capped unit gains an explicit key.

### Costs

- The ledger's established turn field remains poisoned for envelope math and audits.
- Downstream code can continue accidentally reading `turnsUsed` as the capped unit.
- It fails the ticket's central request that the durable turn field record the summary/cap unit.
- It preserves the misleading primary name for executor conversation events.

### Decision

Rejected because it does not repair the measurement layer.

## Option 3 — Redefine `turnsUsed`, retain executor telemetry separately

### Shape

- New cold casts write `turnsUsed: progress.turns`.
- Terminal `result.num_turns`, when valid, is written as `executorReportedTurns`.
- The final summary continues to receive the same two values under the same conceptual names.
- Pure run-log build/revive normalizes both optional keys.
- A schema note documents that pre-E-081 `turnsUsed` rows contain terminal executor `num_turns`.
- Historical raw numbers remain untouched.

### Advantages

- The primary key becomes safe for capped-turn audits and future envelope math.
- The smallest production change fixes the exact defect.
- The final summary and ledger share the same vocabulary.
- Existing consumers of `turnsUsed` automatically receive the corrected unit for new data.
- Optional executor telemetry remains available for diagnosis.
- No mutation or backfill mechanism is introduced.

### Costs

- Schema version 1 contains a historical semantic boundary that cannot be inferred from the row
  alone unless consumers also know the E-081 deployment boundary.
- Mixed historical/new datasets require the documented caution.
- Consumers comparing all `turnsUsed` rows across that boundary must account for the old unit.

### Decision

Chosen. It is the ticket's requested compatibility tradeoff: correct new facts, retain old bytes,
and document the unavoidable historical boundary honestly.

## Key names and meanings

### `turnsUsed`

- New-write meaning: distinct accepted assistant message IDs observed by the cast progress fold.
- Operational meaning: the same agent-turn unit displayed against `--max-turns`.
- Source: `progress.turns`.
- Domain: finite, non-negative integer.
- Zero: meaningful and retained.
- Absence: unknown or no new executor cast for this ledger row.
- Historical note: pre-E-081 rows used terminal `result.num_turns`, an unlike executor counter.

### `executorReportedTurns`

- Meaning: the executor's optional terminal turn/event count.
- Claude source: `result.num_turns` after `resolveTurnsUsed` validation.
- Human label: `executor conversation events`.
- Domain: finite, non-negative integer.
- Zero: meaningful and retained.
- Absence: executor omitted the fact, returned no terminal result, or the value was malformed.
- It must never be compared to `maxTurns` as a numerator/denominator pair.

## Cast-path policy

### Ordinary cold cast

- Dispense is attempted.
- `progress.turns` starts at known zero and folds every streamed message.
- Append always supplies `turnsUsed`, including zero.
- Valid terminal `num_turns` supplies `executorReportedTurns`.
- Invalid or absent terminal `num_turns` omits `executorReportedTurns`.

### Timed-out cold cast

- Dispense was attempted and may have streamed partial progress.
- `progress.turns` is still the known observed count, including possible zero.
- Append supplies that observed `turnsUsed` value.
- With no terminal result, executor telemetry is omitted.

### Resume from decompose draft

- No new executor dispense occurs.
- The row must not fabricate a zero-turn new cast.
- Both new-cast turn facts are omitted.
- This mirrors the existing omission of envelope and execution seat on resume.

### Pre-dispense missing-capability returns

- Existing early append calls remain unchanged.
- No executor ran, so turn fields remain absent.
- This is honest unknown/not-applicable rather than a no-turn completed cast.

## Normalization design

- Keep one pure numeric normalizer because both fields share the same structural domain.
- Rename it from policy-specific `normalizeTurnsUsed` to `normalizeTurnCount`.
- Build normalizes `input.turnsUsed` and `input.executorReportedTurns` independently.
- Revive reads and normalizes the two raw fields independently.
- A malformed optional field is omitted without rejecting the record.
- Presence checks use `!== undefined`, so zero survives.
- Field insertion order places `executorReportedTurns` immediately after `turnsUsed`.
- Historical rows lacking the new field serialize in their original field order.

## Historical byte-identity design

- Add a literal JSONL fixture representing a valid pre-E-081 row with `turnsUsed` present.
- The literal uses the canonical property order already emitted by `RunRecord`.
- It intentionally omits `executorReportedTurns`.
- `readRuns` revives the line.
- `serializeRunRecord(records[0])` must equal the original literal including newline.
- The assertion also checks the old numeric value is preserved under `turnsUsed`.
- It does not relabel, clone, or infer `executorReportedTurns` from historical data.
- The schema comment explains why the old number is retained even though its unit differs.

## T-077 characterization update

- Keep the same fixture and its unlike values: 15 agent turns and terminal 23.
- Keep argv, summary, transcript, subtype, effect, and recovery assertions.
- Replace the old ledger assertion `turnsUsed === 23` with two deliberate assertions:
  `turnsUsed === DECOMPOSE_MAX_TURNS` and `executorReportedTurns === 23`.
- Add a relational assertion tying the durable value to the deduplicated transcript ID set.
- Rename the test to state that the ledger separates the unlike units.
- Update its comment/message only where needed; do not rewrite unrelated T-077 behavior.

## Pure run-log test design

- Expand the existing turn describe block rather than create disconnected coverage.
- Pin `turnsUsed` round-trip under its new documented meaning.
- Retain its existing zero, absence, malformed-build, malformed-revive, and pre-T-015 coverage.
- Add symmetrical `executorReportedTurns` tests for:
  - build → serialize → revive round-trip;
  - explicit zero preservation;
  - omission when absent;
  - malformed build values;
  - malformed revive values.
- Add the literal pre-E-081 byte-identity test.
- Verify historical revival does not synthesize the new executor key.

## Kitchen query design

- Change the projected object to include both corrected facts:
  `{...,turnsUsed,executorReportedTurns}`.
- `turnsUsed` remains the primary capped-unit inspection.
- `executorReportedTurns` is visible when the executor reports it.
- jq will render absent optional fields as `null` in the projected object, which is acceptable for
  a diagnostic query and makes unknown visibly distinct from zero.

## Schema-version decision

- Keep `RUN_LOG_SCHEMA_VERSION` at 1.
- The codebase has treated optional additive fields as compatible within v1.
- `reviveRecord` does not currently branch on or validate `v`.
- Bumping the constant without a multi-version reader would rewrite every revived historical row.
- That would directly conflict with byte-identical pre-E-081 revival.
- The explicit field-level schema note is therefore the correct compatibility mechanism here.

## Risks and mitigations

- Risk: accidental zero omission through truthiness.
  Mitigation: use `!== undefined` spreads and dedicated zero tests.
- Risk: resume rows claim a new zero-turn execution.
  Mitigation: derive optional observed agent turns from `resumeDraft === undefined`.
- Risk: terminal `num_turns` is silently lost.
  Mitigation: retain it under `executorReportedTurns` and pin cast/run-log tests.
- Risk: historical values are mistaken for the new unit.
  Mitigation: explicit pre-E-081 schema note and literal compatibility test.
- Risk: integration assertions merely restate fixture constants.
  Mitigation: compare `record.turnsUsed` to the deduplicated transcript ID set.
- Risk: scope expands into sidechain filtering.
  Mitigation: do not edit `cast-core.ts`; this ticket records the current capped observable only.

## Verification

- Run focused tests for `src/log/run-log.test.ts` and `src/engine/cast.test.ts`.
- Run TypeScript/build checks through the full repository gate.
- Run `bun run check` after all source units and docs are committed.
- Confirm git status shows no ticket-owned modified, staged, or untracked files.
