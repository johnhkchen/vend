# Structure — T-077-02-03 advances-cite-degrades

## File-level change map

| Path | Action | Responsibility |
|---|---|---|
| `src/engine/play.ts` | modify | Permit parse-time deterministic normalization to read the typed cast context |
| `src/engine/cast.ts` | modify | Pass the already-assembled `CastContext<I>` to `play.parse` |
| `src/engine/cast.test.ts` | modify | Prove parse receives the same typed inputs/root used by gates and effect |
| `src/play/decompose-epic-core.ts` | modify | Extend advances stripping with snapshot-backed dangling-code classification |
| `src/play/decompose-epic.test.ts` | modify | Pin charter-aware normalization, purity, compatibility, and custom codes |
| `src/play/decompose-epic.ts` | modify | Supply the decompose run's charter to normalization in the parse hook |
| `src/gate/gates.ts` | comment-only | Describe the expanded normalization backstop without weakening executable bounds rules |
| `src/gate/gates.test.ts` | modify | Prove normalized dangling cites clear while empty survivors STOP at value |

No files are created or deleted in source. No BAML schema/client files change.

## Unit 1 — generic parse-context seam

### `src/engine/play.ts`

Change the callback field from:

```ts
readonly parse: (text: string) => O;
```

to:

```ts
readonly parse: (text: string, ctx: CastContext<I>) => O;
```

The interface already declares `CastContext<I>` above `Play<I, O>`, so no new type or import is
needed.

The doc comment will state that parse owns SAP parsing plus any deterministic, input-aware
normalization that must happen before gates and effect consume the output.

Existing one-argument callbacks remain valid implementations because they ignore the additional
argument. No concrete play needs a mechanical rewrite.

### `src/engine/cast.ts`

The context is already assembled before the parse block:

```ts
const ctx: CastContext<I> = { inputs, projectRoot: root };
```

Change the invocation from:

```ts
output = play.parse(result.result ?? "");
```

to:

```ts
output = play.parse(result.result ?? "", ctx);
```

No ordering change is required. Budget checking remains before parse; gating remains after parse.

### `src/engine/cast.test.ts`

Add one focused cast fixture whose parse callback captures the second argument.

The fixture will use the existing fake executor/cast harness rather than introduce a new execution
edge. It will assert:

- parse receives the exact typed input object supplied to `castPlay`;
- parse receives the resolved project root;
- the ordinary success path still materializes;
- a one-argument callback remains covered throughout the existing suite.

If an existing test fixture offers a smaller assertion site, extend it rather than add a redundant
full integration setup.

## Unit 2 — charter-aware advances normalization

### Imports in `src/play/decompose-epic-core.ts`

Add pure value imports:

```ts
import { snapshotCharterCodes } from "./charter-snapshot.ts";
import { classifyCharterCite } from "./degrade-disposition.ts";
```

Both modules are addon-free and effect-free, preserving the core test isolation guarantee.

### Existing helper retained

Keep:

```ts
export const isNonGoalAdvance = (claim: string): boolean => /^N\d+$/.test(claim.trim());
```

It remains the semantic special case for resolvable N-code definitions.

### Extended public function

Change the signature to:

```ts
export function stripNonGoalAdvances(plan: WorkPlan, charter?: string): WorkPlan;
```

The optional argument preserves existing direct-call behavior while letting production supply the
resolution source.

### Internal classification flow

At function entry:

- when `charter` is absent, do not build a snapshot;
- when present, call `snapshotCharterCodes(charter)` exactly once.

Define a local claim predicate/decision that returns true when an entry must be stripped:

1. `isNonGoalAdvance(claim)` → strip;
2. no snapshot → retain;
3. otherwise call `classifyCharterCite` with:
   - `code: claim`;
   - `location` derived from ticket id and advances index;
   - `action: "strip"`;
4. strip only when `classification === "degradable"`.

The location format will be:

```text
<ticket-id>.advances[<zero-based-index>]
```

This is nonblank even for valid normal inputs and identifies each occurrence independently.
Structural ticket-id absence remains the structural gate's responsibility; a fallback `<ticket>`
label can keep classification total for malformed fixtures.

### Ticket transformation

For every ticket:

- inspect only an array-valued `advances` field;
- compute whether at least one indexed claim should strip;
- if none strip, reuse the original ticket object;
- if any strip, copy the ticket and set a filtered advances array;
- return `{ ...plan, tickets }` as today.

Use one per-ticket decision array or set so the classifier is not called twice by `.some()` plus
`.filter()`. The function must remain deterministic and avoid needless duplicate work.

### `src/play/decompose-epic.ts`

Change the parse hook to accept the context:

```ts
parse: (text, ctx) =>
  stripNonGoalAdvances(b.parse.DecomposeEpic(text), ctx.inputs.charter),
```

This is the only concrete play that consumes the new second parameter in this ticket.

Update nearby comments from N-only normalization to both:

- incoherent N-code stripping;
- unresolved charter-code stripping.

The output type remains `WorkPlan`, so gates and effect signatures do not change.

## Unit 2 tests — `src/play/decompose-epic.test.ts`

Retain all existing `isNonGoalAdvance` and legacy strip tests.

Add a local charter fixture with real definition syntax, for example:

```md
- **P3 — Gates are the contract.**
- **K1 — Kitchen value.**
```

Add cases:

1. `P3` remains when present in the snapshot.
2. `[P3, P9]` becomes `[P3]`.
3. `[P9]` becomes `[]`.
4. `K1` remains and unknown `K9` strips, proving prefix-generic behavior.
5. free-text advances remain.
6. blank input remains so value can diagnose it.
7. charter-aware normalization does not mutate the input.
8. clean charter-aware ticket preserves identity.

The test continues to import the pure core only; no BAML value import is introduced.

## Unit 2 gate proof — `src/gate/gates.test.ts`

Import `stripNonGoalAdvances` from the pure core. This dependency direction is acceptable in a test;
production gates remain independent of play normalization.

Within the bounds section add a composed fixture:

```ts
const normalized = stripNonGoalAdvances(
  plan([ticket({ advances: ["P3", "P9"] })]),
  CHARTER,
);
expect(clear(normalized, CTX).status).toBe("clear");
```

Add an empty-survivor fixture:

```ts
const normalized = stripNonGoalAdvances(
  plan([ticket({ advances: ["P9"] })]),
  CHARTER,
);
expect(clear(normalized, CTX)).toMatchObject({ status: "stop", gate: "value" });
```

Retain the existing direct `P9` BOUNDS STOP test to pin defense in depth.

### `src/gate/gates.ts`

No runtime line changes.

Update the bounds documentation to say normal production normalization strips:

- N-shaped non-goals;
- well-shaped charter codes unresolved by the current snapshot.

The comment must state that direct unnormalized callers still receive a bounds STOP.

## Public interfaces after the ticket

### Parse callback

```ts
type Parse<I, O> = (text: string, ctx: CastContext<I>) => O;
```

No standalone alias will be introduced unless the implementation reveals reuse; the inline field is
enough.

### Advances normalizer

```ts
stripNonGoalAdvances(plan: WorkPlan, charter?: string): WorkPlan
```

- without charter: legacy N-strip;
- with charter: N-strip plus classifier-backed dangling-code strip.

No degrade metadata field is added to `WorkPlan`.

## Dependency graph

```text
castPlay
  └─ play.parse(text, CastContext<I>)
       └─ decompose parse
            └─ stripNonGoalAdvances(plan, charter)
                 ├─ snapshotCharterCodes(charter)
                 └─ classifyCharterCite(cite, snapshot)

normalized WorkPlan
  ├─ clear(...)
  │    ├─ valueGate (empty survivor refuses)
  │    └─ boundsGate (defense-in-depth for anything unnormalized)
  └─ decomposeEffect (materializes the same normalized plan)
```

## Commit boundaries

### Commit 1 — parse context

Exact include paths:

- `src/engine/play.ts`
- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

Verification before commit:

- focused engine test;
- `bun run check`;
- diff and whitespace inspection.

### Commit 2 — advances degradation

Exact include paths:

- `src/play/decompose-epic-core.ts`
- `src/play/decompose-epic.test.ts`
- `src/play/decompose-epic.ts`
- `src/gate/gates.ts`
- `src/gate/gates.test.ts`

Verification before commit:

- focused core/gate tests;
- `bun run check`;
- diff and whitespace inspection.

## Explicit non-changes

- no materialize or decompose-effect changes;
- no `RunRecord` or `EffectResult` changes;
- no BAML generated output;
- no ticket phase/status edits;
- no ordinary-index staging;
- no shared `docs/active/work` writes;
- no deletion or modification of Lisa-managed dirty files.
