# Research — T-081-01-02

## Contract

- The parent story is `S-081-01`, `turn-record-in-the-capped-unit`.
- This ticket owns the durable ledger half of the story after the evidence spike.
- The requested invariant is one unit from the final human summary to `runs.jsonl`:
  deduplicated agent turns from `progress.turns`.
- The `--max-turns` denominator and the summary numerator already use that unit.
- The current ledger does not: `turnsUsed` is harvested from terminal `result.num_turns`.
- Acceptance requires a cast through a stub executor to prove the corrected relationship.
- Acceptance also requires pure build/revive coverage for every new or redefined ledger key.
- Zero must remain a value.
- Unknown must remain omission, not a fabricated zero.
- Historical pre-E-081 rows must be revived without rewriting their bytes.
- Their historical `turnsUsed` unit must be documented honestly in the schema note.
- The ticket also deliberately updates the T-077-01-01 characterization and the kitchen seed query.
- The full repository gate is `bun run check`.

## Story boundary

- `src/engine/cast.ts` owns harvesting and the append input.
- `src/log/run-log.ts` owns the durable input/record contracts and normalization.
- `src/engine/cast.test.ts` owns the stub-executor relational characterization.
- `src/log/run-log.test.ts` owns pure schema round-trip and compatibility behavior.
- `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md` owns the named jq inspection line.
- `src/engine/cast-core.ts` is outside this ticket.
- Its fold and formatter are assigned to `S-081-02`.
- Envelope recalibration is outside this ticket.
- Historical ledger rewriting is explicitly outside this story.
- A fresh metered installed-binary cast is deferred by the story's honest boundary.

## Forensics verdict inherited from T-081-01-01

- The anomalous displayed 45 came from the existing flat agent-turn fold.
- That fold admitted 45 distinct nested assistant message IDs.
- The evidence partitions them into 12 parent/main and 33 sidechain IDs.
- The configured cap was 15 on the parent dispense.
- The final terminal `num_turns` was 2.
- The five terminal result counters were 10, 1, 1, 1, and 2.
- They sum to 15, not 45.
- Therefore `num_turns` is not the source of the displayed agent-turn value.
- T-077-01-01 already established these are unlike counters in a stub fixture.
- The spike concludes they must remain separately named if both are retained.
- The current terminal summary already does that:
  `agent turns: ...; executor conversation events: ...`.
- Retaining `num_turns` remains useful as executor telemetry, but not as the capped unit.

## Current live turn path

1. `castPlay` initializes `progress` with `EMPTY_CAST_PROGRESS`.
2. That zero value contains `turns: 0` and an empty `seenMessageIds` array.
3. Each executor message passes through the local `onMessage` callback.
4. `accumulateCastProgress` returns a new progress value.
5. It accepts assistant messages with a non-empty nested ID and usage object.
6. Repeated message IDs are idempotent.
7. Each first-seen ID increments `progress.turns` by one.
8. The refreshing line renders `progress.turns` against `maxTurns`.
9. The final summary receives `progress.turns` as `agentTurns` only when greater than zero.
10. The effective cap is resolved once and passed to both executor dispense and formatting.
11. Thus `progress.turns` is already the observable used by the cap-facing surfaces.

## Current terminal executor counter path

1. The executor returns an optional terminal `ResultMessage`.
2. `castPlay` calls `resolveTurnsUsed(result?.num_turns)` after classification inputs exist.
3. That pure helper accepts a finite non-negative integer and otherwise returns undefined.
4. The validated number is passed to the final formatter as `executorReportedTurns`.
5. The formatter labels it `executor conversation events`.
6. The same local value is currently spread into append input as `turnsUsed`.
7. This final spread is the mixed-unit defect.
8. A timeout can lack a terminal result but still have known streamed progress.
9. A resumed draft performs no executor dispense and intentionally has no new executor facts.
10. Missing-capability early returns also perform no dispense and use separate append calls.

## Current durable schema

- `RunRecordInput` has optional `turnsUsed?: number`.
- `RunRecord` has optional `turnsUsed?: number`.
- `normalizeTurnsUsed` accepts finite, non-negative integers including zero.
- `buildRunRecord` normalizes and conditionally spreads the field.
- `reviveRecord` normalizes the raw field and conditionally spreads it.
- Absence is preserved as absence on both boundaries.
- Malformed optional data is dropped without rejecting the otherwise valid row.
- `serializeRunRecord` uses `JSON.stringify` and appends one newline.
- Object insertion order is fixed by the build/revive object literals.
- Existing compatibility tests compare serialized records byte-for-byte.
- `RUN_LOG_SCHEMA_VERSION` remains 1 and the reviver does not currently validate `v`.
- Many additive schema changes have kept historical absence byte-identical.

## Existing turn schema tests

- `src/log/run-log.test.ts` has a dedicated `turnsUsed` describe block.
- It pins build → serialize → revive round-trip.
- It pins `turnsUsed: 0` as a real value.
- It pins omission when absent.
- It pins rejection of NaN, negative, and fractional values on build.
- It pins malformed raw values being dropped on revive.
- It pins a pre-T-015-02 line without the field remaining readable.
- It does not cover a second honestly named executor counter.
- It does not yet pin a pre-E-081 row containing old-unit `turnsUsed` byte-for-byte.

## Existing cast characterization

- `src/engine/cast.test.ts` contains the T-077-01-01 full seam fixture.
- It creates exactly 15 distinct assistant IDs and repeats one stream block.
- It returns an `error_max_turns` result with `num_turns: 23`.
- It proves production argv includes `--max-turns 15`.
- It proves the summary prints `agent turns: 15 / 15 cap`.
- It separately prints `executor conversation events: 23`.
- It proves the transcript retains terminal subtype and raw `num_turns`.
- Its ledger assertion currently expects `turnsUsed: 23`.
- That assertion is the named characterization that must change deliberately.
- The fixture can prove the new relation without adding another broad integration harness.

## Compatibility and naming constraints

- The public persisted key `turnsUsed` already exists and is read by downstream code/docs.
- The ticket wording calls for the ledger's turn field to carry the capped unit.
- Reusing `turnsUsed` for deduplicated agent turns minimizes downstream churn.
- The historical rows under this key cannot be retrospectively distinguished by schema version.
- They must therefore retain their numeric bytes and receive an explicit historical-unit note.
- `executorReportedTurns` is already the pure formatter's name for terminal `num_turns`.
- Using the same name in the ledger avoids introducing a third label for the same fact.
- The user-facing summary phrase can remain `executor conversation events`.
- Both numeric fields share the same structural normalization contract.
- A shared non-negative-integer helper is sufficient; policy remains in field documentation.

## Known versus zero at cast settlement

- A cold dispense attempt starts from a known zero progress value.
- If it receives no qualifying assistant records, its deduplicated agent-turn count is known zero.
- A timeout may still have a known count because streamed records were accumulated before timeout.
- Terminal `num_turns` is unknown whenever there is no usable result field.
- A resumed draft has no new executor run, so it must not claim zero new cast turns as `turnsUsed`.
- Early missing-capability records never start an executor and currently omit turn data.
- The ordinary cold path can distinguish known `progress.turns` from the resume path using
  `resumeDraft === undefined`.
- The append input can therefore preserve zero for an attempted cold cast while omitting turn facts
  for a resume that consumed a prior checkpoint.

## Kitchen gold-master query

- `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md` has one relevant jq line.
- It currently projects `{play,outcome,env:.envelope,usage,turnsUsed}`.
- Acceptance explicitly asks that line to read the new key.
- Because the executor counter is retained by the spike verdict, the inspection should expose both
  `turnsUsed` and `executorReportedTurns` rather than silently hiding either fact.
- The prose below the query speaks about budget and wall clock, not the old turn unit.

## Repository state and workflow constraints

- HEAD includes completed dependency `T-081-01-01`.
- Lisa has modified `.lisa/provenance.jsonl` and ticket frontmatter files.
- Those changes are orchestration-owned and must remain untouched.
- No ticket-owned source file is currently modified.
- Phase artifacts belong only in this attempt's private work directory.
- Ticket-owned source units must be committed with `lisa commit-ticket`.
- Every commit requires exact repository-relative `--include` paths.
- Ordinary `git add` and `git commit` are prohibited by the assignment.

## Research conclusions

- The defect is localized to the name/value mapping at persistence, not the fold.
- `progress.turns` is the only currently available value that matches the capped summary unit.
- Terminal `num_turns` should be retained under `executorReportedTurns`.
- The run-log pure boundary needs symmetrical handling for both keys.
- The historical compatibility proof must use a literal pre-E-081 line containing old-unit
  `turnsUsed` and assert exact serialization after revive.
- The T-077 seam fixture is the strongest place to pin ledger-summary equality.
- No architecture expansion or historical migration is needed within this ticket.
