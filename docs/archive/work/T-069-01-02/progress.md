# Progress — T-069-01-02

## Status

Implementation is complete. Focused tests, TypeScript build, diff hygiene, and the full repository
gate are green. Final review and artifact commit remain at the time of this progress snapshot.

## Completed phases

- Research completed and written to `research.md`.
- Design completed and written to `design.md`.
- Structure completed and written to `structure.md`.
- Plan completed and written to `plan.md`.
- Implementation executed against that plan.

## Completed implementation steps

### Canonical contract composition

- Imported `KNOWN_SEATS` from `src/play/agent-seat.ts`.
- Imported `findUnknownSeat` from the same module.
- Introduced no duplicate routing-seat list.
- Introduced no executor-registry dependency.

### Typed write refusal

- Added exported `UnknownSeatError` in `src/play/materialize.ts`.
- The class extends `Error`.
- The class carries readonly `seat` data.
- Its `name` is exactly `UnknownSeatError`.
- Its message names the rejected value.
- Its message derives the known-value list from `KNOWN_SEATS`.
- The error is distinct from collision, bare-code, enum drift, and filesystem failures.

### Pure ticket rendering

- Added optional trailing `agent?: string` to `renderTicketFile`.
- Added conditional frontmatter insertion after `priority:`.
- The conditional uses `agent !== undefined`.
- Missing input contributes no array item and no bytes.
- Story rendering is unchanged.
- Ticket body rendering is unchanged.
- Alias mapping and dependency rendering are unchanged.

### Impure materialization guard

- Added optional trailing `agent?: string` to `materialize`.
- Validation runs at function entry when a value is supplied.
- The canonical oracle is called once.
- An unknown result throws `UnknownSeatError`.
- The throw occurs before calls to `listIdsIn`, clock read, render, mkdir, or write.
- Valid/absent calls continue into the existing collision and bare-code guard order.
- The single supplied value is passed to every ticket renderer.
- Existing three-argument callers remain unchanged.

### Production documentation

- Updated the module comment to describe the routing-seat guard and stamp.
- Updated the renderer docblock for supplied/absent byte behavior.
- Updated the materialize docblock from two guards to three.
- Documented ordering as input, identity, content.
- Corrected the stale claim that the impure verb itself was not fixture-tested.

## Test changes completed

### Legacy absence golden

- Retained the existing no-seat full-file expected literal without adding an `agent:` line.
- Added an explicit assertion that the body contains no frontmatter `agent:` line.
- This pins exact pre-change bytes and improves failure diagnosis.

### Routed pure golden

- Added an exact full-file golden for `codex`.
- It pins `agent: codex` immediately after `priority: high`.
- It pins `phase: ready` immediately after the new line.
- All other file bytes remain represented in the literal.

### Known-seat filesystem proof

- Added a multi-ticket materialization fixture using `codex`.
- It verifies both ticket filenames are written.
- It reads every ticket and checks priority/agent/phase adjacency.
- It asserts exactly one `agent: codex` line per ticket.
- It asserts the story file receives no `agent:` line.

### Unknown-seat filesystem proof

- Added a fresh-target fixture using `gpt`.
- It verifies the thrown value is `UnknownSeatError`.
- It verifies the error name and rejected-seat payload.
- It verifies the message names the unknown and known values.
- It verifies neither stories nor tickets target directory exists after refusal.
- This proves zero created files without relying on cleanup behavior.

## Focused verification

Command:

```bash
bun test src/play/materialize.test.ts
```

Result:

- 34 tests passed.
- 0 tests failed.
- 82 assertions ran.
- The existing collision, bare-code, alias, story, and charter-code cases remain green.
- The new no-seat, codex, and gpt acceptance cases are green.

## Static verification

Command:

```bash
bun run build
```

Result:

- `tsc --noEmit` passed.
- Existing callers compile with the optional trailing parameter.
- The new error and optional renderer parameter are type-correct.

## Diff hygiene

Command:

```bash
git diff --check
```

Result:

- Passed with no whitespace errors.

The scoped production/test diff at this point contains:

- 48 changed lines in `src/play/materialize.ts`.
- 63 changed lines in `src/play/materialize.test.ts`.
- No unrelated production module changes.

## Deviations from plan

No material deviation.

Minor execution detail:

- The code comment update also corrected a stale statement that `materialize` was not directly
  fixture-tested. The existing file already has real-filesystem calls to the public function, so the
  revised wording is factual and within the documentation step.

## Pure-core / impure-shell checkpoint

- The membership oracle remains in the dependency-free pure contract module.
- Exact ticket formatting remains a pure function over plain values.
- Typed policy refusal is constructed without effects.
- Filesystem and clock operations remain in the existing `materialize` shell.
- The shell validates once, then threads the cleared value to pure rendering.
- No cleanup effect is required for refusal.

## Scope checkpoint

Not changed:

- decompose effect argument threading;
- effect error relabeling;
- run-log outcomes;
- chain gesture options;
- CLI parsing or dispatch;
- BAML models or generated client;
- story frontmatter;
- ticket body prose;
- Lisa dispatch;
- seat vocabulary.

These remain assigned to later tickets in the story DAG.

## Worktree hygiene

Pre-existing Lisa/orchestration changes remain present:

- `.lisa/provenance.jsonl` modified;
- `T-069-01-01.md`, `T-069-01-02.md`, and `T-069-01-03.md` modified;
- `E-069.md` and `S-069-01.md` untracked.

The implementation did not edit those files. Explicit path staging will exclude them.

## Full repository gate

Command:

```bash
bun run check
```

Result:

- BAML client generation passed with CLI 0.223.0.
- TypeScript typecheck passed.
- 1,607 tests passed.
- 1 existing dist-dependent integration test was skipped.
- 0 tests failed.
- 4,837 assertions ran across 109 files.
- No generated-file drift remained.

## Remaining work

1. Commit code, tests, and current work artifacts without Lisa files.
2. Write `review.md` with final test counts and open concerns.
3. Commit the final review artifact.
4. Stop without editing ticket phase or status.
