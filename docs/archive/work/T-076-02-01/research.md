# Research — T-076-02-01

## Contract and scope

- The parent story is `S-076-02`, settlement-never-crashes-never-loses-the-ledger.
- This ticket owns the first of three serialized settlement repairs.
- Its narrow concern is a provisioned reviewer whose dispense fails after a cast effect lands.
- The required result is an existing amber `missing-capability` andon, not a rejected promise.
- The andon must name the reviewer seat, the endpoint category, the cause, and a repair hint.
- The successful E-073 review path must remain unchanged.
- Retrying review, changing pass/fail judgment, and fail-closed policy are out of scope.
- General record-write-on-arbitrary-settlement-throw belongs to `T-076-02-02`.
- Full no-network characterization belongs to `T-076-02-03`.
- The assignment requires artifacts in the attempt-private `.lisa/.../work` directory.
- Lisa, not this worker, publishes admitted artifacts and advances ticket frontmatter.

## Relevant cast orchestration

- `src/engine/cast.ts` exports the impure `castPlay` shell.
- It resolves and probes the primary executor before dispensing.
- A failed primary-executor probe already returns `missing-capability` and prints an amber andon.
- That E-074 branch is the explicit precedent cited by this ticket.
- The primary cast then renders, dispenses, meters, parses, gates, and classifies.
- A clear verdict authorizes `play.effect`.
- The effect can report produced artifacts and whether it physically materialized.
- `captureEffectDiff` runs after a successful effect.
- The captured diff is stored under `.vend/artifacts` and returned as a repository-relative path.
- Cross-review is relevant only when gates are enabled, the effect succeeded, a diff exists,
  and the primary executor maps to a known authoring seat.
- `resolveComplementExecutor` returns either a trusted complement seat/executor pair or `null`.
- A `null` resolution records `crossReviewSkipped`; that behavior came from `T-076-01-02`.
- A non-null resolution causes `castPlay` to read the captured patch and call
  `dispenseReviewVerdict`.
- That call is currently awaited without a catch.
- Any rejection therefore exits `castPlay` before `settleCrossReview`, terminal printing,
  `appendRunLog`, and `RunSummary` construction.
- The already-written effect and diff remain in the world despite the rejected cast promise.

## Review boundary

- `src/cross-review/review.ts` owns the impure review dispense operation.
- `DispenseReviewOptions.reviewer` is a `ComplementExecutor` with both trusted `seat` and
  an `Executor` instance.
- `dispenseReviewVerdict` builds a context-complete, single-turn prompt.
- It invokes the universal `Executor.dispense` seam with `maxTurns: 1`.
- It parses the terminal reply with the pure `parseReviewVerdict` helper.
- A valid pass returns `{ verdict: "pass", reviewingSeat }`.
- A valid fail returns `{ verdict: "fail", reviewingSeat, reason }`.
- A malformed response throws `CrossReviewResponseError`.
- Transport failures and executor timeouts also escape from the same awaited call.
- The caller therefore has one settlement seam at which all three named failure classes meet.

## Executor and endpoint facts

- `Executor` exposes a stable `id`, `probe`, and `dispense`.
- Known executor IDs are mapped to seats by `resolveSeatOfExecution`.
- `claude` maps to the `claude` seat.
- `openai-compat` maps to the `codex` seat.
- The complement resolver attaches the locally trusted seat; the reviewer does not author it.
- `src/executor/openai-compat.ts` describes `openai-compat` as an OpenAI-compatible endpoint.
- Its default base URL is `http://localhost:11434/v1`.
- Its endpoint configuration variable is `VEND_OPENAI_BASE_URL`.
- Its optional bearer variable is `VEND_OPENAI_API_KEY`.
- Fetch refusal throws from `dispenseOpenAICompat`.
- Its wall-clock abort throws an `OpenAICompatTimeoutError`.
- A malformed completion can also lead to a typed response error in `review.ts`.
- An andon can identify the endpoint category from the stable executor ID without exposing
  transport implementation details or trusting model output.

## Existing settlement core

- `src/engine/cast-core.ts` owns pure terminal judgment.
- `classify` chooses the initial outcome and whether the effect may run.
- `Verdict.materialize` means the effect is authorized, not that it necessarily succeeded.
- `settleCrossReview` applies an optional valid cross-vendor verdict after the effect.
- No review leaves the base verdict object unchanged.
- A passing review adds a passed `cross-vendor-review` gate row and keeps the outcome.
- A failing review adds a failed gate row and relabels the outcome to `gate-failed`.
- It deliberately preserves `materialize`, because the effect already landed.
- A reviewer operational failure is not a valid adversarial fail verdict.
- It therefore must not fabricate a `CrossVendorVerdict` or a failed review gate row.
- `RunOutcome` already includes `missing-capability`; no log schema expansion is required.

## Durable record and return shape

- `appendRunLog` is reached once at the ordinary end of `castPlay`.
- The ordinary record includes effect facts, captured diff, optional review disposition,
  terminal outcome, usage, cost, gate rows, and timestamps.
- `CrossVendorVerdict` has only pass/fail judgment data; it has no operational-failure arm.
- `crossReviewSkipped` means no complement resolved, not that a resolved reviewer failed.
- Neither field should be populated for a dispense failure.
- The terminal outcome can represent the operational refusal as `missing-capability`.
- The existing run-log schema does not store arbitrary andon cause/hint prose.
- E-074 likewise makes the refusal countable in the ledger while printing cause/hint live.
- `RunSummary` carries outcome, physical materialization, captured diff, and actual usage.
- A post-effect failure must keep `materialized: true` and the captured diff path honest.
- Changing those facts to false would erase already-landed work rather than report it.

## Existing tests and fixtures

- `src/engine/cast.test.ts` has a temporary Git repository fixture.
- `boardPlanPlay` writes a story and ticket, enabling real diff capture without model tokens.
- `stubExecutor` supplies the primary result.
- `crossReviewRegistry` provisions `claude` and `openai-compat` seats.
- The existing refusal test pins valid review fail behavior as `gate-failed`.
- The existing passing test pins valid review pass behavior as success with gate evidence.
- The default-config test pins honest inert resolution via `crossReviewSkipped`.
- `captureStdout` spies on stdout for one awaited action and restores it in `finally`.
- The E-074 test uses that helper to assert an amber andon and absence of `Error:`.
- A throwing reviewer fixture can reuse the same cast path and prove the promise resolves.
- Awaiting the captured action successfully proves the reviewer rejection was handled.
- Reading the run log proves settlement continued and the outcome became durable.

## Constraints and assumptions

- The catch must be limited to the resolved reviewer dispense/parse operation.
- File-read failure, diff capture failure, effect failure, and append failure remain outside this
  ticket and are addressed by the following story ticket where contracted.
- Error rendering must use `Error.message`, never `Error.stack`.
- Non-`Error` throws need a safe plain fallback so rendering itself does not rethrow.
- Known endpoint categories should use plain product language.
- Unknown future executor IDs need a total generic endpoint label.
- The fix hint should be actionable without assuming one provider.
- It may name the OpenAI-compatible configuration variables for that known endpoint category.
- `vend doctor` now probes provisioned reviewers and is a valid repair step.
- No real endpoint, tokens, or network listener are needed for this ticket's unit proof.
- `bun run check` is the repository gate and must pass before the source commit.
- Source/test commits must use `lisa commit-ticket` with exact include paths.
- Lisa-owned ticket/provenance modifications already in the worktree must remain untouched.

## Research conclusion

The defect is a single unhandled await in the post-effect review branch. The existing types already
provide every trustworthy fact needed to degrade it: reviewer seat, executor ID, original error
message, `missing-capability`, physical materialization, captured diff, and the ordinary append.
No retry, schema migration, or executor change is required. The implementation boundary is the
review await plus a small pure settlement/formatting decision and hermetic cast tests.
