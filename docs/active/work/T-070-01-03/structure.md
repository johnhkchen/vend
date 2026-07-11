# Structure — T-070-01-03: cast records and warns on seat default

## Change inventory

Modify:

- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

Create workflow artifacts:

- `docs/active/work/T-070-01-03/research.md`
- `docs/active/work/T-070-01-03/design.md`
- `docs/active/work/T-070-01-03/structure.md`
- `docs/active/work/T-070-01-03/plan.md`
- `docs/active/work/T-070-01-03/progress.md`
- `docs/active/work/T-070-01-03/review.md`

Delete nothing.

Do not modify:

- ticket frontmatter;
- `src/log/run-log.ts` or its tests;
- `src/engine/play.ts`;
- `src/play/materialize.ts`;
- `src/play/decompose-effect.ts`;
- `src/play/agent-seat.ts`;
- BAML schema or generated clients;
- CLI argument handling;
- Lisa validation or dispatch behavior.

## Architecture boundary

The established dependency flow remains:

```text
concrete decompose effect
  └─ returns engine-owned EffectResult.seatDefaulted
       └─ generic cast shell
            ├─ writes stdout
            └─ passes structurally compatible data to log-owned RunRecordInput
                 └─ append-only JSONL record
```

`src/engine/cast.ts` continues to import only engine-adjacent contracts, executor, budget, and log
modules. It must not import `materialize`, `decomposeEffect`, `agent-seat`, or another concrete play.

The integration test may import the concrete addon-free `decomposeEffect` because its job is to prove
the cross-layer path. All generated BAML imports in the test remain type-only.

## `src/engine/cast.ts`

### Existing effect locals

The effect section currently declares:

```ts
let materialized = false;
let produced: string | undefined;
let outcome: RunOutcome = verdict.outcome;
```

Add one optional local for the report. Prefer a type-only `SeatDefaulted` import from `./play.ts`:

```ts
import type { CastContext, GateVerdict, Play, SeatDefaulted } from "./play.ts";
```

Then declare:

```ts
let seatDefaulted: SeatDefaulted | undefined;
```

This is local orchestration state, parallel to `produced` and `outcome`. The import erases at runtime.

### Effect assignment

Inside the existing `if (verdict.materialize && output !== null)` block, immediately after the effect
returns, retain its optional report:

```ts
const eff = await play.effect(output, ctx);
seatDefaulted = eff.seatDefaulted;
```

Do not reconstruct the object. Do not inspect `ctx.inputs.agent`. Do not call the seat registry.
Do not change `materialized`, `produced`, or outcome semantics.

### Warning output

After the effect/andon block, add a marker-presence branch:

```ts
if (seatDefaulted !== undefined) {
  process.stdout.write(
    `· seat defaulted — requested '${seatDefaulted.requested}'; using '${seatDefaulted.applied}' ` +
      `(${seatDefaulted.reason}; proceeding, recorded)\n`,
  );
}
```

This location has these properties:

- it can only execute after an effect returned a report;
- it cannot execute on timeout, gate stop, missing capability, or pre-effect budget discard;
- it follows the normal effect status line;
- it remains independent from the later over-envelope and reduced-grounding notes;
- it is visible before the ledger append.

Use the report fields directly. Quoting prevents ambiguous raw values in the human-readable line.
No helper or public API is introduced.

### Run-record forwarding

In the normal `appendRunLog` input, add the marker near other degradation/warning metadata:

```ts
...(seatDefaulted !== undefined ? { seatDefaulted } : {}),
```

Document that this is the effect's authoritative disposition report and that absence keeps ordinary
records byte-compatible. Do not add the field to the missing-capability early append.

### Returned summary

Leave `RunSummary` unchanged. The ticket's durable provenance surface is the run log, while the live
surface is stdout. Adding the marker to the summary is outside acceptance and would widen public API.

## `src/engine/cast.test.ts`

### Imports

Extend the Bun test import if stdout capture uses `spyOn`:

```ts
import { afterEach, expect, spyOn, test } from "bun:test";
```

Add filesystem `readdir` if the full board inventory is asserted.

Add type-only generated contracts:

```ts
import type {
  DraftPhase,
  DraftPriority,
  DraftStatus,
  DraftType,
  WorkPlan,
} from "../../baml_client/index.ts";
```

Add:

```ts
import { decomposeEffect } from "../play/decompose-effect.ts";
import type { DecomposeInputs } from "../play/project-context.ts";
```

No generated value import is allowed.

### Complete plan fixture

Define one `WorkPlan` plain object local to this test file. Use unique fixture ids such as:

- story `S-070-99`;
- ticket `T-070-99-01`.

The story includes all five contract fields required by rendering:

- scope;
- story acceptance;
- honest boundary;
- wave rationale;
- out of slice.

The ticket includes all required Lisa frontmatter and prose fields. Its `advances` code must be
present in the fixture charter, for example P4. Use enum member strings cast to type-only generated
enum types, matching `materialize.test.ts` and `decompose-effect.test.ts`.

### Fixture charter and inputs

Define a minimal charter with a resolvable P4 definition:

```text
- **P4 — Autonomy by default, not supervision.** Work proceeds against gates.
```

Create baseline inputs:

```ts
{
  epic: "E-070 fixture",
  charter: FIXTURE_CHARTER,
  project: "fixture project",
}
```

Create degraded inputs by spreading the baseline and adding `agent: "kodex"`. This mirrors the
semantic result of the `--agent kodex` source adapter without loading CLI or BAML code.

### Decompose-shaped play fixture

Add a function returning `Play<DecomposeInputs, WorkPlan>`:

- `render` returns stable fixture text;
- `parse` JSON-parses the stub's returned plan;
- `gates` returns clear with one named gate;
- `effect` calls the real `decomposeEffect`;
- the validator dependency returns `{ ok: true, output: "" }`;
- budget is `BIG_BUDGET`;
- card is a test fixture card;
- tools are absent, so reduced-grounding does not add unrelated output.

This fixture exercises:

```text
stub executor → parse → gate → real decompose effect → real materialize
             → EffectResult.seatDefaulted → generic cast stdout + JSONL
```

It does not load the BAML native addon and does not execute Lisa.

### Stdout capture helper

Capture only the degraded cast. Structure the code so restoration is unconditional:

```ts
const stdout: string[] = [];
const write = spyOn(process.stdout, "write").mockImplementation((chunk) => {
  stdout.push(String(chunk));
  return true;
});
try {
  // degraded cast
} finally {
  write.mockRestore();
}
```

If the Node overload types require more parameters, accept a broad argument list in the mock or cast
the mock implementation locally. Do not leave stdout mocked across filesystem reads or later tests.

### Acceptance test sequence

1. Create two temp roots via the existing `tmp()` helper.
2. Define separate run-log paths.
3. Serialize the same complete plan once.
4. Cast the baseline with no agent through a stub executor.
5. Install stdout capture.
6. Cast the degraded inputs with `agent: "kodex"` through another stub executor.
7. Restore stdout in `finally`.
8. Assert both summaries are successful and materialized.
9. Assert the expected story/ticket inventories exist in both roots.
10. Read both story bodies and compare exact bytes.
11. Read both ticket bodies and compare exact bytes.
12. Assert the degraded ticket has no `agent:` line.
13. Read and parse the degraded run record.
14. Assert exact marker and successful outcome.
15. Revive the record and assert the marker survives.
16. Join captured stdout and assert the exact warning line.

### Negative compatibility evidence

The existing first stub-executor test already reads an ordinary record. Extend it with:

```ts
expect(rec.seatDefaulted).toBeUndefined();
```

or rely on the baseline record inside the new acceptance test and explicitly assert the property is
absent there. The latter keeps all seat assertions together and proves default casts do not gain a
false marker.

## Test boundaries

The new test is an integration test despite residing under `src/engine`:

- real temporary filesystem;
- real generic cast shell;
- real decompose effect;
- real materializer;
- real run-log append and revive;
- stub model executor;
- stub Lisa validator;
- no network, tokens, BAML call, or external process.

This is proportionate to the acceptance criterion and the story's honest boundary.

## Commit structure

The workflow requires incremental commits. Use two meaningful units:

1. Research, Design, Structure, and Plan artifacts.
2. Production cast forwarding, acceptance test, and Progress artifact after focused/full verification.

Write Review after the implementation commit and commit the handoff artifact separately. Stage files
explicitly because the shared worktree contains unrelated Lisa-generated changes.

## Verification structure

Focused:

```bash
bun test src/engine/cast.test.ts
```

Repository gate:

```bash
bun run check
```

Hygiene:

```bash
git diff --check
git status --short
git diff -- src/engine/cast.ts src/engine/cast.test.ts docs/active/work/T-070-01-03
```

Review the staged diff before each commit. Do not stage existing board/provenance changes.
