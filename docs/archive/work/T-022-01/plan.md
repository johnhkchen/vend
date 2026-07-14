# T-022-01 — Plan: semantic-equivalence-judge

Ordered, independently-verifiable steps. Testing strategy follows the house split: the
pure core is unit-tested to the branch; the impure harness is proven by typecheck only
(house rule — its judgment is the tested core). One atomic commit at the end (the cited
cores stay untouched, so there is no risky interleaving to stage separately).

## Step 1 — Pure core: `src/probe/equivalence.ts`

Write the aggregation core per `structure.md`:
- `EQUIVALENCE_CLASSES` (`as const`) + `EquivalenceClass`.
- `EquivalenceVerdict { i, j, equivalent, reason? }`.
- `EquivalenceReport { classification, score, n, totalPairs, equivalentPairs,
  divergentPairs, verdictsSeen }`.
- `classifyEquivalence(verdicts, n)` — `expectedPairs(n)` denominator; score = e/total
  (1 when total 0); classification per the decision table (vacuous diversity at n<2;
  `equivalent-diversity` only on full equivalent coverage; `genuine-disagreement` at e=0;
  else `mixed`).
- `formatEquivalenceReport(r)` — one honest line + the two `⚠` caveat paths.

**Verify:** `tsc --noEmit` clean for this file (run as part of Step 2's `bun test` /
`bun run check:typecheck`).

## Step 2 — Pure test: `src/probe/equivalence.test.ts`

Cover every branch of `classifyEquivalence` + `formatEquivalenceReport`:
1. all-equivalent (n=3, 3 equiv pairs) → `equivalent-diversity`, score 1, no `⚠`.
2. all-different (n=3, 0 equiv pairs) → `genuine-disagreement`, score 0.
3. mix (n=3, e=1) → `mixed`, score ≈ 0.33.
4. n<2 → `equivalent-diversity`, totalPairs 0, score 1; formatter has the vacuous `⚠`.
5. full coverage but under-count (all-equivalent verdicts, verdictsSeen < totalPairs) →
   `mixed`, formatter has the "judge returned X of Y" `⚠`.
6. `formatEquivalenceReport` clean line shape (contains classification, score, pair tally,
   output count; no `⚠`).
7. `EQUIVALENCE_CLASSES` closed-set sanity.

**Verify:** `bun test src/probe/equivalence.test.ts` green; full `bun test` count grows by
the new tests with 0 failures. **This is AC#1.**

## Step 3 — Impure harness: `src/probe/run-equivalence-judge.ts`

Copy the seeding/collection/target machinery for survey/expand/steer from
`run-consistency-probe.ts` (the self-contained-instrument idiom), then add the judge verbs
(`buildJudgePrompt`, `parseVerdicts`, `judgeEquivalence`) and a `main` that prints the judge
classification beside the dispersion (`consistencyReport`). Wire `import.meta.main` CLI
(play name, N, optional token budget; expand's optional fragment via the `inputIsNumeric`
detection copied from the source).

**Verify:** `bun run check:typecheck` (tsc --noEmit) clean — the harness compiles though it
is not unit-tested. A `bun run src/probe/run-equivalence-judge.ts` with no args prints usage
+ the supported plays and exits non-zero (the CLI guard, no live cast). **This is AC#2**
(the harness exists, casts the judge over the collected outputs, prints classification
beside dispersion). A live sweep is an operator action (metered, like the other probes),
not part of the green check.

## Step 4 — Full check + commit

- `bun run check` (`baml:gen → tsc --noEmit → bun test`) green; existing 731 tests
  unaffected, new equivalence tests pass. **This is AC#3** (`check:*` green; existing
  consistency-probe path untouched — verified by `git diff --stat` showing only the three
  new files).
- Commit all three files in one commit:
  `feat(probe): semantic-equivalence judge over the consistency harness (T-022-01)`.

## Testing strategy summary

| File | How verified | Why |
|---|---|---|
| `equivalence.ts` | unit-tested via `equivalence.test.ts` (branch coverage, fabricated verdicts) | pure judgment — the meter; AC#1 |
| `equivalence.test.ts` | is the test | — |
| `run-equivalence-judge.ts` | typecheck + CLI-usage smoke (no live cast in CI) | impure (spawns `claude`, fs) — house rule: not unit-tested |

No integration test: a live judge cast spends subscription credits and is non-deterministic
(the exact reason the pure/impure split exists). Verification of the harness end-to-end is an
operator sweep, the same status `run-consistency-probe.ts` / `run-rubric-probe.ts` carry.

## Risk / rollback

- Lowest-risk shape: three new files, nothing cited modified. Rollback = delete the three
  files; the repo returns to baseline with no other change.
- Only live dependency is `dispense`'s `claude -p` availability — exercised only on an
  operator sweep, never in the green check, so CI cannot flake on it.
