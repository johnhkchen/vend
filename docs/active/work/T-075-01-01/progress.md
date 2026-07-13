# Progress — T-075-01-01 extend-face-jargon-classifier

## Status

Implementation is complete, committed, and all requested behavior is green.

## Step 1 — regression proof

Completed in:

- `src/present/translate.test.ts`
- `src/present/svg-file.test.ts`

Added pure classifier cases for:

- leading-title `Baml`;
- embedded lowercase `baml`;
- leading-title `Ci`;
- embedded lowercase `ci`;
- live literal `Claude p`; and
- longer family representative `Claude prompt`.

Each case asserts:

- exact `jargonTokens` output;
- exact `scrubFace` output; and
- zero jargon after scrubbing.

Added a negative boundary case proving `Cites circular decisions` is unchanged, so the CI class
does not consume ordinary words beginning with the same letters.

Added the story-level live-board assertion in `svg-file.test.ts`:

- load the canonical live board;
- project through `DESIGNER_PRESET`;
- call shared `faceJargon` on every card;
- collect `{id, jargon}` diagnostics; and
- assert the collection is empty.

## Red observation

Command:

```bash
bun test src/present/translate.test.ts src/present/svg-file.test.ts
```

Before the production classifier edit:

- 33 tests passed;
- 1 test failed;
- failure was the first new family case;
- `jargonTokens("Baml plans stay")` returned `[]` instead of `["Baml"]`.

This pinned the intended classifier gap before implementation.

The live-board assertion was green under the old policy because `faceJargon` and `scrubFace` share
the same incomplete classifier. That is expected and is why the direct family tests are the
non-vacuous red proof; after the classifier extension, the live assertion proves composition.

## Step 2 — classifier implementation

Completed in `src/present/translate.ts`.

Changes are limited to `JARGON_CLASSES` and comments:

- `bamlSap` now uses `gi`, recognizing case variants created by title humanization;
- new `ci` class uses `/\bCI\b/gi` for only the standalone acronym; and
- new `claudeP` class uses `/\bClaude\s+p\w*\b/gi` for the named phrase family.

Unchanged:

- `matchClass`;
- `jargonTokens`;
- `scrubFace` cleanup;
- `projectNode`;
- `projectGraph`;
- `DESIGNER_PRESET`;
- SVG rendering; and
- canonical graph files.

## Focused green verification

Command:

```bash
bun test src/present/translate.test.ts src/present/svg-file.test.ts
```

Result:

- 34 tests passed;
- 0 failed;
- 124 assertions.

## Live-board observation after implementation

The Research-identified cards now project as:

| Card | Clean face title | Other visible fields |
|---|---|---|
| `T-001-02` | `dispense seam` | state/breakdown unchanged |
| `T-002-01` | `decompose epic function` | state/breakdown unchanged |
| `T-002-01-01` | `module bootstrap` | state/breakdown unchanged |
| `T-009-01` | `propose epic function` | state/breakdown unchanged |
| `T-036-01` | `Open model client` | state/breakdown unchanged |
| `T-062-03` | `Release tarball sha` | state/breakdown unchanged |

Aggregate live `faceJargon` result: `[]`.

No sentence-recapitalization was added after stripping a leading term. That keeps the existing
scrubber behavior and preserves the remaining non-jargon bytes exactly.

## Full gate

Command:

```bash
bun run check
```

Result:

- BAML code generation succeeded;
- TypeScript typecheck succeeded;
- 1,744 tests passed;
- 1 optional release-acceptance test skipped because no `dist/` artifacts were present;
- 0 tests failed;
- 5,495 assertions;
- full gate exit code 0.

## Deviations from plan

No implementation-scope deviation.

One expected testing nuance was observed: because `faceJargon` intentionally shares the same
classifier as `scrubFace`, the newly added live empty assertion cannot fail until the classifier
knows the missing family. The pure family test supplied the red signal; the live assertion supplies
the requested end-to-end acceptance proof after implementation.

## Commit

Committed through Lisa's isolated ticket transaction:

```text
934a21eedd2141cabbd2426676fb329f23f65e15
fix(present): strip residual face jargon (T-075-01-01)
```

Exact included paths:

- `src/present/translate.ts`
- `src/present/translate.test.ts`
- `src/present/svg-file.test.ts`

Post-commit inspection confirms only those three paths are in the commit and all three are clean.
Remaining worktree modifications belong to Lisa phase transitions or concurrent tickets.

## Remaining implementation actions

- Write `review.md` with the final handoff.
