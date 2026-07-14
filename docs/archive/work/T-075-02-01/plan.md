# Plan — T-075-02-01 plain operator trust lines

## Objective

Land one copy-only, test-proven change that makes the full audit and compact Home trust lines readable
without Vend jargon, while preserving every value, empty-state distinction, and shared percentage
rounding behavior.

## Preconditions

- Work from repository root `/Users/johnchen/swe/repos/vend`.
- Do not touch Lisa-owned ticket phase/status edits.
- Keep all RDSPI artifacts under `.lisa/attempts/T-075-02-01/1/work/`.
- Use `apply_patch` for source/test edits.
- Use `lisa commit-ticket`, not ordinary Git staging or commit commands.
- Include only the four ticket-owned source/test paths.

## Step 1 — Establish focused baseline

Run:

```bash
bun test src/ledger/walk-away.test.ts src/shelf/home.test.ts
```

Expected:

- Existing focused suites pass before edits.
- Any pre-existing failure is recorded in `progress.md` before implementation continues.

Verification boundary:

- Read-only; no files change.

## Step 2 — Update `vend audit` formatter copy

Edit `src/ledger/walk-away.ts` only inside formatter-facing literals and their immediately related
documentation examples.

Actions:

1. Replace the `E1` heading with `run trust`.
2. Replace `walk-away rate` with `finished without help`.
3. Replace the missing-bit explanation with a sentence saying runs did not record whether anyone
   stepped in.
4. Replace provenance labels with `recorded at the time` and `filled in later`.
5. Replace `andon rate`/`budget` copy with `runs stopped before finishing`/`allowed`.
6. Replace outcome enum/statistical labels with plain terminal descriptions.
7. Replace cost-envelope/median labels with plan/middle-result wording.
8. Preserve every interpolation and expression.

Local review:

- Confirm the diff contains no edits above the formatter helper/comment region that affect report
  construction.
- Confirm `pct`, `ratio`, `subWalk`, and `cost_has` logic remain unchanged.

## Step 3 — Update audit formatter tests

Edit `src/ledger/walk-away.test.ts`.

Actions:

1. Replace old positive label assertions with new label assertions.
2. Assert populated output includes all four plain result descriptions.
3. Assert empty output uses the new missing-answer and no-planned-cost wording.
4. Update provenance split assertions to the new paired labels.
5. Retain numeric fractions and percentages.
6. Retain `none yet` coverage.
7. Add negative assertions for all four story-named forbidden phrases across populated and empty
   formatter outputs.

Focused check:

```bash
bun test src/ledger/walk-away.test.ts
```

Expected:

- All existing audit-core tests remain green.
- New output contract tests pass.

## Step 4 — Update Home ledger formatter copy

Edit `src/shelf/home.ts`.

Actions:

1. Replace the common `ledger   E1 walk-away` prefix with
   `ledger   finished without help`.
2. Preserve `no runs yet` for zero total.
3. Replace the no-answer wording with the same plain explanation used by audit, retaining count and
   singular/plural interpolation.
4. Replace compact provenance labels with `recorded at the time` and `filled in later`.
5. Preserve `walkAway`, `pct`, and `subPct` expressions.
6. Align quoted documentation examples with the new output.

Local review:

- Confirm `subPct` is unchanged.
- Confirm branch conditions and ordering are unchanged.
- Confirm `renderHome` is unchanged.

## Step 5 — Update Home and no-drift tests

Edit `src/shelf/home.test.ts`.

Actions:

1. Import `pct` from `walk-away.ts` alongside existing imports.
2. Replace populated copy expectations with new Home wording.
3. Derive `63%`, `50%`, and `75%` expected strings through `pct` in the cross-surface test.
4. Assert Home and audit each render those values under corresponding new labels.
5. Replace exact zero-run and no-answer expected strings.
6. Preserve no-fabricated-percent assertions.
7. Add negative assertions for the four forbidden phrases over populated and empty lines.
8. Update Home composition anchors from `E1 walk-away` to `finished without help`.
9. Leave empty-board and empty-shelf expected copy unchanged because sibling story `S-075-03`
   owns those phrases.

Focused check:

```bash
bun test src/shelf/home.test.ts
```

Expected:

- Formatter and composition tests pass.
- The `62.5%` example still displays as `63%` on both surfaces.

## Step 6 — Combined focused verification

Run both owned suites together:

```bash
bun test src/ledger/walk-away.test.ts src/shelf/home.test.ts
```

Then inspect rendered samples if needed with test failure output or a small read-only Bun expression.

Acceptance checks:

- No old forbidden phrase appears in either formatter output.
- Audit populated/empty branches are covered.
- Home populated/zero/no-answer branches are covered.
- Provenance-empty remains `none yet`.
- All numeric sample fragments match pre-change values.

## Step 7 — Static scope audit

Inspect exact diffs:

```bash
git diff -- src/ledger/walk-away.ts src/ledger/walk-away.test.ts src/shelf/home.ts src/shelf/home.test.ts
```

Search operator literals:

```bash
rg -n 'E1 walk-away|E1 — walk-away|andon rate|intervention bit unrecorded|censored' \
  src/ledger/walk-away.ts src/shelf/home.ts
```

Interpretation:

- Internal comments/types may still use precise domain terms such as `censored` or `andonRate`.
- No formatter string literal may render the forbidden phrases.
- The diff must not include report math, types, CLI, shell, or sibling surface changes.

## Step 8 — Full repository gate

Run:

```bash
bun run check
```

This performs:

1. BAML code generation.
2. TypeScript no-emit typecheck.
3. Full Bun test suite.

Expected:

- Exit status zero.
- Generated BAML output remains clean/unmodified or is pre-existing; no generated file belongs in
  this ticket unless the gate unexpectedly proves otherwise.

If the gate fails:

- Diagnose whether failure is ticket-owned or concurrent/pre-existing.
- Fix only ticket-owned defects.
- Record unrelated failures honestly in `progress.md` and `review.md` rather than absorbing unrelated
  scope.
- Do not commit until the required gate is green.

## Step 9 — Commit the meaningful unit

After all verification is green, commit exactly these paths:

```bash
lisa commit-ticket \
  --ticket-id T-075-02-01 \
  --message "plain-language audit and Home trust lines" \
  --include src/ledger/walk-away.ts \
  --include src/ledger/walk-away.test.ts \
  --include src/shelf/home.ts \
  --include src/shelf/home.test.ts
```

Rationale for one commit:

- Formatter and test copy are inseparable for a green commit.
- The two surfaces are intentionally one story/ticket to prevent vocabulary drift.
- One exact-path transaction isolates the work from concurrent Lisa ticket edits.

Post-commit checks:

- Capture the commit ID.
- Verify the four included paths have no remaining modification/untracked state.
- Verify unrelated worktree changes remain untouched.
- Do not use `git add`, `git commit`, or ordinary index cleanup.

## Step 10 — Write implementation progress

Create/update `progress.md` in the private attempt directory with:

- Baseline result.
- Source and test changes completed.
- Targeted and full gate results, including counts where available.
- Commit ID and exact included files.
- Any deviation from this plan and its reason.
- Remaining work (`review.md` only after implementation is committed).

## Step 11 — Review

Review the committed diff and write `review.md`.

Evaluate each acceptance clause:

1. Plain full audit wording.
2. Plain Home wording.
3. Absence of all four forbidden phrases from rendered output.
4. Unchanged numeric content.
5. Unchanged honest-empty meaning.
6. Identical Home/audit rounding through `pct`.
7. Full gate green.
8. Exact-path Lisa commit complete.

Record test coverage, known gaps, open concerns, and whether the ticket is honestly complete.

## Stop condition

After `review.md` is written, remain on `T-075-02-01` and stop. Do not update ticket frontmatter,
publish attempt artifacts manually, mark another ticket, or begin adjacent E-075 work. Lisa handles
publication and completion confirmation.
