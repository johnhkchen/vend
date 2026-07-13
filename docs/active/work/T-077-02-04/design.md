# Design — T-077-02-04 degrade-on-run-record

## Decision summary

Carry cite degradation as optional, ordered plain data through four boundaries:

1. a new report-producing advances normalizer returns `{ plan, degrades }` while the existing
   `stripNonGoalAdvances` remains a plan-only compatibility wrapper;
2. the concrete decompose play keeps that report beside the plan, gates the plan, and merges its
   advances dispositions with the inline dispositions returned by `decomposeEffect`;
3. the generic `EffectResult`/`castPlay` boundary forwards the merged list to both `RunSummary` and
   the single terminal ledger append;
4. the run log normalizes and revives the optional list, while one pure CLI formatter renders
   `cleared; N cite(s) degraded` for successful degraded summaries.

Clean casts omit the field at every durable/public boundary. Structural refusals remain unchanged.

## Option 1 — Recompute advances dispositions in the effect

The effect could compare the normalized plan against the charter and infer what was removed.

Advantages:

- no change to the parsed output type;
- no generic parse-context metadata;
- all effect metadata originates at one boundary.

Rejected because:

- removed entries no longer exist in the normalized plan;
- the effect cannot reconstruct occurrence locations or order honestly;
- reparsing the raw executor reply in the effect would duplicate BAML work and violate the fixed
  parse-once cast spine;
- recomputation risks policy drift from the pure normalizer that actually made the decision.

## Option 2 — Mutate `CastContext` or use module-level side storage

The parse closure could push dispositions into a mutable context array or store them in a `WeakMap`
keyed by the returned plan.

Advantages:

- `Play<DecomposeInputs, WorkPlan>` could retain its current output type;
- minimal adaptations to gates and effect signatures.

Rejected because:

- parse would gain an invisible side effect;
- context is documented as a shared immutable input environment, not a settlement accumulator;
- weak side storage makes correctness depend on object identity through later normalization;
- neither approach serializes or composes as plain data;
- it violates the house preference for pure cores taking and returning plain values.

## Option 3 — Attach a metadata property to `WorkPlan`

The advances normalizer could return a structural intersection containing a private or symbol-keyed
degradation list.

Advantages:

- gates and effects could continue accepting a plan-shaped object;
- metadata would travel with the exact normalized value.

Rejected because:

- a string property risks leaking into cloning, serialization, or BAML-shaped consumers;
- a symbol property is invisible, fragile across spreads, and not plain durable data;
- the plan describes authored work, while dispositions describe how that plan was normalized;
- wrapper data makes the semantic boundary explicit and easier to test.

## Option 4 — Return a concrete decompose output wrapper

Selected. Introduce a concrete output such as:

```ts
interface DecomposeOutput {
  readonly plan: WorkPlan;
  readonly degrades: readonly DegradeDisposition[];
}
```

The real play becomes `Play<DecomposeInputs, DecomposeOutput>` internally:

- parse returns the report-producing normalizer result;
- gates receive `output.plan`;
- effect materializes `output.plan` and merges `output.degrades` before returning.

Advantages:

- explicit plain data with no hidden mutation;
- gates still judge exactly the normalized plan;
- effect receives the exact dispositions produced by the decision that stripped cites;
- no engine knowledge of BAML or charter policy;
- ordering can be defined once and tested.

Cost:

- the concrete play's output generic changes;
- its three closures require small adaptations;
- a named compatibility wrapper is needed for direct plan-only callers.

The cost is local to the concrete play and preferable to contaminating generic context or plan data.

## Advances normalization API

Add `stripNonGoalAdvancesWithDispositions(plan, charter?)` returning the wrapper report.

Behavior:

- preserve current plan normalization exactly;
- emit a `strip` disposition for every removed cite in ticket and entry order;
- location remains the already-settled `<ticket>.advances[<index>]` format;
- non-goal codes emit dispositions whether or not they resolve, because they are still editorially
  stripped from an `advances` claim;
- charter-unresolved codes use the shared classifier's exact disposition;
- clean, structural/free-text, and resolvable invariant entries emit none;
- preserve occurrence order and duplicates;
- never mutate the input.

Keep `stripNonGoalAdvances(plan, charter?)` as:

```ts
return stripNonGoalAdvancesWithDispositions(plan, charter).plan;
```

This preserves all current callers, including propose-related and gate tests.

## Merge ordering

The merged list is:

1. advances normalization dispositions in parsed ticket/index order;
2. inline materializer dispositions in rendered file/field/occurrence order.

This follows lifecycle order: parse normalization happens before gates and effect; inline
annotation happens during effect. No deduplication occurs because each occurrence is evidence.

If `decomposeEffect` returns a structural or validation failure after upstream advances were
stripped, the cast is not a cleared degraded cast. The generic effect may technically carry no
merged dispositions on failure; presentation and durable marker should only be attached to the
successful materialization result. Structural refusal remains categorically dominant.

## Generic disposition contract

The generic engine must not import the concrete play module. Add a structurally identical
`DegradeDisposition` contract at the log boundary and type `EffectResult.degrades` from that
contract, alongside its existing `RunOutcome` type import.

This is the repository's established duck-typing approach:

- the concrete play record is structurally assignable;
- the log owns the durable vocabulary and validation;
- the engine stays play-agnostic;
- there is no runtime dependency or duplicated policy logic.

The action vocabulary at the durable boundary is the same closed union `strip | annotate`.

## Run-log field

Add optional `degrades?: readonly DegradeDisposition[]` to `RunRecordInput` and `RunRecord`.

Normalization rules:

- only a nonempty array of complete valid entries survives;
- every entry must have a nonblank string code, nonblank string location, and action exactly
  `strip` or `annotate`;
- canonical copies retain only those three keys;
- if any entry is malformed, omit the entire optional field atomically;
- an empty array, absence, or non-array raw value is omitted;
- no charter resolution or code-family policy runs at the ledger boundary;
- valid code/location strings are preserved verbatim because they are effect provenance.

Atomic omission prevents a malformed subset from producing a dishonest smaller count. The base run
record remains readable, matching existing optional metadata compatibility behavior.

No schema-version bump is needed: this is an optional additive field, consistent with prior markers.

## Cast propagation

After the effect resolves, `castPlay` captures `reported.degrades` with other authoritative effect
facts. It then:

- prints no additional mid-settlement row; the terminal CLI summary is the operator surface;
- spreads the list into the one terminal `appendRunLog` call only when nonempty;
- returns the same list on `RunSummary` only when nonempty;
- retains it across later settlement work in the same way as seat disposition facts;
- does not add it to early pre-effect refusal records or summaries.

`RunSummary.degrades` carries full data rather than only a count so callers can inspect the same
truth the ledger stores. The CLI derives count without a second source of truth.

## CLI summary formatter

Add a pure exported `formatRunSummaryLine(summary)` helper in `src/cli.ts`.

For a successful summary with at least one disposition:

```text
run <id>: cleared; <N> cite(s) degraded (materialized: <boolean>)
```

For every other summary retain the existing byte shape:

```text
run <id>: <outcome> (materialized: <boolean>)
```

Use `cite(s)` literally because the acceptance criterion specifies that exact stable grammar.
Replace repeated final-summary templates in all CLI branches so chain, press, direct run, and other
cast surfaces stay consistent if a degraded summary flows through them.

## Structural-refusal preservation

- No `RunOutcome` values change.
- No gate code changes.
- No materializer refusal is weakened.
- A missing story contract still prevents effect execution and therefore records no dispositions.
- A plan stripped down to no actual advances still fails the value gate.
- A validation or graph failure does not print a cleared degradation summary.

## Test design

### Pure advances tests

- mixed known, non-goal, and dangling advances return the normalized plan plus exact ordered strip
  dispositions;
- duplicates remain occurrence-level;
- clean plans return an empty list;
- the compatibility wrapper remains plan-only and pure.

### Pure ledger tests

- exact mixed strip/annotate list builds, serializes, revives, and reads through `readRuns`;
- canonical copies drop extra nested keys;
- empty/absent fields preserve old bytes;
- malformed entry or raw non-array omits the entire optional marker without losing the row.

### Cast/story acceptance test

- update the addon-free real-gates/real-materializer fixture to return effect degrades;
- include both one stripped advances cite and unresolved inline prose cites;
- assert `RunSummary.degrades` exact data;
- assert `loadRunLog(...).records[0].degrades` exact data after filesystem round-trip;
- assert the summary formatter contains `cleared; N cite(s) degraded`;
- keep the missing-story-contract contrast red with zero files and no marker.

### CLI formatter tests

- degraded successful summary renders the exact phrase and newline;
- clean success and refusal retain existing outcome copy.

### Verification

- focused tests for core, log, cast fixture, and CLI;
- typecheck/build;
- full `bun run check`;
- `git diff --check` and ticket-path cleanliness before and after exact Lisa commits.

## Rejected scope

- No progress-line relabeling.
- No new run outcome such as `degraded`.
- No second JSONL record or sidecar file.
- No live metered cast.
- No repair loop or user prompt.
- No changes to structural gates.

## Design conclusion

An explicit concrete-play wrapper closes the only missing pre-effect data path. Additive structural
fields then follow the repository's established effect-to-terminal-ledger pattern. This keeps the
decision pure, the shell thin, the ledger local and durable, and the operator summary derived from
the same occurrence-level evidence returned by the effect.
