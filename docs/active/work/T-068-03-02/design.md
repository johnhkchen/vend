# Design — T-068-03-02 doctor-orphan-check

## Decision

Create a dedicated `src/doctor/board-hygiene-probe.ts`. It will load the canonical `WorkGraph`
through an injectable backend, call `findOrphanEpics`, and return one doctor `Check`:

- green when the detector returns `[]`;
- red when orphan ids exist, with the ids in the check name and an explicit completion/removal
  fix-it hint;
- red under a stable base name if board loading throws, with a repair hint containing the error.

The non-kitchen `vend doctor` CLI branch will append this one check to the existing build-engine
checks before rendering. The kitchen branch and `castPreflight()` remain unchanged.

## Option A — extend `probeDoctor` directly

This would add `loadGraph` to `DoctorProbeDeps`, add a fifth check to `probeDoctor`, and reuse the
existing CLI call without changing its composition.

Advantages:

- fewest new modules;
- inherits the existing `safeCheck` helper;
- one probe call returns all normal-workspace checks.

Rejected because `probeDoctor` is not CLI-private. `castPreflight()` consumes it to gate every
cast. A half-minted board would then prevent all work, including a repair/decompose cast, despite
the ticket being scoped to surfacing the condition in `vend doctor`. It would also force every
existing preflight unit test to inject board IO or silently read the live repository. That is a
real behavior expansion with no story acceptance requirement.

## Option B — inline board loading in `src/cli.ts`

The CLI could import `loadWorkGraph`, call `findOrphanEpics`, and construct a check directly.

Advantages:

- no new production module;
- the behavior is mechanically confined to the doctor command.

Rejected because it puts check judgment, fix-it policy, and exception degradation in the CLI
dispatch arm. The CLI is already a thin composition/printing shell. It would also make injected
board-fact tests awkward: the test would need a subprocess/temp filesystem or a new CLI injection
surface. This conflicts with the acceptance criterion's requested probe test.

## Option C — dedicated board-hygiene probe (chosen)

Create a small sibling to `doctor-probe.ts` that owns exactly the impure board-hygiene surface.
It uses `loadWorkGraph` by default and accepts an injected `loadGraph` function for tests.

Advantages:

- confines the new behavior to `vend doctor` composition;
- preserves the existing cast preflight contract;
- keeps CLI dispatch thin;
- gives deterministic tests a direct injected-fact seam;
- reuses the canonical loader and pure detector without duplicating either;
- can degrade graph parse/integrity/fs failures into doctor data.

Cost: one small module and one small test file. This is justified by the behavioral boundary.

## Public interface

```ts
export interface BoardHygieneProbeDeps {
  readonly loadGraph: () => Promise<WorkGraph>;
}

export function orphanEpicCheck(graph: WorkGraph): Check;

export async function probeBoardHygiene(
  deps?: Partial<BoardHygieneProbeDeps>,
): Promise<Check[]>;
```

`orphanEpicCheck` is pure given a graph. It bridges the graph detector result into doctor
vocabulary. The detector itself remains the single source of the orphan definition.

`probeBoardHygiene` is the impure shell. Returning `Check[]` matches the two existing doctor
probe APIs and lets CLI composition use array spread without special casing a scalar.

## Check naming and hints

Stable green name:

```text
board hygiene: no orphan epics
```

Red name with findings:

```text
board hygiene: orphan epic E-041
board hygiene: orphan epics E-041, E-068
```

The name itself satisfies the requirement to name the epic id even if a renderer changes hint
formatting later. Singular/plural wording keeps one-or-many output readable.

The fix-it hint will direct the operator to finish decomposing the named epic(s), or remove the
half-minted epic card only after verifying that removal is safe. This is advice only; the probe
does not mutate the board. It is more actionable than a generic "fix the board" while respecting
the story's no-auto-repair boundary.

For loader faults, the check name remains a stable base such as `board hygiene: board readable`.
The hint will lead with `repair the board graph:` and include the thrown message. This follows the
existing doctor convention where backend failures become red checks and no stack trace escapes.

## Error behavior

`probeBoardHygiene` wraps its load/check operation in `try/catch` and returns a one-element red
array on any thrown value. An `Error` contributes `.message`; non-Error values use `String`.
This matches both existing doctor probes' `safeCheck` behavior.

The pure `orphanEpicCheck` requires a valid `WorkGraph` and does not catch detector faults because
the detector is total over that type. Graph parse and integrity errors arise in the injected/default
loader and are caught by the probe boundary.

## CLI composition

In the non-kitchen doctor branch:

```ts
const [dependencyChecks, boardChecks] = await Promise.all([
  probeDoctor(),
  probeBoardHygiene(),
]);
checks = [...dependencyChecks, ...boardChecks];
```

The probes are independent read-only operations, so running concurrently is safe and avoids
serial latency. The array order remains deterministic: the four established dependency checks
first, then board hygiene. Kitchen behavior remains the existing three checks only.

The renderer already computes non-zero when any check is red, so no exit logic changes.

## Test design

`src/doctor/board-hygiene-probe.test.ts` will build real in-memory graphs with `buildGraph`:

1. Board containing one populated epic and one childless epic:
   - probe returns one red check;
   - name contains the orphan id;
   - hint names the same id and gives a concrete fix;
   - `renderDoctorReport` is red and exit code is 1.
2. Fully populated board:
   - probe returns one green check with no hint;
   - rendered report is green and exit code is 0.
3. Multiple orphans:
   - one red check names every id in deterministic order;
   - plural wording is used.
4. Throwing injected loader:
   - probe resolves, does not reject;
   - one red check names board readability and carries the thrown message.

The injected loader proves the impure probe consumes board facts without test filesystem access.
Existing detector tests remain the exhaustive unit coverage of orphan classification.

## Scope guard

No changes to:

- `src/graph/orphan.ts` or its definition;
- graph parsing/linking;
- cast preflight behavior;
- kitchen-workspace doctor behavior;
- doctor renderer or exit-code constants;
- decompose classification/retry;
- board cards or Lisa-managed ticket frontmatter;
- auto-repair, deletion, or rollback.
