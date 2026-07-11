# Progress — T-070-01-03: cast records and warns on seat default

## Status

Implementation is complete and acceptance is green. Research, Design, Structure, Plan, and Implement
have been executed continuously. The remaining phase is Review.

## Phase checklist

- [x] Read `AGENTS.md` and the RDSPI workflow.
- [x] Read the canonical vision and charter.
- [x] Read parent story `S-070-01` before full ticket research.
- [x] Read dependency artifacts and current implementation state.
- [x] Write `research.md`.
- [x] Write `design.md`.
- [x] Write `structure.md`.
- [x] Write `plan.md`.
- [x] Commit pre-implementation artifacts.
- [x] Add a failing end-to-end acceptance test.
- [x] Implement cast warning and record forwarding.
- [x] Run focused and adjacent checks.
- [x] Run `bun run check` successfully.
- [x] Audit the scoped diff and unrelated worktree changes.
- [ ] Commit implementation and this Progress artifact.
- [ ] Write and commit `review.md`.

## Pre-implementation checkpoint

Committed the first four phase artifacts:

```text
0b8e2ea docs(T-070-01-03): define cast seat-default wiring
```

The commit contains only:

- `research.md`;
- `design.md`;
- `structure.md`;
- `plan.md`.

Ticket phase/status and pre-existing Lisa-managed files were excluded.

## Red test evidence

The acceptance fixture was added before production wiring and run with:

```text
bun test src/engine/cast.test.ts --test-name-pattern "unknown requested seat"
```

Observed result:

```text
0 pass
1 fail
14 expect() calls
```

The fixture reached the real decompose effect and materializer. The baseline and degraded casts both
materialized successfully, allowing the test to reach the ledger assertion. The exact failure was:

```text
expected degradedRecord.seatDefaulted to equal
{ requested: "kodex", applied: "claude", reason: "unknown-seat" }
received undefined
```

This isolated the ticket gap at the generic cast boundary. Dependency behavior was already working;
the cast discarded the report before its append.

The warning assertion follows the record assertion, so the first red run stopped before reporting
the second expected gap. The production change closes both from the same retained report.

## Test fixture topology

`src/engine/cast.test.ts` now contains a complete addon-free `WorkPlan` fixture:

- one story with all five contract sections;
- one ticket with complete Lisa fields;
- a resolvable P4 charter definition;
- no BAML value imports;
- no live Lisa or executor process.

The fixture play is `Play<DecomposeInputs, WorkPlan>` and runs:

```text
stub Executor
  → generic castPlay
  → JSON parse
  → fixture clear gate
  → real decomposeEffect
  → real materialize
  → EffectResult.seatDefaulted
  → cast stdout + appendRunLog
```

The Lisa validator dependency is injected as a successful fixture. The stub executor returns the
serialized plan and deterministic usage/model data. This keeps the proof free and within the story's
honest boundary.

Two independent temporary projects are cast:

1. baseline inputs omit `agent`;
2. degraded inputs add `agent: "kodex"`, the semantic value supplied by `--agent kodex`.

The test verifies both complete board inventories and reads every written body. It compares the
degraded story and ticket against the baseline byte for byte and explicitly proves no `agent:` key is
present in the degraded ticket.

## Production implementation

### `src/engine/cast.ts`

Added a type-only `SeatDefaulted` import from the engine play contract.

Added optional local orchestration state beside `materialized`, `produced`, and `outcome`:

```ts
let seatDefaulted: SeatDefaulted | undefined;
```

Immediately after the effect returns, the cast retains the authoritative report:

```ts
seatDefaulted = eff.seatDefaulted;
```

The engine does not inspect `ctx.inputs`, import the concrete seat registry, or reconstruct any marker
field. Materializer/effect policy remains the source of truth.

When the marker is present, cast stdout emits:

```text
· seat defaulted — requested 'kodex'; using 'claude' (unknown-seat; proceeding, recorded)
```

The line follows the effect result, uses all three report fields, describes successful degradation,
and does not mislabel the event as an andon.

The normal end-of-cast record input conditionally includes the exact report:

```ts
...(seatDefaulted !== undefined ? { seatDefaulted } : {}),
```

The early missing-capability append remains unchanged because that path never runs an effect. No
outcome, classifier, summary, executor, or materialization behavior changed.

## Acceptance test assertions

The new test proves:

- baseline summary is `success` and materialized;
- degraded summary is `success` and materialized;
- each project contains the expected story and ticket;
- the degraded story is byte-identical to the default story;
- the degraded ticket is byte-identical to the default ticket;
- the degraded ticket contains no `agent:` key;
- the baseline run record has no own `seatDefaulted` property;
- the degraded run record remains a `success`;
- its marker exactly names `kodex`, `claude`, and `unknown-seat`;
- `reviveRecord` preserves the marker;
- captured stdout contains the exact warning line.

The stdout spy is installed only around the degraded cast and restored in a `finally` block. It does
not leak process-global state into later tests.

## Focused verification

After implementation:

```text
bun test src/engine/cast.test.ts --test-name-pattern "unknown requested seat"
1 pass
0 fail
16 expect() calls
```

Full cast test file:

```text
bun test src/engine/cast.test.ts
6 pass
0 fail
56 expect() calls
```

Typecheck:

```text
bun run build
tsc --noEmit
pass
```

## Adjacent verification

Ledger marker contract:

```text
bun test src/log/run-log.test.ts --test-name-pattern seatDefaulted
6 pass
0 fail
16 expect() calls
```

Materializer and effect dependencies:

```text
bun test src/play/materialize.test.ts src/play/decompose-effect.test.ts
36 pass
0 fail
108 expect() calls
```

Whitespace check:

```text
git diff --check
pass
```

## Full repository gate

Ran:

```text
bun run check
```

Result:

```text
BAML codegen: pass
TypeScript: pass
1622 pass
1 skip
0 fail
4909 expect() calls across 110 files
```

The single skip is the pre-existing optional compiled-`dist/` integration. The suite reports that no
local `dist/` artifacts exist and names `just release-local` as the separate exercise path. This does
not cover or block the fixture-only cast behavior in this ticket.

## Plan adherence and deviations

The implementation follows the selected design and file structure exactly.

One minor sequencing deviation: the failing test reached and failed the record assertion before the
later stdout assertion, so only the persistence half appeared in the red output. Both were deliberately
written before production code, and both pass after one shared report-forwarding change. No production
scope or public API changed as a result.

The plan considered a test-only public output-writer seam but rejected it. Bun's `spyOn` handled the
overloaded stdout method cleanly under typecheck, so no such seam was needed.

## Pure-core / impure-shell assessment

No new policy judgment was added. The pure seat-membership oracle remains in `agent-seat.ts`, and the
materializer remains the owner of default disposition. The cast is already the impure owner of stdout
and append calls; retaining and forwarding plain effect data belongs at that shell boundary.

The warning formatter remains inline beside the existing effect, andon, reduced-grounding, and settle
lines. It has no reusable decision logic that warrants a new pure public function. The acceptance test
exercises the actual impure surface.

## Scope audit

Intentionally unchanged:

- `KNOWN_SEATS` and `findUnknownSeat`;
- default seat selection;
- `SeatDefaulted` type definitions;
- run-log schema, normalization, and outcome vocabulary;
- materializer and decompose effect;
- valid `codex` stamping behavior;
- CLI parser and input assembly;
- BAML schema and generated semantic code;
- Lisa dispatch and real validation;
- collision, bare-code, graph, and story-contract refusals;
- `RunSummary` public shape;
- ticket `phase` and `status`.

## Worktree audit

The shared worktree contains pre-existing Lisa-managed changes under `.lisa/` and `docs/active/`,
including the currently untracked E-070 story/ticket files. They were present before implementation
and are not part of this ticket's commits.

The implementation commit will stage explicitly only:

- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`;
- `docs/active/work/T-070-01-03/progress.md`.

## Remaining work

1. Commit the verified implementation and Progress artifact.
2. Review the committed diff and acceptance evidence.
3. Write `review.md` with changes, coverage, limitations, and open concerns.
4. Commit the Review handoff without editing ticket frontmatter.
5. Stop for Lisa to handle transitions.
