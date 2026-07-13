# Structure — T-079-01-01

## File inventory

| Path | Action | Ownership |
|---|---|---|
| `src/settle/settle-core.ts` | create | pure marker/verdict contract and derivation |
| `src/settle/settle-core.test.ts` | create | pure fixture-board acceptance coverage |
| attempt `research.md` | create | repository map |
| attempt `design.md` | create | decisions and rejected options |
| attempt `structure.md` | create | this blueprint |
| attempt `plan.md` | create | ordered implementation steps |
| attempt `progress.md` | create during Implement | execution evidence and deviations |
| attempt `review.md` | create during Review | final handoff |
| attempt `review-disposition.json` | create during Review | exact Lisa pass/block result |

No existing production file is modified. In particular, this ticket does not touch `src/cli.ts`,
`src/graph/*`, `src/ci/presweep-core.ts`, `.vend/`, or board frontmatter.

## Directory boundary

`src/settle/` becomes the domain slice shared by the later settle and sweep shells.

The first file is deliberately named `settle-core.ts`:

- “settle” owns the operator-facing verdict vocabulary;
- “core” signals no filesystem, process, Git, clock, network, or executor effects;
- dependent modules can import its types without pulling CLI code;
- tests can run addon-free under Bun.

The dependent ticket may add an effect/CLI module in the same directory, but this ticket does not
pre-create empty abstractions for it.

## Production module imports

`settle-core.ts` has two type-only imports:

```ts
import type { SweepVerdict } from "../ci/presweep-core.ts";
import type { WorkGraph } from "../graph/model.ts";
```

There are no runtime imports. All algorithms use language primitives only. This makes the core safe
for sweep and CLI consumers without initializing BAML, filesystem bindings, or executors.

## Exported constants

### `LAST_SETTLE_MARKER_PATH`

Value: `.vend/last-settle.json`.

Purpose:

- single-source the future shell's durable local path;
- include the exact path in refusal diagnostics;
- keep `.vend/` state naming out of presentation code.

### `LAST_SETTLE_MARKER_VERSION`

Value: literal `1`.

Purpose:

- type and runtime schema discriminant;
- explicit refusal on incompatible marker versions;
- stable serializer contract.

## Marker interfaces

### `LastSettleMarker`

Fields:

- `version: 1`;
- `doneTicketIds: readonly string[]`.

The ids are canonical sorted unique nonblank values. Historical ids need not resolve against the
current graph.

### `MarkerParseResult`

Discriminated union:

- `{ ok: true; firstSettle: boolean; marker: LastSettleMarker | null }`;
- `{ ok: false; refusal: SettleRefusal }`.

`null` source bytes produce the valid first-settle branch. Malformed bytes never throw.

## Marker functions

### `parseLastSettleMarker(contents)`

Input: `string | null`.

Order:

1. return valid first-settle state for `null`;
2. `JSON.parse` inside `try/catch`;
3. validate exact object keys;
4. validate version;
5. validate the string array;
6. validate canonical sorting/uniqueness;
7. copy into a fresh marker value;
8. otherwise return `malformed-last-settle-marker` refusal.

### `serializeLastSettleMarker(marker)`

Input: a typed marker.

Output: canonical single-line JSON plus trailing newline.

It validates the marker with the same internal shape check before serialization. A malformed typed
call is a programmer error and throws `TypeError`; persisted bytes remain returned refusal data.

## Board summary interfaces

### `EpicClearance`

Fields:

- `epicId: string`;
- `title: string`;
- `cleared: number`;
- `total: number`;
- `clearedTicketIds: readonly string[]`;
- `allDone: boolean`.

### `EpicClearanceResult`

Fields:

- `epics: readonly EpicClearance[]`;
- `doneTicketIds: readonly string[]`;
- `allDoneEpicIds: readonly string[]`.

The aggregate shape lets future sweep reuse all-done derivation and the associated cleared ids from
one graph traversal.

### `deriveEpicClearance(graph)`

Algorithm:

1. iterate id-sorted graph epics;
2. flatten each epic's story tickets;
3. filter phase-done tickets;
4. sort ids explicitly;
5. build the per-epic record;
6. union done ids globally;
7. collect all-done epic ids;
8. return fresh sorted arrays.

An empty epic returns `{ cleared: 0, total: 0, allDone: false }`.

## Input fact interfaces

### `SettleGateResult`

Fields:

- `ok: boolean`;
- `name: string`;
- `detail: string`;
- `nextAction: string | null`.

Names/details are nonblank. A failed gate requires a nonblank next action.

### `ReviewConcern`

Fields:

- `ticketId: string`;
- `name: string`;
- `nextAction: string`.

All strings are nonblank. These are structured facts already extracted from work-directory review
artifacts by the future effect shell.

### `ComputeSettleInput`

Fields:

- `graph: WorkGraph`;
- `lastSettleContents: string | null`;
- `gate: SettleGateResult`;
- `presweep: SweepVerdict`;
- `reviewConcerns: readonly ReviewConcern[]`.

No optional defaults are used. The caller must make every verdict source explicit.

## Result interfaces

### `SettleDelta`

Fields:

- `firstSettle: boolean`;
- `newlyDoneTicketIds: readonly string[]`.

### `SettleException`

Fields:

- `kind: "gate" | "presweep" | "review"`;
- `name: string`;
- `message: string`;
- `nextAction: string`.

The array order is the contract. No priority field is needed because kind order is fixed.

### `SettleVerdict`

Fields:

- `kind: "verdict"`;
- `delta: SettleDelta`;
- `epics: readonly EpicClearance[]`;
- `doneTicketIds: readonly string[]`;
- `allDoneEpicIds: readonly string[]`;
- `gate: SettleGateResult`;
- `presweep: SweepVerdict`;
- `reviewConcerns: readonly ReviewConcern[]`;
- `exceptions: readonly SettleException[]`;
- `nextMarker: LastSettleMarker`.

`nextMarker.doneTicketIds` and top-level `doneTicketIds` are equal by value but separately copied.
The duplication is intentional: one is presentation/current-state data, the other is the exact
durable continuation contract.

### `SettleRefusal`

Fields:

- `kind: "refusal"`;
- `code: "malformed-last-settle-marker"`;
- `path: typeof LAST_SETTLE_MARKER_PATH`;
- `reason: string`;
- `nextAction: string`.

### `SettleResult`

Union of `SettleVerdict | SettleRefusal`, discriminated by `kind`.

## Aggregate function

### `computeSettleVerdict(input)`

Order of work:

1. parse marker;
2. return refusal immediately if invalid;
3. validate/copy gate, presweep, and review facts;
4. derive epic clearance and current done frontier;
5. build the prior done-id set (empty for first settle);
6. filter current ids into delta;
7. derive ordered exceptions;
8. build next marker from all current done ids;
9. return one fresh verdict.

This ordering ensures no successful result exists with an untrusted delta basis.

## Internal helpers

Keep helpers module-private unless a downstream consumer needs the concept itself:

- `isRecord(value)`;
- `nonBlank(value)`;
- `malformedMarker(reason)`;
- `validateMarkerValue(value)`;
- `copyGate(gate)`;
- `copyPresweep(verdict)`;
- `copyAndSortReviewConcerns(concerns)`;
- `deriveExceptions(gate, presweep, concerns)`.

Only marker parsing/serialization, epic clearance, and aggregate computation are public operations.

## Test module structure

`settle-core.test.ts` imports Bun test primitives, `buildGraph`, and public settle exports.

### Fixture helpers

- `raw(kind, frontmatter)` creates a `RawNode` from plain mappings/bodies.
- `fixtureGraph()` builds two populated epics plus an empty epic.
- The fixture includes done, open, and status/phase-mismatched tickets.
- `gate()` and `presweep()` provide concise typed defaults.

### Test groups

1. `deriveEpicClearance`
   - phase-done counts;
   - all-done ids;
   - empty epic behavior;
   - stable sorted ids.
2. `last-settle marker`
   - null first-settle;
   - canonical round trip;
   - invalid JSON;
   - wrong version/keys/type;
   - duplicate or unsorted ids.
3. `computeSettleVerdict`
   - prior frontier delta and full field preservation;
   - ordered actionable exceptions;
   - first-settle full-board summary;
   - immediate repeat empty delta;
   - named marker refusal.

## Commit boundary

The production core and its focused test form one meaningful source unit because neither is useful as
a committed ticket result without the other. After focused and full checks pass, commit exactly:

```text
src/settle/settle-core.ts
src/settle/settle-core.test.ts
```

using `lisa commit-ticket`. Private attempt artifacts are Lisa-admitted separately and are not passed
to the ticket source commit. Unrelated dirty files stay excluded.
