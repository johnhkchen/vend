# Review — T-077-04-01

## Disposition

PASS. The ticket acceptance criterion is met, all ticket-owned source is committed through Lisa,
and the final exact-HEAD `bun run check` is green.

## What changed

### `src/engine/decompose-draft.ts` — created

Adds the local resumable-decompose store.

The record schema is version 1 and contains:

- `runId`;
- `epic`;
- `parsedDraft`;
- `gateFindings`;
- `nextRepairAction`;
- `createdAt`.

The default store is `.vend/decompose-drafts.jsonl`. It is intentionally separate from
`runs.jsonl`: the run ledger contains terminal accounting facts, while this store contains
mid-cast operational recovery state.

The module follows the repository's pure-core / impure-shell convention:

- pure record validation and construction;
- pure JSONL serialization;
- pure tolerant row revival and batch reading;
- pure latest-by-epic selection;
- pure next-action derivation;
- thin append/load filesystem wrappers.

Malformed JSON, incomplete rows, unsupported action shapes, and future schema versions are skipped
and counted. ENOENT means a fresh empty store; other filesystem failures remain loud.

### `src/engine/decompose-draft.test.ts` — created

Adds five focused tests with 20 assertions covering:

- schema version and newline-delimited serialization;
- exact parsed draft and gate verdict preservation;
- structured next-action derivation;
- exact `error_max_turns` recognition;
- ordinary gate-stop recovery metadata;
- malformed/partial/future row tolerance;
- append-order latest selection globally and by epic;
- missing-store empty behavior.

### `src/engine/cast.ts` — modified

Adds one optional `CastOptions.decomposeDraftPath` test/embedding override.

After a result parses and real gates return, a branch for stable play identity `decompose-epic`
appends the checkpoint before classification and effect. The branch writes under the effective
project root by default.

The integration deliberately does not import `src/play/decompose-epic.ts` or BAML. The generic
engine remains independent of concrete play implementation modules; the canonical play-name
constant lives in the sibling store module.

Ungated casts do not write a post-gate checkpoint because they have no gate findings. Other plays
never enter the branch.

### `src/engine/cast.test.ts` — modified

Adds the acceptance fixture: a token-free decompose-shaped cast parses a plain object, returns a
structural gate STOP, does not call its effect, and leaves one readable checkpoint under `.vend/`.

Also extends the existing T-077-01-01 cap-hit characterization to read the checkpoint and assert
`executor-max-turns` cause.

## Acceptance assessment

Ticket criterion:

> After parse+gates in a decompose cast, a schema-versioned draft record (epic subject + parsed
> draft + gate findings + next-repair-action) is written under `.vend/` (mirroring runs.jsonl
> conventions); a test asserts an interrupted/failed cast leaves a readable draft.

### After parse + gates

Met. The append call follows `play.parse` and `play.gates` directly. It precedes `classify`, effect,
cross-review, artifact capture, presentation, and run-log settlement.

### Decompose cast only

Met. The branch requires the canonical stable identity `decompose-epic`. No concrete play/BAML
dependency was introduced into the engine.

### Schema-versioned

Met. Every written record carries `v: 1`; unsupported versions are rejected on read. Unit tests pin
the version.

### Under `.vend/`

Met. The default path is `<projectRoot>/.vend/decompose-drafts.jsonl`. The acceptance test loads
from that exact default-relative path.

### Epic subject

Met. `opts.subject` is persisted as `epic`; the integration test round-trips `E-077`.

### Parsed draft

Met. The exact object returned by parse and supplied to gates is persisted. The fixture's story and
ticket values round-trip through the public loader.

### Gate findings

Met. The native `GateVerdict` shape is persisted rather than translated into run-log rows. The
fixture's STOP `gate`, `unit`, and `reason` are exact after read. CLEAR ordering is covered by the
store unit suite.

### Next repair action

Met. Structured metadata distinguishes repair-gate from resume-at-gates and retains the recovery
cause. Gate details are included on the repair action.

### Honest cap-hit prerequisite

Met. `executor-max-turns` is selected only when terminal subtype equals `error_max_turns`.
The selector has no numeric turn parameters. The existing live-seam fixture still proves the 15
assistant turns and 23 conversation events are unlike facts and never renders them as one ratio.

### Mirrors `runs.jsonl` conventions

Met through:

- dedicated JSONL file;
- numeric schema version;
- one record per line with a trailing newline;
- strict write-side construction;
- tolerant malformed-tail reading with skipped count;
- append-only filesystem write;
- parent-directory creation;
- ENOENT-as-empty load.

### Failed cast remains readable

Met. The integration fixture returns a structural gate STOP. The cast settles `gate-failed`, its
effect is not called, and `loadDecomposeDrafts` returns the complete record with zero skipped rows.

## Test and gate evidence

Focused store suite:

```text
5 pass
0 fail
20 expect() calls
```

Focused store + cast integration suites:

```text
28 pass
0 fail
267 expect() calls
```

Final authoritative command:

```text
bun run check
BAML generation: pass
TypeScript: pass
1796 tests pass
1 test skip (pre-existing release-local integration condition)
0 tests fail
5675 expect() calls
118 test files
```

The focused and full tests use stub executors. No live model, credit spend, or remote network call
was introduced.

## Commit evidence

`1bae202f91ab1e01b0dd6759729d1a96bca3e2c4`

> feat: add resumable decompose draft store

Includes only:

- `src/engine/decompose-draft.ts`
- `src/engine/decompose-draft.test.ts`

`79d4ff13e94ecd4e13c0431bf2fda17eefe4746f`

> feat: checkpoint decompose drafts after gates

Includes only:

- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

Both commits were produced through `lisa commit-ticket` with exact repository-relative include
paths after a green full gate. Ticket-owned source is clean at Review time.

## Scope review

No out-of-slice work landed:

- no repair/regeneration loop;
- no success cleanup;
- no doctor probe;
- no resume CLI flag;
- no executor bypass;
- no gate taxonomy change;
- no budget or progress-line change;
- no run-log schema change.

This preserves the story DAG: T-077-04-02 and T-077-04-03 can independently consume the store,
then T-077-04-04 can join lifecycle and loading behavior.

## Known limitations and downstream concerns

1. A successful decompose currently also leaves its newly written checkpoint. This is intentional
   and visible, not a defect hidden by this review: T-077-04-02 owns clear-on-success and depends on
   this ticket.
2. A process interrupted before parse or before gates cannot have a parsed, gated checkpoint. The
   contract begins after parse+gates; raw executor progress remains in the transcript.
3. The store is append-only in this slice. `latestDecomposeDraft` gives consumers deterministic
   append-order selection; lifecycle compaction/removal belongs to T-077-04-02.
4. The parsed draft is runtime-validated as an object and otherwise remains opaque. T-077-04-04
   must apply the concrete resume typing/validation when loading it into decompose gates/effect.
5. `repair-gate` is descriptive metadata. There is deliberately no mechanism here that mutates or
   regenerates the draft; the story explicitly excludes auto-repair.

No limitation blocks this ticket's acceptance criterion.

## Worktree review

The four ticket-owned source files are committed and clean. Remaining status entries are outside
this ticket's ownership:

- Lisa provenance/ticket phase metadata;
- Lisa-published RDSPI artifacts;
- concurrent T-077-02-04 artifacts.

They were preserved and excluded from both ticket commits.

## Final assessment

The persistence foundation required by every remaining S-077-04 ticket is present, tested, and
committed. A failed decompose no longer loses the paid parsed/gated state, the record is directly
readable under `.vend/`, and cap-hit recovery is based on the characterized executor subtype rather
than a misleading turn-count comparison. Disposition: pass.
