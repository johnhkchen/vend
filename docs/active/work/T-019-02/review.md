# T-019-02 — Review: run the sweep and produce findings

Handoff for a human reviewer — what changed, what it found, coverage, and open concerns.

## What changed

**One source edit** (the harness only — the pure core, `variance.ts`, and `run-probe.ts` are
byte-for-byte untouched; T-019-01's AC#3 carries forward, verified by empty `git diff`):

- **`src/probe/run-consistency-probe.ts`** — extended the `ProbeTarget` table from
  `[decompose-epic, survey]` to also cover **expand** and **steer** (the T-019-01 extension seam,
  used exactly as designed):
  - value-imports `expandFragmentPlay`/`assembleExpandFragmentInputs` + `steerProjectPlay`/
    `assembleSteerInputs` (self-register + resolve their assemble verbs);
  - `seedBoardSnapshot(root)` — factored helper copying the live `stories`+`tickets` (the grounded
    id space / demand gradient), reused by the two new targets;
  - `expandTarget(fragment)` — charter + board snapshot; `assembleExpandFragmentInputs`; **default**
    abstention test (expand STOPs ⇒ honest-empty is a non-`success` outcome, deliberately read from
    the raw tally, not the predicate — design D4, documented inline);
  - `steerTarget()` — charter + board snapshot; `assembleSteerInputs`; marker-keyed abstention
    (`# Steer — nothing to stage` / `honest empty steer`);
  - `resolveTarget` is now `async` (expand reads its fragment file); `expand`/`expand-fragment` and
    `steer` cases added; `SUPPORTED` + the usage hint updated.

**New artifacts** (all under `docs/active/work/T-019-02/`):
- `fixtures/grounded-fragment.txt` — the fixed grounded input for expand (a real, evidenced
  observability gap; charter-correct outcome = a clean signal).
- `findings.md` — **the deliverable** (E-014-shaped note + verdict).
- `sweep-logs/{expand,survey,steer}.log` — the raw live evidence (every cast's outcome).
- RDSPI trail: `research.md`, `design.md`, `structure.md`, `plan.md`, `progress.md`, this file.

## What the sweep found (the verdict)

**Consistency is NOT yet acceptable for the articulation plays — tune the gates.** E-016 finding (2)
confirmed and generalized. Two failure modes, plus one vindication:

| Play | dispersion | honest-empty | failure mode |
|---|---|---|---|
| expand | 0.50 / 2 | 33% (raw `gate-failed`) | over-fires **and** content-diverges |
| survey | n=1 | **67%** | honest-empty gate over-fires (false negatives on a demand-rich board) |
| steer | **0.72** / 3 | 0% | content diverges run-to-run (gates don't bound dispersion) |
| budgets | — | — | **vindicated**: 0/9 casts budget-exhausted (E-018 recalibration held) |

The verdict bridges to `demand.md` (AC#3) via **two staged tune signals** (honest-empty gate
over-fire; signal-dispersion unbounded) + their `vend chain` pull strings, plus a **third
instrument kaizen** (thread the stop-reason onto `RunSummary`). All in `findings.md` §The decision.

## Acceptance criteria

- **AC#1 — probe runs on expand/survey/steer, bounded N, logged, results in a findings note.** ✅
  All three ran live, N=3, real budgets; per-cast outcomes in `sweep-logs/`; numbers in `findings.md`.
- **AC#2 — per play: variance + outcome mix + honest-empty rate + a clear verdict, honest about the
  small sample.** ✅ Each play's dispersion + mix + honest-empty rate reported (with the D4 caveat
  for expand and the n=1 caveat for survey); verdict bolded up front; dedicated "Honest about the
  sample" section (N=3, one input, one env, directional-not-proof).
- **AC#3 — if "tune the gates", names the concrete next signal bridging to demand.md (E-014
  pattern).** ✅ Two demand.md row-shaped signals + pull strings + the E-019 row `Status` update.
- **AC#4 — `bun run check:*` green; live sweep is the human verification at sweep.** ✅ `bun run
  check` = 586 pass / 0 fail / typecheck clean; the live sweep was additionally run here (not
  deferred), the human-verification step done in-session.

## Test coverage

- **No new unit tests** (house rule: the change is to the IMPURE sweep harness; impure verbs are
  proven live, their judgment is the already-tested pure core). T-019-01's 10 `consistency.test.ts`
  cases still cover the tally + dispersion the report is built from. `bun run check` green.
- **Static + smoke coverage of the new code:** `tsc` clean; CLI guards exercised (no-args /
  unsupported play / `expand` without a fragment → usage + exit 2); the live sweep exercised every
  new path (both new targets' seed → assemble → cast → classify → collect, both abstention polarities).
- **Gap:** the harness itself remains untested by design — the new `expandTarget`/`steerTarget`
  wiring is proven only by the live run + typecheck, exactly as `run-probe.ts` is.

## Open concerns / for human attention

1. **The verdict is actionable, not terminal.** It says the gates did *not* hold consistency on
   this input — N=3, one input/play, one env. Treat the two staged signals as the next pull, then
   **re-sweep** after tuning. Do not read "broken"; read "measured inconsistent."
2. **Expand's honest-empty is hand-folded** from the raw `gate-failed` tally (the D4 instrument
   blind spot — STOP-style plays' abstention hides in `budget-exhausted`). The third kaizen signal
   (stop-reason on `RunSummary`) would make this a clean bucket and is worth pulling before a
   re-sweep so the next numbers are unambiguous.
3. **survey's signal arm is n=1** → its content dispersion is unmeasured. A larger N (or a less
   saturated board) would resolve whether survey's rare signals agree.
4. **Groundedness is fuzzier for survey/steer** than expand: a 49-ticket board could legitimately
   read as "saturated." survey's 67% honest-empty is partly over-eagerness, partly a defensible
   "well-captured" read — but the run-to-run *flip* on identical input is unambiguous inconsistency.
5. **steer's 0.72 dispersion** raises a design question, not just a tuning one: should the steer
   consistency gate *converge* output, or is articulation divergence by-design and the gate's job
   only to censor? Signal #2 names this explicitly.
6. **Cost note (IA-8, no silent caps):** 9 live casts at real budgets (ceilings 250k/300k/400k).
   No arm was capped or sampled-down; every cast that ran is in the logs.
