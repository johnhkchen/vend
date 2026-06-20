# T-023-01 — Structure: top-pick-stability-probe

The file-level blueprint. Shapes and boundaries, not final code.

## Change set

| File | Action | Why |
|---|---|---|
| `src/probe/head-stability.ts` | **create** | The pure core: parser + deterministic verdicts + tally + formatter. |
| `src/probe/head-stability.test.ts` | **create** | Branch-complete unit tests over fixtures (AC#1). |
| `src/probe/run-equivalence-judge.ts` | **modify** | Add `extractHead` hook + the head-read block in `main()` (AC#2). Additive only (AC#3). |

No deletions. `equivalence.ts`, `consistency.ts`, `variance.ts`, `survey*.ts`, `steer*.ts`,
`run-consistency-probe.ts` are untouched.

## `src/probe/head-stability.ts` (pure core)

Module header (house style): what it is (the head-isolating sibling of `equivalence.ts`), the split
it honors, the IA-17 motivation (head, not tail; validity, not lexical), and the PURE banner
(no fs/clock/network/process/addon; imports only the pure `equivalence.ts`).

```
import { classifyEquivalence, type EquivalenceVerdict, type EquivalenceReport } from "./equivalence.ts";

// ── closed vocabulary ──
export const HEAD_STABILITY_CLASSES = ["head-stable", "head-flips", "mixed"] as const;
export type HeadStabilityClass = (typeof HEAD_STABILITY_CLASSES)[number];

// ── report (mirrors EquivalenceReport, head vocabulary) ──
export interface HeadStabilityReport {
  readonly classification: HeadStabilityClass;
  readonly score: number;        // e/P over EXPECTED head pairs (honest-pessimistic, IA-8)
  readonly n: number;            // boards whose head was compared
  readonly totalPairs: number;
  readonly stablePairs: number;  // head-equivalent pairs
  readonly flippedPairs: number; // head-divergent pairs
  readonly verdictsSeen: number;
}

// ── the parser (pure string work; keys on the `vend chain "…"` block, D4) ──
export function extractTopPicks(boardMarkdown: string, k = 1): string[]
export function topPick(boardMarkdown: string): string | null   // = extractTopPicks(md,1)[0] ?? null

// ── deterministic verdict source (D2) ──
export function headVerdictsFromExactMatch(heads: readonly string[]): EquivalenceVerdict[]

// ── the tally (delegates to classifyEquivalence, remaps label — D3) ──
export function classifyHeadStability(verdicts: readonly EquivalenceVerdict[], n: number): HeadStabilityReport

// ── the honest one-liner ──
export function formatHeadStabilityReport(r: HeadStabilityReport): string
```

### Internal shapes

- **`extractTopPicks`** — `boardMarkdown.matchAll(/vend chain "([^"]*)"/g)`, take capture group 1
  for each, trim, return the first `k` (slice). Empty board ⇒ no matches ⇒ `[]`. `k` defaults to 1.
  Negative/zero `k` ⇒ `[]` (defensive). Does **not** normalize the text (callers normalize for
  comparison; the raw head is preserved for display/judge).
- **`headVerdictsFromExactMatch`** — `normalize(s) = s.trim().replace(/\s+/g," ").toLowerCase()`.
  For `i in 0..n`, `j in i+1..n`: push `{ i, j, equivalent: normalize(heads[i]) === normalize(heads[j]) }`.
  No `reason` (the verdict is its own evidence). `n<2` ⇒ `[]`.
- **`classifyHeadStability`** — `const base = classifyEquivalence(verdicts, n);` then
  `classification = LABEL_MAP[base.classification]` where
  `LABEL_MAP = { "equivalent-diversity":"head-stable", "genuine-disagreement":"head-flips", "mixed":"mixed" }`.
  Carry `base.score/n/totalPairs/verdictsSeen`; rename `equivalentPairs→stablePairs`,
  `divergentPairs→flippedPairs`. Single-sources the IA-8 math (D3).
- **`formatHeadStabilityReport`** — head: `top-pick stability: <class> (score X.XX)`; body:
  `<stable> stable · <flipped> flipped of <P> head-pairs over <n> boards`; caveats (same as
  equivalence): `n<2 ⇒ "fewer than 2 boards — classification vacuous"`;
  `verdictsSeen<totalPairs ⇒ "judge returned V of P head-pair verdicts"`; joined under ` — ⚠ `.

### Boundaries

- Imports **only** `./equivalence.ts` (pure). No play imports (the parser keys on the *rendered
  markdown string*, not the `Board` type — so the core never loads the BAML addon and stays
  test-clean). No fs. Mirrors how `consistency.ts` imports only `variance.ts`.

## `src/probe/head-stability.test.ts` (pure unit test)

`import { describe, expect, test } from "bun:test";` + the public surface. Groups:

1. **`extractTopPicks` / `topPick`** — keys the tail-independence proof:
   - a 3-row survey board → `topPick` = the #1 `what — why`; `extractTopPicks(md,3)` = all 3 in order.
   - the **same #1 with a re-ordered tail** → identical `topPick` (AC#1 "tail re-order ⇒ stable" at
     the extraction layer).
   - an empty/abstention board (`# Survey — no demand staged`) → `[]`, `topPick` = `null`.
   - a steer board (same `vend chain` block) → same extraction (free-coverage of the shared shape).
   - `k` clamp: `k=0` ⇒ `[]`; `k` larger than rows ⇒ all rows.
2. **`classifyHeadStability` — the AC#1 fixtures** (via `headVerdictsFromExactMatch` over head lists):
   - all-same-#1 ⇒ `head-stable`, score 1.
   - all-different-#1 ⇒ `head-flips`, score 0.
   - a mix (2 same, 1 different) ⇒ `mixed`, `0<score<1`.
   - tail-reorder boards → extract heads → same #1 ⇒ `head-stable` (end-to-end pure path).
3. **honesty edges (IA-8)** — `n<2` ⇒ vacuous `head-stable`, `totalPairs 0`, score 1, no NaN;
   all-stable verdicts short of full coverage ⇒ `mixed` (missing evidence ≠ stability); denominator
   is expected pairs not verdicts seen.
4. **`formatHeadStabilityReport`** — clean line (no ⚠); vacuous caveat at n<2; under-coverage caveat.
5. **`HEAD_STABILITY_CLASSES`** — the closed set the classification only ever draws from.

Fixtures are inline template strings mimicking `renderStagedBoard` / `renderStagedSteer` output
(table + `## Pull these` block) — small, legible, no fs.

## `src/probe/run-equivalence-judge.ts` (additive harness edit)

1. **Imports** — add `extractTopPicks, headVerdictsFromExactMatch, classifyHeadStability,
   formatHeadStabilityReport` from `./head-stability.ts`.
2. **`JudgeTarget`** — add `readonly extractHead?: (output: string) => string | null;`.
3. **`surveyTarget` / `steerTarget`** — set `extractHead: (o) => topPick(o)` (import `topPick`).
   `expandTarget` leaves it undefined.
4. **`main()`** — after the existing `formatEquivalenceReport` print, append:

```
if (target.extractHead) {
  const heads = signalOutputs.map(target.extractHead).filter((h): h is string => h !== null);
  // lexical baseline (deterministic)
  const lexical = classifyHeadStability(headVerdictsFromExactMatch(heads), heads.length);
  process.stdout.write(`${formatHeadStabilityReport(lexical)}  [lexical exact-match]\n`);
  // semantic (the authoritative head read — reuses the judge over JUST the heads)
  const headVerdicts = await judgeEquivalence(heads, budget);
  const semantic = classifyHeadStability(headVerdicts, heads.length);
  process.stdout.write(`${formatHeadStabilityReport(semantic)}  [semantic judge]\n`);
}
```

   `judgeEquivalence` already returns `[]` for `<2` heads, and `classifyHeadStability` reads that as
   vacuous — so the abstention/short-arm cases are safe with no extra guards.

## Ordering of changes (for `plan.md`)

1. Pure core `head-stability.ts` (compiles standalone against `equivalence.ts`).
2. Test `head-stability.test.ts` (green before any harness edit).
3. Harness wiring (typechecks; not unit-tested — run live or leave to the sweep).
4. `bun run check` green; commit.
