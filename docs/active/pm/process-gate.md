---
ready: true           # ← RAISED 2026-06-21 for the visual-channel cycle (one-shot; flip to false on synthesis)
requested_at: 2026-06-21
---

# Process gate — "I'm ready for you to process this"

The control flag between **discovery** and **processing**.

The PM agent does **open discovery** into this workspace freely — surveying state,
querying the codebase index, accumulating findings and draft signals (in
`discovery/` or notes). It does **not** run a **processing** cycle — synthesizing the
final ranked `proposed-batch.md` and recommending what to promote — until this gate
is raised. Until then, anything already staged (e.g. an early `proposed-batch.md`) is
a **preliminary draft**, not a decision.

## How it works

- **Raise it:** set `ready: true` above (optionally add focus notes below), then tell
  the orchestrator to run the PM agent's processing cycle.
- **The agent consumes it:** on a processing run the PM checks this flag; if `true` it
  synthesizes the batch, then **flips it back to `ready: false`** — one-shot per cycle,
  so a stale `true` can't re-trigger.
- **Lowered (`false`) = keep discovering / hold.** The orchestrator will not promote
  any signal to the active board while the gate is down.

## Focus / notes for the next processing cycle

_**Visual-channel cycle — RAISED 2026-06-21 (ready, awaiting synthesis).**_

**Focus: the non-dev visual channel — turn the strategy stack into a ranked batch.** A full
discovery→strategy stack was built and committed this cycle (`d4d649b`): `persona-research.md` →
`pestle-analysis.md` → `product-strategy.md` → `svg-artifact-discovery.md` → `OKRs-vend-Q3-2026.md`
(+ `hero_loteria.PNG`). The synthesis run should **read that stack as its input** and rank the open
demand against it — not re-discover.

**What the stack already decided (carry into the ranking, don't re-litigate):**
- **North Star** = cleared runs that pass gates without intervention. **OMTM** = time-to-first-driven-
  board for a non-dev. **Moat** = executor-agnostic neutrality (N4) + accrued playbooks.
- **Macro:** strongest tailwind = the survey-proven trust collapse (gates are the answer); #1 threat =
  the executor (Claude Code) absorbing orchestration + visual surfaces — a clock on shipping the
  non-dev channel.
- **Riskiest must-be-true:** the non-dev channel *converts* (push is [S]-proven; pull is hypothesis).

**Candidate pulls the stack surfaces (un-elaborated, PE-6 — for the synthesis to rank, not a decision):**
- **E-055** `projection-to-svg-renderer` — **already active on the board**; `svg-artifact-discovery.md`
  carries its design inputs (stable-under-delta layout; the DL-9/DL-2 reconciliation to ratify first).
- The **hackathon driveable example** — `brief-hackathon-example.md` is build-ready; the OMTM engine.
- **Homebrew delivery** (`dist` JS-mode + justfile; spike-green) — the install channel.
- **Open-model runner** (Frontier 2, P6) — the moat/economic hedge against the subscription seam.

**The focus question the OKRs frame (the synthesis should take a position):** which risk does the next
pull buy down — **unproven trust (Set A)**, **unproven channel (Set B, the OMTM's pick)**, or an
**unhedged platform/economic flank (Set C)**? The canvas sequences *author→operator→designer* and points
the OMTM at the **channel**; the synthesis should recommend one next pull with that tension named.

**Guardrails (unchanged):** read-never-invent (PE-1); honest-empty if the gradient is flat (IA-4);
recommend-never-auto-cast (IA-5); the loop auto-drains tactical correctness fixes — keep those out of the
strategic batch. Promotion stays a human pull. Flip the gate to `false` on synthesis (one-shot).

---

_**Frontier 7 continuation cycle — PROCESSED 2026-06-20 (gate consumed, one-shot, back down).**
Focus confirmed (continue Frontier 7) and synthesized into `proposed-batch.md`: 6 ranked signals,
recommended pull **the hackathon example**. The batch is the *strategic* layer — the loop
auto-drains the tactical correctness fixes its runs surface (E-043 mint-guard, steer self-ref), so
those are excluded. Promotion is still a human pull. Raise the gate again for the next cycle._

---

_**Distribution & onboarding cycle — PROCESSED 2026-06-20, swept 6:56pm.** The batch
(`proposed-batch.md`, 6 signals, recommended pull **`vend init`**) was processed and its top pulls
**cleared live**: the macro-wallet sweep (**E-039**) minted `vend init`→**E-040** and
`vend doctor`→**E-042**, and the loop built both end-to-end (status: done, gate green at 1071 tests).
The frontier is **half-cleared** — delivery + the three examples are carried forward as board demand
(the loop calls it **Frontier 7**). Cycle artifacts (`proposed-batch.md`, `deployability-discovery.md`,
`onboarding-examples-discovery.md`, `PRD-distribution-onboarding.md`) are **kept in place, not
archived** — they're still referenced by `demand.md`/E-040/E-042 and are live forward planning for the
carried-forward work. Gate down; raise it with fresh focus when you want the next batch._

**Bonus the cycle delivered (its thesis, confirmed): onboarding fed the keystone.** E-038 broke the
per-cast time-censor and E-039's live sweep **cleared 2 real pulls** — the macro-wallet is now
**WATCHED CLEARING**, not just refusing. Forward-E1 moved on *cleared* (not censored) evidence for the
first time (0→4 cleared records; sample 8/10).

Reference state (so a new cycle doesn't re-propose done work):

- **Frontier 1 (keystone) — watched clearing; a cadence remains, not a pull.** E-037 watched /
  E-038 unblocked / E-039 cleared 2 pulls. The go stays **provisional + forward-leaning, NOT
  confirmed**: 2 *cleared* records ≠ the **≥10 cleared** bar. What remains is a **cadence** — accrue
  cleared forward-E1 to ≥10 via `vend work --no-intervened` sweeps — not a fresh epic. Don't re-propose.
- **Frontier 7 (distribution & onboarding) — opened this cycle, half-cleared.** DONE: `vend init`
  (**E-040**, idempotent scaffold) · `vend doctor` (**E-042**, envinfo preflight + cast-precondition
  guard). CARRIED FORWARD: **D-1** Homebrew delivery (`dist` JS-mode + `justfile`; `bun build
  --compile` spike **green**) · **X-1** hackathon example · **X-2** small-biz + deploy-preset shelf ·
  **X-3** figma↔SPA design-system. `PRD-distribution-onboarding.md` sequences these (v2 delivery →
  future examples). Don't re-propose init/doctor.
- **Cleared since last survey:** E-035/E-036 (P6 seams) · E-037/E-038/E-039 (the keystone proof
  chain) · E-040/E-042 (Frontier 7 v1).
- **Still live / un-pulled** (a fresh cycle may rank): agentic open-model runtime (Frontier 2),
  multi-node DAG (Frontier 3), Linear renderer + annotation→demand (Frontier 4 — visual-surface prep
  at desk root: `linear-surface-*.md`, `job-stories-visual-surface.md`), walk-away UX (Frontier 5),
  and Frontier 7's carried-forward delivery + examples.
- **Read, never invent** (PE-1): with the board this cleared, a flat gradient yields an **honest
  empty batch** (IA-4), not busywork.

Prior cycles archived: articulation-cost (`cycle-2026-06-19-articulation-cost/` → E-016/17/18),
trust-consistency (`cycle-2026-06-19-trust-consistency/`).

