# Review — T-081-01-02

## Outcome

Pass. New ledger rows now record the capped deduplicated agent-turn unit under `turnsUsed`, matching
the final summary's agent-turn figure and the unit passed to `--max-turns`. Claude's unlike terminal
`num_turns` remains available under the separate, honestly named `executorReportedTurns` key.

The implementation is committed in three meaningful exact-path Lisa commits, the required schema
and seam tests pass, historical old-unit rows remain byte-stable, and `bun run check` is green.

## Commits

```text
c175c10 fix(log): separate capped and executor turn counts
544d2d2 fix(engine): persist agent turns in capped unit
b575911 docs(kitchen): inspect separate turn counters
```

Each was created with `lisa commit-ticket --ticket-id T-081-01-02` and exact repository-relative
`--include` paths. Ordinary `git add` and `git commit` were not used.

## Files changed

### `src/log/run-log.ts`

- Redefined the new-write meaning of `turnsUsed` as distinct deduplicated agent turns.
- Added `executorReportedTurns` to both `RunRecordInput` and `RunRecord`.
- Added schema documentation that explicitly separates capped agent turns from executor telemetry.
- Documented the unavoidable historical boundary: pre-E-081 `turnsUsed` values came from terminal
  `result.num_turns` and remain in that old unit.
- Kept historical values unchanged rather than inferring, copying, or rewriting them.
- Generalized the private structural normalizer to `normalizeTurnCount`.
- Applied identical finite/non-negative/integer validation to both optional fields.
- Preserved explicit zero via `!== undefined` checks.
- Preserved unknown/malformed data as field omission.
- Kept the ledger module structurally decoupled from executor imports.

### `src/log/run-log.test.ts`

- Retained the complete `turnsUsed` positive/zero/absence/malformed contract.
- Added symmetrical positive/zero/absence/malformed coverage for `executorReportedTurns`.
- Added a literal pre-E-081 ledger line carrying old-unit `turnsUsed: 23`.
- Proved that line revives with its number unchanged.
- Proved revival does not synthesize `executorReportedTurns`.
- Proved revive → serialize returns the exact original JSONL bytes.
- Extended older absence coverage so both optional turn keys remain unknown when absent.

### `src/engine/cast.ts`

- New cold casts derive ledger `turnsUsed` from `progress.turns`.
- Known zero is retained for a cold dispense attempt.
- A timed-out cold cast can retain the observed partial progress count.
- A resumed draft omits the field because it performs no new executor dispense.
- Terminal `result.num_turns` remains validated but is locally named `executorReportedTurns`.
- The summary and ledger receive the same two facts under the same conceptual names.
- The ledger append no longer puts terminal `num_turns` under `turnsUsed`.
- No changes were made to cap resolution, the fold, budget classification, effects, or settlement.

### `src/engine/cast.test.ts`

- Deliberately updated T-077-01-01's 15-versus-23 characterization.
- Preserved exact `--max-turns 15` argv coverage.
- Preserved summary output with `agent turns: 15 / 15 cap` and executor events 23.
- Preserved the assertion that 23 is never rendered as a fraction of the 15 cap.
- Preserved raw terminal subtype/`num_turns`, effect, outcome, and recovery coverage.
- Now asserts ledger `turnsUsed` equals the deduplicated transcript assistant-ID set size.
- Pins that capped-unit value at 15.
- Pins separate `executorReportedTurns` at 23.

### `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md`

- Updated the named re-run jq projection to show both `turnsUsed` and
  `executorReportedTurns`.
- Left the rest of the frozen kitchen outcome unchanged.

## Acceptance assessment

### Stub cast writes the capped unit

Pass.

The existing production-seam fixture streams 15 unique assistant IDs plus one repeated block. Its
ledger row now asserts:

```text
turnsUsed === new Set(assistantIds).size === DECOMPOSE_MAX_TURNS === 15
```

The same fixture's final summary prints `agent turns: 15 / 15 cap`, establishing line-to-ledger
equality in the capped deduplicated unit.

### Executor counter retained honestly

Pass.

The fixture terminal result still carries `num_turns: 23`. The summary labels it `executor
conversation events: 23`, and the ledger records `executorReportedTurns: 23`. It is never compared
against the 15-turn cap.

### Build/revive contracts

Pass.

Both fields have tests for:

- positive round-trip;
- explicit zero as a present value;
- omission when unknown;
- invalid build input omitted;
- malformed raw input omitted without rejecting the valid row.

### Historical compatibility

Pass.

A literal pre-E-081 row with old-unit `turnsUsed: 23` revives and serializes byte-for-byte. The
reader preserves the field and does not manufacture an `executorReportedTurns` value. The canonical
schema comments name the old unit instead of pretending the historical number has the new meaning.

### T-077 characterization update

Pass.

The named characterization was edited explicitly. Its old `turnsUsed: 23` expectation was not
allowed to fail incidentally; it was replaced with the relational 15-turn primary assertion and a
separate 23-event executor assertion.

### Kitchen seed inspection

Pass.

The gold-master query now projects:

```text
turnsUsed,executorReportedTurns
```

so the corrected primary signal and retained optional telemetry are both observable.

### Repository gate

Pass.

```text
bun run check

BAML generation: pass
TypeScript tsc --noEmit: pass
Tests: 1949 pass, 1 skip, 0 fail
Expectations: 6419
Files: 126
```

The single skip is the repository's existing opt-in dist integration test; it names
`just release-local` as its condition and is unrelated to this ticket.

## Test coverage assessment

Coverage is proportional to the risk and spans both boundaries:

- Pure schema tests catch field ordering, zero/unknown mistakes, malformed optional data, and
  historical rewrites without filesystem or executor effects.
- The stub executor test exercises the real cast shell, production argv builder, stream sink,
  deduplication observation, final summary, transcript, run-log append, effect, and recovery state.
- The full suite exercises all downstream ledger consumers and the sibling fold change together.

No additional live test is needed within this ticket's FREE fixture boundary. The story explicitly
defers a fresh installed-binary metered cast to epic closeout.

## Concurrency observation

The first focused/full cast verification occurred while sibling `T-081-02-01` had modified
`src/engine/cast-core.ts` but had not yet atomically committed its associated fixtures and golden
updates. That transient state produced five progress-output expectation failures unrelated to this
ticket's ledger mapping.

This ticket did not edit or stage sibling-owned files. Its exact-path commits proceeded, the sibling
then committed `e0c2bcd fix(cast): reconcile live weighted spend`, and the full gate was rerun green
against the settled combined state. This is documented in `progress.md` rather than hidden.

## Compatibility note for consumers

The schema version remains 1 because the existing run-log reader treats optional fields additively
and does not implement multi-version branching. Consequently, a dataset spanning E-081 has a known
historical semantic boundary:

- pre-E-081 `turnsUsed`: terminal executor `num_turns` unit;
- E-081 and later new writes: deduplicated capped agent-turn unit;
- E-081 and later optional `executorReportedTurns`: terminal executor unit.

This ticket does not claim historical rows are directly comparable to new rows under `turnsUsed`.
It preserves them as recorded evidence and documents the unit honestly, as acceptance requires.

## Open concerns

No blocking implementation concerns remain.

Two intentional boundaries remain:

1. Historical rows cannot be automatically classified by unit from `v: 1` alone. They are
   preserved and documented, not rewritten.
2. The story's fresh installed-binary cast is a deferred live metered verification. This ticket
   proves the contract through deterministic stub execution and ledger fixtures only.

Sidechain filtering and live token reconciliation belong to sibling `T-081-02-01`; its committed
fold work is present in the final green gate but is not claimed as this ticket's implementation.

## Worktree audit

All five ticket-owned repository files are committed and clean. No ticket-owned file is staged,
modified, or untracked.

Remaining worktree entries at review are Lisa orchestration/publication state:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-081-01-02.md`;
- `docs/active/tickets/T-081-02-01.md`;
- untracked shared publication directories under `docs/active/work/`.

Those files were not included in ticket commits. Lisa owns phase transitions, artifact publication,
completion commit, and seat release.

## Disposition

Pass. Acceptance is met, the required gate is green, implementation is committed, and no required
work remains for this ticket before Lisa's completion publication.
