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
| **`measurement-funding-headroom`** (Frontier 6 / P7·P3) — break the envelope censoring ratchet: FUND early/under-calibrated runs generously enough to **record** their actual usage (from the lower bound censored runs already log) instead of terminating off a thin guess. E-050, **hand-authored** (the fix for the twice-confirmed E-045/E-049 finding; using the broken decompose to author its own fix would be circular). | **High** (P7 — turns the budget contract from a self-censoring ratchet into a self-calibrating loop; the IA-14 auto-widen `recalibrate.ts` defers) | **active → E-050** — hand-decomposed: T-050-01 pure `fundingEnvelope` (cold-start/high-censored ⇒ `max(priced, maxCensoredActual × MEASUREMENT_HEADROOM)`; trusted-measured ⇒ priced) → T-050-02 thread it into the cast funding path (`resolveStepBudgets` + `work.ts`), price/shelf label UNCHANGED (honest p90, IA-8), deterministic E-049-shaped fund-to-complete proof, P7 finite-guard. Free/deterministic. Awaiting `lisa loop`. |

---

## Pullable signals (open demand)

### Frontier 1 — Prove the autonomy loop (P4/P7) · *keystone* · **E-037 + E-038 + E-039 done — now WATCHED CLEARING**

- **Re-run the live sweep** → **done → E-039 (CLEARED 2).** E-037 watched the wallet *refuse*
  (cleared 0, time-censor); **E-038 fixed it** (`timeoutMsFor × 2`); **E-039 re-ran the bounded
  metered sweep and the wallet CLEARED** — 2 real pulls (`vend init`→**E-040**, `vend doctor`→
  **E-042**, each 2 stories + 4 tickets, `lisa validate` green). `propose-epic` **finished at 93 s /
  83 s, past the 72,785 ms wall** that censored E-037 ⇒ **E-038 proven live, in flight.** Clean P7
  **wallet-exhausted** stop; auth==exec held (E-025). (Board #1 was self-referential again — re-pointed
  at concrete demand before casting; a ranker follow-up, not a blocker.)
- **Accrue forward-E1 to ≥10** → **settled → E-045 / T-045-02: the ≥10 sample bar is MET.** The
  E-045 sweep took forward (live) **8 → 10** (composition **5 cleared / 5 censored / 1 genuine
  `--intervened`**). The pre-wired E-014/E-026 rule (≥10 forward self-reports) is **met — say so
  plainly.** Honest caveat (no over-claim): 9/10 forward runs ran *untouched* and only **1** is a
  genuine intervention, so this is **"didn't-break" evidence, not "stress-tested"** — the go upgrades
  **provisional → bar-met**, *not* "bulletproof"/"forward-confirmed-robust" (the E-026/T-026-04 trap).
  Forward-only numbers throughout; the 23-report combined pool (96% walk-away) is **not** the verdict
  basis. **What the cadence targets next:** genuine-intervention *depth* (still **1**) — real stress
  evidence — not more walk-aways. A **cadence**, not a single epic; the next `--no-intervened` sweep
  that needs a real intervention is worth more than ten that don't.
  (`work/T-045-02/review.md`, `work/T-045-01/progress.md`.)
- **Macro-wallet live proof + forward-E1 accrual.** The headline gesture is now **watched CLEARING**
  (E-039, 2026-06-20), upgraded from *watched refusing* (E-037): a real metered sweep cleared 2
  grounded pulls on a bounded walk-away — P4/P7 live, truthful receipt, the propose time-censor (the
  old named blocker) **cleared** by E-038. Forward-E1 moved on **cleared** (not censored) evidence for
  the first time (**0 → 4 cleared; sample 4/10 → 8/10**). **But 2 cleared pulls is NOT the ≥10 bar** —
  the go stays **provisional + forward-leaning, *not* forward-confirmed** (no over-claim off one
  sweep — the load-bearing non-goal). **What remains to ungate:** accrue **cleared** forward records
  to **≥10** (the propose time-censor is now off the critical path). Two follow-ups the run surfaced:
  an **idempotent-mint guard** for `propose-epic` (it double-minted a now-deleted orphan E-041), and a
  **steer ranker that demotes self-referential targets**. **Keystone.**
  (`work/T-039-02/verdict.md`, `work/T-039-01/sweep-log.md`, `work/T-037-03/verdict.md`, `work/T-026-04/verdict.md`.)

### Frontier 2 — Live open-model runtime (P6)

- **Agentic open-model runner (the deferred remainder of E-035/E-036).** Both seams
  are now config-capable — execution (E-035, `OpenAICompatExecutor`) and authoring
  (E-036, `OpenModelStub` + render follows `VEND_EXECUTOR`). What's unbuilt is an open
  model *autonomously* reading the repo, running tools, iterating turns, materializing
  a ticket — a local agent loop behind the `Executor`, or an open-source agent
  framework. The real lift that proves P6 end-to-end. **High** (likely wants Frontier 3
  underneath it). ~several blocks.

### Frontier 3 — Graph-structured orchestration (the v1 vision)

- **Multi-node DAG — foundational substrate ✅ done → E-046.** The typed graph (`dag-core`/`graph-core`/
  `graph`) is built: a node/edge model + deterministic `topoSort`, `runGraph` (fan-out, **join** via a
  multi-upstream map, halt-the-dependent-subgraph), and `castGraph` (concurrent wave dispatcher) —
  proven fails-vs-linear (the diamond's 2-upstream join `runChain` can't express). The v1 vision's named
  capability exists at its minimum honest form. **Remaining (E-046's named follow-ons):** **conditional
  edges** (branch on a node's result) → **done → E-049 (cleared, crystallized)** — predicate-on-edge
  branching with a DISTINCT branch-not-taken andon, mirrored byte-identical into the concurrent wave
  dispatcher; notably the **first epic Vend self-PROPOSED and self-DECOMPOSED via `vend chain`**. A
  **live real-play graph** →
  **done → E-047** (`survey → [propose ×2] → note` through `castGraph` — **concurrency proven live**,
  2 casts overlapped 68.97 s; the live multi-upstream join stays stub-proven only, since propose-1's
  budget-exhaustion skipped the join; `work/T-047-02/graph-cast-log.md`), **cross-branch budget
  accounting** (the macro-wallet across parallel branches) → **minted → E-048
  (`cross-branch-budget-wallet`)** — the E-047 cast surfaced this gap live (per-branch envelopes, no
  shared wave-level wallet) and minted the demand for it; **now done → E-048 (cleared, crystallized)** —
  and cycle/error semantics. Each a downstream pull onto the proven substrate. (Cross-branch budget →
**E-048**, conditional edges → **E-049** — both done + crystallized; only cycle/error semantics + the
live-join re-cast remain.) **High.**
  - ~~Decompose + build E-048 `cross-branch-budget-wallet`~~ → **done → E-048 (CLEARED, crystallized).**
    One shared wallet through `castGraph`'s wave dispatcher — `authorizeWave` + `debitWave` (**tokens SUM
    / wall-clock MAX** under concurrency, single-element == sequential `debit`), single-chain/`spendDown`
    UNCHANGED, deterministic shared-vs-per-node worked example (3-branch partial wave). P7 holds under
    concurrency; 1150 tests. **Now unblocks E-047's live join** — a shared budget lets both branches
    finish, so a live re-cast would run `capture-note` (the next downstream pull, below).
  - ~~Conditional edges for the typed DAG~~ → **done → E-049 (CLEARED, crystallized).** `EdgePredicate`
    + optional `when?` on `DagEdge`: an out-edge fires only if its predicate holds over the upstream's
    `produced`; the branch-not-taken cascade-skips via the EXISTING halt machinery with a DISTINCT
    "branch not taken" andon; mirrored into `runGraphConcurrent` (== sequential) + a router worked example
    through `castGraph`. Absent `when` ⇒ unconditional fan-out (back-compat). 1162 tests. **Dogfood
    milestone: the first epic Vend both self-PROPOSED and self-DECOMPOSED via `vend chain`** (propose
    clean; decompose needed 120k→350k — the warranted envelope under-bounds decompose).
  - **Live multi-upstream join re-cast (now unblocked by E-048).** E-047 proved concurrency live but the
    2-upstream join stayed *stub-proven* — propose-1 budget-exhausted, so `castGraph` (correctly) skipped
    `capture-note`. With one shared wave-level wallet, both branches can finish under a bounded envelope;
    a live re-cast of the `survey → [propose ×2] → capture-note` diamond would prove the join end-to-end.
    **Standard** (free-ish; a small bounded live cast). The honest closer on E-046/E-047's substrate.
- ~~**Decompose-envelope under-bounds — now TWICE confirmed (E-045, E-049).**~~ → **pulled → E-050
  (`measurement-funding-headroom`), in flight.** The recalibrated `decompose-epic` envelope (~120k tokens)
  is too thin for a real epic: E-046 depleted it, and E-049's `vend chain` decompose exhausted at ~265k
  against 120k, clearing only when bumped to 350k. Diagnosis (E-050): the ratchet is that censored runs
  are excluded from the p90 sample yet their thin envelope keeps funding the next run — even though a
  censored run already LOGS its actual usage (264,866 tokens). The fix funds early/under-calibrated runs
  above that observed lower bound so they record (the IA-14 auto-widen `recalibrate.ts` defers; the
  token twin of E-038). See **In flight** above. *(`just next`'s manual 350k budget papers over this; E-050
  is the honest fix in the calibration.)*
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
- **Restrict autonomous casts' tool-set — no `AskUserQuestion` in a headless `claude -p`.** E-049's
  `decompose-epic` cast called Claude Code's built-in `AskUserQuestion`, which has no answerer in a piped
  cast — it hung the pane until the tool resolved empty (the run then completed, but it *could* hang
  indefinitely / blow the wall-clock). Autonomous plays (propose/decompose/work) should run with a
  tool-set that excludes interactive tools, or a setting that auto-declines them — a clean refusal, not a
  hang (N2: autonomous enforcement, not a supervision prompt). **Standard** (small, real reliability gap
  surfaced live by the dogfood). **Ready.**
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

### Frontier 7 — Distribution & onboarding (PM-staged) — *init + doctor built (by Vend); rest open*

The board was **silent** on getting Vend *onto a machine* and a new user *driving it* — surfaced by
E-037's loop + ranked by the PM's 2026-06-20 cycle (`pm/proposed-batch.md`, `pm/deployability-
discovery.md`, `pm/onboarding-examples-discovery.md`). High-leverage **and** it compounds the keystone
(more driveable projects → more cleared runs → forward-E1 → the wallet ungates). **First two signals
already cleared — autonomously, by E-039's wallet sweep:** ✅ `vend init` (→ E-040, scaffold a
driveable project, idempotent) · ✅ `vend doctor` (→ E-042, envinfo preflight + cast precondition
guard). **Remaining:** a driveable hackathon `examples/` template · Homebrew / `bun --compile`
delivery · onboarding docs. **High** (foundation laid; example → delivery next). *Pull from the PM
batch — the human pulls (pull-discipline).*

- ~~Idempotent-mint guard for `propose-epic`~~ → **done → E-043** (`proposeEpicEffect` adopts an
  existing same-title epic before minting; the loop can now retry a mint without orphaning a card).
- ~~Steer ranker demotes self-referential targets~~ → **done → E-044** (`steer.baml` + `survey.baml`
  now require concrete product demand; operational meta-tasks demoted/excluded — live confirmation
  rides the next steer cast).

---

*Friction from `go-and-see.md` and gaps against `charter.md` accrue here as
one-liners when surfaced. Cleared signals → `docs/archive/demand-cleared.md`.*
