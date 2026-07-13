# Plan — T-080-01-02 recorder refusal leaves trace

## Execution rules

- Continue directly from Plan into Implement and Review.
- Do not edit ticket phase/status frontmatter.
- Write `progress.md` in the attempt-private work directory.
- Use `apply_patch` for ticket-owned file edits.
- Do not use ordinary `git add` or `git commit`.
- Commit only through `lisa commit-ticket` with exact repository-relative includes.
- Preserve pre-existing Lisa/concurrent worktree modifications.
- Run `bun run check` green before the source commit.
- Finish with both `review.md` and `review-disposition.json`.

## Baseline ownership record

Before implementation, confirm the current non-ticket changes remain:

- `.lisa/provenance.jsonl`;
- `docs/active/tickets/T-080-01-02.md`;
- `docs/active/tickets/T-080-02-02.md`.

Expected ticket-owned include set:

```text
docs/knowledge/lisa-loop-settled-contract.md
src/seam/lisa-loop-settled-core.ts
src/seam/lisa-loop-settled-core.test.ts
src/seam/lisa-loop-settled.ts
src/seam/lisa-loop-settled.test.ts
```

`.gitignore` is verification-only and must not be included because no edit is needed.

## Step 1 — Pin the pure failure-line contract

Edit `src/seam/lisa-loop-settled-core.test.ts` first.

Add tests which expect:

1. exact compact JSONL bytes for a fixed canonical timestamp and refusal reason;
2. exactly one physical record even when the reason contains newline/tab characters;
3. JSON parse restoring the original reason verbatim;
4. invalid timestamp rejection;
5. noncanonical offset timestamp rejection;
6. blank reason rejection.

Run the focused core test and observe the expected missing-export failure before production code if
practical:

```bash
bun test src/seam/lisa-loop-settled-core.test.ts
```

Verification criterion: the new test fails only because the serializer is absent/unimplemented;
existing marker cases remain conceptually unaffected.

## Step 2 — Implement the pure trace contract

Edit `src/seam/lisa-loop-settled-core.ts`.

Add:

- `DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH`;
- `LisaLoopSettledFailure`;
- canonical ISO timestamp validation;
- `serializeLisaLoopSettledFailure`.

Keep new functions alongside existing seam constants/scalar validators/serializers. Do not alter
marker schema, classification ordering, or reason strings.

Run:

```bash
bun test src/seam/lisa-loop-settled-core.test.ts
bun run build
```

Verification criteria:

- exact JSONL tests pass;
- marker tests pass unchanged;
- TypeScript compiles the new exported API.

## Step 3 — Pin recorder refusal/failure behavior

Edit `src/seam/lisa-loop-settled.test.ts`.

Add/import:

- failure-log path constant;
- fixed `Date` fixtures;
- trace-line reader helper.

Reshape tests:

1. extend successful recording to assert no failure log;
2. isolate ignored attention and assert no filesystem state;
3. call a relative-project refusal with injected root/clock;
4. call a nonnumeric-ticket refusal with an absolute root/second clock;
5. assert one new exact record after each call;
6. assert both recorder promises resolve to refused outcomes;
7. create the stable marker name as a directory to force rename failure;
8. assert the recorder resolves to failed data;
9. assert exactly one matching trace line and no temporary sibling;
10. run Git `check-ignore` against the exported path and assert success.

Run:

```bash
bun test src/seam/lisa-loop-settled.test.ts
```

Expected interim result: tests fail because options/failure append/result variant are not yet
implemented. Ensure the failures point to those missing behaviors rather than fixture setup.

## Step 4 — Implement contained failure append

Edit `src/seam/lisa-loop-settled.ts`.

Implementation sequence:

1. add append/path/core imports;
2. add `RecordLisaLoopSettledOptions`;
3. add failed result variant and optional trace diagnostic;
4. add thrown-value normalization helper;
5. add absolute-project-or-working-root selection helper;
6. add safe one-call append helper with injected clock;
7. branch ignored events directly;
8. append once for refused events and return typed data;
9. wrap marker publication, cleanup temporary best-effort on failure;
10. append once for publication failure and return typed data;
11. preserve recorded return on success;
12. map refused/failed result kinds to main-process exit code 1.

Do not call append from marker cleanup/finally. Do not append on ignored or successful outcomes.

Run:

```bash
bun test src/seam/lisa-loop-settled-core.test.ts src/seam/lisa-loop-settled.test.ts
bun run build
```

Verification criteria:

- both named refusals append exact records in order;
- forced marker failure appends exactly one record;
- no expected recorder failure rejects;
- success and ignore remain silent in trace;
- marker atomic replacement test remains green;
- real hook integration remains green;
- result union compiles.

## Step 5 — Record the durable seam contract

Edit `docs/knowledge/lisa-loop-settled-contract.md`.

Update only relevant sections:

- producer lifecycle;
- new failure trace path/JSONL shape/root rules;
- no-append cases;
- main/hook containment distinction;
- one-way Vend-owned state;
- executable tests;
- explicit delivery/retry exclusions.

Do not claim T-080-01-03's settle surfacing/freshness work is implemented. State the trace as the
producer contract available to that dependent consumer.

Run a targeted text review:

```bash
rg -n "failure|failures.jsonl|refus|trace|ignored|successful" \
  docs/knowledge/lisa-loop-settled-contract.md
```

Verification criterion: documentation matches runtime path, exact keys, append cases, and honest
failure boundary.

## Step 6 — Focused verification

Run:

```bash
bun test \
  src/seam/lisa-loop-settled-core.test.ts \
  src/seam/lisa-loop-settled.test.ts
bun run build
git check-ignore .vend/lisa-loop-settled-failures.jsonl
git diff --check -- \
  docs/knowledge/lisa-loop-settled-contract.md \
  src/seam/lisa-loop-settled-core.ts \
  src/seam/lisa-loop-settled-core.test.ts \
  src/seam/lisa-loop-settled.ts \
  src/seam/lisa-loop-settled.test.ts
```

Verification criteria:

- focused tests green;
- typecheck green;
- Git echoes the failure-log path as ignored;
- diff whitespace check is clean.

Inspect ticket-only diff and ensure no accidental consumer/hook/fixture change:

```bash
git diff -- \
  docs/knowledge/lisa-loop-settled-contract.md \
  src/seam/lisa-loop-settled-core.ts \
  src/seam/lisa-loop-settled-core.test.ts \
  src/seam/lisa-loop-settled.ts \
  src/seam/lisa-loop-settled.test.ts
```

## Step 7 — Full repository gate

Run:

```bash
bun run check
```

This must complete BAML generation, typecheck, and the full test suite. Record exact pass/fail output
in `progress.md`. If it fails:

- diagnose whether the failure is ticket-owned or concurrent;
- fix only ticket-owned defects;
- document any plan deviation before changing scope;
- rerun until green or record an actionable Review block.

## Step 8 — Commit the meaningful source unit

Before commit, inspect:

```bash
git status --short
git diff --name-only -- \
  docs/knowledge/lisa-loop-settled-contract.md \
  src/seam/lisa-loop-settled-core.ts \
  src/seam/lisa-loop-settled-core.test.ts \
  src/seam/lisa-loop-settled.ts \
  src/seam/lisa-loop-settled.test.ts
```

Commit exactly:

```bash
lisa commit-ticket \
  --ticket-id T-080-01-02 \
  --message "feat(seam): trace Lisa recorder failures" \
  --include docs/knowledge/lisa-loop-settled-contract.md \
  --include src/seam/lisa-loop-settled-core.ts \
  --include src/seam/lisa-loop-settled-core.test.ts \
  --include src/seam/lisa-loop-settled.ts \
  --include src/seam/lisa-loop-settled.test.ts
```

Do not include RDSPI artifacts; Lisa admits/publishes them through the assignment lease.

Verification criteria:

- command succeeds;
- commit file list contains exactly the five includes;
- ticket-owned tracked files are clean afterward;
- pre-existing Lisa/concurrent changes remain present and unstaged.

## Step 9 — Post-commit verification and progress artifact

Inspect:

```bash
git show --stat --oneline HEAD
git show --format= --name-only HEAD
git status --short
```

If Lisa's commit machinery creates commits around concurrent activity, identify the ticket source
commit from output rather than assuming `HEAD` forever. Record its hash and exact file list.

Write `.lisa/attempts/T-080-01-02/1/work/progress.md` with:

- completed steps;
- exact implementation behavior;
- tests and pass counts;
- Git ignore result;
- commit hash/message/includes;
- remaining Review step;
- deviations and their rationale;
- concurrent files deliberately preserved.

No further ticket-owned source modification may remain after the commit.

## Step 10 — Review

Re-read:

- ticket acceptance;
- parent story boundary;
- ticket source commit diff;
- focused/full gate evidence;
- current status.

Write `.lisa/attempts/T-080-01-02/1/work/review.md` covering:

- summary and file map;
- behavior of each result path;
- trace path and exact format;
- root-selection rationale;
- test coverage mapped to every acceptance phrase;
- full-gate result;
- exact commit evidence;
- unchanged/out-of-slice files;
- open concerns and honest limitations.

If every acceptance criterion is met and no ticket-owned work remains, write exactly:

```json
{"disposition":"pass","reason":null}
```

to `.lisa/attempts/T-080-01-02/1/work/review-disposition.json`.

If acceptance is not met, write a block disposition with a non-empty actionable reason instead.

## Planned acceptance matrix

| Acceptance phrase | Implementation evidence | Verification |
|---|---|---|
| relative `LISA_PROJECT` refused | cwd/injected-root fallback append | exact one-record effect test |
| nonnumeric tickets refused | absolute input root append | exact second-record effect test |
| forced marker-write failure | failed atomic rename is caught | directory-target test, one record |
| timestamp + reason | closed JSONL serializer | byte-exact core/effect assertions |
| exactly one line each | one `appendFile` per branch | line counts after each call |
| success appends nothing | append is unreachable on recorded path | log absence assertion |
| recorder does not throw | failures return refused/failed data | awaited resolved outcomes |
| log is ignored | existing `.vend/*` rule | automated/manual `git check-ignore` |
| full gate green | repository check script | `bun run check` |

## Stop condition

After Review artifacts are written, remain on T-080-01-02 and stop. Do not begin T-080-01-03 or
any other ready ticket. Lisa owns completion publication and seat release.
