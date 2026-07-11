# Research — T-068-03-02 doctor-orphan-check

## Ticket and story contract

T-068-03-02 is the second and final ticket in S-068-03. Its dependency, T-068-03-01,
provides the pure orphan detector. This ticket owns only the `vend doctor` surface:

- load the canonical board;
- run the orphan detector;
- emit a red `Check` that names every offending epic and gives a fix-it hint;
- allow the existing doctor renderer to produce a non-zero exit code;
- preserve an all-green result for a clean board.

The story explicitly excludes automatic deletion, automatic decompose retry, chain rollback,
and changes to decompose failure classification. The check is read-only and FREE. This advances
P3 by making the board state an enforceable doctor gate and P4 by making the failure legible to
an autonomous operator without live supervision.

## Existing pure detector

`src/graph/orphan.ts`, supplied by T-068-03-01, exports:

```ts
findOrphanEpics(graph: WorkGraph): string[]
isOrphanEpic(epic: EpicNode): boolean
```

`findOrphanEpics` scans the built graph's id-sorted `epics` array and returns ids for epics with
zero child stories. On the canonical graph, tickets can reach an epic only through a story, so
zero stories also means zero descendant tickets. The module has only type imports and performs
no filesystem access.

`src/graph/orphan.test.ts` covers a childless epic, a populated board, multiple sorted orphans,
an empty board, and the ticketless-story boundary. The detector does not produce doctor concepts
such as a `Check`, hint, report, or exit code.

## Canonical board loading

`src/graph/load.ts` is the existing impure shell for board reads. `loadWorkGraph()` reads:

- `docs/active/epic/*.md`;
- `docs/active/stories/*.md`;
- `docs/active/tickets/*.md`.

It parses and builds a deeply frozen `WorkGraph` using `src/graph/model.ts`. Missing directories
are treated as empty. Malformed frontmatter and unresolved edges remain loud typed errors from
the graph builder. The loader exposes read operations only and defaults its root to
`process.cwd()`.

The graph's main relevant fields are `epics`, `stories`, `tickets`, and `byId`. Each `EpicNode`
contains its linked `stories`. No parallel board parser is needed or desirable.

## Doctor check and renderer model

`src/doctor/doctor-core.ts` is the pure doctor core. A `Check` has:

```ts
interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly hint?: string;
}
```

`passed(name)` creates a green check. `failed(name, hint)` creates a red check and requires a
hint. `renderDoctorReport(checks)` lists all checks, returns exit code 0 when every check is green,
and returns exit code 1 when any check is red. Therefore this ticket does not need new exit-code
logic: producing the correct `Check` is sufficient.

## Existing build-engine doctor probe

`src/doctor/doctor-probe.ts` is an impure probe for build-engine prerequisites. It checks lisa,
Claude Code, the BAML native addon, and active executor configuration. Dependencies are injected
through `DoctorProbeDeps`, and each check is protected by a local `safeCheck` so backend faults
become red checks rather than exceptions. `probeDoctor()` returns an ordered `Check[]`.

This module is also consumed by `src/doctor/preflight.ts`. `castPreflight()` renders
`probeDoctor()` and guards every cast before budget is committed. Consequently, adding orphan
board hygiene directly to `probeDoctor()` would change more than `vend doctor`: any orphan would
block all casts, including work that might repair or decompose the half-minted epic. The ticket
and story name only the doctor board-hygiene surface, not the cast precondition.

## Kitchen-workspace doctor branch

`src/kitchen/kitchen-doctor.ts` is a separate impure probe for standalone kitchen workspaces.
Kitchen workspaces have no lisa board and are detected by the `.emdash` plus `astro.config.mjs`
signature. Their doctor checks cover bun, Astro/Cloudflare config, and the EmDash seed.

The doctor CLI selects either the kitchen probe or the normal build-project path. Board hygiene
belongs only on the normal path because a standalone kitchen workspace does not carry
`docs/active/{epic,stories,tickets}` as its operating board.

## CLI composition point

`src/cli.ts` handles `doctor` with lazy imports. It reads the current directory once to detect a
kitchen signature, obtains a `Check[]` from the selected probe, passes that array to
`renderDoctorReport`, prints the report, and exits with `report.exitCode`.

The non-kitchen branch is the narrow composition seam for an additional board-hygiene probe.
Lazy import is important because the CLI keeps optional/native dependencies off parse-only paths.
The board loader itself is addon-free.

## Testing patterns

Doctor probe tests inject facts rather than relying on the host. `doctor-probe.test.ts` injects
PATH, addon, and environment backends. `kitchen-doctor.test.ts` injects `readFile` and PATH facts.
Both verify green and red `Check` shapes, hints, ordering, and never-throw degradation.

For this ticket, the acceptance criterion explicitly asks for a probe test with injected board
facts. A `loadGraph` dependency can return in-memory `WorkGraph` fixtures created by the real
`buildGraph`. That proves the probe/detector integration without filesystem dependence. Passing
the resulting checks through `renderDoctorReport` proves the observable exit contract without a
fragile subprocess or temporary on-disk board.

## Relevant repository constraints

- Pure judgment stays in `src/graph/orphan.ts`; filesystem access stays in a thin probe/loader.
- Expected bad state is returned data, never a thrown control-flow result.
- Every red doctor check must carry an actionable hint.
- The implementation must remain read-only and must not repair or delete cards.
- The ticket and Lisa-managed frontmatter must not be edited.
- The shared worktree contains unrelated concurrent changes that must be preserved.
- `bun run check` is the required full gate before commit.
- Done means code, tests, and work artifacts are committed.

## Assumptions

- The canonical board root for the CLI is `process.cwd()`, matching `loadWorkGraph()` defaults.
- An empty board has no orphan epics and therefore receives a green hygiene check.
- All orphan ids should appear in one check, preserving the detector's deterministic ordering.
- A graph-load error should become a red board-hygiene check rather than a stack trace, matching
  the doctor probe's established never-throw behavior.
- The fix-it can prescribe manual completion or verified removal, but the probe itself performs
  neither action.

## Open decisions carried into Design

- Whether to add board logic to `doctor-probe.ts` or create a dedicated probe.
- Whether the probe should return one `Check` or a one-element `Check[]`.
- Exact stable check name and fix-it wording for one or multiple orphan ids.
- How graph-loader failures should be rendered as an actionable red check.
