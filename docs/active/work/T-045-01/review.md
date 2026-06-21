# T-045-01 — Review

Handoff for a human reviewer. T-045-01 was an **operational** ticket: a live, metered `--no-intervened`
sweep to advance the forward-E1 cadence and confirm two recent hardening seams (E-043 idempotent mint,
E-044 concrete-demand ranker) live. No source code changed.

## What changed (artifacts + live state)

**Work artifacts** (`docs/active/work/T-045-01/`): research.md, design.md, structure.md, plan.md,
progress.md, sweep-log.md (the deliverable), review.md (this).

**Live state moved by the real casts:**
- `docs/active/pm/staged/steer.md` — overwritten by the steer re-stage (fresh ranked board, 19:36).
- `docs/active/epic/E-046.md` — **newly minted** (`typed-dag-fan-out-join-substrate`), un-decomposed.
- `.vend/runs.jsonl` — +3 records total (1 steer, 1 propose-epic success, 1 decompose-epic andon).
- `.vend/transcripts/` — appended per cast.

**No source files were created, modified, or deleted.**

## Outcome (honest)

A **clean P7 0-clear**. Both hardening seams confirmed live; the chain did not clear.

1. **E-044 (concrete-demand ranker) — TOOK.** Fresh board #1 is concrete demand ("Build the typed
   multi-node DAG"); the self-referential "re-run the sweep" signal was demoted off the entire board
   (all 8 signals concrete). This is the headline result. It also retires the irony that birthed this
   ticket: the demand signal that scheduled T-045-01 was itself the meta-task E-044 now suppresses —
   so this is plausibly the **last** self-referential sweep the board will ever recommend.
2. **Sweep — 0-clear.** One cast on the DAG signal: propose-epic succeeded (minted E-046), then
   decompose-epic overran its 227464-token per-step envelope (used 366414, +138950) → `budget-exhausted`
   andon → chain aborted. Wallet was fine (463.7k/57m left); the per-step guard stopped it cleanly.
3. **E-043 (idempotent mint) — CONFIRMED (no orphan).** No duplicate-title epic exists. E-046 is a
   single card; it is un-decomposed (decompose aborted) but that is a resume point, not the E-041
   childless-*duplicate* failure. A retry will `findExistingByTitle` → adopt E-046, not double-mint.
4. **Ledger:** forward `intervened:false` 20→22; `+success` 13→14. A forward success datum gained, but
   **no cleared chain** — the ≥10-*clears* cadence did not advance this sweep.
5. **`lisa validate`:** green ("109 tickets, 1 ready, DAG valid").

## Test coverage

No unit tests added/changed — this ticket changes no code. The seams it exercised are already covered:
- E-043: `propose-effect.test.ts` AC#3 double-run idempotency (structural guarantee); this sweep gave
  a live non-orphan confirmation on top.
- E-044: prompt-only change (E-020 shape) — no code assertion possible; confirmed empirically by the
  fresh board's #1 (concrete). `steer.test.ts`/`survey.test.ts` carry the contract tests for the bullet.
- The full `bun test` suite was not re-run (no code delta); it is unaffected.

Verification here is **live observation, captured verbatim** in sweep-log.md.

## Open concerns / follow-ups

1. **Decompose envelope under-provisioned for large epics (the 0-clear cause).** The standard-tier
   recalibrated decompose-epic envelope (227464 tokens) is too small for a heavyweight epic like the
   typed DAG (needed ~366k). This is the genuine next signal — **raise the decompose cold-start token
   envelope or tier the DAG higher** — same family as E-025 / E-038. Recommend a follow-up ticket
   (a staged signal `recalibrate-…-cold-start-token-budget-up` already exists). NOT a regression of
   E-043/E-044.
2. **E-046 is un-decomposed.** Intentionally left as the idempotency anchor — do NOT hand-delete it;
   the next sweep (after the envelope fix) should adopt-and-decompose it, exercising E-043 live again.
   If a reviewer prefers a clean board, deleting E-046 is safe (no children), but it forfeits the
   built-in E-043 retry demonstration.
3. **Cadence still short of ≥10 cleared.** This sweep added a forward *success* but no *clear*. The
   keystone (forward 8 → ≥10 clears) needs the envelope fix first, then a re-sweep — which the now-
   concrete board will naturally pull (the DAG or a smaller concrete signal), no longer a self-ref task.

## Authorization note (for the reviewer)

The irreversible tranche (the ~$/~1h metered spend that minted E-046) was run only after an **explicit
in-session human GO** (full bounded sweep), not autonomously. The cheap steer re-stage and the planning
artifacts preceded the gate. Actual spend was modest — the sweep stopped at 536.3k tokens / ~2 min
(one cast), well under the 1M/1h budget, because the first chain andoned.

## Critical issues needing human attention

None blocking. One actionable engineering follow-up (concern #1: decompose token envelope). The board
is green and valid; the hardening seams both held.
