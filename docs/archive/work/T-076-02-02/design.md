# T-076-02-02 Design — ledger line and artifact survive settlement throw

## Decision summary

Guard the complete post-effect settlement tail in `castPlay` with `try/catch/finally` semantics.

The catch converts the durable row's terminal outcome to `errored` while retaining all facts
observed before the failure. The finally block verifies any captured diff reference, records either
the usable reference or a structured discrepancy, and appends exactly one run row. After the append
succeeds, the original settlement exception is rethrown so unrelated defects remain visible to the
caller and existing graph-level error routing.

Publish diff artifacts with a temporary file followed by atomic rename. A failed capture write can
therefore leave neither the final `.diff` path nor a reference, while a successful capture returns a
reference to a fully published file.

## Goals

1. Every primary dispense that reaches post-effect settlement leaves its usage and cost on the
   ledger even when the settlement tail throws.
2. A non-reviewer settlement failure is durably distinguishable from success, gate refusal, and
   reviewer unavailability.
3. A ledger row never advertises `capturedDiff` when that path is unavailable at final append.
4. An unavailable expected diff remains auditable through a structured row marker.
5. A failed diff write cannot publish the final artifact name before capture succeeds.
6. Existing successful and named-reviewer settlement behavior remains unchanged.
7. Unrelated programming and I/O defects continue to reject `castPlay` after the ledger line lands.

## Non-goals

- Do not retry settlement or review.
- Do not convert every pre-effect failure into a run row.
- Do not catch an uncontracted `play.effect` exception.
- Do not change a valid cross-vendor pass or fail verdict.
- Do not reinterpret a named reviewer failure; `T-076-02-01` remains authoritative.
- Do not make an unwritable ledger destination appear recoverable.
- Do not claim a cross-file ACID transaction.
- Do not add live network behavior or the next ticket's no-listener characterization.

## Option 1 — append only in a `finally`, then rethrow

Wrap the tail and move the existing append into `finally`. On error, set `outcome = "errored"`,
append, then rethrow the original error.

Advantages:

- directly satisfies record-write-on-throw;
- preserves failure visibility;
- uses the existing `errored` outcome;
- changes no public cast options.

Limitations:

- a row may still reference a diff removed before the append;
- a failed artifact write may theoretically leave a partial final file;
- artifact discrepancy is not named.

This option is necessary but insufficient for the second acceptance criterion.

## Option 2 — absorb every settlement error as a resolved `RunSummary`

Catch any settlement error, append an `errored` row, and return an `errored` summary.

Advantages:

- the cast promise never rejects from settlement;
- aligns literally with the story title's “never crashes” language;
- callers need no exception path.

Limitations:

- conceals programming defects and arbitrary filesystem failures;
- changes the established boundary where uncontracted failures propagate;
- makes graph-level `erroredSummary` routing less meaningful;
- loses the original exception unless a new public error payload is invented;
- exceeds the ticket's request that the record survive a throw.

Rejected. The predecessor ticket rejected a broad swallow specifically because unrelated defects
must remain visible. This ticket establishes durable settlement, not silent recovery.

## Option 3 — delete the captured diff whenever settlement fails

On a settlement exception, remove `.vend/artifacts/<run>.diff`, omit `capturedDiff`, append an
`errored` row, and rethrow.

Advantages:

- no orphan final diff remains;
- no row points at missing evidence;
- avoids schema extension.

Limitations:

- destroys valid evidence merely because later presentation or resolution failed;
- makes the spent run less auditable;
- cannot explain whether capture never occurred or evidence was discarded;
- conflicts with the ticket's “either writes both or records the discrepancy” wording.

Rejected. Existing evidence should survive unrelated tail failures.

## Option 4 — guarded tail plus explicit discrepancy marker

Guard the tail, append in `finally`, and check the final captured-diff path before record assembly.
If available, write the ordinary `capturedDiff`. If unavailable, omit that claim and write an
`artifactDiscrepancy` object containing the expected reference and a stable reason.

Advantages:

- preserves usable evidence;
- avoids a false reference;
- makes missing evidence explicit and countable;
- matches established structured optional-marker patterns;
- retains historical and ordinary record shape through omission;
- works with a natural real-Git test that removes the patch before its review read.

Limitations:

- requires a small append-only schema extension;
- availability checking and append are not one atomic filesystem primitive;
- an external process can still race after the check.

Chosen, combined with Option 1. The guarantee is scoped to one cast's own operations, exactly as
the ticket states; arbitrary external deletion after verification is outside that boundary.

## Option 5 — place the ledger append before diff capture

Append a base row first, then capture the diff and update the row.

Advantages:

- primary usage is durable earlier;
- a later capture throw cannot erase the row.

Limitations:

- the ledger is append-only and has no row-update operation;
- a second correction row would change consumer semantics;
- the first row cannot truthfully claim the final outcome or review disposition;
- creates duplicate run ids or requires a new event-log model.

Rejected. The current ledger is one terminal row per cast, not a multi-event journal.

## Option 6 — couple artifact bytes into the JSONL row

Store the patch directly in the run record so one append owns both facts.

Advantages:

- one filesystem write for record and artifact content;
- no missing reference.

Limitations:

- destroys the intentionally compact ledger;
- duplicates potentially large binary patches into JSONL;
- changes all review consumers and historical assumptions;
- contradicts E-073's artifact-reference architecture.

Rejected as disproportionate and out of scope.

## Durable error semantics

The row outcome for an unexpected settlement exception is `errored`.

Why `errored`:

- it already belongs to `RunOutcome`;
- it means execution encountered an uncontracted exception rather than an authored gate result;
- it avoids falsely claiming reviewer `missing-capability`;
- it avoids falsely claiming cross-vendor `gate-failed`;
- downstream non-success handling already refuses `errored`.

The returned promise still rejects after append. The ledger row is the audit truth for spent work;
the exception is the control-flow truth for the caller. Both are needed.

The catch stores the original thrown value without coercing or wrapping it. After `finally` has
successfully appended the row, `throw settlementError` preserves identity and diagnostics.

If the append itself fails, its exception necessarily escapes. The system cannot promise a ledger
line on an unwritable ledger. The implementation must not hide that failure behind the earlier
settlement exception.

## Settlement boundary

The guarded region begins after `play.effect` resolves.

Rationale:

- the story names the region between effect landing and record write;
- a resolved effect supplies authoritative materialization and artifact-report data;
- an uncontracted effect throw does not establish whether anything landed;
- classifying such an ambiguous partial effect is separate policy.

Inside the guarded region:

- capture the effect diff;
- project effect report fields;
- render the effect line;
- resolve and execute cross-review;
- settle valid or unavailable review;
- render terminal notices;
- compute terminal presentation values.

Outside but before the guarded region, compute only stable pre-effect facts needed by the record:
logged model, usage, cost, and turn count. These come from completed primary execution.

The `finally` owns:

- captured-diff availability reconciliation;
- final timestamp;
- the single ordinary run-record append.

## Artifact discrepancy schema

Add this optional structured marker to the run-log data contract:

```ts
interface ArtifactDiscrepancy {
  readonly reference: string;
  readonly reason: string;
}
```

The cast emits:

```ts
{
  reference: capturedDiff,
  reason: "captured-diff-unavailable-at-settlement"
}
```

The marker means a capture reference was observed during this cast but could not be verified when
the terminal row was assembled. It does not claim why the file became unavailable.

The row carries exactly one of:

- `capturedDiff`, when the path is available;
- `artifactDiscrepancy`, when the expected path is unavailable;
- neither, when no non-empty diff was captured.

This mutual exclusion is enforced by `castPlay` record assembly. The general run-log normalizer
remains tolerant input plumbing; it validates marker completeness but does not inspect files.

`buildRunRecord` and `reviveRecord` reconstruct only `reference` and `reason`, omitting malformed
or partial markers. Historical rows remain byte-compatible because the new field is optional.

## Artifact publication

Change `captureEffectDiff` from direct final-path `writeFile` to:

1. create the artifact directory;
2. write the complete patch to a unique temporary sibling;
3. rename the sibling to the final `.diff` path;
4. on error, best-effort remove the temporary sibling and rethrow;
5. return the reference only after rename succeeds.

Rename within the same directory is atomic on the local filesystem. This means a capture failure
does not expose a partial final artifact. A successful rename is the last fallible operation before
the function returns, so the caller receives the reference only after publication.

The temporary name uses `randomUUID()` so concurrent casts cannot collide even if callers reuse a
run id. The final-name collision behavior remains last-writer-wins, matching current `writeFile`.

## Record facts on failure

The `errored` row preserves every trustworthy pre-failure fact:

- run id, play, subject, model, envelope, and project;
- intervention and primary execution seat;
- terminal primary usage and cost;
- turns used;
- materialization-derived routing facts already observed;
- base and any valid review gate rows settled before the throw;
- valid cross-vendor verdict data already obtained;
- usable captured diff or explicit discrepancy;
- original start and final append timestamps.

It does not invent:

- a cross-vendor verdict if review did not finish;
- `crossReviewSkipped` if a reviewer resolved;
- reviewer `missing-capability` for an unrelated exception;
- an artifact reference that is unavailable.

## Testing design

### Pure run-log tests

Add tests beside `capturedDiff` coverage proving:

- a complete `artifactDiscrepancy` survives build, serialize, and revive;
- unknown nested keys are dropped;
- a partial or malformed marker is omitted without losing the record;
- historical rows do not synthesize the marker.

### Full cast failure test

Use the existing temporary Git repository and `boardPlanPlay`.

The injected primary executor uses id `claude`, making the captured diff review-relevant. A custom
complement registry removes the known `.vend/artifacts/<run>.diff` synchronously when its reviewer
factory is resolved. `castPlay` then reaches its real `readFile` and throws `ENOENT` from the
non-reviewer settlement tail.

Assert:

- `castPlay` rejects;
- the rejection remains an `ENOENT`-class error;
- exactly one ledger line exists;
- the row outcome is `errored`;
- primary usage and cost survived;
- base gate evidence survived;
- `capturedDiff` is absent from the row;
- `artifactDiscrepancy.reference` names the expected path;
- the discrepancy reason is stable;
- the referenced file is absent;
- no cross-vendor verdict or skipped marker was fabricated.

This one test discharges both ticket criteria: a general settlement throw still writes an honest
row, and the missing artifact is represented as discrepancy rather than a false reference.

### Compatibility verification

Run the full `src/engine/cast.test.ts` suite so valid pass/fail, reviewer failure, inert resolution,
diff capture, and no-diff paths remain green. Run `src/log/run-log.test.ts` for schema compatibility.
Finally run `bun run check`, the repository's mandatory gate.

## Risks and controls

- Risk: the finally append accidentally runs for pre-effect failures.
  Control: begin the guarded region only after a resolved `play.effect`.
- Risk: the original settlement error is swallowed.
  Control: store and rethrow it after append; test uses `expect(...).rejects`.
- Risk: the row falsely claims success.
  Control: overwrite only terminal outcome with `errored` in catch.
- Risk: valid review evidence is discarded.
  Control: retain current `settledVerdict` gate rows and verdict metadata.
- Risk: a missing artifact stays referenced.
  Control: availability check selects captured reference versus discrepancy exclusively.
- Risk: schema extension breaks old rows.
  Control: optional marker plus tolerant normalization and historical-row test.
- Risk: partial final artifact survives a write failure.
  Control: temporary sibling plus atomic rename and best-effort cleanup.
- Risk: unrelated work enters the source commit.
  Control: exact repeated `--include` paths through `lisa commit-ticket`.

## Acceptance mapping

| Acceptance | Design mechanism | Proof |
|---|---|---|
| Settlement-tail throw still writes run record | catch to durable `errored`; append in `finally`; rethrow afterward | real patch-read `ENOENT` cast test |
| Honest outcome | `errored`, with primary actuals and existing gate facts | JSONL assertions |
| Artifact and row consistent | atomic diff publication; final availability reconciliation | missing diff yields discrepancy and no false reference |
| Diff path either writes both or records discrepancy | mutually exclusive `capturedDiff` / `artifactDiscrepancy` assembly | cast test plus run-log round trip |
| Repository healthy | focused suites then mandatory gate | `bun run check` |

## Final decision

Implement Option 4 on top of Option 1, with atomic artifact publication. This is the smallest design
that preserves both truths: unexpected settlement defects still fail loudly, and spent work still
settles durably with artifact evidence that is either usable or explicitly missing.
