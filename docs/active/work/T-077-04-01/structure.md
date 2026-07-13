# Structure — T-077-04-01

## Change map

This ticket adds one store module and one focused test module, then touches the existing cast shell
and its integration suite. No files are deleted. No CLI, doctor, play implementation, generated
BAML, or run-log schema file changes.

## Create `src/engine/decompose-draft.ts`

### Responsibility

Own the local, versioned, append-only recovery ledger for parsed decompose drafts. Keep record
judgment and parsing pure; keep filesystem effects in two leaf functions.

### Constants

```ts
DECOMPOSE_DRAFT_SCHEMA_VERSION = 1
DEFAULT_DECOMPOSE_DRAFT_PATH = ".vend/decompose-drafts.jsonl"
RESUMABLE_DECOMPOSE_PLAY = "decompose-epic"
```

The play-name constant avoids importing the concrete play into the engine and gives future doctor/
resume consumers one canonical identity.

### Public data types

`DecomposeGateFindings` mirrors the persisted subset of `GateVerdict`:

- CLEAR: `{ status: "clear"; cleared?: readonly string[] }`
- STOP: `{ status: "stop"; gate: string; unit: string; reason: string }`

`DecomposeRepairCause`:

- `executor-max-turns`
- `gate-stop`
- `post-gate-interruption`

`DecomposeNextRepairAction`:

- `repair-gate` with exact gate/unit/reason and cause;
- `resume-at-gates` with cause.

`DecomposeDraftRecordInput<T extends object>` carries pre-normalized write values.

`DecomposeDraftRecord<T extends object = Record<string, unknown>>` carries:

- literal schema version;
- run ID;
- epic subject;
- parsed draft;
- gate findings;
- next repair action;
- creation timestamp.

`ReadDecomposeDraftsResult` carries `records` and `skipped`.

### Pure functions

`nextDecomposeRepairAction(gateFindings, executorSubtype)`:

- exact subtype comparison against `error_max_turns`;
- STOP returns repair-gate with preserved details;
- CLEAR returns resume-at-gates;
- no turn-count parameters exist, preventing unlike-unit inference.

`buildDecomposeDraftRecord(input)`:

- asserts required strings;
- validates object-shaped parsed draft;
- validates/copies findings and action;
- stamps schema version;
- freezes the returned top-level record.

`serializeDecomposeDraftRecord(record)`:

- `JSON.stringify(record) + "\n"`;
- no formatting or prose translation.

`reviveDecomposeDraftRecord(value)`:

- rejects non-object values and unsupported versions;
- accepts only complete required fields;
- validates/copies native findings and structured action;
- returns frozen normalized record or `null`.

`readDecomposeDrafts(jsonl)`:

- splits newline-delimited text;
- ignores blanks;
- catches per-line JSON errors;
- counts parse/revive failures;
- preserves valid append order.

`latestDecomposeDraft(records, epic?)`:

- scans backward;
- returns the last matching record;
- optional epic selects one subject;
- returns `null` when no match exists.

### Impure functions

`appendDecomposeDraft(input, opts?)`:

- path defaults to `.vend/decompose-drafts.jsonl` relative to caller cwd;
- composes build + serialize;
- creates parent directory recursively;
- appends one line with `appendFile`.

`loadDecomposeDrafts(opts?)`:

- reads the selected path;
- ENOENT returns `{ records: [], skipped: 0 }`;
- other filesystem errors propagate;
- delegates all content logic to `readDecomposeDrafts`.

## Create `src/engine/decompose-draft.test.ts`

### Responsibility

Pin the pure record contract and tolerant JSONL behavior independently of `castPlay`.

### Cases

1. Build/serialize CLEAR record:
   - schema version is 1;
   - required fields preserved;
   - serialized row ends with one newline.
2. Action selection:
   - exact `error_max_turns` produces max-turns cause;
   - a high numeric turn count is not accepted because no count parameter exists;
   - ordinary STOP produces gate-stop cause.
3. Read/revive:
   - valid CLEAR and STOP rows survive;
   - malformed JSON increments skipped;
   - unsupported version increments skipped;
   - gate/action detail remains exact.
4. Latest selection:
   - global latest follows append order;
   - epic-filtered latest selects that epic's newest row.
5. Missing load:
   - explicit nonexistent temp path reads as empty.

## Modify `src/engine/cast.ts`

### Imports

Import from sibling `decompose-draft.ts`:

- `appendDecomposeDraft`;
- `DEFAULT_DECOMPOSE_DRAFT_PATH`;
- `nextDecomposeRepairAction`;
- `RESUMABLE_DECOMPOSE_PLAY`.

No concrete play import is introduced.

### `CastOptions`

Add optional `decomposeDraftPath`:

- overrides the checkpoint ledger path;
- default is `join(projectRoot, DEFAULT_DECOMPOSE_DRAFT_PATH)`;
- supports hermetic tests and embeddings;
- does not affect non-decompose plays.

### Parse/gate checkpoint branch

Keep existing parse and skip-gates output. After `gateVerdict = play.gates(...)`:

```ts
if (!opts.skipGates && play.name === RESUMABLE_DECOMPOSE_PLAY && gateVerdict !== null) {
  await appendDecomposeDraft({
    runId,
    epic: opts.subject,
    parsedDraft: output,
    gateFindings: gateVerdict,
    nextRepairAction: nextDecomposeRepairAction(gateVerdict, result.subtype),
    createdAt: new Date().toISOString(),
  }, { path: opts.decomposeDraftPath ?? join(root, DEFAULT_DECOMPOSE_DRAFT_PATH) });
}
```

The call occurs before `classify`, effect, and settlement. Existing output/gate objects are not
mutated. Store failures propagate before materialization.

## Modify `src/engine/cast.test.ts`

### Imports

Add `loadDecomposeDrafts` and `DEFAULT_DECOMPOSE_DRAFT_PATH` from the new store module.

### New failed-cast fixture test

Use a BAML-free `Play<{ epic: string }, { stories: unknown[]; tickets: unknown[] }>` named
`decompose-epic`:

- parser returns an object from the stub result;
- gate returns a deterministic STOP;
- effect records if called;
- stub executor uses no process/network/token spend.

Assertions:

- returned outcome is `gate-failed`;
- materialized is false;
- effect observation remains empty;
- default store exists under `<root>/.vend/decompose-drafts.jsonl`;
- loader returns one readable record and zero skipped rows;
- record includes exact epic and parsed object;
- STOP gate findings are unchanged;
- next action is repair-gate with gate-stop cause.

### Existing cap-hit characterization extension

After the current `error_max_turns` assertions, load the draft store and assert:

- one decompose checkpoint exists;
- its next action cause is `executor-max-turns`;
- no `num_turns` comparison participates in the assertion.

## Ownership and commit units

### Unit 1 — store primitive

- `src/engine/decompose-draft.ts`
- `src/engine/decompose-draft.test.ts`

This unit is independently typecheckable/testable and provides the stable API used downstream.

### Unit 2 — cast checkpoint integration

- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

This unit wires the API at the story-specified point and proves failed/cap-hit behavior.

Each unit is committed with `lisa commit-ticket` and exact `--include` arguments only after the full
repository gate is green.

## Explicitly unchanged

- `src/log/run-log.ts`: accounting schema remains separate.
- `src/engine/play.ts`: no generic resumability contract is added.
- `src/play/decompose-epic.ts`: play behavior and BAML wiring remain unchanged.
- `src/doctor/*`: downstream T-077-04-03.
- `src/cli.ts`: downstream T-077-04-04.
- `docs/active/tickets/T-077-04-01.md`: Lisa owns phase/status.
- `docs/active/work/T-077-04-01/*`: Lisa publishes attempt artifacts after admission.
