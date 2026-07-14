# Review — T-080-01-02 recorder refusal leaves trace

## Disposition

Pass. The ticket acceptance is met, the full repository gate is green, the exact ticket-owned
source unit is committed, and no ticket-owned source path remains dirty.

## Outcome

The Lisa-to-Vend recorder no longer loses ordinary refusal or marker-write failure evidence behind
the hook's intentional stderr/status containment. It appends one local JSONL record beneath
`.vend/`, containing a canonical timestamp and exact reason. Expected failure paths resolve as
typed recorder outcomes rather than rejecting. The standalone recorder still exits nonzero for
those outcomes so the unchanged hook does not run settle without a marker; the hook remains the
outer boundary that never blocks Lisa.

Ignored events and successful marker publications do not append failure evidence. Marker success
retains the pre-existing unique-temporary-write plus atomic-rename behavior.

## Source commit

- Full hash: `15cb09bbb1a877fc73157cc7782f120902a98126`.
- Short hash: `15cb09b`.
- Subject: `feat(seam): trace Lisa recorder failures`.
- Created through `lisa commit-ticket --ticket-id T-080-01-02`.
- Used exact repeated repository-relative `--include` paths only.
- No ordinary `git add`, `git add -A`, or `git commit` was used.
- Commit summary: 5 files changed, 319 insertions, 24 deletions.

Exact file list:

- `docs/knowledge/lisa-loop-settled-contract.md`;
- `src/seam/lisa-loop-settled-core.test.ts`;
- `src/seam/lisa-loop-settled-core.ts`;
- `src/seam/lisa-loop-settled.test.ts`;
- `src/seam/lisa-loop-settled.ts`.

## File review

### `src/seam/lisa-loop-settled-core.ts`

Added the exported local trace path:

```text
.vend/lisa-loop-settled-failures.jsonl
```

Added `LisaLoopSettledFailure` with readonly `timestamp` and `reason` fields. Added a deterministic
serializer which:

- accepts only canonical `Date#toISOString()` timestamp text;
- accepts only nonblank reason strings;
- preserves the original admitted reason rather than trimming it;
- emits keys in `timestamp`, `reason` order;
- uses JSON escaping so embedded controls remain inside one physical record;
- terminates each record with one newline.

Invalid typed calls throw `TypeError`, consistent with the existing marker builder's programmer
boundary. Date parsing in this pure module is deterministic over the supplied string; current time
is not read here.

The marker schema, optional duration shape, marker parser, and Lisa classifier remain unchanged.
Existing classifier reason text is therefore the same text stored in the new trace.

### `src/seam/lisa-loop-settled.ts`

Added a thin failure append effect using `mkdir` plus one `appendFile` call per trace record.

Added test-only/effect-boundary options:

- `root`: trusted working-root fallback, production default `process.cwd()`;
- `now`: failure-only clock, production default `new Date()`.

Root selection is deliberately split from full classification:

- an absolute `LISA_PROJECT` owns the trace even when another field is refused;
- a missing/relative project value is not used as a filesystem target;
- those project-path refusals fall back to the trusted project working root;
- a marker write failure always uses the validated absolute project root.

Recorder result behavior is now:

| Input/effect outcome | Result | Marker | Failure trace |
|---|---|---|---|
| non-complete event | `ignored` | none | none |
| malformed complete event | `refused` | none | one appended record |
| successful publication | `recorded` | atomically published | none |
| marker publication error | `failed` | none | one appended record |

Marker-write cleanup is best-effort and cannot replace the primary write reason. The failure reason
is `marker write failed: <underlying error message>`, making its category explicit for the later
cord line.

Trace append failure is also contained as optional `traceError` result data. The normal main path
prints refusal/failure diagnostics and sets exit status 1. This is intentional: “does not throw” is
not the same as “marker recording succeeded.” The unchanged hook sees the unsuccessful recorder,
skips settle, contains the status, continues optional notification behavior, and exits zero to Lisa.

### `src/seam/lisa-loop-settled-core.test.ts`

Added five producer-contract cases (including table rows) which prove:

- exact canonical JSONL bytes;
- timestamp and reason recover as exact fields;
- an embedded newline/tab does not create another physical record;
- parsing recovers embedded reason controls verbatim;
- invalid timestamp text is rejected;
- parseable but noncanonical timestamp text is rejected;
- a blank reason is rejected.

All existing marker-schema and classifier tests remain green.

### `src/seam/lisa-loop-settled.test.ts`

Extended success coverage to assert the failure log is absent.

Split ignored behavior from refused behavior so the semantic difference is explicit: attention
creates no state, while a malformed complete event creates trace state but no marker.

Added the ticket's two named refusal cases:

1. relative `LISA_PROJECT` uses the injected working root and writes the project refusal;
2. nonnumeric `LISA_TICKETS_DONE` uses its valid absolute project root and writes the ticket-count
   refusal.

The test reads the log after the first call and sees exactly one record, then reads after the second
and sees exactly two records in append order. Fixed clock injection pins both timestamps and exact
reason values. Both awaited calls resolve to `refused` rather than rejecting.

Added a forced marker-publication failure by precreating `.vend/loop-settled.json` as a directory.
The temporary file write succeeds, atomic rename fails, and the recorder:

- resolves to `failed`;
- returns a reason beginning `marker write failed:`;
- appends exactly one record with the same reason and fixed timestamp;
- removes the unique temporary sibling.

Added a standalone subprocess test for the acceptance wording “exits without throwing.” It invokes
the actual TypeScript entrypoint with a relative project, confirms deliberate exit status 1,
confirms the exact single-line stderr diagnostic rather than an uncaught stack, confirms exactly one
trace record in the working root, and confirms no marker.

Added an executable Git ignore test. It runs `git check-ignore` with the exported repository-relative
path and requires exit zero plus exact echoed path.

Existing atomic marker replacement and real-hook success/settle/consume cases remain green.

### `docs/knowledge/lisa-loop-settled-contract.md`

Recorded the exact runtime path and two-field JSONL example. Documented:

- refusal and marker-publication append cases;
- ignore/success no-append cases;
- canonical timestamp and reason semantics;
- absolute-project versus working-root placement;
- typed recorder outcome versus process exit/hook containment;
- append-only, local, gitignored Vend ownership;
- T-080-01-03 as the trace reader/freshness/renderer owner;
- the no-retry/no-delivery-guarantee boundary.

No marker fixture change was needed because marker v1 did not change.

## Acceptance review

### Relative `LISA_PROJECT`

Pass. The effect test supplies `projectRoot: "vend"`, injects a temporary trusted root, awaits a
`refused` outcome, and checks one exact timestamp/reason record at the exported trace path.

### Nonnumeric `LISA_TICKETS_DONE`

Pass. The same test supplies `ticketsDone: "three"` with a valid absolute project and checks that
exactly one additional record carries the canonical ticket-count refusal.

### Forced marker-write failure

Pass. A directory at the stable marker name forces rename failure without making the sibling trace
unwritable. The recorder resolves as `failed`, appends exactly one matching timestamp/reason record,
and leaves no `.tmp` file.

### Recorded success appends nothing

Pass. The normal marker-publication test asserts the failure-log path does not exist after a
recorded outcome. The hook success case also remains green.

### Recorder exits without throwing

Pass. Function-level refusal and write-failure calls resolve to typed data. The standalone process
test confirms a refusal becomes intentional exit status 1 and a clean diagnostic, not an uncaught
throw. Hook containment remains unchanged and therefore Lisa is not blocked.

### Git ignore

Pass. Both automated coverage and manual final verification ran:

```text
git check-ignore .vend/lisa-loop-settled-failures.jsonl
```

Git returned zero and echoed the same path. `.gitignore` required no change because `.vend/*`
already covers it.

### Full gate

Pass. `bun run check` completed:

- BAML client generation: passed;
- TypeScript `tsc --noEmit`: passed;
- tests: 1,933 passed, 1 skipped, 0 failed;
- expectations: 6,324;
- scope: 1,934 tests across 126 files;
- elapsed test time: 16.52 seconds.

Focused seam verification separately completed 45 passed, 0 failed, and 107 expectations.
`git diff --check` was clean for all five ticket-owned paths.

## Architecture review

- Pure core / impure shell is preserved.
- Event classification and trace serialization are deterministic pure functions.
- Current-time acquisition and filesystem append remain in the effect shell.
- Marker success keeps atomic singleton semantics.
- Failure history uses one-call append semantics and never masquerades as marker data.
- No Lisa-owned path is written.
- No hook edit or new runtime gesture was introduced.
- No settle consumer work was pulled forward from T-080-01-03.
- The result union distinguishes bad event facts from filesystem publication failure.

## Scope review

Changed only the seam core/effect, adjacent tests, and their existing durable contract. Deliberately
unchanged:

- `.lisa/hooks/on-notify`;
- `.gitignore`;
- `src/seam/fixtures/lisa-loop-settled.valid.json`;
- all `src/settle/*` source/tests;
- ntfy behavior;
- retry/queue/replay semantics;
- ticket phase/status frontmatter.

T-080-01-03 still owns parsing external log lines, comparing failure freshness to a successful
claim, carrying cord state through the settle verdict, and rendering the visible warning.

## Open concerns and honest limitations

- A process that never boots or a hook that never spawns it still cannot leave a trace. This is the
  parent story's stated honest boundary.
- If the filesystem rejects both marker and trace writes, no implementation can durably append the
  reason. The recorder contains that diagnostic as result/stderr data, but the unchanged hook
  discards stderr. This ticket guarantees ordinary write-failure visibility where the sibling trace
  remains writable; it does not claim delivery guarantees.
- The log is intentionally append-only with no rotation. Rotation/capping is outside the slice and
  premature for a low-volume completion seam.
- Marker-write error reasons currently include the platform's `Error.message`, which may contain
  absolute temporary paths. T-080-01-03 is required to render the logged reason verbatim, so this
  can be verbose. It remains materially diagnostic and no acceptance criterion asks for redaction.
- Concurrent appends use one `appendFile` call per complete serialized record. This is the practical
  local-file boundary; no cross-process queue/locking guarantee is claimed.

None of these limitations block the ticket acceptance.

## Worktree review

All five ticket-owned paths are clean after commit. Remaining modified/untracked entries belong to
Lisa's phase/provenance/artifact publication and the concurrent T-080-02-02 attempt. They were not
included in the source commit.

## Final assessment

The cord's recorder failure modes now leave structured, durable, local evidence without weakening
the hook's autonomy boundary. The producer contract is sufficiently explicit and tested for the
dependent settle surfacing ticket to consume safely. Ready for Lisa completion publication.
