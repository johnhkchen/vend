# PM — Proposed batch (Visual-channel cycle, synthesized 2026-06-29)

> Synthesized by the orchestrator (full session context) against the committed strategy stack
> (`persona-research` → `pestle-analysis` → `product-strategy` → `svg-artifact-discovery` →
> `OKRs-vend-Q3-2026`) and the live board (`demand.md`), per the process-gate raised 2026-06-21.
> **Supersedes the 2026-06-20 Frontier-7 batch** (its recommended pull — the hackathon example —
> cleared as **E-058**). Signals **un-elaborated** (PE-6), ranked by **leverage, not effort**.
> Promotion is a deliberate human pull.

## The strategic read

The Set-B non-dev channel is no longer a hypothesis on paper — **E-058 drove it live and the A3 risk
materialized honestly**: the articulation engine produces a coherent grounded board on a thin seed, but
the *shipped* two-gesture flow doesn't reach it. That one live drive reorganized the board:

1. **The channel is one-and-a-half pulls from a closed loop, not a fresh bet.** E-059 (in flight) wires
   the seed's `SEED.md` intent into steer so the board **renders** (finding #1). What remains is the
   **full-slice clear** — E-058's findings **#2** (cold-start budget shape) + **#3** (`decompose` needs
   `codebase-memory-mcp`, absent on a fresh seed), which E-059 explicitly deferred as *"separate
   signals."* Closing them carries the channel from *"see a board"* to *"actually clear work"* — the
   Set-B round-trip, complete.
2. **Finish the loop BEFORE you measure it.** The stack's riskiest must-be-true (claim 2b: non-devs want
   a visual surface) is tested by the render-and-watch probe — but a probe against a *half* loop (board
   renders, nothing clears) measures the wrong thing. Complete the drive first, then put a whole one in
   front of a real designer.
3. **Set B feeds Set A for free.** Each live drive (E-058 did, E-059 will, E-060 will) accrues *cleared*
   forward-E1 — the ≥10-cleared cadence that ungates the macro-wallet (Set A). The channel work is not a
   detour from the autonomy keystone; it **is** the cadence. Don't pull Set A as a separate epic (it's a
   cadence, not a pull — `demand.md` Frontier 1).
4. **Defer the moat (Set C) one more beat.** The open-model runner is **DEPRIORITIZED** (`demand.md`
   2026-06-21 — no real cost/sovereignty need). Homebrew delivery is real but lower-leverage than proving
   the channel converts — ship the install channel once there's a proven loop worth installing.

**The focus question the OKRs frame — answered:** the next pull buys down **Set B (unproven channel)**,
while **compounding Set A (the trust cadence)** and **deferring Set C (moat / install)**. The canvas
sequences author→operator→designer; this finishes the designer's round-trip so it can finally be measured.

## Ranked shortlist

### 1. Fresh-seed full-slice clear — close E-058 findings #2 + #3 — **Keystone**  ← recommended pull
**Signal:** on a fresh seed, a designer's two gestures should clear a **real slice end-to-end**, not just
render a board. Two gaps block it: **(#3)** `decompose` requires `codebase-memory-mcp`, absent on a fresh
project → **graceful-degrade** (proceed without it, log an honest reduced-grounding note; the make-or-break
steer→board never needs it); **(#2)** the cold-start chain prices ~120 min, so a tight two-gesture budget
funds nothing → a **seed-appropriate envelope** calibrated from the run-log fat tails (E-013). Close with a
**LIVE re-drive** that clears a slice + updates the gold master.
- **Advances:** P2 (the two-gesture transaction actually *completes* on a fresh seed) · P5 (the non-dev
  round-trip, whole) · P7 (a seed budget that funds a real clear). Completes the Set-B round-trip
  E-058/E-059 opened; its live drive **accrues cleared forward-E1** (feeds Set A).
- **Budget:** ~1 block (≈2h) for the degrade + envelope; +1 live cast for the closing drive.
- **Readiness/deps:** **sequences after E-059** (board must render before a slice can clear). Findings
  #2/#3 were *explicitly deferred by E-059 as separate signals* — this is them. Brief prepped:
  `pm/brief-fresh-seed-clear.md`.
- **Rationale:** the one pull that turns the half-loop into a complete, measurable drive — and the live
  drive that closes it is *itself* a cleared forward-E1 record. Most leverage-dense pull on the board.

### 2. Render-and-watch validation probe (Frontier 4) — **High** (a probe, not a build)
**Signal:** hand a real designer ONE rendered `.svg` board off a real drive, ask her to narrate, measure
where she gets lost — the cheapest test of the still-open claim 2b. **Sequence AFTER #1** so she sees a
COMPLETE drive (board + a cleared slice), not a half-loop.
- **Advances:** P5; validates (or kills) the desk's riskiest must-be-true — the OKR Set-B KR.
- **Budget:** small — a measurement, not an epic. **Gated on a recruited real non-dev driver** (the
  desk's biggest data gap — name it, don't paper over it).
- **Rationale:** the honest "test it, don't keep building blind" move — but only meaningful against a
  whole loop. *Not coding-agent-pullable* (needs a human driver) — tracked here as the measure step #1
  unlocks.

### 3. SVG card-face jargon strip (Frontier 4) — **High**
**Signal:** most faces read clean, but a few leak `Baml…`/`Ci…`/`Claude p…`. Tighten the vocabulary policy
to strip residual tokens — *the research's #1 weak link: jargon-heavy faces make the SVG a reframed text
wall.*
- **Advances:** P5. **Load-bearing for #2's validity** — if faces are jargon-heavy the probe fails for the
  wrong reason. Sequence before the probe.
- **Budget:** small (~1h).

### 4. SVG accessibility pass — color-blind redundancy + layout-stability (Frontier 4) — **Standard**
**Signal:** (a) status rides color tokens alone → add a redundant shape/position/label signal so it
survives without color; (b) add a stability-under-delta check (add one card, re-render, assert other
groups' boxes don't move) — the deterministic layout is Sam's spatial anchor.
- **Advances:** P5 (+P4 for stability). Two small accessibility fixes that sharpen the surface the probe
  tests; bundle as one pass.
- **Budget:** small (~1–2h).

### 5. Thread the structured stop-reason onto the run record (Frontier 6) — **Standard**, ready ~1h
**Signal:** STOP plays fold honest-empty into `budget-exhausted` (stdout-only), so the probe + `vend audit`
can't split them. Thread the reason so it's countable.
- **Advances:** P3 — makes the consistency/trust measurement (and the Set-A forward-E1 cadence) legible. An
  enabler; **pairs #1's degraded-grounding note** (same run-record surface — do them together).
- **Budget:** small (~1h).

### 6. Homebrew / `bun --compile` delivery (Frontier 7) — **Standard**
**Signal:** `brew install` — real `package.json` bin/semver, `bun build --compile` (spike-green), tap +
installer + release CI, mirroring lisa's toolchain.
- **Advances:** P5 (the literal local-first delivery) — the last open onboarding leg.
- **Budget:** ~1–2 blocks (spike-proven).
- **Rationale:** real, but lower-leverage than proving the channel converts; ship it once there's a proven
  loop worth installing.

**Carried forward (lower now):** per-play executor / BAML-client selection (Frontier 3, P6 — model
plurality); walk-away UX (Frontier 5 — design-pull-first); open-model runner (Frontier 2 —
DEPRIORITIZED). **Loop auto-drains tactical fixes** (the Leaf SVG `status`-grouping tuning, the `git
bisect` backstop) — kept out of this strategic batch. **Frontier 3 (multi-node DAG) is CLEARED
(E-046→E-054)** — no longer a candidate.

## Recommended next pull

**#1 — the fresh-seed full-slice clear (→ E-060).** E-059 makes the board *render*; this makes it
*clear* — completing the Set-B round-trip E-058 opened, so the channel can finally be put in front of a
real designer as a WHOLE drive (#2). It buys down the unproven channel (Set B), and its closing live drive
accrues the cleared forward-E1 the autonomy keystone needs (Set A) — one pull, both payoffs. Signal
string, ready to pull (the brief `pm/brief-fresh-seed-clear.md` is the spec the epic draws from):

```
vend chain "Fresh-seed full-slice clear — close E-058 findings #2 + #3 so a designer's two gestures clear a real slice end-to-end on a fresh seed, not just render a board. (#3) decompose tolerates a missing codebase-memory-mcp via graceful-degrade — proceed without it and log an honest reduced-grounding note (the make-or-break steer→board never needs it); (#2) set a seed-appropriate cold-start budget envelope calibrated from the run-log fat tails (E-013) so a tight two-gesture budget funds a real clear; close with a LIVE re-drive that clears >=1 slice and updates the hackathon-seed gold master. Sequences after E-059 (board must render before a slice can clear). Advances P2, P5, P7; the live drive accrues cleared forward-E1 (the Set-A cadence). Brief: pm/brief-fresh-seed-clear.md."
```

_Staged, not promoted (PE-1 / IA-5). A human pulls the signal onto the active board; the clearing play
mints the real E-060 card + tickets. The PM writes only to `pm/`._
