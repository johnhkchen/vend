# Research — T-077-02-04 degrade-on-run-record

## Assignment and phase

- The ticket begins in `research` and the assignment requires one uninterrupted pass through all
  remaining RDSPI phases.
- Attempt artifacts belong only in `.lisa/attempts/T-077-02-04/1/work/`; Lisa owns publication to
  `docs/active/work/T-077-02-04/` and ticket frontmatter transitions.
- Ticket-owned source commits must use `lisa commit-ticket` with exact repository-relative include
  paths. Ordinary index operations are prohibited.
- The shared worktree is dirty with Lisa metadata and concurrent ticket work. Those paths are not
  evidence of this ticket and must remain untouched.

## Parent-story contract

- `S-077-02` changes only two charter-cite refusal surfaces from discard to degrade:
  inline prose during materialization and dangling/non-goal `advances` entries before gates.
- The whole story requires the resulting board to materialize, with the editorial cite stripped or
  annotated and an exact degradation disposition recorded on the `RunRecord`.
- Structural defects still refuse. The named examples are graph defects, duplicate or missing ids,
  missing required fields, and an absent story contract.
- The honest boundary is fixture-proven and token-free. A live E-045 recast is explicitly excluded.
- Repair, regeneration, progress-label changes, resumable persistence, and epic-card edits are out
  of scope.
- This ticket is the DAG join after the inline and advances applier tickets.

## Charter and vision constraints

- P5 local-first makes `.vend/runs.jsonl` the durable operator evidence. An in-memory array is not
  sufficient acceptance.
- P7 budget-as-contract requires the terminal record to remain the authoritative settlement row;
  degradation data should join that append rather than create a second side channel.
- P3 gates-as-contract remains intact because cite degradation is editorial. Gate and structural
  outcomes must not be relabeled as successful degradation.
- The run remains autonomous: the marker informs the operator after settlement and creates no new
  approval step.

## Shared disposition contract

- `src/play/degrade-disposition.ts` is an addon-free pure module introduced by T-077-02-01.
- `DegradeDisposition` is exactly `{ code, location, action }`.
- `action` is the closed union `"strip" | "annotate"`.
- `classifyCharterCite` distinguishes resolvable, degradable, and structural inputs.
- `materializationDisposition` distinguishes clean materialization,
  `materialized-with-degrades`, and structural refusal.
- Dispositions preserve occurrence order and are not deduplicated; location is provenance.
- The module lives under `src/play`, so the generic engine and decoupled ledger cannot import it
  without reversing the documented dependency direction.

## Inline-prose branch as landed

- `src/play/materialize.ts` now returns `MaterializeResult.degrades` on every successful call.
- Unknown well-shaped charter codes in prose are replaced with `[unresolved charter cite]`.
- Each occurrence produces an `annotate` disposition, with locations such as
  `T-900-01.md#purpose`.
- The retained bare-code scan still protects against unresolved output that escaped the classifier.
- `src/play/decompose-effect.ts` exposes `DecomposeEffectResult.degrades` and forwards the
  materializer list only when nonempty.
- `DecomposeEffectResult` structurally extends the generic `EffectResult`, but the generic cast
  currently sees only `EffectResult` and therefore drops the subtype-only field.
- `src/play/bare-code-cast.test.ts` currently observes the effect dispositions through a callback
  and explicitly says the ledger join is deferred to this ticket.

## Advances branch as landed

- `src/play/decompose-epic-core.ts` owns `stripNonGoalAdvances(plan, charter?)`.
- The function clones only changed tickets and never mutates the input plan.
- Every `N\d+` advance is stripped, even if its non-goal definition resolves in the charter.
- With a charter, other well-shaped unresolved codes are classified and stripped.
- Free text or malformed values remain for existing gates to judge.
- A ticket reduced to no advances is not repaired; the value gate refuses it honestly.
- The function currently returns only the normalized `WorkPlan`. It computes classification but
  discards the corresponding disposition.
- `src/play/decompose-epic.ts` parses BAML output and calls this plan-only normalizer before the
  same output fans into gates and effect.
- Existing direct callers and tests depend on the plan-only return shape, so replacing that API
  outright would create unnecessary migration surface.

## Generic play and cast boundaries

- `src/engine/play.ts` defines the play-agnostic `EffectResult`.
- It already carries optional structured settlement metadata such as `seatDefaulted` and
  `seatInferred`.
- `src/engine/cast.ts` is the one impure cast shell and imports no concrete `src/play` module.
- After a successful effect it captures effect facts into local variables, prints effect and
  warning rows, then appends exactly one terminal `RunRecord` in `finally`.
- The terminal append is deliberately resilient: facts observed before later settlement failures
  are retained and an unexpected settlement error becomes `errored` before rethrow.
- `RunSummary` currently carries outcome, materialized, warning, produced artifact, captured diff,
  and actual cost, but no cite degradation data.
- Early pre-dispense refusals never run an effect, so they cannot legitimately carry cite
  degradation dispositions.

## Run-log boundary

- `src/log/run-log.ts` is deliberately decoupled from engine, budget, executor, and play policy.
- It declares local structural contracts and accepts duck-typed caller data.
- `buildRunRecord` is the pure normalization/write-side boundary.
- `reviveRecord` is the pure read-side compatibility boundary used by `readRuns` and
  `loadRunLog`.
- Optional fields are omitted when absent so old and ordinary record bytes remain compatible.
- Structured optional metadata is normalized atomically; malformed optional metadata is dropped
  without losing the otherwise-valid historical row.
- `appendRunLog` is the single thin filesystem append and `loadRunLog` is the read shell.
- Schema version remains `1`; optional additive fields have historically not bumped it.
- The ledger does not currently know the degradation action vocabulary or disposition array.

## Existing presentation surface

- `src/cli.ts` prints run summary lines in several command branches using the repeated template:
  `run <id>: <outcome> (materialized: <boolean>)`.
- The generic cast shell prints progress/effect/warning rows, but it does not print the final run
  summary; the CLI owns that line.
- `src/cli.test.ts` imports only pure helpers from the CLI and avoids the `import.meta.main` shell.
- No shared formatter currently exists for the repeated run summary template.
- The acceptance phrase is exact: `cleared; N cite(s) degraded`.
- A `RunSummary` needs the disposition list (or count) for the CLI to render this honestly without
  rereading the ledger.

## Test seams

- `src/log/run-log.test.ts` has established suites for optional marker round-trip, byte
  compatibility, malformed metadata, and legacy records.
- `src/engine/cast.test.ts` uses stub executors and real temporary `runs.jsonl` files to prove
  effect-to-ledger propagation.
- `src/play/bare-code-cast.test.ts` is a stronger story-specific seam: stub executor, real gates,
  real materializer, real `castPlay`, no BAML value import, and real filesystem output.
- `src/play/decompose-epic.test.ts` is addon-free and pins the advances normalization behavior.
- `src/cli.test.ts` is suitable for a pure summary-line formatter test.
- The full repository gate is `bun run check`; focused tests can isolate each changed seam first.

## Constraints and assumptions

- The engine must not import `src/play/degrade-disposition.ts`; the concrete play depends on the
  engine, not the reverse.
- The ledger should preserve exact records and occurrence order, not recompute cite policy.
- Clean casts should omit the new optional field and retain the existing summary line.
- An empty degradation list should be treated like absence; the marker is one-way evidence.
- Invalid optional degradation metadata should not make an otherwise useful historical run
  unreadable.
- The real decompose play must merge advances dispositions produced before gates with inline
  dispositions produced during materialization.
- The merged count must reflect every occurrence from both sources.
- Structural gate/refusal fixtures must continue to show no effect, no materialization, and no
  degradation marker.

## Ticket-owned likely files

- `src/play/decompose-epic-core.ts` and its test for a report-producing normalization seam.
- `src/play/decompose-epic.ts` for the real parse/gate/effect wiring that retains advances records.
- `src/engine/play.ts` for a generic structural disposition field on `EffectResult`.
- `src/engine/cast.ts` for effect-to-ledger and effect-to-summary propagation.
- `src/log/run-log.ts` and its test for durable normalized/revived records.
- `src/play/bare-code-cast.test.ts` for the token-free end-to-end acceptance proof.
- `src/cli.ts` and `src/cli.test.ts` for the exact operator summary phrase.

## Research conclusion

The two appliers already make safe editorial transformations, but their information paths differ.
Inline records survive to a concrete effect subtype and are then erased by generic typing. Advances
records are computed even earlier and discarded by a plan-only pure normalizer. The durable join
therefore requires one additional concrete-play output/report seam plus additive generic effect,
summary, and ledger fields. No outcome taxonomy, gate judgment, or structural refusal needs to
change.
