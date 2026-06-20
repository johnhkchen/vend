# T-023-01 — Progress: top-pick-stability-probe

Tracks the Implement phase against `plan.md`. No deviations from the plan.

## Step 0 — Baseline gate ✅
`bun run check` before any change: **743 pass / 0 fail**, tsc clean. Tree green pre-work.

## Step 1 — Pure core `src/probe/head-stability.ts` ✅
Written per `structure.md`:
- `HEAD_STABILITY_CLASSES` / `HeadStabilityClass` — closed `head-stable | head-flips | mixed`.
- `HeadStabilityReport` — head-scoped mirror of `EquivalenceReport` (`stablePairs`/`flippedPairs`).
- `extractTopPicks(md, k=1)` + `topPick(md)` — pure parser keyed on `/vend chain "([^"]*)"/g`; total
  on empty/abstention boards and on `k <= 0`.
- `headVerdictsFromExactMatch(heads)` — deterministic per-pair verdicts via `normalizeHead`
  (trim / collapse-whitespace / casefold).
- `classifyHeadStability(verdicts, n)` — delegates the IA-8 e/P math to `classifyEquivalence`, remaps
  the label via a `satisfies Record<EquivalenceClass, HeadStabilityClass>` map (drift ⇒ compile error).
- `formatHeadStabilityReport(r)` — honest one-liner + vacuous / under-coverage `⚠` caveats.
- Imports only the pure `./equivalence.ts`; no fs/addon/play imports (parser reads the rendered
  markdown *string*, not the `Board` type).

## Step 2 — Unit test `src/probe/head-stability.test.ts` ✅
Five groups, **18 tests, all green** (`bun test src/probe/head-stability.test.ts` → 18 pass / 0 fail):
parser (incl. tail-reorder-same-#1, empty board, steer board, k-clamp); the four AC#1 fixtures
(all-same / all-different / mix / tail-reorder end-to-end) + normalization; IA-8 honesty edges
(n<2 vacuous, zero boards, all-stable-short-of-coverage ⇒ mixed); formatter (clean / vacuous /
under-coverage); the closed-set invariant.

## Step 3 — Harness wiring `src/probe/run-equivalence-judge.ts` ✅
Additive only:
- Imported the four head-stability functions.
- Added optional `extractHead?` to `JudgeTarget`.
- Set `extractHead: (o) => topPick(o)` on `surveyTarget` **and** `steerTarget` (identical board
  shape); `expandTarget` left undefined ⇒ head pass skips it.
- In `main()`, after the equivalence print, added the `if (target.extractHead)` block printing two
  labelled lines beside the existing reads: `[lexical exact-match]` (deterministic) and
  `[semantic judge]` (reuses `judgeEquivalence` over JUST the heads).
- Everything above the new block is byte-for-byte unchanged.

## Step 4 — Full gate ✅
`bun run check`: **761 pass / 0 fail** (743 baseline + 18 new), tsc clean, `baml:gen` clean.
Delta is exactly the new head-stability tests; the E-022 consistency + equivalence test paths are
untouched and still green.

## Acceptance criteria
- **AC#1** ✅ — pure core classifies `head-stable | head-flips | mixed` + score; unit-tested on the
  four named fixtures incl. tail-reorder ⇒ head-stable.
- **AC#2** ✅ — harness collects N boards, extracts #1/top-k, casts the judge over just the heads,
  prints the verdict (lexical + semantic) beside the whole-board dispersion + equivalence numbers.
- **AC#3** ✅ — `bun run check` green; `equivalence.ts` / consistency path byte-for-byte; harness
  change purely additive.

## Deviations
None. Plan executed as written.

## Not done (by design, not gating)
The **live sweep** (`bun run src/probe/run-equivalence-judge.ts survey 3`) is the optional Step 5 —
a live cast that produces the actual head-vs-tail data to seed T-023-02's decision. The deliverable
of T-023-01 is the *instrument*, per the measure-then-decide discipline; the live run is left to the
operator (it spends tokens and is excluded from the green-before-merge gate).
