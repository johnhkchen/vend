# T-073-02-01 — Design

## Decision

Compose cross-review in `castPlay` after a successful effect has yielded a captured diff, then pass
the optional durable verdict through a new pure settlement function. The settlement function adds
one named gate row and changes a failed review's terminal outcome to `gate-failed`. A pass retains
success. Absence returns the original settlement byte-for-byte in shape.

## Pure settlement contract

Add a pure function conceptually shaped as:

```ts
settleCrossReview(base: Verdict, review: CrossVendorVerdict | undefined): Verdict
```

Behavior:

- `undefined`: return the base verdict unchanged;
- `pass`: preserve outcome/materialization/warnings and append a passed `cross-vendor-review` row;
- `fail`: preserve materialization/warnings, force outcome `gate-failed`, and append a failed row;
- failure detail becomes the failed gate row detail when present;
- durable nested verdict remains separate and is forwarded by the shell.

The function accepts the run-log-local structural verdict type through a type-only import. It does
not resolve seats, read files, call executors, or mutate the base value.

## Why post-effect settlement

The reviewer needs a Git patch. That patch is produced from the effect's reported artifacts, so
review cannot precede effect without redesigning every play into a dry-run transaction. The current
architecture has no rollback protocol and the story does not authorize one. The honest semantics
are therefore:

- original gates authorize the effect;
- effect lands and reports artifacts;
- diff capture produces review evidence;
- complement review decides whether the run clears settlement;
- FAIL records `gate-failed` even though `materialized` truthfully remains true.

This blocks the clearing-house success outcome without pretending already-written files vanished.

## Cast composition

After effect and diff capture:

1. Resolve a complement from `seatOfExecution`.
2. Use an optional injected registry from `CastOptions`; default to built-ins.
3. If either complement or captured diff is absent, do nothing.
4. Read the repository-relative captured diff from the project root.
5. Render deterministic rubric context from the play name, summary, and original gate rows.
6. Call `dispenseReviewVerdict` with the remaining cast timeout.
7. Map its trusted reviewing seat and reason to durable `CrossVendorVerdict`.
8. Apply the pure settlement function.
9. Append both the settled gate rows and nested verdict to the one ledger record.
10. Return the settled terminal outcome.

## Registry injection

Add optional `crossReviewRegistry?: ExecutorRegistry` to `CastOptions`.

This is workflow test/configuration injection, not a new counter gesture. Production callers omit
it and use the configured built-in registry. Tests supply a two-seat or one-seat map whose factories
return deterministic stubs. The authoring executor itself remains independently injectable through
the existing `executor` option.

## Rubric context

No new `Play` field is added because per-playbook rubric authoring is explicitly out of scope. The
available authored judgment is represented by:

- play name;
- required play summary;
- original per-gate rows and their pass/fail details.

A small deterministic formatter in the cast shell is sufficient. This context tells the reviewer
what operation is being judged and which authored gates were cleared, without inventing acceptance
criteria unavailable to the generic engine.

## Outcome and materialization semantics

For a failed cross-review:

- `RunSummary.outcome` is `gate-failed`;
- ledger `outcome` is `gate-failed`;
- ledger carries the failed nested verdict;
- ledger gate rows include `{ gate: "cross-vendor-review", passed: false, detail }`;
- `RunSummary.materialized` remains true if the effect landed;
- captured diff remains surfaced for audit.

For pass, outcome remains success and the passed row plus nested verdict are attached.

For no complement, no diff, or unknown authoring seat, all cross-review fields/rows are absent.

## Options considered

### Extend initial `classify` with a review argument

Rejected as the only mechanism because initial classification occurs before effect/diff capture.
It would either require a nonexistent verdict or reorder the architecture impossibly.

### Run review before the effect

Rejected because there is no patch yet. Reviewing parsed model text is not the story's diff review.

### Roll back artifacts after FAIL

Rejected. Effects are arbitrary, may include non-file operations, and have no transaction/undo
contract. Git checkout/reset would be destructive in the shared repository and violates scope.

### Put enforcement in `run-log.ts`

Rejected because the ledger is a normalization/persistence sink. Deriving outcome there would mix
workflow policy into append-only storage and leave `RunSummary` inconsistent.

### Convert the reviewer verdict into a `GateVerdict` and rerun `classify`

Viable but awkward: `classify`'s `materialize` means “authorize the effect,” while this decision
occurs after materialization. Reusing it would return `materialize: false`, contradicting physical
fact and invite accidental second-effect control flow. A named post-effect settlement function is
clearer.

### Treat malformed reviewer output as FAIL

Rejected. Upstream deliberately distinguishes schema/transport failure from an adversarial defect.
This ticket preserves that honest error behavior rather than fabricating a verdict.

### Add review usage to the run's cost

Rejected as out of contract. The upstream story explicitly left review metering out of the durable
verdict, and this ticket's proof is stubbed/free.

## Test design

Pure tests:

- absent review returns the original verdict unchanged;
- pass preserves success and appends a passed row;
- fail forces `gate-failed`, preserves honest materialization, and appends reason detail;
- existing rows remain in order before the cross-review row.

Cast tests:

- temp Git project plus writing play produces a captured diff;
- author stub id maps to `claude`;
- injected complement registry resolves `openai-compat`/`codex`;
- fail stub receives the patch/rubric and returns a refusal;
- summary and ledger settle `gate-failed`, not success;
- ledger retains nested verdict and failed gate row;
- pass stub settles success with nested verdict and passed row;
- one-seat registry performs no review and retains the prior success/absence behavior.

## Scope integrity

The design adds no new executor, prompt conversation, human approval, play authoring schema, live
network proof, rollback mechanism, or release bake-off. It composes the already-landed S-073-01
pieces at the generic cast boundary and makes their verdict enforce settlement autonomously.
