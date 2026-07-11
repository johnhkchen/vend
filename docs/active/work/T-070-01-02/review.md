# T-070-01-02 — Review

## Outcome

Acceptance is met. An unknown Lisa routing seat now degrades to the normal no-agent mint rather
than refusing the materialization. The complete board lands, every ticket is byte-identical to a
default mint, and the materializer/effect return a structured requested-vs-applied report. A valid
`codex` request still stamps every ticket. The effect no longer throws `UnknownSeatError` or
produces the `unknown-seat` outcome.

Implementation commit:

```text
4ef7c6a fix(play): default unknown materialize seats (T-070-01-02)
```

## Production changes

### `src/engine/play.ts`

- Added exported `SeatDefaulted`.
- The report carries raw `requested`, applied literal `claude`, and stable `reason`.
- Added optional `EffectResult.seatDefaulted`.
- The optional field leaves every unrelated play source-compatible.
- The contract describes successful degradation rather than a failure outcome.

### `src/play/materialize.ts`

- Removed `UnknownSeatError` entirely.
- Retained `findUnknownSeat` as the canonical membership decision.
- Added a locally named Lisa default, checked against `AgentSeat` at compile time.
- Preserved the literal `claude` type with `as const satisfies AgentSeat`.
- Separated the raw requested agent from the effective renderer agent.
- Omitted the effective agent for unknown requests.
- Reused the existing no-agent renderer branch without modifying renderer output.
- Returned optional `seatDefaulted` only when a fallback occurred.
- Kept omitted and known-seat result shapes free of an explicit undefined field.
- Updated guard documentation: collision and bare-code remain refusals; seat is disposition.

### `src/play/decompose-effect.ts`

- Removed the `UnknownSeatError` import and catch arm.
- Read `seatDefaulted` from `MaterializeResult`.
- Forwarded the report on the returned `EffectResult`.
- Kept Lisa validation after materialization.
- Kept `IdCollisionError` → `id-collision` unchanged.
- Kept `BareCodeError` → `bare-code` unchanged.
- Kept unexpected exception propagation unchanged.

## Test changes

### `src/play/materialize.test.ts`

- Removed assertions for the retired error.
- The valid `codex` test still writes two tickets and proves one exact stamp per ticket.
- It now also proves no false `seatDefaulted` report is returned.
- The new unknown-seat test creates two independent target roots.
- It mints the same plan once with no agent and once with `kodex`.
- It proves the degraded output contains one story and both tickets.
- It compares the story body byte-for-byte with the baseline.
- It compares both ticket bodies byte-for-byte with the baseline.
- It explicitly proves neither degraded ticket contains an `agent:` key.
- It proves the exact report:

```ts
{
  requested: "kodex",
  applied: "claude",
  reason: "unknown-seat",
}
```

### `src/play/decompose-effect.test.ts`

- The existing production-adapter `codex` proof remains.
- It now proves the known-seat path has no degradation report.
- The former unknown-seat refusal fixture is now a degraded success fixture.
- Raw `kodex` still travels through `contextSourcesForRun` and `assembleInputs`.
- The real effect writes the story and ticket.
- The validator stub is called exactly once.
- The effect returns `ok:true`.
- The effect returns no outcome, so it does not produce `unknown-seat`.
- The effect returns two artifacts for the one-story/one-ticket plan.
- The effect returns the exact marker above.
- A separate no-agent project is materialized through the same real effect.
- Story and ticket bytes compare exactly across degraded and default runs.
- The degraded ticket explicitly has no `agent:` key.

## Acceptance assessment

| Criterion | Result | Evidence |
|---|---|---|
| fixture plan uses unknown `agent: 'kodex'` | met | both new regression tests use the exact spelling |
| materializes every ticket | met | direct test writes two; effect test reports full artifacts |
| no ticket has `agent:` | met | explicit absence assertions on all degraded tickets |
| byte-identical to default mint | met | paired-root exact `toBe` comparisons for every file |
| returns `ok:true` | met | real effect + successful stub validator assertion |
| reports requested seat | met | exact `requested: "kodex"` assertion |
| reports applied default | met | exact `applied: "claude"` assertion |
| report travels via `EffectResult` | met | effect result exact-object assertion |
| no `UnknownSeatError` thrown | met | class/throw/catch removed; direct materialization completes |
| no `unknown-seat` outcome produced | met | catch arm removed; effect outcome is undefined |
| valid `codex` still stamps | met | existing multi-ticket and effect tests remain green |
| green under `bun test` | met | focused and full suite evidence below |

## Verification evidence

Focused ticket tests:

```text
bun test src/play/materialize.test.ts src/play/decompose-effect.test.ts
36 pass
0 fail
108 expect() calls
```

Sibling marker compatibility check after T-070-01-01 landed concurrently:

```text
bun test src/log/run-log.test.ts --test-name-pattern seatDefaulted
6 pass
0 fail
16 expect() calls
```

Repository gate:

```text
bun run check
BAML codegen: pass
TypeScript: pass
full tests: 1621 pass, 1 skip, 0 fail
4893 expect() calls across 110 files
```

The skipped test is the pre-existing optional compiled-dist integration. It names its reason: no
local `dist/` artifacts; `just release-local` exercises it. This is not a ticket failure.

`git diff --check` also passed before commit.

## Pure-core / impure-shell assessment

The existing boundary remains intact. Seat membership is still decided by the pure
`findUnknownSeat` oracle. Ticket rendering remains pure. `materialize` composes that decision with
filesystem reads and writes and returns plain data. The effect forwards the data across the generic
engine contract. Tests use real temporary files at the impure boundary and exact byte assertions;
no metered executor or BAML runtime is loaded.

## Compatibility

- No-agent ticket bytes are unchanged.
- Known-seat ticket bytes are unchanged.
- Story bytes are unchanged.
- Unrelated `EffectResult` producers need no edits because the new field is optional.
- The `unknown-seat` literal remains in `RUN_OUTCOMES` for historical ledger reads.
- This ticket only stops the decompose effect from producing that outcome.
- The marker is structurally compatible with T-070-01-01's ledger schema.
- Its reason code was aligned to the sibling's canonical `unknown-seat` fixture.

## Scope audit

Intentionally unchanged:

- `src/play/agent-seat.ts` and the `KNOWN_SEATS` vocabulary;
- `src/log/run-log.ts`, owned by T-070-01-01;
- `src/engine/cast.ts`, owned by T-070-01-03;
- CLI parsing and source assembly;
- BAML schema and generated semantic inputs;
- Lisa dispatch behavior;
- per-ticket routing overrides;
- structural graph, collision, bare-code, and validation behavior;
- ticket `phase` and `status` frontmatter.

## Concurrency notes

The worktree contained Lisa-managed board changes before implementation. T-070-01-01 also edited
run-log files concurrently, as permitted by the story DAG. This ticket staged and committed only
its five production/test files and Research-through-Progress artifacts. The sibling edits were
excluded from `4ef7c6a`.

The first full-gate attempt encountered the sibling tests before the sibling implementation had
finished writing. After its schema edit completed, the focused run-log tests and the full gate both
passed. This is recorded because the transient red result was coordination state, not suppressed
evidence.

## Open concerns and honest boundary

- This ticket reports the degradation but does not persist it to the run record or print a warning.
  T-070-01-03 owns that fan-in and depends on this ticket plus T-070-01-01.
- The default is represented on disk by key absence. The reported applied value is `claude`, matching
  the current Lisa default named by the epic. A future Lisa default change must update this reporting
  constant and its tests or provenance would become dishonest.
- The shared engine type narrows `applied` to `"claude"`, while the ledger schema accepts any string
  because the append-only sink does not own seat policy. Structural assignment from this report to
  the ledger is valid.
- A validator failure after a degraded write still returns the marker with `ok:false`; this is
  intentional because the files and disposition already occurred. This ticket did not add a
  dedicated test for that combination; existing validator-failure semantics were unchanged.
- No live metered cast was run, per the story's honest boundary. All evidence is fixture-based,
  deterministic, and token-free.

## Reviewer guidance

The highest-leverage review points are:

1. Confirm omission, rather than `agent: claude`, is the intended Lisa-default representation.
2. Confirm the `SeatDefaulted` shape matches the sibling ledger marker and later cast wiring.
3. Confirm historical `unknown-seat` outcome vocabulary remains intentionally readable.
4. Confirm T-070-01-03 forwards `EffectResult.seatDefaulted` without re-deriving seat policy.

No critical issue blocks handoff. The ticket is ready for Lisa-managed transition.
