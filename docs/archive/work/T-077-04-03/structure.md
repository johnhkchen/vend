# Structure — T-077-04-03

## Change inventory

Ticket-owned source changes are limited to four paths:

```text
src/doctor/resumable-decompose-probe.ts       create
src/doctor/resumable-decompose-probe.test.ts  create
src/cli.ts                                    modify
src/doctor/doctor-cli.smoke.test.ts            modify
```

Attempt-only work artifacts are:

```text
.lisa/attempts/T-077-04-03/1/work/research.md
.lisa/attempts/T-077-04-03/1/work/design.md
.lisa/attempts/T-077-04-03/1/work/structure.md
.lisa/attempts/T-077-04-03/1/work/plan.md
.lisa/attempts/T-077-04-03/1/work/progress.md
.lisa/attempts/T-077-04-03/1/work/review.md
.lisa/attempts/T-077-04-03/1/work/review-disposition.json
```

No file is deleted. No ticket, story, epic, shared work-artifact, engine-store, or generated BAML
file is ticket-owned here.

## Dependency direction

The new source dependency graph is:

```text
src/cli.ts
  └─ lazy import → src/doctor/resumable-decompose-probe.ts
                     ├─ type/value import → src/doctor/doctor-core.ts
                     └─ type/value import → src/engine/decompose-draft.ts

src/doctor/resumable-decompose-probe.test.ts
  ├─ imports → resumable-decompose-probe.ts
  ├─ imports → doctor-core.ts
  └─ imports → decompose-draft.ts

src/doctor/doctor-cli.smoke.test.ts
  ├─ spawns → src/cli.ts doctor
  └─ imports → decompose-draft.ts for fixture persistence
```

The engine store does not import doctor or CLI code. Doctor reads engine state in the outward
diagnostic shell, preserving the dependency direction.

## `src/doctor/resumable-decompose-probe.ts`

### Responsibility

Read the public decompose draft view and translate resumable epic facts into doctor `Check` values.
It is a read-only doctor surface and never changes recovery state.

### Header contract

The module header will record:

- ticket/story ownership;
- separation from `doctor-probe.ts` and cast preflight;
- pure-core/impure-shell split;
- no resume/repair side effects;
- never-throw behavior for loader faults.

### Imports

```ts
import { failed, passed, type Check } from "./doctor-core.ts";
import {
  loadDecomposeDrafts,
  type DecomposeDraftRecord,
  type ReadDecomposeDraftsResult,
} from "../engine/decompose-draft.ts";
```

If concurrent T-077-04-02 exposes a canonical active-record selector, that selector will also be
imported and used instead of encoding settlement policy locally.

### Constants

```ts
export const RESUMABLE_DECOMPOSE_CHECK = "resumable-decompose";
export const RESUMABLE_DECOMPOSE_OK = `${RESUMABLE_DECOMPOSE_CHECK}: no drafts`;
```

The base constant prevents drift across red, green, and loader-failure names.

### Injected dependency interface

```ts
export interface ResumableDecomposeProbeDeps {
  readonly loadDrafts: () => Promise<ReadDecomposeDraftsResult>;
}
```

The default object supplies `loadDecomposeDrafts()`. Tests override only `loadDrafts`, matching
`BoardHygieneProbeDeps` and avoiding filesystem coupling.

### Pure resume command helper

An internal helper returns:

```ts
`vend run decompose-epic ${epic} --resume`
```

It remains a single source for the literal command. No shell escaping policy is introduced because
epic IDs are validated board identifiers and the persisted writer requires a non-empty epic.

### Pure record selector

An internal selector accepts `readonly DecomposeDraftRecord[]` and returns one representative
record per epic.

Algorithm shape:

1. initialize a `Set<string>`;
2. iterate indices from the final record to the first;
3. keep a record only if its epic has not been seen;
4. reverse selected records to restore forward evidence order.

This helper contains no IO, mutation of inputs, timestamps, or graph lookup.

If the concurrent lifecycle ticket changes the loader to return active drafts directly, the
selector remains only a duplicate-attempt guard. If a public selector is introduced, this private
logic can collapse to that public call.

### Pure check mapper

```ts
export function resumableDecomposeChecks(
  records: readonly DecomposeDraftRecord[],
): Check[]
```

Behavior:

- empty representative list → `[passed(RESUMABLE_DECOMPOSE_OK)]`;
- each representative → one `failed` check;
- failed name → `resumable-decompose: <epic>`;
- failed hint → `resume with \`<literal command>\``.

The function returns a new array and does not alter records.

### Loader error helper

An internal `messageOf(error: unknown): string` mirrors board hygiene:

- `Error` → `.message`;
- every other thrown value → `String(error)`.

### Impure probe

```ts
export async function probeResumableDecompose(
  deps: Partial<ResumableDecomposeProbeDeps> = {},
): Promise<Check[]>
```

Behavior:

1. merge defaults and injected dependencies;
2. await `loadDrafts()`;
3. pass readable/active records to the pure mapper;
4. catch any loader rejection;
5. return a failed `resumable-decompose: drafts readable` check with repair detail.

The skipped-row count is intentionally ignored in this ticket.

## `src/doctor/resumable-decompose-probe.test.ts`

### Responsibility

Pin the new module's pure wording, uniqueness, report verdict, green behavior, and failure
conversion without depending on the host filesystem.

### Imports

- Bun test functions;
- `buildDecomposeDraftRecord` and repair-action helper/types;
- `EXIT_FAILED`, `EXIT_OK`, and `renderDoctorReport`;
- new constants, mapper, and probe.

### Fixture builder

A local `draft(runId, epic)` helper constructs valid records through
`buildDecomposeDraftRecord`. It uses:

- an object-shaped parsed draft;
- a CLEAR gate verdict;
- a valid resume-at-gates action;
- a fixed ISO timestamp.

The schema builder keeps fixture shape synchronized with the store contract.

### Test groups

1. **Persisted draft**
   - inject one record;
   - assert one failed check;
   - assert exact name;
   - assert literal full command in hint;
   - render and assert failure/exit 1/output.

2. **Readable empty store**
   - inject `{ records: [], skipped: 0 }`;
   - assert the exact green check;
   - render and assert success/exit 0.

3. **Repeated and multiple epics**
   - pass old/new records for the same epic plus another epic;
   - assert one check per epic;
   - assert deterministic expected ordering;
   - assert commands use the matching epic.

4. **Loader rejection**
   - inject a loader that throws;
   - assert the promise resolves to one red drafts-readable check;
   - assert the original error message is included;
   - assert report exit 1.

The unit test is the ticket's “core” proof.

## `src/cli.ts`

### Modification boundary

Only the existing normal build-workspace doctor branch changes.

Existing shape:

```ts
const [dependencyChecks, boardChecks] = await Promise.all([
  probeDoctor(),
  probeBoardHygiene(),
]);
checks = [...dependencyChecks, ...boardChecks];
```

New shape:

```ts
const { probeResumableDecompose } = await import(
  "./doctor/resumable-decompose-probe.ts"
);
const [dependencyChecks, boardChecks, resumableChecks] = await Promise.all([
  probeDoctor(),
  probeBoardHygiene(),
  probeResumableDecompose(),
]);
checks = [...dependencyChecks, ...boardChecks, ...resumableChecks];
```

The surrounding comment will name local recovery state as a third normal-workspace fact. No parser,
usage, kitchen, renderer, output, or exit logic changes.

### Ordering

Checks remain:

1. runtime/dependency checks;
2. canonical board hygiene;
3. resumable decompose drafts.

This avoids reordering all prior output and makes the new condition visibly adjacent to the board
diagnosis that motivated it.

## `src/doctor/doctor-cli.smoke.test.ts`

### Imports

Add:

- `mkdtemp` and `rm` from `node:fs/promises`;
- `tmpdir` from `node:os`;
- the public `appendDecomposeDraft` helper.

`join` remains the path helper.

### Spawn helper extension

Change `runDoctor(env)` to `runDoctor(env, cwd?)` and pass `cwd` into `Bun.spawnSync`. Existing
callers omit it and retain current behavior.

### New smoke

Add an asynchronous test under the existing doctor CLI describe:

1. create `vend-doctor-resumable-*` temp root;
2. append a valid draft using an explicit path under that root;
3. run the actual CLI with the temp root as cwd;
4. assert exit code 1;
5. assert rendered failed check name;
6. assert complete resume command;
7. assert no stack trace or unhandled error;
8. recursively remove the temp root in `finally`.

The test does not assert total failure count because host dependency checks vary. It asserts only
the host-independent acceptance condition.

## Commit structure

Two meaningful source units are planned:

### Commit 1 — probe core and focused tests

Exact includes:

```text
src/doctor/resumable-decompose-probe.ts
src/doctor/resumable-decompose-probe.test.ts
```

This commit is independently testable through the focused suite.

### Commit 2 — CLI wiring and smoke proof

Exact includes:

```text
src/cli.ts
src/doctor/doctor-cli.smoke.test.ts
```

This commit proves the real dispatch path and remains separate from the reusable probe unit.

Attempt artifacts are written in the private Lisa directory and are not included in source-unit
commits unless Lisa's transaction semantics explicitly require them at final completion; the
assignment states Lisa publishes them after lease verification.

## Invariants after the change

- `probeDoctor` source and cast preflight behavior are unchanged.
- Board orphan detection is unchanged.
- Kitchen doctor behavior is unchanged.
- Draft storage, parsing, and lifecycle are unchanged by this ticket.
- Doctor remains read-only.
- A loader fault remains rendered data, not a stack trace.
- The complete resume command is emitted from one helper.
- One epic produces one recovery check even with repeated draft rows.
- `bun run check` is green before Review passes.
