# T-073-02-02 — Design

## Decision

Add one dedicated, hermetic end-to-end test that performs two complete casts against the same
temporary Git project and ledger. The first cast writes an intentionally defective artifact and
receives a primed FAIL from the complement stub. The second writes corrected content and receives
a primed PASS. Assert the captured review prompts, returned summaries, and both durable ledger
lines as one contrastive proof.

No production source changes are required.

## Goals

- Prove an intentionally bad diff reaches the complement seat.
- Prove its structured refusal prevents the run from settling as success.
- Prove the refusal and reason remain attached to the same ledger line.
- Prove a good diff follows the same path and settles successfully.
- Prove its passing verdict remains attached to its ledger line.
- Exercise the real cast, Git capture, reviewer parse, settlement, and log append boundaries.
- Keep the proof free, deterministic, local-first, and independent of human approval.

## Non-goals

- Do not change cross-review enforcement policy.
- Do not introduce a rollback of already materialized files.
- Do not claim that a stub semantically judges arbitrary patches.
- Do not call a real Claude or OpenAI-compatible endpoint.
- Do not add a new executor implementation.
- Do not add per-playbook rubric configuration.
- Do not modify command-line or TUI behavior.

## Option 1 — Rely on dependency tests unchanged

The existing `cast.test.ts` branch tests already show FAIL and PASS separately.

Advantages:

- No new code.
- Existing assertions cover most individual facts.

Disadvantages:

- Does not create a ticket-owned end-to-end demonstration artifact.
- The two outcomes are isolated tests rather than one explicit bad/good contrast.
- “Intentionally bad diff” is represented mostly by fixture naming and a canned plan.
- Acceptance asks this ticket to demonstrate the path rather than inherit proof implicitly.

Decision: rejected. The dependency tests validate enforcement; this ticket must add the named
demonstration.

## Option 2 — Extend the existing `cast.test.ts`

Add another test to the large cast integration suite and reuse its private helpers.

Advantages:

- Least fixture duplication.
- Directly adjacent to focused enforcement tests.
- Uses established temp-Git and stub patterns.

Disadvantages:

- Modifies a file owned by the dependency ticket for a distinct proof obligation.
- Makes an already broad test file larger.
- Private helpers cannot communicate the demonstration as a standalone executable specimen.
- A single exact-path ticket commit is cleaner with a new file.

Decision: viable but rejected in favor of clearer ownership and discoverability.

## Option 3 — Dedicated end-to-end test with production cast

Create `src/engine/cross-review-refusal.e2e.test.ts` with only the fixtures needed for this proof.

Advantages:

- The filename names the exact acceptance behavior.
- Both outcomes live in one scenario and one ledger.
- A real Git patch visibly contains defective/corrected fixture content.
- The test invokes production `castPlay`, reviewer parsing, settlement, and log persistence.
- Ticket ownership and exact-path commit are unambiguous.
- It remains hermetic and fast.

Disadvantages:

- Repeats small generic helpers for temp repos and executor doubles.
- It tests a broad shell path, so a failure may require reading several components.

Decision: chosen. The repetition is small and purposeful for an acceptance specimen.

## Option 4 — CLI subprocess end-to-end test

Invoke `vend` as a subprocess and configure stubs through environment or additional seams.

Advantages:

- Exercises argument parsing and process exit status.
- Superficially resembles an operator invocation.

Disadvantages:

- There is no public CLI fixture-injection path for primed executor instances.
- Adding one would expand production API solely for a test.
- It would mix CLI concerns into a run-level story.
- The ticket explicitly scopes the cast classify/clear path and ledger result.

Decision: rejected as unnecessary scope expansion.

## Fixture design

### Temporary project

- Create one temporary directory per test.
- Initialize a real Git repository with an empty baseline commit.
- Supply local identity flags to the baseline commit.
- Use one ledger path for both casts.
- Remove the directory after the test.

### Fixture play

- Input: a stable case label.
- Parsed author output: `{ quality: "bad" | "good" }`.
- Ordinary gate: always clear with a named `fixture-contract` row.
- Effect: write one TypeScript evidence file whose bytes differ by quality.
- Bad bytes explicitly expose a false proof marker.
- Good bytes explicitly expose a true proof marker.
- Report the written path in `artifacts` so production Git capture owns the patch.
- Give the play a high envelope to isolate review settlement from budget outcomes.

### Authoring executor

- Use executor id `claude` so execution provenance resolves to the Claude seat.
- Return the requested fixture JSON as a successful terminal result.
- Use zero usage and zero cost because this is a free proof.
- No streaming events or interaction are necessary.

### Complement registry

- Configure both `claude` and `openai-compat` factories.
- The complement resolver selects `openai-compat`, mapped to seat `codex`.
- A recording stub owns a response queue: reasoned FAIL, then PASS.
- Every call is retained for prompt assertions.
- Exhausting the response queue throws so accidental extra review calls fail loudly.

## Assertions

### Routing and patch evidence

- Exactly two complement calls occur.
- Each call is capped at `maxTurns: 1`.
- The first prompt includes the bad evidence bytes.
- The second prompt includes the corrected evidence bytes.
- Both prompts include the play's authored purpose/rubric context.

### Bad cast

- Summary outcome equals `gate-failed`.
- Summary outcome is explicitly not `success`.
- A captured diff reference is present.
- The associated ledger record outcome equals `gate-failed`.
- Its `crossVendorVerdict` is Claude → Codex, FAIL, with the exact reason.
- Its review gate row is failed with the same detail.

### Good cast

- Summary outcome equals `success`.
- A captured diff reference is present.
- The associated ledger record outcome equals `success`.
- Its `crossVendorVerdict` is Claude → Codex, PASS.
- Its review gate row passes without fabricated detail.

### Ledger integrity

- The ledger contains exactly two JSONL lines.
- Ordered run ids identify the bad and good casts.
- Ordinary fixture gates pass on both lines.
- The cross-review gate is the only settlement distinction.

## Honest interpretation

The proof shows autonomous enforcement using the executor abstraction and a primed complement
double. It demonstrates all local orchestration and persistence boundaries. It does not establish
the quality or availability of a live second-vendor model. That remains the story's explicit
metered boundary.
