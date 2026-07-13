# Structure — T-077-04-04

## Change map

```text
src/cli.ts
  parse --resume without budget
  route resume without funding echo
        │
        ▼
src/play/dispatch.ts
  registry lookup
  skip cold funding counter
  map missing draft to data
        │
        ▼
src/play/decompose-epic.ts
  resolve epic ID/path
  assemble current gate/effect context
  load latest active draft
        │
        ▼
src/engine/cast.ts
  bypass cold source acquisition
  gates → classify → effect → existing settlement
        │
        ▼
src/engine/decompose-draft.ts
  existing load/latest/settle APIs (unchanged)
```

## `src/engine/cast.ts`

### Modified public interface

Extend `CastOptions` with:

```ts
readonly resumeDraft?: DecomposeDraftRecord;
```

The record is active state selected by the caller. It is not loaded inside the generic engine.

### New boundary checks

At cast start, before MCP or executor effects:

```ts
if (resumeDraft && play.name !== RESUMABLE_DECOMPOSE_PLAY) throw TypeError;
if (resumeDraft && resumeDraft.epic !== opts.subject) throw TypeError;
if (resumeDraft && opts.skipGates) throw TypeError;
```

These are programmer wiring errors, not user-facing state outcomes.

### Variable ownership changes

Move the facts consumed by the common settlement tail above the source branch:

- `executorProbe?: ExecutorProbeResult`;
- `seatOfExecution?: string`;
- `reducedGrounding: boolean`;
- `timedOut: boolean`;
- `result: ResultMessage | null`;
- `progress: CastProgress`;
- `maxTurns?: number`;

Cold mode assigns them exactly as today. Resume mode leaves executor-derived facts absent/defaulted.

### Cold source branch

Wrap the existing tool/probe/render/transcript/dispense sequence in:

```ts
if (resumeDraft === undefined) { ... }
```

The early missing-capability run-log returns remain inside this branch.

### Output/gate branch

Build `CastContext` once for both sources.

Cold mode:

- check token usage;
- parse executor text;
- run or skip gates;
- append the decompose checkpoint.

Resume mode:

- set `output` from `resumeDraft.parsedDraft`;
- call gates unconditionally;
- do not append a duplicate checkpoint.

Both modes then call the existing `classify` and share every subsequent line.

### Unchanged settlement surface

- effect invocation;
- diff capture;
- terminal effect line;
- cross-review resolution rules;
- degradation/seat facts;
- decompose success settlement;
- run-log append;
- `RunSummary` return.

## `src/engine/cast.test.ts`

### New acceptance fixture

Add one test near the existing T-077-04 lifecycle tests.

Inputs:

- temporary project root;
- explicit draft and run-log paths;
- active schema-v1 draft with CLEAR findings;
- fixture play named `decompose-epic`;
- forbidden-call executor.

Assertions:

- `render` not called;
- `executor.probe` not called;
- `executor.dispense` not called;
- `parse` not called;
- gates receive the exact stored object;
- effect receives the exact stored object after gates;
- effect-created artifact contains stored content;
- summary is successful/materialized;
- actual usage is empty;
- active draft state is empty;
- raw ledger ends with a settlement row for the resume run.

The fixture remains addon-free and token-free.

## `src/play/decompose-epic.ts`

### Imports

Add path helpers and draft-store public APIs/types:

- `isAbsolute`, `join` from `node:path` as needed;
- `DEFAULT_DECOMPOSE_DRAFT_PATH`;
- `loadDecomposeDrafts`;
- `latestDecomposeDraft`;
- `DecomposeDraftRecord` type.

### `RunOptions`

Add optional fields:

```ts
readonly resume?: boolean;
readonly decomposeDraftPath?: string;
readonly runLogPath?: string;
```

The path overrides make the impure assembly path hermetic in focused tests/embedding.

### New error

```ts
export class ResumeDraftNotFoundError extends Error {
  readonly epic: string;
}
```

It represents expected absence after successful path/subject resolution.

### Epic path helper

Add a small pure helper:

```ts
export function resumeEpicPath(argument: string, root: string): string
```

Rules:

- bare ID → `<root>/docs/active/epic/<id>.md`;
- absolute path → unchanged;
- explicit relative `.md` path → unchanged/current semantics.

### `assembleAndCast`

1. choose cold or resume epic path;
2. assemble current inputs;
3. derive canonical subject;
4. if resume, load active drafts and select latest for subject;
5. throw `ResumeDraftNotFoundError` when absent;
6. call `castPlay` with the selected `resumeDraft` and store override;
7. otherwise retain cold call shape.

No draft parsing or mutation occurs here.

## `src/play/dispatch.ts`

### Input type

Allow the dispatch boundary to receive a missing budget only for resume. It resolves the play first,
then supplies `play.budget` to `assembleAndCast` for resume.

### Result union

Add:

```ts
| { readonly kind: "no-draft"; readonly epic: string }
```

### Branches

Cold:

- require caller budget by type/runtime invariant;
- call `withFundingCounter`;
- assemble and cast.

Resume:

- call `assembleAndCast` directly with `resume: true` and `budget: play.budget`;
- catch only `ResumeDraftNotFoundError`;
- return `no-draft` data;
- rethrow unrelated defects.

## `src/cli.ts`

### Usage

Add the exact doctor recovery command to the free section:

```text
vend run decompose-epic <epic> --resume
```

Keep the existing budgeted run line under metered commands.

### Parsed command shape

The `run` variant changes to:

```ts
readonly budget?: Budget;
readonly resume?: true;
```

The parser preserves the stronger runtime invariant that non-resume always has a budget.

### `parseRunArgs`

- detect `--resume` before enforcing budget presence;
- parse a supplied budget normally;
- require a budget when resume is absent;
- spread `resume: true` only when present;
- spread `budget` only when parsed.

### Shell dispatch

- print `formatFundingLine` only when a budget exists;
- pass `resume` to `runPlay`;
- handle `no-draft` with a concise stderr line and nonzero exit;
- preserve no-play and normal summary behavior.

## `src/cli.test.ts`

Add parser tests:

- exact `run decompose-epic E-077 --resume` shape;
- resume with explicit markdown path shape;
- ordinary missing-budget refusal remains;
- ordinary cold happy path remains byte-identical.

Add help test:

- exact resume command appears;
- it appears in the free section, not only the metered section.

## Files deliberately unchanged

- `src/engine/decompose-draft.ts`: schema/store/lifecycle are already sufficient.
- `src/engine/decompose-draft.test.ts`: no store behavior changes.
- `src/doctor/resumable-decompose-probe.ts`: command is already correct.
- `src/gate/gates.ts`: gates rerun unchanged.
- `src/play/decompose-effect.ts`: materialization is reused unchanged.
- `src/log/run-log.ts`: existing shape represents zero-usage resume adequately.
- BAML source/generated client: no render or parse change.

## Commit boundaries

Meaningful unit 1:

- engine resume source and acceptance test.

Meaningful unit 2:

- concrete play lookup/dispatch plus CLI syntax/tests.

Each unit must pass focused tests and `bun run check` before `lisa commit-ticket` with exact paths.

