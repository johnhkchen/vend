# Review — T-078-02-03

## Disposition

Pass.

The ticket's acceptance criterion is fully met. The implementation is committed, the focused tests
and complete repository gate are green, and no ticket-owned source remains dirty.

## What changed

### `src/init/init-core.ts`

The generic `CHARTER_STUB` now includes an `Invariants` section with three stable example labels:

- `P1 — Name the durable value`;
- `P2 — State the hard boundary`;
- `P3 — Make success verifiable`.

The examples are deliberately generic and explicitly replaceable. They teach the project charter's
required shape without copying Vend's own product-specific P1–P7 into an unrelated new workspace.

The scaffold also carries the exact one-line comment:

```markdown
<!-- Casts cite these labels in `advances`; keep each P-label stable once referenced. -->
```

This teaches both sides of the convention: where casts place citations and why labels should remain
stable after use.

No manifest entry, path, order, or public init-core interface changed.

### `src/init/init-core.test.ts`

The pure test layer now imports the predecessor ticket's exported `matchIds` seam.

The new test group reads the actual generic charter bytes from `SCAFFOLD_MANIFEST` and proves:

- the charter entry exists;
- the gate detector resolves exactly `P1`, `P2`, and `P3`;
- the complete teaching comment is present byte-for-byte.

The base charter fixture was moved to one module-level definition and reused by the pre-existing
hackathon overlay tests. No second charter selector or detector regex was introduced.

Stale comments implying the base charter must remain byte-identical to its old version were updated.
The overlay behavior assertions remain unchanged: the hackathon charter still overrides the generic
base slot and retains its tuned content.

### `src/init/init-effect.test.ts`

The existing fresh bare-project effect test now directly reads the generated
`docs/knowledge/charter.md` from its real temporary directory.

It proves:

- the expected path exists after scaffold apply;
- the written bytes resolve at least one P-label through `matchIds`;
- the written bytes equal the source charter entry in `SCAFFOLD_MANIFEST`.

This is an explicit effect-level acceptance proof in addition to the pre-existing general loop that
checks every scaffold file against its manifest contents.

Stale test wording about E-040 byte identity was updated to describe the newly labeled generic stub.

## Acceptance evaluation

### “A pure test resolves at least one P-label from CHARTER_STUB”

Pass.

`init-core.test.ts` reaches the private stub through its actual exported consumer,
`SCAFFOLD_MANIFEST`, and resolves three labels.

This access path is stronger than exporting the constant solely for tests because it proves that the
manifest entry used by planning actually contains the labeled bytes.

### “through the exported gate detector”

Pass.

The test imports and calls `matchIds` from `src/gate/gates.ts`. It does not reproduce the regex or
infer validity from raw string containment.

### “pins the 'casts cite these labels' comment line”

Pass.

The pure test asserts the full HTML comment exactly, including capitalization, backticks,
punctuation, and the stable-label instruction.

### “the init effect test shows a fresh vend init workspace carries the labeled charter”

Pass.

The existing fresh bare Lisa project starts with only `CLAUDE.md`. After the real filesystem effect
runs, the test reads `docs/knowledge/charter.md`, detects P-labels from its disk bytes, and confirms
those bytes equal the manifest seed.

### Expected path

Pass.

The effect assertion reads exactly `docs/knowledge/charter.md` beneath the temporary project root.

## Test coverage

### New focused coverage

- Pure seed-to-detector contract.
- Exact teaching-comment contract.
- Real effect materialization of a labeled charter.
- Disk-to-manifest byte equality for the charter.

### Existing relevant regression coverage retained

- Full manifest creation in a bare Lisa project.
- Every scaffold seed written byte-for-byte.
- Pre-existing file no-clobber behavior.
- Idempotent second apply.
- Bare `runInit` behavior.
- Standalone minimal-template behavior.
- Hackathon overlay wins at the charter path.
- User-edited charter remains untouched.
- Tuned hackathon charter source drift guard.
- Honest-empty board and archive behavior.
- Manifest ordering and uniqueness.

### Focused result

```text
bun test src/init/init-core.test.ts src/init/init-effect.test.ts
```

- 65 passed.
- 0 failed.
- 418 expectations.

### Full gate result

```text
bun run check
```

- BAML generation passed.
- Typecheck passed.
- 1,819 tests passed.
- 1 intentional skip.
- 0 failures.
- 5,900 expectations across 119 test files.

The skipped release acceptance test is pre-existing and self-reports that no `dist/` artifacts were
present; it is unrelated to this ticket.

## Architecture review

The pure-core/impure-shell boundary remains intact.

- Static charter content stays in the pure init core.
- The pure planner remains unaware of charter semantics.
- The filesystem writer remains a generic manifest applicator.
- Gate detection is reused only by tests to prove cross-module conformance.
- No production init-to-gate dependency was added.

The manifest remains the one source of truth for scaffold bytes. The effect does not synthesize or
modify charter content.

## Scope review

The implementation remains inside the story's declared init surface.

Unchanged by design:

- gate verdicts and refusal wording;
- doctor behavior;
- epic schema;
- charter schema;
- hackathon charter content;
- kitchen charter content;
- existing project files;
- migration or auto-labeling behavior;
- CLI dispatch and output.

No live or metered cast was run. All evidence is pure fixture or free temp-directory execution, as
required by the story's honest boundary.

## Compatibility review

- New base scaffolds receive richer generic charter bytes.
- Existing workspaces remain protected by create-versus-skip planning and exclusive file creation.
- The manifest's entry count and order are unchanged.
- Overlay replacement remains path-based and continues to win before disk application.
- The generic authoring phrase remains present, preserving earlier test intent.
- No public function or type signature changed.

## Commit review

Commit:

```text
3c26cfc3180e4d75d587d1bde4317ebf5c74f30e
feat(init): scaffold labeled charter invariants
```

It was created using `lisa commit-ticket` with exact includes.

The commit contains exactly:

- `src/init/init-core.ts`
- `src/init/init-core.test.ts`
- `src/init/init-effect.test.ts`

All three source paths are clean after the commit. No ordinary-index staging or ordinary Git commit
was used.

## Open concerns

No blocking concerns.

One deliberate limitation is worth making explicit: the shipped invariant text is instructional
placeholder content, not a generated project-specific value function. That is correct for a generic
stub and preserves the “author your project's value function” contract. The operator still owns the
judgment of replacing the examples; the convention itself is no longer hidden.

The ticket does not migrate existing unlabeled charters, and no such behavior was added. Existing
projects learn through the sibling refusal and doctor surfaces owned elsewhere in this story.

## Final assessment

The change meets the newcomer at the correct boundary: the first generated charter is immediately
legible to the same detector used by clearing gates, and the charter itself explains how its stable
labels participate in `advances`. The proof covers both pure configuration and real disk output while
preserving all init safety properties.

Ready for Lisa completion publication.
