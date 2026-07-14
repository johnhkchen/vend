# Structure — T-078-02-03

## Change inventory

Three existing source files are ticket-owned for this slice:

1. `src/init/init-core.ts`
2. `src/init/init-core.test.ts`
3. `src/init/init-effect.test.ts`

No source file is created or deleted.

Attempt-only RDSPI artifacts are written under:

- `.lisa/attempts/T-078-02-03/1/work/research.md`
- `.lisa/attempts/T-078-02-03/1/work/design.md`
- `.lisa/attempts/T-078-02-03/1/work/structure.md`
- `.lisa/attempts/T-078-02-03/1/work/plan.md`
- `.lisa/attempts/T-078-02-03/1/work/progress.md`
- `.lisa/attempts/T-078-02-03/1/work/review.md`
- `.lisa/attempts/T-078-02-03/1/work/review-disposition.json`

Lisa owns later publication of those artifacts.

## `src/init/init-core.ts`

### Existing responsibility

- Defines pure scaffold value types.
- Stores compile-time seed strings.
- Exports the canonical base manifest.
- Plans create-versus-skip behavior from plain filesystem listings.
- Defines template registry and overlay merge behavior.

### Modified region

Only the module-private `CHARTER_STUB` template literal in the “Knowledge stubs” section changes.

### Resulting internal structure

The string remains one template literal and contains, in order:

1. `# Vend — Charter`
2. Blank line.
3. Existing italicized authoring instruction, retaining “author your project's”.
4. Blank line.
5. `## Invariants`
6. Blank line.
7. One HTML comment line describing cast citations and stable P-labels.
8. Blank line.
9. Three P-labeled Markdown bullets with generic placeholder invariant text.
10. Final newline.

### Public interface

No public interface changes.

- `CHARTER_STUB` remains unexported.
- `SCAFFOLD_MANIFEST` retains its current type and entry shape.
- `planInit`, template registry, and helper signatures are unchanged.
- Manifest path, ordering, and number of entries are unchanged.

### Architectural boundary

The pure core continues to hold static content only. It does not import `matchIds` or validate itself
at runtime. Detector coupling belongs in tests; production init remains independent of gate logic.

## `src/init/init-core.test.ts`

### Existing responsibility

- Pins pure planner convergence.
- Pins Lisa-project detection.
- Pins honest-empty demand seeds.
- Pins manifest structural sanity.
- Pins template overlay and tuned-charter merge behavior.

### Import change

Add:

```ts
import { matchIds } from "../gate/gates.ts";
```

This import is test-only and uses the predecessor ticket's exported detector.

### New local fixture

Define or reuse a narrowed charter entry selected from `SCAFFOLD_MANIFEST` by:

- `kind === "file"`
- `path === "docs/knowledge/charter.md"`

The file already has a later `baseCharter` fixture for hackathon overlay tests. To avoid duplicate
selection, promote that fixture to the earlier manifest-test area or keep a single module-level
definition that both the new and existing blocks consume.

### New test group

Add a `describe` block named for the base charter convention.

Test 1, detector proof:

- assert `baseCharter` is defined;
- call `matchIds(baseCharter.contents, "P")`;
- assert the returned set contains at least one ID;
- optionally pin the expected example labels to make the examples deliberate.

Test 2, teaching comment proof:

- assert exact containment of the one-line HTML comment;
- keep the exact expected line in one string literal;
- do not normalize case or whitespace.

The tests remain pure: no filesystem calls, no process state, no BAML runtime.

### Existing test adjustment

Update the stale comment claiming bare init is unchanged if necessary. The relevant behavior now
changes intentionally: the base remains generic but gains labels. Assertions about hackathon-specific
content and generic authoring language remain valid.

### Public interface

None; this is test code.

## `src/init/init-effect.test.ts`

### Existing responsibility

- Exercises the real filesystem writer in temporary roots.
- Pins full-tree creation.
- Pins seed byte equality.
- Pins no-clobber and idempotence.
- Pins `runInit` refusal and template behavior.

### Import change

Add:

```ts
import { matchIds } from "../gate/gates.ts";
```

No production effect import changes.

### Fresh-workspace test extension

Inside the existing test:

```text
applyInitScaffold — a bare lisa project gets the full tree
  every manifest path is created, with seed contents verbatim and an honestly-empty board
```

After the generic file-seed loop:

1. Read `docs/knowledge/charter.md` into a local `charter` string.
2. Find and narrow the corresponding charter file entry in `SCAFFOLD_MANIFEST`.
3. Assert the entry exists.
4. Assert `matchIds(charter, "P").size` is greater than zero.
5. Assert disk bytes equal the manifest entry's contents.

The existing `finally` block continues to remove the temp root.

### Why this location

- It is the canonical fresh base-scaffold effect scenario.
- The charter is absent before apply and therefore definitely created by the effect.
- It avoids repeating temp-directory setup.
- It makes the acceptance property readable next to the disk write.

## Files explicitly unchanged

### `src/init/init-effect.ts`

The generic writer already materializes manifest bytes. Adding charter awareness here would violate
the pure-core/impure-shell split.

### `src/gate/gates.ts`

`matchIds` is already exported by predecessor `T-078-02-01`. Its behavior and signatures are settled.

### `src/gate/gates.test.ts`

Detector correctness is already pinned. This ticket pins that the init seed conforms to it.

### Template overlays

Hackathon and kitchen content are explicitly out of this story slice. Merge behavior is only
regression-tested through existing tests.

### Ticket metadata

The ticket's `phase` and `status` fields remain untouched; Lisa advances them from artifacts.

## Dependency direction

Production dependency graph remains:

```text
init-effect.ts -> init-core.ts -> static seed values
```

Test-only verification adds:

```text
init-core.test.ts   -> gates.ts::matchIds
init-effect.test.ts -> gates.ts::matchIds
```

There is no production `init` to `gate` dependency and no cycle.

## Commit structure

The seed plus its pure and effect proofs form one meaningful, inseparable source unit. Commit them in
one Lisa transaction with exact includes:

```text
src/init/init-core.ts
src/init/init-core.test.ts
src/init/init-effect.test.ts
```

No RDSPI attempt artifacts are included in that source commit because Lisa publishes them through
the attempt workflow.

## Structural acceptance mapping

- P-labels in `CHARTER_STUB`: `src/init/init-core.ts`.
- Resolution through exported detector: `src/init/init-core.test.ts`.
- Exact comment-line pin: `src/init/init-core.test.ts`.
- Fresh workspace charter at expected path: `src/init/init-effect.test.ts`.
- Shared detector seam: imports from `src/gate/gates.ts`.
- No-clobber and overlay safety: unchanged implementation plus existing regression suite.
