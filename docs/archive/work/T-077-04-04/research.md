# Research — T-077-04-04

## Assignment and workflow

- The ticket begins in Research and must proceed through every remaining RDSPI phase continuously.
- Attempt artifacts belong under `.lisa/attempts/T-077-04-04/1/work/` only.
- Lisa owns publication into `docs/active/work/` and ticket phase/status transitions.
- Ticket source commits must use `lisa commit-ticket` with exact repository-relative include paths.
- Ordinary `git add` and `git commit` are forbidden for ticket-owned work.
- The authoritative repository gate is `bun run check`.
- Existing modifications to `.lisa/provenance.jsonl` and the ticket frontmatter are Lisa-owned.

## Product and story contract

- Vend is a local-first clearing house for reusable, gated agent work.
- The product promise is repeatability over probabilistic execution.
- Gates, not live supervision, are the contract that makes autonomous output dependable.
- Budget is a hard contract: already-paid output must not be regenerated without need.
- Parent story S-077-04 owns resumable decompose across persistence, cleanup, doctor, and resume.
- T-077-04-01 created the versioned draft ledger and post-gate checkpoint.
- T-077-04-02 added success settlement and active-state reconciliation.
- T-077-04-03 added the doctor check and fixed the public recovery command.
- This ticket owns only the final resume execution path.
- Repair, regeneration, and auto-fix loops are explicitly out of scope.
- Gate taxonomy, token labels, budget semantics, and other doctor behavior are out of scope.

## Required observable behavior

- `vend run decompose-epic <epic> --resume` must be accepted without a new budget argument.
- The command spelling is already emitted by the doctor probe.
- The `<epic>` value in that hint is the stored draft's epic identifier, such as `E-077`.
- Resume must load the latest active draft for that epic.
- Resume must not render a new prompt.
- Resume must not probe or dispense an executor.
- Resume must not meter or parse a new executor result.
- Resume must rerun the play's gates over the stored parsed output.
- A gate CLEAR must authorize the existing effect/materialization path.
- A gate STOP must remain a normal gate-failed andon.
- A successful materialization must append the existing settlement marker.
- The public active-draft reader must then return no draft for that epic.

## Existing draft store

- `src/engine/decompose-draft.ts` owns `.vend/decompose-drafts.jsonl`.
- Draft rows are schema version 1.
- A draft row contains `runId`, `epic`, `parsedDraft`, `gateFindings`, repair metadata, and time.
- `parsedDraft` is deliberately opaque at the store boundary except that it must be an object.
- Gate findings preserve the native CLEAR or STOP verdict.
- Settlement rows are also schema version 1 and have `kind: "settled"`.
- Settlement is epic-scoped and append-only.
- `readDecomposeDrafts` reconciles draft and settlement rows in append order.
- `loadDecomposeDrafts` returns active recovery state, not raw ledger history.
- `latestDecomposeDraft(records, epic)` selects the latest active record for one epic.
- A later draft after settlement becomes active again naturally.
- Missing stores read as empty; malformed or future rows are skipped.

## Existing cast pipeline

- `src/engine/cast.ts` owns the generic impure cast shell.
- Its cold path is tools → executor resolution/probe → render → dispense → meter → parse → gates.
- Classification then decides whether effect is authorized.
- The shared settlement tail captures diffs, prints effect facts, applies optional cross-review,
  writes the terminal run record, and returns a `RunSummary`.
- Decompose checkpoint capture currently happens after parse and gates, before classification/effect.
- Decompose settlement currently happens only after materialization and final success.
- That settlement uses `settleDecomposeDraft`, so resume should reuse it rather than duplicate cleanup.
- The cast already imports the stable `RESUMABLE_DECOMPOSE_PLAY` identity.
- The engine still does not import a concrete play or BAML runtime.

## Cast values relevant to a resume

- `CastContext` contains the typed play inputs and project root.
- Gates and effect share that one context.
- Resume still needs current epic and charter text for gate recomputation and materialization.
- Resume also needs the current project root for filesystem effects.
- The stored draft supplies the already-parsed play output.
- No executor result exists on resume, so usage and cost are honestly zero.
- No executor seat exists on resume, so executor-seat provenance remains absent.
- No transcript is warranted because no transport events occur.
- The ordinary terminal run row can still record the gate/effect result.

## Existing concrete play assembly

- `src/play/decompose-epic.ts` owns `assembleAndCast`.
- `assembleAndCast` calls `assembleInputs` using the epic path, charter, and project snapshot.
- It derives the canonical subject through `epicIdOf`.
- It then calls the generic `castPlay`.
- The doctor hint supplies an epic ID rather than the normal markdown path.
- Epic cards live under `docs/active/epic/<id>.md`.
- Therefore the resume assembly path must map a bare ID to that canonical card path.
- An explicit markdown path should remain usable for direct/manual invocation.

## Concrete decompose output

- The production play parses to `{ plan, degrades }`.
- `plan` is the generated BAML `WorkPlan` used by gates and effect.
- `degrades` carries editorial cite dispositions into terminal settlement.
- A checkpoint captures that complete normalized output, not only `WorkPlan`.
- Reusing the stored object therefore preserves parse-time normalization and degradation evidence.
- Running parse again would be both unnecessary and impossible without regenerating raw text.

## Effect inputs and honest boundary

- `decomposeEffect` reads the epic body to derive the materialized epic ID.
- It reads the charter snapshot for materialized prose.
- It may read optional `after` and `agent` input fields.
- The v1 draft record does not persist original `after` or `agent` flags.
- The story's fixed resume gesture carries only the epic and `--resume`.
- This ticket cannot reconstruct optional cold-run flags that were not stored by its dependency.
- It must not invent them or extend the schema outside the story's settled dependency contract.
- The ordinary resume path therefore assembles current base inputs with those options absent.
- That limitation should be surfaced in review rather than hidden.

## CLI parsing and dispatch

- `src/cli.ts` keeps argument parsing pure and addon-free.
- Cold `run` currently requires `--budget` and produces a parsed `Budget`.
- The current run parser recognizes presence flags independently of budget ordering.
- The CLI prints a funding line before cold dispatch.
- `src/play/dispatch.ts` resolves the play from the registry.
- Cold dispatch passes through `withFundingCounter` before `assembleAndCast`.
- Resume performs no executor work, so it should not print a new funding allocation.
- Resume should not pass through the measured funding warning intended for a cold dispense.
- The play's authored budget can remain the structural envelope passed into the shared cast/log API.
- Actual resume usage remains `{}` and cost remains zero.

## Expected no-draft behavior

- A doctor hint can become stale if another run settles the draft before the command starts.
- Missing active recovery state is expected user input/state, not a programmer exception.
- The CLI should return a named, concise refusal rather than a stack trace.
- The dispatch result already models expected registry failure as data.
- Resume can add an analogous `no-draft` result.

## Testing conventions

- `src/engine/cast.test.ts` uses BAML-free fixture plays and injected token-free executors.
- It already tests checkpoint creation, timeout retention, and success settlement.
- A resume fixture can seed the public store, inject an executor that records forbidden calls,
  provide the stored draft to `castPlay`, and observe gates/effect/settlement.
- This proves the acceptance path without loading generated BAML or spending tokens.
- `src/cli.test.ts` directly pins parsed command shapes and usage text.
- The parser tests can prove the exact doctor command needs no budget.
- Store tests already prove latest selection and settlement reconciliation.

## File ownership

- `src/engine/cast.ts` is the shared cast bypass and settlement reuse seam.
- `src/engine/cast.test.ts` is the main acceptance proof.
- `src/play/decompose-epic.ts` owns epic-ID resolution, draft lookup, and cast assembly.
- `src/play/dispatch.ts` owns registry/no-draft dispatch and funding-counter bypass.
- `src/cli.ts` owns `--resume` syntax, help text, and shell routing.
- `src/cli.test.ts` owns pure parser and help assertions.
- No draft-store schema change is required.
- No doctor file change is required; its command is already fixed.

## Research conclusion

- Resume should be a source-mode on the existing generic cast, not a second settlement engine.
- The source-mode must bypass every cold executor step while joining immediately before gates.
- The concrete play shell should load the latest active record after resolving the epic identifier.
- Dispatch should return missing recovery state as data and skip cold funding presentation.
- Tests should prove call order: no probe/dispense/parse, then gates, effect, settlement, empty active store.

