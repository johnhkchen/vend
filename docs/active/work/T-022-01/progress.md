# T-022-01 — Progress: semantic-equivalence-judge

## Status: implementation complete, all checks green

Executed the 4-step plan with no deviations. Baseline 731 tests → 743 (12 new).

## Steps

- [x] **Step 1 — pure core `src/probe/equivalence.ts`.** `EQUIVALENCE_CLASSES` (`as const`)
  + `EquivalenceClass`; `EquivalenceVerdict { i, j, equivalent, reason? }` (mirrors
  `variance.ts` `PairDiff`); `EquivalenceReport`; `classifyEquivalence(verdicts, n)` with the
  expected-pairs denominator (a short judge reply cannot inflate the score) and the D2
  decision table; `formatEquivalenceReport` with the two `⚠` caveat paths (vacuous n<2,
  under-coverage). PURE, imports nothing.
- [x] **Step 2 — pure test `src/probe/equivalence.test.ts`.** 12 tests, branch coverage:
  the three AC#1 fixtures (all-equivalent → diversity / all-different → disagreement / mix →
  mixed), the honesty edges (n<2 vacuous, zero outputs, under-coverage → mixed, single pair
  full coverage), the formatter (clean line + both caveats), and the closed-set sanity.
  `bun test src/probe/equivalence.test.ts` → 12 pass. **AC#1 met.**
- [x] **Step 3 — impure harness `src/probe/run-equivalence-judge.ts`.** Copied the
  temp-root/seed/collect/cast machinery + the survey/expand/steer targets from
  `run-consistency-probe.ts` (self-contained-instrument idiom), trimmed to the three
  articulation plays. Added the judge verbs: `buildJudgePrompt` (labels outputs by index,
  asks for per-pair equivalence JSON with the diversity/disagreement definitions spelled
  out), `parseVerdicts` (tolerant JSON extraction, drops malformed / out-of-range / duplicate
  pairs), `judgeEquivalence` (dispense under the budget wall-clock → parse). `main` prints the
  judge classification **beside** the existing dispersion (`consistencyReport`). **AC#2 met.**
- [x] **Step 4 — full check + commit.** `bun run check` (baml:gen → tsc --noEmit → bun test)
  → 743 pass, 0 fail. `git diff --stat src/` shows only the three new files — every cited
  module (`run-consistency-probe.ts`, `consistency.ts`, `variance.ts`, `cast.ts`,
  `claude.ts`) is byte-for-byte unchanged. **AC#3 met.**

## Deviations from plan

- **Default fragment path corrected.** `run-consistency-probe.ts` pins the grounded fragment
  at `…/T-019-02/fixtures/grounded-fragment.txt` (under `fixtures/`), not the path the plan
  first guessed. Fixed the `GROUNDED_FRAGMENT_PATH` constant after a one-line `ls` check; the
  expand target now defaults to the real fixture. No behavioural impact beyond the default.

No other deviations. The judge cast is LIVE (metered subscription credits), so it is exercised
only on an operator sweep — never in the green check — exactly the status the sibling probe
instruments carry.
