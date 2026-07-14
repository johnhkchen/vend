# Review — T-069-01-01

## Outcome

Acceptance is met.

The ticket now provides one canonical, addon-free executor-seat contract for Lisa routing and carries
an optional `agent` string through the decompose input assembly seam. The supplied value is preserved
verbatim for the later write-side guard. Omitting it creates no property and leaves the legacy
assembled object shape unchanged.

The repository gate is green.

## What changed

### Created: `src/play/agent-seat.ts`

- Added the canonical runtime tuple `KNOWN_SEATS`.
- Its exact values are `claude` and `codex`.
- Added `AgentSeat`, derived from the tuple rather than separately enumerated.
- Added the pure `findUnknownSeat(seat)` membership oracle.
- Known seats return `null`.
- Unknown seats return the original offending string.
- Matching is exact; no trim/case normalization expands the contract.
- The module has no imports or effects and is addon-free.

### Created: `src/play/agent-seat.test.ts`

- Added the ticket's exact known/unknown seat examples.
- Pinned the complete constant value to `["claude", "codex"]`.
- Added a temp-filesystem fixture for `assembleInputs`.
- Proved `agent: "codex"` is transported and exists as an own property.
- Proved omission reads as `undefined`.
- Proved omission does not create an own property.
- Proved omission deeply equals the legacy three-key object.
- Cleans every temp fixture in `finally`.
- Imports no BAML-bearing module.

### Modified: `src/play/project-context.ts`

- Added `readonly agent?: string` to `ContextSources`.
- Added `readonly agent?: string` to `DecomposeInputs`.
- Documented that the field is effect-only Lisa routing metadata.
- Added an `undefined`-checked conditional spread in `assembleInputs`.
- Kept arbitrary strings intact for later validation instead of hiding runtime input behind a union.
- Preserved existing `after` behavior.
- Updated the module's test-boundary comment now that optional assembly transport has a fixture test.

### Created work artifacts

- `docs/active/work/T-069-01-01/research.md`
- `docs/active/work/T-069-01-01/design.md`
- `docs/active/work/T-069-01-01/structure.md`
- `docs/active/work/T-069-01-01/plan.md`
- `docs/active/work/T-069-01-01/progress.md`
- `docs/active/work/T-069-01-01/review.md`

### Deleted files

- None.

## Acceptance review

### One canonical known-seat list

Pass.

`KNOWN_SEATS` is declared once in production code as a readonly literal tuple containing exactly
`claude` and `codex`. The derived `AgentSeat` type cannot drift from the runtime value.

### Unknown seat result

Pass.

The addon-free unit test asserts `findUnknownSeat("gpt")` returns exactly `"gpt"`.

### Known seat results

Pass.

The same test asserts both `findUnknownSeat("claude")` and `findUnknownSeat("codex")` return null.

### Supplied assembly field

Pass.

The temp-root test invokes `assembleInputs({ epicPath, projectRoot, agent: "codex" })` and observes
`inputs.agent === "codex"`. It also confirms the field is an own property when supplied.

### Absent assembly field and byte-identical shape

Pass.

The absence test confirms:

- property access returns `undefined`;
- `Object.hasOwn(inputs, "agent")` is false;
- the whole result exactly equals `{ epic, charter, project }`.

The implementation uses a conditional spread only when `src.agent !== undefined`, so it does not add
an `agent: undefined` key. This is the load-bearing compatibility behavior.

## Test coverage

### Focused verification

Command:

```bash
bun test src/play/agent-seat.test.ts src/play/project-context.test.ts
```

Result:

- 13 passed.
- 0 failed.
- 32 assertions.

Coverage includes:

- exact known-seat vocabulary;
- both known membership branches;
- unknown membership branch and returned value;
- supplied optional metadata;
- absent optional metadata;
- exact legacy object shape;
- all existing project snapshot and title-reader regression cases.

### Static verification

Command:

```bash
bun run build
```

Result: passed with no TypeScript errors.

### Full repository gate

Command:

```bash
bun run check
```

Result:

- BAML generation passed using CLI 0.223.0.
- Typecheck passed.
- 1,603 tests passed.
- 1 existing test skipped because no `dist/` artifacts were present.
- 0 tests failed.
- 4,816 assertions ran across 109 files.
- No generated-file drift remained.

### Diff hygiene

`git diff --check` passed with no whitespace errors.

## Pure-core / impure-shell assessment

The split is preserved.

- Seat membership is a dependency-free pure function over one string and a constant tuple.
- Input assembly remains the existing thin filesystem shell.
- Assembly does not make policy decisions or throw validation errors.
- Later materialization code can compose the pure oracle before its first write.
- No render/gate/BAML dependency was introduced into the seat contract.

## Scope review

The implementation intentionally does not:

- stamp ticket frontmatter;
- throw or define the later write-side typed error;
- relabel decompose outcomes;
- add an `unknown-seat` run-log outcome;
- thread chain options;
- parse CLI flags;
- change Lisa dispatch;
- change Vend executor selection;
- add a third seat;
- alter the unrelated presentation `--seat designer|dev` concept.

Those exclusions match the parent story DAG and prevent overlap with T-069-01-02 through T-069-01-05.

## Compatibility assessment

- Existing callers compile unchanged because both fields are optional.
- Bare callers receive the same object keys and values as before.
- Existing `after` transport is unchanged.
- A supplied invalid string, including an empty string, is deliberately retained so the downstream
  write-side guard can refuse it rather than assembly silently erasing it.
- The contract does not conflate `codex` routing with the `openai-compat` Vend executor adapter.

## Open concerns and limitations

No ticket-blocking concern remains.

Expected story-level remainder:

- This ticket only defines the guard; it does not yet call it.
- Until T-069-01-02 lands, an unknown transported seat is not refused by materialization.
- Until later tickets land, no public CLI or chain caller supplies the field.
- The named write-side error and run-log relabel remain deliberately downstream.
- Live metered routing is explicitly outside the story's fixture-proven boundary.

These are planned DAG boundaries, not hidden defects in this ticket.

## Working-tree and orchestration safety

The worker did not edit ticket phase/status frontmatter. The pre-existing Lisa-owned phase transition,
untracked epic, and untracked story were preserved and excluded from explicit staging. No unrelated
working-tree change was overwritten.

## Critical issues for human attention

None.

## Final verdict

Green. The canonical vocabulary, pure guard, optional input field, exact absence compatibility, tests,
and all required RDSPI artifacts are complete. The ticket-owned changes are ready to commit and hand
off to the downstream story tickets.
