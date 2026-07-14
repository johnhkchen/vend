# Structure — T-079-02-01

## File inventory

| Path | Action | Responsibility |
|---|---|---|
| `src/sweep/sweep-core.ts` | create | pure sweep eligibility, refusal, flip, pathspec, and provenance computation |
| `src/sweep/sweep-core.test.ts` | create | canonical graph fixture and exact contract coverage |
| attempt `research.md` | created | descriptive repository map |
| attempt `design.md` | created | options and decisions |
| attempt `structure.md` | create | this file-level blueprint |
| attempt `plan.md` | create | ordered implementation and verification steps |
| attempt `progress.md` | create in Implement | execution record and deviations |
| attempt `review.md` | create in Review | acceptance and verification handoff |
| attempt `review-disposition.json` | create in Review | exact Lisa disposition |

No existing source file is modified. No board file is modified by this ticket.

## Directory boundary

Create `src/sweep/` as the domain slice for sweep assembly.

`sweep-core.ts` owns only computation. T-079-02-02 may add an effect/CLI module beside it, but this
ticket will not pre-create effect abstractions or alter `src/cli.ts`.

The module has no filesystem, Git, process, clock, network, terminal, executor, or BAML imports.

## Imports

`sweep-core.ts` imports:

```ts
import { SWEEP_PREFIXES, type SweepVerdict } from "../ci/presweep-core.ts";
import type { WorkGraph } from "../graph/model.ts";
import { deriveEpicClearance } from "../settle/settle-core.ts";
```

The presweep runtime import establishes the shared board-scope contract. The graph import is
type-only. The settle runtime import is the sole eligibility derivation.

## Exported path constants

Export `SWEEP_EPIC_PREFIX` as the exact repository-relative `docs/active/epic/` prefix derived from
the `docs/active/` member of `SWEEP_PREFIXES`.

The derivation is guarded. Missing board scope is a source-contract drift and throws before paths
can be assembled outside the presweep net.

No broad staging path is exported.

## Flip interface

`EpicFrontmatterFlip` fields:

```ts
interface EpicFrontmatterFlip {
  readonly epicId: string;
  readonly path: string;
  readonly field: "status";
  readonly from: string;
  readonly to: "done";
  readonly clearedTicketIds: readonly string[];
}
```

The interface is declarative. It does not contain rewritten Markdown bytes or an executable
callback. The next ticket can use `field`, `from`, and `to` to perform a checked replacement.

## Successful aggregate

`SweepFlipSet` fields:

```ts
interface SweepFlipSet {
  readonly kind: "flip-set";
  readonly flips: readonly EpicFrontmatterFlip[];
  readonly pathspec: readonly string[];
  readonly message: string;
}
```

Invariants:

- `flips.length > 0`;
- `pathspec.length === flips.length`;
- `pathspec[index] === flips[index].path`;
- flip and path order are ascending epic ID;
- every path is an exact file beneath `SWEEP_EPIC_PREFIX`;
- every flip targets only the `status` field and `done` value;
- the message names every flip's epic and cleared ticket IDs.

## Refusal interfaces

Use three named refusal variants under a shared `kind: "refusal"` discriminant.

### `PresweepOffendersRefusal`

Fields:

- `code: "presweep-offenders"`;
- canonical `offenders`;
- `reason`;
- `nextAction`.

This branch exists only for `presweep.ok === false` with at least one offender.

### `StalePresweepRefusal`

Fields:

- `code: "stale-presweep"`;
- `expectedDoneTicketIds`, derived from the graph;
- `observedDoneTicketIds`, copied from presweep;
- `reason`;
- `nextAction`.

This branch prevents eligibility and cleanliness facts from different board snapshots being mixed.

### `NoEpicsReadyRefusal`

Fields:

- `code: "no-epics-ready"`;
- `reason`;
- `nextAction`.

There is no empty successful flip set. This gives the downstream CLI a direct non-zero andon branch.

`SweepRefusal` is the union of these three variants. `SweepResult` is
`SweepFlipSet | SweepRefusal`.

## Input interface

`ComputeSweepInput` contains exactly:

- `graph: WorkGraph`;
- `presweep: SweepVerdict`.

Both fields are required. There are no environment-derived defaults in the pure core.

## Internal canonicalization helpers

### `sortedUnique`

Copy a readonly string array into a sorted deduplicated array. Use it for presweep IDs and offenders.

### `sameStrings`

Compare two already canonical arrays by length and per-index value. Use it to bind presweep to the
graph's current done frontier.

### `epicPath`

Validate an epic ID as a safe single filename segment with canonical `E-<digits>` form, then return
`${SWEEP_EPIC_PREFIX}${epicId}.md`.

This helper does not consult the filesystem.

### `provenanceMessage`

Input: non-empty ordered flips.

Output:

- subject `sweep: close <epic ids>`;
- blank separator;
- one line `<epic id> cleared by <ticket ids>` for each flip.

An all-done epic necessarily has at least one cleared ticket because settle-core excludes empty
epics from all-done. The function can rely on that upstream invariant.

## Main function

`computeSweep(input): SweepResult` runs in this order:

1. copy/canonicalize presweep done IDs and offenders;
2. validate consistency between `ok` and offender presence;
3. return `presweep-offenders` when the canonical verdict fails;
4. call `deriveEpicClearance(graph)` exactly once;
5. compare presweep done IDs with derived graph done IDs;
6. return `stale-presweep` on mismatch;
7. map graph epic statuses by ID;
8. select shared clearance records with `allDone` and current status not `done`;
9. validate/construct an `EpicFrontmatterFlip` for each;
10. return `no-epics-ready` if selection is empty;
11. derive exact pathspec from flips;
12. render provenance message;
13. return one `flip-set`.

Presweep failure precedes graph-derived output. Even though clearance may be needed later, no flip
object is assembled on an andon branch.

## Test file organization

`sweep-core.test.ts` imports `buildGraph` and the sweep public API.

Fixture helpers:

- `node(file, data)` creates `RawNode` values;
- `fixtureGraph(options?)` builds one all-done and one partial epic;
- `greenPresweep()` returns the fixture's exact phase-done frontier.

Test groups:

1. `computeSweep — assembled flip set`;
2. `computeSweep — named refusals`;
3. `computeSweep — contract invariants`.

The acceptance test uses exact object equality for the entire successful result. This pins flip
shape, frontmatter transition, ticket provenance, pathspec, and message in one readable assertion.

Refusal tests assert exact codes and recovery fields, then explicitly prove no `flips` property is
present. No filesystem fixture or Git subprocess is required at this phase.

## Commit boundary

The two source files form one meaningful ticket-owned unit because the test defines and verifies the
new public contract. Commit them together with:

```text
lisa commit-ticket \
  --ticket-id T-079-02-01 \
  --message "feat(sweep): compute pure epic flips" \
  --include src/sweep/sweep-core.ts \
  --include src/sweep/sweep-core.test.ts
```

Private attempt artifacts are not included in the source commit; Lisa publishes them separately.

## Explicit non-changes

- no CLI parse/dispatch entry;
- no confirmation input;
- no Markdown write implementation;
- no Git staging or commit subprocess;
- no package script;
- no settle/presweep API change;
- no board status update;
- no archive move;
- no ticket/story flip;
- no changes to concurrent Lisa-owned paths.
