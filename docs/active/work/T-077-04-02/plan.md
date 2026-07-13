# Plan — T-077-04-02: draft-clear-on-success

## Step 1 — add settlement row types and pure helpers

Modify `src/engine/decompose-draft.ts`.

Add:

- settlement input/record interfaces;
- strict settlement builder;
- newline JSON serializer;
- tolerant settlement reviver.

Verification criteria:

- existing draft record shape and serialization remain unchanged;
- settlement rows are schema-versioned and discriminated by `kind: "settled"`;
- invalid external values return null rather than throw;
- invalid caller inputs throw at the build boundary;
- no filesystem logic enters the pure helpers.

## Step 2 — reconcile active drafts in append order

Modify `readDecomposeDrafts` so valid settlement rows clear earlier active records for their epic.

Verification criteria:

- settlement rows do not count as skipped;
- unrelated epic records remain active and ordered;
- all earlier records for the settled epic disappear from the returned active view;
- later records for the epic become active again;
- malformed settlement-shaped rows increment skipped exactly once;
- `latestDecomposeDraft` needs no API change.

## Step 3 — add the thin settlement append shell

Add `settleDecomposeDraft` beside `appendDecomposeDraft`.

Verification criteria:

- same default/override path behavior;
- recursive parent creation;
- one append-only line;
- no read, rewrite, unlink, or rename;
- repeated settlement is harmless to the active view.

## Step 4 — extend store tests

Modify `src/engine/decompose-draft.test.ts`.

Add tests for:

- settlement build and exact serialization;
- multi-epic reconciliation;
- later draft after settlement;
- malformed settlement handling;
- real filesystem append → settle → active-empty behavior;
- raw file retaining both valid lines.

Run:

```bash
bun test src/engine/decompose-draft.test.ts
bun run build
```

Expected: focused suite and typecheck green.

## Step 5 — run the authoritative gate for store unit

Run:

```bash
bun run check
```

Inspect:

```bash
git diff -- src/engine/decompose-draft.ts src/engine/decompose-draft.test.ts
git status --short
```

Confirm Lisa-owned metadata/ticket changes are excluded.

Commit exactly:

```bash
lisa commit-ticket \
  --ticket-id T-077-04-02 \
  --message "feat: settle resumable decompose drafts" \
  --include src/engine/decompose-draft.ts \
  --include src/engine/decompose-draft.test.ts
```

Do not use `git add` or ordinary `git commit`.

## Step 6 — wire successful terminal settlement into cast

Modify `src/engine/cast.ts`.

- import `settleDecomposeDraft`;
- at the end of the guarded settlement try, require:
  - real gate verdict;
  - decompose play identity;
  - effect-reported materialization;
  - final success outcome;
- append settlement with current run ID, epic subject, and settlement timestamp;
- reuse the existing draft-path override/default.

Verification criteria:

- gate stop does not settle;
- timeout does not settle;
- failed effect/review does not settle;
- successful ungated control does not settle a trusted gated draft;
- other plays remain unaffected;
- settlement append failure follows the guarded `errored` settlement path.

## Step 7 — retain the gate-failure acceptance proof

Review the existing gate-failed decompose test in `src/engine/cast.test.ts`.

Keep assertions that:

- outcome is `gate-failed`;
- materialized is false;
- effect is not called;
- one active record remains;
- exact parsed draft, gate findings, and repair action remain readable.

Adjust only naming/comments if needed; avoid duplicating equivalent coverage.

## Step 8 — add timeout preservation coverage

In `src/engine/cast.test.ts`:

- preseed a draft for E-077 using `appendDecomposeDraft`;
- cast a decompose-shaped play through a timeout stub;
- assert `timed-out` and no parse/gate/effect execution;
- load the same store and assert the seeded draft remains active.

This proves timeout does not clear paid state while staying honest that a pre-result timeout cannot
create parsed state.

## Step 9 — convert the existing decompose success assertion

Update the max-turns decompose fixture:

- retain all cap/turn/output/run-log assertions;
- change active draft expectation from one record to zero;
- inspect the raw ledger and assert checkpoint then settlement marker;
- assert the settlement marker targets the fixture run and E-077.

This is the positive acceptance proof.

## Step 10 — focused cast verification

Run:

```bash
bun test src/engine/decompose-draft.test.ts src/engine/cast.test.ts
bun run build
```

Inspect failures for lifecycle regressions in decompose-shaped fixtures. All execution must use
local temp directories and stub executors; no live model or network spend is authorized.

## Step 11 — full gate for cast unit

Run:

```bash
bun run check
```

Inspect:

```bash
git diff -- src/engine/cast.ts src/engine/cast.test.ts
git status --short
```

Commit exactly:

```bash
lisa commit-ticket \
  --ticket-id T-077-04-02 \
  --message "feat: clear decompose drafts on success" \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

## Step 12 — post-commit verification

Run:

```bash
git status --short --branch
git log --oneline -8
```

Confirm:

- four ticket-owned source files are committed and clean;
- no ticket-owned path is staged or untracked;
- Lisa-owned metadata/ticket changes remain untouched;
- attempt artifacts remain private and uncommitted.

Run `bun run check` once more at exact HEAD if the commit hook or concurrent changes make the final
state uncertain.

## Step 13 — maintain `progress.md`

Record:

- actual implementation details;
- focused and full command results;
- test/assertion counts;
- Lisa commit hashes/messages;
- deviations from this plan;
- final worktree ownership assessment.

## Step 14 — Review

Write `review.md` covering:

- active-ledger settlement semantics;
- cast ordering and success guard;
- gate-fail/timeout/success evidence;
- exact acceptance mapping;
- test coverage and gaps;
- commit and gate evidence;
- downstream compatibility and known limitations.

Write `review-disposition.json` exactly:

```json
{"disposition":"pass","reason":null}
```

only if acceptance is met, full gate is green, and ticket-owned source is committed/clean.
Otherwise write a blocking disposition with a non-empty actionable reason.

## Acceptance mapping

| Acceptance clause | Planned evidence |
|---|---|
| persisted draft is cleared/settled | settlement ledger row + active-reader reconciliation |
| on successful materialize | cast guard requires real gates, materialized true, final success |
| mirrors capture→reconcile | checkpoint after gates; settlement after final verdict |
| draft present after gate fail | existing BAML-free decompose STOP fixture |
| draft present after timeout | preseeded recovery record + timeout stub fixture |
| draft absent after success | max-turns decompose success returns zero active records |
| unrelated drafts preserved | multi-epic store test |
| local-first | append-only `.vend/decompose-drafts.jsonl`, no network |

## Risks and controls

- Risk: clearing unrelated epics. Control: epic-scoped settlement reconciliation.
- Risk: whole-file rewrite loses concurrent append. Control: append-only marker.
- Risk: stale draft visible to doctor/resume. Control: public loader returns active records only.
- Risk: failed cross-review clears recovery. Control: require final settled success.
- Risk: ungated experiment clears trusted state. Control: require non-null gate verdict.
- Risk: marker treated as malformed. Control: dedicated reviver before skipped increment.
- Risk: source commit captures Lisa metadata. Control: exact repeated `--include` paths only.
