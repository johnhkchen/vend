# T-023-02 — Plan: converge-or-accept-the-head

> Ordered, independently-verifiable steps. The pivot is Step 2 (read the verdict): everything after it
> is branch-selected by the decision rule (design D3). Testing strategy and verification criteria
> per step. Each step is small enough to reason about and, where it touches code, commit atomically.

## Step 1 — Baseline + run the bounded survey head sweep (AC#1)

**Do:** Confirm the gate is green at the starting commit (`bun run check` → expect 761 pass, the
T-023-01 baseline), then run the shipped instrument:

```bash
bun run src/probe/run-equivalence-judge.ts survey 3 2>&1 \
  | tee docs/active/work/T-023-02/sweep-logs/survey-head.log
```

**Verify:** the log ends with four read lines — `run-to-run signal dispersion …`,
`semantic equivalence: …` (whole-board), `top-pick stability: … [lexical exact-match]`, and
`top-pick stability: … [semantic judge]`. Confirm ≥2 casts produced **signal** (not honest-empty /
budget-exhausted) so the head read is non-vacuous (design D6). If `<2` signal boards: re-run once at a
higher token budget (`… survey 3 400000`) before proceeding; if still short, record the
budget-exhaustion honestly in findings and stop at "inconclusive — re-run needed" (do not fabricate a
verdict).

**Risk:** live, non-deterministic, spends credits (~5 min). Mitigated by the disposable temp ledger
(no repo pollution) and the bounded N.

## Step 2 — Read the verdict, select the branch (the pivot)

**Do:** Read the `[semantic judge]` head line (authoritative; design D1/D3) and the `[lexical
exact-match]` line (corroborating). Map to a branch via the D3 table:
`head-stable → Step 3a (accept)`; `head-flips → Step 3b (converge)`; `mixed → Step 3a with the
mixed caveat` (design D6). Note any lexical-vs-semantic divergence as wording-variance evidence.

**Verify:** the chosen branch is justified *by the printed line*, quoted verbatim into `progress.md`
— the path is warranted by the measurement, not chosen to suit it.

## Step 3a — Accept path (head-stable / mixed) — AC#1, AC#2

**Do:**
1. Write `findings.md` (design D7): lead with the measured head verdict (both lines, quoted) + the
   whole-board context (the E-022 0.00 re-scoped to the tail), then the **warranted path
   recommendation-first** (IA-5): *survey's divergence is tail-re-ordering by design; the #1 pull is
   consistent run-to-run; the "converge" verdict is honestly downgraded.* Carry the honest-sample
   block (N=3 → directional; one model/repo/run-to-date; IA-8). For `mixed`, add the partial-split
   caveat and the recommend-but-don't-auto-build framing (D6).
2. Amend **IA-17** (`information-architecture.md`): replace the survey clause + the "lever must first
   isolate…" hook sentence with the resolved finding (survey = *tail-divergence-by-design, #1 pull
   consistent*), citing `work/T-023-02/findings.md`.

**Verify:** `findings.md` answers AC#1 (verdict landed) and AC#3 (honest about sample); IA-17 reads
the new verdict (AC#2 accept-half). No `src/**` change ⇒ the gate is unchanged.

## Step 3b — Converge path (head-flips) — AC#2, AC#3 lever-half

**Do (only if head-flips):**
1. **Pure core first** — `src/probe/consensus.ts` + `consensus.test.ts`: `selectConsensus(heads,
   verdicts, n)` clusters equivalent heads over the verdict graph and returns the agreed top-ranked
   signal + confidence (or honest no-consensus). Unit-test the fixtures (unanimous / plurality /
   no-majority / n<2). **Commit** when `bun test` is green. *Verify: branch-complete, pure, imports
   only `equivalence.ts`.*
2. **Impure harness** — `src/probe/run-consensus.ts`: cast survey N×, judge-gate the heads, call
   `selectConsensus`, **stage one consensus board** whose #1 is the agreed pull. Not unit-tested
   (house rule); `tsc --noEmit` covers it. **Commit.**
3. **Measure the lever (AC#3)** — re-sweep the consensus board's head N× and confirm it is now stable.
   Record the before/after in `findings.md` — no unmeasured success claim.
4. Amend **IA-17** to *survey converged at the head*, with the lever's measured effect.

**Verify:** `bun run check` green **including** `consensus.test.ts`; findings carry the measured
before/after; IA-17 reads "converged at the head" (AC#2 converge-half + AC#3 lever-half).

## Step 4 — Gate + progress (AC#4)

**Do:** `bun run check` (baml:gen + tsc + bun test). Write `progress.md`: what ran, the verdict, the
branch taken, files written, any deviation from this plan + rationale.

**Verify:** check is green. Accept path: 761 pass unchanged (no source touched). Converge path: 761 +
new consensus tests, 0 fail, tsc + baml clean. AC#4 satisfied.

## Step 5 — Review

**Do:** Write `review.md` (~200 lines): files created/modified, the measured verdict + path taken,
test-coverage assessment + gaps, open concerns, anything needing human attention (e.g. "N=3
directional — a 5× re-run could sharpen a borderline read"). Stop — Lisa handles phase transitions.

## Testing strategy (summary)

| Surface | Strategy |
|---|---|
| The sweep run (Step 1) | live verification — read the printed head lines; not unit-tested (the impure-harness house rule) |
| `findings.md` / IA-17 (always) | prose review against the ACs; verdict quoted from the log (auditable) |
| `consensus.ts` (head-flips only) | branch-complete pure unit tests (the `equivalence.test.ts` precedent) |
| `run-consensus.ts` (head-flips only) | `tsc --noEmit` + the live re-sweep; not unit-tested |
| Whole ticket | `bun run check:*` green (AC#4) |

## Verification criteria (the ACs, mapped)

- **AC#1** — Step 1 runs the bounded logged sweep; Step 3a/3b lands the head-vs-tail verdict in
  `findings.md`.
- **AC#2** — Step 3a/3b takes the warranted path: head-stable → IA-17 *tail-divergence-by-design*;
  head-flips → lever built + IA-17 *converged at the head*.
- **AC#3** — every step records N=3 as directional; the lever (if built) carries a measured before/
  after re-sweep, no unmeasured success.
- **AC#4** — Step 4: `bun run check:*` green.
