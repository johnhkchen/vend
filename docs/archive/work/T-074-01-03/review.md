# Review — T-074-01-03

## Outcome

PASS.

A cast now probes the exact active executor before prompt render, transcript setup, or dispense.

When the probe returns non-ok, the pure classifier returns `missing-capability`, the impure shell
emits a named amber andon with the executor's cause and hint, exactly one zero-spend run record is
appended, and the cast returns without dispensing or materializing anything.

A successful probe is inert and the existing cast pipeline remains green.

Source commit:

```text
6f280182c0755905ba3e0cf919e0c445f52f3644
feat(engine): andon unreachable executor at cast time (T-074-01-03)
```

The source unit was committed through `lisa commit-ticket` with exact include paths only.

## Files changed

### `src/engine/cast-core.ts`

Added a type-only dependency on the executor-neutral `ExecutorProbeResult` contract.

Extended `ClassifyInput` with optional `executorProbe` data.

Added the first-priority classifier branch:

```ts
if (i.executorProbe?.ok === false) {
  return { outcome: "missing-capability", materialize: false, gateLog: [] };
}
```

This preserves pure-core ownership of the outcome/materialization decision.

The branch deliberately returns no play-gate rows because the refusal precedes all play gates.

Existing timeout, gate-stop, exhausted-budget, over-envelope, and success branches are unchanged.

### `src/engine/cast-core.test.ts`

Added a classifier case with a failed executor probe plus conflicting timeout, exhausted-budget,
and stopped-gate facts.

The test pins missing-capability as the pre-dispense terminal result, false materialization, empty
gate evidence, and no over-envelope marker.

Updated an ordinary clear case to pass `{ ok: true }`, explicitly proving successful-probe
inertness.

### `src/engine/cast.ts`

Moved executor selection and execution-seat mapping earlier, immediately after the established
required-MCP capability gate.

Selection precedence is unchanged: explicit injected instance, otherwise existing id/env selection.

Calls `probe()` once on that exact object. No second executor is constructed for dispense.

Routes the result through the pure classifier.

On failed probe:

- writes `· andon: missing-capability`;
- names the executor id as unreachable;
- renders the probe reason and hint;
- supplies stable reason/hint fallbacks for malformed minimal non-ok results;
- appends one run-log record with empty usage, zero cost, empty gate rows, and known execution-seat
  provenance;
- returns a missing-capability `RunSummary` with `materialized: false` and empty actual usage.

The immediate return occurs before tool flag projection, play render, transcript directory creation,
stream setup, dispense, metering, parse, gates, effect, captured diff, complement review, and the
ordinary terminal append.

The passing path forwards the ok result into the ordinary classifier, where it is inert.

The existing `dispense()` call and its option object are unchanged.

### `src/engine/cast.test.ts`

Added a hermetic cast integration fixture with:

- executor id `claude`;
- a counted non-ok probe;
- the named config-store/Keychain cause;
- the actionable login/sandbox-Keychain hint;
- a `dispense()` method that throws if incorrectly reached;
- a counted effect log.

The test validates summary, stdout, no transcript, no dispense/effect, and exactly one persisted
zero-spend record.

## Acceptance assessment

### Non-ok active executor returns missing-capability summary

PASS.

The integration test observes `summary.outcome === "missing-capability"` and
`summary.materialized === false`.

The pure test separately pins the classification rather than relying only on shell literals.

### Nothing dispensed

PASS.

The failing fixture increments a dispense counter and throws if called. The completed cast returns
normally with the counter still zero.

The probe itself is the dependency-ticket's shallow unmetered boundary and does not submit a model
prompt.

### Nothing materialized

PASS.

The effect log remains empty, the summary reports false materialization, and there is no produced or
captured-diff path on the early result.

### No raw stack

PASS.

The cast consumes structured non-ok data and returns normally. Captured stdout contains the amber
andon and does not contain an `Error:` stack header.

Expected environment probe failures are already converted to data by both executor implementations.

### Named cause and hint

PASS.

Captured stdout contains all of:

```text
executor 'claude' unreachable
claude config store/Keychain is unreadable
run `claude login`; grant the sandbox access to the Keychain
```

The formatter trims supplied values and provides actionable fallbacks when optional fields are
absent, so a malformed non-ok result cannot render `undefined`.

### Exactly one run-log line

PASS.

The integration test reads the JSONL and asserts one line.

Structurally, the branch has one direct `appendRunLog` call followed by an immediate return, so it
cannot reach the ordinary terminal append.

### Empty usage and zero cost

PASS.

The returned actual usage is `{}`.

The append input uses `{}` and cost `0`. The parsed persisted record contains the expected four
normalized zero token counters and `costUsd: 0`.

### Missing-capability persisted outcome

PASS.

The single parsed run record carries `outcome: "missing-capability"` and empty `gateResults`.

Known execution-seat provenance is `claude`, naming the selected/probed lane without claiming any
usage was spent.

### Passing executor remains compatible

PASS.

The pre-existing successful injected-executor integration test remains green and still proves the
full stream, parse, clear, effect, actual usage, model id, execution seat, and single success record.

All other cast tests—including timeout, progress, reduced grounding, over-envelope settlement,
seat routing, captured diff, and cross-vendor review—remain green.

The only successful-path addition is the required shallow probe call. It emits no cast bytes and
does not change `DispenseOptions`, result processing, effect behavior, or log shape.

## Test evidence

### Test-first red

```text
82 pass
2 fail
276 assertions
```

Failures were exactly:

- classifier returned timed-out instead of missing-capability;
- cast reached the fixture's forbidden dispense method.

This demonstrates the new tests exercised missing behavior rather than passing vacuously.

### Focused green

Command:

```bash
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
```

Result:

```text
84 pass
0 fail
297 assertions
```

### Full repository gate

Command:

```bash
bun run check
```

Result:

```text
BAML generation: pass
TypeScript: pass
1723 pass
1 skip
0 fail
5324 assertions
```

The one skip is the existing release-acceptance integration that requires built `dist/` artifacts.
It is unrelated to this ticket.

## Purity and architecture review

The outcome decision remains in `cast-core.ts`, taking plain returned data.

The core import is type-only, so it does not introduce executor effects at runtime.

The shell owns asynchronous probing, stdout, clock, persistence, and return assembly.

The executor boundary owns auth/config/endpoint fact gathering and expected-failure degradation.

The run log remains a passive sink and has no new executor dependency or schema field.

This preserves the project's pure-core/impure-shell rule.

## Scope review

The commit contains exactly:

```text
src/engine/cast-core.test.ts
src/engine/cast-core.ts
src/engine/cast.test.ts
src/engine/cast.ts
```

No doctor code was changed; the sibling consumer remains independent.

No Claude/OpenAI executor implementation or selection policy was changed.

No budget, TIER_BUDGET, funding, wallet, shelf, CLI, credential, sandbox, or retry behavior changed.

No package dependency, environment variable, generated API, persisted schema version, or migration
was added.

No ticket phase/status frontmatter was manually edited.

## Honest boundary

The successful shallow probe is not a guarantee that a later live dispense will succeed. Quota,
model availability after probing, transient races, and live completion behavior remain outside what
this story claims.

A non-timeout error from `dispense()` after an ok probe still propagates under the existing policy.
This is intentional: broadly relabeling arbitrary runtime/programming failures as missing capability
would hide defects.

The config-store/Keychain denial is fixture-proven here. The story's real denied-Keychain sandbox
verification remains deferred to the named field-report scenario.

The run log counts the refusal through outcome, zero usage/cost, and execution seat. It does not
persist free-form reason/hint fields because the current schema has no such contract and the story
assigns this ticket only the cast files. The cause and repair hint are present on the cast-time andon
surface, where the raw stack previously appeared.

The probe adds a near-zero-cost preflight I/O operation to every otherwise dispensable cast. That is
the intended story behavior; “byte-identical” applies to the successful cast's established output,
dispense arguments, settlement, and record rather than absence of the newly required probe action.

## Open concerns

No critical issue requires human attention.

The executor probe readers do not have a consumer-specific timeout in this ticket. A hanging probe
could delay the cast before the dispense timeout begins. This is inherited from dependency ticket
`T-074-01-01`, was explicitly noted in that review, and is not evidenced as a current failure.

If future product requirements demand durable diagnostic prose, a separately scoped run-log schema
change should add a typed failure-detail field rather than overloading play gate rows. This ticket
does not claim that feature.

## Working-tree handoff

All four ticket-owned source/test paths are committed and clean.

Remaining changes are Lisa-controlled attempt publication/transition state:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-074-01-03.md`;
- `docs/active/work/T-074-01-03/`.

They were not included in the source commit or altered through ordinary Git staging.

The assignment is complete through Review. Stop on this ticket and await Lisa's completion
publication/seat release.
