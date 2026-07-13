# Progress — T-077-04-04

## Status

Implementation is complete. Two meaningful source units are committed through `lisa commit-ticket`
with exact ticket-owned paths. Focused verification and the final exact-HEAD repository gate pass.

## Research completed

- Read the assignment and repository `AGENTS.md`.
- Read the complete RDSPI workflow.
- Read the canonical vision, charter, and stack documents.
- Read parent story S-077-04 before designing the ticket.
- Read ticket T-077-04-04 and both completed dependencies.
- Read the persistence and lifecycle dependency artifacts.
- Mapped CLI parsing, named dispatch, concrete decompose assembly, generic cast, and draft store.
- Confirmed the doctor probe already emits the exact required resume command.
- Confirmed the hint supplies a bare epic ID rather than a markdown path.
- Confirmed active-state reconciliation and success settlement already exist.
- Confirmed resume should join before gates and reuse the full effect/settlement tail.

Artifact: `research.md`.

## Design completed

Evaluated four approaches:

1. regenerate through a new executor prompt;
2. create a standalone concrete resume runner;
3. broadly extract the post-gate cast tail;
4. add a persisted-output source mode to the existing generic cast.

Selected option 4 because it bypasses all paid cold work while retaining one classifier, effect,
diff-capture, run-log, and draft-settlement implementation.

Established these design rules:

- stored findings are evidence, not current authorization;
- gates rerun against current epic and charter context;
- no duplicate checkpoint is appended during resume;
- a successful effect uses the existing settlement marker;
- no executor provenance or funded envelope is invented;
- stale doctor hints become typed data;
- cold-only flags cannot combine with resume.

Artifact: `design.md`.

## Structure completed

Defined changes across:

- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`;
- `src/play/decompose-epic.ts`;
- `src/play/dispatch.ts`;
- `src/cli.ts`;
- `src/cli.test.ts`;
- `src/shelf/press.ts` (exhaustive handling of the expanded dispatch result).

Confirmed no schema, doctor, gate, effect, run-log model, or BAML file needed modification.

Artifact: `structure.md`.

## Plan completed

Sequenced implementation into:

1. engine source mode and acceptance test;
2. full gate and exact-path engine commit;
3. concrete lookup, dispatch, CLI syntax, and shell integration;
4. focused/full verification and exact-path CLI commit;
5. final exact-HEAD verification and Review.

Artifact: `plan.md`.

## Baseline verification

Before source edits:

```text
bun test src/cli.test.ts src/engine/decompose-draft.test.ts src/engine/cast.test.ts
151 pass
0 fail
509 expect() calls
```

This established a clean dependency baseline.

## Engine implementation

### `src/engine/cast.ts`

Added `CastOptions.resumeDraft` using the existing versioned `DecomposeDraftRecord`.

Added pre-effect wiring guards:

- only `decompose-epic` may consume the record;
- record epic must equal cast subject;
- resume cannot skip gates.

Moved source facts into shared scope and wrapped the established cold prefix:

- MCP/tool resolution;
- executor selection and probe;
- prompt render;
- transcript setup;
- executor dispense;
- token meter;
- parse;
- checkpoint capture.

Resume leaves that branch untouched and installs the stored parsed object as output. It invokes the
play's gates, then follows the exact existing classification/effect/settlement tail.

Resume terminal accounting now records:

- normalized zero usage;
- zero cost;
- no executor turns;
- no executor seat;
- no newly allocated envelope.

### `src/engine/cast.test.ts`

Added the ticket acceptance fixture.

The test:

- writes a real active draft through `appendDecomposeDraft`;
- reloads/selects it through `loadDecomposeDrafts` and `latestDecomposeDraft`;
- supplies render/parse methods that throw if reached;
- supplies an executor whose probe/dispense throw if reached;
- records gates then effect over the unique stored marker;
- materializes a file containing that marker;
- proves zero usage/cost and absent envelope/seat;
- proves the active reader becomes empty;
- proves raw history contains original checkpoint then resume settlement.

Focused result after the engine unit:

```text
34 pass
0 fail
299 expect() calls
```

## First source commit

Commit:

```text
e58baba2ddfc2bcb4e34c6e984c9c516b73ddc12
feat(engine): resume decompose from persisted draft
```

Exact included paths:

- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`.

The pre-commit full gate passed:

```text
1807 pass
1 skip
0 fail
5725 expect() calls
119 test files
```

## Concrete resume implementation

### `src/play/decompose-epic.ts`

Added:

- `ResumeDraftNotFoundError`;
- `resumeEpicPath`;
- resume/store/log run options;
- bare ID resolution to `docs/active/epic/<id>.md`;
- current input assembly for gates/effect;
- latest active draft lookup by canonical epic subject;
- `resumeDraft` handoff to the engine.

An explicit markdown path remains accepted and is resolved relative to the project root.

### `src/play/dispatch.ts`

Added optional-budget dispatch input and `no-draft` result data.

Cold dispatch remains behind `withFundingCounter`. Resume bypasses that cold funding warning and
uses the authored play budget only as the internal cast API parameter; the terminal record omits a
new envelope and records zero usage.

Only `ResumeDraftNotFoundError` is converted to `no-draft`; unrelated defects still throw.

### `src/cli.ts`

Added the exact free command:

```text
vend run decompose-epic <epic> --resume
```

Parsing now permits missing budget only when `--resume` is present. Resume refuses cold-only flags:

- `--budget`;
- `--no-gates`;
- intervention flags;
- `--after`;
- `--agent`.

The shell prints no funding line for resume. A stale hint prints one expected refusal and exits 1.

### `src/cli.test.ts`

Added tests for:

- exact doctor command parsing;
- explicit markdown path parsing;
- cold-only flag refusals;
- free-versus-metered help grouping;
- a spawned exact command in a temporary project;
- zero stdout/funding and typed no-draft stderr on stale state.

### `src/shelf/press.ts`

Added exhaustive handling for the new dispatch result. A cold press can never request resume, so a
`no-draft` result is treated as an explicit wiring defect rather than silently read as a summary.

## Deviations from plan

### Additional accounting refinement

After the first commit, the resume acceptance test was strengthened to assert no fabricated funded
envelope or executor seat. That required a small second edit to `cast.ts` and `cast.test.ts`, so both
appear in the second exact-path commit as well.

Rationale: P7 is better served by recording zero actual use with no new envelope than by logging the
play's authored cold budget as though the resume command had allocated it.

### Dispatch exhaustiveness file

`src/shelf/press.ts` was added to the second commit because expanding `DispatchResult` correctly
made the existing cold press handle the impossible resume-state arm explicitly.

No behavioral scope was added to press.

### Stricter flag boundary

The plan left parser compatibility open. Implementation chose an explicit refusal for cold-only
flags on resume because the v1 draft does not persist those inputs and gates must not be bypassed.

## Focused final verification

```text
bun test src/cli.test.ts src/engine/cast.test.ts src/engine/decompose-draft.test.ts
157 pass
0 fail
534 expect() calls
```

Also passed:

```text
bun run build
tsc --noEmit
```

## Second source commit

Commit:

```text
d07b557f7193163a5486049fd19959d88505e88a
feat(cli): resume decompose from active draft
```

Exact included paths:

- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`;
- `src/play/decompose-epic.ts`;
- `src/play/dispatch.ts`;
- `src/cli.ts`;
- `src/cli.test.ts`;
- `src/shelf/press.ts`.

The pre-commit full gate passed:

```text
1812 pass
1 skip
0 fail
5742 expect() calls
119 test files
```

## Worktree ownership

Ticket-owned source is committed and clean.

Remaining worktree entries are Lisa-owned:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-077-04-04.md`;
- Lisa-published `docs/active/work/T-077-04-04/` artifacts.

No ordinary-index staging was used.

## Final exact-HEAD gate

```text
bun run check
BAML generation: pass
TypeScript: pass
1812 tests pass
1 test skip (pre-existing missing dist/release-local condition)
0 tests fail
5742 expect() calls
119 test files
```

The source HEAD did not change after this gate. Review artifacts are the only remaining attempt-local
work, after which the worker stops on this ticket for Lisa completion handling.

