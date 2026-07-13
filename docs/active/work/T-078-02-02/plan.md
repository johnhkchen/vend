# Plan — T-078-02-02

## Objective

Ship a doctor-only charter convention check that uses the shared clearing-gate detector, reports a
distinct P-label count as green, reports zero labels with an actionable amber how-to, and never
turns amber into a non-zero doctor outcome.

## Constraints carried from Research and Design

- Use `matchIds` from `src/gate/gates.ts`; do not copy its regex.
- Read the canonical `CHARTER_PATH`.
- Keep filesystem work in an injected shell.
- Keep the text mapping pure.
- Keep amber as `ok: true` under the existing binary doctor core.
- Do not add the check to `probeDoctor` or `castPreflight`.
- Do not run it for kitchen workspaces.
- Do not alter gate behavior, schemas, init content, or real charter files.
- Write phase artifacts only in the attempt-private directory.
- Commit ticket source only with `lisa commit-ticket` and exact includes.
- Run `bun run check` before each commit.

## Step 1 — create the probe module

Create `src/doctor/charter-convention-probe.ts`.

### Actions

1. Import `readFile` and `join` for the default effect.
2. Import `matchIds` from the gate module.
3. Import `CHARTER_PATH` from project context.
4. Import `passed` and `Check` from doctor core.
5. Define the stable check prefix.
6. Define the stable labeling how-to.
7. Define `CharterConventionProbeDeps` with one `readCharter` function.
8. Define the cwd-relative default reader.
9. Implement `charterConventionCheck(charter)`.
10. Use `matchIds(charter, "P").size` as the only count source.
11. Render positive counts as green with singular/plural grammar.
12. Render zero as amber with cause and how-to.
13. Implement a total error-to-message helper.
14. Implement `probeCharterConvention` with dependency override merging.
15. Return exactly one check on successful reads.
16. Convert read failures into one passing amber line with path, detail, and how-to.

### Verification

- Review imports for addon safety.
- Confirm every branch uses `passed`.
- Confirm no local label regex exists.
- Confirm the module does not import or call `renderDoctorReport`.

## Step 2 — unit-test the probe

Create `src/doctor/charter-convention-probe.test.ts`.

### Cases

1. A labeled charter containing P1, P2, and duplicate P2 reports green with count two.
2. A charter containing only P7 reports `1 labeled invariant found`.
3. An unlabeled charter reports amber with the stable how-to.
4. Rendering the unlabeled check returns `ok: true` and `EXIT_OK`.
5. An injected reader returns labeled bytes and produces the mapped check.
6. An injected reader throws and the probe resolves to amber.
7. The read-fault line contains the canonical path, backend detail, and how-to.
8. Rendering the read-fault result remains exit zero.

### Focused command

```bash
bun test src/doctor/charter-convention-probe.test.ts
```

### Pass criteria

- zero failures;
- no filesystem or host dependency in the unit suite;
- exact state/count/how-to assertions pass;
- amber exit-zero assertion passes.

## Step 3 — first full gate and commit

Run:

```bash
bun run check
```

If red:

- diagnose only ticket-caused failures;
- preserve unrelated worktree changes;
- update `progress.md` with any plan deviation before changing design;
- rerun focused and full checks.

When green, commit unit 1:

```bash
lisa commit-ticket \
  --ticket-id T-078-02-02 \
  --message "feat(doctor): add charter convention probe" \
  --include src/doctor/charter-convention-probe.ts \
  --include src/doctor/charter-convention-probe.test.ts
```

Then confirm those paths are clean and no unrelated path was committed.

## Step 4 — wire the CLI

Modify only the normal workspace branch of `src/cli.ts`'s doctor arm.

### Actions

1. Update the comment to distinguish blocking prerequisites from the non-blocking convention signal.
2. Add a lazy import of `probeCharterConvention`.
3. Add `probeCharterConvention()` to the existing `Promise.all`.
4. Capture its one-element check array.
5. Append the check after existing dependency, board, and resume checks.
6. Leave the kitchen branch untouched.
7. Leave `renderDoctorReport`, printing, and exit-code wiring untouched.

### Verification

- `rg` confirms `probeCharterConvention` appears only in its module, test, and CLI doctor arm.
- `src/doctor/preflight.ts` is unchanged.
- Existing check order remains stable.

## Step 5 — extend the doctor CLI smoke suite

Modify `src/doctor/doctor-cli.smoke.test.ts`.

### Fixture helper

1. Add `mkdir` and `writeFile` imports.
2. Add an async helper that creates a unique temp root.
3. Create `docs/knowledge` recursively.
4. Write the supplied charter to `docs/knowledge/charter.md`.
5. Return the root.
6. Clean every root in a `finally` block.

### Labeled CLI case

1. Write P1, P2, and duplicate P2.
2. Spawn the real CLI with that cwd.
3. Assert the charter line contains `green`.
4. Assert the line contains `2 labeled invariants found`.
5. Assert no stack trace in either stream.

### Unlabeled CLI case

1. Write ordinary charter prose with zero P-number labels.
2. Spawn the real CLI with that cwd.
3. Assert exit code zero.
4. Assert the charter line contains `amber`.
5. Assert stdout contains the stable how-to.
6. Assert no stack trace or `Unhandled` text.

### Focused commands

```bash
bun test src/doctor/charter-convention-probe.test.ts
bun test src/doctor/doctor-cli.smoke.test.ts
```

### Pass criteria

- both labeled and unlabeled real CLI paths observe the cwd fixture;
- the duplicate label is not double-counted;
- amber exits zero;
- existing injected failure and resume smoke cases stay green.

## Step 6 — second full gate and commit

Run:

```bash
bun run check
```

When green, commit unit 2:

```bash
lisa commit-ticket \
  --ticket-id T-078-02-02 \
  --message "feat(doctor): surface charter convention health" \
  --include src/cli.ts \
  --include src/doctor/doctor-cli.smoke.test.ts
```

Then inspect:

```bash
git status --short
git show --stat --oneline HEAD
git show --stat --oneline HEAD~1
```

Only ticket-owned paths should appear in the two ticket commits.

## Step 7 — final verification

Run the focused suites again after both commits:

```bash
bun test src/doctor/charter-convention-probe.test.ts src/doctor/doctor-cli.smoke.test.ts
```

Run the full gate once more if any source changed after the commit-time gate. Otherwise record the
last full green gate as the final result.

Run the live command in the repository root as a sanity check:

```bash
bun run src/cli.ts doctor
```

Expected charter suffix in the live project:

```text
charter convention: green — 7 labeled invariants found
```

The total check count increases by one. The current live environment should remain exit zero.

## Step 8 — review

Inspect ticket diffs and answer each acceptance clause explicitly.

### Review checklist

- [ ] Shared detector import is present.
- [ ] No copied label regex exists.
- [ ] Positive distinct count is green.
- [ ] Zero count is amber.
- [ ] Amber includes a labeling example and `advances` guidance.
- [ ] Amber is a passing `Check`.
- [ ] Amber render and real CLI both exit zero.
- [ ] Missing/unreadable charter is also non-blocking amber.
- [ ] Cast preflight is unchanged.
- [ ] Kitchen doctor is unchanged.
- [ ] Existing doctor red checks still exit one.
- [ ] Every temp directory is removed.
- [ ] Full repository gate is green.
- [ ] Source units are committed through Lisa.
- [ ] No ticket-owned source remains modified or untracked.
- [ ] No unrelated worktree path was included or altered.

Write `review.md` with:

- disposition;
- file inventory;
- acceptance mapping;
- test results;
- architecture and scope review;
- commit inventory;
- open concerns.

Write `review-disposition.json` exactly as either:

```json
{"disposition":"pass","reason":null}
```

or, if acceptance is not met:

```json
{"disposition":"block","reason":"<non-empty actionable reason>"}
```

## Risk matrix

| Risk | Prevention / verification |
|---|---|
| Amber accidentally exits one | Use `passed`; assert unit render and CLI exit zero |
| Doctor and gates count labels differently | Import `matchIds`; forbid local regex |
| Duplicate labels inflate count | Set-based detector fixture with repeated P2 |
| Diagnostic blocks casts | Compose only in CLI; verify preflight unchanged |
| Kitchen overlay is diagnosed unintentionally | Add probe only in non-kitchen branch |
| Missing charter throws | Catch injected/default reader errors and return amber |
| Existing doctor line order drifts | Append after existing arrays |
| Smoke depends on global cwd | Spawn with temp cwd carrying the fixture charter |
| Temp files leak | `finally` recursive `rm` |
| Unrelated Lisa work is committed | Exact `--include` paths and post-commit stat review |
| Core warning framework scope-creeps | Keep `doctor-core.ts` untouched |

## Acceptance-to-step trace

| Acceptance clause | Proof |
|---|---|
| labeled charter line is green | Steps 1, 2, 5 |
| invariant count is reported | distinct-count unit and CLI fixtures |
| unlabeled charter line is amber | Steps 1, 2, 5 |
| amber carries the how-to | shared constant asserted in unit and smoke |
| doctor exit remains zero | unit `renderDoctorReport` assertion and real CLI smoke |
| shared detector is used | source import plus duplicate-count behavior |
| diagnostic never blocks | passing check invariant; no preflight wiring |

## Definition of done

The ticket is done only when all source and tests are committed through Lisa, `bun run check` is
green, both Review artifacts exist in the attempt-private directory, and no ticket-owned source is
left staged, modified, or untracked.
