# Sprint plan — Vend

**Date:** 2026-06-19 · Backlog source: `triage-report.md` (P1/P2) + `discovery-foundation.md`
experiments. **Adapted to Vend's economics:** there is no human team and the charter
**rejects story points** ("agent runs are fat-tailed — bound, never estimate" — `demand.md`).
So *capacity = budget-block envelopes*, *velocity = blocks cleared*, and the buffer is
sized for fat tails, not the generic 15–20%.

---

## Sprint goal

> **Validate that Vend's gates earn walk-away trust and produce measurable consistency —
> and land the one enabler that makes the macro-wallet's budget honest — so the next build
> is gated by evidence, not assumption.**

Success = the OMTM (*walk-away rate*) and the gate-driven variance number both **exist**
(they don't today), `--max-turns` makes the token meter a real wall, and the macro-wallet's
first slice is decomposed and started against that evidence.

## Capacity *(envelopes, not points)*

- **Unit:** the **~2-hour macro feature-block** (`demand.md`). 1 block ≈ one feature's
  wall-clock + token envelope.
- **Duration:** 2-week sprint, framed as **~6 feature-blocks** of allocatable budget.
- **Fat-tail buffer: ~35%** (≈2 blocks) — *larger than the standard 15–20%* because a cast
  can blow up 10× (`demand.md`); the buffer absorbs the tail, the wall-clock gate (P7) and
  `--max-turns` cap it.
- **Committed: ~4 blocks · Buffer/stretch: ~2 blocks.**

## Definition of Ready / Done *(this project's earned norms)*

- **DoR:** the charter's five criteria (purposeful · grounded · allocatable · in-bounds ·
  verifiable) **+** valid lisa frontmatter. ⚠ **Most backlog items are *signals*, not ready
  stories** (PE-6, un-elaborated) — they need ProposeEpic→DecomposeEpic to *become* tickets.
- **DoD:** **"done" means committed *and* builds** — verified by `git status` + `check:head`,
  **not** `lisa status` (the D-005 lesson; gates `check:committed`/`check:head` enforce it).

---

## Committed stories *(highest-leverage first)*

| # | Story | Envelope | "Owner" | DoR | Depends on |
|---|-------|----------|---------|-----|------------|
| **1** | **E1 + E2 — trust & consistency measurement.** Instrument the run log for *mid-run intervention rate* (walk-away, A2) + run one play 5× ±gates for *output-variance reduction* (A5). | ~0.5 block | author + a measurement script | needs the 1-pager experiment spec written first (sub-task) | existing run-log data (have it) |
| **2** | **`--max-turns` token hard-wall.** Bound agentic wandering on the dispense seam so the token denomination becomes a mid-flight wall, not detect-after (IA-8). | ~0.5–1 block | a cast on the executor seam | **Ready** (long-standing kaizen) | none — isolated |
| **3** | **Macro-wallet, first slice — pull + decompose + build.** ProposeEpic→DecomposeEpic the depleting wallet + one spend-down loop over `castChain`, each cast priced by `vend envelope`. | ~2 blocks | `vend chain` → a lisa loop | **Not ready** — a signal; *this story is the decompose-then-build* | E-013 (done) · #2 (honest token accounting) · **#1 evidence gates the *second* slice** |
| **4** | **Spec the two existential gaps** — a 1-page **P6 second-executor spike** plan (A8) + a **pricing/WTP probe** plan (A7). Planning casts, not builds. | ~0.5 block | a planning cast | Ready (planning) | none |

**Committed ≈ 3.5–4 blocks.** Within capacity.

## Stretch / buffer *(pull only if blocks remain)*

| # | Story | Envelope | Note |
|---|-------|----------|------|
| 5 | **Register the Survey play** (run-0 bootstrap, IA-3). New play on the proven engine. | ~1–1.5 blocks | Independent — parallelizable; good buffer-filler |
| 6 | **IA-15 ledger-generates-demand** (auto-surface signals from run-log trends). | ~2 blocks | Higher value but likely overflows; carry to next sprint |

**Explicitly OUT this sprint:** the **TUI surface / Counter** (P2 but XL and trust-gated —
build it *after* E1 confirms trust and *after* a design-language session); the **fleet/DAG
andon board** (premature). Naming the cut prevents scope creep.

---

## Dependencies & critical path

```
#1 E1/E2 (evidence) ─────────────┐
                                 ▼
                          [decision gate: is walk-away trusted?]
                                 │  yes → proceed   │ no → reprioritize andon UX over the wallet
                                 ▼
#2 --max-turns ──► #3 macro-wallet decompose ──► wallet first slice (build)
   (must merge before                              │
    the wallet's accounting                        ▼
    is trustworthy)                          DoD: committed + check:head green
#4 spec gaps ── parallel, independent
#5 Survey ───── parallel, independent (stretch)
```

- **Critical path:** #1 → decision → #3 (decompose → first slice). #2 is a hard prerequisite
  that must land *before* the wallet's budget subtraction is trusted.
- **External dependency:** none human; the only "external" is the executor (Claude Code) —
  itself the platform risk, tracked via #4, not blocking.

---

## Risks & mitigations

- **Fat-tail blowup** (a cast 10×'s its envelope) → the wall-clock gate halts mid-flight
  (P7); the 35% buffer absorbs it; **#2 `--max-turns`** caps token wandering. *This is why #2
  is committed, not deferred.*
- **Macro-wallet isn't Definition-of-Ready** (a signal, likely > 1 block — PE-7) → ProposeEpic
  **right-sizes** it; commit only the **first slice** (split wallet-ledger from spend-down
  loop); don't let one card inflate.
- **Building autonomy before trust is validated (A2)** → **sequence #1 first**; the decision
  gate lets *walk-away rate* gate the wallet's second slice. *(The recurring cross-doc insight,
  made operational.)*
- **Knowledge concentration** — one author *is* the whole team → durable capture (the steering
  play already does this) + the codebase-index MCP grounds any agent that picks up the work.
- **Platform risk (A8)** looms but isn't sprint-fixable → **timebox #4 to a planning cast**;
  don't let the teardown expand into the sprint.

---

## Bridge

This sprint operationalizes the desk's through-line: **measure (Theme D) before building more
autonomy (Theme A), and harden the budget contract (`--max-turns`) before spending it down.**
If E1 shows trust is *not* there, the decision gate reroutes the next sprint to the andon UX /
design-language — exactly the contingency `discovery-foundation.md`'s decision framework names.
