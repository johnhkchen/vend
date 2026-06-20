# T-023-01 — Review: top-pick-stability-probe

Handoff for a human reviewer. What changed, how it's tested, what to watch. Commit `f58ee52`.

## What changed

| File | Action | Summary |
|---|---|---|
| `src/probe/head-stability.ts` | **create** (~140 ln) | Pure core: board parser + deterministic verdict source + head tally + formatter. |
| `src/probe/head-stability.test.ts` | **create** (18 tests) | Branch-complete pure unit tests (AC#1 + parser + IA-8 edges + formatter). |
| `src/probe/run-equivalence-judge.ts` | **modify** (additive) | `extractHead` hook on survey + steer targets; head-read block in `main()`. |
| `docs/active/work/T-023-01/*` | **create** | RDSPI artifacts (research, design, structure, plan, progress, this review). |

Nothing deleted. `equivalence.ts`, `consistency.ts`, `variance.ts`, the survey/steer plays, and
`run-consistency-probe.ts` are untouched.

## The design in one paragraph

The whole-board equivalence judge (E-022) read the survey play as `genuine-disagreement`, but the
consistency contract (IA-1 / IA-17) only cares whether the **#1 pull** flips, not whether the tail
re-orders. This ticket adds the head-isolating read: a pure parser (`extractTopPicks` / `topPick`)
pulls each board's #1 from the shared `vend chain "<what> — <why>"` block both the survey and steer
effects render; the head tally (`classifyHeadStability`) is the head-scoped re-map of
`classifyEquivalence` — *the same honest e/P arithmetic*, relabeled `head-stable | head-flips |
mixed`. The harness extends E-022's judge in place: it feeds the extracted heads to the *same*
`judgeEquivalence` verb and prints two head reads — a deterministic **lexical** baseline and the
authoritative **semantic** judge read — beside the existing dispersion + whole-board equivalence.

## Test coverage

- **Pure core: fully covered.** 18 tests, all branches:
  - parser — #1 + top-k extraction; **tail-reorder-same-#1 ⇒ identical head** (the load-bearing
    AC#1 case, proven at the extraction layer); empty/abstention ⇒ `[]`/`null`; steer board (shared
    shape); `k` clamp (≤0 ⇒ `[]`, oversized ⇒ all).
  - classifier — the four AC#1 fixtures (all-same/all-different/mix/tail-reorder end-to-end) +
    whitespace/case normalization.
  - IA-8 honesty — n<2 vacuous (score 1, no NaN), zero boards, all-stable-short-of-coverage ⇒
    `mixed` (missing evidence ≠ stability; denominator is *expected* pairs).
  - formatter — clean line / vacuous caveat / under-coverage caveat; closed-set invariant.
- **Impure harness: not unit-tested** — the house rule for `run-*.ts` (the live `castPlay` /
  `dispense` / fs verbs are proven by running, not mocked). Covered by `tsc --noEmit` (it typechecks)
  and the optional live sweep (Step 5). This matches `run-equivalence-judge.ts` and
  `run-consistency-probe.ts` exactly.
- **Gate:** `bun run check` = **761 pass / 0 fail** (743 baseline + 18 new), tsc + baml clean.

## How the ACs are met

- **AC#1** ✅ — pure `classifyHeadStability` → `head-stable | head-flips | mixed` + score; unit-tested
  on every named fixture, including tail-reorder ⇒ head-stable.
- **AC#2** ✅ — harness collects N boards (reusing E-022 seeding/collection), extracts #1/top-k,
  casts the judge over just the heads, prints the verdict beside dispersion + whole-board equivalence.
- **AC#3** ✅ — `check:*` green; `equivalence.ts` + consistency path byte-for-byte; harness purely
  additive (existing prints unchanged).

## Open concerns / things a reviewer should weigh

1. **Parser is keyed on `vend chain "…"`.** This is a deliberate contract bet (D4): the pull-line
   block is identical across survey + steer effects and carries the clean quoted head. If a future
   effect change renames or reformats that block, the parser silently returns `[]` (reads as
   vacuous) — but the **parser test breaks loudly first**, which is the intended tripwire. A reviewer
   who expects the *table* to be the canonical key should note the chain block was chosen for clean
   extraction; both encode the same top-first order.
2. **Judge-prompt reuse over single head lines.** `buildJudgePrompt` says "the same play produced …
   propose the SAME work". Over one-line heads this still asks the right question (same proposed #1
   pull), so it's reused verbatim rather than forking a near-identical prompt. Documented in the
   harness comment; flagged here as an intentional reuse a reviewer might otherwise read as sloppy.
3. **`classifyHeadStability` delegates to `classifyEquivalence`.** This single-sources the IA-8
   honesty math but couples the two cores. The `satisfies Record<EquivalenceClass,
   HeadStabilityClass>` annotation makes any future equivalence-class addition a compile error here,
   so the coupling is enforced, not silent.
4. **Steer enabled "for free."** The ticket is survey-scoped, but steer shares the exact board shape,
   so `extractHead` is wired for it too. This is additive and correct; if a reviewer wants the read
   strictly survey-only, drop the one line on `steerTarget`.

## Not done (by design)

- **The live sweep is not run** as part of this ticket. T-023-01 ships the *instrument*; the actual
  head-vs-tail measurement (`bun run src/probe/run-equivalence-judge.ts survey 3`) spends tokens and
  is excluded from the gate. Running it is the next operator step — its output (lexical + semantic
  head verdict) is the data that decides **T-023-02**'s fork: amend IA-17 if the head is stable, or
  build the consensus-cast convergence lever only if it flips. This is the measure-then-decide
  discipline E-014/E-022 established — the lever is not built before the head is known to move.

## Critical issues needing human attention

None. The gate is green, the change is additive, and the contract-level decision it informs is
explicitly deferred to T-023-02.
