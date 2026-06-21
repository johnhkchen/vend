# Steer — staged board + forks

A ranked demand board read off the whole project, highest-leverage first. Un-promoted: review and pull a row.

| Signal | Value | Budget (envelope) | Status |
|---|---|---|---|
| **Re-run the bounded metered sweep again after E-039 settles to accrue CLEARED forward-E1 records toward the ≥10 bar.** — This is the charter's #1 keystone gap (P4/P7): the macro-wallet's go is provisional at 4/10 forward records, all censored. Only cleared sweeps fully ungate autonomy — a cadence, not one epic. | **Keystone** | ~1 block (≈2h) per sweep, metered/bounded by P7 | blocked: E-039 (T-039-01 live sweep + T-039-02 settle) must complete first; re-pull only after its honest verdict (advances [P4, P7, the trust cadence that ungates the macro-wallet go] · grounded in demand.md Frontier 1 ('now 4/10, all censored'; '≥10-genuine bar fully ungates'); T-039-01.md (the in-flight live re-sweep) — work/T-039-01/ has research/design/structure/plan but no sweep-log.md yet (awaiting lisa loop).) |
| **Author `vend init` — one idempotent command that scaffolds a vend+lisa project (board, pm/ desk, epic/stories/tickets/work, knowledge stubs, .vend/ state) over a bare lisa project.** — PRD-recommended first pull of Frontier 7; the foundation everything else in distribution stands on. Compounds the keystone: more driveable projects → more cleared runs → forward-E1 accrual. | **Keystone** | ~1 block (≈2h) | ready — PRD-elaborated; compile/BAML spike proven green this session (advances [P5, P2, core feature (clearing work for any project, not just this repo)] · grounded in PRD-distribution-onboarding.md §7.2 feature 1 + §8 'v1 — the foundation (the recommended pull)'; proposed-batch.md (PM 2026-06-20 cycle); demand.md Frontier 7.) |
| **Author `vend doctor` — an envinfo-backed preflight that verifies lisa + claude on PATH, BAML bundled/loadable, and executor config, refusing cleanly with fix-it hints (gated, not a crash).** — Smallest, most-ready piece of Frontier 7 and immediately useful for debugging the vend+lisa combo even during the current live sweeps. A clean gated refusal advances the correctness contract. | **High** | small (~1h) | ready (advances [P5, P3 (clean gated refusal), core feature (legible failures)] · grounded in PRD-distribution-onboarding.md §7.2 feature 2 + §8 ('smallest, most-ready; immediately useful'); lisa's check_required_deps-before-run_loop pattern cited there.) |
| **Build the multi-node typed DAG — plays composing into a real graph (fan-out, join, conditional) beyond the linear propose→decompose chain.** — The architectural centerpiece of the v1 vision ('typed, graph-structured agent orchestration') still unbuilt; also the substrate Frontier 2's open-model runner likely wants underneath it. | **High** | several blocks | ready (advances [core feature (graph-structured orchestration — the v1 vision)] · grounded in demand.md Frontier 3 ('Multi-node DAG ... The architectural centerpiece ... still unbuilt. High/Keystone').) |
| **Ship the hackathon `examples/` template wired to `vend init --template <name>` (seed → driven board, gold-mastered expected outcome).** — The v1.1 value proof — turns the scaffold into a visible win AND is the test of assumption A3 (steer/survey useful off a thin domain seed, not just this repo). Generates the cleared runs that feed the keystone (KR2/KR4). | **High** | ~1–2 blocks | blocked: vend init (the scaffold + the --template seam) (advances [P5, core feature, feeds the P4/P7 keystone (cleared forward-E1)] · grounded in PRD-distribution-onboarding.md §8 'v1.1 — the value proof' + §7.4 A3; demand.md Frontier 7 ('driveable hackathon examples/ template').) |
| **Thread the structured stop-reason onto the run record so honest-empty and budget-exhausted are countable (not stdout-only).** — The cleanest ready hygiene lever: unblocks clean consistency/trust measurement that the probe + `vend audit` can't currently split — and trust measurement is exactly what the keystone cadence is accruing. | **Standard** | small (~1h) | ready (advances [P3, core feature (verifiable clearing — countable stop-reasons)] · grounded in demand.md Frontier 6 ('Thread the structured stop-reason ... so it's countable. Standard. Ready — small (~1h)').) |

## Pull these

A human pulls any one staged signal onto the board with one gesture:

```
vend chain "Re-run the bounded metered sweep again after E-039 settles to accrue CLEARED forward-E1 records toward the ≥10 bar. — This is the charter's #1 keystone gap (P4/P7): the macro-wallet's go is provisional at 4/10 forward records, all censored. Only cleared sweeps fully ungate autonomy — a cadence, not one epic."   # recommended next pull (highest leverage)
vend chain "Author `vend init` — one idempotent command that scaffolds a vend+lisa project (board, pm/ desk, epic/stories/tickets/work, knowledge stubs, .vend/ state) over a bare lisa project. — PRD-recommended first pull of Frontier 7; the foundation everything else in distribution stands on. Compounds the keystone: more driveable projects → more cleared runs → forward-E1 accrual."
vend chain "Author `vend doctor` — an envinfo-backed preflight that verifies lisa + claude on PATH, BAML bundled/loadable, and executor config, refusing cleanly with fix-it hints (gated, not a crash). — Smallest, most-ready piece of Frontier 7 and immediately useful for debugging the vend+lisa combo even during the current live sweeps. A clean gated refusal advances the correctness contract."
vend chain "Build the multi-node typed DAG — plays composing into a real graph (fan-out, join, conditional) beyond the linear propose→decompose chain. — The architectural centerpiece of the v1 vision ('typed, graph-structured agent orchestration') still unbuilt; also the substrate Frontier 2's open-model runner likely wants underneath it."
vend chain "Ship the hackathon `examples/` template wired to `vend init --template <name>` (seed → driven board, gold-mastered expected outcome). — The v1.1 value proof — turns the scaffold into a visible win AND is the test of assumption A3 (steer/survey useful off a thin domain seed, not just this repo). Generates the cleared runs that feed the keystone (KR2/KR4)."
vend chain "Thread the structured stop-reason onto the run record so honest-empty and budget-exhausted are countable (not stdout-only). — The cleanest ready hygiene lever: unblocks clean consistency/trust measurement that the probe + `vend audit` can't currently split — and trust measurement is exactly what the keystone cadence is accruing."
```

## Forks

The genuine decisions only the human can make — each recommendation-first. Assent or override:

### Fork — Once E-039 (the live re-sweep) settles, what gets pulled next — keep grinding the Frontier 1 cadence, or pivot to Frontier 7's `vend init`?
- **Why it matters:** The keystone's remaining gap (≥10 cleared forward-E1 records) is starved precisely because there is only ONE driveable project — this repo. Grinding more sweeps against a single project hits diminishing returns; the cadence needs more projects to drive. `vend init` + examples manufacture exactly that supply, so Frontier 7 is the keystone's enabler, not a competitor. Pull-discipline (PE-6) makes this a human-only call.
- **Options:**
  1. Pull `vend init` (Frontier 7): build the enabler that creates MORE driveable projects, which is the true bottleneck on the keystone's ≥10 cleared-run cadence.
  2. Keep grinding Frontier 1: re-sweep again immediately (and, if E-039 0-clears, chase the next recalibration fix — decompose/token censor — the way E-038 fixed the propose censor).
  3. Pull Frontier 3 (multi-node DAG): the architectural centerpiece, heavier, but doesn't compound the trust cadence.
- **Vend recommends:** Pull `vend init` (option 1). The PRD already grounds it as the recommended first pull, and it is the highest-leverage move that compounds the keystone instead of starving alongside it — let E-039 settle first to bank its honest verdict, then pivot.

### Fork — Within Frontier 7's v1, sequence `vend init` first (foundation) or `vend doctor` first (smallest, most-ready)?
- **Why it matters:** These compound differently. `init` unblocks the template/examples chain (the value proof, KR2/KR4) and is the dependency root. `doctor` is independently shippable, lower-risk, and delivers value during the current live-sweep work before any new-user ever arrives — but it unblocks nothing downstream. The order sets which payoff lands first.
- **Options:**
  1. `vend init` first — the scaffold everything else stands on (foundation-first, per the PRD's stated sequencing).
  2. `vend doctor` first — smallest, most-ready, and immediately useful for debugging the vend+lisa combo RIGHT NOW while the live sweeps (E-037/38/39) are running.
- **Vend recommends:** `vend init` first (option 1), per the PRD's foundation-first logic — but if the live sweeps keep hitting cryptic dep/runtime failures, `vend doctor` is the cheap, self-serving exception worth jumping the queue for.

_Staged by Vend's `steer` play — not promoted; pull a signal / assent to a fork to clear._
