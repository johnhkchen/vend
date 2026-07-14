# T-076-02-03 Design — no-network characterization test

## Decision summary

Add two cast-level characterization cases in `src/engine/cast.test.ts` and make no production
changes unless those tests expose a regression.

1. Strengthen the existing default-config, diff-producing cast case into the exact field-failure
   oracle: mocked primary Claude dispense, omitted complement registry, real Git/effect/diff/
   resolution/settlement/ledger paths, successful returned summary, exact skipped marker, and
   complete artifact/record consistency assertions.
2. Add a companion provisioned-reviewer case whose reviewer delegates to the real
   `dispenseOpenAICompat` transport against a freshly closed loopback port. Await the whole cast and
   assert `missing-capability`, one ledger row, retained artifact consistency, actionable andon,
   and no rejected cast promise.

This directly closes the gap without changing runtime behavior already supplied by the dependency
chain.

## Design goals

- Reproduce the rc.4 field-failure shape at the public `castPlay` boundary.
- Spend no model tokens.
- Never launch Claude.
- Exercise default complement resolution without injecting a reviewer registry.
- Prove default configuration does not require localhost:11434.
- Exercise a real reviewer `fetch` rejection in the companion case.
- Keep the fetch local and fast.
- Avoid reliance on whether Ollama is installed or running.
- Avoid process-global environment mutation.
- Preserve real effect, Git capture, settlement, artifact reconciliation, ledger append, and revive.
- Assert durable facts rather than only internal call counts.
- Keep all production interfaces unchanged.

## Non-goals

- Do not change successful cross-review verdict semantics.
- Do not add retries.
- Do not add persisted reviewer configuration.
- Do not add CLI reviewer flags.
- Do not modify the default OpenAI-compatible endpoint.
- Do not alter run-log schema.
- Do not introduce a manual release probe if the in-suite proof works.
- Do not replace existing focused resolver or transport unit tests.
- Do not remove the existing throwing-reviewer stub test.

## Option 1 — rely on the current tests unchanged

The current suite already has:

- an inert default-resolution cast test;
- a provisioned reviewer whose `dispense` throws;
- resolver unit coverage;
- OpenAI-compatible request/stream pure-helper coverage.

Advantages:

- no new code;
- no network-shaped test behavior;
- fastest suite.

Disadvantages:

- default-config cast coverage does not pin artifact/record consistency;
- reviewer failure is injected after transport rather than produced by real `fetch`;
- the exact field-failure composition remains unproven;
- this is the gap explicitly named by the ticket.

Decision: reject. The existing tests are prerequisites, not acceptance for this ticket.

## Option 2 — call the real default localhost:11434 endpoint

Run the default cast or a provisioned reviewer with the shipped base URL and assume no listener.

Advantages:

- exact production default URL;
- no test helper needed;
- real fetch semantics.

Disadvantages:

- machines running Ollama would produce a different result;
- a local service might accept the request and make the test model-dependent;
- the default-inert case should not fetch at all, so contact with 11434 is not required evidence;
- environmental flakiness would undermine the regression gate.

Decision: reject. The test must prove 11434 is not required, not require it to be empty.

## Option 3 — mock or spy on global `fetch`

Install a fetch mock that records or rejects any reviewer request.

Advantages:

- deterministic;
- simple failure injection;
- no sockets.

Disadvantages:

- the shipped defect survived because the reviewer fetch path was mocked;
- a mock does not prove request construction plus runtime fetch rejection behavior;
- a process-global spy can interfere with other tests;
- it would silently narrow the story's “real fetch semantics” requirement.

Decision: reject for the companion case. The default-inert case also needs no spy because a null
resolution structurally prevents reviewer construction and dispense.

## Option 4 — retain only a throwing reviewer executor stub

Use the current `throwingCrossReviewRegistry` fixture as the companion acceptance case.

Advantages:

- deterministic;
- already present;
- directly proves a rejected reviewer promise is caught;
- no networking.

Disadvantages:

- bypasses `dispenseOpenAICompat` and global fetch;
- does not characterize the actual endpoint-unreachable failure class;
- does not close the ticket's stated mock gap.

Decision: retain as focused regression coverage, but do not count it as the new companion case.

## Option 5 — use a fixed low localhost port

Configure the real transport to use `http://127.0.0.1:1/v1` or another normally closed port.

Advantages:

- real fetch;
- usually immediate connection refusal;
- no server setup.

Disadvantages:

- still assumes a fixed port is unused;
- privileged or unusual environments may bind it;
- less explicit than obtaining an unavailable endpoint for the test.

Decision: reject in favor of a dynamically reserved loopback port.

## Option 6 — external unroutable address

Use an RFC TEST-NET IP or invalid DNS name.

Advantages:

- no local port reservation;
- real fetch.

Disadvantages:

- failure latency depends on routing and DNS;
- may hang until the 60-second cast budget;
- may involve external network policy;
- violates the local, deterministic character of the test.

Decision: reject.

## Option 7 — reserve and close a loopback port, then use real fetch

Create a Node TCP server on `127.0.0.1` with port `0`, read the assigned port, close the server,
then configure a reviewer delegate to call `dispenseOpenAICompat` using that base URL.

Advantages:

- real request construction and fetch rejection;
- no external network;
- no dependency on port 11434;
- no process-global environment mutation;
- connection refusal is fast;
- test controls endpoint selection through an existing function parameter;
- primary executor remains a pure stub.

Disadvantages:

- small theoretical race between closing the reservation and fetch;
- adds a short async test helper;
- depends on ordinary loopback socket availability.

Decision: choose. This is the strongest practical in-suite proof with the current transport seam.

## Default-config characterization design

Use the existing BAML-free `boardPlanPlay` fixture because it already provides the needed full
cast shape:

- parsed primary result;
- named play gate;
- real effect;
- two created business artifacts;
- reported artifact paths;
- real Git capture.

Call `castPlay` with:

- a real temporary Git root;
- a test-specific run ID;
- a test-specific run-log path;
- `stubExecutor(..., "claude")` as the only model mock;
- no `crossReviewRegistry` property.

The absence of `crossReviewRegistry` is the production default configuration under test. Other
path/run-id overrides merely isolate filesystem outputs and do not alter reviewer policy.

Assert:

- returned outcome is `success`;
- materialization is true;
- returned captured diff is the expected repository-relative reference;
- captured diff exists;
- patch text names both landed files;
- ledger contains exactly one line;
- row outcome is `success`;
- row reference equals summary reference;
- revived reference equals summary reference;
- no artifact discrepancy exists;
- no cross-vendor verdict exists;
- exact skipped marker exists;
- exact skipped marker revives;
- ordinary authored gate evidence is unchanged.

The test need not inspect or mock fetch. The real resolver returns null before any reviewer exists.
Its success is independent of a service on port 11434, which is the requirement.

## Provisioned-unreachable characterization design

Add a private helper that returns an explicit two-seat `ExecutorRegistry`.

- `claude` entry supplies an unused primary factory, satisfying author-seat configuration.
- `openai-compat` entry supplies a reviewer executor with the stable real ID.
- Its probe is irrelevant to review dispatch and may return `{ ok: true }` as interface boilerplate.
- Its `dispense` records options and calls `dispenseOpenAICompat(opts, dedicatedEnv)`.
- The dedicated env contains only `VEND_OPENAI_BASE_URL` pointing to the closed loopback endpoint.
- The transport still builds and executes the real fetch.

Call `castPlay` with the same real Git fixture and mocked primary Claude executor, plus that explicit
registry.

Await the whole call through `captureStdout`. A returned summary rather than a rejected promise is
the cast-level no-unhandled-rejection proof used by the existing suite. The rejected fetch promise
must be consumed inside the settlement path for the action to return normally.

Assert:

- exactly one reviewer dispense call occurred;
- reviewer prompt includes the captured patch paths;
- result outcome is `missing-capability`;
- materialization remains true;
- captured diff reference is preserved;
- artifact exists and contains both paths;
- stdout contains the named missing-capability andon;
- stdout identifies the Codex reviewer and OpenAI-compatible endpoint;
- stdout includes the repair hint;
- stdout has no stack;
- ledger contains exactly one row;
- row outcome is `missing-capability`;
- row and summary artifact references agree;
- revived record preserves the reference;
- no artifact discrepancy exists;
- no reviewer verdict exists;
- no skipped marker exists because a reviewer did resolve.

## Loopback endpoint helper

Use `createServer` from `node:net`.

The helper algorithm:

1. Create a TCP server with no connection behavior needed.
2. Listen on port `0` and host `127.0.0.1`.
3. Await the `listening` event.
4. Read `server.address()`.
5. Require an address object rather than a Unix-socket string/null.
6. Close the server and await its close callback.
7. Return `http://127.0.0.1:<assigned-port>/v1`.

Errors from listen or close should reject the helper rather than being swallowed. A helper failure
is a test-infrastructure failure, not a product outcome.

## Purity and shell assessment

No production purity boundary changes.

- Runtime judgment remains in existing pure cast-core helpers.
- Reviewer routing remains in the pure resolver policy module.
- Fetch remains in the OpenAI-compatible impure shell.
- Git/artifact/ledger work remains in the cast impure shell.
- New socket allocation is test-only infrastructure.
- Assertions observe public summary, stdout, artifact, and ledger surfaces.

## Compatibility

- Existing pass/fail reviewer tests remain unchanged.
- Existing throwing-stub reviewer test remains unchanged.
- Existing default resolver unit tests remain unchanged.
- Existing default executor selection remains unchanged.
- No historical run-log bytes change.
- No test needs a model endpoint.
- No test needs credentials.
- No test needs tokens.
- No release or manual acceptance command is introduced.

## Verification strategy

Run the focused cast suite first:

```bash
bun test src/engine/cast.test.ts
```

Run static diff hygiene:

```bash
git diff --check -- src/engine/cast.test.ts
```

Run the authoritative repository gate before commit:

```bash
bun run check
```

Commit the sole ticket-owned source file with:

```bash
lisa commit-ticket \
  --ticket-id T-076-02-03 \
  --message "test(engine): characterize no-network cross-review settlement (T-076-02-03)" \
  --include src/engine/cast.test.ts
```

Then run `bun run check` again against committed `HEAD` and inspect the commit paths.

## Final decision

Choose the test-only design with one strengthened default-inert oracle and one new real-fetch,
closed-loopback reviewer-failure oracle. It closes the exact field gap while keeping 11434,
external networks, credentials, model tokens, and production changes out of the suite.
