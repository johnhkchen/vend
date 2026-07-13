# Structure — T-080-01-01 marker tolerates untracked duration

## Change-set overview

This ticket modifies eight tracked repository paths and creates no new production module:

1. `src/seam/lisa-loop-settled-core.ts`;
2. `src/seam/lisa-loop-settled-core.test.ts`;
3. `src/seam/lisa-loop-settled.test.ts`;
4. `src/seam/fixtures/lisa-loop-settled.valid.json`;
5. `src/settle/settle-core.test.ts`;
6. `src/settle/settle.ts`;
7. `src/settle/settle.test.ts`;
8. `docs/knowledge/lisa-loop-settled-contract.md`.

No file is deleted. No `.lisa/hooks/*` file changes. No ticket/story/epic frontmatter changes. No
shared `docs/active/work/` path is written by this attempt.

## Module boundary map

```text
Lisa environment
    |
    v
lisa-loop-settled-core.ts          PURE schema + event classification
    |
    v
lisa-loop-settled.ts               IMPURE atomic publication
    |
    v
.vend/loop-settled.json            four or five closed v1 fields
    |
    v
settle-core.ts                      PURE parse + verdict carry-through
    |
    v
settle.ts                           IMPURE lifecycle + PURE terminal formatter
```

Only the first and last production modules require logic changes. The recorder and settle core
already delegate to the marker abstraction and remain structurally correct.

## `src/seam/lisa-loop-settled-core.ts`

### Constants

Replace the single “all keys required” interpretation with two explicit sets:

```ts
const REQUIRED_MARKER_KEYS = Object.freeze([
  "v",
  "kind",
  "project",
  "ticketsDone",
] as const);

const MARKER_KEYS = Object.freeze([
  ...REQUIRED_MARKER_KEYS,
  "durationSecs",
] as const);
```

The exact names may remain local. The public schema version, kind, and marker path stay unchanged.

### Public marker types

Change only the duration property:

```ts
export interface LisaLoopSettledMarkerInput {
  readonly project: string;
  readonly ticketsDone: number;
  readonly durationSecs?: number;
}

export interface LisaLoopSettledMarker {
  readonly v: 1;
  readonly kind: "lisa-loop-settled";
  readonly project: string;
  readonly ticketsDone: number;
  readonly durationSecs?: number;
}
```

All other public unions and function signatures remain stable.

### Exact-key helper

`hasExactMarkerKeys(value)` will establish this invariant:

- key count is four or five;
- every required key is present;
- every actual key belongs to `MARKER_KEYS`.

It does not validate values. Value validation remains visible in the revival branch.

### Builder

`buildLisaLoopSettledMarker(input)` keeps existing project/ticket validation. Duration validation
becomes conditional:

```ts
if (input.durationSecs !== undefined && !isNonNegativeSafeInteger(input.durationSecs)) {
  throw new TypeError(...);
}
```

Return shape:

```ts
return Object.freeze({
  v: LISA_LOOP_SETTLED_SCHEMA_VERSION,
  kind: LISA_LOOP_SETTLED_KIND,
  project: input.project,
  ticketsDone: input.ticketsDone,
  ...(input.durationSecs === undefined ? {} : { durationSecs: input.durationSecs }),
});
```

This preserves field order and ensures absent means no own property.

### Revival

`reviveLisaLoopSettledMarker(value)` keeps object, version, kind, project, and ticket validation.
Duration validation becomes conditional on property presence:

```ts
const hasDuration = Object.hasOwn(value, "durationSecs");
if (hasDuration && !isNonNegativeSafeInteger(value.durationSecs)) return null;
```

The builder call conditionally includes the duration. Because the exact-key helper has already run,
four fields means absence and five fields means duration is the fifth key.

### Event classification

Keep `parseEventQuantity` strict for values that exist. Restructure duration handling:

```ts
const durationSecs = input.durationSecs === undefined
  ? undefined
  : parseEventQuantity(input.durationSecs);

if (durationSecs === null) return refusedDuration;
```

The marker builder then receives `durationSecs`; its conditional shape prevents an own undefined
property. The project root and ticket count control flow is unchanged.

### Serialization

No signature or algorithm change is required. Rebuilding through the widened builder and
`JSON.stringify` preserves four-field or five-field marker bytes with the existing final newline.

## `src/seam/fixtures/lisa-loop-settled.valid.json`

Replace the existing tracked fixture with the canonical untracked form:

```json
{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":2}
```

Maintain exactly one final newline and production field ordering.

## `src/seam/lisa-loop-settled-core.test.ts`

### Test data organization

Split the current single `expectedMarker` concept into:

- `expectedUntrackedMarker`: four fields, matches fixture;
- `expectedTrackedMarker`: five fields, adds `durationSecs: 41`.

Both constants remain frozen test data.

### Fixture coverage

- Parse the updated fixture as `expectedUntrackedMarker`.
- Assert returned marker is frozen.
- Assert no own `durationSecs` property.
- Serialize byte-for-byte back to fixture.
- Add an inline tracked JSON round-trip test.
- Assert tracked marker is frozen and retains numeric duration.

### Builder coverage

- Add/adjust a test that missing duration produces the untracked shape.
- Retain zero as an honest tracked duration.
- Retain invalid present duration cases.

### Closed-schema coverage

- Update shared malformed objects to use the appropriate tracked marker base.
- Add invalid present undefined/null/string duration cases if useful.
- Keep extra-key refusal.
- Add extra-key refusal for the untracked base or make the existing case use it.
- Do not list missing duration as malformed.

### Classifier coverage

- Add a complete-event test with `durationSecs: undefined`.
- Assert the full complete result and four-field marker.
- Assert absence with `Object.hasOwn`.
- Keep documented tracked classification test.
- Tighten the present-garbage case to assert the exact existing refusal reason.

## `src/seam/lisa-loop-settled.test.ts`

### Recorder effect test

Add a direct test or broaden the first publication test so a complete event with undefined duration:

- returns `kind: "recorded"`;
- writes the stable Vend path;
- parses as a valid four-field marker;
- has no own duration property;
- creates only `.vend/` under the fixture root.

Retain tracked-duration replacement coverage to prove five-field producer compatibility.

### Real hook integration

In the second commit, remove `LISA_DURATION_SECS` from the spawned hook environment. Because spreading
the host environment could accidentally carry such a key, explicitly construct the environment as:

```ts
env: {
  ...process.env,
  LISA_DURATION_SECS: undefined,
  ...otherFixtureFacts,
}
```

Assert the hook output contains the exact untracked loop line and contains no fabricated duration
suffix. Retain exactly-once, marker-consumed, and repeated-settle assertions.

No hook source changes.

## `src/settle/settle-core.test.ts`

### Valid provenance coverage

Keep the existing tracked-marker test. Add a sibling untracked-marker test using serialization of
the four-field marker and assert `verdict.loop` equals that marker with no duration property.

### Malformed coverage

Replace the current no-duration “schema mismatch” bytes because they become valid. Use a closed-
schema violation that remains malformed, for example:

```json
{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":3,"extra":true}
```

The refusal code/path/action assertions remain unchanged.

No production `src/settle/settle-core.ts` edit is planned.

## `src/settle/settle.ts`

### Renderer branch

Replace unconditional duration interpolation with a common base line and optional suffix:

```ts
const loopLine =
  `loop: ${result.loop.project} — ${countNoun(result.loop.ticketsDone, "ticket")} done`;

lines.push(
  result.loop.durationSecs === undefined
    ? loopLine
    : `${loopLine} in ${result.loop.durationSecs}s`,
);
```

The branch is local to `renderSettleResult`. Marker claim, restoration, consumption, gate execution,
and last-settle persistence do not change.

## `src/settle/settle.test.ts`

### Terminal contract

- Retain the complete tracked verdict and `in 41s` assertion.
- Add an untracked verdict derived from the same fixture with duration omitted.
- Assert exact loop line `loop: vend — 1 ticket done`.
- Assert that line does not contain an `in <number>s` suffix.
- Assert the full output contains neither `undefineds` nor a fabricated `0s` duration.

### Lifecycle fixture

The direct run-settle lifecycle may remain tracked because the hook integration provides the full
untracked filesystem path. If updated or supplemented, it must continue proving consume-on-verdict
and immediate repeat.

## `docs/knowledge/lisa-loop-settled-contract.md`

Update these sections only:

- selected emission: duration is supplied when tracked;
- canonical v1 fixture: four-field untracked form;
- exact shape: four required fields and optional `durationSecs`;
- table: mark duration optional;
- quantity paragraph: tickets remain required, duration absence is admitted, invalid present
  duration is not;
- consumer: project/tickets always print, duration prints when present;
- version evolution: both shapes are the current v1 agreement.

Producer lifecycle, atomicity, ownership, malformed-marker behavior, and exclusions remain intact.

## Public interface impact

One exported type changes:

```text
LisaLoopSettledMarker.durationSecs: number -> number | undefined via optional property
```

This is a compile-time widening and persisted-schema relaxation. No command signature, file path,
schema version, result discriminant, or effect function changes.

## Invariants after the change

- Every marker has `v`, `kind`, `project`, and `ticketsDone`.
- A marker has no unknown keys.
- If `durationSecs` exists, it is a non-negative safe integer.
- Missing duration is never converted to a number.
- Present malformed duration never becomes a marker.
- Serialization round-trips the exact valid shape.
- Tracked markers render exactly as before.
- Untracked markers still render loop provenance.
- Settle consumption remains one-shot and atomic.
- Hook containment remains unchanged.

## Implementation and commit ordering

### Unit 1 — marker schema and durable contract

Edit and verify:

- `src/seam/lisa-loop-settled-core.ts`;
- `src/seam/lisa-loop-settled-core.test.ts`;
- `src/seam/lisa-loop-settled.test.ts` for direct recorder coverage only;
- `src/seam/fixtures/lisa-loop-settled.valid.json`;
- `src/settle/settle-core.test.ts`;
- `docs/knowledge/lisa-loop-settled-contract.md`.

Run focused tests, typecheck/full gate, then commit those exact paths.

### Unit 2 — honest settle surface

Edit and verify:

- `src/settle/settle.ts`;
- `src/settle/settle.test.ts`;
- `src/seam/lisa-loop-settled.test.ts` for real-hook untracked integration.

Run focused seam/settle tests and full gate, then commit those exact paths.

The repeated include of `src/seam/lisa-loop-settled.test.ts` across transactions is intentional: the
first commit owns direct recorder evidence; the second owns the hook-to-render integration evidence.
