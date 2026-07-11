# Structure — T-069-01-02

## Change inventory

### Modified production file

- `src/play/materialize.ts`

### Modified test file

- `src/play/materialize.test.ts`

### Created ticket artifacts

- `docs/active/work/T-069-01-02/research.md`
- `docs/active/work/T-069-01-02/design.md`
- `docs/active/work/T-069-01-02/structure.md`
- `docs/active/work/T-069-01-02/plan.md`
- `docs/active/work/T-069-01-02/progress.md`
- `docs/active/work/T-069-01-02/review.md`

### Deleted files

- None.

### Explicitly unchanged

- `src/play/agent-seat.ts`
- `src/play/project-context.ts`
- `src/play/decompose-epic.ts`
- `src/play/chain-propose-decompose.ts`
- `src/log/run-log.ts`
- `src/cli.ts`
- all BAML source/generated files
- story/ticket/epic frontmatter managed by Lisa

## Production module dependencies

`src/play/materialize.ts` adds one value import:

```ts
import { findUnknownSeat, KNOWN_SEATS } from './agent-seat.ts';
```

Responsibilities remain separated as follows:

- `agent-seat.ts`: pure routing vocabulary and membership oracle.
- `materialize.ts` pure section: exact file rendering.
- `materialize.ts` impure section: validation, reads, clock, mkdir, writes.
- `decompose-epic.ts`: later effect composition and outcome relabel.

No dependency cycle is introduced. `agent-seat.ts` imports nothing, and the writer already sits at a
higher composition layer.

## New public error interface

Add near `IdCollisionError` and `BareCodeError`:

```ts
export class UnknownSeatError extends Error {
  readonly seat: string;
  constructor(seat: string);
}
```

Behavioral contract:

- `name` is exactly `UnknownSeatError`.
- `seat` is exactly the rejected input.
- The message identifies the refused value.
- The message identifies the known values from `KNOWN_SEATS`.
- The class performs no filesystem work.
- The later effect can discriminate it with `instanceof`.

Placement alongside other writer errors makes the materialization module the public owner of all
expected refusal types that originate at this boundary.

## Ticket renderer interface

Change:

```ts
renderTicketFile(t: TicketDraft, snapshot: CharterSnapshot): RenderedFile
```

to:

```ts
renderTicketFile(
  t: TicketDraft,
  snapshot: CharterSnapshot,
  agent?: string,
): RenderedFile
```

Internal organization:

1. Start the frontmatter delimiter.
2. Render the existing identity and alias fields.
3. Render `priority:`.
4. Conditionally spread one `agent:` line only when `agent !== undefined`.
5. Render `phase:` and `depends_on:` unchanged.
6. Render the body unchanged.
7. Return the same `{ name, body }` shape.

No seat validation is added to this pure formatter. Its caller owns the checked/unchecked boundary.
Direct pure tests may pass a known literal to pin output.

## Materializer interface

Change:

```ts
materialize(plan, targets, charter)
```

to:

```ts
materialize(plan, targets, charter, agent?)
```

The first three parameters and return type stay unchanged. Existing call sites do not need edits.

## Materializer internal ordering

The function body is organized in this exact sequence:

1. If `agent !== undefined`, call `findUnknownSeat(agent)`.
2. If the result is non-null, throw `UnknownSeatError`.
3. Read story and ticket ids from target directories.
4. Detect and refuse id collisions.
5. Read the clock once.
6. Resolve the charter snapshot once.
7. Render stories unchanged.
8. Render tickets with the supplied optional `agent`.
9. Detect and refuse bare codes.
10. Create target directories.
11. Write story files.
12. Write ticket files.
13. Return both path lists.

The seat guard precedes all filesystem interaction. The collision and bare-code relative ordering is
unchanged. Rendering remains fully buffered before the first mutation.

## Documentation structure in production code

The top module comment will describe three write guards rather than only collision and bare code.
The `renderTicketFile` docblock will describe the optional routing line and byte-identical absence.
The `materialize` docblock will list the unknown-seat guard first, followed by collision and bare
code. It will state that the checked seat is applied uniformly to all tickets.

## Test import changes

`src/play/materialize.test.ts` adds `UnknownSeatError` to the existing named imports from
`./materialize.ts`. No new runtime BAML imports are introduced.

## Pure renderer tests

Inside `describe('renderTicketFile — member→alias + lisa frontmatter')`:

### Existing legacy golden

- Keep the existing invocation without an agent.
- Keep its expected literal unchanged.
- Add an explicit `not.toContain('\nagent:')` if useful for failure readability.
- This remains the pre-change byte bar.

### New routed golden

- Invoke `renderTicketFile(ticket(), SNAPSHOT, 'codex')`.
- Compare the entire file body with an inline exact literal.
- The expected literal includes exactly one new line.
- The line is immediately after `priority: high`.
- The following line remains `phase: ready`.
- Every other byte equals the legacy literal.

## Filesystem materialization tests

Continue using the existing temp-root helper and cleanup in the bottom materialize suite.

### Known-seat test

- Create a plan with one story and two ticket ids.
- Call `materialize(plan, targets, CHARTER, 'codex')`.
- Assert both ticket filenames exist.
- Read both bodies.
- Assert the exact three-line priority/agent/phase sequence in each.
- Count `agent: codex` occurrences and require exactly one per ticket.
- Assert the story body has no `agent:` key.

### Unknown-seat test

- Create fresh target paths without pre-creating directories.
- Call `materialize(plan, targets, CHARTER, 'gpt')`.
- Capture the thrown value.
- Assert it is `UnknownSeatError`.
- Assert `seat`, `name`, and relevant message content.
- Assert both target paths still report `ENOENT`.

This is the primary zero-files acceptance proof. Because validation precedes even `listIdsIn`, no
directory is needed to exercise it.

## Compatibility matrix

| Caller input | Validation | Ticket bytes | Story bytes | Filesystem outcome |
|---|---|---|---|---|
| omitted | skipped | legacy exact bytes | unchanged | normal |
| `codex` | clear | one ordered stamp each | unchanged | normal |
| `claude` | clear | one ordered stamp each | unchanged | normal |
| `gpt` | refused | none | none | no targets created |
| empty string | refused | none | none | no targets created |

Only `codex`, omitted, and `gpt` are required ticket goldens; the shared upstream contract already
pins both known values and empty-string behavior follows the same oracle branch as other unknowns.

## Commit structure

The implementation is one tightly coupled unit: error, renderer plumbing, write guard, and acceptance
tests. Commit it with the completed pre-implementation artifacts after focused verification. Then add
`progress.md` and `review.md`, run the full gate, and commit the final handoff artifacts if needed.

Explicit path staging prevents Lisa-owned board changes from entering either commit.

## Structural invariants

- There is one canonical seat list.
- There is one materialize-time validation call per invocation.
- There is zero validation I/O.
- There is one optional routing value per gesture.
- Every ticket receives the same value.
- Story output never receives the value.
- Omission adds zero frontmatter array elements.
- Refusal occurs before all `mkdir` and `writeFile` calls.
- Existing collision and bare-code behavior remains intact.
- The future effect relabel has a stable exported error type and payload.

## Scope boundary

The blueprint ends at `materialize`'s public function boundary. Supplying the new argument from
`DecomposeInputs`, translating the error into an outcome, logging it, exposing chain options, and
parsing CLI flags remain downstream work by explicit story DAG design.
