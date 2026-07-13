# Design — T-078-02-01

## Decision summary

Export the existing `matchIds` helper unchanged, add one private function that conditionally appends
an unlabeled-charter explanation to an existing refusal reason, and apply it only to the ticket-level
empty-`advances` and dangling-P-reference branches.

The explanation will be:

`your charter has no labeled invariants (P1 — Author once, run forever...) — label them or cite none`

For a charter where `matchIds(charter, "P").size > 0`, the helper returns the original reason string
unchanged. This makes labeled-charter compatibility structural rather than editorial: the old literal
is still the returned value.

## Design goals

1. Teach the P-label convention at the first relevant refusal.
2. Name both the root cause and the operator action.
3. Preserve every gate verdict.
4. Preserve gate ordering and first-offense selection.
5. Preserve every refusal byte when the charter has at least one P-label.
6. Expose the already-settled detector for the two sibling story tickets.
7. Keep the implementation pure and local to the gate module.
8. Avoid interpreting or rewriting the charter.

## Option A — unconditional rewrite of the two refusal messages

This option would replace both legacy reasons with text that always discusses charter labels.

### Advantages

- Minimal branching.
- Every refusal would mention the convention.
- Easy to assert in tests.

### Disadvantages

- It violates the explicit byte-identical behavior for labeled charters.
- It is misleading when the charter has labels and one ticket simply omitted its claims.
- It turns a targeted cold-start diagnostic into generic noise.
- It would change settled operator-facing output and downstream gate log detail.

### Disposition

Rejected.

## Option B — add a new charter-convention gate

This option would add a gate ahead of value or bounds and stop any plan whose charter lacks labels.

### Advantages

- Centralizes charter convention validation.
- The error could be emitted independently of plan defects.
- It could make the convention globally explicit.

### Disadvantages

- The story explicitly forbids changing gate verdict logic.
- It would change `GATE_NAMES`, cleared-gate rows, and ordering.
- It could refuse plans that use allowed free-text `advances` values.
- It would turn a legibility ticket into a new blocking rule.
- The story assigns non-blocking proactive diagnosis to the doctor sibling, not this gate ticket.

### Disposition

Rejected as out of scope and contract-breaking.

## Option C — special-case only the value gate

This option would explain unlabeled charters only when `advances` is empty.

### Advantages

- Covers the normal post-normalization path.
- Requires only passing context into `valueGate`.
- Leaves bounds code unchanged.

### Disadvantages

- Direct gate callers still receive an opaque dangling-reference refusal.
- It fails the ticket’s explicit dangling-ref acceptance.
- Defense-in-depth behavior would teach less than the normal path.

### Disposition

Rejected as incomplete.

## Option D — conditional suffix at both refusal sites

This option keeps the legacy message as the base and appends an explanation only when the charter
contains zero P-labels.

### Advantages

- Meets both explicit refusal cases.
- Preserves existing bytes for labeled charters.
- Preserves verdicts, gate names, units, and ordering.
- Reuses the same detector that bounds already trusts.
- Keeps the new policy in one private helper.
- Makes the diagnostic text identical at both collision surfaces.
- Does not change free-text, non-goal, zero-ticket, or other gate behavior.

### Disadvantages

- `valueGate` must accept context.
- The detector may run once at value and again at bounds for a plan that gets that far.
- The resulting reason is longer for the targeted cold-start case.

### Assessment

The duplicate scan is over a small charter string and is insignificant. It also avoids threading a
new derived context type through every gate. The longer message is the requested teaching surface.

### Disposition

Chosen.

## Detector API decision

The public seam will be:

```ts
export function matchIds(text: string, prefix: "P" | "N"): Set<string>
```

This is exactly the current function with only the `export` modifier added.

### Why preserve the existing name

- The story and ticket identify `matchIds` as the seam to settle.
- Renaming would create unnecessary churn in the bounds gate.
- Sibling tickets can clearly request `matchIds(charter, "P")`.
- The name reflects that the helper detects both invariants and non-goals.

### Why preserve `Set<string>`

- Existing bounds logic consumes membership directly.
- Doctor can read `.size` for its labeled-invariant count.
- Init tests can read `.size` or membership.
- Deduplication is the current behavior and is useful for counts.
- Returning a readonly abstraction would be a broader API redesign.

### Why not make it P-only

- Existing bounds behavior also detects N-labels through the same helper.
- A P-only export would either duplicate N matching or alter existing internals.
- The closed prefix union prevents arbitrary regex interpolation.

## Diagnostic helper decision

Add a private helper with a shape equivalent to:

```ts
function explainUnlabeledCharter(reason: string, charter: string): string {
  return matchIds(charter, "P").size === 0
    ? `${reason}; your charter has no labeled invariants (...) — label them or cite none`
    : reason;
}
```

### Why append instead of replace

- The immediate defect remains clear.
- Existing terminology such as `advances`, `dangling ref`, and the cited code remains visible.
- Labeled behavior can return the unmodified legacy literal.
- Gate logs and operators retain the local failure before the root-cause guidance.

### Why a private helper

- Only the detector is required as a sibling seam.
- Exporting presentation text would freeze an API not requested by the story.
- Keeping policy local avoids coupling doctor or init wording to a gate-specific sentence.

## Value-gate integration

Change `valueGate(plan)` to `valueGate(plan, ctx)`.

Only the ticket-level empty/invalid `advances` branch uses the helper. The following remain exactly
as they are:

- zero-ticket plan reason;
- missing purpose reason;
- missing done signal reason;
- restated done signal reason;
- branch order.

The `GATES` entry changes from ignoring context to passing it through. The public `clear` signature
does not change.

## Bounds-gate integration

Keep invariant/non-goal set computation and claim classification unchanged.

Only the shaped-P/dangling branch wraps its existing reason in the helper. Non-goal claims keep the
old reason even if the charter has no P-labels, because that branch has a different actionable cause.
Free-text values continue to pass.

## Wording rationale

- “your charter” identifies the source of the convention mismatch.
- “no labeled invariants” names the cause rather than repeating the symptom.
- `P1 — Author once, run forever...` demonstrates both ID shape and label/prose relationship.
- “label them or cite none” states both valid operator choices without implying automatic repair.
- The wording follows the epic’s accepted direction and avoids schema jargon.

## Test design

### Detector contract

- Import `matchIds` as a value from `gates.ts`.
- Prove a charter with no P-tokens yields an empty set.
- Prove P and N selection remains prefix-specific and deduplicated.
- The import itself is a compile-time/public-export pin.

### Unlabeled charter behavior

- Create `UNLABELED_CTX` with ordinary charter prose and no `P\d+` token.
- Clear a ticket whose `advances` array is empty.
- Assert the unchanged gate and unit.
- Assert the exact new full reason.
- Clear an unnormalized ticket citing `P9`.
- Assert the unchanged bounds gate and unit.
- Assert the exact new full reason, retaining `P9` and `dangling ref`.

### Labeled charter compatibility

- Strengthen the existing empty-advances test to assert the exact legacy reason.
- Strengthen the existing dangling-reference test to assert the exact legacy reason.
- Keep the full pre-existing suite unchanged otherwise.
- The happy-path and every existing refusal test collectively pin verdict preservation.
- `bun run check` provides whole-repository regression coverage.

## Non-decisions

- No charter parsing beyond the existing token detector.
- No change to cite normalization.
- No change to snapshot semantics.
- No doctor or init work.
- No schemas, BAML, CLI, materialization, or logging changes.
- No new runtime dependency.
- No migration or auto-labeling.

## Design outcome

Option D is the smallest design that meets the operator-facing contract while making compatibility
explicit. It reuses the established pure detector, exposes that detector without semantic change,
and limits new wording to exactly the two failures caused or obscured by a zero-label charter.
