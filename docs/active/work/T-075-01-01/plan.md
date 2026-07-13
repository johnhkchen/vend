# Plan — T-075-01-01 extend-face-jargon-classifier

## Goal

Close the three observed face-jargon families in the shared classifier and prove both the pure
policy and the live board under `DESIGNER_PRESET`, without changing field routing or unrelated
face content.

## Step 1 — establish regression tests

Modify `src/present/translate.test.ts`.

- Add family fixtures for mixed-case BAML.
- Add family fixtures for standalone mixed-case CI.
- Add family fixtures for `Claude p` and a longer `Claude p...` phrase.
- Assert the exact tokens returned by `jargonTokens`.
- Assert the exact plain remainder returned by `scrubFace`.
- Assert cleaned output has no jargon tokens.
- Add a negative boundary case for ordinary `ci...` words.

Modify `src/present/svg-file.test.ts`.

- Import the shared `faceJargon` predicate.
- Load the real board.
- Project it with `DESIGNER_PRESET`.
- Fold all projected cards into a diagnostic leak list.
- Assert the list is empty.

Verification:

```bash
bun test src/present/translate.test.ts src/present/svg-file.test.ts
```

Expected before production edit: the new family tests fail, and the live assertion exposes the
newly classified gap only after policy recognizes it. Because write and read share one classifier,
the pure family cases are the direct red proof; the integration case becomes the composition gate.

## Step 2 — extend the pure classifier

Modify only `JARGON_CLASSES` and its comments in `src/present/translate.ts`.

- Add `i` to `bamlSap` while retaining `g`.
- Add exact standalone `ci` with `gi`.
- Add token-bounded `claudeP` with `gi`.
- Do not change `matchClass`, `jargonTokens`, `scrubFace`, or `projectNode`.

Focused verification:

```bash
bun test src/present/translate.test.ts src/present/svg-file.test.ts
```

Success criteria:

- Every family fixture passes.
- Ordinary `ci...` words remain unchanged.
- The live projection returns no leak entries.
- Existing presentation tests in both files stay green.

## Step 3 — inspect behavioral scope

Run a read-only live projection diagnostic if useful.

- Confirm the six Research-observed cards no longer carry classified tokens.
- Confirm their remaining titles preserve the non-jargon words in order.
- Confirm state/breakdown behavior is unchanged.
- Inspect `git diff` to ensure no routing/rendering code moved.

Expected affected plain titles:

- `Claude p dispense seam` → `dispense seam`
- `Baml decompose epic function` → `Decompose epic function`
- `Ci module bootstrap` → `Module bootstrap`
- `Baml propose epic function` → `Propose epic function`
- `Open model baml client` → `Open model client`
- `Release ci tarball sha` → `Release tarball sha`

Capitalization follows the existing scrubber; it does not re-sentence-case after a removed leading
token. Inputs already carry uppercase following words in the observed leading-token titles because
the canonical title's second word is lower-case; expected exact behavior must be confirmed in test
output rather than invented by a new formatter.

## Step 4 — full repository gate

Run:

```bash
bun run check
```

This is the required BAML codegen + typecheck + full suite gate.

If red:

- distinguish ticket regression from unrelated concurrent work;
- fix only ticket-owned failures;
- document any unavoidable external concern honestly;
- rerun the full gate before commit.

## Step 5 — record implementation progress

Write `.lisa/attempts/T-075-01-01/1/work/progress.md` with:

- completed steps;
- focused and full test results;
- exact source files changed;
- any deviations from this plan;
- acceptance status before commit.

Do not write to `docs/active/work/T-075-01-01/`.

## Step 6 — commit ticket-owned unit through Lisa

First inspect the Lisa command syntax with `lisa commit-ticket --help` if needed.

Commit one cohesive unit with exact repository-relative include paths only:

```text
src/present/translate.ts
src/present/translate.test.ts
src/present/svg-file.test.ts
```

Rules:

- use `lisa commit-ticket`, not `git commit`;
- do not use `git add`, `git add -A`, or the ordinary index;
- do not include Lisa-owned ticket frontmatter changes;
- do not include another ticket's files;
- do not leave any ticket-owned file staged, modified, or untracked.

## Step 7 — post-commit verification

- Inspect `git status --short`.
- Inspect the new commit summary/diff.
- Verify the three ticket-owned files are clean.
- Allow Lisa-owned phase files for this and other active tickets to remain modified.
- Confirm the commit contains only the exact include paths.

## Step 8 — Review

Write `.lisa/attempts/T-075-01-01/1/work/review.md`.

Cover:

- classifier changes;
- pure family coverage;
- live-board empty-`faceJargon` proof;
- unchanged routing/content boundary;
- full gate result;
- commit identity;
- gaps, limitations, and open concerns.

Then stop on this ticket. Do not start another ticket while awaiting Lisa's completion publication
and seat release.

## Acceptance checklist

- [ ] `translate.test.ts` covers BAML casing family.
- [ ] `translate.test.ts` covers standalone CI casing family.
- [ ] `translate.test.ts` covers Claude-p phrase family.
- [ ] Boundary test prevents `CI` prefix overmatching.
- [ ] Live board projected through `DESIGNER_PRESET` has empty `faceJargon`.
- [ ] Plain words around removed tokens remain exact.
- [ ] `projectNode`/`projectGraph` routing is untouched.
- [ ] `bun run check` is green.
- [ ] Exact ticket-owned paths are committed with Lisa.
- [ ] `progress.md` and `review.md` are complete in the attempt directory.
