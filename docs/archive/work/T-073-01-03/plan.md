# T-073-01-03 — Plan

## Step 1 — Implement the pure review core

Create `src/cross-review/review-core.ts`.

1. Import `AgentSeat` as a type only.
2. Define the public `CrossReviewVerdict` discriminated union.
3. Define the seat-free parsed wire union.
4. Define the stable adversarial review system prompt.
5. Define the plain prompt-input interface.
6. Implement deterministic prompt construction.
7. Include rubric context and complete captured patch in labelled sections.
8. State the patch is untrusted evidence.
9. State the exact pass/fail JSON response contract.
10. Implement a total parser returning the parsed union or null.
11. Require a non-empty trimmed failure reason.
12. Keep all functions free of effects.

Verification:

- Typecheck through the focused test command/standalone build after tests exist.
- Inspect exports for readonly discriminants and type-only dependencies.

## Step 2 — Implement the executor shell

Create `src/cross-review/review.ts`.

1. Import `ComplementExecutor` as a type.
2. Import core builder/parser/system values.
3. Define `DispenseReviewOptions` with plain strings, resolved reviewer, and optional timeout.
4. Define a typed malformed-response error carrying executor id.
5. Call `reviewer.executor.dispense` once.
6. Supply built prompt and stable system role.
7. Supply `maxTurns: 1`.
8. Conditionally forward `timeoutMs` without manufacturing a default.
9. Parse terminal `result` text.
10. Throw the typed response error on null.
11. Return a pass with trusted reviewing seat.
12. Return a fail with trusted reviewing seat and validated reason.
13. Allow existing executor transport errors to propagate.

Verification:

- Review the wrapper to ensure no concrete executor import exists.
- Ensure no filesystem or environment access is introduced.

## Step 3 — Add pure prompt and parser tests

Create `src/cross-review/review.test.ts`.

Prompt assertions:

1. Unique rubric marker is present.
2. Unique patch marker is present.
3. Full supplied rubric text is present.
4. Full supplied diff text is present.
5. Adversarial/blocking-defect criteria are present.
6. Untrusted-patch instruction is present.
7. Exact pass/fail response examples are present.

Parser assertions:

1. Exact pass produces pass payload.
2. Exact fail produces fail payload and trimmed reason.
3. Fenced object can be extracted.
4. Invalid JSON returns null.
5. Unknown verdict returns null.
6. Missing failure reason returns null.
7. Empty failure reason returns null.
8. Non-object values return null.

Verification:

- Run `bun test src/cross-review/review.test.ts`.

## Step 4 — Add token-free acceptance seam tests

In the same test file:

1. Implement a recording `Executor` stub.
2. Prime it with pass or fail terminal text.
3. Return empty usage and zero total cost.
4. Construct a resolved Codex complement and assert exact pass output.
5. Construct a resolved Claude complement and assert fail output including reason.
6. Assert each stub receives exactly one call.
7. Assert the prompt carries both supplied contexts.
8. Assert the system prompt and one-turn option are supplied.
9. Assert timeout is forwarded when provided.
10. Assert the stub's terminal usage/cost values are zero.
11. Add malformed output rejection through `CrossReviewResponseError`.

Acceptance criterion mapping:

- Stub primed to pass: Step 4.4.
- Parsed `{ verdict: pass, reviewingSeat }`: Step 4.4.
- Stub primed to refuse: Step 4.5.
- Parsed `{ verdict: fail, reason }`: Step 4.5.
- Zero tokens: Steps 4.1–4.3 and 4.10; no concrete transport is constructed.

## Step 5 — Focused verification and correction

Run:

```text
bun test src/cross-review/review.test.ts
bun run check:typecheck
git diff --check -- src/cross-review/review-core.ts src/cross-review/review.ts src/cross-review/review.test.ts
```

If a failure occurs:

- correct only ticket-owned paths;
- rerun the failing focused command;
- record any design deviation in `progress.md` before changing the planned boundary.

## Step 6 — Full project gate

Run `bun run check`.

Required result:

- BAML generation succeeds;
- TypeScript succeeds;
- full Bun suite has zero failures;
- no live review call is made;
- no unrelated workspace changes are incorporated.

## Step 7 — Commit the source unit

After the full gate is green, use one Lisa transaction with exact paths:

```text
lisa commit-ticket \
  --ticket-id T-073-01-03 \
  --message "feat(cross-review): dispense structured complement verdict" \
  --include src/cross-review/review-core.ts \
  --include src/cross-review/review.ts \
  --include src/cross-review/review.test.ts
```

Do not ordinary-stage or commit. Confirm the three source paths are clean afterward. Do not include
ticket frontmatter, provenance, shared artifacts, or another ticket's files.

## Step 8 — Progress and review artifacts

Maintain `progress.md` in the private attempt directory during implementation with:

- completed steps;
- focused/full verification results;
- commit id;
- deviations or blockers;
- remaining work.

After commit, write `review.md` in the same private directory covering:

- outcome against acceptance;
- files and interfaces added;
- prompt and parser behavior;
- stub/no-token proof;
- full gate result;
- limitations and deferred integration;
- repository hygiene.

Stop on this ticket after `review.md`; Lisa owns publication and completion transitions.

