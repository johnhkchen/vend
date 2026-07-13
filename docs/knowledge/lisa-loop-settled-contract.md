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
- `LISA_DURATION_SECS`: whole-loop wall-clock duration in seconds, when tracked.

The project-owned `.lisa/hooks/on-notify` is the producer entry. It invokes Vend's seam recorder
before the hook resolves its optional ntfy topic. Marker delivery is therefore local and does not
depend on a topic, network access, curl, or a successful push notification. Recorder failure is
reported to the hook as an unsuccessful recorder process, so settle does not run without a marker;
the hook contains that status and cannot block lisa's loop.

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
{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":2}
```

The JSON object is closed and has exactly four required fields plus one optional measurement:

| Field | v1 constraint | Source |
|---|---|---|
| `v` | literal number `1` | Vend schema identity |
| `kind` | literal string `lisa-loop-settled` | Vend schema identity |
| `project` | non-empty basename of `LISA_PROJECT` | lisa complete event |
| `ticketsDone` | non-negative safe integer | `LISA_TICKETS_DONE` |
| `durationSecs` | optional non-negative safe integer | `LISA_DURATION_SECS`, when tracked |

Quantities are JSON numbers even though the hook receives environment strings. `ticketsDone` is
required. An absent duration is admitted by omitting `durationSecs`; a present duration that is
empty, negative, fractional, non-decimal, leading-zero, or unsafe is not admitted. The project
stores only the basename: the marker is already rooted in that project, and the absolute local path
is not part of the provenance line. No other optional or additional key is admitted.

The shape contains no completion timestamp because lisa's existing event does not supply one. The
recorder does not mint a new clock fact that could be mistaken for lisa provenance.

## Producer lifecycle

1. Lisa finishes the whole loop and invokes the existing `on-notify complete` event.
2. `.lisa/hooks/on-notify` invokes `src/seam/lisa-loop-settled.ts` with the documented environment.
3. The pure seam core classifies and validates every field before any filesystem effect.
4. A non-complete event is ignored and creates no state.
5. A malformed complete fact is refused, creates no marker, and appends one failure-trace record.
6. The recorder creates the Vend-owned `.vend/` directory when needed.
7. It writes the complete serialized marker to a unique sibling temporary file.
8. It atomically renames that file onto `.vend/loop-settled.json`.
9. A marker publication failure removes the temporary sibling best-effort and appends one
   failure-trace record.
10. An ignored or successfully recorded event appends no failure-trace record.
11. The hook continues its pre-existing optional ntfy behavior unchanged.

A new complete event replaces an older pending singleton atomically. The marker represents the
latest unconsumed loop completion for the project, not an append-only history. Incomplete temporary
bytes are never published at the stable marker name.

## Local failure trace

Recorder refusals and marker publication failures append to this project-relative path:

```text
.vend/lisa-loop-settled-failures.jsonl
```

Each failure is exactly one JSON Lines record with two fields in this order:

```json
{"timestamp":"2026-07-13T20:00:00.000Z","reason":"LISA_PROJECT must be an absolute project root"}
```

`timestamp` is a canonical ISO-8601 UTC timestamp minted by Vend when the recorder observes the
failure. `reason` preserves the pure classifier's exact refusal text, or carries `marker write
failed: <detail>` for a filesystem publication error. JSON escaping keeps embedded control
characters inside one physical record while allowing a later reader to recover the reason
verbatim.

If the supplied `LISA_PROJECT` is absolute, the recorder places the trace beneath that root even
when another event field is refused. When the supplied project itself is missing or relative, it is
not trusted as a filesystem destination; the recorder falls back to the project working root
(`process.cwd()` in production). Marker publication failures already have a classified absolute
project root and always use it.

The file is append-only local runtime evidence and is covered by the repository's `.vend/*` ignore
rule. A refusal or ordinary marker publication failure resolves from the recorder as typed failure
data after one append attempt rather than throwing. The standalone recorder process still exits
unsuccessfully for that result so the unchanged hook does not invoke settle without a marker; the
hook contains the status and Lisa continues.

This trace narrows the silent window; it is not a retry or delivery queue. A recorder process that
never starts, or a filesystem that rejects both marker and trace writes, cannot leave durable local
evidence. Settle reads this evidence without truncating, rewriting, or otherwise acknowledging it
inside the append-only log.

## Consumer and consume-on-settle lifecycle

`vend settle` is the consumer. Its marker reader must use the v1 schema check in
`src/seam/lisa-loop-settled-core.ts`; it must not treat raw `JSON.parse` success as validity.

On a valid pending marker, settle prints the provenance line using `project` and `ticketsDone`, plus
`durationSecs` when that measurement is present. It never fabricates a duration for the four-field
shape. The marker is consumed only when that settle operation successfully reaches its terminal
verdict. Consumption removes the one stable Vend-owned marker. An immediate second settle therefore
reports no pending loop and cannot print the provenance again.

Settle also reads the failure trace as advisory verdict context. It scans physical JSONL records
from newest to oldest and selects the newest record that matches the exact timestamp/reason shape.
Blank, malformed, torn, and unrelated lines are skipped: diagnostic corruption does not turn the
free board verdict into a refusal. If no exact record exists, no cord line is rendered.

Freshness follows the local files that publish and acknowledge the crossing. The failure-log mtime
is compared with the newest available claim watermark: the prior successful
`.vend/last-settle.json` verdict write and the currently claimed loop marker's mtime. A trace whose
mtime is strictly newer carries this normal verdict line, with JSON-decoded reason text preserved
verbatim:

```text
cord: last recording failed — <reason>
```

An equal/newer successful claim suppresses the line. A verdict which surfaces a fresh failure then
writes `.vend/last-settle.json` as usual, acknowledging the observed local state, so an immediate
repeat does not print the same warning again. A current marker older than the trace does not hide
the newer failure. The cord line is neither a refusal nor an exception and does not block settle's
gate, presweep, review, continuation write, or marker lifecycle.

Malformed marker bytes are an andon, not “no pending loop” and not partial provenance. Settle must
refuse the malformed marker visibly and leave it in place for diagnosis; it must not print invented
defaults or consume evidence it could not validate. Marker corruption remains distinct from the
non-blocking failure-trace read because the marker is provenance settle would otherwise claim,
while the trace is diagnostic context.

## One-way authority

All state written by this crossing is Vend-owned:

- stable marker: `.vend/loop-settled.json`;
- transient producer file: a sibling below `.vend/`.
- append-only failure trace: `.vend/lisa-loop-settled-failures.jsonl`.

Vend writes no `.lisa/` file, signal, journal row, hook configuration, ticket frontmatter, or shared
work artifact while recording or consuming the marker. Lisa owns emission; the user-owned notify
hook calls across the seam; Vend owns the received state. Reading lisa's documented environment is
one-way observation, not reverse mutation.

## Version evolution

The current v1 agreement admits both the canonical four-field shape and the tracked-duration
five-field shape. Any other field addition, removal, rename, semantic change, or relaxation of the
closed key set requires a new numeric `v`. A v1 consumer refuses unknown versions. Producers and
consumers must update this document and the committed canonical fixture together before emitting a
new version.

The executable contract is pinned by:

- `src/seam/fixtures/lisa-loop-settled.valid.json`;
- `src/seam/lisa-loop-settled-core.test.ts` for valid/malformed marker cases and deterministic
  failure-line serialization;
- `src/seam/lisa-loop-settled.test.ts` for the Vend-only filesystem crossing, refusal/failure
  append behavior, Git ignore contract, and real hook path;
- `src/settle/settle-core.test.ts` for tolerant trace parsing, exact reason recovery, and freshness
  policy;
- `src/settle/settle.test.ts` for the filesystem claim watermark and visible normal verdict line.

## Explicit exclusions

- No new lisa plugin, scheduler, signal, notification event, or journal format.
- No completion-journal aggregation.
- No change to ntfy title, body, priority, tags, or topic handling.
- No public producer command or configuration gesture.
- No watcher, daemon, or babysitting dashboard.
- No retry, queue, replay, rotation, or guaranteed delivery for recorder failures.
- No automatic signal promotion or next pull.
- No trace mutation, retry, or delivery action from settle; consumption remains limited to the
  successful singleton marker.
