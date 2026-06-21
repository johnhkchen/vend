# PM — Proposed batch (Frontier 7 continuation cycle, synthesized 2026-06-20)

> Synthesized by the orchestrator (full session context), ranking the open demand after the
> distribution & onboarding v1 landed (`vend init` E-040 + `vend doctor` E-042, cleared live by the
> macro-wallet sweep E-039). Focus confirmed: **continue Frontier 7 — demonstrate + ship.** Signals
> **un-elaborated** (PE-6), ranked by **leverage, not effort**. Promotion is a deliberate human pull.

## The strategic read

Frontier 7's v1 landed in the strongest possible way: the **macro-wallet cleared its own
onboarding** — E-039's live sweep minted and the loop built `vend init` + `vend doctor`. So the
keystone (Frontier 1) is now **watched clearing**, with cleared (not censored) forward-E1 for the
first time (0→4). Two things follow:

1. **The PM layer's job now is the strategic pulls, not the tactical fixes.** The loop is
   **auto-draining** the correctness items its own runs surface (E-038 timeout-headroom, E-043
   idempotent-mint-guard). Those don't belong in this batch — they clear without a human pull.
2. **Continue Frontier 7: demonstrate, then ship.** `vend init`/`doctor` are a foundation no one has
   *seen work* yet and can't yet *install*. The next leverage is the **hackathon example** (makes the
   value visible **and** accrues the cleared forward-E1 that moves the keystone provisional→confirmed)
   and **Homebrew delivery** (makes it installable). Both compound the keystone; neither is trust-gated.

The **multi-node DAG** stays the standing architectural keystone — ranked high, but **premature now**
vs. proving and adopting what's built.

## Ranked shortlist

### 1. Hackathon driveable example (+ `examples/` scaffold + `vend init --template`) — **Keystone**  ← recommended pull
**Signal:** `examples/templates/hackathon-seed/` — copy it, drive a *seed of an idea* into a real
board + first cleared slice in one short session, paired with a PM/designer. The experiential onramp
that makes the engineer-out-of-the-loop shift *felt*.
- **Advances:** the core feature on a fresh domain; P5 (non-dev pairing, Frontier 4); **accrues
  cleared forward-E1** → moves the keystone toward its ≥10 bar.
- **Budget:** ~1 block; exercises the **already-shipped** articulation trilogy + `vend init`.
- **Readiness/deps:** wants `vend init --template` (a thin extension of E-040). Related: the **steer
  self-referential-demotion** signal (E-037/E-039) sharpens the board quality on a fresh seed.
- **Rationale:** PRD v1.1; the most leverage-dense pull — proves the value, teaches it, and feeds the
  keystone in one move.

### 2. Homebrew delivery via `dist` (JS mode) + `justfile` — **High**
**Signal:** `brew install johnhkchen/vend/vend` — real `package.json` (`bin`/semver/drop `private`),
`bun build --compile`, tap + shell installer + release CI, mirroring lisa's toolchain.
- **Advances:** P5 (the literal local-first delivery).
- **Budget:** ~1–2 blocks; **spike-proven** (compiled binary runs BAML render+parse self-contained).
- **Readiness/deps:** `dist` is the same tool lisa already uses; composes with init/doctor.
- **Rationale:** PRD v2 — the "ship it." Best once #1 gives a reason to install.

### 3. Accrue cleared forward-E1 → ≥10 (Frontier 1 cadence) — **High**
**Signal:** keep running `vend work --no-intervened` clearing sweeps until cleared forward records
reach **≥10** — the bar that moves the macro-wallet's go from *provisional* to **confirmed**.
- **Advances:** P4/P7 — confirms the headline autonomy claim with evidence, not assertion.
- **Budget:** small/recurring; a **cadence**, not an epic — naturally driven by #1/#2's real runs.
- **Rationale:** the single highest-value *outcome* on the board; #1 and #2 are how it's earned.

### 4. Multi-node DAG (Frontier 3) — the v1 architectural centerpiece — **High/Keystone**
**Signal:** plays composing into a real typed graph (fan-out, join, conditional) beyond the linear
propose→decompose chain — "typed, graph-structured agent orchestration" made real.
- **Advances:** the core architecture; Frontier 2 (open-model runner) wants it underneath.
- **Budget:** several blocks (heavy).
- **Rationale:** the standing capability keystone — but **premature now** vs. demonstrating/shipping
  what just landed. The next big architectural pull once adoption justifies the commitment.

### 5. Small-business example + deploy-preset shelf (X-2) — **High**
**Signal:** the production-bar pick-choose-integrate speedrun — assemble a cost-effective full site by
*choosing* deploy presets (Cloudflare-class stacks), integrating only the APIs this business needs.
- **Advances:** the core feature at a *production* gate bar; the shelf as an integration catalog.
- **Budget:** multi-block — the **deploy-preset shelf** is the meatiest genuinely-new capability.
- **Rationale:** the second example, after #1 proves the driveable-template pattern.

### 6. Figma↔SPA design-system example (X-3) — **High**
**Signal:** an AI-built design system that **passes muster as a real Figma token system** — the
designer steers the UI by direct token edits, no dev-telephone. Forward (Figma→code) first, then the
two-way loop.
- **Advances:** P5 at its fullest (the non-dev round-trip); reuses Frontier 4's annotation→demand;
  E-032 per-play tooling (`mcp:["figma"]`).
- **Budget:** highest setup of the three examples; split X-3a (forward) / X-3b (two-way).
- **Rationale:** the best demo and the purest *consistency* proof — but highest uncertainty (does the
  generated system clear a designer's bar?); pull after #1 and the Frontier-4 primitive.

**Carried forward (staged, lower now):** Frontier 2 agentic open-model runner (wants #4); Frontier 5
walk-away UX (design-pull-first); Frontier 6 hygiene (stop-reason threading ~1h — makes #3 legible).
**Loop is auto-draining:** the `propose-epic` idempotent-mint-guard (E-043) and the steer
self-referential-demotion fix — tactical correctness its own runs surface; no human pull needed.

## Recommended next pull

**#1, the hackathon example.** `vend init`/`doctor` are a foundation no one has watched work or can
yet install — and the keystone needs *cleared runs* to go from provisional to confirmed. The
hackathon example is the one pull that **makes the value visible, teaches the loop-design shift, and
accrues the forward-E1 that confirms autonomy** — all on already-shipped capability. Ship the demo;
**#2 (delivery)** makes it installable, and **#3** is the cadence both of them feed.
