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
**not** ID order. **Cleared signals are crystallized to one line in
`docs/archive/demand-cleared.md` and deleted from here** — this board holds only
open demand.

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
**budget envelope with a hard stop and gates**, not a story-point estimate — the
founding "allocate a time/token budget and run" gesture made literal (charter P7).

- **Denomination:** wall-clock + token ceiling. The human-scale unit is the
  **~2-hour feature block**; a single dispense/ticket is minutes-to-tens.
- **Budget ∝ value:** keystone → fat envelope; leaf → thin.
- **Two scopes:** *micro* (per dispense) and *macro* (per feature — the 2-hour
  envelope the human allocates at the counter).
- **Calibrated from data:** envelopes are set from the run log's *measured* fat
  tails (E-013), not guessed.

---

## What the live goals serve (the crystallization)

Most of the spine is built and cleared (see `docs/archive/demand-cleared.md`): the
dispense → engine → chain **pipeline**, the **gate frame** (per-commit · per-stop ·
per-clear · per-history), the **measured budget contract**, the **articulation
trilogy** (expand/survey/steer), the **trust evidence** instruments, the **Home/
shelf** surface, and the **executor seam**. What's left is six frontiers — each
named by the charter principle it advances and the gap it closes:

1. **Prove the autonomy loop (P4/P7) — the headline gap.** The macro-wallet is
   *coded-green but never demonstrated live*; the trust gate it rests on is
   *provisional* at 2/10 forward records. The same live spend both proves the
   feature and feeds its own trust evidence. **This is the keystone gap.**
2. **A live open-model runtime (P6).** The execution + authoring seams are
   config-capable (E-035/E-036); what's unbuilt is an open model *autonomously*
   clearing work. Model-plurality made real, not just declared.
3. **Graph-structured orchestration (the v1 vision).** The engine casts single
   plays and one linear chain; the typed multi-node **DAG** is the architectural
   centerpiece still unbuilt.
4. **The non-dev round-trip (P5).** The projection layer ships (E-021); the Linear
   renderer + annotation→demand round-trip close the loop to visual thinkers.
5. **The "walk-away" UX (P4) — IA's open design threads.** Detached/notify, a
   fleet/DAG andon board, the Confirm budget-adjust gesture.
6. **Hygiene & efficiency.** Countable stop-reasons, faster history audit, and the
   mana-economics levers (cache ordering, model routing) that spend well *for* the
   author.

---

## In flight

| Signal | Value | Status |
|---|---|---|
| **`per-cast-timeout-headroom`** (Frontier 1 unblocker) — the per-cast wall-clock timeout *is* the p90 envelope, so heavy signals are guillotined at p90 and censored out of their own sample (a ratchet). Give `timeoutMsFor` headroom above the price; keep the meter honest. | **High** (the concrete unblocker of the keystone) | **active → E-038** — single surgical ticket (`timeoutMsFor × HEADROOM`, kill-switch only) + deterministic proof. Awaiting `lisa loop`. |

---

## Pullable signals (open demand)

### Frontier 1 — Prove the autonomy loop (P4/P7) · *keystone* · **E-037 done; frontier open**

- **`propose-epic` time-censors the board's top signal before it can mint** → **pulled → E-038
  (in flight).** E-037's sweep cleared 0 because the per-cast timeout *is* the p90 envelope, so a
  signal heavier than p90 is guillotined and censored out of its own sample (a ratchet). Grounding
  corrected E-037's own suggested fix: **raising the percentile can't work** (the tail is censored
  from the sample); the fix is **timeout headroom** in `timeoutMsFor` (kill-switch only; the meter
  stays the honest p90). E-038 is the surgical lever.
- **Accrue cleared forward-E1 to ≥10.** Once the censor clears, each `vend work --no-intervened`
  sweep that *clears* a pull adds a genuine forward record (now **4/10**, censored). The ≥10-genuine
  bar fully ungates the macro-wallet's provisional go — a **cadence**, not a single epic.
- **Macro-wallet live proof + forward-E1 accrual.** E-024 wired `vend work --budget`
  to spend a feature-block budget down across casts (green, 825 tests). The headline
  gesture is now **watched** (E-037, 2026-06-20): a real metered sweep demonstrated
  **P4/P7 live** — bounded wallet, clean twin P7 `andon: timed-out` stop, truthful
  receipt, auth==exec held (E-025). Forward-E1 moved **1/2 → 3/4 (sample 2/10 → 4/10)**
  — but the +2 records are **censored** (`timed-out`), **not cleared pulls**: the
  watched run was an **honest 0-clear**. So the go stays **provisional + forward-
  leaning**, *not forward-confirmed*. **What remains to ungate:** (1) clear the
  `propose-epic` per-step time-censor — its 72,785 ms p90 envelope censors the board's
  top signal *before it can mint* (a recalibration fix, rhymes with Frontier 6); then
  (2) accrue **cleared** forward records to **≥10**. **Keystone.**
  (`work/T-037-03/verdict.md`, `work/T-037-02/sweep-log.md`, `work/T-026-04/verdict.md`.)

### Frontier 2 — Live open-model runtime (P6)

- **Agentic open-model runner (the deferred remainder of E-035/E-036).** Both seams
  are now config-capable — execution (E-035, `OpenAICompatExecutor`) and authoring
  (E-036, `OpenModelStub` + render follows `VEND_EXECUTOR`). What's unbuilt is an open
  model *autonomously* reading the repo, running tools, iterating turns, materializing
  a ticket — a local agent loop behind the `Executor`, or an open-source agent
  framework. The real lift that proves P6 end-to-end. **High** (likely wants Frontier 3
  underneath it). ~several blocks.

### Frontier 3 — Graph-structured orchestration (the v1 vision)

- **Multi-node DAG.** Plays composing into a real typed graph (fan-out, join,
  conditional) beyond the linear propose→decompose chain. The architectural
  centerpiece of "typed, graph-structured agent orchestration." **High/Keystone.**
- **Per-play executor / BAML-client selection.** A play declares *which model* it
  runs on — the natural successor to E-032 (per-play tooling) + E-035/E-036's
  selection seams. **Standard.** ~1 block.

### Frontier 4 — The non-dev round-trip (P5)

- **Linear renderer** — project the work-graph into Linear for non-dev teammates
  (downstream of E-021's MCP-independent slice). **High** (opens the visual-thinking
  segment; respects N2/N4 — read-only, one-way authority). ~2 blocks.
- **Annotation → demand round-trip** — a teammate's annotation flows back into the
  board as a priced signal (reuses `expand-fragment`). Closes the loop. **High.**

### Frontier 5 — The "walk-away" UX (P4) — IA open design threads

- **Detached/notify mechanism** — kick off a run, get notified on settle (the
  "walk away" made literal at the UI). **Standard** (design pull first).
- **Fleet/DAG andon board** — watch a parallel fleet of casts; surface andons live.
  **Standard** (pairs Frontier 3). Design pull first.
- **Confirm's budget-adjust gesture** — tune the envelope at the counter before
  committing. **Standard.**

### Frontier 6 — Hygiene & efficiency

- **Thread the structured stop-reason onto the run record** — STOP plays fold
  honest-empty into `budget-exhausted` (stdout-only today), so the probe + `vend
  audit` can't split them; thread the stop-reason so it's countable. **Standard**
  (unblocks clean consistency/trust measurement). **Ready** — small (~1h).
- **`git bisect run` integration** — E-034's audit does a linear sweep; bisect is
  the faster backstop for a single red commit. **Leaf.** small.
- **Mana economics** (`mana-economics.md`) — spend well *for* the author, improving
  over time:
  - *Stable→variable prompt ordering* in the dispense — render `[play + charter +
    KB]` (stable) then `[target]` (variable) so the shared prefix reads at ~0.1×.
    Free through `claude -p`; full payoff needs Vend-owned cache breakpoints.
    **Standard.**
  - *Per-function model routing in BAML* — cheap client (Haiku/Sonnet) for
    screening/classification, Opus for hard decomposition; gates stay in code.
    Route at sub-play granularity (caches are model-scoped). **Standard.**
  - *(rolls up to)* **auto-structure demands for efficiency** — the engine applies
    ordering + routing + bounding invisibly; the consistency layer measures
    cache-hit + per-model cost and tunes it. The product-level goal these serve.

---

*Friction from `go-and-see.md` and gaps against `charter.md` accrue here as
one-liners when surfaced. Cleared signals → `docs/archive/demand-cleared.md`.*
