# Design — T-076-02-01

## Decision summary

Catch failures only around `dispenseReviewVerdict` inside the relevant, resolved-reviewer branch.
Translate the failure into plain structured data, settle the base verdict as
`missing-capability`, print one amber andon, and continue through the ordinary run-record and
summary path.

The caught result preserves the already-landed effect and captured diff. It does not mint a
cross-vendor pass/fail verdict, does not append a cross-review gate row, and does not reuse the
`crossReviewSkipped` marker.

## Operational-failure state

Add a cast-local failure value with four human-facing facts:

```ts
interface CrossReviewFailure {
  reviewingSeat: string;
  endpointCategory: string;
  cause: string;
  hint: string;
}
```

The seat comes from `ComplementExecutor.seat`, the same trusted routing fact used by valid
verdicts. The endpoint category comes from the resolved executor's stable ID. The cause comes from
the caught value's message, not its stack. The hint is selected from the endpoint category.

This value remains local to the impure cast shell because the current durable schema has no
operational-review-failure payload. The durable contract is the existing terminal outcome.

## Pure settlement decision

Add a pure `settleCrossReviewFailure(base)` helper in `cast-core.ts`:

```ts
return { ...base, outcome: "missing-capability" };
```

This helper preserves `materialize`, `gateLog`, and any over-envelope marker. Those are already
observed or authorized facts. Only the terminal settlement classification changes.

Keeping this judgment in the pure core follows the repository's pure-core/impure-shell rule and
makes the intended post-effect semantics explicit in a focused test.

Do not extend `settleCrossReview`'s valid-verdict parameter with an operational failure. A
transport/schema failure is not a `CrossVendorVerdict`; keeping distinct functions prevents a
future caller from confusing “reviewer found a defect” with “reviewer could not answer.”

## Catch boundary

The `try/catch` wraps exactly the await of `dispenseReviewVerdict` and the mapping of its valid
return into `crossVendorVerdict`.

It does not wrap:

- resolution of the reviewer;
- loading the captured diff;
- effect execution;
- diff capture;
- ordinary settlement rendering;
- run-log append.

Those broader failure guarantees belong to `T-076-02-02`. This ticket catches the named reviewer
failure classes because they all emerge from `dispenseReviewVerdict`:

- connection/fetch rejection;
- executor timeout;
- malformed terminal response (`CrossReviewResponseError`).

The catch stores `crossReviewFailure` and falls through. It does not return early, ensuring the
ordinary record path retains usage, cost, effect facts, and captured diff.

## Endpoint categories

Use a total pure mapping from executor ID to plain words:

- `openai-compat` → `OpenAI-compatible endpoint`;
- `claude` → `Claude Code executor`;
- any other non-empty ID → `executor '<id>' endpoint`;
- blank ID → `reviewer endpoint`.

The field-reported case therefore reads naturally as reviewer seat `codex` at an
OpenAI-compatible endpoint, rather than leaking only the internal selector ID.

This mapping belongs in `cast.ts` as presentation policy unless a reusable consumer emerges. It
takes a plain string and has no effects.

## Cause rendering

For `Error` instances, use trimmed `error.message`.

For other thrown values, attempt `String(value)` and trim it. If conversion itself fails or the
result is blank, use `review dispense failed without an error message`.

Never use `.stack`, `console.error`, or rethrow the caught value. This makes the live surface one
controlled andon line with no raw stack.

## Fix hints

For the OpenAI-compatible endpoint category, print:

```text
verify VEND_OPENAI_BASE_URL is reachable and VEND_OPENAI_API_KEY contains valid bearer auth when
required; run `vend doctor`
```

This reuses the concrete variables already documented by the adapter and points to the reviewer
dispensability preflight added by `T-076-03-01`.

For other executors, print a generic action:

```text
check the <seat> reviewer's local configuration, authentication, and endpoint reachability; run
`vend doctor`
```

The hint changes no state and does not attempt a retry or credential repair.

## Andon surface

After pure settlement, print exactly one controlled line in the established shape:

```text
· andon: missing-capability — reviewer seat '<seat>' failed at <endpoint category>: <cause> — <hint>
```

This names:

- the existing andon family;
- the trusted reviewer seat;
- the plain endpoint category;
- the immediate error cause;
- an actionable repair.

Do not print the ordinary `gate-failed` review line because no valid fail verdict exists.

## Durable behavior

The ordinary append receives:

- `outcome: "missing-capability"`;
- the primary cast's real usage and cost;
- the original play-gate rows only;
- `materialized` represented on the returned summary as true when the effect landed;
- `capturedDiff` retained;
- no `crossVendorVerdict`;
- no `crossReviewSkipped`.

The ledger currently has no `materialized` field; its captured diff and outcome remain the durable
evidence available in this slice. The following story ticket strengthens general record survival.

## Successful review compatibility

The successful path executes the same statements as before:

1. await `dispenseReviewVerdict`;
2. map its trusted pass/fail value to `crossVendorVerdict`;
3. call the existing `settleCrossReview`;
4. print the existing fail andon only for a valid fail;
5. append the existing verdict and gate evidence;
6. return the existing summary.

No valid verdict shape, prompt, timeout calculation, gate name, detail mapping, record field, or
summary field changes. The new failure state remains undefined on both valid arms.

## Test strategy

Add a pure core test proving `settleCrossReviewFailure`:

- returns `missing-capability`;
- preserves `materialize: true`;
- preserves existing gate rows;
- preserves the over-envelope marker.

Add a cast integration test with:

- a temporary Git repo;
- the existing file-writing fixture play;
- a successful primary Claude stub;
- an explicit two-seat registry;
- an `openai-compat` reviewer whose `dispense` throws `ConnectionRefused` text;
- captured stdout.

Assert:

- the awaited cast resolves rather than rejects;
- summary outcome is `missing-capability`;
- materialization and captured diff remain honest;
- stdout has the andon prefix, `codex`, `OpenAI-compatible endpoint`, cause, and fix hint;
- stdout has no `Error:` or stack-frame text;
- exactly one ledger line exists with `missing-capability`;
- no cross-vendor verdict or skipped marker exists;
- gate rows remain the original play rows.

Retain the existing passing and refusing review tests unchanged as byte-shape regression oracles.
Run focused tests, typecheck, whitespace checks, then the complete repository gate.

## Alternatives considered

### Probe the reviewer before every dispense

Rejected for this ticket. Doctor already exposes a reviewer probe, but a probe cannot guarantee the
subsequent live call succeeds or returns valid schema. The failing call still needs settlement.

### Convert the error into a failed CrossVendorVerdict

Rejected. That would falsely claim the reviewer found a blocking code defect and would produce a
misleading failed review gate row.

### Mark the review as skipped

Rejected. A reviewer did resolve and was invoked. `crossReviewSkipped` specifically records inert
resolution, so reusing it would erase a materially different failure.

### Return early like the primary executor andon

Rejected. This occurs after primary usage, effect, and diff capture. Early bespoke logging would
duplicate the settlement record assembly and risk dropping already-observed facts.

### Add run-log cause and hint fields

Rejected for this narrow slice. The ticket cites the E-074 precedent, whose ledger contract is the
named countable outcome while stdout carries repair prose. Schema work would expand ownership and
successful record bytes.

### Catch all settlement errors

Rejected because `T-076-02-02` explicitly owns the general invariant. A broad catch here would
preempt its design and conceal unrelated defects without an agreed classification.

## Acceptance mapping

- Throwing reviewer becomes a resolved cast and recorded `missing-capability` outcome.
- Awaited integration plus the durable line proves there is no unhandled rejection.
- Captured stdout proves one amber andon and no stack.
- Trusted seat plus executor-ID category provide plain reviewer/endpoint naming.
- Category-specific hint provides a concrete fix.
- Existing valid pass/fail tests prove E-073 semantics remain intact.
- Full `bun run check` closes the repository gate.
