# T-076-02-03 Plan — no-network characterization test

## Objective

Turn the shipped no-network cross-review failure into a permanent cast-level regression bar.

The completed suite must prove both terminal states:

1. Default configuration leaves cross-review inert and a full diff-producing cast clears without
   requiring anything on localhost:11434.
2. An explicitly provisioned reviewer that is genuinely unreachable through real fetch becomes a
   returned `missing-capability` outcome with its ledger and artifact intact.

## Operating constraints

- Continue through every remaining RDSPI phase without stopping.
- Keep phase artifacts under `.lisa/attempts/T-076-02-03/1/work/`.
- Do not edit ticket status or phase.
- Do not write phase artifacts to `docs/active/work/T-076-02-03/`.
- Do not use ordinary Git staging or commits.
- Commit only exact ticket-owned paths through `lisa commit-ticket`.
- Preserve Lisa-owned dirty files.
- Preserve unrelated concurrent work.
- Run the full repository gate before and after commit.

## Step 1 — establish pre-change repository state

Inspect:

```bash
git status --short --branch
git diff -- src/engine/cast.test.ts
git diff --cached --name-only
```

Criteria:

- `src/engine/cast.test.ts` has no pre-existing uncommitted change.
- Ordinary index contains no ticket-owned staged path.
- Lisa-owned ticket/provenance changes are identified and left alone.

If the test file is already modified by another worker, stop and resolve ownership rather than
overwriting it. The dependency graph says this ticket is serialized, so overlap would be
unexpected.

## Step 2 — add test-only imports

Modify `src/engine/cast.test.ts`:

1. Import `createServer` from `node:net`.
2. Import `dispenseOpenAICompat`.
3. Import `OPENAI_BASE_URL_ENV`.

Verification:

- imports are used;
- no new dependency is added;
- no production export is modified;
- formatting matches the file.

## Step 3 — add closed-loopback endpoint helper

Add `closedLoopbackOpenAIBaseUrl()` near temporary Git helpers.

Implementation sequence:

1. Construct a TCP server.
2. Await listen on IPv4 loopback and port zero.
3. Surface listen errors as promise rejection.
4. Read assigned port from `server.address()`.
5. Guard against null/string address shapes.
6. Await server close.
7. Return the `/v1` base URL.

Verification:

- no server is left open;
- no test cleanup registry is needed for the server because close is awaited;
- no fixed port appears;
- no use of localhost hostname introduces IPv6 ambiguity;
- helper failure is loud.

## Step 4 — add real-fetch reviewer registry helper

Add `unreachableOpenAIReviewRegistry(baseUrl, calls)` near existing review registry fixtures.

Implementation sequence:

1. Add the configured Claude author factory.
2. Add the configured OpenAI-compatible complement factory.
3. Give the reviewer the canonical `openai-compat` ID.
4. Supply interface-complete successful probe behavior.
5. Capture every reviewer `DispenseOptions` call.
6. Delegate `dispense` to `dispenseOpenAICompat`.
7. Pass a dedicated env record containing only the selected base URL.

Verification:

- no global `process.env` write;
- no fetch mock or spy;
- real transport function is called;
- registry satisfies the existing resolution contract;
- primary executor is still separately injected at cast call sites.

## Step 5 — strengthen the default-config characterization

Update the existing default-inert cast test.

Test arrangement:

1. Create a temporary root.
2. Initialize a real Git repository.
3. Choose a stable run ID.
4. Derive the expected `.vend/artifacts/<run-id>.diff` reference.
5. Prepare the BAML-free story/ticket plan.
6. Use `boardPlanPlay`.
7. Inject only the primary Claude stub.
8. Omit `crossReviewRegistry` entirely.

Assertions:

1. Summary returns success.
2. Effect is materialized.
3. Summary reference equals expected reference.
4. Artifact exists.
5. Patch contains the story path.
6. Patch contains the ticket path.
7. Ledger has exactly one row.
8. Row outcome is success.
9. Row reference equals summary reference.
10. Revived reference equals summary reference.
11. No artifact discrepancy exists.
12. Authored gate evidence is unchanged.
13. No reviewer verdict exists.
14. Exact skipped marker exists.
15. Revived skipped marker is equal.

The test should not assert that port 11434 is closed. Its default resolution never constructs or
dispenses the OpenAI-compatible reviewer, so the outcome does not depend on that port's state.

## Step 6 — add the real unreachable-reviewer companion

Add a neighboring cast-level test.

Test arrangement:

1. Create a temporary root.
2. Initialize a real Git repository.
3. Obtain a freshly closed loopback base URL.
4. Choose a stable run ID and expected artifact reference.
5. Prepare a unique story/ticket plan.
6. Inject primary Claude stub.
7. Provision the two-seat real-fetch reviewer registry.
8. Capture stdout.
9. Await the complete cast.

Assertions:

1. Await resolves to a summary rather than rejecting.
2. Reviewer dispense was attempted exactly once.
3. Reviewer prompt contains the patch paths.
4. Reviewer turn cap is one.
5. Summary outcome is `missing-capability`.
6. Materialization remains true.
7. Summary reference is expected.
8. Artifact exists and contains both paths.
9. Stdout contains the named reviewer andon.
10. Stdout contains stable endpoint category and repair hint.
11. Stdout contains no stack framing.
12. Ledger has exactly one row.
13. Row outcome is `missing-capability`.
14. Row reference equals summary reference.
15. Revived reference equals summary reference.
16. Primary usage, cost, and gate evidence remain present.
17. Artifact discrepancy is absent.
18. Reviewer verdict is absent.
19. Skipped marker is absent.

Do not pin Bun's platform-specific connection-refusal error wording.

## Step 7 — run focused characterization tests

First run the two named tests with a pattern:

```bash
bun test src/engine/cast.test.ts --test-name-pattern "T-076-02-03"
```

Criteria:

- both tests pass;
- unreachable reviewer returns quickly;
- no hanging socket or timer remains;
- no unexpected unhandled rejection appears after the test completes.

If the test runner reports a resource leak or intermittent connection success, revise endpoint
isolation before proceeding.

## Step 8 — run the full cast integration suite

```bash
bun test src/engine/cast.test.ts
```

Criteria:

- all existing cast cases pass;
- valid pass/fail review behavior stays unchanged;
- throwing reviewer stub behavior stays unchanged;
- non-reviewer settlement throw behavior stays unchanged;
- default-inert behavior remains success;
- no process-global state leaked into later tests.

## Step 9 — inspect source diff

Run:

```bash
git diff --check -- src/engine/cast.test.ts
git diff --stat -- src/engine/cast.test.ts
git diff -- src/engine/cast.test.ts
```

Review for:

- exactly one source file changed;
- only test imports/helpers/cases changed;
- no production behavior change;
- no accidental formatting churn;
- no ordinary index staging;
- comments state the honest coverage boundary.

## Step 10 — run authoritative pre-commit gate

```bash
bun run check
```

Required result:

- BAML generation succeeds;
- strict typecheck succeeds;
- complete test suite succeeds;
- only the repository's known intentional release-artifact skip may remain;
- zero failures.

If BAML generation modifies generated files, inspect them before commit. Unrelated generated churn
must not be included.

## Step 11 — write `progress.md`

Record:

- exact source changes;
- focused test results;
- cast-suite result;
- pre-commit full-gate result;
- any deviations;
- honest boundary of the socket/fetch characterization;
- ticket-owned path list;
- remaining commit and post-commit tasks.

The progress artifact remains private to this attempt.

## Step 12 — commit the source unit through Lisa

Run exactly:

```bash
lisa commit-ticket \
  --ticket-id T-076-02-03 \
  --message "test(engine): characterize no-network cross-review settlement (T-076-02-03)" \
  --include src/engine/cast.test.ts
```

Do not include:

- `.lisa/provenance.jsonl`;
- ticket frontmatter;
- private phase artifacts;
- Lisa-published work artifacts;
- any unrelated generated file.

Criteria:

- transaction succeeds;
- commit contains the exact source path;
- ticket-owned source path becomes clean;
- ordinary index remains free of ticket-owned paths.

## Step 13 — post-commit inspection

Run:

```bash
git show --stat --oneline --decorate HEAD
git show --name-only --format= HEAD
git show --check HEAD
git status --short --branch
```

Criteria:

- commit subject is ticket-specific;
- commit path list is exactly `src/engine/cast.test.ts`;
- patch whitespace check passes;
- remaining dirty state is Lisa-owned only;
- no ticket source file remains modified or untracked.

## Step 14 — authoritative post-commit gate

Run:

```bash
bun run check
```

This is the final technical gate. Record exact counts and exit status in progress and review.

## Step 15 — finalize progress artifact

Update `progress.md` with:

- source commit hash;
- Lisa transaction outcome;
- post-commit inspection;
- post-commit full-gate result;
- confirmation the source path is clean;
- Review as the only remaining phase.

## Step 16 — write `review.md`

The final handoff must cover:

- acceptance verdict;
- source commit and exact path;
- what each characterization proves;
- real versus mocked boundaries;
- artifact/ledger consistency evidence;
- no-unhandled-rejection evidence;
- focused and full test counts;
- repository hygiene;
- open concerns and limitations;
- explicit statement if any acceptance item is not met.

## Acceptance checklist

- [ ] Full cast uses default complement configuration.
- [ ] Primary model dispense is mocked.
- [ ] No reviewer endpoint is required for default success.
- [ ] Default case returns success.
- [ ] Default case records exact `crossReviewSkipped` marker.
- [ ] Default case writes exactly one ledger line.
- [ ] Default artifact exists.
- [ ] Default summary, artifact, raw record, and revived record agree.
- [ ] Companion provisions a reviewer explicitly.
- [ ] Companion uses real OpenAI-compatible fetch semantics.
- [ ] Companion endpoint is locally unreachable without assuming 11434 is free.
- [ ] Companion returns `missing-capability` rather than rejecting.
- [ ] Companion writes exactly one ledger line.
- [ ] Companion artifact and record agree.
- [ ] Companion carries no false verdict or skipped marker.
- [ ] Full `bun run check` is green.
- [ ] Ticket-owned source is committed through Lisa and clean.
- [ ] Review artifact states the honest boundary.

## Planned honest boundary

The tests will not spend tokens, launch Claude, or contact a live model. The primary executor is a
fixture, exactly as the story requires. The default resolution, Git effect capture, artifact file,
settlement logic, record normalization, JSONL append, and reviewer failure classification are real.

The provisioned reviewer uses the production OpenAI-compatible request/fetch function, but the
endpoint is a deliberately closed local TCP port rather than a running Ollama instance. This proves
the field-relevant unreachable transport behavior deterministically; it does not prove successful
live reviewer compatibility, which is outside this ticket.
