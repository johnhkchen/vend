# T-002-04 — Proof: the slice dispenses something real

The keystone is proven. On 2026-06-18 the hardcoded `decompose-epic` play ran **live**
through `claude -p` across four scenarios — every one behaved exactly as the gates and
budget contract promise. Evidence: `.vend/runs.jsonl` (4 countable records),
`.vend/transcripts/A{1..4}.jsonl`, `results/summary.json`, and
`results/e001-machine-plan.md`. Re-runnable: `bun docs/active/work/T-002-04/live-proof.ts`.

## Results table

| # | AC | Epic | Budget (ms, tok) | Outcome | Materialized | `lisa validate` | Tokens | Cost (USD) | Wall |
|---|---|---|---|---|---|---|---|---|---|
| **A1** | AC1+AC4 | E-001 (real, hand-cleared) | 600000, 400000 | **success** | 2 stories + 8 tickets | **✓ All checks passed** | 78,341 | $0.4400 | 76.1 s |
| **A2** | AC2 (tokens) | tiny fixture | 600000, **1** | **budget-exhausted** | none | n/a | 119,393 | $0.4444 | 55.6 s |
| **A3** | AC3 | under-specified fixture | 600000, 400000 | **gate-failed** (`value`) | none | n/a | 35,468 | $0.1673 | 20.3 s |
| **A4** | AC2 (time) | tiny fixture | **1**, 400000 | **timed-out** | none | n/a | 0 | $0.0000 | 0.003 s |

Totals: **≈233,202 tokens / ≈$1.05** for the whole proof. True model (read off every
transcript): **`claude-opus-4-8[1m]`**. Sequential, single machine, subscription auth.

## Per-AC verdict

- **AC1 — live run produces lisa-valid stories/tickets + a run record.** ✓ A1
  dispensed a `WorkPlan` over the **real** E-001, cleared all four gates, materialized
  **2 stories + 8 tickets** into its sandbox, and the runner's own
  `lisa validate` printed `· lisa validate ✓`. Re-validated independently:
  `lisa validate --path .vend/live-proof/A1` → *"All checks passed. 8 tickets, 1 ready,
  DAG valid."* `wc -l .vend/runs.jsonl` = **4** — one countable record per run.
- **AC2 — tiny budget hits the andon, no partial materialization.** ✓ **Two
  dimensions**, both clean stops with **zero files written** (verified on disk, not
  just the summary flag):
  - *Tokens* (A2): ceiling 1, `check` returned `exhausted` — andon
    `budget-exhausted — spent 119393/1 tokens (over by 119392)`. No materialize.
  - *Wall-clock* (A4): ceiling 1 ms, the seam SIGKILLed the child → `ClaudeTimeoutError`
    → `timed-out` in **3 ms**, $0. No materialize. P7 is enforced **both ways**.
- **AC3 — under-specified epic trips a clearing gate, named reason, no garbage.** ✓
  The contentless epic drove the SAP empty-degradation path (predicted in Research):
  andon `gate-failed — gate 'value' stopped at <plan>: plan has no tickets — it
  advances nothing (malformed/empty)`. The run-log record carries one
  `{"gate":"value","passed":false}` row. Zero files emitted.
- **AC4 — tokens/cost/wall-clock recorded + the by-hand gap.** ✓ Table above + the
  diff below.

## AC4 — by-hand E-001 vs. machine decomposition (the first kaizen signal)

The machine was handed the *same* E-001 the human cleared by hand (E-001.md:66–77:
"2 stories, 8 tickets, DAG valid, critical path 5… the last by-hand pass… T-002-04
will run it by machine and compare"). It reproduced it **almost exactly**:

| Dimension | By-hand (E-001.md) | Machine (A1) | Gap |
|---|---|---|---|
| Stories | 2: `metered-lever-foundation`, `decompose-epic-play` | 2: **identical ids + titles** | none |
| Tickets | 8 (T-001-01..04, T-002-01..04) | 8 — **same ids, same intent, near-identical titles** | none |
| DAG shape | T-001-01 → {02,03,04 ∥}; T-002-01 → 02 → 03(convergence) → 04 | **same** — T-002-03 `depends_on [T-001-02,03,04, T-002-01, T-002-02]` | none |
| Critical path | 5 (01→T-002-01→02→03→04) | **5** | none |
| Gates | hand-asserted, `lisa validate` ✓ | **cleared all four** against the real charter | none |

Divergences (all minor, all defensible):
1. **`advances` granularity.** The machine attached richer, per-ticket invariant
   claims (e.g. seam → `P6, P1`; runner → `P1, P2, P3, P7`) — *more* specific than the
   hand pass, and every claim cleared the **bounds** gate (it greps the live charter),
   so none were dangling or non-goal-advancing. A quality *gain*, not a miss.
2. **Priority calls.** The machine set most tickets `critical` and T-001-04 / T-002-04
   `high` — matching the hand intuition (foundation + log/proof) with no material
   difference.
3. **Body prose** differs (machine writes from `purpose`/`doneSignal`); structurally
   lisa-valid either way.

**Headline:** the play, run autonomously against its gates, produced the human's plan
— this is the bootstrap payoff in E-001's own words ("the play can now do by machine
what we did by hand to produce E-001"). The gates were necessary *and* sufficient: A1
cleared because the output was genuinely well-formed, A3 stopped because it wasn't.

## Kaizen signals (feed the demand board / future tickets)

1. **`claude -p` is the FULL agent, not a single shot — token cost is agentic, not
   epic-sized.** A2's *tiny* fixture burned **119k tokens** — *more* than A1's full
   E-001 (78k) — because the seam runs Claude Code with tools/hooks (`hook_started`,
   `rate_limit_event`, multi-turn `assistant`/`user` in the transcript); the model
   *explored*. **Implication for budget calibration** (demand.md's "set envelopes from
   measured fat tails"): the fat tail is driven by agentic wandering, not input size.
   This is the first real data point. Consider a `--max-turns`/system-prompt constraint
   on the dispense seam to bound exploration (a follow-up signal, out of scope here).
2. **Token budget is detect-after; only time budget halts mid-flight.** `check` meters
   the terminal `result.usage` *post-completion*, so A2 spent 119k against a 1-token
   ceiling before being refused — the token contract is an **accountability andon, not
   a preventive cap**. The wall-clock budget (A4) is the only *preventive* halt. Both
   honor P7 ("no partial materialization") but differently; worth stating explicitly
   in budget docs and revisiting if a hard token cap is ever needed.
3. **Logged model is a sentinel (review concern #4, confirmed live).** `runs.jsonl`
   records `model: "claude-cli-default"` while the transcript's true id is
   `claude-opus-4-8[1m]`. The consistency layer that wants the real model must read it
   off the terminal `result` (this driver does). Cheap fix: thread it through the
   runner — a follow-up.
4. **Cross-board id-collision is real and unguarded (review concern #2, confirmed).**
   The machine reused E-001's ids (S-001, T-001-01…) — harmless only because A1
   materialized into a sandbox. A success run against the *live* board would have
   clobbered it. A cross-board uniqueness check (or an id-namespace strategy) is a
   genuine gap before the play is pointed at a populated board. **Highest-value
   follow-up.**
5. **First real round-trip worked (review concern #1, closed).** `extractPromptText(
   b.request…)` → `claude -p --output-format stream-json` → `b.parse.DecomposeEpic`
   round-tripped with no prompt/format mismatch on the first attempt. The seam and the
   SAP parser are proven against a live model.

## What this proves about the charter

Authored once, run by gesture (**P1**); gates stopped the line with a named reason
rather than self-certifying (**P3**, A3); the run respected its budget both ways
(**P7**, A2+A4); and a countable ledger fell out by default (E-001 "done looks like").
The single lever dispenses something real — E-001 is converged.
