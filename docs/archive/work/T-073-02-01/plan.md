# T-073-02-01 — Plan

## Step 1 — Add pure settlement policy

Modify `src/engine/cast-core.ts`.

- Declare the stable cross-review gate name.
- Add a pure function accepting the initial cast verdict and optional durable review verdict.
- Return the initial verdict unchanged when review is absent.
- Append a passed row for pass.
- Force `gate-failed` and append a detailed failed row for fail.
- Preserve `materialize`, prior gate rows, and optional over-envelope warning.

Verification:

- TypeScript accepts the run-log type-only dependency.
- Function performs no I/O and mutates no inputs.

## Step 2 — Pin the settlement truth table

Modify `src/engine/cast-core.test.ts`.

- Test inert absence by identity/equality.
- Test pass with a base success verdict.
- Test fail with a base success/materialized verdict.
- Include existing gate rows to verify append order.
- Assert failed reason becomes durable gate detail.

Verification:

```text
bun test src/engine/cast-core.test.ts
```

## Step 3 — Compose review into the cast shell

Modify `src/engine/cast.ts`.

- Import diff reading, complement resolution, review dispense, registry type, and durable verdict.
- Add optional registry injection to `CastOptions`.
- Preserve initial classify result for effect authorization.
- After a successful effect yields a captured diff, resolve the complement.
- Read the patch relative to `projectRoot`.
- Build deterministic review context from the authored play/gate data.
- Dispense the review within the existing cast timeout.
- Map pass/fail into durable cross-vendor shape.
- Apply pure settlement after the effect block.
- Use settled outcome and gate rows in stdout/log/summary.
- Conditionally attach the nested verdict to the ledger.

Verification:

- No complement and no diff branches avoid filesystem/reviewer calls.
- Existing effect and warning semantics remain intact.
- Final summary and ledger share one final outcome value.

## Step 4 — Add cast-path acceptance tests

Modify `src/engine/cast.test.ts`.

- Create temp Git repositories for each case.
- Use `boardPlanPlay` to land real diff-producing artifacts.
- Inject an author executor with id `claude`.
- Inject registry factories for claude and openai-compat reviewer stubs.
- Prime reviewer to fail, then assert:
  - reviewer receives patch and rubric;
  - summary is `gate-failed`, not success;
  - materialized remains the honest true effect fact;
  - ledger is `gate-failed`;
  - ledger carries both seats, fail, and reason detail;
  - failed cross-review gate row exists.
- Prime reviewer to pass, then assert success and attached passed evidence.
- Supply a one-seat registry, then assert success unchanged and no verdict/review row.

Verification:

```text
bun test src/engine/cast.test.ts
```

## Step 5 — Focused quality checks

Run:

```text
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
bun run build
git diff --check -- src/engine/cast-core.ts src/engine/cast-core.test.ts src/engine/cast.ts src/engine/cast.test.ts
```

If a check exposes a sequencing or type issue, update `progress.md` with the deviation before
changing the design.

## Step 6 — Full gate

Run the repository's required gate:

```text
bun run check
```

Acceptance requires BAML generation, typecheck, and the full suite green.

## Step 7 — Commit ticket-owned source

Use only:

```text
lisa commit-ticket \
  --ticket-id T-073-02-01 \
  --message "feat(engine): enforce cross-review settlement gate" \
  --include src/engine/cast-core.ts \
  --include src/engine/cast-core.test.ts \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

Do not stage or commit Lisa-owned ticket/provenance changes. Confirm ticket-owned paths are clean.

## Step 8 — Progress artifact

Write `progress.md` in the attempt-private directory with:

- steps completed;
- source commit hash;
- focused/full check results;
- any deviations and their rationale;
- repository hygiene status.

## Step 9 — Review artifact

Write `review.md` in the attempt-private directory.

- Evaluate every acceptance branch.
- Explain post-effect settlement and honest materialization semantics.
- List modified files and tests.
- Record the full gate result.
- Surface limitations: no rollback, no live vendor proof, no review-cost accounting.
- Stop on this ticket after the artifact is complete.

## Completion criteria

- Refusing stub review produces `gate-failed` in summary and ledger.
- Refusing run does not settle as success.
- Passing stub review settles success with verdict and passed gate row attached.
- One-seat cast remains review-inert and clears unchanged.
- No human approval is introduced.
- Ticket-owned source is committed through Lisa with exact include paths.
- `bun run check` is green.
- All six attempt-private artifacts exist.
