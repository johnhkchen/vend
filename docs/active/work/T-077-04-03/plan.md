# Plan — T-077-04-03

## Execution principles

- Stay within the story's doctor-probe slice.
- Keep pure fact mapping separate from filesystem loading.
- Consume the public draft-store API; do not parse JSONL in doctor code.
- Keep `probeDoctor` and cast preflight untouched.
- Keep board hygiene independent and unchanged.
- Use exact acceptance wording in both implementation and assertions.
- Verify each meaningful source unit before committing it.
- Commit only with `lisa commit-ticket` and exact include paths.
- Preserve all pre-existing Lisa-owned worktree changes.

## Step 1 — revalidate dependency state

Before editing source:

1. inspect `git status --short`;
2. inspect recent commits for concurrent T-077-04-02 progress;
3. reread the public exports in `src/engine/decompose-draft.ts`;
4. inspect any newly published T-077-04-02 artifacts if present;
5. confirm the loader still exposes readable/active records in a usable shape;
6. confirm no target doctor files acquired overlapping changes.

Verification:

- no ticket-owned source is already modified by another ticket;
- the design's store-consumption assumption is current;
- any lifecycle selector is used rather than reimplemented.

Deviation rule:

- If the concurrent lifecycle ticket changes active-state APIs, record the adjustment in
  `progress.md` before implementing the probe.
- Do not edit the lifecycle module to make the probe easier.

## Step 2 — write focused acceptance tests first

Create `src/doctor/resumable-decompose-probe.test.ts` with a valid record fixture.

Add tests for:

1. one persisted draft returns a failed check named exactly
   `resumable-decompose: E-077`;
2. its hint contains exactly the contiguous command
   `vend run decompose-epic E-077 --resume`;
3. rendering the result is red and uses `EXIT_FAILED`;
4. a readable empty store returns the stable green check and `EXIT_OK`;
5. repeated records for one epic do not duplicate the warning;
6. multiple epics remain deterministic and each command targets its epic;
7. loader rejection resolves to a red drafts-readable check with actionable detail.

Run:

```bash
bun test src/doctor/resumable-decompose-probe.test.ts
```

Expected intermediate result:

- import/module failure because the source does not yet exist, or failing behavioral assertions;
- no changes outside the new test path.

The red-first run may be skipped only if Bun cannot compile a missing import cleanly; the test will
still be written before the implementation.

## Step 3 — implement the probe module

Create `src/doctor/resumable-decompose-probe.ts`.

Implementation order:

1. add module boundary comments;
2. import doctor constructors and draft-store public types/loader;
3. declare the base and green check constants;
4. declare the injectable dependency interface and default;
5. implement pure latest-per-epic selection or use the canonical active selector;
6. implement the pure record-to-check mapper;
7. implement total thrown-value message conversion;
8. implement `probeResumableDecompose` with loader injection and catch-to-check behavior.

Guardrails:

- no filesystem import in the doctor module;
- no direct `process.cwd()` call; the store default owns cwd behavior;
- no graph imports;
- no mutations or clears;
- no gate-finding interpretation;
- no resume execution;
- no throws for loader failures.

## Step 4 — verify the probe source unit

Run focused checks:

```bash
bun test src/doctor/resumable-decompose-probe.test.ts
bun run check:typecheck
```

Inspect:

```bash
git diff -- src/doctor/resumable-decompose-probe.ts \
  src/doctor/resumable-decompose-probe.test.ts
git status --short
```

Verification criteria:

- all focused tests pass;
- typecheck passes;
- exact failed name is pinned;
- full literal command is pinned;
- empty/read-failure behavior is pinned;
- only the two intended source paths are included in this unit;
- pre-existing Lisa changes remain present and unstaged.

## Step 5 — commit the probe source unit

Run:

```bash
lisa commit-ticket \
  --ticket-id T-077-04-03 \
  --message "feat(doctor): report resumable decompose drafts" \
  --include src/doctor/resumable-decompose-probe.ts \
  --include src/doctor/resumable-decompose-probe.test.ts
```

After the transaction:

1. inspect `git log -1 --oneline`;
2. inspect `git status --short`;
3. confirm neither ticket-owned path remains modified/untracked/staged;
4. confirm unrelated Lisa-owned paths remain untouched.

If the transaction rejects because the ordinary index contains unrelated state, do not manipulate
that index; inspect the diagnostic and use only Lisa-supported recovery.

## Step 6 — extend the CLI smoke fixture

Modify `src/doctor/doctor-cli.smoke.test.ts`.

Changes:

1. add temp-directory and cleanup imports;
2. import the public draft writer;
3. extend `runDoctor` with optional cwd;
4. preserve existing call sites unchanged;
5. add an async temp-root smoke;
6. append a schema-valid E-077 draft below the temp root;
7. spawn the real `doctor` command from that cwd;
8. assert exit 1, exact check name, literal command, and no stack trace;
9. clean the fixture in `finally`.

Test setup details:

- use a fixed valid CLEAR verdict;
- derive a valid next repair action through the public helper;
- use a fixed ISO timestamp;
- use a unique temporary directory;
- pass an explicit store path to the writer;
- let the CLI itself use the default relative path.

This asymmetry proves the default path resolution rather than merely passing the same override to
both producer and consumer.

## Step 7 — wire the normal doctor branch

Modify only the non-kitchen branch in `src/cli.ts`.

Changes:

1. update the branch comment to mention recovery-state diagnosis;
2. lazily import `probeResumableDecompose` beside board hygiene;
3. add it as the third `Promise.all` operation;
4. append `resumableChecks` after `boardChecks`.

Do not change:

- `parseDoctorArgs`;
- `USAGE`;
- kitchen workspace detection or `probeKitchen`;
- `renderDoctorReport`;
- output stream or process exit semantics;
- any cast preflight imports/calls.

## Step 8 — verify CLI wiring

Run:

```bash
bun test src/doctor/doctor-cli.smoke.test.ts
bun test src/doctor/resumable-decompose-probe.test.ts \
  src/doctor/board-hygiene-probe.test.ts \
  src/doctor/doctor-probe.test.ts \
  src/doctor/doctor-core.test.ts
bun run check:typecheck
```

Verification criteria:

- existing smoke cases still pass;
- temp-root persisted draft produces the exact check and command;
- CLI exits 1 for the resumable condition;
- no stdout/stderr stack trace appears;
- board hygiene and dependency probe suites remain green;
- no kitchen behavior was altered;
- typecheck passes.

## Step 9 — inspect and commit the CLI source unit

Inspect:

```bash
git diff -- src/cli.ts src/doctor/doctor-cli.smoke.test.ts
git status --short
```

Commit:

```bash
lisa commit-ticket \
  --ticket-id T-077-04-03 \
  --message "feat(cli): wire resumable decompose doctor check" \
  --include src/cli.ts \
  --include src/doctor/doctor-cli.smoke.test.ts
```

Then verify the two paths are clean and the new commit is at HEAD.

## Step 10 — full repository gate

Recheck concurrent state first. If T-077-04-02 landed after the focused runs, reread the draft-store
public API and rerun focused tests before the full gate.

Run:

```bash
bun run check
```

The gate includes:

- BAML code generation;
- TypeScript typecheck;
- complete Bun test suite.

Acceptance requires all three to pass. Generated output should be inspected afterward; if codegen
changes tracked files unexpectedly, determine whether it is a pre-existing/generated drift rather
than blindly committing it.

## Step 11 — final cleanliness and evidence audit

Inspect:

```bash
git status --short
git log --oneline -5
git show --stat --oneline HEAD
```

Audit the ticket acceptance point by point:

- persisted draft produces red `resumable-decompose: <epic>`;
- hint carries literal resume command;
- probe is separate and named `probeResumableDecompose`;
- CLI wiring is beside `probeBoardHygiene`;
- `probeDoctor` has no ticket diff;
- core test passes;
- smoke test passes;
- full check passes;
- all ticket-owned source is committed;
- unrelated worktree state is preserved.

## Step 12 — write Implement artifact

Create/update `progress.md` with:

- completed source units and commit hashes;
- focused test commands and outcomes;
- full gate outcome and test count;
- file ownership confirmation;
- any deviations caused by concurrent lifecycle work;
- remaining work, which should be Review only.

The progress artifact stays in the private attempt directory.

## Step 13 — Review

Write `review.md` as the reviewer handoff:

- summarize all source changes;
- explain module boundaries and CLI composition;
- enumerate test coverage;
- report the exact `bun run check` result;
- evaluate each acceptance criterion;
- name any limitations or open concerns;
- explicitly state whether work is ready.

Then write exactly one disposition file:

Pass:

```json
{"disposition":"pass","reason":null}
```

Block:

```json
{"disposition":"block","reason":"<non-empty actionable reason>"}
```

Use pass only if the full gate is green, the exact runtime output is proven, commits exist, and no
ticket-owned source remains dirty. After both Review artifacts exist, stop on this ticket and do
not begin another one.
