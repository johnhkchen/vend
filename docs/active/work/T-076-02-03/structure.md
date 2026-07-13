# T-076-02-03 Structure — no-network characterization test

## File inventory

| Path | Action | Responsibility |
|---|---|---|
| `src/engine/cast.test.ts` | modify | cast-level default-inert and real-fetch unreachable-reviewer characterization |
| `.lisa/attempts/T-076-02-03/1/work/research.md` | create | repository and contract map |
| `.lisa/attempts/T-076-02-03/1/work/design.md` | create | options and selected test design |
| `.lisa/attempts/T-076-02-03/1/work/structure.md` | create | this file blueprint |
| `.lisa/attempts/T-076-02-03/1/work/plan.md` | create | ordered implementation and verification steps |
| `.lisa/attempts/T-076-02-03/1/work/progress.md` | create | implementation and gate evidence |
| `.lisa/attempts/T-076-02-03/1/work/review.md` | create | final acceptance handoff |

No production module is planned for modification.

## Repository ownership boundary

- `src/engine/cast.test.ts` is the sole ticket-owned repository source path.
- Private phase artifacts are attempt state and are not included in the source commit.
- `docs/active/tickets/T-076-02-03.md` is Lisa-owned transition state.
- `.lisa/provenance.jsonl` is Lisa-owned provenance state.
- Published `docs/active/work/T-076-02-03/` files, if they appear, are Lisa-owned.
- Unrelated dirty paths must remain untouched.

## Import changes in `src/engine/cast.test.ts`

### Node networking import

Add:

```ts
import { createServer } from "node:net";
```

Purpose:

- acquire an operating-system-selected loopback port;
- close it before the reviewer fetch;
- avoid any fixed-port assumption;
- keep socket setup in test infrastructure only.

### OpenAI-compatible transport import

Add:

```ts
import {
  dispenseOpenAICompat,
  OPENAI_BASE_URL_ENV,
} from "../executor/openai-compat.ts";
```

Purpose:

- invoke the real reviewer transport;
- pass an isolated environment record;
- avoid duplicating the environment key string;
- avoid constructing a production adapter that hard-wires `process.env` into `dispense`.

No production export changes are needed because both symbols already exist.

## Helper: `closedLoopbackOpenAIBaseUrl`

### Placement

Place near `initGitRepo`, alongside other impure temporary-infrastructure helpers.

### Signature

```ts
async function closedLoopbackOpenAIBaseUrl(): Promise<string>
```

### Internal structure

```text
create server
  → await listen on 127.0.0.1:0
  → inspect assigned address
  → await close
  → return http://127.0.0.1:<port>/v1
```

### Event ownership

- Register a one-shot `error` handler before `listen`.
- Register a one-shot `listening` handler.
- On listen success, remove the temporary error listener or let one-shot lifecycle expire safely.
- Read `server.address()` only after listening.
- Reject if the result is `null` or a Unix socket string.
- Await `server.close` before returning.
- Let setup errors fail the test.

### Contract

- Returned URL uses numeric IPv4 loopback, avoiding IPv4/IPv6 localhost ambiguity.
- Returned URL includes `/v1`, matching `dispenseOpenAICompat`'s base-url contract.
- No server remains listening when the URL is returned.
- No global environment state is modified.

## Helper: real unreachable reviewer registry

### Placement

Place after `throwingCrossReviewRegistry`, beside existing reviewer registry fixtures.

### Signature

```ts
function unreachableOpenAIReviewRegistry(
  baseUrl: string,
  calls: DispenseOptions[],
): ExecutorRegistry
```

### Registry shape

```ts
{
  claude: () => stubExecutor([], "unused author factory", "claude"),
  "openai-compat": () => ({
    id: "openai-compat",
    async probe() { return { ok: true }; },
    async dispense(opts) {
      calls.push(opts);
      return dispenseOpenAICompat(opts, { [OPENAI_BASE_URL_ENV]: baseUrl });
    },
  }),
}
```

### Boundary rationale

- The registry is the existing provisioning seam.
- The Claude entry makes the author seat explicitly configured.
- The OpenAI-compatible ID maps to the Codex complement seat.
- Reviewer construction remains lazy through the resolver.
- The reviewer `dispense` uses the real transport implementation.
- Only endpoint selection is injected.
- The primary execution still uses the separate `opts.executor` stub.
- The reviewer probe is never called by cross-review and is interface completeness only.

## Default-inert test modification

### Name

Rename the current generic test to identify this ticket and field shape, for example:

```text
castPlay: default config needs no 11434 reviewer and records a consistent skipped-review clear
```

Include `T-076-02-03 AC` in the name or adjacent comment for searchability.

### Fixture constants

- Keep one temporary root.
- Keep real Git initialization.
- Keep a dedicated JSONL path.
- Add a stable `runId` constant.
- Add `expectedReference = join(".vend", "artifacts", `${runId}.diff`)`.
- Keep a complete story/ticket fixture.

### Cast options

- `subject`: ticket-specific identifier.
- `projectRoot`: temporary Git root.
- `transcriptDir`: temporary root.
- `runLogPath`: temporary JSONL path.
- `runId`: stable test ID.
- `executor`: primary `stubExecutor` with ID `claude`.
- Deliberately no `crossReviewRegistry` key.

### Summary assertions

- `outcome === "success"`.
- `materialized === true`.
- `capturedDiff === expectedReference`.

### Artifact assertions

- `Bun.file(join(root, expectedReference)).exists() === true`.
- Patch text length is positive.
- Patch contains the story path.
- Patch contains the ticket path.

### Ledger assertions

- Split trimmed file into lines.
- Exactly one line exists.
- Parse that line.
- `outcome === "success"`.
- `capturedDiff === summary.capturedDiff`.
- `artifactDiscrepancy` is absent.
- Ordinary fixture gate row is unchanged.
- `crossVendorVerdict` is absent.
- Exact `crossReviewSkipped` marker is present.
- `reviveRecord` preserves both reference and skipped marker.

## New provisioned-unreachable test

### Placement

Place directly after the default-inert test so the two ticket cases read as a characterization
pair. Existing pass/fail and throwing-stub tests retain their current roles.

### Name

```text
castPlay: a provisioned unreachable reviewer uses real fetch and settles with ledger intact
```

Include `T-076-02-03 AC` in the name.

### Setup

- Create temporary root.
- Initialize real Git repository.
- Compute real closed-loopback base URL.
- Create dedicated ledger path.
- Create stable run ID and expected artifact reference.
- Create call-capture array.
- Create story/ticket fixture with unique IDs.

### Invocation

- Wrap the awaited cast in `captureStdout`.
- Use `boardPlanPlay`.
- Use the high budget.
- Inject primary `stubExecutor(..., "claude")`.
- Inject `unreachableOpenAIReviewRegistry(baseUrl, calls)`.
- Do not mock `fetch`.
- Do not change `process.env`.

### Reviewer assertions

- `calls` has length one.
- Reviewer prompt contains both captured file paths.
- Reviewer `maxTurns` is one.

### Summary assertions

- Invocation returns instead of rejecting.
- `outcome === "missing-capability"`.
- `materialized === true`.
- `capturedDiff === expectedReference`.

### Stdout assertions

- Contains `· andon: missing-capability`.
- Contains `reviewer seat 'codex'`.
- Contains `OpenAI-compatible endpoint`.
- Contains the repair configuration key.
- Contains `run \`vend doctor\``.
- Does not contain `Error:`.
- Does not contain a stack-frame prefix.

The exact platform-specific fetch error string is not pinned. Its wording can vary across Bun and
operating systems; the stable product classification and repair copy are the contract.

### Artifact and ledger assertions

- Artifact exists.
- Patch contains both business paths.
- Ledger has exactly one row.
- Row outcome is `missing-capability`.
- Row reference equals summary reference.
- `reviveRecord` preserves the reference.
- `artifactDiscrepancy` is absent.
- `crossVendorVerdict` is absent.
- `crossReviewSkipped` is absent.
- Primary usage/cost and fixture gate evidence remain present.

## Existing helpers and tests retained

- `throwingCrossReviewRegistry` remains for direct arbitrary rejection coverage.
- `crossReviewRegistry` remains for valid pass/fail coverage.
- `disappearingDiffRegistry` remains for non-reviewer settlement-throw coverage.
- Resolver unit tests remain the narrow policy oracle.
- OpenAI-compatible pure-helper tests remain the transport byte-level oracle.
- No helper is exported from the test module.

## Commit structure

One meaningful ticket-owned source unit exists:

```text
test(engine): characterize no-network cross-review settlement (T-076-02-03)
  └── src/engine/cast.test.ts
```

Use exactly one `lisa commit-ticket` transaction with one exact `--include`.

## Verification structure

1. Focused ticket test names.
2. Complete `src/engine/cast.test.ts` suite.
3. Typecheck or authoritative check.
4. `git diff --check` on the sole source path.
5. Full `bun run check` before commit.
6. Lisa commit transaction.
7. Inspect committed path list.
8. Full `bun run check` after commit.
9. Confirm the sole source path is clean.
10. Write final private review artifact.

## Structure conclusion

The implementation is deliberately one-file and test-only. It composes existing public seams and
real shells into the missing gold-master proof without introducing a second runtime path or any
new production abstraction.
