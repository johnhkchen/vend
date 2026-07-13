# Plan — T-078-02-01

## Execution principles

- Stay within `src/gate/gates.ts` and `src/gate/gates.test.ts`.
- Preserve the current pure-core boundary.
- Preserve gate names, gate order, units, and pass/refuse decisions.
- Preserve exact legacy reason strings whenever the charter contains a P-label.
- Use the existing detector semantics; do not introduce Markdown parsing.
- Verify the small behavior locally, then run the complete repository gate.
- Commit only through `lisa commit-ticket` with exact paths.
- Do not touch the unrelated working-tree changes visible at ticket start.

## Step 1 — establish the focused baseline

Run:

```bash
bun test src/gate/gates.test.ts
```

Verification:

- The current gate suite passes before source edits.
- Any pre-existing failure is documented before implementation.
- No BAML native subprocess should be needed because the module is pure/type-only.

## Step 2 — pin the detector’s public contract in tests

Edit `src/gate/gates.test.ts` first.

Actions:

1. Add `matchIds` to the named import from `./gates.ts`.
2. Add `UNLABELED_CHARTER`, containing meaningful prose but no `P\d+` token.
3. Add `UNLABELED_CTX`, reusing the ordinary epic while replacing the charter.
4. Add a detector test proving the unlabeled charter produces no P IDs.
5. Add a detector test proving the labeled fixture produces its P IDs.
6. Pin prefix selection/deduplication if it keeps the test concise.

Expected intermediate result:

- Type/test failure because `matchIds` is not exported yet.
- This is the intentional red half of the public-seam change.

## Step 3 — pin the two unlabeled refusal messages

Continue editing `src/gate/gates.test.ts`.

### Empty advances case

1. Use a valid ticket fixture overridden with `advances: []`.
2. Call `clear` with `UNLABELED_CTX`.
3. Assert `status: "stop"`, gate `value`, and the existing ticket unit.
4. Assert the exact full reason:
   - existing empty-advances reason first;
   - cause: no labeled invariants;
   - example: `P1 — Author once, run forever...`;
   - fix: label them or cite none.

### Dangling ref case

1. Use a valid ticket fixture overridden with `advances: ["P9"]`.
2. Call `clear` directly with `UNLABELED_CTX`; do not normalize first.
3. Assert `status: "stop"`, gate `bounds`, and the existing ticket unit.
4. Assert the exact full reason:
   - existing P9 dangling-ref reason first;
   - the identical cause/example/fix suffix.

Expected intermediate result:

- Both new behavior tests fail against current production code.
- Gates and units should already match, demonstrating that verdict changes are not required.

## Step 4 — strengthen labeled-charter compatibility pins

Still in `src/gate/gates.test.ts`:

1. Change the existing labeled empty-advances reason assertion from substring to exact `toBe`.
2. Change the existing labeled dangling-ref reason assertion from substring to exact `toBe`.
3. Leave all other existing fixtures and expectations unchanged.

Verification intent:

- The exact legacy bytes are recorded before production logic changes.
- Existing suite coverage retains all other clear/refuse verdict pins.
- A future unconditional wording rewrite will fail immediately.

## Step 5 — export the detector without semantic change

Edit `src/gate/gates.ts`.

Action:

- Add only the `export` modifier to `matchIds`.

Verify by inspection:

- Name unchanged.
- Parameters unchanged.
- regex unchanged.
- return type unchanged.
- function body unchanged.
- bounds call sites unchanged.

This resolves the detector import tests and establishes the sibling seam.

## Step 6 — add one private diagnostic helper

In the pure-helper section of `src/gate/gates.ts`:

1. Define one private constant for the exact cause/example/fix text.
2. Define one private helper that accepts a legacy reason and charter string.
3. Compute `matchIds(charter, "P").size`.
4. Return the original reason unchanged when size is nonzero.
5. Append the fixed explanation when size is zero.

Verification by inspection:

- The helper reads only plain inputs.
- No effect dependency is added.
- The epic string is not examined.
- No charter mutation or inferred labels occur.

## Step 7 — integrate the value branch

In `src/gate/gates.ts`:

1. Add `ctx: ClearContext` to `valueGate`.
2. Wrap only the empty/invalid `advances` reason with the helper.
3. Pass `ctx.charter` to the helper.
4. Update only the value tuple in `GATES` to forward `ctx`.

Do not change:

- zero-ticket plan handling;
- purpose checking;
- done-signal checking;
- branch ordering;
- `GATE_NAMES`;
- `clear`’s signature or loop.

## Step 8 — integrate the bounds branch

In `src/gate/gates.ts`:

1. Keep invariant and non-goal set calculation as-is.
2. Keep non-goal classification and reason as-is.
3. Keep shaped-P detection as-is.
4. Wrap only the existing dangling-P reason with the helper.
5. Pass `ctx.charter` to the helper.

Do not add the suffix to:

- non-goal refusals;
- free-text advances;
- successful bounds results.

## Step 9 — run focused verification

Run:

```bash
bun test src/gate/gates.test.ts
```

Success criteria:

- Detector export tests pass.
- Both unlabeled-charter reasons match exactly.
- Both labeled-charter legacy reasons match exactly.
- All pre-existing gate tests pass.
- The suite reports no snapshot or type/runtime errors.

If it fails:

- Fix only behavior within the selected design.
- Document any plan deviation in `progress.md` before taking a materially different approach.

## Step 10 — inspect source diff

Run read-only Git inspection for the two owned files.

Check:

- exactly two source paths changed;
- no formatting churn;
- no test weakening;
- no gate ordering/verdict change;
- no accidental generated file ownership;
- unrelated worktree files remain untouched.

## Step 11 — run the repository gate

Run:

```bash
bun run check
```

Success criteria:

- BAML generation succeeds.
- `tsc --noEmit` succeeds.
- the complete Bun suite succeeds.
- no generated output remains as an unowned modification.

If the gate exposes an unrelated failure, investigate enough to distinguish it from this ticket and
record the evidence honestly. Do not edit out-of-scope files merely to make the result green.

## Step 12 — commit the meaningful source unit

After focused and full checks are green, run exactly one ticket commit:

```bash
lisa commit-ticket \
  --ticket-id T-078-02-01 \
  --message "fix(gates): explain unlabeled charter refusals" \
  --include src/gate/gates.ts \
  --include src/gate/gates.test.ts
```

The Lisa CLI handles its private transaction; do not use `git add` or ordinary `git commit`.

Post-commit verification:

- Inspect `git status --short`.
- The two included source files must be clean.
- No ticket-owned file may remain staged, modified, or untracked.
- Pre-existing unrelated changes may remain and must match the initial scope.
- Inspect the latest commit’s name and included paths.

## Step 13 — write implementation progress

Create `.lisa/attempts/T-078-02-01/1/work/progress.md`.

Record:

- completed steps;
- exact files changed;
- tests run and results;
- commit mechanism and commit ID;
- remaining work;
- deviations, if any;
- unrelated worktree state preserved.

## Step 14 — review

Review the committed diff against every ticket acceptance item and parent-story boundary.

Create `.lisa/attempts/T-078-02-01/1/work/review.md` with:

- change summary;
- per-file inventory;
- detector API assessment;
- unlabeled and labeled behavior assessment;
- test coverage;
- full-gate result;
- open concerns or limitations;
- scope compliance;
- commit hygiene.

Then create `review-disposition.json` with exactly one of:

```json
{"disposition":"pass","reason":null}
```

or an actionable blocking disposition if acceptance is not met.

## Completion condition

The ticket is ready for Lisa completion only when both source paths are committed through the ticket
transaction, `bun run check` is green, every private phase artifact exists, and the review disposition
honestly says whether the acceptance contract is satisfied.
