# Lisa → Vend loop-settled contract

This document is the durable agreement for carrying lisa's existing whole-loop completion fact into
Vend-owned state. It defines the marker that `vend settle` consumes; it does not add a lisa event,
reinterpret per-ticket completion records, or make notification transport part of correctness.

## Selected lisa emission

The producer consumes lisa's existing user-owned notify-hook contract:

```text
on-notify complete
```

Lisa supplies these documented environment values on that event:

- `LISA_EVENT=complete`;
- `LISA_PROJECT`: absolute project root;
- `LISA_TICKETS_DONE`: whole-loop completed ticket count;
- `LISA_DURATION_SECS`: whole-loop wall-clock duration in seconds.

The project-owned `.lisa/hooks/on-notify` is the producer entry. It invokes Vend's seam recorder
before the hook resolves its optional ntfy topic. Marker delivery is therefore local and does not
depend on a topic, network access, curl, or a successful push notification. Recorder failure is
contained by the hook and cannot block lisa's loop.

`.lisa/completion-journal.jsonl` is not the selected source. Its rows reconcile individual ticket
completion transactions (`requested`, `command-in-flight`, `confirmed`); they do not identify the
whole-loop completion boundary and do not carry the loop project/count/duration tuple. Inferring a
loop from those rows would introduce new scheduler knowledge instead of consuming an agreed event.

## Marker home and exact v1 shape

The pending marker lives at this project-relative path:

```text
.vend/loop-settled.json
```

Canonical v1 fixture:

```json
{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":2,"durationSecs":41}
```

The JSON object is closed and has exactly five fields:

| Field | v1 constraint | Source |
|---|---|---|
| `v` | literal number `1` | Vend schema identity |
| `kind` | literal string `lisa-loop-settled` | Vend schema identity |
| `project` | non-empty basename of `LISA_PROJECT` | lisa complete event |
| `ticketsDone` | non-negative safe integer | `LISA_TICKETS_DONE` |
| `durationSecs` | non-negative safe integer | `LISA_DURATION_SECS` |

Quantities are JSON numbers even though the hook receives environment strings. Missing, negative,
fractional, non-decimal, leading-zero, or unsafe-integer values are not admitted. The project stores
only the basename: the marker is already rooted in that project, and the absolute local path is not
part of the provenance line.

The shape contains no completion timestamp because lisa's existing event does not supply one. The
recorder does not mint a new clock fact that could be mistaken for lisa provenance.

## Producer lifecycle

1. Lisa finishes the whole loop and invokes the existing `on-notify complete` event.
2. `.lisa/hooks/on-notify` invokes `src/seam/lisa-loop-settled.ts` with the documented environment.
3. The pure seam core classifies and validates every field before any filesystem effect.
4. A non-complete event is ignored; malformed complete facts are refused and create no marker.
5. The recorder creates the Vend-owned `.vend/` directory when needed.
6. It writes the complete serialized marker to a unique sibling temporary file.
7. It atomically renames that file onto `.vend/loop-settled.json`.
8. The hook continues its pre-existing optional ntfy behavior unchanged.

A new complete event replaces an older pending singleton atomically. The marker represents the
latest unconsumed loop completion for the project, not an append-only history. Incomplete temporary
bytes are never published at the stable marker name.

## Consumer and consume-on-settle lifecycle

`vend settle` is the consumer. Its marker reader must use the v1 schema check in
`src/seam/lisa-loop-settled-core.ts`; it must not treat raw `JSON.parse` success as validity.

On a valid pending marker, settle may print the provenance line using `project`, `ticketsDone`, and
`durationSecs`. The marker is consumed only when that settle operation successfully reaches its
terminal verdict. Consumption removes the one stable Vend-owned marker. An immediate second settle
therefore reports no pending loop and cannot print the provenance again.

Malformed marker bytes are an andon, not “no pending loop” and not partial provenance. Settle must
refuse the malformed marker visibly and leave it in place for diagnosis; it must not print invented
defaults or consume evidence it could not validate. The dependent settle ticket owns the exact CLI
wording and atomic consume implementation.

## One-way authority

All state written by this crossing is Vend-owned:

- stable marker: `.vend/loop-settled.json`;
- transient producer file: a sibling below `.vend/`.

Vend writes no `.lisa/` file, signal, journal row, hook configuration, ticket frontmatter, or shared
work artifact while recording or consuming the marker. Lisa owns emission; the user-owned notify
hook calls across the seam; Vend owns the received state. Reading lisa's documented environment is
one-way observation, not reverse mutation.

## Version evolution

Any field addition, removal, rename, semantic change, or relaxation of the closed key set requires a
new numeric `v`. A v1 consumer refuses unknown versions. Producers and consumers must update this
document and the committed canonical fixture together before emitting a new version.

The executable contract is pinned by:

- `src/seam/fixtures/lisa-loop-settled.valid.json`;
- `src/seam/lisa-loop-settled-core.test.ts` for valid and malformed schema cases;
- `src/seam/lisa-loop-settled.test.ts` for the Vend-only filesystem crossing and real hook path.

## Explicit exclusions

- No new lisa plugin, scheduler, signal, notification event, or journal format.
- No completion-journal aggregation.
- No change to ntfy title, body, priority, tags, or topic handling.
- No public producer command or configuration gesture.
- No watcher, daemon, or babysitting dashboard.
- No automatic signal promotion or next pull.
- No settle rendering or marker consumption in this contract slice.
