# Design — T-081-02-01

## Objective

Make the live progress fold measure the same weighted spend the terminal budget meter settles,
while preserving a useful mid-cast estimate and counting only the parent agent-loop proxy that the
configured turn cap bounds.

The design must be pure, total over external JSON, fixture-proven, and limited to the existing
`CastProgress` seam.

## Evidence-driven requirements

The completed forensics spike rules out several guesses and establishes the inputs available to a
fix:

- duplicate assistant endpoint usage is unchanged on the captured token run;
- assistant-only accounting yields 104,807 weighted units;
- explicit thinking deltas add 77,095 weighted units during the run;
- 32,720 weighted units remain visible only in cumulative terminal usage;
- the terminal result and ledger both meter to 214,621;
- non-null `parent_tool_use_id` identifies all 33 assistant IDs that inflate the parent turn
  observable from 12 to 45;
- sidechain assistant rows currently add to both `turns` and `weightedTokens`.

The result must therefore address incremental thinking, exact terminal reconciliation, sidechain
admission, and operator-facing naming as one coherent fold policy.

## Option A — Keep assistant-only estimation and replace on terminal usage

Continue charging the first assistant event per ID. Ignore thinking records. When a result with a
valid usage object arrives, replace `weightedTokens` with `countTokens(result.usage)`.

### Advantages

- Smallest code change.
- Final replay agrees exactly with the ledger.
- Uses the same terminal input and canonical function as the budget check.
- Cannot double-charge cumulative result usage.

### Costs

- The captured line remains near 105k for most of the run even though 15,419 observable thinking
  tokens have already streamed.
- The number only becomes meter-true on the terminal record, producing the full ~2× jump at the
  end.
- It satisfies the final fixture assertion but weakly satisfies the story's “operator allocates by
  mid-cast” intent.

### Decision

Rejected as incomplete. Terminal reconciliation is necessary but not sufficient when an explicit
incremental signal is already present.

## Option B — Add thinking deltas, then replace on terminal usage

Use three ordered record policies after excluding sidechains:

1. first assistant event per ID adds canonical weighted usage and increments the parent turn;
2. `system/thinking_tokens.estimated_tokens_delta` adds canonical output-weighted spend;
3. `result.usage` replaces `weightedTokens` with the canonical cumulative total.

### Advantages

- The captured mid-cast estimate rises from 104,807 to 181,902 before terminal settlement.
- The remaining 32,719/32,720 rounding-scale gap closes exactly on terminal result usage.
- Incremental and cumulative fields are never added together as though both were deltas.
- The terminal state uses the exact same `countTokens` computation as the budget check and ledger.
- No extra state or shell wiring is required.
- The current first-assistant-event dedup policy remains valid and stable.

### Costs and edge behavior

- A run may display a correction downward if incremental estimates exceed terminal truth. That is
  honest reconciliation, not monotonicity.
- A multiplexed Claude transcript can emit sidechain result rows without a non-null parent marker.
  Each cumulative result can temporarily replace the display before the final parent result. The
  captured ordering ends with the authoritative parent result, so final agreement is exact.
- Thinking deltas are executor-specific stream hints. Unknown executors that do not emit them
  continue through assistant snapshots and terminal usage.

### Decision

Chosen. It best satisfies both the mid-cast and terminal parts of the contract using observed
fields and the existing pure core.

## Option C — Accumulate raw usage buckets in `CastProgress`

Expand `CastProgress` with input/output/cache bucket state. Merge assistant snapshots and thinking
deltas into those buckets, then replace every bucket from terminal usage before deriving weighted
spend.

### Advantages

- Preserves raw bucket detail for diagnostics.
- Could defer rounding to one aggregate calculation.
- Creates room for richer future UI.

### Costs

- Changes the public progress state and every caller/test for information no current surface uses.
- Per-ID assistant rounding would change before terminal settlement relative to current behavior.
- Bucket merging does not solve the terminal-only residual; replacement is still required.
- Richer diagnostics and schema are outside this story.

### Decision

Rejected as unnecessary expansion. The ticket needs one canonical weighted number, not a second
usage ledger inside the progress state.

## Option D — Derive live spend only from terminal result usage

Ignore assistant and thinking records and leave the line at zero until a result arrives.

### Advantages

- Every non-zero figure is authoritative.
- Simplest semantic model.

### Costs

- Eliminates the live progress feature for the duration of a run.
- Violates the story's operator-facing purpose.
- Regresses existing behavior and tests without need.

### Decision

Rejected.

## Sidechain admission decision

Define one conservative top-level predicate: a message is a sidechain when
`parent_tool_use_id` is neither `null` nor `undefined`.

Apply it before every incremental fold branch. This means:

- sidechain assistant rows do not increment `turns`;
- sidechain assistant usage does not increment `weightedTokens`;
- sidechain thinking deltas with the marker do not increment `weightedTokens`;
- a future explicitly marked sidechain result does not reconcile parent progress.

Malformed non-null marker values also degrade to exclusion. External data should not be allowed to
inflate the parent budget/cap display merely because its marker is not the expected string shape.

Null and absent markers remain main-stream records. This matches both captured fixtures.

The forensics transcript's result rows all carry null markers, including nested results whose
origin cannot be reconstructed from the available fields. The fold cannot truthfully classify
those rows. It accepts them as cumulative observations in stream order; the final parent result
reconciles the final state to ledger truth. Inventing result-to-sidechain correlation is rejected.

## Thinking-delta decision

Admit only records satisfying all of:

- `type === "system"`;
- `subtype === "thinking_tokens"`;
- `estimated_tokens_delta` is a finite, non-negative number;
- the record is not a sidechain.

Convert the delta through `countTokens({ output_tokens: delta })` rather than duplicating the
output weight. This preserves the canonical meter as the one source of weighting and rounding.

Zero deltas and invalid values are no-ops that preserve state identity. Negative estimates are
not meaningful spend and cannot reduce the meter.

## Terminal reconciliation decision

Admit a non-sidechain `type === "result"` record only when `usage` is a non-array object. Compute
`countTokens(usage)` and replace `weightedTokens` with that value.

Do not modify:

- `turns`;
- `seenMessageIds`.

The terminal result is not an assistant turn. Replacement prevents cumulative usage from being
double-charged on top of assistant/thinking estimates.

If the canonical value already equals the current value, return the existing state by identity.
This retains the fold's no-op discipline.

## Tolerance decision

Export a named constant:

```ts
CAST_PROGRESS_LEDGER_TOLERANCE = 0
```

Its unit is weighted tokens. Zero is warranted because the final fold and ledger both call the
same `countTokens` function on the same terminal usage object. A non-zero tolerance would hide a
defect rather than model unavoidable measurement error.

The fixture test will assert both the constant's value and:

```text
abs(progress.weightedTokens - ledgerTotalTokens) <= tolerance
```

This states the acceptance relationship directly while pinning exact agreement.

## Label decision

Change the progress segment from:

```text
210k/500k tokens
```

to:

```text
210k/500k weighted tokens
```

“Weighted tokens” is compact enough for the refreshing terminal row and distinguishes the
fresh-input-token-equivalent meter from raw throughput tokens. It applies to numerator and
denominator because `Budget.tokens` is denominated in the same canonical unit.

The existing `(detect-after)` suffix remains attached to this segment and keeps the same strict
greater-than comparison.

## Fixture and test design

Commit sanitized evidence below `src/engine/fixtures/T-081-02-01/` so production tests do not
depend on Lisa attempt storage or unpublished docs artifacts.

The directory will contain:

- the 19-row token-spend excerpt;
- the 50-row sidechain-turn excerpt;
- a short provenance/sanitization README.

Tests will parse JSONL with `Bun.file` relative to `import.meta.dir` and replay it through the real
fold.

The token test will pin:

- pre-terminal assistant-plus-thinking state = 181,902;
- terminal state = 214,621;
- nine parent turns;
- named tolerance = zero;
- absolute ledger difference within tolerance;
- exact rendered “weighted tokens” label.

The sidechain test will pin:

- 12 main and 33 sidechain fixture IDs;
- final parent turn count = 12 rather than 45;
- sidechain IDs absent from `seenMessageIds`;
- a synthetic non-zero sidechain assistant changes neither weighted spend nor turns;
- marked sidechain thinking/result records are no-ops.

Existing formatter and shell-output expectations must update to the new label. No shell behavior
changes.

## Rejected scope

- No change to `cast.ts` control flow.
- No change to ledger schema or `turnsUsed`.
- No budget-check change.
- No raw-usage bucket state.
- No new executor interface field.
- No funded live cast.
- No reconstruction of nested result ownership without evidence.

## Expected outcome

On the captured steer transcript the fold will show 181,902 weighted tokens after all explicit
incremental observations, then settle to exactly 214,621 on the terminal result. On the captured
sidechain transcript it will count 12 parent assistant IDs and exclude all 33 marked sidechain IDs
from both spend and turns. The formatter will name the shared numerator/denominator unit as
weighted tokens.
