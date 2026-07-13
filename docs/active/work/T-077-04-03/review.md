# Review — T-077-04-03

## Disposition

Pass.

The ticket's single acceptance criterion is met. A project with active persisted decompose recovery
state now gets a red `resumable-decompose: <epic>` doctor check whose hint includes the complete
literal resume command. The probe is separate from cast preflight, composed beside board hygiene,
proved at the pure core and real CLI levels, fully committed, and green under `bun run check`.

## Product outcome

Before this ticket, Vend could persist a paid parsed decompose draft but `vend doctor` did not tell
the operator that the draft was resumable. The visible diagnosis could stop at a bare orphan epic,
which did not identify the locally available recovery action.

After this ticket, active recovery state produces an explicit doctor line such as:

```text
✗ resumable-decompose: E-077 — resume with `vend run decompose-epic E-077 --resume`
```

This advances:

- P4 by making interruption recovery discoverable without live supervision;
- P5 by diagnosing the project-local `.vend/` state through a local command.

The change does not claim that this ticket implements resume. T-077-04-04 owns that execution
path. This ticket surfaces the story-defined command and condition only.

## Files created

### `src/doctor/resumable-decompose-probe.ts`

Adds the separate doctor-only probe.

Responsibilities:

- consume the public active decompose draft view;
- map active epic facts to doctor `Check` values;
- emit the exact resume command in failure hints;
- deduplicate repeated active attempts by epic;
- expose an explicit green no-draft check;
- convert store load rejection to an actionable red check.

Non-responsibilities:

- no graph loading or orphan judgment;
- no JSONL parsing or lifecycle reconciliation;
- no resume, repair, delete, or settlement effects;
- no report rendering or exit-code policy;
- no cast preflight behavior.

### `src/doctor/resumable-decompose-probe.test.ts`

Adds four focused tests over injected persisted-draft facts.

It proves:

- exact red check name;
- exact full resume command;
- shared failed report/exit behavior;
- explicit empty-store green behavior;
- repeated-attempt deduplication;
- deterministic multiple-epic commands;
- loader failure as returned diagnostic data.

## Files modified

### `src/cli.ts`

The normal build-workspace doctor branch now composes:

```text
probeDoctor
probeBoardHygiene
probeResumableDecompose
```

The probes remain independent and run concurrently. Results preserve the established dependency
and board ordering, with recovery checks appended afterward.

The following CLI surfaces are unchanged:

- argument parsing;
- doctor usage;
- kitchen workspace detection and `probeKitchen` branch;
- report rendering;
- stdout and process exit behavior.

### `src/doctor/doctor-cli.smoke.test.ts`

Extends the existing real-process doctor suite with a cwd-aware temporary project fixture.

The new smoke writes a schema-valid checkpoint under the temp root, launches the actual CLI from
that root, and asserts:

- exit code 1;
- failed `resumable-decompose: E-077` output;
- complete `vend run decompose-epic E-077 --resume` output;
- no stack trace or unhandled error;
- cleanup of temporary local state.

## Files deliberately unchanged

### `src/doctor/doctor-probe.ts`

Unchanged. This is load-bearing because `probeDoctor` also protects cast preflight. Recovery state
must be visible in doctor without preventing a repair or resume cast.

### `src/doctor/board-hygiene-probe.ts`

Unchanged. Orphan detection remains graph-derived and independent of local recovery state. The new
check is wired alongside it as required. An orphan with a draft can therefore show both the board
condition and the actionable recovery condition; the orphan probe is not weakened or silently
suppressed.

### `src/engine/decompose-draft.ts`

Unchanged by this ticket. T-077-04-02 independently added append-only settlement reconciliation.
The doctor probe consumes its public active-state loader rather than duplicating that policy.

## Architecture review

### Pure core / impure shell

Pass.

`resumableDecomposeChecks` is pure over plain, validated draft records. It allocates new check
arrays and does not mutate inputs. `probeResumableDecompose` is the thin impure shell that invokes
the injected/default store loader.

### Separation from preflight

Pass.

The probe has its own file and is imported only by the `doctor` dispatch branch. There is no import
or call from `doctor-probe.ts` or `cast.ts`.

### Store authority

Pass.

Doctor does not inspect raw files. `loadDecomposeDrafts` owns ENOENT handling, schema tolerance, and
active-versus-settled reconciliation. Doctor sees only valid active `DecomposeDraftRecord` values.

### Total diagnostic behavior

Pass.

A filesystem/loader rejection is converted into one red `drafts readable` check with an actionable
repair hint. The expected failure is data, not a thrown CLI stack.

### Scope control

Pass.

No resume execution, auto-repair, gate taxonomy, budget, executor, board mutation, or kitchen
behavior was added.

## Wording review

The failed name is exactly:

```text
resumable-decompose: <epic>
```

The hint contains exactly the contiguous runnable command:

```text
vend run decompose-epic <epic> --resume
```

The surrounding “resume with” language is actionable and does not overstate automatic recovery.
Backticks distinguish the command in the rendered terminal line without changing its literal
contents.

## Multiple-record behavior

The JSONL ledger can contain more than one active checkpoint for the same epic. The probe reports
one recovery choice per epic rather than one line per attempt.

Selection walks active records newest-first, keeps one per epic, then restores representative
append order. This means:

- each epic appears once;
- the latest active checkpoint represents that epic;
- commands remain deterministic;
- no clock or sorting rule is invented.

The check does not expose the selected run ID because the public resume gesture is epic-scoped.

## Lifecycle integration review

Concurrent ticket T-077-04-02 landed commit:

```text
f9d6059 feat: settle resumable decompose drafts
```

It retained the loader result contract and made `records` an active-state view by reconciling
settlement markers. The new probe therefore behaves correctly across the lifecycle:

- active failed/interrupted checkpoint → red resumable check;
- successful settlement marker → no active record → green no-draft check;
- later failed checkpoint for the same epic → active again → red check.

The full suite exercised both tickets together after that commit landed.

## Test evidence

### Focused probe suite

```text
bun test src/doctor/resumable-decompose-probe.test.ts
4 pass, 0 fail, 12 expectations
```

### Real CLI smoke

```text
bun test src/doctor/doctor-cli.smoke.test.ts
3 pass, 0 fail, 16 expectations
```

The third case is this ticket's persisted-draft runtime proof.

### Doctor regression slice

```text
bun test src/doctor/resumable-decompose-probe.test.ts \
  src/doctor/board-hygiene-probe.test.ts \
  src/doctor/doctor-probe.test.ts \
  src/doctor/doctor-core.test.ts
44 pass, 0 fail, 196 expectations
```

### Typecheck

```text
bun run check:typecheck
exit 0
```

### Full gate

```text
bun run check
BAML generation: pass
TypeScript: pass
Tests: 1805 pass, 1 expected skip, 0 fail
Expectations: 5709
Files: 119
Exit: 0
```

The skipped integration test is the pre-existing release acceptance test that requires local
`dist/` artifacts.

## Commit evidence

Ticket source was committed incrementally through Lisa's ticket transaction command.

```text
0281252 feat(doctor): report resumable decompose drafts
f00a8f9 feat(cli): wire resumable decompose doctor check
```

Commit 1 contains only:

```text
src/doctor/resumable-decompose-probe.ts
src/doctor/resumable-decompose-probe.test.ts
```

Commit 2 contains only:

```text
src/cli.ts
src/doctor/doctor-cli.smoke.test.ts
```

All four ticket-owned source paths are clean after the commits.

## Acceptance criterion evaluation

> `vend doctor` on a board with a persisted decompose draft reports a red
> `resumable-decompose: <epic>` Check whose hint carries the literal resume command;
> `probeResumableDecompose` mirrors board-hygiene-probe and is wired alongside it
> (not in `probeDoctor`). Verified by a core + smoke test.

Result: met in full.

- persisted draft: public writer + public default loader exercised by smoke;
- red exact name: core and smoke assertions;
- literal resume command: core and smoke assertions;
- mirrored separate probe: injected loader, pure mapper, catch-to-check shell;
- wired alongside board hygiene: third sibling in CLI `Promise.all`;
- absent from `probeDoctor`: no diff to that module;
- core proof: four focused tests;
- smoke proof: actual `import.meta.main` CLI process from temp cwd.

## Known limitations and out-of-slice items

- `--resume` execution is not implemented by this ticket; T-077-04-04 owns it.
- Doctor does not auto-repair, regenerate, clear, or choose a gate fix.
- Doctor does not suppress the board-hygiene orphan warning; the ticket explicitly requested a
  sibling probe, so both facts may appear.
- Malformed rows are tolerated/skipped by the existing store contract; this probe does not invent a
  separate corruption warning.
- Physical JSONL history can contain settled rows; the public loader reconciles them before doctor
  sees records.

None of these limitations blocks the ticket acceptance criterion.

## Open concerns

No critical issue or TODO remains in this ticket.

The downstream resume ticket must keep its CLI syntax aligned with the already surfaced command:

```text
vend run decompose-epic <epic> --resume
```

That syntax is already fixed by the parent story and T-077-04-04 acceptance criterion, so this is a
dependency handoff rather than unresolved scope here.

## Worktree review

Ticket-owned source is committed and clean. Remaining status entries are Lisa-owned orchestration
and automatic artifact publication paths for the two concurrently active tickets. They were not
staged or included in either source commit.

## Final assessment

Ready for Lisa completion. The implementation is scoped, actionable, locally testable, compatible
with concurrent draft settlement, and fully green under the repository's authoritative gate.
