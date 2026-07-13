# Review — T-079-03-01

## Disposition

Pass.

The ticket's acceptance criterion is met. The lisa/Vend seam agreement is documented, the selected
existing complete event now produces a durable Vend-owned marker, the v1 schema validates a committed
fixture and refuses malformed shapes, focused and full gates are green, and the exact source unit is
committed with no ticket-owned path left dirty.

## What changed

### Durable contract

Created `docs/knowledge/lisa-loop-settled-contract.md`.

It names all acceptance-required parts:

- marker home: `.vend/loop-settled.json`;
- exact closed v1 JSON shape;
- selected lisa emission: `on-notify complete`;
- producer: project-owned `.lisa/hooks/on-notify` plus Vend seam recorder;
- consumer: `vend settle` in the dependent ticket;
- atomic producer lifecycle;
- latest-pending replacement behavior;
- consume only after successful settle;
- second-settle no-pending behavior;
- malformed-marker refusal and preservation for diagnosis;
- one-way authority into Vend-owned state only;
- version evolution and explicit exclusions.

The document records why `.lisa/completion-journal.jsonl` was not selected: it is per-ticket
reconciliation, lacks the whole-loop boundary, and lacks project/count/duration provenance.

### Canonical fixture

Created `src/seam/fixtures/lisa-loop-settled.valid.json`.

Its exact object is:

```json
{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":2,"durationSecs":41}
```

The fixture is portable, compact, newline-terminated, and serialized in the production field order.

### Pure schema boundary

Created `src/seam/lisa-loop-settled-core.ts`.

The module:

- exports the v1 constants and default marker path;
- defines readonly marker and result unions;
- strictly builds Vend-authored markers;
- revives external `unknown` values through a closed schema;
- parses malformed JSON without throwing downstream;
- classifies lisa complete-event strings before effects;
- derives a project basename from an absolute project root;
- accepts honest zero quantities;
- rejects missing, negative, fractional, non-canonical, and unsafe quantities;
- rejects wrong version/kind and extra keys;
- serializes deterministically.

The module has no filesystem, process, clock, random, or network effect. `node:path` is used only for
deterministic absolute-path/basename validation.

### Vend-owned recorder

Created `src/seam/lisa-loop-settled.ts`.

The shell:

- performs pure classification before touching disk;
- creates no path for ignored/refused events;
- joins only the validated project root and `.vend/loop-settled.json`;
- writes complete bytes to a unique sibling temporary file;
- uses rename to atomically publish the stable marker;
- removes unpublished temp files;
- replaces an older pending singleton with the latest complete event;
- exposes an `import.meta.main` adapter over the documented lisa environment.

No arbitrary marker destination is accepted, making the Vend-only authority boundary structural.

### Existing lisa hook

Modified `.lisa/hooks/on-notify`.

- `complete` invokes the seam recorder before optional ntfy topic resolution.
- Marker delivery therefore works with no ntfy topic configured.
- Recorder failures remain contained and cannot block the lisa loop.
- Attention behavior is unchanged.
- Complete notification title, body, priority, and tags are unchanged.
- The hook remains executable and POSIX-shell syntax-valid.

This is not new lisa machinery: `lisa hooks-guide` explicitly defines `on-notify` as user-owned and
already invokes it on the whole-loop complete event.

## Acceptance evaluation

### “Contract doc lands in docs/knowledge/”

Pass.

The committed knowledge document is the durable seam agreement.

### “Naming the marker's home, shape, producer, consumer, and consume-on-settle lifecycle”

Pass.

All five are explicit, including the rule that malformed evidence is not consumed and a successful
settle removes the singleton so a second settle cannot repeat it.

### “Chosen from lisa's existing emissions ... no new lisa machinery”

Pass.

The producer uses the documented `on-notify complete` variables. No plugin, scheduler, signal,
journal, event, or lisa binary behavior changed.

### “Vend-side schema check validates a fixture marker”

Pass.

The canonical committed JSON file is read by the pure test, validates to the expected frozen marker,
and reserializes byte-for-byte.

### “Refuses a malformed one”

Pass.

Tests cover invalid JSON, non-objects, wrong/missing version/kind, empty project, wrong/negative/
fractional/unsafe quantities, and an extra field. Invalid JSON returns `invalid-json`; structurally
invalid JSON returns `schema-mismatch`; neither enters the valid branch.

### “bun test green”

Pass.

The full `bun run check` gate is green, including all tests.

### “Crossing respects one-way authority (vend-owned paths only)”

Pass.

The recorder writes the stable and temporary files only below `.vend/`. The direct effect test starts
with an empty project root and proves the only created root entry is `.vend`, with no `.lisa` path.
Malformed/non-complete events leave the root empty.

## Test coverage

### Focused result

```text
bun test src/seam/lisa-loop-settled-core.test.ts src/seam/lisa-loop-settled.test.ts
```

- 32 passed.
- 0 failed.
- 57 expectations.
- 2 test files.

### Focused behaviors

- Canonical fixture validity and byte stability.
- Strict builder validation.
- Closed-schema malformed refusal matrix.
- Whole-loop event classification.
- Project-basename derivation.
- Honest zero values.
- Exact `.vend` materialization.
- No `.lisa` write.
- Invalid/non-complete no-write branches.
- Atomic singleton replacement and no temp residue.
- Real project-owned hook invocation with no ntfy topic.

### Full gate result

```text
bun run check
```

- BAML generation passed.
- TypeScript passed.
- 1,872 tests passed.
- 1 intentional skip.
- 0 failed.
- 6,028 expectations across 123 test files.

The skipped real-dist release acceptance test is pre-existing and self-identifies that no `dist/`
artifacts are present. It is unrelated to this seam.

Additional checks:

- `sh -n .lisa/hooks/on-notify` passed.
- ticket-owned trailing-whitespace scan was empty.
- tracked diff check passed.

## Architecture review

The pure-core / impure-shell rule holds.

- Schema, field policy, event classification, and serialization are pure.
- Environment and filesystem access are isolated in the recorder.
- The hook delegates rather than duplicating JSON policy in shell.
- Future settle code can import the pure core without depending on producer effects.
- The seam directory stays disjoint from concurrent `src/settle/` work as the story DAG intended.

The one-way boundary holds at runtime.

- Lisa owns the complete event.
- The user-owned hook observes it.
- Vend owns the received `.vend` marker.
- Vend does not mutate lisa signals, journals, configuration, or board frontmatter.

## Commit review

Committed through the required transaction:

```text
57261b4b684c96394357dd4bd732572dd0e32003
feat(seam): record lisa loop settlement
```

The commit contains exactly seven planned paths. All seven are clean afterward. Ordinary `git add`
and ordinary `git commit` were not used.

Concurrent Lisa-managed changes remain outside the commit:

- `.lisa/provenance.jsonl`;
- active ticket frontmatter;
- Lisa-published `docs/active/work/T-079-03-01/`.

## Open concerns and honest boundary

No blocking concern remains for this ticket.

Deliberately deferred to `T-079-03-02`:

- importing the marker into `vend settle`;
- provenance-line rendering;
- malformed-marker CLI andon wording;
- consume-after-success behavior;
- event-triggering settle exactly once.

The current hook calls the project-local seam source, which is correct for this repository-owned lisa
loop and avoids adding a public producer verb. Packaging a producer command for arbitrary external
projects was not required by this slice and would overlap the later CLI surface.

The singleton intentionally retains only the latest unconsumed loop completion. Multiple historical
loop completions are not queued; that replacement policy is explicit in the agreement.

The story's honest boundary remains: tests simulate the existing hook contract with fixtures and a
real hook process, but a naturally completed live lisa loop producing the marker is an operational
observation rather than an automated test in this story.

## Final assessment

The marker agreement is explicit, executable, fixture-pinned, one-way, and committed. The dependent
settle ticket can consume one stable typed seam without re-deriving lisa lifecycle semantics. Pass.
