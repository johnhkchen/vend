# Review — T-069-01-04

## Outcome

T-069-01-04 is complete against its ticket acceptance criteria.

The direct decompose run now accepts an optional Lisa agent-routing seat, carries it through input
assembly, and passes it into the materializer. A known `codex` seat is stamped onto every generated
ticket. An unknown seat is refused by the materializer's existing first-operation guard, translated
by the real decompose effect into `{ ok: false, outcome: "unknown-seat" }`, and leaves zero output.

The full repository gate is green.

## Acceptance assessment

### `RunOutcome` includes `unknown-seat`

Met.

- `RUN_OUTCOMES` contains the literal `unknown-seat`.
- `RunOutcome` derives from that tuple, so the union includes it.
- `buildRunRecord` accepts it through the existing tuple-driven test.
- A new explicit test makes the ticket-specific literal visible.
- Arbitrary unknown outcomes remain rejected by the run-log boundary.

### Known seat reaches materialized ticket frontmatter

Met.

- `RunOptions` now has `readonly agent?: string`.
- `assembleAndCast` maps that option through the production `contextSourcesForRun` adapter.
- `assembleInputs` preserves the supplied field on `DecomposeInputs`.
- `decomposeEffect` passes `ctx.inputs.agent` as the fourth `materialize` argument.
- The production-effect test uses `agent: "codex"`.
- It observes the value before and after input assembly.
- It drives the actual `decomposeEffect`, not a duplicated fixture catch arm.
- It reads the generated ticket and pins:

```text
priority: high
agent: codex
phase: ready
```

- It asserts exactly one `agent: codex` line.
- It asserts the generated story has no `agent:` line.
- It verifies the validator receives the correct project root after a successful write.

### Unknown seat becomes a named andon with zero output

Met.

- The test assembles `ctx.inputs.agent` as `"gpt"`.
- The real effect passes the raw value to the canonical materializer guard.
- `materialize` throws the dependency-provided `UnknownSeatError` before board reads or writes.
- `decomposeEffect` catches only that typed error for this relabel.
- The returned result has `ok === false`.
- The returned outcome is exactly `unknown-seat`.
- The detail identifies the offending `gpt` value.
- The validator spy records zero calls.
- Neither the stories directory nor tickets directory exists afterward.
- No cleanup behavior is needed because the refusal structurally precedes creation.

## Changes by file

### Created: `src/play/decompose-effect.ts`

Extracted the existing world-touching effect from the BAML-bearing play module.

The module now owns:

- `ValidateResult`;
- `LisaValidator`;
- `lisaValidate`;
- `decomposeEffect`.

Existing graph canonicalization, graph-integrity refusal, external `after` validation, collision
relabeling, bare-code relabeling, Lisa validation behavior, and unexpected-error propagation were
preserved.

New behavior:

- pass `ctx.inputs.agent` to `materialize`;
- catch `UnknownSeatError`;
- return the named `unknown-seat` outcome.

The optional validator dependency defaults to the real Lisa subprocess, so production behavior is
unchanged while tests can remain deterministic and external-process-free.

### Created: `src/play/decompose-effect.test.ts`

Added two addon-free filesystem tests against the real production effect:

1. known `codex` seat transport and materialized-byte proof;
2. unknown `gpt` seat relabel and zero-output proof.

Generated BAML imports are type-only. The test therefore honors the repository's native-addon test
constraint while covering the exact effect requested by the ticket.

### Modified: `src/play/decompose-epic.ts`

- Added optional `agent` to `RunOptions`.
- Replaced inline assembly-source construction with `contextSourcesForRun`.
- Passed both existing `after` and new `agent` values into that adapter.
- Imported the extracted `decomposeEffect` for `decomposeEpicPlay.effect`.
- Re-exported `lisaValidate` and `ValidateResult` for compatibility.
- Removed the moved effect, validator, and effect-only imports.

The BAML request/parse integration, play registration, budgets, tool scope, and cast options were
not changed.

### Modified: `src/play/project-context.ts`

Added the pure addon-free `contextSourcesForRun` adapter and its input interface.

The adapter:

- always carries `epicPath` and `projectRoot`;
- conditionally carries `after`;
- conditionally carries `agent`;
- performs no seat validation;
- preserves absence as no own optional property.

This creates direct coverage for the run-to-input link without importing the BAML-bearing play
module into Bun tests.

### Modified: `src/log/run-log.ts`

- Added `unknown-seat` to `RUN_OUTCOMES`.
- Documented its source and pre-write meaning.
- Kept schema version 1.
- Changed no record fields or serialization behavior.

### Modified: `src/log/run-log.test.ts`

- Added an explicit assertion that `RUN_OUTCOMES` contains `unknown-seat`.
- Existing tuple-driven coverage also constructs and validates a record with that outcome.

### Created work artifacts

- `research.md`;
- `design.md`;
- `structure.md`;
- `plan.md`;
- `progress.md`;
- this `review.md`.

No production or test files were deleted.

## Architecture review

### Pure core, impure shell

The result follows the repository house rule.

- Seat membership remains pure in `agent-seat.ts`.
- Direct-run object mapping is pure in `project-context.ts`.
- Input filesystem reads remain in `assembleInputs`.
- Board filesystem writes remain in `materialize`.
- Lisa subprocess behavior remains in `lisaValidate`.
- Expected error translation remains at the concrete play effect boundary.
- The generic engine remains unaware of Lisa seat semantics.

### Validation authority

There is still one canonical seat membership check at the write boundary.

The run adapter does not prevalidate. The effect does not duplicate `KNOWN_SEATS`. Raw optional
input reaches `materialize`, which owns both the guard and typed error. This avoids vocabulary drift
and preserves the guarantee that refusal precedes every board operation.

### Executor agnosticism

The new `agent` value remains Lisa allocation metadata. It does not select Vend's cast executor,
touch executor registries, or add a Claude-specific assumption. The settled seat contract continues
to allow `claude | codex`.

### Error honesty

Only `UnknownSeatError` is relabeled as `unknown-seat`.

- Collision remains `id-collision`.
- Bare charter code remains `bare-code`.
- Graph problems remain `graph-invalid`.
- Unexpected filesystem or programming errors still throw.

The change does not hide unrelated failures under the new label.

## Test coverage

### New direct coverage

`src/play/decompose-effect.test.ts` covers:

- direct-run source adapter with a supplied seat;
- assembled input field value and own-property presence;
- the real effect's known-seat path;
- actual ticket frontmatter bytes;
- exact placement after `priority:`;
- one stamp per ticket;
- no story stamp;
- successful validator invocation;
- raw unknown-seat transport;
- exact named outcome;
- detail carrying the offending seat;
- validator not invoked after refusal;
- no story output directory;
- no ticket output directory;
- optional source omission retains no own `agent` property.

### Existing regression coverage retained

- `agent-seat.test.ts` pins known/unknown seat vocabulary and assembly omission.
- `materialize.test.ts` pins direct known-seat stamping and `UnknownSeatError` before mkdir.
- `decompose-epic.test.ts` pins the pure graph and run classification core.
- `run-log.test.ts` pins all outcome validation and record round trips.
- The full suite covers downstream outcome maps and ledger consumers.

### Focused verification

Command:

```bash
bun test src/play/decompose-effect.test.ts src/play/agent-seat.test.ts \
  src/play/materialize.test.ts src/play/decompose-epic.test.ts src/log/run-log.test.ts
```

Result:

- 163 passed;
- 0 failed;
- 359 assertions.

### Type and whitespace verification

- `bun run build` — PASS.
- `git diff --check` — PASS.
- `git show --check 6ee4bef` — PASS.

### Full repository gate

Command:

```bash
bun run check
```

Result:

- BAML client generation — PASS.
- TypeScript typecheck — PASS.
- 1611 tests passed.
- 1 test skipped: the existing dist-only acceptance integration because no `dist/` artifacts exist.
- 0 tests failed.
- 4856 assertions.

## Commit record

- `6ee4bef feat(play): relabel unknown decompose agent seats (T-069-01-04)`
  - production implementation;
  - tests;
  - Research, Design, Structure, Plan, and implementation progress artifacts.

The final review/progress handoff is committed separately after this document is written.

## Compatibility

- Existing `RunOptions` callers may omit `agent`.
- An omitted seat still creates no `agent` input property through the new adapter.
- The dependency materializer still emits no `agent:` key when omitted.
- Existing `after` transport and behavior are preserved.
- `lisaValidate` remains available from `decompose-epic.ts` through re-export.
- `ValidateResult` remains available from the same module as a type re-export.
- Run-log historical records remain readable.
- No run-log record field changed.
- No schema migration is required.

## Open concerns and honest boundary

There are no critical implementation concerns or known acceptance gaps.

The deliberate boundaries remain:

- CLI parsing and dispatch of `--agent` are not implemented here; downstream `T-069-01-05` owns
  both direct-run and chain CLI plumbing.
- The chain's option field is sibling `T-069-01-03` work and was not altered.
- The known-seat vocabulary remains only `claude | codex`.
- Lisa dispatch behavior was not changed or re-proven; Lisa already consumes ticket `agent:`
  metadata according to the story contract.
- The proof is fixture-based and token-free.
- A live metered cast that verifies real Codex routing remains a deferred, human-authorized story
  boundary.
- The extracted effect test injects Lisa validation; it proves effect sequencing and bytes, not the
  external Lisa binary's behavior. Existing repository validation coverage owns that boundary.

## Worktree hygiene

The repository had Lisa-managed worktree changes before implementation:

- `.lisa/provenance.jsonl`;
- active ticket phase transitions;
- the materialized E-069 epic and S-069-01 story.

They were preserved and excluded from the implementation commit. This ticket's phase/status
frontmatter was not manually edited. Lisa remains responsible for artifact-driven transitions.

## Final judgment

Green. The ticket acceptance is met, the behavior is directly tested at the real effect boundary,
the full gate passes, and no critical issue requires human attention before Lisa advances the work.
