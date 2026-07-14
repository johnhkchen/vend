# T-073-02-01 — Progress

## Status

Implementation complete. Ticket-owned source is committed and clean. The required full repository
gate is green.

## Source commit

```text
8dde3c0c3de2738a8b9c653984a86991ddcae19b
feat(engine): enforce cross-review settlement gate
```

Created with `lisa commit-ticket` and these exact repository-relative include paths:

- `src/engine/cast-core.ts`
- `src/engine/cast-core.test.ts`
- `src/engine/cast.ts`
- `src/engine/cast.test.ts`

No ordinary `git add` or `git commit` was used.

## Step 1 — Pure settlement policy

Completed.

- Added `CROSS_VENDOR_REVIEW_GATE` with stable value `cross-vendor-review`.
- Added `settleCrossReview` to the pure cast core.
- Absence returns the original classifier verdict directly.
- PASS preserves the base outcome and appends a passed review row.
- FAIL forces `gate-failed` and appends a failed review row with detail.
- The function preserves the base `materialize` fact and optional `overEnvelope` marker.
- No I/O or runtime policy dependency entered the pure module.

## Step 2 — Pure truth-table tests

Completed.

- Added an inert no-verdict case.
- Added pass settlement evidence.
- Added fail settlement evidence.
- Verified existing play gate rows remain in order before the review row.
- Verified refusal preserves honest physical materialization.

## Step 3 — Cast composition

Completed.

- Added optional `crossReviewRegistry` injection to `CastOptions`.
- Kept initial `classify` as the effect-authorization decision.
- After successful effect/diff capture, the cast resolves the complement seat.
- Complement resolution is delayed until a gated, successful, diff-bearing cast actually needs it.
- The patch is read from its repository-relative captured artifact.
- Review context is rendered from play name, required summary, and original gate evidence.
- Review uses the remaining headroomed cast timeout.
- Trusted local author/reviewer seat provenance maps into the durable verdict.
- Failure emits an autonomous `gate-failed` andon.
- Final ledger and summary outcomes come from one settled verdict.
- Both pass and fail verdicts are attached to the ledger.
- `--no-gates` skips cross-review as part of its established experimental control behavior.

## Step 4 — Cast-path acceptance tests

Completed with three token-free stub cases.

### Refusing complement

- Real temp Git repo.
- Writing fixture play produces story/ticket artifacts and a captured patch.
- Author executor id is `claude`.
- Injected complement is `openai-compat`, projected to reviewing seat `codex`.
- Reviewer returns a structured fail with `acceptance proof is missing`.
- Summary outcome is `gate-failed`, explicitly not success.
- Ledger outcome is `gate-failed`.
- Nested verdict carries both seats, fail, and detail.
- Gate rows retain the passing play gate and append the failed review gate.
- Reviewer prompt contains the captured ticket patch and authored purpose.
- Physical `materialized` remains true because review necessarily follows diff-producing effect.

### Passing complement

- Same real diff/cast path with a pass-primed reviewer.
- Summary and ledger settle as success.
- Ledger carries both seats and pass.
- A passed `cross-vendor-review` row is appended.

### Single seat

- Registry contains only the authoring Claude seat.
- No complement resolves.
- Cast settles success unchanged.
- Original gate rows are unchanged.
- No `crossVendorVerdict` field is written.

## Verification

Focused suite:

```text
bun test src/engine/cast-core.test.ts src/engine/cast.test.ts
```

Result:

- 82 tests passed.
- 0 failed.
- 275 assertions.

Typecheck:

```text
bun run build
```

Result: passed (`tsc --noEmit`).

Whitespace:

```text
git diff --check -- src/engine/cast-core.ts src/engine/cast-core.test.ts src/engine/cast.ts src/engine/cast.test.ts
```

Result: passed.

Full required gate after the final source change:

```text
bun run check
```

Result:

- BAML generation passed.
- TypeScript passed.
- 1,692 tests passed.
- 1 existing intentional release-artifact integration test skipped.
- 0 tests failed.
- 5,231 assertions across 113 files.

## Deviations from plan

Two small defensive refinements were made during implementation.

First, complement resolution was moved inside the diff-bearing review branch. This avoids even
constructing a complement executor for no-diff, failed-effect, or `--no-gates` casts and makes
inertness effectful as well as observational.

Second, the existing over-envelope stdout warning now prints only when the final settled outcome is
success. A cross-review failure may retain the historical over-envelope fact on the ledger, but it
must not print “gates cleared” after the complement gate refused the run.

The typecheck also required converting a readonly expected gate-row array to a fresh array in two
test assertions. This was test typing only; runtime behavior was already green.

## Repository hygiene

- All four ticket-owned source files are committed and clean.
- Lisa-owned `.lisa/provenance.jsonl` and ticket frontmatter changes remain untouched.
- Lisa automatically mirrored completed attempt artifacts into `docs/active/work/T-073-02-01/`;
  this agent did not author directly to that shared path.
- Progress and review artifacts remain attempt-private for Lisa publication.
- No ticket-owned files are staged, modified, or untracked.

## Remaining work

Only the Review phase artifact remains. No source implementation or verification work remains.
