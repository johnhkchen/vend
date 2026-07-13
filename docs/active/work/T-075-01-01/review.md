# Review — T-075-01-01 extend-face-jargon-classifier

## Verdict

PASS. The ticket acceptance criteria and parent-story contract are met.

The shared face-jargon classifier now catches the three named residual families, the pure unit
suite covers every family and important case/boundary variants, and the real live board projected
through `DESIGNER_PRESET` has empty `faceJargon` across every card.

## Commit

```text
934a21eedd2141cabbd2426676fb329f23f65e15
fix(present): strip residual face jargon (T-075-01-01)
```

The commit was created with `lisa commit-ticket` using exact include paths. It contains only:

- `src/present/translate.ts`
- `src/present/translate.test.ts`
- `src/present/svg-file.test.ts`

Commit summary: 3 files changed, 46 insertions, 2 deletions.

## Production change

`src/present/translate.ts` retains `JARGON_CLASSES` as the single source of face vocabulary policy.

Changes:

- `bamlSap` is now case-insensitive (`gi`), so humanized `Baml` and embedded lowercase `baml` are
  treated like existing uppercase `BAML`.
- New `ci` class recognizes only standalone `CI` casing variants with `/\bCI\b/gi`.
- New `claudeP` class recognizes the named `Claude p...` phrase family with
  `/\bClaude\s+p\w*\b/gi`.

No classifier consumer changed. The same classes still back:

- `scrubFace` on the write side;
- `jargonTokens` on the read side;
- `faceJargon` as the card-level acceptance predicate; and
- the existing BAML details extractor through `matchClass`.

This preserves the “one policy, two uses” invariant and prevents scrub/verdict drift.

## Pure test coverage

`src/present/translate.test.ts` adds exact family cases for:

- `Baml plans stay` → `plans stay`;
- `Open model baml client` → `Open model client`;
- `Ci module boots` → `module boots`;
- `Release ci tarball` → `Release tarball`;
- `Claude p dispense seam` → `dispense seam`; and
- `Keep Claude prompt bridge local` → `Keep bridge local`.

Each case pins:

1. the exact token(s) reported by `jargonTokens`;
2. the exact remaining plain text returned by `scrubFace`; and
3. an empty classifier result over the cleaned string.

A negative boundary test pins `Cites circular decisions` byte-identically, proving the CI pattern
does not overmatch ordinary `ci...` words.

Existing exact T-018 face tests continue to pin authored plain title, state, why, and breakdown.
Existing detail-reachability tests remain green.

## Live-board acceptance proof

`src/present/svg-file.test.ts` now:

1. calls `loadWorkGraph()` over the real board;
2. calls `projectGraph(live, DESIGNER_PRESET)`;
3. traverses every projected card;
4. evaluates the shared `faceJargon(card)` predicate; and
5. asserts the diagnostic leak list is empty.

This is the exact integration path named by the ticket. It does not define a second regex policy or
parse serialized SVG bytes. Existing seam tests already prove `writeBoardSvg` renders the direct
designer projection unchanged.

## Observed live outcome

The six Research-observed residual faces now read:

| Card | Before | After |
|---|---|---|
| `T-001-02` | `Claude p dispense seam` | `dispense seam` |
| `T-002-01` | `Baml decompose epic function` | `decompose epic function` |
| `T-002-01-01` | `Ci module bootstrap` | `module bootstrap` |
| `T-009-01` | `Baml propose epic function` | `propose epic function` |
| `T-036-01` | `Open model baml client` | `Open model client` |
| `T-062-03` | `Release ci tarball sha` | `Release tarball sha` |

Aggregate live result: `faceJargon === []` for every card.

State and breakdown fields for these cards are unchanged. The integration path supplies no authored
why overlays, so there is no live why content to alter. Existing unit contracts continue to prove
authored why/breakdown values are byte-exact when they contain no classified jargon.

## Scope discipline

Intentionally untouched:

- `projectNode` field routing;
- `projectGraph` grouping/composition;
- `DESIGNER_PRESET`;
- graph loading/model code;
- SVG layout/rendering;
- canonical `docs/active` titles and bodies;
- audit/ledger/shelf copy owned by sibling stories; and
- the deferred designer render-and-watch probe.

The production diff is confined to classifier entries and comments.

## Verification results

Focused command:

```bash
bun test src/present/translate.test.ts src/present/svg-file.test.ts
```

Result: 34 pass, 0 fail, 124 assertions.

Full repository gate:

```bash
bun run check
```

Result:

- BAML code generation: pass;
- TypeScript typecheck: pass;
- tests: 1,744 pass, 1 skip, 0 fail;
- assertions: 5,495;
- exit code: 0.

The one skip is the pre-existing optional release acceptance case when `dist/` artifacts are absent;
it is unrelated to this ticket.

## Worktree/commit hygiene

- No ordinary `git add` or `git commit` was used.
- Lisa's isolated transaction included only the three ticket-owned files.
- Those three files are clean after commit.
- Lisa-owned ticket phase changes and published work artifacts remain outside the ticket commit.
- Concurrent sibling-ticket edits in ledger/shelf files were not touched or included.

## Concerns and limitations

No acceptance-blocking concern remains.

Two honest notes:

1. Removing a technical token at the start of a humanized title leaves the following plain word in
   its original lowercase form. This is existing `scrubFace` behavior and preserves non-jargon bytes;
   sentence recasing would be a separate vocabulary/formatting policy not requested here.
2. The live empty assertion intentionally shares the same classifier as the scrubber, so the direct
   family unit tests are the non-vacuous coverage that defines what must be caught. The live test then
   proves that policy composes over the actual board, as required.

## Acceptance checklist

- [x] BAML casing family covered in `translate.test.ts`.
- [x] Standalone CI casing family covered in `translate.test.ts`.
- [x] Claude-p phrase family covered in `translate.test.ts`.
- [x] CI boundary overmatch guarded.
- [x] Live board through `DESIGNER_PRESET` yields empty `faceJargon`.
- [x] Plain neighboring content is pinned exactly and otherwise unchanged.
- [x] `projectNode`/`projectGraph` routing is untouched.
- [x] Full `bun run check` is green.
- [x] Ticket-owned source is committed through Lisa with exact include paths.

## Handoff

The ticket is ready for Lisa's Review/Done publication and completion commit. Per assignment, remain
on `T-075-01-01` and do not begin another ticket until Lisa confirms completion and releases the seat.
