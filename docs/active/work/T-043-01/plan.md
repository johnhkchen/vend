# T-043-01 — Plan: ordered, verifiable steps

Each step compiles on its own; tests are added with the code they cover. Commit after each green unit.

## Step 1 — Pure `findExistingByTitle` in `id-guard.ts`

- Add `normalizeTitle` (private) + `findExistingByTitle` (exported), per Structure File 1.
- **Test (same commit):** extend `id-guard.test.ts` with the `findExistingByTitle` describe block
  (match → id; E-041/E-042 fixture; no-match → null; case/whitespace normalization; blank → null;
  empty existing → null; first-match determinism; frozen-input purity).
- **Verify:** `bun test src/play/id-guard.test.ts` green; `tsc --noEmit` clean.
- **Commit:** `feat(id-guard): pure findExistingByTitle title-dedup oracle (T-043-01)`.

## Step 2 — Titled board read `listEpicIdTitlesIn` in `project-context.ts`

- Add `EpicIdTitle` + `listEpicIdTitlesIn`, per Structure File 2. `listIdsIn` untouched.
- **Test (same commit):** extend `project-context.test.ts` — against a temp dir seeded with a couple
  of `E-0XX.md` files carrying real `title:` frontmatter, assert `listEpicIdTitlesIn` returns the
  `{id,title}` pairs (basenames as ids); a missing dir → `[]`; a file with no `title:` line → `title:
  ""`. (Check `project-context.test.ts` for the existing temp-dir helper and mirror it.)
- **Verify:** `bun test src/play/project-context.test.ts` green; `tsc --noEmit` clean.
- **Commit:** `feat(project-context): listEpicIdTitlesIn — titled board read (T-043-01)`.

## Step 3 — Wire adopt-before-mint into `proposeEpicEffect`

- Swap imports (`listIdsIn` → `listEpicIdTitlesIn`; add `findExistingByTitle`).
- Read the board once via `listEpicIdTitlesIn`; adopt branch returns the existing path when
  `findExistingByTitle` hits; else derive `live = liveEpics.map(e => e.id)` and mint unchanged.
- Update the module-header ID POLICY block with the idempotency paragraph.
- **Verify:** `tsc --noEmit` clean; existing `propose-effect.test.ts` still green (the new-title path
  is byte-identical, so the mint/round-trip tests must still pass).
- **Commit:** `feat(propose-effect): adopt same-title epic before minting (T-043-01)`.

## Step 4 — AC#3 deterministic double-run proof in `propose-effect.test.ts`

- Add the idempotency describe block, per Structure File 5: double-run-same-card → one file, second
  adopts; two distinct titles → two files; (optional) adopt on a populated board.
- **Verify:** `bun test src/play/propose-effect.test.ts` green.
- **Commit:** `test(propose-effect): AC#3 title-keyed idempotency double-run proof (T-043-01)`.

## Step 5 — Full gate + record the adopt-vs-refuse call

- Run `bun run check` (baml:gen + typecheck + full test suite). Fix any fallout.
- Confirm `progress.md` records the **adopt** decision (AC#4) — already argued in `design.md` D1;
  restate the one-line call in `progress.md`/`review.md`.
- **Commit (if any test-file/source churn from the full run):** fold into the prior commits or a
  final `chore` — but only if the suite required a change.

## Testing strategy

- **Unit, pure (no addon):** `findExistingByTitle` — every branch, frozen-input purity. The cheapest,
  highest-confidence coverage; mirrors `detectCollisions`'s test.
- **Unit, impure temp-dir (no addon — type-only BAML):** `listEpicIdTitlesIn` (fs read) and the
  `proposeEpicEffect` double-run (end-to-end against a real `mkdtemp` board). This is the AC#3 proof
  "running twice … mints once" with **no live model**.
- **Regression:** the existing `propose-effect.test.ts` mint/round-trip/disjoint cases prove the
  new-title path is unchanged.
- **Full suite:** `bun run check` green = AC#5.

## AC traceability

| AC | Satisfied by |
|---|---|
| Pure total `findExistingByTitle` beside `detectCollisions`, no fs | Step 1 |
| Effect adopts existing same-title; new-title mints `nextEpicId` unchanged | Step 3 |
| Deterministic proof: twice → one mint; two distinct titles → two; mapped to E-041 | Step 4 |
| `detectCollisions`/E-004 + decompose guard unchanged; adopt-vs-refuse recorded | Steps 1–3 + design.md D1 / progress.md |
| `bun run check:*` green | Step 5 |

## Rollback

Each step is one commit on a self-contained export; reverting Step 3 alone restores the pre-idempotent
effect while leaving the pure oracle and titled read in place (harmless, unused).

## Risks during implementation

- `project-context.test.ts` helper shape unknown until opened — mirror whatever temp-dir idiom it
  uses (Step 2). If it has none, write a local `mkdtemp` helper as `propose-effect.test.ts` does.
- `(\S+)` title capture assumes single-token slugs (true for all board cards + `renderCard` output).
  If a hand-authored card ever used a quoted/multi-word title, adoption would compare only the first
  token — acceptable (worst case: a miss → mint, no regression), noted in Review.
