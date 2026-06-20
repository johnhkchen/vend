# T-022-01 — Review: semantic-equivalence-judge

Handoff for a human reviewer. Commit `8edb71f`.

## What changed

Three new files under `src/probe/`. Nothing else in `src/` was touched (`git diff --stat`
confirms it) — every cited module (`run-consistency-probe.ts`, `consistency.ts`,
`variance.ts`, `cast.ts`, `claude.ts`) is byte-for-byte unchanged, so the existing
consistency-probe path is structurally unaffected (AC#3).

| File | LOC | Role |
|---|---|---|
| `src/probe/equivalence.ts` | ~110 | PURE aggregation core — verdicts → classification + score |
| `src/probe/equivalence.test.ts` | ~115 | pure-function test, 12 cases, branch coverage |
| `src/probe/run-equivalence-judge.ts` | ~285 | IMPURE judge harness (not unit-tested) |

Plus the RDSPI work artifacts under `docs/active/work/T-022-01/`.

### The pure core (`equivalence.ts`)

`classifyEquivalence(verdicts, n)` folds per-pair `{ i, j, equivalent }` verdicts into an
`EquivalenceReport`. Design choices worth a reviewer's eye:
- **Per-pair, not per-set** (D1) — mirrors `variance.ts` `PairDiff` so the judge aligns
  one-to-one with the dispersion's pairs.
- **Expected-pairs denominator** (D2/IA-8) — `score = e / (n·(n−1)/2)`, NOT `e /
  verdicts.length`. A judge that returns too few verdicts therefore *lowers* the score and
  the classification drops to `mixed` rather than reading as a clean `equivalent-diversity`.
  Missing evidence is not agreement. This is the load-bearing honesty decision.
- **Three classes** — `equivalent-diversity` (full equivalent coverage), `genuine-
  disagreement` (no equivalent pairs), `mixed` (anything partial, incl. under-coverage). No
  tunable threshold (rejected — would invent a magic number the AC fixtures don't ask for).
- **Vacuous read at n<2** — totalPairs 0 ⇒ score 1, classification `equivalent-diversity`,
  formatter caveats it. Never NaN (the `consistency.ts` zero-safety discipline).

### The impure harness (`run-equivalence-judge.ts`)

Reuses the consistency probe's seed/collect/cast machinery (COPIED, per the self-contained-
instrument idiom the cited file's own header establishes) for the three articulation plays
survey/expand/steer. Casts the play N× on a fixed seeded input (disposable temp root, no
real-ledger pollution), then casts a judge over the SIGNAL outputs via the `dispense` seam
and prints `formatEquivalenceReport(...)` **beside** the existing
`formatConsistencyReport(...)` dispersion line (AC#2). New verbs: `buildJudgePrompt`
(per-pair JSON, definitions spelled out), `parseVerdicts` (tolerant — drops malformed /
out-of-range / duplicate-pair entries), `judgeEquivalence` (dispense + parse).

## Test coverage

- **Pure core: fully covered.** 12 tests over fabricated verdicts (no fs/addon/live cast).
  Every branch of `classifyEquivalence` (the three AC fixtures, n<2, zero outputs, under-
  coverage→mixed, single-pair full coverage) and `formatEquivalenceReport` (clean line +
  both `⚠` caveat paths) and the closed-set sanity. **AC#1 satisfied.**
- **Impure harness: typecheck + CLI-smoke only**, by house rule (its impure verbs —
  `castPlay`, `dispense`, fs — are proven live, not unit-tested; the judgment they feed is
  the tested core). Verified: `tsc --noEmit` clean; no-args → usage + exit 2; unsupported
  play → message + exit 2. No live cast runs in the check.
- **Whole suite:** `bun run check` → 743 pass / 0 fail (731 baseline + 12). `check:committed`
  and `check:head` both ok. **AC#3 (`check:*` green) satisfied.**

## Open concerns / limitations

1. **The judge harness is unproven end-to-end.** Like `run-consistency-probe.ts` and
   `run-rubric-probe.ts`, a real sweep spends subscription credits and is non-deterministic,
   so it is not in CI. An operator should run e.g.
   `bun run src/probe/run-equivalence-judge.ts survey 5` once to confirm the live judge cast
   parses and the classification prints beside the dispersion. Until then the *harness*
   (prompt wording, `parseVerdicts` against a real reply) has only been typecheck-verified.
2. **Judge reliability is the model's, not the meter's.** The pure core is honest about what
   it was *told*; whether the model's per-pair equivalence calls are themselves correct is
   out of scope here. `parseVerdicts` keeps the first verdict per pair and silently drops the
   rest — a deliberate tolerate-noise choice, but a malformed reply degrades to `mixed` +
   an under-coverage caveat rather than an error. That is the intended honest-degrade path.
3. **Copied seeding ≈ duplication.** The seed/collect/cast helpers are copied from
   `run-consistency-probe.ts` (the established probe idiom), so a future change to the seeding
   discipline must be made in both instruments. This is the accepted cost of self-contained
   instruments; flagged, not a defect.
4. **No `mixed`-threshold knob.** If E-022's contract later wants "≥X% equivalent still
   counts as diversity", that is a deliberate follow-up — the score is already exposed on the
   report for a downstream gate to threshold without touching the classifier.

## Nothing flagged for urgent human attention

The change is additive (three new files), the cited modules are untouched, and all `check:*`
gates pass. Recommended next step: one operator sweep per play (survey/expand/steer) to
exercise the live judge cast and record the first equivalence reads beside the E-020/E-022
dispersion numbers.
