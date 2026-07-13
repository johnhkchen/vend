# Design — T-079-03-01

## Goal

Define one durable, machine-readable handoff from lisa's existing whole-loop completion event into
Vend-owned state, make the handoff real in the current project hook, and give the later settle ticket
a strict typed boundary it can consume without interpreting lisa internals.

The design must satisfy five properties together:

- use an existing lisa emission;
- preserve the loop provenance settle must print;
- write only below `.vend/`;
- refuse malformed markers before they enter settlement logic;
- leave consumption and public settle behavior to `T-079-03-02`.

## Decision 1 — source the marker from `on-notify complete`

### Chosen source

Use the existing lisa `on-notify complete` event.

The event already provides:

- `LISA_PROJECT`;
- `LISA_TICKETS_DONE`;
- `LISA_DURATION_SECS`;
- the whole-loop lifecycle boundary represented by `LISA_EVENT=complete` / argument `complete`.

The project already has an executable, user-owned `.lisa/hooks/on-notify`, so the crossing can be
added to the complete arm without changing lisa's plugin, scheduler, signals, or event vocabulary.

### Why this is the contract fit

- It fires at the lifecycle named by the marker: whole-loop settlement.
- It supplies every provenance field named by story acceptance.
- Lisa's own guide declares the hook user-owned and transport-independent.
- The existing ntfy behavior proves the facts are already stable enough for human notification.
- A second consumer beside ntfy is an extension of the project hook, not new lisa machinery.

### Rejected source — `.lisa/completion-journal.jsonl`

The journal is durable, but it records per-ticket completion reconciliation. A single ticket yields
requested, command-in-flight, and confirmed rows. It neither marks whole-loop completion nor carries
loop duration or a whole-loop completed-ticket count.

Using it would require Vend to infer lisa scheduling state and aggregate ticket transactions. That
would invent a new interpretation, fail the required provenance shape, and couple Vend to a deeper
lisa-owned format than the documented notification seam.

### Rejected source — a new lisa event or journal row

The story explicitly excludes new lisa machinery. No upstream change is necessary because the
documented complete event is sufficient.

## Decision 2 — use one pending marker at `.vend/loop-settled.json`

### Chosen home

```text
.vend/loop-settled.json
```

The path is relative to `LISA_PROJECT`.

### Rationale

- `.vend/` is the repository's established Vend-owned runtime namespace.
- The marker is pending local state, not a committed knowledge artifact or ledger.
- A singleton file maps directly to “one pending loop.”
- The later consume-on-settle operation can atomically remove one known path.
- A second settle naturally observes absence.
- Existing root `.gitignore` policy already ignores `.vend/*` runtime state.

### Lifecycle

1. Lisa emits `on-notify complete`.
2. The project-owned hook invokes the Vend seam recorder.
3. The recorder validates the complete-event values.
4. It writes a temporary sibling below `.vend/`.
5. It renames the temporary file onto `.vend/loop-settled.json`.
6. `vend settle` later validates and reads the marker.
7. A successful settle consumes the marker.
8. A second settle sees no pending loop.

This ticket implements steps 1–5 and the validator used by step 6. The dependent ticket implements
steps 6–8 in the settle flow.

### Replacement semantics

If a complete event arrives while a marker is still pending, the newer complete event replaces the
singleton atomically. The repository runs one lisa loop per project at a time; the marker represents
the latest unconsumed whole-loop fact, not an append-only history.

### Rejected home — `.lisa/loop-settled.json`

That would make Vend mutate lisa-owned runtime state and reverse the one-way authority boundary.

### Rejected home — `.vend/loop-settled.jsonl`

An append-only queue creates cursor, duplicate, truncation, and multi-row consumption policy that
the story does not need. The required observable is a pending marker consumed exactly once.

### Rejected home — a committed file under `docs/`

The marker is transient run state. Committing it would add branch churn, make consumption a source
mutation, and confuse runtime provenance with durable design knowledge.

## Decision 3 — define a small closed versioned schema

### Exact JSON shape

```json
{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":2,"durationSecs":41}
```

Fields:

- `v`: exactly `1`;
- `kind`: exactly `lisa-loop-settled`;
- `project`: non-empty project basename derived from `LISA_PROJECT`;
- `ticketsDone`: non-negative safe integer;
- `durationSecs`: non-negative safe integer.

The schema is closed: the key set must be exactly these five keys.

### Why these fields

- `v` creates an explicit format-evolution boundary.
- `kind` prevents an unrelated JSON object with coincidental fields from being admitted.
- `project`, `ticketsDone`, and `durationSecs` are the provenance line required by the story.
- The short project basename matches the existing notification's human-safe project identity.
- Absolute paths are unnecessary in a marker already rooted inside the project and should not be
  printed or persisted as provenance.

### Why there is no timestamp

The existing event contract does not supply a loop-completion timestamp. Minting one at hook time
would add recorder-clock provenance not required by the story and could be mistaken for a lisa fact.
The marker carries only facts available from the selected emission plus stable schema identity.

### Why counts are numeric

Environment variables arrive as strings, but the durable contract should encode quantities as JSON
numbers. The producer accepts only canonical base-10 non-negative integers and converts them. The
consumer requires non-negative safe integers. Values like `1.5`, `-1`, `1x`, empty strings, or values
beyond JavaScript's safe integer range are refusals.

### Why the schema is closed

Versioning already provides the extension mechanism. Rejecting extra keys catches producer drift and
keeps the agreement mechanically exact. A new shape must increment `v` and be handled deliberately.

## Decision 4 — split pure schema logic from the filesystem recorder

### Pure core

Create `src/seam/lisa-loop-settled-core.ts` for:

- schema constants and the marker type;
- strict construction from typed values;
- revival from `unknown`;
- JSON parsing with a typed valid/malformed result;
- conversion from lisa complete-event strings;
- deterministic serialization.

Malformed external input is returned as data, not thrown through the settle path. The parse result
names a stable refusal reason. Strict construction may throw on programmer misuse, matching existing
record-builder conventions.

### Impure shell

Create `src/seam/lisa-loop-settled.ts` for:

- reading the event environment;
- deriving the target beneath the supplied project root;
- creating `.vend/`;
- atomic temporary-write plus rename;
- cleaning a failed temporary file;
- returning `recorded`, `ignored`, or `refused` outcomes;
- an `import.meta.main` entry used only by the hook.

The shell exposes no arbitrary destination path. Tests supply a temporary project root through the
same event input, and the implementation always appends the exported `.vend/loop-settled.json`
relative path. This makes the authority boundary structural.

### Rejected split — validation directly in the shell hook

POSIX shell JSON escaping and number validation would duplicate the Vend consumer contract and make
the hook the only executable schema definition. A TypeScript core is reusable by the later settle
reader and directly testable under the project toolchain.

### Rejected split — put the module under `src/settle/`

The story's wave rationale assigns this ticket the seam crossing and keeps it disjoint from the
sibling settle-core work. `src/seam/` expresses ownership and avoids a missing dependency edge.

## Decision 5 — extend the existing hook without coupling marker delivery to ntfy

The complete-event recorder call occurs before ntfy topic resolution.

- Marker delivery works when no ntfy topic is configured.
- Attention events never invoke the recorder.
- Existing attention formatting stays byte-for-byte in behavior.
- Existing complete push content stays unchanged.
- Recorder failures are contained so a notification hook cannot block lisa's loop.
- ntfy failures remain contained as they are today.

The hook invokes the repository's Bun seam entry using its project root. This is the current Vend
project's project-owned integration point, not a new public CLI verb. `T-079-03-02` remains free to
attach settle triggering using the agreed marker without growing this ticket's public surface.

### Rejected approach — gate marker delivery on a configured ntfy topic

That would preserve the current early exit and make a machine contract depend on an optional network
transport secret. The marker is local-first and must be emitted independently.

### Rejected approach — add a hidden CLI arm now

Changing `src/cli.ts` would overlap the concurrently planned settle surface and expose an internal
producer detail as a user command. The hook can call the narrow seam entry directly.

## Decision 6 — fixture-driven contract and crossing tests

Add a committed valid fixture under `src/seam/fixtures/` carrying the exact five-field shape.

Pure tests prove:

- the fixture parses into the expected frozen marker;
- serialization is deterministic;
- wrong JSON, version, kind, key set, project, and quantities are refused;
- lisa event strings produce the same shape;
- malformed or non-complete event facts are refused/ignored.

Effect tests prove:

- a valid complete event writes exactly `.vend/loop-settled.json`;
- the written bytes pass the same pure validator;
- no `.lisa` path is created below the fixture project;
- malformed complete facts write nothing;
- attention events write nothing;
- a later valid complete event replaces the marker atomically.

The hook integration test uses a temporary project root and a fake `curl`, invokes the real executable
hook, and proves marker creation remains independent of ntfy transport while ntfy content is left
untouched.

## Scope boundaries retained

- No `vend settle` CLI arm.
- No marker consumption.
- No provenance rendering.
- No standing watcher or daemon.
- No auto-pull or promotion.
- No lisa scheduler/plugin/event change.
- No completion-journal parsing.
- No ntfy payload change.
- No write into `.lisa/` runtime state.
