# T-023-01 — Plan: top-pick-stability-probe

Ordered, independently-verifiable steps. Testing strategy follows the house split: the pure core is
unit-tested to the branch; the impure harness is not (proven by running the sweep).

## Testing strategy (up front)

- **Unit-tested (pure):** `head-stability.ts` — parser, deterministic verdicts, tally, formatter.
  All of AC#1 lives here. `bun test` over fabricated fixtures; no fs/clock/addon/live cast.
- **Not unit-tested (impure):** the `run-equivalence-judge.ts` edit — the `extractHead` hook + the
  head block. House rule for `run-*.ts`. Verified by `tsc --noEmit` (it typechecks) and, optionally,
  a live `bun run src/probe/run-equivalence-judge.ts survey 3` sweep (live cast — not part of the
  green-before-merge gate).
- **Gate:** `bun run check` (`baml:gen && tsc --noEmit && bun test`) green; the E-022 consistency +
  equivalence paths unaffected (AC#3).

## Step 0 — Baseline gate

Run `bun run check` and record the pass count **before** any change, so a regression is attributable.
Confirms the tree is green pre-work (expected ~743 from the E-022 sweep memory; verify, don't assume).

## Step 1 — Pure core: `src/probe/head-stability.ts`

Write the module per `structure.md`:
- Module header (house style: the head-isolating sibling of `equivalence.ts`; IA-17 motivation;
  PURE banner; imports only `./equivalence.ts`).
- `HEAD_STABILITY_CLASSES` / `HeadStabilityClass`.
- `HeadStabilityReport`.
- `extractTopPicks(md, k=1)` + `topPick(md)` — regex over `vend chain "([^"]*)"`, total on empty.
- `headVerdictsFromExactMatch(heads)` — normalize + per-pair boolean.
- `classifyHeadStability(verdicts, n)` — delegate to `classifyEquivalence`, remap label, rename the
  pair fields.
- `formatHeadStabilityReport(r)` — honest line + IA-8 caveats.

**Verify:** `tsc --noEmit` clean (module compiles standalone against `equivalence.ts`).
**Commit:** "feat(probe): pure top-pick stability core (T-023-01)".

## Step 2 — Unit test: `src/probe/head-stability.test.ts`

Write the five groups from `structure.md`:
1. `extractTopPicks` / `topPick` — incl. the tail-reorder-same-#1 and empty-board cases, and a steer
   board fixture (shared shape).
2. `classifyHeadStability` AC#1 fixtures — all-same / all-different / mix / tail-reorder-end-to-end.
3. honesty edges (IA-8) — n<2 vacuous; under-coverage ⇒ mixed; expected-pairs denominator.
4. `formatHeadStabilityReport` — clean line / vacuous caveat / under-coverage caveat.
5. `HEAD_STABILITY_CLASSES` closed-set.

**Verify:** `bun test src/probe/head-stability.test.ts` all green; the full `bun test` still green
(delta = the new tests only).
**Commit:** "test(probe): branch-complete head-stability unit tests (T-023-01)".

## Step 3 — Harness wiring: `src/probe/run-equivalence-judge.ts`

Additive edit per `structure.md` D5:
- Import the four head-stability functions + `topPick`.
- Add `extractHead?` to `JudgeTarget`.
- Set `extractHead: topPick` on `surveyTarget` and `steerTarget`; leave `expandTarget` undefined.
- In `main()`, after the equivalence print, add the `if (target.extractHead)` block printing the
  lexical + semantic head reads beside the existing numbers.

**Verify:** `tsc --noEmit` clean; the existing dispersion + equivalence prints are textually
unchanged (read the diff — only additions). No unit test (house rule).
**Commit:** "feat(probe): print top-pick stability beside whole-board reads (T-023-01)".

## Step 4 — Full gate + acceptance check

- `bun run check` green; pass count = baseline + the new head-stability tests, zero failures.
- Walk the three ACs:
  - **AC#1** — pure core classifies head-stable/head-flips/mixed + score, unit-tested on the four
    named fixtures (incl. tail-reorder ⇒ stable). ✅ via Steps 1–2.
  - **AC#2** — harness collects N boards, extracts #1/top-k, casts the judge over just the heads,
    prints the head verdict beside dispersion + equivalence. ✅ via Step 3 (typechecked; runnable).
  - **AC#3** — `check:*` green; E-022 paths byte-for-byte (only additive harness lines). ✅.
- Record results in `progress.md`.

## Step 5 — (Optional, not gating) live confirmation

If a live sweep is desired to seed T-023-02's decision:
`bun run src/probe/run-equivalence-judge.ts survey 3` — prints dispersion, whole-board equivalence,
and the two head reads. This is the measurement that tells T-023-02 whether the head is stable
(amend IA-17) or flips (build the consensus-cast lever). **Not** run as part of this ticket's gate
(live cast, tokens) unless explicitly requested — the deliverable is the *instrument*, per the
measure-then-decide discipline.

## Risks / watch-items

- **Parser brittleness** — keyed on `vend chain "…"`, the stable shared contract across survey +
  steer effects. If the effect prose changes, the parser test (Step 2) breaks loudly — intended.
- **Judge prompt reuse** — `buildJudgePrompt` says "the same play produced … propose the SAME work";
  over single head lines this still asks the right question (same proposed #1 pull). Documented as
  intentional reuse in the harness comment.
- **Label-map drift** — `classifyHeadStability` depends on `EQUIVALENCE_CLASSES` values; the map is
  exhaustive over the three known classes. A `satisfies Record<EquivalenceClass, HeadStabilityClass>`
  annotation makes a future class addition a compile error, not a silent miss.
