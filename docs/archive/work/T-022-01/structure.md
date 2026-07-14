# T-022-01 — Structure: semantic-equivalence-judge

File-level blueprint. Three new files, zero modifications to existing files (the AC#3
"extend, don't break" guarantee is structural: nothing cited is touched).

## Files

| File | Status | Role |
|---|---|---|
| `src/probe/equivalence.ts` | **create** | PURE aggregation core (unit-tested) |
| `src/probe/equivalence.test.ts` | **create** | pure-function test over fabricated verdicts |
| `src/probe/run-equivalence-judge.ts` | **create** | IMPURE judge harness (not unit-tested) |

No existing file is modified. `run-consistency-probe.ts`, `consistency.ts`, `variance.ts`,
`cast.ts`, `claude.ts` stay byte-for-byte unchanged.

## `src/probe/equivalence.ts` — the pure core

Header doc-comment in the house voice: states the pure-core ↔ impure-harness split, cites
`consistency.ts` as the sibling, declares PURITY (no fs/clock/network/process/addon; imports
nothing at runtime). Public surface:

```ts
// closed vocabulary → derived union (the PROBE_OUTCOMES / RUBRIC_DIMENSIONS idiom)
export const EQUIVALENCE_CLASSES = ["equivalent-diversity", "genuine-disagreement", "mixed"] as const;
export type EquivalenceClass = (typeof EQUIVALENCE_CLASSES)[number];

// one unordered pair's verdict — mirrors variance.ts PairDiff { i, j, distance }
export interface EquivalenceVerdict {
  readonly i: number;            // index into the judged output set
  readonly j: number;            // j > i (unordered pair)
  readonly equivalent: boolean;  // true ⇒ same intent/work, reworded; false ⇒ different
  readonly reason?: string;      // optional one-phrase rationale (carried, not required)
}

// the whole judge read for one play's N outputs
export interface EquivalenceReport {
  readonly classification: EquivalenceClass;
  readonly score: number;        // e / P ∈ [0,1]; 1 when P === 0 (vacuous), never NaN
  readonly n: number;            // outputs judged
  readonly totalPairs: number;   // P = n·(n−1)/2
  readonly equivalentPairs: number;
  readonly divergentPairs: number;
  readonly verdictsSeen: number; // how many verdicts the core actually received (≤ totalPairs)
}

// PURE entry: aggregate per-pair verdicts over n outputs into a classification + score.
export function classifyEquivalence(verdicts: readonly EquivalenceVerdict[], n: number): EquivalenceReport;

// PURE: render one honest line for the findings note (mirrors formatConsistencyReport).
export function formatEquivalenceReport(r: EquivalenceReport): string;
```

Internal (private) helpers:
- `pct(x)` / score formatting — the `consistency.ts` 2dp / whole-percent idiom.
- `expectedPairs(n)` = `n < 2 ? 0 : (n*(n-1))/2`.

`classifyEquivalence` logic:
1. `total = expectedPairs(n)`.
2. `e = verdicts.filter(v => v.equivalent).length`, clamped to verdicts actually present;
   `divergent = verdicts.length - e`; `verdictsSeen = verdicts.length`.
3. `score = total === 0 ? 1 : e / total` (denominator is the *expected* pair count, so a
   judge that returned too few verdicts cannot inflate the score — missing verdicts count
   against equivalence, the honest-pessimistic choice).
4. classification: `e === total && total > 0 ? equivalent-diversity` … see below.

Classification decision table (drives the test fixtures):

| condition | classification |
|---|---|
| `total === 0` (n < 2) | `equivalent-diversity` (vacuous; formatter caveats) |
| `e === total` (all judged pairs equivalent, full coverage) | `equivalent-diversity` |
| `e === 0` (no equivalent pairs) | `genuine-disagreement` |
| otherwise | `mixed` |

Note coverage subtlety: if the judge returned fewer than `total` verdicts but all were
`equivalent`, `e < total` ⇒ classification is `mixed` (not a clean `equivalent-diversity`),
and the formatter caveats the missing verdicts. This is the honest read — absent evidence is
not agreement.

`formatEquivalenceReport` output shape (one line, mirrors `formatConsistencyReport`):
```
semantic equivalence: equivalent-diversity (score 1.00) — 3 equivalent · 0 divergent of 3 pairs over 3 outputs
```
with appended `⚠` caveats: ` — ⚠ fewer than 2 outputs — classification vacuous` (n<2) and/or
` — ⚠ judge returned 2 of 3 pair verdicts` (verdictsSeen < totalPairs).

## `src/probe/equivalence.test.ts` — the pure test

`bun:test`, no fs/addon. Fixture constructor `v(i, j, equivalent)`. Covers, to the branch:
- AC#1 all-equivalent (3 outputs, 3 equiv pairs) → `equivalent-diversity`, score 1.
- AC#1 all-different (3 pairs, 0 equiv) → `genuine-disagreement`, score 0.
- AC#1 mix (some equiv, some not) → `mixed`, score = e/P.
- n < 2 → `equivalent-diversity`, totalPairs 0, score 1, formatter carries the vacuous `⚠`.
- under-coverage: all-equivalent verdicts but fewer than `totalPairs` → `mixed`, formatter
  carries the "judge returned X of Y" `⚠` (the honesty guarantee).
- `formatEquivalenceReport` clean line has no `⚠`; the two caveat paths each include `⚠`.
- `EQUIVALENCE_CLASSES` is the closed set the report only ever draws from.

## `src/probe/run-equivalence-judge.ts` — the impure harness

Header doc-comment: not unit-tested (house rule, cites `run-consistency-probe.ts`); states
the no-pollution / no-collision invariants and that seeding helpers are COPIED (the
self-contained-instrument idiom). Imports: `dispense` (`../executor/claude.ts`),
`castPlay`/`RunSummary` (`../engine/cast.ts`), `Budget` (`../budget/budget.ts`),
`consistencyReport`/`formatConsistencyReport` (`./consistency.ts`),
`classifyEquivalence`/`formatEquivalenceReport`/`EquivalenceVerdict` (`./equivalence.ts`),
and the three play modules (`survey`, `expand-fragment`, `steer`) + their assembly verbs,
plus the fs/path/os primitives `run-consistency-probe.ts` uses.

Shape (COPIED + trimmed from `run-consistency-probe.ts`):
- `JudgeTarget` = the `ProbeTarget` subset for survey/expand/steer (`play`, `seed`,
  `assemble`, `subject`, `outputDirs`, `isAbstention`). Builders `surveyTarget()`,
  `expandTarget(fragment)`, `steerTarget()` copied verbatim; `resolveTarget(name, input)` +
  `SUPPORTED = ["survey","expand","steer"]`.
- Copied helpers: `initLisaProject`, `seedTempRoot`, `seedCharter`, `seedBoardSnapshot`,
  `collectOutput`, `castN` (returns `ProbeResult[]`), `classifyRun`.
- NEW judge verbs:
  - `buildJudgePrompt(outputs: string[]): string` — labels each output by index and asks
    for a per-pair equivalence JSON array `[{i,j,equivalent,reason}]`, defining
    equivalent-diversity vs genuine-disagreement in the prompt.
  - `parseVerdicts(reply: string, n: number): EquivalenceVerdict[]` — tolerant JSON
    extraction (first `[...]`), coerces/validates entries, drops malformed ones and pairs
    out of range.
  - `judgeEquivalence(outputs, budget): Promise<EquivalenceVerdict[]>` — `dispense` the
    judge prompt under the budget's `timeoutMs`, parse the reply.
- `main(playName, n, tokenBudget?)`: resolve target → seed temp root → `castN` → take the
  signal outputs → print `formatConsistencyReport(consistencyReport(results))` (the existing
  dispersion number) → `judgeEquivalence(signalOutputs)` →
  `formatEquivalenceReport(classifyEquivalence(verdicts, signalOutputs.length))` printed
  **beside** it. `import.meta.main` CLI parsing copied + trimmed (no positional input file:
  survey/steer take none; expand reads a fixed/optional fragment — keep the
  `inputIsNumeric` detection for the expand case).

## Ordering

1. `equivalence.ts` (pure core — nothing depends up on it yet).
2. `equivalence.test.ts` (proves the core; green-before-harness).
3. `run-equivalence-judge.ts` (consumes the core; must typecheck — not unit-tested).

## Boundaries preserved

- Pure core imports nothing at runtime (an ordinary pure-function test).
- Harness is the only impure file; it touches fs (temp root), spawns `claude` via
  `dispense`, and writes only into a disposable temp root (no real-ledger pollution).
- No BAML file, no generated-client change, no modification to any cited module.
