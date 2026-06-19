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
| **Dispense slice** — the single metered lever (`DecomposeEpic` via `claude -p`), gated · budgeted · streamed · countably logged | **Keystone** (unblocks all) | multi-session | **done → E-001** (converged + committed, `4a1d632`; verified green + 4/4 live paths) |
| **`vend` context-aware shelf** — call bare `vend` and drop into a *dynamic selection* driven by the available playbooks **+ current project state** (demand board, charter, ready epics, in-flight work); pick → allocate budget → run. The early CLI-ification of the two-gesture counter, ahead of the full TUI. Evolves E-001's static `vend run <play>`. | **High** (core feature; P2 two gestures) | ~1 feature block (≈2h) | **done → E-003** — shelf live: bare `vend` renders a ranked menu, persisted to `.vend/menu.json`; 229 tests. |
| **CI/CD structural backstop** (Dagger, Node-orchestrator) — independent structural inspection only; the same `bun run check:*` scripts the play invokes as andon gates | **High** (enabler — de-risks every parallel-fleet build; though the *weakest check type* by our own lens) | ~1 feature block (≈2h; one gate end-to-end per `ci-strategy.md`) | **done → E-002** — `/ci` Dagger gate live: `dagger -m ci call test run` runs `check:test` in-container, drift-free (independently verified, 7.6s warm). Keep-warm is the next CI signal (cold-start ~18s). |
| **Casting engine** — author a play once; cast any registered play (sorcery/permanent) through the one metered seam — mana + gates + log; generalizes E-001's hardcoded runner. The v1 leap that makes the written specs runnable. | **Keystone** (next core capability; ramp) | ~2h/50k first slice (full engine: several blocks) | **first slice done → E-007** — engine live: one play-agnostic `castPlay`, **two plays cast through it** (DecomposeEpic + `capture-note`, verified live, $0.12). Follow-ups (generalize input-assembly so `vend run <any-play>` works; `ProposeEpic`; the survey-as-cast for full F4; the DAG) are future pulls onto the proven engine. |

**Next-pull call — the casting engine's first slice shipped.** v0 (E-001/E-003/E-004/
E-005/E-002) plus **E-007's first slice** are done: the play-agnostic `castPlay` loop is
live and proven (≥2 plays cast through it). The board is again clear of *pullable* work —
the remaining moves are **follow-up slices onto the proven engine**: generalize input
assembly so `vend run <any-play>` casts arbitrary plays; register `ProposeEpic`; re-cast
the roadmap survey as a sorcery (full F4); then the multi-node DAG and open-model
executors. Author/pull one when you want to keep building — the engine is ready to carry them.

## Kaizen signals — from E-001's first live runs

Surfaced by the live proof (`docs/active/work/T-002-04/proof.md`,
`.vend/runs.jsonl`). All **ready** (E-001 is done); ranked by leverage.

| Signal | Value | Budget | Status |
|---|---|---|---|
| **Cross-board id-collision guard** — `DecomposeEpic` reuses ids (`S-001`, `T-001-01`…); against a *populated* board it would clobber existing work (A1 was safe only by materializing into a sandbox). Add a cross-board uniqueness check / id-namespace. | **High** (enabler — gates pointing the play at the *live* board; prerequisite to machine-decomposing E-002/E-003) | small (~1h) | **done → E-004** (refuse-materialize-on-collision in code) |
| **Bound dispense exploration** — `claude -p` is the full agent; A2's tiny fixture burned 119k tokens (> A1's full E-001 at 78k) — the budget fat-tail is *agentic wandering*, not input size. Add `--max-turns` / a system-prompt constraint on the seam. | **Standard** (budget calibration; cost predictability) | small (~1h) | ready |
| **Thread the real model id** — `runs.jsonl` logs `claude-cli-default`; the true id (`claude-opus-4-8[1m]`) lives on the terminal `result`. Thread it through the runner so the consistency layer reads truth. | **Standard** (data fidelity) | tiny (mins) | **done → E-005** |

*Noted, not yet a signal:* the token budget is **detect-after** (an accountability
andon, post-completion); only the wall-clock budget halts mid-flight. Both honor
P7's "no partial materialization," differently. Document in the budget notes;
revisit only if a hard token cap is ever needed.

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

### Efficiency — Vend structures the demand, not the author (see `mana-economics.md`)

The north star: *you shouldn't have to be a prompt-structuring expert.* These let
the casting engine spend mana well on the author's behalf; improve over time.

- **Stable→variable prompt ordering in the dispense** — render the play prompt as
  `[play + charter + KB]` (stable) then `[the target epic]` (variable), so casting
  the same spell on different targets reads the shared prefix at ~0.1× instead of
  re-writing it. Free upside through `claude -p` (order only); full payoff needs
  Vend-owned cache breakpoints (Agent SDK / Messages API). Standard.
- **Per-function model routing in BAML** — assign a cheap client (Haiku/Sonnet) to
  easy functions (screening, classification) and Opus to the hard decomposition;
  keep deterministic gates in code (free). Route at sub-play granularity — caches
  are model-scoped, so never bounce models mid-prompt. Standard; a "build BAML
  harder" payoff.
- *(rolls up to)* **auto-structure demands for efficiency** — the engine applies
  ordering + routing + bounding without the author seeing them; the consistency
  layer measures cache-hit ratio + per-model cost and tunes it (kaizen). The
  product-level goal these two signals serve.
