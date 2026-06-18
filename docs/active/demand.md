# Vend — Demand (the pull board)

Thin demand **signals**, not epics. A signal is a *request for clearing*, not
work — one line of "what + why it might matter." Epics are **pulled** from here
only when there's capacity; clearing (signal → epic → stories/tickets) happens
just-in-time on pull, never ahead of demand. Keep it lean — overproduced plans
are inventory that rots; signals are cheap and stay un-elaborated until pulled.

Pulling, grounded in the codebase *at the moment*, is what prioritizes. Two inputs
decide each pull — the clearing house's allocation economics:

- **Value** — what's worth doing (leverage; see below).
- **Budget** — what to spend (the envelope; see below).

IDs are assigned on pull, not pre-reserved. Pull order is by value + readiness,
**not** ID order.

---

## Value ranking (leverage, not effort)

Rank by **leverage**, never by estimated effort (agent-run effort is fat-tailed
and unestimable — see Budget). A signal's tier:

- **Keystone** — unblocks most of the DAG, or *is* the core feature.
- **High** — advances the core feature or a charter invariant directly, **or** is
  an *enabler* that de-risks much of what follows.
- **Standard** — real value, bounded blast radius.
- **Leaf** — narrow; unblocks nothing.

Score on: which charter invariants it advances · how much it unblocks (keystone
vs leaf) · whether it's load-bearing for the core feature. Compute on pull; don't
freeze a number.

## Budget envelopes (the 2-hour concept)

Agile points assume a tight effort distribution; **agent runs are fat-tailed** — a
"small" ticket can blow up 10×, a "big" one resolve in one pass. You cannot
*estimate* a fat-tailed variable, only **bound** it. So work is allocated a
**budget envelope with a hard stop and gates**, not a story-point estimate. That
is the founding "allocate a time/token budget and run" gesture made literal: pay
the envelope, the gates make it yield gated work or an honest andon (charter P7).

- **Denomination:** wall-clock + token ceiling. The human-scale unit is the
  **~2-hour feature block**; a single dispense/ticket is minutes-to-tens; lisa's
  per-session advisory is ~1h (`session_timeout`).
- **Budget ∝ value:** keystone → fat envelope; leaf → thin.
- **Two scopes:** *micro* (per dispense — `T-001-03`) and *macro* (per feature —
  the 2-hour envelope the human allocates at the counter).
- **Calibrated from data:** once `T-001-04`'s run log has a dozen runs, set
  envelopes from the *measured* fat tails instead of guessing.

---

## Signals

| Signal | Value | Budget (envelope) | Status |
|---|---|---|---|
| **Dispense slice** — the single metered lever (`DecomposeEpic` via `claude -p`), gated · budgeted · streamed · countably logged | **Keystone** (unblocks all) | multi-session (under lisa now) | **active → E-001** |
| **`vend` context-aware shelf** — call bare `vend` and drop into a *dynamic selection* driven by the available playbooks **+ current project state** (demand board, charter, ready epics, in-flight work); pick → allocate budget → run. The early CLI-ification of the two-gesture counter, ahead of the full TUI. Evolves E-001's static `vend run <play>`. | **High** (core feature; P2 two gestures) | ~1 feature block (≈2h) | **blocked on E-001**. **Spec staged → E-003** (`docs/active/epic/E-003.md`), ready to decompose the instant E-001 lands. Candidate next pull. |
| **CI/CD structural backstop** (Dagger, Node-orchestrator) — independent structural inspection only; the same `bun run check:*` scripts the play invokes as andon gates | **High** (enabler — de-risks every parallel-fleet build; though the *weakest check type* by our own lens) | ~1 feature block (≈2h; one gate end-to-end per `ci-strategy.md`) | **blocked on E-001** (needs scaffold + check surface). Steering: `ci-strategy.md`. → E-002. **Tooling:** dagger CLI `v0.21.4` ✓ (pin in `/ci/dagger.json`); Docker daemon must be up. |

**Next-pull call (after E-001):** the `vend` shelf and the CI backstop are both
**High** but pull in opposite directions — the shelf advances the *core feature*
(a usable counter now), CI is the *enabler* that de-risks the parallel-fleet
builds that come after. Decide on which risk you'd rather carry first; the board
surfaces the trade, it doesn't resolve it.

## Not yet pulled

Surfaced demand, deliberately un-elaborated until pulled:

- **Design-language session** — assemble the project-wide *look* (the TUI surface
  language: shelf, run stream, andon/gate-stop, budget meter); output a **capped
  design charter** future TUI epics anchor to (same anti-staleness pattern as
  `charter.md`). High; precedes any TUI epic. Generative, not an audit.
- **Value/budget surface in Vend** — the shelf showing each playbook's worth and
  warranted budget, with the run log feeding *actuals* back to recalibrate
  envelopes. Standard; needs run-log data + a shelf to land on.
- (friction from `go-and-see.md` and gaps against `charter.md` accrue here as
  one-liners when surfaced)
