# T-067-01-03 — bare-code-write-guard — Progress

## Completed

- [x] **Step 1 — mint `bare-code` outcome** (`src/log/run-log.ts`): tuple member added
  between `graph-invalid` and `errored`, provenance doc comment extended. run-log.test.ts
  green (79/79) — `test.each(RUN_OUTCOMES)` derived the new case automatically.
- [x] **Step 2 — pure detector + typed error** (`src/play/materialize.ts`): `BARE_CODE`
  regex beside `PROSE_CODE` (lockstep comment), `BareCodeHit`, `findBareCodes` (policed
  prefixes = {P, N} floor ∪ snapshot-key prefixes), `BareCodeError` (IdCollisionError
  pattern). 8 pure unit tests in materialize.test.ts, all green.
- [x] **Step 3 — verb reorder + guard throw**: `materialize` now renders ALL files into
  memory after the collision guard and snapshot build, runs `findBareCodes`, throws
  `BareCodeError` on hits, and only then mkdirs and writes from the rendered arrays.
  Real-fs tests: refusal (dirs ENOENT — the throw precedes even mkdir), guard order
  (collision wins over bare code), pass side (glossed advances line asserted on disk).
- [x] **Step 4 — fixture charters bold-shaped**: `story-gate-cast.test.ts` and
  `chain-propose-decompose.test.ts` `CHARTER` consts converted from prose shape (empty
  snapshot) to bold DEFINITION shape, same codes, with a why-comment each.
- [x] **Commit A** `0859156` — steps 1–4, `bun run check` 1565 pass / 1 pre-existing
  skip / 0 fail.
- [x] **Step 5 — effect relabel** (`src/play/decompose-epic.ts`): `BareCodeError`
  instanceof arm in `decomposeEffect`'s catch → `{ok:false, outcome:"bare-code",
  detail:"bare-code — charter cannot resolve cited code(s): <file: codes; …>"}`; doc
  comment bullet added.
- [x] **Step 6 — cast-level proof** (`src/play/bare-code-cast.test.ts`, new): refusal
  cast (prose-cited P9 clears all five REAL gates, guard refuses, outcome `bare-code`,
  zero output, run-log record pinned) + grep-clean cast (full five-section-story plan →
  success, every written body matched against the bare-P/N grep, positive glossed-line
  asserts so the grep is not vacuous).
- [x] **Commit B** `9f4b208` — steps 5–6, `bun run check` 1567 pass / 1 skip / 0 fail.

## Remaining

Nothing — review.md is the last artifact.

## Deviations from plan

1. **`BARE_CODE` trailing boundary is `(?![0-9A-Za-z])`, not `\b`** (plan step 2 said
   "PROSE_CODE's shape"). Found by the failing floor test: `_Advances: P1_` ends in an
   italic underscore, `_` is a word character, so `\b` never fires after `P1` and the
   exact -02 handoff counterexample escaped the guard. The widened boundary catches it;
   widening only ever FLAGS more, never writes more. Documented on the const and mirrored
   in the cast test's grep.
2. **Real-fs refusal fixtures build plans via `ticket({purpose: …})` instead of mutating
   `workPlan()` output** — avoids assigning through the (possibly readonly) generated
   draft types; no behavioral difference.
3. The plan's step-3 test "pass" folded into the existing fresh/disjoint test (as the
   plan itself anticipated) rather than a new test.

## Verification record

- `bun test src/play/materialize.test.ts` — 31 pass.
- `bun test src/play/bare-code-cast.test.ts` — 2 pass; refusal andon stdout observed:
  `· effect ✗ bare-code — charter cannot resolve cited code(s): T-900-01.md: P9`.
- `bun run check` (baml:gen + tsc + lint + full suite) green at both commits.
