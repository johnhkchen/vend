# Structure — T-068-03-02 doctor-orphan-check

## Change summary

Two files are created and one is modified. No files are deleted.

```text
src/
├── cli.ts                                  modified: compose board probe into normal doctor
└── doctor/
    ├── board-hygiene-probe.ts              new: graph load → orphan Check[]
    └── board-hygiene-probe.test.ts         new: injected graph facts + rendered verdicts
```

The existing `src/graph/orphan.ts`, `src/graph/load.ts`, and `src/doctor/doctor-core.ts` are
consumed unchanged.

## `src/doctor/board-hygiene-probe.ts`

### Imports

- value import `loadWorkGraph` from `../graph/load.ts` for the default world backend;
- value import `findOrphanEpics` from `../graph/orphan.ts` for pure detection;
- type import `WorkGraph` from `../graph/model.ts`;
- value imports `failed` and `passed`, plus type import `Check`, from `doctor-core.ts`.

This dependency direction is one-way:

```text
doctor board probe → graph loader → graph model
                   → orphan detector → graph model types
                   → doctor core
```

Graph modules do not import doctor vocabulary.

### Exported constants

- `BOARD_HYGIENE_CHECK`: stable base label used for loader failures and as a prefix.
- `BOARD_HYGIENE_OK`: stable green check name.

The exact hint can be constructed per finding because it must name one or more ids.

### Exported dependency interface

```ts
export interface BoardHygieneProbeDeps {
  readonly loadGraph: () => Promise<WorkGraph>;
}
```

The default dependency object binds `loadGraph` to `loadWorkGraph`. Tests replace only this one
backend with a promise returning an in-memory graph or rejecting with a fabricated error.

### Pure bridge function

```ts
export function orphanEpicCheck(graph: WorkGraph): Check
```

Responsibilities:

- call `findOrphanEpics(graph)` exactly once;
- return `passed(BOARD_HYGIENE_OK)` when empty;
- choose singular/plural text when non-empty;
- include all ids in the red name;
- return `failed(name, hint)` with an actionable hint naming the ids.

It performs no filesystem access and does not decide an exit code.

### Impure probe function

```ts
export async function probeBoardHygiene(
  deps: Partial<BoardHygieneProbeDeps> = {},
): Promise<Check[]>
```

Responsibilities:

- merge overrides with the default loader;
- await the graph;
- turn it into a check via `orphanEpicCheck`;
- return the check as a one-element array;
- catch any thrown value at the loader boundary;
- convert it into a red check with a repair hint.

It never prints, exits, mutates cards, or initiates repair.

### Internal helper

An unexported `messageOf(error: unknown): string` mirrors the established doctor probe behavior
for total conversion of thrown values.

## `src/doctor/board-hygiene-probe.test.ts`

### Fixture builders

Use `RawNode` and `buildGraph` from `src/graph/model.ts`, matching `orphan.test.ts`:

- `raw(file, data)` creates a frontmatter-shaped in-memory node;
- `epic(id)` supplies required epic fields;
- `story(id, tickets)` supplies required story fields;
- `ticket(id, story)` supplies required ticket fields;
- `populatedGraph()` creates one epic/story/ticket chain;
- `orphanGraph()` creates a populated chain plus one childless epic.

No filesystem or clock imports are needed.

### Assertions

The primary orphan test asserts:

- injected `loadGraph` is used;
- one check is returned;
- check is red;
- the check name contains `E-002`;
- the hint contains `E-002` and repair wording;
- rendered report has `ok === false` and `exitCode === EXIT_FAILED`.

The clean test asserts:

- one green check;
- no hint;
- rendered report has `ok === true` and `exitCode === EXIT_OK`.

Additional tests pin multiple-id order/pluralization and loader exception degradation.

## `src/cli.ts`

Only the `parsed.cmd === "doctor"` dispatch arm changes.

Existing kitchen detection remains first. For a kitchen workspace, `probeKitchen(cwd)` remains
the complete check set. For a normal workspace, lazily import both probe modules and run:

```ts
const [dependencyChecks, boardChecks] = await Promise.all([
  probeDoctor(),
  probeBoardHygiene(),
]);
const checks = [...dependencyChecks, ...boardChecks];
```

The current renderer, stdout write, and `process.exit(report.exitCode)` remain unchanged.
Comments are updated to describe the new fifth normal-workspace check and clarify that board
hygiene is doctor-only rather than part of cast preflight.

## Unchanged boundaries

`src/doctor/doctor-probe.ts` remains the build-engine dependency probe and remains reusable by
`castPreflight`. `src/doctor/preflight.ts` and its tests therefore need no edits.

`src/kitchen/kitchen-doctor.ts` remains independent because kitchen workspaces have no canonical
lisa board.

`src/doctor/doctor-core.ts` remains the sole report and exit-code authority.

`src/graph/orphan.ts` remains the sole definition of an orphan epic.

## Ordering of implementation

1. Add the board-hygiene probe and its test together.
2. Run the focused probe test.
3. Modify CLI composition.
4. Run doctor and CLI-focused tests.
5. Run the full repository gate.
6. Record implementation progress and commit scoped files.
7. Write Review, rerun the gate if needed, and commit the final artifact.
