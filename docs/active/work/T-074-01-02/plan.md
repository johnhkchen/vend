# Plan — T-074-01-02

## Step 1 — establish a red focused test

Edit `src/doctor/doctor-probe.test.ts` first.

- Import the intended `EXECUTOR_DISPENSABLE_CHECK` and `executorDispensableCheck` exports.
- Add success and Claude non-dispensable fixtures.
- Assert the exact suffixed name.
- Assert green has no hint.
- Assert red text names `claude login`, sandbox, and Keychain access.
- Update fixed counts/order to five.
- Inject successful probe results in pre-existing deterministic calls.

Run:

```bash
bun test src/doctor/doctor-probe.test.ts
```

Expected before production implementation: module export/type failures or behavior failures proving
the new contract is absent.

## Step 2 — implement the narrow doctor consumer

Edit `src/doctor/doctor-probe.ts`.

- Import the shared probe result type.
- Import `executorFor` from the canonical selector.
- Add the exported base check name.
- Extend `DoctorProbeDeps` with a narrow executor-probe reader.
- Add the real default that calls `executorFor({}, env).probe()`.
- Add the pure result-to-check mapper.
- Append the fifth safe check using the selected id.
- Keep the existing checks and their relative order unchanged.

Verification:

```bash
bun test src/doctor/doctor-probe.test.ts
```

Expected: success/failure branches and existing doctor branches pass without a live probe in
deterministic tests.

## Step 3 — preserve hermetic downstream tests

Run:

```bash
bun test src/doctor/preflight.test.ts src/doctor/doctor-cli.smoke.test.ts
```

If deterministic preflight cases observe real executor state, edit only their fixtures to inject a
successful executor probe. Do not alter production preflight semantics.

Verify the bogus-executor CLI case still returns a clean red report and no stack.

## Step 4 — strengthen never-throw and no-spend evidence

- Add a test where the injected executor-probe reader throws.
- Assert `probeDoctor` resolves with a red, correctly named fifth check.
- Assert the thrown message becomes failure text.
- Keep the injected dependency type probe-only; do not introduce a fake `dispense`.
- Confirm production doctor code contains `.probe()` and no `.dispense(` call.

Focused verification:

```bash
bun test src/doctor/doctor-probe.test.ts src/doctor/preflight.test.ts src/doctor/doctor-cli.smoke.test.ts
rg -n "\\.dispense\\(" src/doctor/doctor-probe.ts
```

The `rg` command is expected to return no matches.

## Step 5 — static and full verification

Run:

```bash
git diff --check -- src/doctor/doctor-probe.ts src/doctor/doctor-probe.test.ts src/doctor/preflight.test.ts
bun run check
```

Required results:

- BAML generation passes;
- strict TypeScript passes;
- full test suite has zero failures;
- no whitespace errors;
- the only skip, if present, is an existing unrelated guarded integration.

Inspect the exact diff and working tree. Confirm Lisa-owned provenance/ticket changes remain
untouched and are not included.

## Step 6 — write implementation progress

Create `progress.md` in the private attempt directory before committing. Record:

- the red-test evidence;
- source changes;
- focused and full gate results;
- any deviations from this plan;
- the exact source paths intended for commit;
- remaining work.

## Step 7 — commit the meaningful source unit

Use only Lisa's transaction:

```bash
lisa commit-ticket \
  --ticket-id T-074-01-02 \
  --message "feat(doctor): check executor dispensability" \
  --include src/doctor/doctor-probe.ts \
  --include src/doctor/doctor-probe.test.ts \
  [--include src/doctor/preflight.test.ts if modified]
```

Do not use `git add`, ordinary `git commit`, or broad include paths.

After commit:

- capture the commit id;
- verify the exact committed path list;
- verify ticket-owned source paths are clean;
- leave unrelated Lisa-owned changes alone.

## Step 8 — Review

Write `review.md` in the private attempt directory.

It must include:

- pass/fail outcome against every acceptance clause;
- files changed;
- source commit id and commit method;
- test counts and commands;
- proof that the check invokes only the free probe boundary;
- open concerns and honest limitations;
- confirmation that cast-time classification/funding remain out of slice;
- working-tree handoff.

Stop on this ticket after `review.md`. Lisa owns artifact publication, completion commit, phase/status
transitions, and seat release.
