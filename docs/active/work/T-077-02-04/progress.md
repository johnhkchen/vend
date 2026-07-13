# Progress — T-077-02-04 degrade-on-run-record

## Outcome so far

Implementation is complete and committed in three meaningful source units. The acceptance path is
covered token-free: one fixture cast strips a dangling advances cite, annotates two unresolved prose
cites, materializes, carries all three exact dispositions on `RunSummary`, persists them to the one
terminal JSONL row, revives them through `loadRunLog`, and formats the exact operator marker.

## Baseline

Before editing, these ticket-owned paths were clean:

- `src/play/decompose-epic-core.ts`
- `src/play/decompose-epic.test.ts`
- `src/play/decompose-epic.ts`
- `src/engine/play.ts`
- `src/engine/cast.ts`
- `src/log/run-log.ts`
- `src/log/run-log.test.ts`
- `src/play/bare-code-cast.test.ts`
- `src/cli.ts`
- `src/cli.test.ts`

The initial focused baseline ran:

```text
bun test src/play/decompose-epic.test.ts src/log/run-log.test.ts \
  src/engine/cast.test.ts src/play/bare-code-cast.test.ts src/cli.test.ts
301 passed, 0 failed, 826 expectations
```

The worktree already carried Lisa metadata/frontmatter and concurrent-ticket changes. None were
edited, staged, discarded, or included by this ticket.

## Step 1 — advances occurrence report

Implemented `stripNonGoalAdvancesWithDispositions` in the addon-free pure core.

Completed behavior:

- returns `{ plan, degrades }`;
- retains the existing normalized plan behavior;
- records every stripped `N\d+` occurrence as `{code, location, action:"strip"}`;
- records every well-shaped charter-unresolved occurrence from the shared classifier;
- preserves ticket/index order and duplicate occurrences;
- does not mutate source plans or advances arrays;
- retains `stripNonGoalAdvances` as the plan-only compatibility wrapper.

Changed the real `decomposeEpicPlay` output to a concrete wrapper carrying plan plus dispositions.
Its gates judge the plan only. Its effect materializes the plan and, on success, merges advances
dispositions before inline materializer dispositions.

Focused verification:

```text
bun test src/play/decompose-epic.test.ts
41 passed, 0 failed, 85 expectations

bun run build
tsc --noEmit — pass
```

Repository gate before commit:

```text
bun run check
1783 passed, 1 existing skip, 0 failed, 5621 expectations
```

Committed through Lisa:

```text
212b283 feat(play): retain advances degradation dispositions
```

Exact included paths:

- `src/play/decompose-epic-core.ts`
- `src/play/decompose-epic.test.ts`
- `src/play/decompose-epic.ts`

## Step 2 — durable generic transport

Added a ledger-owned structural `DegradeDisposition` contract with the same exact three fields and
closed action vocabulary. This avoids any engine/log dependency on concrete play policy while the
existing TypeScript structural seam keeps the concrete record assignable.

Completed `RunRecord` behavior:

- optional nonempty `degrades` array on write input and normalized record;
- exact occurrence order survives serialization and revival;
- canonical copies drop unrecognized nested keys;
- empty or absent arrays omit the field for byte compatibility;
- one malformed item atomically omits the whole optional list rather than shrinking its count;
- malformed metadata never discards the otherwise-useful historical run;
- schema version remains unchanged because the field is additive and optional.

Completed engine behavior:

- `EffectResult` may report ordered degradation records;
- `castPlay` captures records only from a successful effect;
- the single terminal append receives the exact list;
- `RunSummary` returns the same list;
- early capability refusals and clean effects remain unchanged and omit the field.

Focused verification:

```text
bun test src/log/run-log.test.ts src/engine/cast.test.ts
148 passed, 0 failed, 522 expectations

bun run build
tsc --noEmit — pass
```

Repository gate before commit:

```text
bun run check
1788 passed, 1 existing skip, 0 failed, 5637 expectations
```

Committed through Lisa:

```text
5921cea feat(log): persist cite degradation dispositions
```

Exact included paths:

- `src/log/run-log.ts`
- `src/log/run-log.test.ts`
- `src/engine/play.ts`
- `src/engine/cast.ts`

## Step 3 — operator receipt and end-to-end acceptance

Added `formatRunSummaryLine` as a pure CLI formatter and replaced every repeated CLI terminal run
template with it.

Presentation behavior:

- degraded success: `run <id>: cleared; N cite(s) degraded (materialized: true)`;
- clean success retains the existing `success` copy;
- non-success outcomes retain their existing labels;
- all CLI cast branches now share the same formatter.

Upgraded `bare-code-cast.test.ts` into the story join proof:

- the stub executor returns one plan with valid `P1`, dangling `P9`, and inline `N4`/`N2` cites;
- real advances normalization strips `P9` and records its indexed location;
- real gates clear because `P1` remains as genuine value;
- real materialization annotates the two prose occurrences;
- the effect returns the merged three-record list;
- `RunSummary.degrades` equals the expected list;
- `formatRunSummaryLine` contains `cleared; 3 cite(s) degraded`;
- `loadRunLog({path})` returns one unskipped record carrying the exact same list;
- written bodies no longer contain the unresolved bare tokens.

The structural contrast remains:

- a missing five-section story contract stops at `story-completeness`;
- the effect is not called;
- no story/ticket files are written;
- summary and record both omit `degrades`.

Focused verification:

```text
bun run build
tsc --noEmit — pass

bun test src/play/bare-code-cast.test.ts src/cli.test.ts \
  src/log/run-log.test.ts src/play/decompose-epic.test.ts
288 passed, 0 failed, 619 expectations
```

Repository gate before commit:

```text
bun run check
1790 passed, 1 existing skip, 0 failed, 5647 expectations
```

Committed through Lisa:

```text
6605ddc feat(cli): surface degraded cite clearance
```

Exact included paths:

- `src/cli.ts`
- `src/cli.test.ts`
- `src/play/bare-code-cast.test.ts`

## Diff audit

Ticket source diff from the starting commit:

```text
10 files changed, 293 insertions(+), 35 deletions(-)
```

`git diff --check 16dca2a..HEAD -- <ticket paths>` passed.

All ten ticket-owned source paths were clean after their respective Lisa commits. No ordinary
`git add`, `git add -A`, or `git commit` command was used.

## Deviation from plan

The plan expected a final repository gate after all source commits. The exact implementation state
already passed the full gate immediately before the third commit, and each earlier unit also passed
the full gate before commit.

A later re-run after the third commit encountered type errors only in newly appeared concurrent,
untracked files:

```text
src/engine/decompose-draft.test.ts
src/engine/decompose-draft.ts
```

The errors concern a `cleared` property and a generic record constraint in that in-flight ticket.
Those paths are not part of T-077-02-04, did not exist in this ticket's preceding green run, and are
left untouched under the shared-worktree rule. Review will re-run the full gate after the concurrent
unit settles. If it does not settle, the disposition must honestly account for the external gate
state despite this ticket's three prior green repository checks.

## Acceptance status

| Criterion | Status | Evidence |
|---|---|---|
| degrade cast materializes | met | real-gates/materializer fixture returns success + files |
| RunRecord carries exact dispositions | met | `loadRunLog` assertion over real JSONL |
| both advances and inline sources join | met | one strip + two annotate records in lifecycle order |
| summary states exact phrase | met | formatter and fixture assertion |
| marker is durable, not memory-only | met | append then filesystem `loadRunLog` round-trip |
| structural defect still refuses | met | missing-contract contrast, zero files, no marker |
| clean/historical compatibility | met | ledger and formatter focused tests |
| ticket source committed | met | three Lisa commits, exact paths clean |
| final shared-tree gate | met | concurrent unit settled; 1796 passed, 1 existing skip, 0 failed |

## Remaining work

The concurrent `decompose-draft` unit committed as `1bae202`, after which both `bun run build` and
the final full gate returned green:

```text
bun run check
1796 passed, 1 existing skip, 0 failed, 5675 expectations across 118 files
```

Remaining Review work is only the final handoff artifact and exact pass disposition.
