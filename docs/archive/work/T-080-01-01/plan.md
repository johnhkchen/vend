# Plan — T-080-01-01 marker tolerates untracked duration

## Objective

Admit a Lisa complete event whose duration was not tracked, publish and consume an honestly
four-field v1 marker, keep present garbage refusable, and render the loop fact without inventing a
duration. Preserve every tracked-duration behavior and finish with the repository gate green.

## Process constraints

- Work continuously through Implement and Review.
- Record implementation state in this attempt's `progress.md`.
- Do not change ticket phase/status frontmatter.
- Do not write phase artifacts to `docs/active/work/T-080-01-01/`.
- Do not use `git add`, `git commit`, or ordinary index staging.
- Commit ticket source only with `lisa commit-ticket` and exact repeated includes.
- Preserve the two pre-existing Lisa-owned ticket frontmatter changes.
- Run `bun run check` before each source commit.
- Stop on this ticket after Review artifacts are complete.

## Baseline verification

1. Inspect `git status --short` and record pre-existing changes.
2. Run focused current tests if needed to establish a green baseline:

```sh
bun test \
  src/seam/lisa-loop-settled-core.test.ts \
  src/seam/lisa-loop-settled.test.ts \
  src/settle/settle-core.test.ts \
  src/settle/settle.test.ts
```

3. If baseline failures appear unrelated to ticket-owned paths, diagnose before editing.
4. Create `progress.md` with the baseline and planned units.

## Unit 1 — optional marker schema and durable contract

### Step 1.1 — widen marker construction without opening the schema

Edit `src/seam/lisa-loop-settled-core.ts`.

- Add explicit required and allowed key sets.
- Make marker input/output duration optional.
- Accept exactly four required keys or those four plus duration.
- Reject unknown keys in either shape.
- Validate duration only when it exists.
- Conditionally construct the duration property.
- Keep marker objects frozen.
- Preserve deterministic field ordering and final-newline serialization.

Immediate verification:

```sh
bun run check:typecheck
```

Expected: downstream optionality errors point only to consumers needing an honest branch.

### Step 1.2 — distinguish missing event input from present garbage

Continue in `src/seam/lisa-loop-settled-core.ts`.

- Branch on `input.durationSecs === undefined` before numeric parsing.
- Pass `undefined` through to the conditional builder for honest absence.
- Continue parsing all present strings strictly.
- Preserve the existing duration refusal reason.
- Leave project and ticket validation order unchanged.

### Step 1.3 — update canonical fixture and core tests

Edit:

- `src/seam/fixtures/lisa-loop-settled.valid.json`;
- `src/seam/lisa-loop-settled-core.test.ts`.

Test cases:

- untracked fixture parses and byte-round-trips;
- untracked marker has no duration own property;
- tracked inline marker parses and byte-round-trips;
- both parsed markers are frozen;
- builder omits missing duration;
- builder keeps measured zero duration;
- invalid present numeric durations still throw;
- closed schema refuses invalid/extra keys;
- classifier admits undefined duration into a complete result;
- classifier marker omits the duration property;
- classifier refuses `"41s"` with the exact existing reason.

Run:

```sh
bun test src/seam/lisa-loop-settled-core.test.ts
```

### Step 1.4 — prove direct recorder publication

Edit `src/seam/lisa-loop-settled.test.ts`.

- Add or adapt a direct effect test with `durationSecs: undefined`.
- Parse the written marker through the production parser.
- Assert the four known fields.
- Assert no duration own property.
- Assert Vend-only root materialization remains unchanged.
- Keep tracked replacement coverage intact.

Run:

```sh
bun test \
  src/seam/lisa-loop-settled-core.test.ts \
  src/seam/lisa-loop-settled.test.ts
```

### Step 1.5 — update settle-core compatibility tests

Edit `src/settle/settle-core.test.ts`.

- Add valid untracked marker provenance coverage.
- Retain tracked marker provenance coverage.
- Replace the formerly missing-duration malformed case with a real closed-schema violation.
- Keep refusal code/path/action assertions unchanged.

Run:

```sh
bun test src/settle/settle-core.test.ts
```

### Step 1.6 — update durable schema knowledge

Edit `docs/knowledge/lisa-loop-settled-contract.md`.

- Describe duration as supplied when tracked.
- Replace the canonical fixture example with the four-field form.
- State four required fields and one optional duration.
- State missing duration is valid while malformed present duration is refused.
- State settle prints duration conditionally.
- Leave atomicity, ownership, and lifecycle guarantees unchanged.

Run documentation consistency searches:

```sh
rg -n "exactly five|Missing.*not admitted|durationSecs|LISA_DURATION_SECS" \
  docs/knowledge/lisa-loop-settled-contract.md
```

Read every hit and ensure it matches the new contract.

### Step 1.7 — verify and commit unit 1

Inspect only ticket-owned diffs:

```sh
git diff --check -- \
  docs/knowledge/lisa-loop-settled-contract.md \
  src/seam/lisa-loop-settled-core.ts \
  src/seam/lisa-loop-settled-core.test.ts \
  src/seam/lisa-loop-settled.test.ts \
  src/seam/fixtures/lisa-loop-settled.valid.json \
  src/settle/settle-core.test.ts
```

Run the full gate:

```sh
bun run check
```

If green, commit exactly:

```sh
lisa commit-ticket \
  --ticket-id T-080-01-01 \
  --message "feat(seam): admit untracked loop duration" \
  --include docs/knowledge/lisa-loop-settled-contract.md \
  --include src/seam/lisa-loop-settled-core.ts \
  --include src/seam/lisa-loop-settled-core.test.ts \
  --include src/seam/lisa-loop-settled.test.ts \
  --include src/seam/fixtures/lisa-loop-settled.valid.json \
  --include src/settle/settle-core.test.ts
```

Confirm those paths are clean afterward and record the commit in `progress.md`.

## Unit 2 — honest settle rendering and hook path

### Step 2.1 — render duration only when tracked

Edit `src/settle/settle.ts`.

- Build the common loop project/count prefix.
- Append `in <durationSecs>s` only when duration is not `undefined`.
- Use an explicit undefined comparison so numeric zero remains tracked.
- Leave null-loop wording and every other verdict line unchanged.

### Step 2.2 — pin terminal output

Edit `src/settle/settle.test.ts`.

- Keep the tracked `in 41s` terminal contract.
- Add an untracked marker rendering test.
- Assert exact known-facts loop line.
- Assert no `undefineds`, `0s`, or fabricated numeric duration.
- Add a measured-zero assertion if it improves branch precision without duplicating the full fixture.

Run:

```sh
bun test src/settle/settle.test.ts
```

### Step 2.3 — prove real hook crossing with env unset

Edit `src/seam/lisa-loop-settled.test.ts` again.

- Set `LISA_DURATION_SECS: undefined` in the hook fixture environment.
- Keep all other complete facts valid.
- Assert the hook prints the exact untracked loop line once.
- Assert no fabricated `in Ns` or `undefineds` appears.
- Keep consumed-marker and immediate-repeat coverage.

Run the complete focused acceptance surface:

```sh
bun test \
  src/seam/lisa-loop-settled-core.test.ts \
  src/seam/lisa-loop-settled.test.ts \
  src/settle/settle-core.test.ts \
  src/settle/settle.test.ts
```

### Step 2.4 — verify and commit unit 2

Inspect:

```sh
git diff --check -- \
  src/seam/lisa-loop-settled.test.ts \
  src/settle/settle.ts \
  src/settle/settle.test.ts
```

Run:

```sh
bun run check
```

If green, commit exactly:

```sh
lisa commit-ticket \
  --ticket-id T-080-01-01 \
  --message "fix(settle): render loops without tracked duration" \
  --include src/seam/lisa-loop-settled.test.ts \
  --include src/settle/settle.ts \
  --include src/settle/settle.test.ts
```

Confirm those paths are clean and record the commit in `progress.md`.

## Final implementation verification

1. Run the complete focused suite again.
2. Run `bun run check` after the final commit to verify repository HEAD plus Lisa-owned frontmatter
   changes remain green.
3. Run `git diff --check` on all ticket-owned paths.
4. Run `git status --short`.
5. Verify no ticket-owned tracked path is modified, staged, or untracked.
6. Verify only the pre-existing Lisa-owned ticket frontmatter changes and private attempt artifacts
   remain outside the ticket commits.
7. Inspect both commits with `git show --stat --oneline` and `git show --name-only`.
8. Update `progress.md` with exact focused/full results, commit IDs, and any deviations.

## Review plan

Write `review.md` in this attempt directory with:

- disposition;
- acceptance evaluation item by item;
- files changed;
- schema and renderer behavior;
- focused and full test results;
- commit ownership/method;
- concurrent-change handling;
- open concerns and honest boundary.

Then write `review-disposition.json` with exactly:

```json
{"disposition":"pass","reason":null}
```

Use `block` with a non-empty actionable reason instead if any acceptance item, required gate, source
commit, or ownership cleanup remains incomplete.

## Completion criteria

- Both valid marker shapes round-trip through production boundaries.
- Undefined event duration yields a complete classification and absent marker property.
- Present malformed duration still refuses.
- Recorder effect publishes the untracked shape.
- Settle core carries it as valid provenance.
- Renderer prints a loop line with no fabricated duration.
- Tracked duration output remains unchanged.
- Real hook fixture proves the unset environment path and one-shot consumption.
- Durable contract and canonical fixture agree with runtime.
- Full gate is green.
- All ticket-owned source is committed via exact-path Lisa transactions.
- Review and disposition artifacts exist in the private attempt directory.
