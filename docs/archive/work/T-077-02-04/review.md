# Review — T-077-02-04 degrade-on-run-record

## Review disposition

Pass.

The ticket acceptance criterion is met. A token-free degraded cast now produces one ordered list
covering both cite-applier branches, returns it on `RunSummary`, writes it on the cast's single
terminal `RunRecord`, revives it through `loadRunLog`, and renders the exact operator phrase
`cleared; N cite(s) degraded`. The structural missing-story-contract contrast still refuses before
effect, writes zero board files, and carries no degradation marker.

## Commits

```text
212b283 feat(play): retain advances degradation dispositions
5921cea feat(log): persist cite degradation dispositions
6605ddc feat(cli): surface degraded cite clearance
```

All commits were created through `lisa commit-ticket` with repeated exact `--include` paths. No
ordinary-index staging or direct commit command was used.

## Changed files

### Pure advances policy

- `src/play/decompose-epic-core.ts`
- `src/play/decompose-epic.test.ts`
- `src/play/decompose-epic.ts`

### Generic effect, cast, and durable ledger

- `src/engine/play.ts`
- `src/engine/cast.ts`
- `src/log/run-log.ts`
- `src/log/run-log.test.ts`

### Operator presentation and story integration proof

- `src/cli.ts`
- `src/cli.test.ts`
- `src/play/bare-code-cast.test.ts`

No file was deleted. No BAML source or generated output was changed by the ticket commits.

Total ticket source diff:

```text
10 files changed, 293 insertions(+), 35 deletions(-)
```

## What changed

### Advances dispositions no longer disappear

`stripNonGoalAdvancesWithDispositions` is the new report-producing pure normalizer. It returns:

```ts
{
  plan: WorkPlan;
  degrades: readonly DegradeDisposition[];
}
```

It preserves the existing plan transform while recording each stripped occurrence in ticket/index
order. Non-goal claims and charter-unresolved well-shaped codes produce exact `strip` records.
Duplicates stay separate because their indexed locations are distinct evidence.

The original `stripNonGoalAdvances` API remains as a plan-only projection. Existing direct callers
therefore retain their input/output contract and behavior.

The real `decomposeEpicPlay` now carries the report as its concrete parsed output. Gates still judge
only the normalized plan. On a successful effect, advances records are merged before inline
materializer records, matching lifecycle order. Failed effects are not relabeled as cleared
degradation.

### The generic cast carries plain facts

`EffectResult` now permits optional occurrence-level degradation data. The type comes from the
ledger's structural contract, not the concrete play module, so the documented dependency direction
remains intact: concrete plays depend on the generic engine; the engine does not depend on
`src/play` policy.

`castPlay` captures a nonempty list only from a successful effect and forwards it to:

- the existing one terminal `appendRunLog` call;
- the returned `RunSummary`.

Early capability refusals and clean effects omit the field. No second ledger row, sidecar, or
in-memory-only marker was introduced.

### RunRecord preserves exact ordered evidence

`src/log/run-log.ts` now declares the durable structural record:

```ts
{
  code: string;
  location: string;
  action: "strip" | "annotate";
}
```

`RunRecordInput` and `RunRecord` carry an optional nonempty array. Both `buildRunRecord` and
`reviveRecord` use the same pure atomic normalizer.

Normalization behavior:

- preserves exact occurrence order;
- selects only `code`, `location`, and `action`;
- permits only `strip` or `annotate`;
- omits empty/absent arrays;
- omits the entire optional marker when any entry is malformed;
- retains the otherwise-useful base record on malformed historical metadata.

Atomic omission matters: filtering individual invalid entries would silently produce a dishonest
smaller count. The schema version remains `1`, consistent with earlier additive optional markers.

### The operator sees the honest count

`formatRunSummaryLine` centralizes the repeated CLI terminal receipt. A successful summary carrying
dispositions becomes:

```text
run <id>: cleared; <N> cite(s) degraded (materialized: true)
```

The specified `cite(s)` grammar is literal and stable. Clean success and every non-success outcome
retain their existing outcome copy. Every CLI branch that printed the repeated run-summary template
now calls this helper, covering direct runs, chains, press dispatch, and other cast gestures.

## Acceptance proof

The upgraded `src/play/bare-code-cast.test.ts` is addon-free and token-free. It uses:

- a stub executor returning a canned `WorkPlan`;
- the real advances normalizer;
- real `clear` gates;
- real `materialize` filesystem writes;
- real `castPlay` settlement;
- real JSONL append and `loadRunLog` readback.

The successful fixture contains:

- `P1`, a real retained advance;
- `P9`, an unresolved advance stripped at `T-900-01.advances[1]`;
- `N4`, an unresolved prose cite annotated at `T-900-01.md#purpose`;
- `N2`, a second unresolved prose occurrence at that field.

The retained `P1` means value remains genuine and the real gates clear. The expected records are:

```ts
[
  { code: "P9", location: "T-900-01.advances[1]", action: "strip" },
  { code: "N4", location: "T-900-01.md#purpose", action: "annotate" },
  { code: "N2", location: "T-900-01.md#purpose", action: "annotate" },
]
```

Assertions prove:

- the cast outcome is `success`;
- materialization is true;
- story and ticket files exist;
- unresolved prose tokens do not survive in the written ticket;
- `RunSummary.degrades` equals the list;
- the summary line contains `cleared; 3 cite(s) degraded`;
- `loadRunLog` skips zero rows and returns exactly one record;
- that revived record carries the same list and passed gate evidence.

This directly satisfies the criterion's “observable via loadRunLog, not just held in memory” clause.

## Structural-refusal regression proof

The contrasting fixture omits the required story contract sections. It still:

- stops at `story-completeness` with `gate-failed`;
- never calls the effect;
- writes zero story or ticket files;
- returns no `RunSummary.degrades`;
- writes no `RunRecord.degrades`.

The implementation changes no gate code, structural taxonomy, or `RunOutcome`. A ticket whose
editorial stripping leaves no true advance still reaches the existing value gate and refuses.

## Test coverage

### Pure advances policy

`src/play/decompose-epic.test.ts` pins:

- mixed retained and stripped entries;
- exact indexed locations;
- cross-ticket occurrence order;
- duplicate unresolved cites;
- custom-prefix charter misses;
- clean empty report;
- plan-only wrapper compatibility;
- source immutability.

### Durable ledger

`src/log/run-log.test.ts` pins:

- strip plus annotate round-trip;
- byte-stable serialize/readRuns/serialize;
- absent versus empty compatibility;
- canonical removal of extra keys;
- whole-list omission for one malformed entry;
- malformed non-array history retaining the base record.

### Presentation

`src/cli.test.ts` pins:

- the exact degraded-clear line;
- the count derived from occurrence length;
- byte-compatible clean success copy;
- byte-compatible refusal copy.

### Integrated story behavior

`src/play/bare-code-cast.test.ts` pins the complete write/read/operator path and structural contrast.

## Verification record

Focused baseline:

```text
301 passed, 0 failed
```

Focused implementation checks included:

```text
decompose core: 41 passed, 0 failed
log + generic cast: 148 passed, 0 failed
story fixture + CLI + log + core: 288 passed, 0 failed
tsc --noEmit: pass
git diff --check: pass
```

Full repository gates before each ticket source commit:

```text
1783 passed, 1 existing skip, 0 failed
1788 passed, 1 existing skip, 0 failed
1790 passed, 1 existing skip, 0 failed
```

Final shared-tree gate after the concurrent unit settled:

```text
bun run check
BAML generation — pass
TypeScript typecheck — pass
1796 passed
1 existing conditional dist-artifact skip
0 failed
5675 expectations
118 test files
```

The one skip is the established “no dist artifacts” conditional integration test, not a regression.

## Compatibility assessment

- Clean `RunRecord` bytes omit the new optional field.
- Historical records revive without synthesizing a marker.
- The existing plan-only normalizer remains available.
- Clean/failure CLI receipts retain their old outcome text.
- No outcome taxonomy changed.
- No gate result changed.
- No structural refusal was weakened.
- No new executor or provider assumption entered the engine.
- The runtime remains local-first: durable evidence is in the existing `.vend/runs.jsonl`.

## Honest boundary

This ticket proves the story join with deterministic fixtures and a stub executor. It spends no
tokens and does not claim a live metered recast of reporter E-045. That live recast is explicitly
outside the parent story boundary.

The implementation records editorial cite degradation only. It does not add:

- repair or regeneration;
- a user approval loop;
- progress-line label changes;
- resumable persistence;
- structural error degradation;
- epic-card edits.

## Worktree and workflow hygiene

- All ten ticket-owned source paths are committed and clean.
- The ordinary Git index is empty.
- Three exact-path Lisa commits contain only ticket-owned source/test files.
- Private RDSPI artifacts were written only under the assigned attempt directory.
- Lisa-managed provenance, ticket frontmatter, and published work artifacts were not directly
  edited or committed by this worker.
- Concurrent ticket files and commits were left untouched.

During final verification, a concurrent untracked `decompose-draft` unit briefly made shared-tree
typecheck red. This ticket did not alter it. Once that unit committed, the final shared gate passed
with 1,796 tests. There is no remaining blocker.

## Open concerns

None blocking.

Advances disposition locations intentionally describe the parsed model ticket id and entry index at
the moment normalization stripped the cite. Later effect-time id canonicalization may rename board
ids, while inline locations describe rendered filenames. This is honest source/action provenance,
matches the location contract established by the predecessor ticket, and does not affect counts or
durability.

## Final assessment

Ready to complete.

The change is inside the story slice, preserves structural refusal, keeps pure decision logic
separate from impure settlement, commits all ticket source, passes the full repository gate, and
makes every editorial degrade countable in the exact local ledger and terminal receipt the operator
uses.
