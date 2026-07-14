# Review — T-070-01-03: cast records and warns on seat default

## Outcome

Acceptance is met. Casting a complete decompose-shaped board plan with the raw requested seat
`kodex` now preserves the materializer/effect's successful fallback report through the generic cast
boundary. The full board lands with default-mint bytes, the run record carries requested/applied/reason
provenance, and stdout emits a requested-versus-default warning. The run remains a successful clear;
no `unknown-seat` refusal is produced.

Implementation commit:

```text
4f4fce8 feat(engine): record seat-default disposition (T-070-01-03)
```

Pre-implementation phase commit:

```text
0b8e2ea docs(T-070-01-03): define cast seat-default wiring
```

## Production changes

### `src/engine/cast.ts`

The cast loop now imports `SeatDefaulted` as a type from the generic engine play contract. There is no
runtime import and no concrete play dependency.

The effect result's optional marker is retained in local orchestration state:

```ts
let seatDefaulted: SeatDefaulted | undefined;
```

After the effect returns, the cast copies the exact authoritative value:

```ts
seatDefaulted = eff.seatDefaulted;
```

The engine does not inspect the play input for an `agent` field, does not import `KNOWN_SEATS`, and
does not re-derive the fallback. The materializer remains the policy owner; the effect remains the
reporting seam; the cast only surfaces and persists the report.

When present, stdout emits:

```text
· seat defaulted — requested 'kodex'; using 'claude' (unknown-seat; proceeding, recorded)
```

The line is a degradation note, not an andon. It names the raw request, actual default, stable reason,
and the fact that execution proceeds with durable provenance.

The normal end-of-cast `appendRunLog` input conditionally forwards the exact marker:

```ts
...(seatDefaulted !== undefined ? { seatDefaulted } : {}),
```

An absent marker adds no key. The early missing-capability append is unchanged because that path does
not run an effect and therefore cannot apply a seat default.

No classifier, outcome, materialization, model, usage, budget, timestamp, produced-reference, or
summary behavior changed.

## Test changes

### `src/engine/cast.test.ts`

Added a complete addon-free `WorkPlan` fixture with:

- one contract-complete story;
- one Lisa-complete ticket;
- one resolvable P4 charter citation;
- type-only generated BAML enum/contracts;
- unique ids within isolated temporary project roots.

Added a decompose-shaped `Play<DecomposeInputs, WorkPlan>` fixture. Its execution path is:

```text
stub Executor
  → castPlay render/dispense/parse/gate
  → real decomposeEffect
  → real materialize
  → EffectResult.seatDefaulted
  → cast warning
  → real appendRunLog / reviveRecord
```

The model executor is the existing deterministic stub. Lisa validation is injected as a successful
fixture function. No BAML value import, external Lisa process, network request, token spend, or live
model invocation occurs.

The acceptance test performs two casts into independent roots:

1. no agent, producing the default baseline;
2. `agent: "kodex"`, representing the semantic input supplied by `--agent kodex`.

It verifies:

- both summaries have outcome `success`;
- both summaries report `materialized: true`;
- both roots contain exactly the expected story and ticket;
- degraded story bytes equal baseline story bytes;
- degraded ticket bytes equal baseline ticket bytes;
- the degraded ticket contains no `agent:` key;
- the baseline run record omits `seatDefaulted`;
- the degraded run record stays `success`;
- its marker is exactly:

```ts
{
  requested: "kodex",
  applied: "claude",
  reason: "unknown-seat",
}
```

- `reviveRecord` preserves that marker;
- captured cast stdout contains the exact warning line.

The stdout spy covers only the degraded cast and is restored in a `finally` block, preventing leaked
process-global test state.

## Red/green evidence

Before the production change, the new acceptance test drove both casts through real materialization
and failed at the first missing cast-boundary assertion:

```text
expected degradedRecord.seatDefaulted to equal the marker
received undefined

0 pass
1 fail
14 expect() calls
```

After implementation:

```text
bun test src/engine/cast.test.ts --test-name-pattern "unknown requested seat"
1 pass
0 fail
16 expect() calls
```

The red run proves the new test was not merely restating dependency behavior. Materialization already
worked; cast persistence and visibility were the missing link.

## Acceptance assessment

| Criterion | Result | Evidence |
|---|---|---|
| cast through a stub executor | met | injected `Executor` drives `castPlay` |
| raw requested seat is `kodex` | met | degraded `DecomposeInputs.agent` fixture |
| full board materializes | met | exact story/ticket inventories in temp root |
| board matches default mint | met | full-body story and ticket equality |
| no explicit seat on degraded ticket | met | `agent:` absence assertion |
| cast remains successful | met | summary and record outcome assertions |
| marker reaches run record | met | exact JSONL object assertion |
| requested raw value retained | met | `requested: "kodex"` assertion |
| applied default retained | met | `applied: "claude"` assertion |
| reason retained | met | `reason: "unknown-seat"` assertion |
| marker survives read boundary | met | `reviveRecord` assertion |
| stdout warns requested vs default | met | exact captured line assertion |
| `bun run check` green | met | 1,622 pass, zero fail |

## Verification evidence

Focused cast test file:

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

Sibling ledger marker suite:

```text
bun test src/log/run-log.test.ts --test-name-pattern seatDefaulted
6 pass
0 fail
16 expect() calls
```

Sibling materializer/effect suites:

```text
bun test src/play/materialize.test.ts src/play/decompose-effect.test.ts
36 pass
0 fail
108 expect() calls
```

Repository gate:

```text
bun run check
BAML codegen: pass
TypeScript: pass
1622 pass
1 skip
0 fail
4909 expect() calls across 110 files
```

`git diff --check` passed before the implementation commit.

The single skipped test is pre-existing and optional: the compiled-`dist/` integration reports no
local `dist/` artifacts and points to `just release-local`. It is unrelated to the source-level,
fixture-only cast seam covered here.

## Coverage assessment

Coverage is strong for the ticket contract:

- generic executor injection is exercised;
- real effect and materializer are exercised;
- the full filesystem result is observed;
- exact compatibility bytes are compared;
- live stdout is observed;
- raw JSONL is observed;
- normalized/revived JSONL is observed;
- marker absence on the baseline is observed;
- terminal success is observed.

Dependency suites separately retain coverage for:

- known `codex` seat stamping;
- multi-ticket uniform stamping;
- unknown-seat multi-ticket byte identity;
- materializer marker construction;
- effect marker forwarding;
- run-log normalization and malformed metadata;
- legacy ledger reads.

No new pure unit test was added because this ticket introduces no new decision function. The only new
logic is impure-shell forwarding and an output line, and the integration test exercises both actual
surfaces.

## Pure-core / impure-shell assessment

The existing boundary is preserved.

- Pure seat membership remains in `src/play/agent-seat.ts`.
- The materializer owns default application.
- The effect forwards plain report data.
- The cast already owns stdout and the single append-only ledger write.
- The log module remains the normalization/read boundary.

The engine has no downward import into `src/play/`. `SeatDefaulted` is imported type-only from the
engine-owned play contract. No filesystem, clock, executor, or stdout responsibility moved into a
pure module.

## Compatibility

- Omitted-seat cast output is unchanged.
- Known-seat materialization is unchanged.
- Ordinary run records omit `seatDefaulted`.
- Historical records remain readable.
- `unknown-seat` remains in `RUN_OUTCOMES` for backward compatibility.
- New unknown-seat casts do not produce that terminal outcome.
- `RunSummary` is unchanged.
- Other effects remain source-compatible because the report is optional.
- Early andon paths are unchanged.
- Existing reduced-grounding and over-envelope warnings are unchanged.

## Scope audit

Intentionally unchanged:

- `src/play/agent-seat.ts` and the seat vocabulary;
- `src/play/materialize.ts` and rendering bytes;
- `src/play/decompose-effect.ts` and validation behavior;
- `src/engine/play.ts` contracts;
- `src/log/run-log.ts` schema and normalization;
- CLI parsing and source assembly;
- BAML schema and generated semantic inputs;
- Lisa dispatch;
- per-ticket routing overrides;
- graph, contract, collision, and bare-code refusals;
- ticket phase/status frontmatter.

## Honest boundary

All evidence is fixture-proven and free. The stub executor proves the generic cast orchestration, and
the test uses the real effect, materializer, ledger append, and ledger revive boundaries. It does not
run the real BAML-rendered decompose play, a live model executor, or an external Lisa validation
process. This is the boundary explicitly set by `S-070-01`.

The test supplies `agent: "kodex"` at the typed cast input, which is the semantic value produced by
the already-covered `--agent kodex` CLI/source-adapter path. It does not spawn the CLI because the
executor injection seam lives at `castPlay`, and a subprocess CLI would lose that stub.

## Open concerns and limitations

No critical issue remains.

Minor test-mechanics limitation: stdout is process-global. The spy is deliberately narrow and always
restored in `finally`; the full suite passes, providing evidence against leakage. If future Bun test
execution makes same-process tests concurrent by default, output capture may merit a first-class local
writer seam, but adding that public surface is not warranted now.

The warning says “recorded” immediately before the append completes. This matches the existing
reduced-grounding wording and normal cast behavior: an append failure propagates as a real run failure
rather than returning a false success. No silent success can occur without the record.

## Worktree and commit audit

The repository had Lisa-managed changes before this ticket under `.lisa/` and `docs/active/`, plus
untracked E-069/E-070 board files. They were excluded from both ticket commits. The ticket file's phase
and status were not modified by this work.

Files changed by the implementation commit:

- `src/engine/cast.ts`;
- `src/engine/cast.test.ts`;
- `docs/active/work/T-070-01-03/progress.md`.

Workflow artifacts are complete through Review. Acceptance is green, no human-attention issue is
flagged, and Lisa can perform the remaining phase/status transition.
