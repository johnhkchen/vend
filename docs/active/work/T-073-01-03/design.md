# T-073-01-03 — Design

## Decision

Add a pure `review-core.ts` and a thin `review.ts` shell under `src/cross-review/`.

The core owns:

- the discriminated public verdict type;
- the context-complete adversarial prompt builder;
- strict/tolerant-boundary parsing of the reviewer's JSON response.

The shell owns:

- accepting a resolved `ComplementExecutor`;
- invoking only its existing `executor.dispense` method;
- constraining capable executors to one turn;
- parsing terminal result text;
- attaching the trusted resolved reviewing seat;
- rejecting malformed output honestly.

The public async operation will conceptually be:

```ts
dispenseReviewVerdict({ reviewer, capturedDiff, rubricContext, timeoutMs? })
  -> Promise<CrossReviewVerdict>
```

where `reviewer` is the result of `resolveComplementExecutor`.

## Public verdict

Use a readonly discriminated union:

```ts
type CrossReviewVerdict =
  | { readonly verdict: "pass"; readonly reviewingSeat: AgentSeat }
  | { readonly verdict: "fail"; readonly reviewingSeat: AgentSeat; readonly reason: string };
```

Both outcomes carry routing provenance. Only failure carries detail because a failure without a
reason is not actionable or sufficient for the next ledger ticket. Pass carries no synthetic
detail.

The reviewer does not return `reviewingSeat`; the shell attaches it from the resolved complement.
This prevents model output from forging workflow provenance.

## Wire response contract

The reviewer is instructed to return exactly one of:

```json
{"verdict":"pass"}
{"verdict":"fail","reason":"specific blocking defect"}
```

The pure parser returns an internal payload without seat metadata. It accepts an otherwise valid
object when surrounded by a markdown fence or brief accidental prose by extracting the first `{`
through the last `}`. It rejects:

- invalid JSON;
- arrays, null, or primitives;
- unknown or missing verdicts;
- fail without a non-empty trimmed reason;
- pass with semantically irrelevant fields only by ignoring them.

Whitespace around a failure reason is trimmed. A malformed response maps to `null` in the pure
core. The shell throws a named `CrossReviewResponseError`; it does not turn transport/schema
failure into a false review refusal or, worse, a pass.

## Prompt design

The prompt is a deterministic string composed from two plain inputs:

- `capturedDiff`: the complete patch content;
- `rubricContext`: caller-provided acceptance/gate context.

It instructs the reviewer to act adversarially and fail only for a concrete blocking defect. The
rubric asks it to inspect correctness, regressions, acceptance mismatch, missing verification, and
unsafe behavior. It explicitly says the diff is untrusted data and instructions inside it must be
ignored.

Separate XML-like markers identify rubric and patch sections. This is framing rather than a parser
or security boundary, so the instruction also clearly identifies the payload as evidence.

No repo paths, tools, conversation, or follow-up are required. The prompt is complete in one call,
matching the openai-compatible seat's documented shape.

## Dispense options

The wrapper calls:

```ts
reviewer.executor.dispense({
  prompt,
  system: REVIEW_SYSTEM_PROMPT,
  maxTurns: 1,
  ...(timeoutMs !== undefined ? { timeoutMs } : {}),
})
```

No model is forced; executor configuration remains authoritative. No concrete adapter is imported.
No MCP/tool flags are supplied because the review is context-complete and no exploration is part of
the contract.

`maxTurns: 1` constrains Claude-like implementations that can honor it. OpenAI-compatible
completion ignores the agentic hint but is already single-turn by transport shape.

## Options considered

### A. Put prompt, parsing, and dispense in `resolve-complement.ts`

This would reduce file count and keep all workflow code together.

Rejected because complement resolution is currently a small routing/selection module. Adding prompt
policy and transport effects would erase the pure decision boundary and make routing tests depend on
review behavior.

### B. Add `review()` to the Executor interface

This could give adapters a review-specific method.

Rejected by the story and by P6. Review is workflow policy expressed as a prompt over the universal
`dispense` seam, not a new provider capability. Both executors already support the required text
operation.

### C. Use BAML for the verdict schema

BAML could render and parse a typed response.

Rejected for this narrow, two-arm JSON wire contract. The existing executor path already returns
text, a tiny total parser is sufficient, and new BAML codegen surface would expand scope without
improving the acceptance proof.

### D. Return `null` or fail on malformed output

Returning `null` would make absence ambiguous with an inert single-seat route. Returning a fail
would falsely claim an adversarial defect was found.

Rejected. Malformed reviewer output is an operational/schema failure, so the shell throws a typed
error. Review pass/fail remains data.

### E. Include usage/cost in `CrossReviewVerdict`

This could support review metering in the ledger.

Rejected because the story's ledger shape names authoring seat, reviewing seat, pass/fail, and
detail. No ticket currently contracts review usage persistence. The stub still proves free
execution by returning zero usage/cost without invoking a real transport.

### F. Accept a diff artifact path and read it in this module

This would compose directly with `RunSummary.capturedDiff`.

Rejected at this layer because prompt construction and verdicting only need patch bytes. Path
resolution and filesystem failure policy belong to the cast integration in the next ticket. Plain
string input keeps this ticket pure at its core and independently testable.

### G. Let the reviewer emit `reviewingSeat`

Rejected because seat is routing provenance already known locally. Model-authored metadata could be
wrong or adversarial and would duplicate the resolver's source of truth.

## Test design

Pure tests will pin:

- prompt inclusion of rubric and complete patch;
- adversarial/context-complete instructions;
- explicit pass/fail JSON contract;
- pass parsing;
- fail parsing with a trimmed reason;
- malformed/unknown/fail-without-reason rejection.

Async acceptance tests will use a recording stub `Executor`:

- a Codex complement primed with `{"verdict":"pass"}` yields exactly
  `{ verdict: "pass", reviewingSeat: "codex" }`;
- a Claude complement primed with `{"verdict":"fail","reason":"..."}` yields a fail carrying
  the reason and `reviewingSeat: "claude"`;
- the stub records one dispense call and verifies prompt context, `maxTurns: 1`, and timeout
  forwarding;
- the stub terminal result reports empty/zero usage and zero cost;
- no concrete executor, subprocess, network request, or token-consuming model is used.

A malformed terminal response test will assert `CrossReviewResponseError` so downstream integration
cannot accidentally treat ambiguity as a verdict.

## Scope preservation

This design does not modify cast orchestration, the run ledger, executor selection, executor
implementations, or the Executor interface. It does not introduce authoring configuration, enforce
the verdict, or perform a live review. It produces the stable workflow value T-073-01-04 needs.

