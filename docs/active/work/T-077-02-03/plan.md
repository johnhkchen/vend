# Plan — T-077-02-03 advances-cite-degrades

## Implementation objective

Land a charter-aware, pure `advances` normalization path that strips editorial dangling codes before
the decompose plan reaches either gates or effect. Preserve the value refusal for empty survivors and
the bounds refusal for direct unnormalized callers.

## Guardrails

- Work only in the files named by `structure.md`.
- Do not edit sibling `T-077-02-02` materialization files.
- Do not edit ticket phase/status or shared `docs/active/work` artifacts.
- Do not stage Lisa-managed dirty files.
- Use `apply_patch` for all source and attempt-artifact edits.
- Use no ordinary `git add` or `git commit`.
- Run `bun run check` before each ticket source commit.
- Commit through `lisa commit-ticket` with exact include paths.
- Stop after review artifacts and disposition are written.

## Step 1 — make parse context-capable

### Files

- `src/engine/play.ts`
- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

### Actions

1. Update `Play.parse` to accept `CastContext<I>` as its second parameter.
2. Expand the callback documentation to include deterministic input-aware normalization.
3. Pass the already-built `ctx` from `castPlay` into `play.parse`.
4. Keep context construction and all execution/meter/gate ordering unchanged.
5. Extend the existing echo fixture with an optional parse-context capture sink.
6. In the existing end-to-end cast test, pass a sink and assert:
   - exactly one parse call;
   - the same input value is visible;
   - the project root is the temp project root;
   - the cast still succeeds and effect sees parsed output.

### Focused verification

```bash
bun test src/engine/cast.test.ts
```

### Repository verification

```bash
bun run check
git diff --check -- src/engine/play.ts src/engine/cast.ts src/engine/cast.test.ts
git diff -- src/engine/play.ts src/engine/cast.ts src/engine/cast.test.ts
```

### Commit

```bash
lisa commit-ticket \
  --ticket-id T-077-02-03 \
  --message "refactor(engine): expose cast context to parse" \
  --include src/engine/play.ts \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

### Completion criterion

- The parse hook receives context.
- Existing play declarations compile without mechanical changes.
- The focused cast suite and full gate are green.
- The three source paths are clean after the Lisa commit.

## Step 2 — extend the pure normalizer

### Files

- `src/play/decompose-epic-core.ts`
- `src/play/decompose-epic.test.ts`

### Actions

1. Import `snapshotCharterCodes` and `classifyCharterCite` into the addon-free core.
2. Extend `stripNonGoalAdvances` with `charter?: string`.
3. Snapshot the charter once only when supplied.
4. For each ticket, compute one boolean decision per advances occurrence.
5. Mark an occurrence for stripping when:
   - it is N-shaped; or
   - a snapshot exists and the shared classifier returns `degradable`.
6. Supply action `strip` and a stable `<ticket>.advances[index]` location to the classifier.
7. Retain resolvable and structural classifications.
8. Reuse unchanged ticket objects and never mutate input.
9. Update the core comments to distinguish semantic non-goal stripping from snapshot-miss stripping.

### Tests

Add a definition-shaped charter fixture and prove:

- known P-code retained;
- mixed P3/P9 strips only P9;
- P9-only becomes empty;
- known custom K-code retained;
- unknown custom K-code stripped;
- free-text value retained;
- blank value retained for the value gate;
- clean charter-aware ticket identity retained;
- charter-aware transformation does not mutate input;
- legacy no-charter behavior remains N-only.

### Focused verification

```bash
bun test src/play/decompose-epic.test.ts
```

### Completion criterion

- Pure tests establish all classification branches relevant to `advances`.
- The test process still imports no BAML runtime addon.
- No production wiring has changed yet; this step remains locally testable.

## Step 3 — wire production parse and composed gate proof

### Files

- `src/play/decompose-epic.ts`
- `src/gate/gates.ts`
- `src/gate/gates.test.ts`

### Actions

1. Change decompose's parse callback to `(text, ctx)`.
2. Pass `ctx.inputs.charter` into `stripNonGoalAdvances`.
3. Update parse comments to describe both normalized cite classes.
4. Leave `boundsGate` executable conditions unchanged.
5. Update bounds documentation to name the broader production normalization.
6. Import the pure normalizer into the gate test only.
7. Add composed normalize → clear fixture for `[P3, P9]` and expect CLEAR.
8. Add composed normalize → clear fixture for `[P9]` and expect VALUE STOP.
9. Retain and re-read the direct P9 BOUNDS STOP test as proof of defense in depth.

### Focused verification

```bash
bun test src/play/decompose-epic.test.ts src/gate/gates.test.ts
```

### Completion criterion

- The production play supplies the current run charter.
- Normalized mixed fixtures clear.
- Empty survivors stop at value.
- Unnormalized dangling fixtures still stop at bounds.

## Step 4 — verify and commit the feature unit

### Full gate

```bash
bun run check
```

The command includes BAML codegen, typecheck, and full tests. It is the repository's only completion
gate.

### Diff inspection

```bash
git diff --check -- \
  src/play/decompose-epic-core.ts \
  src/play/decompose-epic.test.ts \
  src/play/decompose-epic.ts \
  src/gate/gates.ts \
  src/gate/gates.test.ts

git diff -- \
  src/play/decompose-epic-core.ts \
  src/play/decompose-epic.test.ts \
  src/play/decompose-epic.ts \
  src/gate/gates.ts \
  src/gate/gates.test.ts
```

Inspect for:

- accidental BAML generated diffs;
- unrelated formatting churn;
- mutation of inputs;
- hardcoded Vend charter sets;
- loss of the direct bounds STOP;
- test assertions that only inspect arrays without invoking `clear`.

### Commit

```bash
lisa commit-ticket \
  --ticket-id T-077-02-03 \
  --message "fix(play): degrade dangling advances cites" \
  --include src/play/decompose-epic-core.ts \
  --include src/play/decompose-epic.test.ts \
  --include src/play/decompose-epic.ts \
  --include src/gate/gates.ts \
  --include src/gate/gates.test.ts
```

### Completion criterion

- Full gate green.
- Exact feature paths committed by Lisa.
- Ticket-owned paths clean.
- Unrelated worktree changes untouched.

## Step 5 — post-commit acceptance audit

Run:

```bash
git status --short
git log --oneline -5
bun test src/play/decompose-epic.test.ts src/gate/gates.test.ts
```

Map acceptance to evidence:

| Acceptance clause | Evidence |
|---|---|
| dangling code is degraded in normalize | core mixed/dangling fixtures |
| no bounds whole-STOP on normal path | composed normalize → clear test |
| normalized code does not materialize | production parse returns transformed `WorkPlan` to both gates/effect |
| empty advances still refuses | composed dangling-only → value STOP test |
| structural gates not weakened | existing gate suite + unchanged runtime bounds/structural code |
| verified over core/gates | focused addon-free tests |

If any acceptance clause is red, do not claim pass. Record the actionable blocker in review and use
the block disposition.

## Step 6 — progress artifact

Write `.lisa/attempts/T-077-02-03/1/work/progress.md` during implementation, including:

- completed steps;
- source paths and commit ids;
- focused and full test results;
- any deviations from this plan and rationale;
- final worktree hygiene.

The artifact stays in the private attempt directory and is not included in source commits.

## Step 7 — review artifacts

Write `.lisa/attempts/T-077-02-03/1/work/review.md` with:

- outcome-first acceptance assessment;
- file and commit summary;
- behavioral explanation;
- test coverage and exact commands;
- structural refusal audit;
- scope audit;
- open concerns;
- worktree/commit hygiene.

Then write exactly one JSON object to
`.lisa/attempts/T-077-02-03/1/work/review-disposition.json`:

```json
{"disposition":"pass","reason":null}
```

only if the implementation is committed, the full gate is green, and acceptance is met. Otherwise
write a block disposition with a non-empty actionable reason.

## Expected deviations policy

- If TypeScript rejects one-argument callback implementations, update declarations minimally and
  record the mechanical scope; do not weaken types with `any`.
- If the full cast suite is too broad for the context assertion, keep the assertion in its existing
  end-to-end fixture rather than creating a second bespoke harness.
- If concurrent work modifies a ticket-owned path, stop before overwriting it and inspect ownership.
- Do not expand into durable disposition plumbing; that remains `T-077-02-04`.
