# Structure — T-079-03-01

## Change inventory

Seven ticket-owned repository files form the seam contract unit.

Created:

1. `docs/knowledge/lisa-loop-settled-contract.md`
2. `src/seam/lisa-loop-settled-core.ts`
3. `src/seam/lisa-loop-settled-core.test.ts`
4. `src/seam/lisa-loop-settled.ts`
5. `src/seam/lisa-loop-settled.test.ts`
6. `src/seam/fixtures/lisa-loop-settled.valid.json`

Modified:

7. `.lisa/hooks/on-notify`

No file is deleted.

Attempt-only RDSPI artifacts remain under:

- `.lisa/attempts/T-079-03-01/1/work/research.md`
- `.lisa/attempts/T-079-03-01/1/work/design.md`
- `.lisa/attempts/T-079-03-01/1/work/structure.md`
- `.lisa/attempts/T-079-03-01/1/work/plan.md`
- `.lisa/attempts/T-079-03-01/1/work/progress.md`
- `.lisa/attempts/T-079-03-01/1/work/review.md`
- `.lisa/attempts/T-079-03-01/1/work/review-disposition.json`

Lisa owns publication of those artifacts. They are not direct shared-work-path edits.

## `docs/knowledge/lisa-loop-settled-contract.md`

### Responsibility

Durable agreement artifact for both sides of the seam.

### Required sections

1. Purpose and scope.
2. Selected existing lisa emission.
3. Rejected completion-journal source and factual reason.
4. Marker home.
5. Exact JSON shape.
6. Field-by-field constraints.
7. Producer identity.
8. Consumer identity.
9. Production lifecycle.
10. Atomic replacement behavior.
11. Consume-on-settle lifecycle.
12. Malformed-marker behavior.
13. One-way-authority statement.
14. Versioning rule.
15. Explicit exclusions.

### Public contract

The document pins:

```text
.vend/loop-settled.json
```

and:

```json
{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":2,"durationSecs":41}
```

It names `.lisa/hooks/on-notify` as the project-owned producer and `vend settle` as the consumer.

## `src/seam/lisa-loop-settled-core.ts`

### Responsibility

Pure and total validation/serialization boundary over plain values.

### Exports

Constants:

- `LISA_LOOP_SETTLED_SCHEMA_VERSION = 1`
- `LISA_LOOP_SETTLED_KIND = "lisa-loop-settled"`
- `DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH = ".vend/loop-settled.json"`

Types:

- `LisaLoopSettledMarker`
- `LisaLoopSettledMarkerInput`
- `LisaCompleteEventInput`
- `ParseLisaLoopSettledMarkerResult`
- `ClassifyLisaCompleteEventResult`

Functions:

- `buildLisaLoopSettledMarker(input)`
- `reviveLisaLoopSettledMarker(value)`
- `parseLisaLoopSettledMarker(text)`
- `classifyLisaCompleteEvent(input)`
- `serializeLisaLoopSettledMarker(marker)`

### Marker interface

```ts
interface LisaLoopSettledMarker {
  readonly v: 1;
  readonly kind: "lisa-loop-settled";
  readonly project: string;
  readonly ticketsDone: number;
  readonly durationSecs: number;
}
```

### Parse result

```ts
type ParseLisaLoopSettledMarkerResult =
  | { readonly kind: "valid"; readonly marker: LisaLoopSettledMarker }
  | { readonly kind: "malformed"; readonly reason: string };
```

The malformed branch covers both invalid JSON and schema refusal. No external malformed bytes throw.

### Complete-event classification

```ts
type ClassifyLisaCompleteEventResult =
  | { readonly kind: "complete"; readonly marker: LisaLoopSettledMarker }
  | { readonly kind: "ignored"; readonly reason: string }
  | { readonly kind: "refused"; readonly reason: string };
```

- Non-complete events are ignored.
- A complete event with missing/malformed required facts is refused.
- A valid complete event produces a marker.

### Internal organization

1. Schema constants and types.
2. Object/string/integer predicates.
3. Exact-key-set predicate.
4. Strict builder.
5. Unknown-value revival.
6. JSON text parser.
7. lisa environment classifier.
8. serializer.

### Purity boundary

This module imports no filesystem, process, clock, network, or random API. `node:path` basename may
be used as a deterministic value transformation, or project-name derivation may remain a local pure
helper.

## `src/seam/lisa-loop-settled.ts`

### Responsibility

Thin filesystem/process shell that materializes a validated complete event into Vend runtime state.

### Exports

Types:

- `RecordLisaLoopSettledResult`

Function:

- `recordLisaLoopSettled(input)`

### Record result

```ts
type RecordLisaLoopSettledResult =
  | {
      readonly kind: "recorded";
      readonly path: ".vend/loop-settled.json";
      readonly marker: LisaLoopSettledMarker;
    }
  | { readonly kind: "ignored"; readonly reason: string }
  | { readonly kind: "refused"; readonly reason: string };
```

### Effect ordering

1. Call `classifyLisaCompleteEvent` before touching disk.
2. Return ignored/refused data immediately for non-valid input.
3. Join only the supplied project root and exported Vend-owned relative path.
4. Create the `.vend` parent.
5. Serialize the already validated marker.
6. Write a unique sibling temporary file exclusively.
7. Rename it over the stable marker.
8. Remove a leftover temporary file in `finally` if rename did not complete.
9. Return the recorded outcome.

### Executable entry

When `import.meta.main` is true:

- read `LISA_EVENT`, `LISA_PROJECT`, `LISA_TICKETS_DONE`, and `LISA_DURATION_SECS`;
- call `recordLisaLoopSettled`;
- remain silent on success/ignored input;
- render a concise stderr refusal and set a non-zero exit code for malformed complete input;
- allow genuine filesystem faults to reject.

The enclosing hook contains the exit so lisa is never blocked by recorder failure.

## `src/seam/fixtures/lisa-loop-settled.valid.json`

### Responsibility

Committed canonical valid fixture used by the schema test and available to the dependent settle
ticket.

### Contents

One JSON object plus final newline, with deterministic field order:

1. `v`
2. `kind`
3. `project`
4. `ticketsDone`
5. `durationSecs`

The fixture uses portable values and no absolute local path.

## `src/seam/lisa-loop-settled-core.test.ts`

### Responsibility

Pin the pure machine-readable contract.

### Test groups

1. Valid fixture:
   - read the committed fixture;
   - parse as valid;
   - deep-equal the exact marker;
   - serialize byte-identically.
2. Strict builder:
   - construct the valid value;
   - reject empty project;
   - reject negative, fractional, unsafe quantities.
3. Revival/parser refusal matrix:
   - malformed JSON;
   - non-object/array;
   - wrong/missing version;
   - wrong/missing kind;
   - empty project;
   - wrong quantity types;
   - negative/fractional/unsafe quantities;
   - extra key.
4. lisa event classification:
   - valid complete strings produce the canonical marker;
   - attention is ignored;
   - missing/malformed complete facts are refused;
   - project basename is used rather than the absolute path.

## `src/seam/lisa-loop-settled.test.ts`

### Responsibility

Prove the real filesystem crossing and one-way authority.

### Test groups

1. Valid recording:
   - create a temporary project root;
   - record a valid complete event;
   - assert the returned relative path;
   - read exactly `.vend/loop-settled.json`;
   - validate bytes through the pure parser;
   - assert the root contains `.vend` and no `.lisa` directory.
2. Refusal/ignore:
   - malformed complete values produce no root changes;
   - attention produces no root changes.
3. Replacement:
   - record twice with different counts/durations;
   - assert one stable marker contains the second complete event;
   - assert no temporary sibling remains.
4. Hook integration:
   - create a temp project and fake `curl` command;
   - execute the real `.lisa/hooks/on-notify complete` with valid lisa env;
   - assert the same marker exists and validates;
   - prove marker recording occurs independently of real network transport.

Every temporary directory is removed in `finally`.

## `.lisa/hooks/on-notify`

### Existing responsibility retained

- Send attention and complete notifications to the configured ntfy topic.
- Stay silent when no topic is configured.
- Never block lisa because curl fails.

### Added responsibility

On `complete` only, invoke the Vend seam recorder before resolving or early-exiting on the optional
ntfy topic.

### Structural ordering

1. Resolve `HOOK_DIR`.
2. If `$1` is `complete`, invoke the Bun recorder with `LISA_EVENT=complete`.
3. Contain recorder errors.
4. Resolve the optional ntfy topic.
5. Preserve the existing ntfy dispatch body.

The hook writes no marker itself and carries no duplicate JSON schema logic.

## Dependency direction

```text
.lisa/hooks/on-notify
        |
        v
src/seam/lisa-loop-settled.ts       (process + filesystem shell)
        |
        v
src/seam/lisa-loop-settled-core.ts  (pure contract)
        ^
        |
future src/settle/* reader           (T-079-03-02)
```

The knowledge document describes the same shape. Tests pin both the document's fixture bytes and the
runtime boundary.

## Unchanged surfaces

- `src/cli.ts`
- all future/current `src/settle/*`
- `.lisa/completion-journal.jsonl`
- `.lisa/hooks/on-notify.sample`
- lisa signal hooks
- ticket/story/epic frontmatter
- ntfy title, body, priority, and tags
- root `.gitignore`
