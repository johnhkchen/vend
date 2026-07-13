# T-073-02-02 — Review

## Outcome

PASS. The ticket acceptance criterion is met.

A new hermetic end-to-end test performs an intentionally bad cast and a good contrast cast through
the real production cross-review settlement pipeline. The primed complement refuses the bad patch,
which settles as `gate-failed` with its reasoned cross-vendor verdict on the same ledger line. The
good patch settles as `success` with its passing verdict attached. Both paths are fully awaited and
contain no human approval step.

## Source change

Created:

- `src/engine/cross-review-refusal.e2e.test.ts`

Modified production files:

- None.

Deleted files:

- None.

The source unit was committed through `lisa commit-ticket` with exactly one include path.

Commit:

```text
85e783058621f57b18b2526e0451cf89937b7746
test(engine): prove cross-review refusal end to end
```

## What the proof exercises

The test retains these real boundaries:

- `castPlay` orchestration;
- play rendering and parsing;
- ordinary gate evaluation;
- effect execution and artifact reporting;
- temporary-project filesystem writes;
- Git patch capture and `.vend/artifacts` persistence;
- complement executor resolution;
- context-complete review prompt construction;
- one-turn review dispense contract;
- strict structured verdict parsing;
- cross-review gate settlement;
- final `RunSummary` outcome;
- one-record-per-cast JSONL append.

Only the external vendor transports are replaced with typed executor doubles. Both doubles report
zero usage and cost, so the test is deterministic, local, free, and credential-independent.

## Acceptance mapping

### Intentionally bad diff is cast

The play effect writes this recognizable defective evidence into a real artifact:

```ts
export const acceptanceProof = false; // intentionally missing required proof
```

The artifact is reported to the generic cast shell. Production Git capture creates a non-empty
patch reference at `.vend/artifacts/cross-review-bad.diff`.

The test inspects the actual complement call and asserts its prompt contains those patch bytes.
This proves the stub received the diff rather than merely a label saying “bad.”

### Complement stub refuses

The configured capability set contains authoring id `claude` and complement id
`openai-compat`. Production seat mapping resolves those to authoring seat `claude` and reviewing
seat `codex`.

The complement is primed with:

```json
{"verdict":"fail","reason":"required acceptance proof is false"}
```

The test asserts one-turn review configuration and the authored play purpose in the review prompt.

### Bad run is blocked from clearing

The returned bad-run summary is asserted as `gate-failed` and explicitly not `success`.

The first ledger line is asserted to contain:

- run id `cross-review-bad`;
- outcome `gate-failed`;
- execution seat `claude`;
- the captured diff reference;
- a passing `fixture-contract` row;
- a failing `cross-vendor-review` row with the exact refusal reason;
- the complete FAIL verdict with Claude/Codex provenance and matching detail.

The effect necessarily lands before review because the concrete Git patch is the review evidence.
`materialized` therefore remains an honest physical fact; the final settlement is nevertheless not
a clear. No rollback behavior is claimed or introduced.

### Good diff clears with verdict attached

The second cast overwrites the same artifact with:

```ts
export const acceptanceProof = true; // required proof present
```

The test asserts the second complement prompt contains these current corrected patch bytes. The
stub is primed with `{"verdict":"pass"}`.

The returned summary is `success`. The second ledger line contains:

- run id `cross-review-good`;
- outcome `success`;
- execution seat `claude`;
- its captured diff reference;
- passing ordinary and cross-vendor review gate rows;
- the complete PASS verdict with Claude/Codex provenance;
- no fabricated verdict detail.

### No human approval in the loop

Both casts run as ordinary awaited function calls from author executor through complement verdict
to durable ledger append. There is no callback, prompt, input read, approval flag, or manual branch.
The failed structured gate verdict autonomously determines the bad run's final outcome.

## Ledger integrity

The test uses one shared ledger and asserts exactly two ordered JSONL records. This guards against:

- a refused cast silently clearing on another line;
- verdict data being detached from the settled run;
- duplicate appends;
- a good run losing its passing review evidence;
- seat provenance being fabricated or omitted.

## Verification

Focused command:

```bash
bun test src/engine/cross-review-refusal.e2e.test.ts
```

Result:

```text
1 pass
0 fail
17 expect() calls
```

Repository gate:

```bash
bun run check
```

Result:

```text
BAML generation passed
TypeScript typecheck passed
1693 tests passed
1 expected guarded test skipped
0 tests failed
5248 assertions across 114 files
```

The existing skip requires prebuilt release `dist/` artifacts and is unrelated to this change.

## Coverage assessment

Coverage is proportionate and layered:

- This ticket adds the broad bad/good end-to-end demonstration.
- Dependency coverage pins pure `settleCrossReview` policy.
- Existing cast integration coverage pins fail, pass, and inert branches separately.
- Cross-review unit coverage pins prompt/reply parsing and malformed-reply behavior.
- Run-log coverage pins verdict normalization, serialization, omission, and revival.

The new test intentionally does not duplicate malformed replies, timeouts, ambiguous registries, or
single-seat behavior because those have focused ownership elsewhere and are not this acceptance
criterion.

## Scope and architecture review

- Pure-core/impure-shell boundaries remain unchanged.
- No production policy or API was added for test convenience.
- The test uses the existing executor interface and registry injection seam.
- P3 is advanced by demonstrating a refusal that cannot settle as clear.
- P4 is preserved because the gate acts autonomously with no supervision step.
- P5 is respected by using local filesystem/Git state and no network.
- P6 is exercised by distinct authoring and complement executor ids behind the common interface.
- P7 is not obscured: a high explicit envelope isolates the gate decision, and stubs report zero burn.

## Open concerns and limitations

No blocking concerns remain.

Honest limitations:

- The reviewer is a primed stub; it does not semantically infer badness from arbitrary code.
- This proves orchestration, enforcement, and persistence, not live second-vendor quality/parity.
- The live metered proof remains deliberately deferred by the parent story.
- Review occurs after materialization because a concrete patch is its input; refusal blocks final
  clearing but does not roll back the physical effect.

These limitations match the parent story's honest boundary and do not weaken this ticket's stated
acceptance criterion.

## Repository state handoff

- Ticket-owned source is committed and clean.
- No ordinary-index staging remains.
- Lisa-managed changes to the ticket/provenance and published work directory remain outside the
  ticket source commit as required.
- All six private RDSPI artifacts are complete.

The ticket is ready for Lisa's completion publication. Remain on `T-073-02-02`; do not start
another ticket until Lisa confirms the completion commit.
