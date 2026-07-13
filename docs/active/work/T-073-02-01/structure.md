# T-073-02-01 — Structure

## Modified source files

### `src/engine/cast-core.ts`

Add:

- stable `CROSS_VENDOR_REVIEW_GATE` name;
- `settleCrossReview(base, review)` pure function;
- type-only access to the durable `CrossVendorVerdict` shape.

Keep:

- initial `classify` behavior unchanged;
- existing timeout/budget/play-gate precedence unchanged;
- all filesystem, registry, and executor concerns out of the module.

The new function returns the base object directly for absence and a fresh object for pass/fail.

### `src/engine/cast-core.test.ts`

Add a focused describe block for post-effect cross-review settlement.

Cases:

- no verdict is inert;
- pass retains success/materialization and appends passed evidence;
- fail relabels to `gate-failed`, retains materialization, and appends detailed failed evidence;
- pre-existing play gate rows remain ordered before the cross-review row.

### `src/engine/cast.ts`

Imports:

- `readFile` from `node:fs/promises`;
- `resolveComplementExecutor` and `ExecutorRegistry`;
- `dispenseReviewVerdict`;
- durable `CrossVendorVerdict` type;
- `settleCrossReview` from the pure core.

`CastOptions`:

- optional `crossReviewRegistry` injection seam.

Local orchestration values:

- optional durable `crossVendorVerdict`;
- base classifier verdict remains the effect authorization decision;
- settled verdict becomes the final outcome/gate-log decision.

Flow additions:

- after successful effect/diff capture, resolve complement;
- load captured patch;
- build rubric context;
- dispense review;
- map result to durable shape;
- settle outcome before warnings/log append;
- write `crossVendorVerdict` conditionally;
- log settled gate rows and return settled outcome.

Private helper:

- deterministic rubric-context formatter over play identity/summary and gate rows.

### `src/engine/cast.test.ts`

Add helpers:

- recording/primed reviewer executor factory or inline fixture;
- two-seat and one-seat registry fixtures;
- reusable cast helper only if it reduces duplication.

Add one table or three explicit test cases:

- refusing reviewer;
- passing reviewer;
- single-seat inertness.

Assertions cover:

- terminal `RunSummary` outcome;
- honest `materialized` value;
- captured diff presence;
- review call count and prompt content;
- raw ledger outcome;
- nested verdict exact shape;
- cross-review gate row;
- absence of verdict/row for one seat.

## Unchanged modules

### `src/log/run-log.ts`

No schema work. Existing `CrossVendorVerdict`, conditional normalization, serialization, and revival
are consumed as-is.

### `src/cross-review/review.ts`

No transport work. Existing `dispenseReviewVerdict` is invoked as the workflow operation.

### `src/cross-review/resolve-complement.ts`

No routing work. Existing optional registry parameter supplies the test seam.

### `src/engine/play.ts`

No per-playbook rubric field or effect transaction contract is introduced.

## Public-interface impact

- `CastOptions` gains one optional advanced injection field.
- The ordinary caller surface is source-compatible.
- `RunSummary` shape does not change.
- Existing cross-review types remain authoritative at their respective boundaries.
- No run-log schema version or outcome union changes.

## Dependency direction

```text
cast.ts (impure shell)
  -> cast-core.ts (pure settlement)
  -> cross-review/resolve-complement.ts (routing)
  -> cross-review/review.ts (review transport)
  -> run-log.ts (durable sink)

cast-core.ts
  -> type-only run-log contract
```

No cross-review module imports the cast shell. No log module imports workflow policy.

## Data shape mapping

```text
CrossReviewVerdict (review-core)
  pass { verdict, reviewingSeat }
  fail { verdict, reviewingSeat, reason }

          + local seatOfExecution
                    |
                    v

CrossVendorVerdict (run-log)
  { authoringSeat, reviewingSeat, verdict, detail? }
```

`reason` maps to durable `detail` only on fail. Authoring provenance comes from the actual resolved
executor id mapping, never from reviewer output.

## Ordering invariants

1. Initial classifier authorizes or refuses effect.
2. Effect lands only on initial authorization.
3. Diff capture runs only on successful reported effect.
4. Review runs only with known authoring seat, non-empty diff, and unique complement.
5. Settlement enforcement runs after optional review.
6. Ledger append happens once with final outcome and all evidence.
7. Summary returns the same final outcome written to the ledger.

## Failure behavior

- No complement: inert success path.
- No captured diff: inert success path.
- Reviewer returns valid fail: clean `gate-failed` settlement.
- Reviewer returns valid pass: clean success settlement.
- Reviewer transport/schema error: existing exception propagates; no fabricated ledger verdict.
- Effect failure/relabel: no review because no successful captured diff.

## Commit unit

One meaningful source unit spans the pure decision, cast composition, and their tests. These files
form one behavior that would be incomplete if split: the pure function alone is unused, while shell
composition without its truth-table proof violates the project pattern. Commit all four exact paths
with `lisa commit-ticket` after focused and full verification.
