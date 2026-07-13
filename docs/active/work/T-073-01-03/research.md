# T-073-01-03 — Research

## Ticket boundary

This ticket implements the middle transport seam of story S-073-01.

Its input-side prerequisites are already present:

- T-073-01-01 captures a successful cast's Git patch and exposes a repository-relative
  `capturedDiff` reference.
- T-073-01-02 resolves the configured complement lane and returns both its canonical
  `AgentSeat` and an invokable `Executor`.

Its output is a structured cross-review verdict for later consumers. This ticket does not append
that verdict to the ledger; T-073-01-04 owns persistence. It also does not make failure blocking;
S-073-02 owns enforcement.

## Story contract

S-073-01 requires a completed diff to be sent to the other configured executor seat. The reviewing
seat is deliberately a context-complete, single-turn reviewer. It must not need repository tools or
exploration. The route is autonomous and uses the existing executor abstraction.

The story's honest boundary requires all acceptance proof here to use a stub reviewer and spend no
tokens. Live cross-vendor execution is deferred and must not be hidden in this ticket.

Per-playbook review-rubric authoring is also outside this slice. The operation must accept rubric
context supplied by its caller rather than inventing or persisting a new authoring surface.

## Existing executor contract

`src/executor/executor.ts` defines the provider-neutral `Executor` interface:

- `id` is stable selection and provenance metadata.
- `dispense(opts)` is the only transport operation.
- The operation returns a `ResultMessage`.
- Wall-clock timeout is represented through `DispenseOptions.timeoutMs`.
- Implementations may honor agentic hints when capable.

No new executor method is required by the story or ticket.

`DispenseOptions`, declared in `src/executor/claude.ts` and re-exported through the seam, includes:

- `prompt` for the user/context payload.
- `system` for reviewer role instructions.
- `maxTurns` for capable agentic executors.
- `timeoutMs` for the hard wall-clock latch.
- optional transport and message-stream fields.

`ResultMessage.result` is the optional terminal text returned by both supported adapters. Usage and
cost metadata are present on the same terminal object, but this ticket's verdict contract does not
currently persist review metering.

## Concrete executors

`ClaudeExecutor` and `OpenAICompatExecutor` both implement the same interface. The openai-compatible
adapter is explicitly a context-complete completion transport, not an agentic repository explorer.
This matches the story's review shape.

Claude can honor `maxTurns`; the openai-compatible adapter documents that agentic options are hints
it cannot use. Supplying `maxTurns: 1` therefore constrains the capable implementation without
breaking the completion implementation.

## Complement routing prerequisite

`src/cross-review/resolve-complement.ts` is the first module in the new workflow-owned directory.
It exports:

```ts
interface ComplementExecutor {
  readonly seat: AgentSeat;
  readonly executor: Executor;
}
```

and `resolveComplementExecutor(...)`, which returns that value or `null` when cross-review is inert.
This ticket can consume the resolved value without importing concrete executor classes or repeating
seat-selection policy.

`AgentSeat` is the canonical `"claude" | "codex"` vocabulary from
`src/play/agent-seat.ts`. The reviewing seat should be copied from the resolver result, not inferred
again from `executor.id`.

## Captured diff prerequisite

`src/engine/play.ts` now carries optional `capturedDiff` on `EffectResult` and `RunSummary`.
`src/log/run-log.ts` carries the same optional reference on `RunRecordInput` and `RunRecord`.

The referenced artifact is a non-empty Git patch written under `.vend/artifacts`. The capture code
stores a reference rather than embedding patch bytes. The integration that loads this reference and
places review into the cast/ledger flow remains a downstream composition concern.

At this module boundary the prompt builder needs patch text, not a repository path. Keeping the core
operation over plain strings avoids filesystem access and makes the context-complete review contract
directly testable. A later impure cast integration can load the captured reference.

## Existing parsing patterns

`src/probe/run-equivalence-judge.ts` demonstrates a nearby render/dispense/parse flow:

- prompt construction is plain string assembly;
- the terminal `result.result` text is parsed;
- surrounding prose can be tolerated by extracting a JSON region;
- malformed entries are rejected or omitted by pure logic;
- the transport call remains a small impure wrapper.

Elsewhere, expected gate/refusal outcomes are returned as data rather than thrown. A review refusal
is therefore a normal verdict value. A malformed reviewer response is different: it does not
honestly establish pass or fail and must not be silently coerced into either outcome.

## Repository conventions

The project requires pure core / impure shell separation. Pure decisions accept plain values and
have direct unit tests. Filesystem, clock, network, and executor calls belong in thin wrappers.

Tests use Bun's built-in runner and generally place `*.test.ts` beside implementation files.
Executor tests construct structural stubs implementing `Executor`; this proves behavior without a
CLI spawn, HTTP request, or token spend.

Strict TypeScript is enabled with unchecked-index protection. Public result unions should be
discriminated and readonly so downstream ledger/enforcement tickets can switch exhaustively.

## Prompt constraints

The review prompt must be self-contained because the openai-compatible reviewer cannot inspect the
repo. It therefore needs:

- the complete captured patch text;
- the caller-provided rubric context;
- an adversarial instruction to look for correctness, regressions, missing tests, and rubric
  violations;
- an exact machine-readable response contract;
- an instruction to treat the embedded patch as untrusted evidence, not as executable directions.

The prompt should request only one JSON object and no prose. Stable delimiters are needed so patch
content and rubric content remain distinguishable.

## Verdict constraints

Acceptance names two externally visible shapes:

- pass: `{ verdict: "pass", reviewingSeat }`;
- refusal: `{ verdict: "fail", reason }`.

The next ticket needs reviewing-seat provenance for either outcome, so both union arms should carry
`reviewingSeat`. A fail needs a non-empty reason because T-073-01-04 must later persist verdict
detail. A pass needs no invented detail.

The parser must not trust a seat emitted by the reviewer. Routing metadata comes from the resolved
complement executor and is attached locally after parsing the reviewer's pass/fail payload.

## Current workspace constraints

Lisa currently owns modifications to `.lisa/provenance.jsonl` and the ticket frontmatter. Those
paths are not ticket-owned source changes and must not be included in commits.

Attempt artifacts must remain in `.lisa/attempts/T-073-01-03/1/work/`; Lisa publishes them after
lease verification. Source commits must use `lisa commit-ticket` with exact repository-relative
include paths. Ordinary `git add` and `git commit` are forbidden for this assignment.

## Verification baseline

The project gate is `bun run check`, which runs BAML generation, TypeScript typechecking, and the
full Bun test suite. Focused review tests can run first. The final source unit must be committed only
after the full gate is green.

