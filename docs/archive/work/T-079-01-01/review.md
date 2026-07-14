# Review — T-079-01-01

## Disposition

Pass. The ticket acceptance criterion is fully met, focused and full verification are green, the
source unit is committed through Lisa, and no ticket-owned path remains dirty.

## Outcome

T-079-01-01 now provides the pure verdict contract on which both the `vend settle` shell and future
sweep computation can depend. It computes board change from a durable prior frontier, derives one
phase-done interpretation of epic completion, carries all required upstream gate/presweep/review
facts, and emits deterministic actionable exceptions.

Malformed last-settle state is an expected named refusal, not a JSON parse crash. No marker is an
explicit first-settle state whose delta summarizes the full currently done board. The successful
verdict carries the exact next marker, so a shell that persists it makes an immediate repeated settle
produce an empty delta.

## Commit

```text
13bbfb6d5622cdf32e43093f52a226335909aa9a
feat(settle): compute pure board verdict
```

The commit was created with `lisa commit-ticket` and exact repository-relative include paths. It
contains only:

- `src/settle/settle-core.ts`;
- `src/settle/settle-core.test.ts`.

Commit statistics are 2 files and 598 insertions. Neither ticket-owned source path is modified,
untracked, or staged after the commit.

## Files created

### `src/settle/settle-core.ts`

This is an addon-free pure module with only type-only imports from:

- `src/graph/model.ts` for `WorkGraph`;
- `src/ci/presweep-core.ts` for `SweepVerdict`.

It exports:

- `.vend/last-settle.json` as the marker path contract;
- marker schema version 1;
- `LastSettleMarker`;
- `parseLastSettleMarker`;
- `serializeLastSettleMarker`;
- `deriveEpicClearance`;
- gate, review-concern, delta, exception, verdict, and refusal interfaces;
- `computeSettleVerdict` as the aggregate decision boundary.

There is no filesystem, process, Git, clock, network, BAML, executor, run-log, or terminal dependency.

### `src/settle/settle-core.test.ts`

This is a fixture-board suite using the canonical `buildGraph` function rather than a settle-local
board facsimile. It contains 14 tests and 44 assertions.

The graph includes:

- one epic whose two tickets are all phase-done;
- one epic whose two tickets are only partly phase-done;
- one empty epic;
- a phase-done ticket whose status remains open;
- a status-done ticket whose phase remains review.

That contrast pins phase as the only completion authority.

## Public contract review

### Marker

The durable marker shape is:

```ts
{
  version: 1;
  doneTicketIds: readonly string[];
}
```

Ids must be nonblank, sorted, and unique. Unknown historical ids are accepted, which preserves a
frontier across later board archival/removal. Extra keys and incompatible versions are refused
instead of silently normalized.

The parser treats `null` marker contents as first settle. All malformed persisted bytes return:

```text
code: malformed-last-settle-marker
path: .vend/last-settle.json
```

with a reason and an exact removal/rerun action.

### Completion derivation

`deriveEpicClearance` counts only `ticket.phase === "done"`, matching presweep and the dependent sweep
story. It returns:

- per-epic cleared and total counts;
- cleared ticket ids per epic;
- the complete sorted current done-ticket frontier;
- the sorted all-done epic id array.

An epic with no tickets is not all-done. This avoids vacuous sweep eligibility.

### Verdict

`computeSettleVerdict` returns either one successful `SettleVerdict` or one `SettleRefusal`.

A successful verdict contains:

- first-settle flag and newly done ticket ids;
- per-epic clearance summaries;
- current done-ticket frontier;
- all-done epic ids;
- gate result;
- presweep result;
- named review concerns;
- ordered actionable exceptions;
- next marker.

The aggregate derives all board fields from one immutable graph snapshot, so downstream consumers do
not risk mixing different board observations.

### Exception order

The fixed order is:

1. gate failure;
2. sorted presweep offenders;
3. review concerns sorted by ticket id/name.

Every exception contains a kind, identity, message, and nonblank exact next action. Partial epics and
an empty delta are ordinary state, not exceptions.

## Acceptance assessment

| Acceptance clause | Result | Evidence |
|---|---|---|
| fixture board + prior marker yields delta | met | prior frontier omits T-100-02; delta is exactly `[T-100-02]` |
| tickets newly done since marker | met | current phase-done ids minus prior marker set |
| per-epic cleared counts | met | exact 2/2, 1/2, and 0/0 fixture summaries |
| all-done set | met | exact `[E-100]`; partial and empty epics excluded |
| gate field | met | failed gate object retained exactly |
| presweep field | met | canonical verdict type retained with sorted copied arrays |
| review-concern field | met | concerns retained by ticket id/name/action |
| ordered exceptions | met | exact gate -> two presweep -> two review assertion |
| every exception has nextAction | met | exact object equality plus nonblank invariant assertion |
| no marker -> full-board first settle | met | all three current done ids reported with `firstSettle: true` |
| immediate repeat can be empty | met | serialize returned marker, recompute, exact empty delta |
| malformed marker is named refusal | met | seven parser cases plus aggregate invalid-JSON case |
| malformed marker does not crash | met | all cases return discriminated refusal data |
| `bun test src/settle` green | met | 14 pass, 0 fail |

## Test coverage

### Focused

Final post-commit command:

```bash
bun test src/settle
```

Result:

```text
14 pass
0 fail
44 expect() calls
1 file
```

Covered marker defects include:

- invalid JSON;
- unsupported version;
- unknown/extra key;
- non-string id;
- blank id;
- duplicate ids;
- unsorted ids.

Covered behavioral edges include:

- historical marker id absent from the current graph;
- phase/status disagreement in both directions;
- empty epic;
- first settle;
- repeat settle;
- failed gate;
- multiple unsorted presweep offenders;
- reverse-ordered review concerns;
- green verdict with no exceptions;
- input array non-mutation.

### Full repository gate

Final post-commit command:

```bash
bun run check
```

Result:

- BAML generation passed;
- strict TypeScript check passed;
- 1840 tests passed;
- 1 expected release-acceptance skip because no `dist/` artifacts exist;
- 0 tests failed;
- 5971 assertions across 121 files.

## Architecture assessment

The implementation follows pure core / impure shell:

- all judgment consumes plain values;
- every successful result is newly assembled;
- expected persisted-data defects are returned;
- caller wiring defects are `TypeError`s;
- no world-touching dependency enters the module;
- future sweep can consume the same all-done derivation;
- future settle effect code can load facts and render without duplicating verdict policy.

The marker is local-first and deterministic. It does not pretend timestamps are available where the
board has none, and it does not require retaining a full prior board snapshot.

## Compatibility and mutation review

- No existing production API was modified.
- No existing source file was changed.
- No board frontmatter was worker-edited.
- The loaded graph remains read-only and is not mutated.
- Caller-provided presweep and review arrays are copied before sorting.
- The marker version provides an explicit future compatibility refusal.
- Existing `.vend/runs.jsonl` is not imported or touched.
- No executor can be invoked from this module.

## Honest boundary and downstream handoff

This ticket intentionally does not implement the CLI verb or any effect shell. T-079-01-02 still
owns:

- loading `WorkGraph` from disk;
- reading/writing `.vend/last-settle.json`;
- choosing and assembling the gate-line source;
- running/assembling presweep facts;
- discovering review artifacts and mapping them into `ReviewConcern` values;
- rendering the one-screen verdict and ANSI red exceptions;
- proving executor and `.vend/runs.jsonl` non-invocation at the CLI boundary;
- advancing the marker only after a successful settle.

T-079-02-01 can reuse `deriveEpicClearance` and `allDoneEpicIds` as the one all-done source. It should
not re-derive epic completion from status.

Event-triggered settle and loop provenance remain S-079-03 work.

## Worktree review

Concurrent Lisa work remains visible outside this ticket, including Lisa-managed provenance/ticket
frontmatter, published work artifacts, and T-079-03-01 paths. None entered commit `13bbfb6`.

The exact ticket-owned source paths are clean. The private attempt contains all six required RDSPI
artifacts and the required disposition file accompanies this review.

## Open concerns

No blocking concern or known acceptance defect remains.

The downstream shell must preserve one important lifecycle rule: write `nextMarker` only after a
successful verdict has been rendered/accepted as the settle result. Writing before successful
assembly would falsely advance the delta frontier. That effect ordering is explicitly outside this
pure-core ticket and is named here for T-079-01-02.
