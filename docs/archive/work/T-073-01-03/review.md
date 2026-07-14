# T-073-01-03 — Review

## Outcome

PASS. The ticket acceptance criterion is fully met.

A cross-review operation now accepts captured patch text, authored rubric context, and the already
resolved complement executor. It builds one context-complete adversarial prompt, dispenses it
through the existing provider-neutral `Executor.dispense`, validates the structured pass/fail JSON,
and returns trusted reviewing-seat provenance with the verdict.

The acceptance proof uses only recording stubs. Both stub terminal results report empty usage and
zero cost, and no concrete executor, subprocess, network call, or metered model is constructed.

## Source commit

```text
241a3281e09f111704eb44ac789d52ab60479e20
feat(cross-review): dispense structured complement verdict
```

The commit was created with `lisa commit-ticket` and three exact repository-relative include paths.
No ordinary staging or commit command was used.

## Files created

### `src/cross-review/review-core.ts`

New pure review policy module.

- Defines `CrossReviewVerdict` as a readonly discriminated union.
- Pass carries `verdict: "pass"` and `reviewingSeat`.
- Fail carries `verdict: "fail"`, `reviewingSeat`, and a non-empty `reason`.
- Defines a seat-free parsed wire union so the model cannot forge routing provenance.
- Exports a stable adversarial reviewer system prompt.
- Builds a context-complete review prompt from plain patch/rubric strings.
- Clearly labels the rubric and captured-diff regions.
- Directs the reviewer to treat patch contents as untrusted evidence.
- Directs the reviewer not to explore the repository or request follow-up.
- Pins exact pass/fail JSON response examples.
- Parses exact or fenced JSON objects.
- Rejects invalid JSON, arrays, unknown verdicts, and unreasoned failures.
- Trims valid failure reasons.
- Has no effects or concrete executor dependency.

### `src/cross-review/review.ts`

New thin executor shell.

- Accepts the `ComplementExecutor` established by T-073-01-02.
- Accepts complete captured patch text and caller-provided rubric context.
- Calls only the complement's existing `executor.dispense` method.
- Supplies the stable system prompt.
- Supplies `maxTurns: 1` for capable agentic implementations.
- Forwards an optional timeout unchanged.
- Parses terminal `result` text through the pure core.
- Attaches reviewing seat from the trusted resolver result.
- Returns review refusal as normal data.
- Throws a typed `CrossReviewResponseError` for malformed output rather than fabricating pass/fail.
- Lets existing transport and timeout errors retain their established behavior.
- Imports no Claude/OpenAI-compatible implementation.

### `src/cross-review/review.test.ts`

New focused pure and seam coverage.

- Verifies the complete rubric and patch enter the prompt.
- Verifies adversarial, untrusted-evidence, no-exploration, and response-format instructions.
- Verifies pass parsing.
- Verifies fail parsing and reason trimming.
- Verifies fenced-object tolerance.
- Verifies malformed, unknown, unreasoned, empty-reason, and array rejection.
- Uses a recording structural `Executor` stub.
- Verifies a pass-primed openai-compatible/Codex reviewer returns exact pass plus reviewing seat.
- Verifies a refusal-primed Claude reviewer returns fail plus reviewing seat and reason.
- Verifies exactly one dispense call per review.
- Verifies prompt, system, one-turn, and timeout arguments at the seam.
- Verifies malformed terminal output raises the typed response error.
- Verifies both stub terminal results carry empty usage and zero total cost.

## Acceptance evaluation

Criterion:

> Casting through a stub reviewer executor primed to pass yields a parsed {verdict: pass,
> reviewingSeat}; primed to refuse yields {verdict: fail, reason} — both verified with zero tokens
> against the stub.

Pass branch:

- Stub id: `openai-compat`.
- Resolved reviewing seat: `codex`.
- Primed terminal text: `{"verdict":"pass"}`.
- Returned value: `{ verdict: "pass", reviewingSeat: "codex" }`.
- Terminal usage: `{}`.
- Terminal cost: `0`.

Refusal branch:

- Stub id: `claude`.
- Resolved reviewing seat: `claude`.
- Primed terminal text carries `verdict: "fail"` and a specific reason.
- Returned value carries fail, reviewing seat, and the same validated reason.
- Terminal usage: `{}`.
- Terminal cost: `0`.

Result: fully met with no live token spend.

## Verification

Focused verification:

```text
bun test src/cross-review/review.test.ts
bun run check:typecheck
git diff --check -- src/cross-review/review-core.ts src/cross-review/review.ts src/cross-review/review.test.ts
```

Focused result:

- 6 tests passed.
- 0 failed.
- 33 assertions.
- TypeScript passed.
- Whitespace check passed.

Full required gate:

```text
bun run check
```

Full result:

- BAML generation completed.
- TypeScript passed.
- 1681 tests passed.
- 1 existing intentional release-artifact integration test skipped.
- 0 tests failed.
- 5173 assertions across 113 files.

## Design quality assessment

The ticket preserves P6: workflow policy depends only on `Executor.dispense` and a resolved
`ComplementExecutor`, so both current providers and future implementations share the same operation.
No adapter-specific switch or method was introduced.

It preserves P4: the outcome is machine-readable and autonomous. No human prompt, approval step,
or conversational fallback exists.

Pure core / impure shell remains explicit. Prompt construction and validation are plain-value pure
functions; the executor call is a short wrapper. Expected reviewer refusal is data, while malformed
reviewer output is separated as an operational/schema error.

Reviewing-seat provenance is attached locally from the route and never trusted to model output.
This gives T-073-01-04 a stable value for ledger recording.

## Deviation and correction

The first focused run exposed that the tolerant parser would extract an object nested inside an
array. That contradicted the one-object response contract. The parser was tightened to reject array
responses before extracting a fenced object. The focused and full gates passed after correction.

No module, interface, or scope boundary changed from the Design/Structure/Plan artifacts.

## Open concerns and limitations

- The operation accepts patch bytes; it does not load the `capturedDiff` artifact reference.
  Downstream cast/ledger integration owns that filesystem composition.
- No review usage/cost is surfaced on the verdict. The current story contract does not request it.
- The optional timeout is forwarded, but this module does not allocate a separate review budget.
- Prompt delimiters are framing, not a formal sandbox. The system and prompt explicitly classify
  patch contents as untrusted evidence.
- The parser tolerates surrounding fence/prose to avoid needless schema fragility, while still
  requiring one valid object and a reasoned fail.
- A malformed reviewer response throws rather than returning an inert/null value. Downstream
  composition must choose an honest operational outcome; it must not treat this as pass.
- This ticket alone does not demonstrate end-to-end cast-to-ledger routing; the story DAG assigns
  that composition and persistence to T-073-01-04.

None of these limitations prevents this ticket's acceptance or the next ticket from recording the
settled verdict shape.

## Explicitly out of slice

- Run-log schema and round-trip persistence.
- Single-seat inert behavior in cast orchestration.
- Loading captured patch artifacts inside the cast flow.
- Blocking a clear on review failure.
- Per-playbook rubric authoring.
- Adding or changing executor implementations.
- Live metered cross-vendor review.
- Release-day gold-master bake-off.

## Repository hygiene

- All three ticket-owned source paths are committed and clean.
- The ordinary Git index is empty.
- Lisa-owned ticket/provenance/publication changes were not included.
- The unrelated untracked `docs/active/epic/E-074.md` was not touched or included.
- Phase artifacts remain authored in the attempt-private directory for Lisa publication.

