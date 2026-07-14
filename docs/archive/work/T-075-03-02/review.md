# Review — T-075-03-02 plain-empty-board-line

## Outcome

Acceptance is met.

A truly empty board now renders:

```text
No work on the board yet.
```

The bare-`vend` Home path receives that string from `renderMenu([])` and places it
unchanged as the leading region. Both the direct menu output and the composed Home
output explicitly reject the legacy `"(no actions)"` phrase.

The change is verified and committed through Lisa.

## Commit

- Full hash: `1e5d9aabec9f42c8c6995ab4e392ed88669dccb1`.
- Short hash: `1e5d9aa`.
- Subject: `plain empty-board guidance`.
- Commit mechanism: `lisa commit-ticket` with exact include paths.
- Ordinary Git staging/commit commands were not used.

Committed files, exactly:

1. `src/shelf/home-shell.ts`.
2. `src/shelf/home.test.ts`.
3. `src/shelf/menu.test.ts`.
4. `src/shelf/menu.ts`.

Commit statistic: 4 files changed, 11 insertions, 8 deletions.

## Files created, modified, and deleted

Repository source inventory:

- Created: none.
- Modified: `src/shelf/menu.ts`.
- Modified: `src/shelf/menu.test.ts`.
- Modified: `src/shelf/home.test.ts`.
- Modified: `src/shelf/home-shell.ts` (comment only).
- Deleted: none.

Private attempt artifacts created for the required workflow:

- `.lisa/attempts/T-075-03-02/1/work/research.md`.
- `.lisa/attempts/T-075-03-02/1/work/design.md`.
- `.lisa/attempts/T-075-03-02/1/work/structure.md`.
- `.lisa/attempts/T-075-03-02/1/work/plan.md`.
- `.lisa/attempts/T-075-03-02/1/work/progress.md`.
- `.lisa/attempts/T-075-03-02/1/work/review.md`.

These private artifacts are not part of the source commit; Lisa owns their
admission and publication into the shared work path.

## File review

### `src/shelf/menu.ts`

Changed the true-empty return literal in the existing `shown.length === 0` branch.

Preserved:

- Function signature.
- Input and output types.
- `visibleActions` call.
- Empty-vs-hidden discriminator.
- All-hidden `vend --all` guidance.
- Populated row formatting.
- Ranking and numbering.
- Budget display.
- Cache version and schema.
- Pure and total behavior.

No new export, import, constant, helper, effect, or dependency was introduced.

### `src/shelf/menu.test.ts`

Updated the direct empty-input fixture to:

- Call `renderMenu([])`.
- Assert exact equality with `No work on the board yet.`.
- Assert the output does not contain `"(no actions)"`.

The neighboring all-hidden golden test remains unchanged and green, proving that a
non-empty board filtered to zero visible rows still tells the operator about
`vend --all`.

### `src/shelf/home.test.ts`

Updated the empty-board composition fixture to:

- Build its board through the actual `renderMenu([])` function.
- Pass that result into `renderHome` alongside populated shelf and ledger fixtures.
- Assert the first Home region exactly equals the new sentence.
- Assert the complete Home output excludes the legacy phrase.

This proves the named Home path without importing the impure/BAML-bearing
`home-shell.ts` into a pure test suite.

### `src/shelf/home-shell.ts`

Refreshed one module-header description so the missing-demand degradation path no
longer quotes the obsolete output.

The change is comment-only. `homeText`, its imports, its options, and its orchestration
remain byte-identical.

## Acceptance review

Ticket criterion:

> `menu.test.ts` and `home.test.ts` assert `renderMenu([])` and the empty-board Home
> path render the new plain line, with no `'(no actions)'` anywhere.

Evaluation:

- PASS — `menu.test.ts` asserts exact direct output.
- PASS — `menu.test.ts` explicitly rejects the legacy phrase.
- PASS — `home.test.ts` uses `renderMenu([])` in the composed Home fixture.
- PASS — `home.test.ts` asserts the exact leading board region.
- PASS — `home.test.ts` explicitly rejects the legacy phrase from the whole Home
  output.
- PASS — production menu/Home source no longer emits or describes the phrase.

The phrase remains in exactly two current source-suite locations, both required
negative assertions (`not.toContain`). That is the executable meaning of “with no
phrase anywhere”: the rendered outputs cannot contain it. The ticket/story and
historical work artifacts also quote it to identify/record the defect; rewriting
history would be incorrect and outside scope.

## Focused test evidence

Baseline before test changes:

```text
bun test src/shelf/menu.test.ts src/shelf/home.test.ts
35 pass, 0 fail, 62 assertions
```

The baseline was green only because it pinned the old phrase.

Red proof after changing tests, before production:

```text
bun test src/shelf/menu.test.ts src/shelf/home.test.ts
33 pass, 2 fail, 62 assertions
```

Both failures showed the same precise mismatch:

- Expected: `No work on the board yet.`.
- Received: `(no actions)`.

Green proof after production change:

```text
bun test src/shelf/menu.test.ts src/shelf/home.test.ts
35 pass, 0 fail, 64 assertions
```

The two added assertions account for the increase from 62 to 64.

## Full gate evidence

Command run before commit:

```text
bun run check
```

Result: exit 0.

Stages:

- BAML client generation passed with CLI 0.223.0.
- TypeScript `tsc --noEmit` passed.
- Full Bun suite passed.

Totals:

- 1,749 passed.
- 1 skipped.
- 0 failed.
- 5,512 assertions.
- 1,750 tests across 116 files.

The single skip is the existing release acceptance integration test when `dist/`
is absent. It does not concern this ticket, and the canonical gate is green.

BAML generation left no generated-file diff.

## Static and diff evidence

`git diff --check` passed before commit.

The current menu/Home literal audit found the old phrase only in:

- `src/shelf/menu.test.ts`: negative assertion.
- `src/shelf/home.test.ts`: negative assertion.

There is no production literal occurrence in:

- `src/shelf/menu.ts`.
- `src/shelf/home.ts`.
- `src/shelf/home-shell.ts`.

Post-commit exact-path status returned no output for all four committed files.
They are not staged, modified, or untracked.

## Architecture review

The existing pure-core/impure-shell boundary is preserved:

- `renderMenu` remains the one production owner of board copy.
- `browseShelf` remains the cache writer and delegates rendering.
- `homeText` remains an effect-only gather/composition shell.
- `renderHome` remains an opaque string composer.
- Tests pin the pure leaf behavior and pure downstream composition.
- Selection continues to read structured `MenuCache.actions`, never display text.

No data path, filesystem operation, clock read, BAML path, or CLI route changed.

## Scope review

In scope and completed:

- Empty `renderMenu` copy.
- Direct menu gate.
- Home composition gate.
- Legacy-output exclusion.
- Current shell comment accuracy.

Deliberately unchanged:

- The all-hidden guidance line.
- Shelf confidence and cold-start count behavior (`T-075-03-01`).
- Shelf row types/tests.
- Ledger wording and math.
- `COLD_START_MIN_SUCCESSES`.
- Home layout.
- Menu cache and press selection.
- CLI parsing and dispatch.
- Historical work artifacts.

This stays within `S-075-03`'s ticket split and does not overlap the sibling's
source files.

## Wording review

`No work on the board yet.` was selected because it is both plain and narrow:

- “Work” avoids the implementation-flavored “actions.”
- “On the board” limits the claim to the known local surface.
- “Yet” makes an empty state ordinary without fabricating future work.
- The sentence does not claim that the entire project is complete.
- It does not collapse empty input with hidden/blocked rows.

Alternatives such as `Nothing to do right now.` and `No work is ready.` were
rejected because they assert more than an empty input proves.

## Coverage gaps and limitations

- There is no new live CLI/Home-shell integration test. The changed decision is
  pure, and the existing shell passes the menu string into the already-tested pure
  composer without rewriting it. Importing `home-shell.ts` would pull BAML-bearing
  play modules onto the pure test path for no additional decision coverage.
- The exact sentence is duplicated in two tests intentionally. Tests do not import
  an implementation constant, so they independently gate user-visible copy.
- The all-hidden branch still contains internal vocabulary (`salient actions`). It
  is a distinct state and explicitly outside this ticket; its existing next-move
  guidance remains intact.

None of these limitations blocks the ticket acceptance.

## Open concerns

No critical issue, TODO, or follow-up is required for this ticket.

The only subjective element is the exact plain sentence because the ticket did not
provide prescribed copy. The selected wording is grounded in the epic's
kitchen-table legibility goal and the renderer's narrow evidence boundary.

## Critical issues for human review

None.

There is no red acceptance item, failing gate, uncommitted ticket-owned source,
schema migration, destructive change, security concern, or cross-ticket file
collision to escalate. The human reviewer may still sanity-check the subjective
copy choice, but that is a wording preference rather than a correctness blocker.

## Repository state

Ticket-owned files are clean after commit.

General working-tree status still contains Lisa/sibling-managed paths:

- `.lisa/provenance.jsonl`.
- Both T-075 active ticket files.
- `docs/active/work/T-075-03-01/`.
- `docs/active/work/T-075-03-02/`.

Those are outside the source commit and were not modified or cleaned by this
worker. Lisa owns ticket transitions and artifact publication.

## Final assessment

The ticket is green, committed, and ready for Lisa's completion publication. All
six RDSPI artifacts exist in the private attempt directory. Stop on this ticket;
do not begin another ticket until Lisa confirms completion.
