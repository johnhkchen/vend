# Structure — T-079-03-02 settle rides the cord

## Modified source files

### `src/settle/settle-core.ts`

Responsibility remains pure verdict computation.

Changes:

- import the loop marker parser and marker path from `src/seam/lisa-loop-settled-core.ts`;
- type-import `LisaLoopSettledMarker`;
- widen `SettleRefusal` into explicit last-settle and loop-settled refusal variants;
- add `loop` to `SettleVerdict`;
- add `loopSettledContents` to `ComputeSettleInput`;
- parse loop marker bytes through the dependency-owned schema check;
- return a named refusal for malformed marker bytes;
- carry a copied/frozen typed valid marker into the verdict;
- preserve all existing delta, gate, presweep, review, and next-marker behavior.

No filesystem, process, clock, or rendering code enters this module.

### `src/settle/settle-core.test.ts`

Responsibility remains unit coverage for pure settle policy.

Changes:

- extend the canonical input helper with `loopSettledContents: null`;
- assert ordinary verdicts contain `loop: null`;
- add a canonical valid marker case with project/count/duration assertions;
- add malformed JSON and schema-mismatch cases;
- assert malformed loop state returns the new refusal and does not return verdict fields;
- retain the full existing last-settle and exception suite.

### `src/settle/settle.ts`

Responsibility remains all settle filesystem/process effects and terminal rendering.

Changes:

- import `link` for non-clobbering claim restoration;
- import the canonical loop marker path;
- add a private claimed-marker structure;
- add `claimLoopSettledMarker(root)` using atomic rename to a unique sibling;
- add `restoreLoopSettledMarker(claim)` using atomic hard-link publication;
- add `consumeLoopSettledMarker(claim)` by removing only the claimed name;
- claim before expensive observation;
- pass claimed bytes or null into the pure core;
- restore on refusal or thrown error;
- write the last-settle continuation before consuming a valid claim;
- add the loop provenance line to rendering when present.

The existing public `runSettle(options)` and `renderSettleResult(result, options)` signatures remain
unchanged. No executor or ledger dependency is added.

### `src/settle/settle.test.ts`

Responsibility expands from rendering policy to focused settle effect lifecycle coverage.

Changes:

- update verdict fixtures with `loop`;
- assert the exact provenance line and count grammar;
- assert loop-null verdicts omit provenance;
- add a malformed-loop refusal rendering fixture;
- add a temporary fixture repository helper sufficient for direct `runSettle` calls;
- prove a valid marker is removed only after a verdict;
- prove a repeated settle carries no loop provenance;
- prove malformed bytes remain pending after refusal.

The fixture uses a local `package.json`/check script and a committed source/board baseline so the real
gate and presweep paths execute without touching the live repository.

### `.lisa/hooks/on-notify`

Responsibility remains the project-owned adapter for Lisa's existing notify event.

Changes within the `complete` branch:

- retain recorder lookup and environment validation;
- only after recorder success, locate `src/cli.ts` relative to the hook;
- invoke `settle` without suppressing its terminal output;
- contain settle failure so optional ntfy and the hook's final success remain unchanged;
- update comments to describe record-plus-settle behavior.

No ntfy case body or message content changes.

### `src/seam/lisa-loop-settled.test.ts`

Responsibility remains the crossing and real-hook integration suite.

Changes:

- retain focused producer tests;
- expand the real-hook complete fixture into a minimal valid Vend repository;
- make the fixture gate deterministic and commit its source/board baseline;
- capture hook stdout/stderr;
- assert one complete event prints the exact provenance line;
- assert the event consumes `.vend/loop-settled.json`;
- invoke `vend settle` again and assert no provenance line is printed;
- retain proof that ntfy configuration is unnecessary;
- retain proof that the hook exits 0.

## Unchanged files

### `src/seam/lisa-loop-settled-core.ts`

The v1 schema, parser, type, serializer, and path constant already satisfy the consumer contract and
are reused without modification.

### `src/seam/lisa-loop-settled.ts`

The recorder already validates and atomically publishes the marker. Trigger orchestration belongs in
the selected existing hook, so the recorder stays single-purpose.

### `src/cli.ts`

Bare `vend settle` already parses, dispatches, prints verdicts, reports refusals, takes no budget,
and avoids executors. The result widening flows through its existing discriminant without edits.

### `docs/knowledge/lisa-loop-settled-contract.md`

The dependency contract already assigns exact CLI wording and atomic consumption to this ticket and
already excludes watchers. Implementation fulfills rather than revises it.

### Ticket and board files

Lisa owns phase/status transitions. No board frontmatter is modified by this attempt.

## Internal interfaces

Conceptual refusal union:

```ts
type SettleRefusal = LastSettleRefusal | LoopSettledRefusal;
```

Conceptual verdict addition:

```ts
interface SettleVerdict {
  readonly loop: LisaLoopSettledMarker | null;
  // existing fields unchanged
}
```

Conceptual input addition:

```ts
interface ComputeSettleInput {
  readonly loopSettledContents: string | null;
  // existing facts unchanged
}
```

Conceptual private effect shape:

```ts
interface ClaimedLoopSettledMarker {
  readonly stablePath: string;
  readonly claimedPath: string;
  readonly contents: string;
}
```

No new public package surface is required.

## Dependency direction

```text
on-notify complete
  -> seam recorder
  -> .vend/loop-settled.json
  -> existing CLI settle dispatch
  -> settle effect shell
      -> seam pure parser
      -> settle pure core
      -> last-settle persistence + loop claim consumption
  -> settle renderer stdout/stderr
```

The settle core depends only on the seam core, never on the seam filesystem shell. The hook depends
on executable entry files by path, not imported module internals.

## Ordering constraints

1. Update the pure types and computation before the effect shell so TypeScript exposes every caller
   that must supply loop bytes.
2. Update pure tests alongside that unit.
3. Add claim/finalize/restore behavior and renderer output in the effect shell.
4. Add direct effect tests before wiring the automatic hook.
5. Wire the hook only after direct consumption is proven.
6. Expand the real-hook test to prove the whole event path and second-settle behavior.
7. Run targeted tests, then the repository gate.

## Commit units

Meaningful source unit 1:

- `src/settle/settle-core.ts`
- `src/settle/settle-core.test.ts`
- `src/settle/settle.ts`
- `src/settle/settle.test.ts`

Meaningful source unit 2:

- `.lisa/hooks/on-notify`
- `src/seam/lisa-loop-settled.test.ts`

Each unit is committed with one `lisa commit-ticket` invocation and exact repeated `--include`
arguments. No ordinary `git add` or `git commit` is used.

## Artifact ownership

- Research, design, structure, plan, progress, review, and disposition stay in the private attempt
  work directory.
- Lisa later publishes admitted artifacts to `docs/active/work/T-079-03-02/`.
- Attempt artifacts are not included in ticket source commits.
- Existing unrelated modified/untracked paths remain untouched.
