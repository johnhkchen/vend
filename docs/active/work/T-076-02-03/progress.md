# T-076-02-03 Progress — no-network characterization test

## Current state

Implementation and pre-commit verification are complete.

Remaining work:

1. Commit the sole ticket-owned source path with `lisa commit-ticket`.
2. Inspect the committed path list and repository state.
3. Run the authoritative post-commit `bun run check`.
4. Write `review.md`.

## Phase artifacts

The following private artifacts exist:

- `.lisa/attempts/T-076-02-03/1/work/research.md`
- `.lisa/attempts/T-076-02-03/1/work/design.md`
- `.lisa/attempts/T-076-02-03/1/work/structure.md`
- `.lisa/attempts/T-076-02-03/1/work/plan.md`
- `.lisa/attempts/T-076-02-03/1/work/progress.md`

Lisa has independently published the first four admitted artifacts under
`docs/active/work/T-076-02-03/`. Those published paths are Lisa-owned and were not written or
staged by this worker.

## Pre-implementation repository state

`src/engine/cast.test.ts` was clean before implementation.

The ordinary Git index contained no staged ticket-owned path.

Pre-existing/Lisa-owned dirty state was:

- `.lisa/provenance.jsonl`
- `docs/active/tickets/T-076-02-03.md`

Lisa later added untracked/publication state under:

- `docs/active/work/T-076-02-03/`

None of those paths were modified, reverted, staged, or included by the worker.

## Ticket-owned source change

Exactly one source path changed:

```text
src/engine/cast.test.ts
```

Pre-commit diff size:

```text
1 file changed, 122 insertions(+), 8 deletions(-)
```

No production source changed.

## Test infrastructure added

### Closed loopback endpoint helper

Added `closedLoopbackOpenAIBaseUrl()`.

It:

1. creates a Node TCP server;
2. listens on `127.0.0.1` with port `0`;
3. reads the OS-selected port;
4. closes the server and awaits closure;
5. returns `http://127.0.0.1:<port>/v1`.

The endpoint is therefore locally unreachable when reviewer dispense begins.

The helper uses no fixed port and does not assume localhost:11434 is free.

### Real-fetch provisioned reviewer

Added `unreachableOpenAIReviewRegistry(baseUrl, calls)`.

It uses the existing explicit `ExecutorRegistry` provisioning seam with:

- a configured Claude author lane;
- a configured OpenAI-compatible complement lane;
- the canonical reviewer executor ID;
- one call-capture array;
- `dispenseOpenAICompat` as the real transport.

Endpoint selection is passed through a dedicated environment record containing
`VEND_OPENAI_BASE_URL`.

The helper does not:

- mutate `process.env`;
- mock `fetch`;
- contact an external network;
- launch a model;
- spend tokens.

## Default-config characterization

Strengthened and renamed the existing default-inert cast test to:

```text
castPlay: default config needs no 11434 reviewer and records a consistent skipped-review clear
(T-076-02-03 AC)
```

The test uses:

- a real temporary Git repository;
- a real file-writing effect;
- real diff capture;
- omitted `crossReviewRegistry`;
- production default complement resolution;
- real settlement;
- real artifact reconciliation;
- real JSONL append;
- real run-record revival;
- a mocked primary Claude executor only.

It now proves:

- returned outcome is `success`;
- effect materialized;
- summary reference is `.vend/artifacts/default-no-network-review.diff`;
- the artifact can be read;
- the patch contains both the story and ticket paths;
- exactly one ledger line exists;
- row outcome is success;
- row and summary references agree;
- revived and summary references agree;
- no `artifactDiscrepancy` exists;
- authored fixture gate evidence remains intact;
- no reviewer verdict exists;
- exact `crossReviewSkipped` data exists;
- the skipped marker survives revival.

Because the resolver returns null before constructing a reviewer, this proof is independent of
whether anything happens to be listening on 11434.

## Provisioned unreachable-reviewer characterization

Added:

```text
castPlay: a provisioned unreachable reviewer uses real fetch and settles with ledger intact
(T-076-02-03 AC)
```

The test uses:

- a real temporary Git repository;
- a real file-writing effect;
- real diff capture;
- explicit two-seat reviewer provisioning;
- production OpenAI-compatible request construction and fetch;
- a deliberately closed loopback endpoint;
- real review-failure classification;
- real settlement;
- real artifact reconciliation;
- real JSONL append;
- real run-record revival;
- a mocked primary Claude executor only.

It proves:

- reviewer dispense is attempted exactly once;
- reviewer prompt contains the captured story and ticket patch paths;
- reviewer turn cap is one;
- the full awaited cast returns instead of rejecting;
- returned outcome is `missing-capability`;
- effect materialization remains true;
- captured diff reference remains present;
- stdout contains the named reviewer andon;
- stdout names the Codex reviewer and OpenAI-compatible endpoint;
- stdout includes `VEND_OPENAI_BASE_URL` and `vend doctor` repair guidance;
- stdout contains no raw error/stack framing;
- the artifact can be read and contains both paths;
- exactly one ledger line exists;
- ledger outcome is `missing-capability`;
- ledger and summary references agree;
- primary 7/3 token usage and `$0.001` fixture cost remain recorded;
- authored gate evidence remains recorded;
- no artifact discrepancy exists;
- no reviewer verdict is fabricated;
- no skipped marker is fabricated;
- revived artifact reference agrees with the summary.

## Focused verification

Command:

```bash
bun test src/engine/cast.test.ts --test-name-pattern "T-076-02-03"
```

Result:

```text
2 pass
19 filtered out
0 fail
41 expect() calls
```

Both tests completed in under 50 ms individually on this machine. The real unreachable fetch did
not hang or leave a visible unhandled rejection.

## Cast-suite verification

Command:

```bash
bun test src/engine/cast.test.ts
```

Result:

```text
21 pass
0 fail
226 expect() calls
```

Adjacent regression coverage remained green for:

- primary executor andon;
- successful diff capture;
- reviewer pass;
- reviewer refusal;
- injected reviewer rejection;
- non-reviewer settlement throw;
- no-op/diff-irrelevant casts;
- token overshoot;
- executor timeout;
- seat provenance and reduced grounding.

## Diff verification

Commands:

```bash
git diff --check -- src/engine/cast.test.ts
git diff --stat -- src/engine/cast.test.ts
git diff -- src/engine/cast.test.ts
git diff --cached --name-only
```

Results:

- whitespace check passed;
- exactly one source path changed;
- no production code changed;
- ordinary index remains empty for ticket work;
- source diff matches the planned imports, helpers, and tests.

## Pre-commit authoritative gate

Command:

```bash
bun run check
```

Result:

```text
BAML generation  PASS
tsc --noEmit     PASS
bun test         1741 pass, 1 skip, 0 fail
                 5466 expect() calls
                 1742 tests across 116 files
```

The single skip is the existing release acceptance integration that requires real `dist/`
artifacts and directs the operator to `just release-local`. It is unrelated to this ticket.

## Deviations from plan

No material deviation.

The existing default-inert test remains in its established location after valid reviewer pass
coverage, and the new companion follows it immediately. This preserves the surrounding suite's
existing ordering while keeping the ticket pair adjacent.

No production defect surfaced, so the planned test-only scope held.

## Honest coverage boundary

Primary model dispense is mocked, as required by the parent story. No tokens are spent and Claude
is never launched.

The default case uses real default resolution but does not call fetch, because inert resolution is
the behavior under test.

The companion uses the production OpenAI-compatible fetch path, but points it at a deliberately
closed local endpoint. It proves connection failure behavior, not successful compatibility with a
live Ollama/OpenAI-compatible model. Successful-review semantics are covered by existing fixtures
and are outside this ticket's requested field-failure shape.

There is a theoretical operating-system port-reuse race after the reservation closes. The window
is local and extremely small; using an OS-selected port avoids the substantially worse fixed-port,
DNS, and external-network assumptions.

## Source commit

The source unit was committed with:

```bash
lisa commit-ticket \
  --ticket-id T-076-02-03 \
  --message "test(engine): characterize no-network cross-review settlement (T-076-02-03)" \
  --include src/engine/cast.test.ts
```

Lisa returned:

```text
3ff2c81249e1febf109e9f2fa75c180a2cfa0127
```

Commit inspection:

```text
3ff2c81 test(engine): characterize no-network cross-review settlement (T-076-02-03)
 src/engine/cast.test.ts | 130 +++++++++++++++++++++++++++++++++++++++++++++---
 1 file changed, 122 insertions(+), 8 deletions(-)
```

`git show --name-only --format= HEAD` listed exactly:

```text
src/engine/cast.test.ts
```

`git show --check HEAD` passed.

The ordinary Git index was not used.

## Post-commit authoritative gate

Command:

```bash
bun run check
```

Result:

```text
BAML generation  PASS
tsc --noEmit     PASS
bun test         1741 pass, 1 skip, 0 fail
                 5466 expect() calls
                 1742 tests across 116 files
```

The known release-artifact skip is unchanged and unrelated.

## Final repository hygiene

`src/engine/cast.test.ts` has no remaining diff.

No ticket-owned source path is staged, modified, or untracked.

Remaining status is Lisa-owned:

```text
M  .lisa/provenance.jsonl
M  docs/active/tickets/T-076-02-03.md
?? docs/active/work/T-076-02-03/
```

Review is the only remaining phase.
