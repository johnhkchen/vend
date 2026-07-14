# Design — T-077-04-01

## Decision to make

The ticket needs a durable checkpoint after decompose parse and gates that later tickets can clear,
diagnose, and resume. The design must preserve paid work, remain tolerant of process interruption,
use the characterized cap-hit fact honestly, and avoid pulling concrete play/BAML dependencies into
the generic cast engine.

## Required record

Each admitted record will contain:

- `v`: numeric schema version;
- `runId`: correlation with transcript and terminal run record;
- `epic`: the cast's subject identifier;
- `parsedDraft`: the exact parsed object supplied to gates;
- `gateFindings`: the exact CLEAR or STOP verdict returned by the play;
- `nextRepairAction`: structured recovery metadata;
- `createdAt`: ISO timestamp stamped by the impure cast shell.

The minimum ticket fields are all present. The correlation and timestamp fields make the record
locally inspectable and give later consumers enough provenance without coupling to `runs.jsonl`.

## Option 1 — extend `runs.jsonl`

Add parsed draft and repair fields to `RunRecord` and let `castPlay` append them at settlement.

Advantages:

- Reuses an existing ledger and loader.
- Avoids adding a second JSONL file.
- Naturally correlates accounting and recovery state.

Rejected because:

- Run records are appended only at terminal settlement, too late for post-gate interruption safety.
- A thrown effect can prevent the ordinary settlement path from representing a resumable checkpoint.
- Parsed `WorkPlan` objects are large operational state, not accounting facts.
- Cleanup-on-success would require rewriting or tombstoning the append-only run ledger.
- Doctor and resume should not scan all accounting records to find active recovery state.

## Option 2 — one mutable JSON file per epic

Write `.vend/decompose-drafts/<safe-epic>.json` atomically after gates.

Advantages:

- Latest-by-epic lookup is direct.
- Clearing a success is a single unlink.
- Each file contains only one active state.

Rejected for this ticket because:

- The acceptance criterion explicitly asks to mirror `runs.jsonl` conventions.
- Filename sanitization introduces identity and collision policy not otherwise required.
- A directory of files is less directly countable and less tolerant of a torn replacement without
  additional temporary-file/rename machinery.
- The story says “latest parsed draft,” which naturally fits ordered append history.

## Option 3 — dedicated append-only draft JSONL store

Write `.vend/decompose-drafts.jsonl`, with pure build/serialize/read/revive helpers and thin
append/load filesystem wrappers.

Advantages:

- Directly mirrors the versioned, newline-delimited, malformed-tail-tolerant run-log convention.
- A process interruption can damage at most one tail row; earlier drafts remain readable.
- Multiple attempts retain useful history, and latest selection is append-order based.
- Doctor and resume can consume one dedicated store without loading accounting data.
- Later clear-on-success work can define active-state lifecycle over this narrow store.

Chosen. It best matches the explicit acceptance wording and existing repository precedent.

## Store module boundary

Create `src/engine/decompose-draft.ts` as a cohesive pure-core/impure-shell module.

Pure exports:

- schema/path/play-name constants;
- structural record/action/findings types;
- `nextDecomposeRepairAction`;
- `buildDecomposeDraftRecord`;
- `serializeDecomposeDraftRecord`;
- `reviveDecomposeDraftRecord`;
- `readDecomposeDrafts`;
- `latestDecomposeDraft`.

Impure exports:

- `appendDecomposeDraft`;
- `loadDecomposeDrafts`.

The module imports `GateVerdict` only as a type. It imports no concrete play, executor, budget,
doctor, CLI, or generated BAML symbol.

## Record validation

`buildDecomposeDraftRecord` is the strict write boundary:

- `runId`, `epic`, and `createdAt` must be non-empty strings;
- `parsedDraft` must be a non-null, non-array object;
- gate findings must be a valid CLEAR or STOP discriminated shape;
- next action must match one of the supported action variants;
- object/array fields are copied so the top-level record can be frozen predictably.

`reviveDecomposeDraftRecord` is the tolerant read boundary:

- only schema version 1 is admitted;
- malformed required fields return `null`;
- CLEAR preserves the ordered `cleared` strings when present;
- STOP preserves `gate`, `unit`, and `reason` verbatim;
- unsupported action variants return `null`;
- parsed draft remains opaque object data for later typed consumption.

`readDecomposeDrafts` skips malformed lines and reports a skipped count like `readRuns`.

## Next-repair-action design

Use a structured discriminated union instead of free prose.

For a gate STOP:

```ts
{
  kind: "repair-gate",
  gate,
  unit,
  reason,
  cause: "executor-max-turns" | "gate-stop"
}
```

For a gate CLEAR:

```ts
{
  kind: "resume-at-gates",
  cause: "executor-max-turns" | "post-gate-interruption"
}
```

The action does not execute repair. It says what state the checkpoint represents. A future resume
re-enters at gates/effect, while a gate STOP explicitly says repair is required before that can
clear. The `cause` retains cap-hit when and only when terminal `result.subtype` is exactly
`error_max_turns`.

## Why subtype beats turn comparison

T-077-01-01 proved that accumulated assistant turns and terminal `num_turns` are unlike units.
Inferring cap-hit from either count would recreate the defect E-077 is fixing. The selector accepts
the terminal subtype string and performs one exact comparison. Unknown future subtypes fall back to
ordinary post-gate/gate-stop recovery rather than being guessed into max-turns.

## Cast integration point

In `castPlay`, retain the existing parse and gate calls. Immediately after `play.gates` returns:

1. check that gates were not skipped;
2. check the stable play name equals `decompose-epic`;
3. derive the next action from the exact `gateVerdict` and `result.subtype`;
4. append the record under the project's `.vend/` path;
5. only then continue to classify/effect.

This ordering means:

- gate-failed output is durable before the returned failure;
- a later effect or settlement interruption cannot erase the checkpoint;
- a checkpoint write failure stops the cast before effect, avoiding a false resumability claim;
- no ungated cast claims to have gate findings;
- every other play remains byte-for-byte outside the new branch.

## Path resolution

The store's exported default is repository-relative `.vend/decompose-drafts.jsonl`.
`castPlay` joins it to `projectRoot`, matching transcript/effect project scoping and the later doctor
probe's expected root. Add `CastOptions.decomposeDraftPath` as a test/embedding override, analogous
to `runLogPath` and `transcriptDir`.

## Test design

### Pure store suite

- Build and serialize a CLEAR record; assert schema and newline.
- Read multiple valid records plus malformed/unsupported rows; assert tolerant skip count.
- Preserve a STOP finding and structured repair action exactly across the round trip.
- Select the latest record globally and for one epic by append order.
- Assert missing store loads as empty through the thin impure reader where useful.
- Assert cap-hit action selection keys on subtype, not turn counts.

### Cast integration suite

- Add a BAML-free play named `decompose-epic` whose parse returns an object.
- Make its gate return a STOP and its effect observable but unreachable.
- Cast through the existing token-free stub executor.
- Assert outcome is `gate-failed` and effect did not run.
- Load `.vend/decompose-drafts.jsonl` through `loadDecomposeDrafts`.
- Assert the epic, parsed draft, STOP findings, and repair action are readable.
- Extend the existing `error_max_turns` characterization to assert max-turns cause in its draft.

## Rejected scope

- Do not clear records after a clean effect; T-077-04-02 owns that lifecycle.
- Do not add doctor checks; T-077-04-03 owns them.
- Do not add `--resume` or bypass dispense; T-077-04-04 owns them.
- Do not mutate parsed drafts or gate findings.
- Do not add a repair/regeneration loop.
- Do not change classifications, budgets, turn display, or executor behavior.

## Design decision

Land a dedicated versioned JSONL decompose-draft store and wire one post-gate append into
`castPlay`. Preserve native parsed/gate state, derive structured next-action data using the exact
terminal cap subtype, and prove a gate-failed cast leaves a readable checkpoint. Keep all lifecycle
and resume behavior for the downstream tickets already sequenced behind this foundation.
