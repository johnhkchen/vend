# Design — T-082-01-02 cast-settle-cap-detection

## Decision summary

Add one pure, total classifier in `src/engine/cast-core.ts` that converts a terminal,
failure-shaped executor result into the existing `CapWindowExhausted` marker only when the result
contains explicit HTTP-429 or rate-limit-exhaustion evidence. At the final append boundary,
`castPlay` calls the classifier once and conditionally spreads its result:

```ts
const capWindowExhausted = classifyCapWindowExhaustion(result);

...(capWindowExhausted !== undefined ? { capWindowExhausted } : {}),
```

The classifier will return controlled engine-owned values:

```ts
{ signal: "http-429", reason: "executor terminal failure reported HTTP 429 at settlement" }
{ signal: "rate-limit", reason: "executor terminal failure reported rate-limit exhaustion at settlement" }
```

It will not change outcome classification, effect authorization, exception behavior, stream
handling, executor implementations, or run-log normalization.

## Meaning of “executor failure” in this slice

The executor seam has two failure channels:

1. a returned terminal `ResultMessage` with an error-shaped subtype/open fields;
2. a rejected `dispense` promise for transport, launch, absent-result, or HTTP failures.

This ticket targets the first channel: the terminal result path that already reaches the one final
ledger append. That is the path described by “stamps the cap marker on the row it already writes”
and the only path on which a non-rate failure can remain byte-identical to its existing row.

Broadening this ticket to turn every thrown dispense rejection into a settled row would change
control flow and create a new durable record where none exists today. It would require deciding
outcome, metering, return-versus-rethrow behavior, and graph interaction beyond the marker request.
That is not necessary for the acceptance fixture and is rejected as hidden scope.

The OpenAI-compatible adapter's thrown HTTP path remains a known limitation of this slice. The
executor-neutral classifier is still able to recognize a structured 429 terminal result from any
current or future executor implementation. A separate settlement-cord ticket can broaden thrown
dispense coverage if demanded without weakening this classifier.

## Classification input

The public helper accepts `ResultMessage | null`.

- `null` means there was no terminal result and returns absence.
- The open result shape is external data, so every inspected field is treated as `unknown`.
- The helper never throws on malformed, cyclic, exotic, or future fields.
- The helper does not accept a seat, clock, ledger, or provider configuration.
- The containing cast shell remains responsible for choosing when settlement occurs.

The type is imported only as a TypeScript type, preserving the pure core's seam-free runtime
dependency discipline.

## Failure-shaped guard

Evidence is considered only when the terminal result itself says it is a failure:

- `subtype` begins with `error`, or
- the open record has `is_error === true`.

This guard is load-bearing. A successful model answer may discuss HTTP 429, rate limits, or quota
policy as ordinary content. Scanning successful `result` prose would create fabricated cap events
that future capacity learning treats as hard observed boundaries.

`error_max_turns` passes the failure guard but does not match cap evidence on subtype alone. The
existing max-turn fixture therefore keeps its current result, effect, outcome, and bytes unless its
terminal failure record also contains actual rate-limit evidence.

## Evidence precedence

The classifier uses strongest-first precedence:

1. explicit numeric/string 429-shaped status/code evidence;
2. explicit rate-limit-shaped diagnostic text.

If both appear, `http-429` wins because it is the more precise signal.

Structured status candidates are limited to recognized diagnostic locations:

- top-level `status`;
- top-level `statusCode`;
- top-level `code`;
- the same keys on a top-level `error` object.

A candidate qualifies when it is the number `429` or the trimmed string `"429"`.
This does not mistake arbitrary token counts, reset epochs, or prose digits for a status code.

Text candidates are limited to failure-diagnostic fields:

- `subtype`;
- `result`;
- top-level `message`;
- top-level `error` when it is a string;
- `error.message`, `error.type`, and `error.code` when `error` is an object;
- string values or message/type/code strings in a top-level `errors` array.

The helper does not recursively walk the whole external object. Bounded named extraction avoids
reading arbitrary generated content or getting trapped by cycles/getters in unrelated fields.

## Text vocabulary

The rate-limit matcher recognizes explicit provider-denial language, case-insensitively:

- `rate limit`, `rate-limit`, or `rate_limit`, including common suffixes;
- `too many requests`;
- `hit your limit` when the terminal result is already failure-shaped;
- usage/quota limit reached, exceeded, or exhausted;
- quota exceeded/exhausted.

The matcher deliberately does not recognize:

- a bare word `limit`;
- `max turns` / `error_max_turns`;
- `allowed` or `allowed_warning` rate-limit telemetry;
- an overage status of `rejected` on an otherwise allowed stream event;
- timeout messages;
- generic overload, connection, authentication, or server errors.

This is conservative because false positives poison the next story's learned denomination. False
negatives can be expanded later from captured terminal evidence with a focused vocabulary change.

## Stream telemetry decision

Do not classify live `rate_limit_event` messages in `onMessage`.

Repository transcripts prove that this event occurs on healthy casts with primary status
`allowed` and `allowed_warning`. Some healthy events also carry a rejected overage status. Treating
the event's presence as exhaustion would violate the story's honest boundary.

Ignoring it also preserves N4: `onMessage` remains transcript/progress capture, not runtime
interception or routing policy. Only the terminal result is classified, after dispense settles.

## Marker vocabulary decision

The marker uses stable categories rather than raw provider prose.

- `signal: "http-429"` records the precise status-shaped observation.
- `signal: "rate-limit"` records explicit textual or typed rate-limit evidence without inventing
  an HTTP status.
- `reason` explains that the classification came from a terminal executor failure at settlement.

Raw messages are not persisted in the marker because they may contain unstable, verbose, or
sensitive provider details. The transcript already preserves raw stream evidence when supplied.
Stable vocabulary makes ledger counting deterministic across providers.

## Shell integration

Compute the marker after the executor result and all settlement facts are in scope, immediately
before or within the final settlement section. Thread only the classified plain value into
`appendRunLog`.

Place the conditional spread immediately after `seatOfExecution`, matching the run-log schema's
canonical order and the story's “alongside” language:

```ts
...(seatOfExecution !== undefined ? { seatOfExecution } : {}),
...(capWindowExhausted !== undefined ? { capWindowExhausted } : {}),
```

No second append is introduced. Every existing successful, timeout, gate, effect, and settlement
path retains its current single append behavior.

## Outcome and effect decision

Do not reinterpret terminal error subtypes in this ticket.

The repository intentionally uses `error_max_turns` results as recoverable parsed output for the
decompose checkpoint/effect flow. A general terminal-failure outcome rewrite would conflict with
that established behavior and exceeds marker classification.

The marker is orthogonal durable evidence, like `overEnvelope` and `seatInferred`; it does not add
a `rate-limited` `RunOutcome`. The existing outcome remains byte-for-byte and semantically as it is
today, while the new optional field makes the cap occurrence countable.

## Pure unit tests

Add a focused `classifyCapWindowExhaustion` block to `src/engine/cast-core.test.ts`.

Required branches:

1. failure result with numeric HTTP status 429 returns the complete `http-429` marker;
2. failure result with `HTTP 429` diagnostic text returns the same marker;
3. error subtype/message with explicit rate-limit wording returns the complete `rate-limit` marker;
4. ordinary non-rate failure returns `undefined`;
5. max-turn error returns `undefined`;
6. success result mentioning 429/rate limits returns `undefined`;
7. null and malformed optional diagnostic fields return `undefined` without throwing;
8. 429 wins over textual rate-limit evidence when both are present.

These tests pin controlled output strings and protect the classifier from broad false positives.

## Cast acceptance tests

Add two branch-level fixtures in `src/engine/cast.test.ts` using injected known-lane executors.

### Rate-limit fixture

- executor id is `claude`, so `seatOfExecution` resolves to `claude`;
- `probe` succeeds;
- `dispense` returns one failure-shaped terminal result with explicit 429/rate-limit evidence;
- the fixture play remains cheap and deterministic;
- `castPlay` is awaited through settlement;
- `runs.jsonl` has exactly one physical line;
- the row has `seatOfExecution: "claude"`;
- the row has the exact complete cap marker;
- `reviveRecord` preserves the complete marker.

### Ordinary failure control

- same known-lane and settlement route;
- terminal result is failure-shaped but describes a non-rate operational failure;
- exactly one row is written;
- neither the raw row nor revived record has `capWindowExhausted`;
- the raw JSONL bytes equal a manually constructed canonical pre-marker record using the row's
  actual generated timestamps, pinning key order and all existing fields.

The control must not merely assert `undefined`; the exact expected JSON string proves that the
conditional spread adds no placeholder and reorders no existing fields.

## Options rejected

### Classify every `rate_limit_event`

Rejected because normal casts emit allowed/warning events. It would also move policy into the live
stream callback, contrary to settle-only scope.

### Persist raw error text

Rejected because it is unstable, potentially sensitive, and unnecessary for counting. Controlled
signal/reason vocabulary is auditable without copying provider prose.

### Add `rate-limited` to `RUN_OUTCOMES`

Rejected because the epic explicitly grounds against the existing vocabulary and asks for a
one-way marker, not a terminal outcome migration.

### Modify executor adapters to throw a new typed rate-limit error

Rejected because it couples classification to each executor, broadens source ownership, and is not
needed when the terminal result is already an open executor-neutral record.

### Settle all thrown dispense failures in this ticket

Rejected because it changes the set of rows written and requires a wider error-cord contract. The
ticket's byte-compatible control and “row it already writes” wording identify terminal settlement
as the intended seam.

### Search any nested field recursively

Rejected because arbitrary model output can contain false matches and external objects can be
malformed or cyclic. Named bounded evidence is safer and sufficient.

## Scope result

Ticket-owned source changes are limited to:

- `src/engine/cast-core.ts`;
- `src/engine/cast-core.test.ts`;
- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`.

No schema, executor adapter, lane heat, capacity learner, budget, wallet, CLI, dispatch, or
historical ledger file changes are designed.
