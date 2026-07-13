# Plan — T-076-03-01

## Implementation strategy

Implement one test-first source unit in the existing doctor module. Preserve the resolver and probe
contracts and prove the default inert state before adding provisioned cases.

## Step 1 — Add reviewer acceptance tests

Modify `src/doctor/doctor-probe.test.ts`.

Add imports for the new intended check names and helpers. Add type-only fake-executor inputs.

Create a fake executor helper whose:

- `id` identifies the registry entry;
- `probe()` delegates to an injected reader;
- `dispense()` throws immediately.

Add a `probeDoctor — cross-review dispensability (T-076-03-01)` block.

### Default case

Call `crossReviewCheck("claude", undefined)` and assert:

```ts
{
  name: "cross-review: not provisioned — casts skip review",
  ok: true,
}
```

This test pins the exact story wording and proves default resolution remains inert.

### Provisioned reachable case

Build a two-seat registry with:

- Claude author fixture;
- OpenAI-compatible reviewer fixture;
- reviewer probe returning `{ ok: true }`;
- counters for author construction, reviewer construction, reviewer probe, and dispense.

Assert:

- the check is `cross-review reviewer dispensable: codex`;
- it is green;
- reviewer is constructed once;
- reviewer probe is called once;
- author factory is not called;
- dispense is never called because it throws if reached.

### Provisioned unreachable case

Use the same registry shape with reviewer probe returning:

```ts
{
  ok: false,
  reason: "review endpoint refused connection",
  hint: "start or configure the reviewer endpoint",
}
```

Assert:

- name contains the authoritative reviewer seat `codex`;
- check is red;
- hint contains the reason;
- hint contains the repair text.

### Pure fallback case

Call `reviewerDispensableCheck("codex", { ok: false })`. Assert non-empty actionable fallback
mentions the Codex reviewer configuration/authentication/reachability.

### Initial verification

Run:

```sh
bun test src/doctor/doctor-probe.test.ts
```

Expected before production edits: compile/import failures establish the new surface is absent.

## Step 2 — Implement canonical reviewer resolution and probe

Modify `src/doctor/doctor-probe.ts`.

Add canonical imports from:

- `cross-review/resolve-complement.ts`;
- `engine/cast-core.ts`;
- type-only `ExecutorRegistry` from the selector.

Add exact inert and reviewer dispensability constants.

Extend `DoctorProbeDeps` and `DEFAULT_PROBE_DEPS` with
`crossReviewRegistry: ExecutorRegistry | undefined`.

Refactor the existing active result mapping through a private shared formatter without changing its
observable name, detail joining, or fallback.

Add `reviewerDispensableCheck`.

Add `crossReviewCheck(activeExecutorId, registry)`:

1. project active id to author seat;
2. resolve canonical complement;
3. return inert passed check on `null`;
4. call the returned executor's `probe()`;
5. return seat-named result check.

### Focused verification

Run:

```sh
bun test src/doctor/doctor-probe.test.ts
```

Expected: new behavior tests pass; existing fixed count expectations fail until Step 3.

## Step 3 — Compose the sixth doctor check

Modify `probeDoctor` in `src/doctor/doctor-probe.ts`.

Append a `safeCheck` callback for `crossReviewCheck` after active executor dispensability.

Update source documentation to describe:

- reviewer configuration/resolution;
- six-check order;
- exact inert default;
- shared unmetered probe;
- no dispense.

Modify fixed expectations in `src/doctor/doctor-probe.test.ts`:

- five becomes six in all fixed result counts;
- all-green test asserts the exact inert sixth line;
- missing dependency cases confirm the inert reviewer check remains green;
- guarded-live test includes the exact inert line;
- comments and names match six checks.

### Focused verification

Run:

```sh
bun test src/doctor/doctor-probe.test.ts
```

Expected: all doctor probe tests pass.

## Step 4 — Prove failure containment

Add a `probeDoctor` test using a provisioned registry whose reviewer `probe()` throws.

Inject successful existing PATH/BAML/primary-probe facts.

Assert:

- `probeDoctor` resolves with six checks;
- reviewer result is red rather than a rejection;
- its generic check name is `CROSS_REVIEW_DISPENSABLE_CHECK`;
- its hint contains the thrown message;
- unrelated primary checks remain green.

This pins the existing never-throw contract across the new resolver/probe effect.

### Focused verification

Run:

```sh
bun test src/doctor/doctor-probe.test.ts src/doctor/preflight.test.ts
```

Expected: doctor probe and composed renderer/preflight remain green.

## Step 5 — Validate resolver reuse and neighboring behavior

Run:

```sh
bun test \
  src/doctor/doctor-probe.test.ts \
  src/doctor/preflight.test.ts \
  src/cross-review/resolve-complement.test.ts
```

Verification criteria:

- default canonical resolver remains inert;
- explicit two-seat resolver behavior remains unchanged;
- doctor default line is visible and green;
- reviewer reachability changes overall verdict only when provisioned;
- no concrete transport or metered call is needed.

Inspect the diff:

```sh
git diff -- src/doctor/doctor-probe.ts src/doctor/doctor-probe.test.ts
git diff --check -- src/doctor/doctor-probe.ts src/doctor/doctor-probe.test.ts
```

Confirm no ticket-owned path outside these two files changed.

## Step 6 — Run the full repository gate

Run:

```sh
bun run check
```

The gate includes BAML code generation, TypeScript build, and the full test suite.

If generated output changes unexpectedly, inspect it and do not include unrelated generated changes
unless the ticket actually owns them. Expected result is no generated source delta.

Acceptance mapping:

- Default config visible and green: exact default and all-green tests.
- Provisioned reachable green: explicit two-seat reachable test.
- Provisioned unreachable red and actionable: explicit two-seat failure test.
- Names reviewer seat: exact Codex seat assertion.
- Existing probe injection: fake reviewer's required `probe()`.
- Canonical resolution reuse: direct `resolveComplementExecutor` production call plus neighbor tests.
- No new probe mechanism: only `Executor.probe()`; dispense trap.
- Full health: `bun run check`.

## Step 7 — Commit the source unit

Only after focused and full checks pass, run:

```sh
lisa commit-ticket T-076-03-01 \
  --message "feat(doctor): probe configured reviewer dispensability" \
  --include src/doctor/doctor-probe.ts \
  --include src/doctor/doctor-probe.test.ts
```

Do not use `git add`, `git commit`, or broad include paths.

After the command:

- inspect `git status --short`;
- confirm both ticket-owned source files are clean;
- preserve Lisa-owned provenance/ticket modifications;
- record the commit id in `progress.md`.

## Step 8 — Review

Write `review.md` in the attempt-private work directory.

Include:

- outcome against every acceptance criterion;
- exact source files modified;
- resolver and probe reuse explanation;
- default/provisioned behavior matrix;
- test commands and results;
- full gate result;
- commit id;
- open concerns and honest boundary.

Do not modify ticket frontmatter or publish artifacts into `docs/active/work`.

## Deviation policy

Document a deviation in `progress.md` before proceeding if:

- tests show the reviewer registry must be threaded through an additional doctor-owned file;
- TypeScript requires a narrower dependency representation;
- a preflight test becomes host-dependent;
- the full gate reveals an existing count assumption elsewhere;
- concurrent work touches either ticket-owned source path.

Do not expand into cast orchestration, provisioning UI, resolver algorithm changes, or transport
changes without a new ticket contract.

## Expected commit topology

One meaningful ticket-owned source commit is expected. The production behavior and its direct tests
are one inseparable unit; committing intentionally failing tests separately would violate the
repository's green-commit gate.

