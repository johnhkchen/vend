# Steering data model — what to keep so the play becomes learnable

The data substrate for `project-steering.md`. It codifies **what to keep, in what
shape**, so the steering standard can be *improved* rather than only *run* — kaizen
by hand now, preference/imitation modelling later, RL eventually, all reading the
same growing file.

> **This is a capture spec, not a pipeline.** Do not build the analyzer, the reward
> model, or the trainer. Build nothing but the append. The over-build andon applies
> here harder than anywhere — the value is entirely in *not throwing the signal
> away*, and that costs one `jsonl` append per decision.

---

## The principle

**Task results are the sparse outcome reward — the cheap part, and lisa already
gives them to us** (status, `progress.md` deviations, budget actuals, CI). The
**dense, unrecoverable signal is the human's per-move corrections plus the
decision's provenance.** It is generated for free every session and lost forever to
the transcript unless captured. So: **keep what you cannot reconstruct.**

## Two logs, linked

| Log | Owner | Holds | Recoverable later? |
|---|---|---|---|
| `.vend/runs.jsonl` | `T-001-04` | per-dispense usage / cost / outcome | partly (from lisa/git) |
| `.vend/decisions.jsonl` | this doc | the steering **decision** + human verdict + provenance | **no** — capture or lose it |

They link by provenance: a decision *produces* work; that work's runs and
execution outcome flow back to score the decision.

## The atomic unit — a decision record

Append one per genuine steering decision (a surfaced fork, a call made, an andon
pulled). Pointers, not dumps — reference state by hash/ref, don't inline it.

```json
{
  "id": "D-2026-06-18-001",
  "ts": "2026-06-18T12:00:00Z",
  "session": "<episode id>",
  "stateRef": { "commit": "7b38379", "docs": ["charter@<hash>", "demand@<hash>"],
                "loop": "<lisa status ref>", "transcriptSpan": "<ptr>" },
  "move": "surface-fork | decide | capture | resist-over-build | verify | queue | reflect | orient",
  "question": "the fork/decision, framed",
  "options": [ { "label": "...", "recommended": true, "rationale": "..." },
               { "label": "...", "rationale": "..." } ],
  "choice": "what was chosen / done",
  "rationale": "why",
  "humanVerdict": "accepted | corrected | overridden | deferred",
  "humanCorrection": "if corrected/overridden: what they actually wanted",
  "andon": null,
  "provenance": { "produced": ["E-003"], "outcome": null, "durable": null }
}
```

`andon` when the line stopped: `{ "type": "over-build|staleness|unverified|drift|fork",
"trigger": "...", "fix": "..." }`. `provenance.outcome` backfills later from lisa/git:
`{ "status": "done|blocked|reverted|re-litigated", "runRefs": [...], "deviations": N,
"budget": { "alloc": ..., "actual": ... } }`; `durable` = did the decision stick
(never reverted / re-litigated).

## Which field is which training signal

- **`humanVerdict` + `humanCorrection`** → the dense **preference / imitation**
  gold (RLHF/DPO). The highest-value field; the one that is otherwise lost.
- **`options` (incl. rejected)** → **contrastive / ranking** data — a labelled
  choice-set, not just a pick.
- **`provenance.outcome` + `durable`** → the delayed, multi-objective **credit
  assignment** signal (did the decision pay off, within budget, without rework or
  reversal).
- **`andon`** → the **defect corpus** — labelled steering failures with trigger and
  fix.
- **`humanVerdict` distribution per fork + later `andon:fork` surprises** →
  **fork-precision calibration** (over-asking vs. under-asking) — the thing that
  trains *when to escalate*, which is what defines the 2-hour value.
- **per-session: project-state delta ÷ forks raised** → the **trajectory
  objective**: forward motion per unit of human attention.

## The reward function is already written

The rubric isn't searched for — it's the **charter + the steering andon**, applied
to a trajectory:

```
score(decision) ≈  advances a P-invariant            (+)
                 ·  respects every N-non-goal          (required)
                 ·  captured durably                   (+)
                 ·  no over-build                       (andon ⇒ −)
                 ·  escalated iff a real fork           (fork precision)
                 ·  produced work reached done in budget, low deviation, no rework/revert (+)
                 ·  decision proved durable             (+)
```

So we are logging trajectories against a *hand-specified* reward and using the
human verdicts to refine it. Pure RL-from-scratch is hopeless (episodes are hours,
reward sparse and delayed); the realistic path a training regime would actually
take is **imitation + preference on these human-corrected traces** — which is
exactly what this file accumulates.

## Minimal-now vs. later

- **Now (cheap, by hand):** append the unrecoverable fields per real decision —
  `move`, `question`, `options`, `choice`, `rationale`, `humanVerdict`,
  `humanCorrection`, `andon`. Skip nothing here; these don't come back.
- **Backfilled (read from lisa/git, no new work):** `provenance.outcome`,
  `durable`.
- **Later (a real play, not now):** `SteerProject` writes its own decision records
  as it runs; an analyzer reads `decisions.jsonl` for kaizen; a preference model
  trains on the verdicts. **Build none of that yet.**
