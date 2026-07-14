# T-076-02-03 Review — no-network characterization test

## Verdict

PASS.

All ticket acceptance criteria are met.

The exact default-config field-failure shape is now a permanent cast-level regression test, and a
companion case proves an explicitly provisioned reviewer that is unreachable through real fetch
settles as a durable `missing-capability` outcome rather than an escaped rejection.

No production code changed. The dependency chain already supplied the correct behavior; this
ticket closes the missing release/test contract.

## Source commit

```text
3ff2c81249e1febf109e9f2fa75c180a2cfa0127
test(engine): characterize no-network cross-review settlement (T-076-02-03)
```

Committed through `lisa commit-ticket` with the exact include:

```text
src/engine/cast.test.ts
```

Commit size:

```text
1 file changed, 122 insertions(+), 8 deletions(-)
```

No ordinary `git add` or `git commit` was used.

## Files changed

### `src/engine/cast.test.ts`

Added one closed-loopback endpoint helper, one explicit real-fetch reviewer registry fixture,
strengthened the default-inert cast characterization, and added the provisioned-unreachable
companion case.

No files were deleted.

No runtime module, schema, configuration surface, dependency, or public interface changed.

## Default-config characterization

The test is named:

```text
castPlay: default config needs no 11434 reviewer and records a consistent skipped-review clear
(T-076-02-03 AC)
```

### What is real

- temporary Git repository and baseline commit;
- BAML-free file-writing play effect;
- story and ticket materialization;
- effect artifact reporting;
- Git diff capture;
- `.vend/artifacts/<run>.diff` publication;
- omitted-registry production complement resolution;
- skipped-review settlement;
- artifact reconciliation;
- run-record construction and normalization;
- JSONL ledger append;
- run-record revival/read boundary.

### What is mocked

- only the primary model executor's probe/dispense/result stream.

The primary stub identifies as Claude so the production author-seat and review-applicability path
is exercised without launching Claude or spending tokens.

### What it proves

- `castPlay` returns `success`.
- The effect materialized.
- The returned diff reference has the expected repository-relative value.
- The diff artifact exists and is readable.
- The patch contains both landed business-artifact paths.
- Exactly one ledger line is written.
- Ledger outcome is `success`.
- Summary, raw record, and revived record share the same diff reference.
- No `artifactDiscrepancy` exists.
- The authored fixture gate row remains intact.
- No cross-vendor verdict is fabricated.
- The exact `crossReviewSkipped` marker is present.
- The marker survives revival.

The test does not assert that port 11434 is empty. That is deliberate and stronger: omitted-registry
resolution returns null before any OpenAI-compatible reviewer is constructed or dispensed, so the
cast succeeds regardless of whether a developer happens to run Ollama there. Port 11434 is not
required.

## Provisioned unreachable-reviewer characterization

The companion test is named:

```text
castPlay: a provisioned unreachable reviewer uses real fetch and settles with ledger intact
(T-076-02-03 AC)
```

### Endpoint construction

The test asks the operating system for a free IPv4 loopback port, records it, closes the temporary
TCP listener, then configures the reviewer base as:

```text
http://127.0.0.1:<closed-port>/v1
```

This avoids:

- assuming port 11434 is unused;
- a fixed alternate port;
- DNS timing;
- an external network;
- a fetch mock;
- global environment mutation.

### Reviewer provisioning

The existing explicit `ExecutorRegistry` seam supplies:

- configured Claude author capacity;
- configured OpenAI-compatible/Codex review capacity.

The reviewer delegate calls production `dispenseOpenAICompat` with an isolated
`VEND_OPENAI_BASE_URL` value. Request building, `fetch`, rejection, and error propagation are real.

### What it proves

- The complement resolver selects the provisioned Codex reviewer.
- Reviewer dispense is attempted exactly once.
- The reviewer prompt contains both captured patch paths.
- The reviewer is bounded to one turn.
- Real fetch rejects against the closed endpoint.
- The awaited full cast returns a value rather than rejecting.
- Returned outcome is `missing-capability`.
- The already-landed effect remains `materialized: true`.
- The captured diff reference remains present.
- Stdout emits the named reviewer andon.
- Stdout identifies the Codex seat and OpenAI-compatible endpoint.
- Stdout includes endpoint configuration and `vend doctor` repair guidance.
- Stdout contains no raw error or stack-frame presentation.
- The artifact remains readable with both business paths.
- Exactly one ledger line exists.
- Ledger outcome is `missing-capability`.
- Ledger and summary artifact references agree.
- Primary usage, cost, and authored gate evidence survive settlement.
- No `artifactDiscrepancy` exists.
- No invalid reviewer verdict is fabricated.
- No skipped marker is fabricated after a reviewer resolved.
- The revived record preserves the artifact reference.

## No-unhandled-rejection assessment

PASS at the `castPlay` contract boundary.

The companion's reviewer `dispense` returns the real rejected fetch promise. The test awaits the
complete `castPlay` inside the stdout capture and receives a normal `RunSummary`. If the reviewer
rejection escaped the T-076-02-01 settlement catch, that await would reject and the test would fail.

The test runner also completes normally after the case; no delayed unhandled-rejection diagnostic
is emitted.

This matches the existing suite's cast-level definition of the property without adding
process-global rejection listeners that could interfere with parallel test execution.

## Acceptance assessment

### AC 1 — default-config full cast, success, marker, ledger, consistent artifact

PASS.

- Primary dispense is mocked.
- Reviewer registry is omitted.
- Resolution onward is real.
- No listener or model at 11434 is required.
- Summary outcome is success.
- Exact skipped marker is durable.
- Exactly one ledger row exists.
- Captured artifact exists.
- Summary/raw/revived references agree.
- Artifact discrepancy is absent.

### AC 2 — provisioned unreachable reviewer, andon, ledger, no escaped rejection

PASS.

- Reviewer is explicitly provisioned.
- Reviewer uses production OpenAI-compatible fetch.
- Endpoint is genuinely closed at dispatch.
- Full cast returns `missing-capability`.
- Named actionable andon is emitted without a stack.
- Exactly one ledger row exists.
- Artifact and record agree.
- Rejected fetch is contained inside settlement.

### AC 3 — honest fallback if full fidelity is impossible

PASS without fallback.

The in-suite proof is feasible and implemented. No manual probe script is needed.

The exact real/mocked boundary is documented here rather than silently over-claimed.

### AC 4 — full gate green

PASS before and after commit.

## Test evidence

### Ticket-focused cases

```bash
bun test src/engine/cast.test.ts --test-name-pattern "T-076-02-03"
```

```text
2 pass
19 filtered out
0 fail
41 expect() calls
```

### Full cast suite

```bash
bun test src/engine/cast.test.ts
```

```text
21 pass
0 fail
226 expect() calls
```

### Authoritative repository gate

Pre-commit and post-commit runs of:

```bash
bun run check
```

both produced:

```text
BAML generation  PASS
tsc --noEmit     PASS
bun test         1741 pass, 1 skip, 0 fail
                 5466 expect() calls
                 1742 tests across 116 files
```

The one skip is the pre-existing release acceptance integration requiring built `dist/` artifacts.
It directs the operator to `just release-local` and is unrelated to this ticket.

## Regression compatibility

The complete cast suite remains green for:

- successful reviewer pass;
- reviewer refusal and failed cross-review gate;
- arbitrary injected reviewer rejection;
- inert complement resolution;
- non-reviewer settlement throw and artifact discrepancy;
- no-op/diff-irrelevant effects;
- executor unreachability;
- executor timeout;
- over-envelope settlement;
- seat and grounding provenance.

No successful-review semantics were changed or reimplemented.

## Architecture assessment

### Pure core, impure shell

PASS.

No production boundary changed. Runtime judgment remains in the existing pure cast core. Resolver
policy, transport, Git capture, filesystem reconciliation, and append behavior remain in their
established modules.

New socket allocation exists only in test infrastructure. Assertions observe public summary,
stdout, artifact, and ledger surfaces rather than adding a production-only test hook.

### Executor neutrality

PASS.

The generic cast code remains unchanged and depends only on the Executor interface. The test
provisions the existing OpenAI-compatible ID through the registry seam and calls its already
exported transport function.

### Scope discipline

PASS.

No retries, provisioning UI, successful verdict changes, config schema, default endpoint change,
or manual release machinery was added.

## Repository hygiene

- `git diff --check -- src/engine/cast.test.ts` passed before commit.
- `git show --check 3ff2c812...` passed after commit.
- Commit path inspection lists exactly `src/engine/cast.test.ts`.
- Ticket-owned source is clean.
- No ticket-owned file is staged, modified, or untracked.
- Lisa-owned `.lisa/provenance.jsonl`, ticket transition, and published work artifacts remain
  visible and untouched.
- All six private RDSPI artifacts exist in the attempt work directory.

## Open concerns and limitations

### Closed-port reuse race

There is a theoretical race in which another process binds the OS-selected port after the test
listener closes and before fetch begins. The window is extremely small and local. Reserving then
closing an ephemeral port is more reliable than a fixed port and avoids external network timing.

### Successful live reviewer behavior

The ticket does not prove a successful response from a running Ollama/OpenAI-compatible endpoint.
Existing pass/fail fixtures cover settlement semantics, while live model compatibility remains a
separate transport/release concern. This characterization is specifically the unreachable field
failure.

### Primary executor fidelity

The primary executor is intentionally mocked. The parent story explicitly requires this to avoid
tokens. Everything from its returned result through parse, gates, effect, Git capture, reviewer
resolution/fetch, settlement, artifact reconciliation, and record persistence is exercised.

No critical issue, TODO, or unmet acceptance criterion remains.
