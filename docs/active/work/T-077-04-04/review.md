# Review — T-077-04-04

## Disposition

PASS. The acceptance criterion is met, ticket-owned source is committed through Lisa with exact
paths, and the final authoritative gate at the committed source HEAD is green.

## Outcome

Vend can now execute the doctor probe's recovery command:

```text
vend run decompose-epic E-077 --resume
```

The command loads the latest active persisted draft for E-077, assembles current epic/charter
context, bypasses the entire executor source path, reruns gates over the stored parsed output, and
uses the existing effect and success-settlement lifecycle.

A successful resume materializes from the stored object and clears the active draft. No prompt is
rendered, no executor is probed or dispensed, no transcript is created, and no regeneration tokens
are spent.

## Source changes

### `src/engine/cast.ts`

Added an optional `resumeDraft` to `CastOptions`.

The engine validates three invariants before any source effects:

- the target play is the canonical `decompose-epic`;
- the record's epic matches the cast subject;
- gates cannot be skipped on resume.

Cold source acquisition retains its established order and behavior. Resume bypasses:

- MCP/tool provisioning;
- executor selection;
- executor probe;
- prompt render;
- transcript creation;
- executor dispense;
- token check;
- parse;
- duplicate draft checkpoint capture.

Resume installs the stored `parsedDraft` as the play output and rejoins at `play.gates`. Persisted
gate findings are not trusted as current authorization; the current gate result drives the same
classifier and effect path as a cold cast.

The common terminal tail remains authoritative for:

- materialization;
- effect reporting;
- artifact diff capture;
- optional review policy;
- run-log settlement;
- decompose draft settlement;
- returned `RunSummary`.

Resume accounting records zero usage and cost, with no executor seat, turns, or newly funded
envelope. This makes the no-regeneration claim auditable rather than inferred from control flow.

### `src/engine/cast.test.ts`

Added the direct acceptance proof using only public draft APIs and a BAML-free fixture.

The fixture writes and reloads a real schema-v1 checkpoint. Its play's render and parse throw if
called. Its injected executor's probe and dispense also throw if called. The successful observed
sequence is exactly:

```text
gates:paid-output-is-reused
effect:paid-output-is-reused
```

The effect writes a file containing the unique stored marker. Assertions prove:

- stored output, not regenerated output, reaches gates and effect;
- no executor preparation or dispense occurs;
- summary is successful and materialized;
- terminal token buckets and cost are zero;
- funded envelope and executor seat are absent;
- active draft state is empty afterward;
- raw ledger history contains the original checkpoint followed by the resume settlement marker.

### `src/play/decompose-epic.ts`

Added concrete recovery assembly:

- a bare ID resolves to `<root>/docs/active/epic/<id>.md`;
- an explicit markdown path remains supported;
- current epic, charter, and project context is assembled;
- the canonical subject is derived from the epic body;
- active draft state is loaded through `loadDecomposeDrafts`;
- `latestDecomposeDraft` selects the record for that subject;
- missing state raises the typed `ResumeDraftNotFoundError`;
- the selected record and effective draft path are passed into `castPlay`.

The module does not inspect raw JSONL or duplicate settlement logic.

### `src/play/dispatch.ts`

Named dispatch now accepts a missing budget only for resume and adds a typed `no-draft` result.

Cold dispatch is unchanged: it uses the caller's budget and passes through `withFundingCounter`.
Resume skips that cold funding presentation and dispatches with the registered play's authored
budget only as the existing internal API parameter. The terminal resume record omits a funded
envelope.

Only the typed recovery-state miss becomes data. Unrelated exceptions still propagate.

### `src/cli.ts`

The usage banner lists resume under `free (no tokens)` and cold run under metered commands.

`parseRunArgs` accepts the exact no-budget doctor command and preserves the existing cold-run
requirement. Resume refuses flags whose semantics depend on cold execution or absent v1 inputs:

- `--budget`;
- `--no-gates`;
- `--intervened` / `--no-intervened`;
- `--after`;
- `--agent`.

The shell emits no funding line for resume. A stale doctor hint becomes:

```text
no active decompose draft for E-077
```

with exit code 1 rather than a stack trace.

### `src/cli.test.ts`

Added pure and spawned coverage for:

- exact doctor command parsing;
- explicit markdown resume path;
- cold-only flag refusals;
- free-versus-metered help grouping;
- exact command execution in a temporary project;
- zero funding/stdout and typed missing-draft stderr for stale state.

### `src/shelf/press.ts`

Expanded the dispatch-result exhaustiveness guard. Cold press never requests resume, so `no-draft`
is an explicit wiring defect rather than a value that could be misread as a run summary.

## Acceptance assessment

Ticket criterion:

> `vend run decompose-epic <epic> --resume` re-enters the cast at gates/effect from the persisted
> draft with no new executor dispense; a test asserts the resume path bypasses dispense,
> materializes from the stored draft, then clears it.

### Exact command

Met. Pure parsing and a spawned CLI test both exercise the doctor command with a bare epic ID and no
budget argument.

### Re-entry at gates/effect

Met. The engine source branch installs the stored parsed object and invokes gates before the common
effect tail. Persisted findings do not bypass a current gate decision.

### No new executor dispense

Met beyond the minimum. The acceptance fixture proves no executor probe or dispense, and also proves
no render or parse. Any one of those calls would throw and fail the test.

### No regeneration tokens

Met. Terminal usage normalizes every token bucket to zero and cost to zero. Resume creates no
transcript or funded envelope.

### Materialize from stored draft

Met. The materialized file contains the unique marker read from the seeded persisted record, and
gate/effect call logs carry the same marker.

### Clear after success

Met. Raw history ends with a settlement marker for the resume run, while the public active reader
returns exactly `{ records: [], skipped: 0 }`.

## Test evidence

### Focused final suites

```text
bun test src/cli.test.ts src/engine/cast.test.ts src/engine/decompose-draft.test.ts
157 pass
0 fail
534 expect() calls
```

### Typecheck

```text
bun run build
tsc --noEmit
```

### Final authoritative gate at exact source HEAD

```text
bun run check
BAML generation: pass
TypeScript: pass
1812 pass
1 skip
0 fail
5742 expect() calls
119 test files
```

The one skip is the established release-local integration condition: no `dist/` artifacts are
present. It is unrelated to this ticket.

## Commit evidence

```text
e58baba2ddfc2bcb4e34c6e984c9c516b73ddc12
feat(engine): resume decompose from persisted draft
```

Includes only:

- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`.

```text
d07b557f7193163a5486049fd19959d88505e88a
feat(cli): resume decompose from active draft
```

Includes only:

- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`;
- `src/play/decompose-epic.ts`;
- `src/play/dispatch.ts`;
- `src/cli.ts`;
- `src/cli.test.ts`;
- `src/shelf/press.ts`.

Both commits were made with `lisa commit-ticket` and exact repeated `--include` paths after green
full gates. Ticket-owned source is clean.

## Scope review

No out-of-slice behavior landed:

- no repair or regeneration loop;
- no draft schema change;
- no gate taxonomy change;
- no materializer change;
- no executor implementation change;
- no doctor behavior change;
- no token/turn presentation change;
- no raw draft deletion or compaction;
- no live metered cast.

## Pure-core / impure-shell assessment

The existing boundary remains intact.

- CLI parsing and path selection rules are plain-value judgments.
- Draft reconciliation/latest selection remain in the existing pure store core.
- The decompose shell performs filesystem reads and composes existing pure/public helpers.
- The cast remains the single impure execution/settlement shell.
- The acceptance test pins observable behavior at that shell using injected effects.

No filesystem or executor effect moved into a pure core.

## Known limitations and open concerns

### Fixture-proven boundary

The successful materialization proof uses a BAML-free fixture play and forbidden-call executor. This
is exactly the story's honest boundary: the live metered long-tail interruption is not rerun. The
spawned CLI test proves public routing only through the stale-draft refusal; successful production
materialization is proven at the real generic cast/store lifecycle seam.

### V1 does not preserve optional cold effect inputs

The dependency's v1 draft stores epic subject, parsed output, gate findings, repair action, and
provenance; it does not store original `--after` or `--agent` inputs. Resume therefore refuses those
flags and assembles the base current context. This ticket does not invent missing history or expand
the settled schema. A future schema version would be required to replay those optional inputs.

### Current context is authoritative

Gates rerun against the current epic and charter files, not a historical copy hidden inside the
draft. This is deliberate: persisted findings are evidence, and current gates are the contract. A
changed charter may cause a previously clear draft to stop rather than materialize stale policy.

### Gate-stopped drafts remain stopped without repair

Replaying an unchanged gate-stopped draft will normally stop at the same gate. The story explicitly
defines resumable as distinct from auto-repair, so no mutation/regeneration loop is added.

### Store validates the versioned outer record

The draft reader validates the schema and object-shaped parsed payload. It does not deeply recreate
BAML runtime types from arbitrary hand-edited JSON. System-produced checkpoints originate from the
typed parse path; a corrupted inner payload can still surface as a gate/programmer boundary error.
Deep hostile-store validation is not part of this story.

### Resume records and calibration

A successful resume is recorded as a zero-usage success for the same play, with no funded envelope.
This truthfully represents the command and keeps bias-factor learning (which requires an envelope)
from treating it as an allocation pair. The broader raw percentile recalibrator currently reads all
successful play records, including envelope-less historical rows; separating resume samples would
require a run-log schema/policy change, which the story explicitly leaves outside this slice.

### Raw draft ledger growth

Settlement remains append-only. The active reader clears recovery state, but checkpoint and marker
history remains on disk until a future compaction policy exists.

None of these limitations blocks the ticket's stated acceptance criterion.

## Worktree review

Ticket-owned source files are committed and clean. Remaining status belongs to Lisa's workflow:

- provenance updates;
- ticket phase metadata;
- published attempt artifacts under `docs/active/work/T-077-04-04/`.

Those files were not ordinary-index staged or included in ticket source commits.

## Final assessment

The resumable-decompose story now has its execution join: persisted paid output can move through
current gates and materialization without a cold executor call, and success reconciles the recovery
state through the established append-only lifecycle. The exact doctor command is executable,
zero-spend is test-visible, and the full repository remains green. Disposition: pass.

