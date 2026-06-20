# T-026-02 — Research: casting forward E1 walk-away sessions

**Ticket:** cast-forward-e1-sessions (task) · Story S-026-01 · Epic E-026 · depends_on T-026-01
**Goal (AC):** the run ledger holds **≥10 sessions from real casts** (a mix of `intervened=true/false`), each traceable to an actual run id with its envelope/outcome — **verified non-synthetic**; a bounded multi-sitting background sweep is **flagged**, not the sample **padded**.

Descriptive only — what exists and what constrains the cast. Options/decisions are Design.

## What T-026-01 established (the gate in front of this)

T-026-01 (spike, `phase: done`) proved the **andon-probe** real-session path: two live `vend run … --intervened|--no-intervened` casts under a **1-token ceiling** wrote `intervened:true` / `intervened:false` to `.vend/runs.jsonl`, board-safe (`materialized:false`), and `vend audit` read them back. Verdict: instrument READY.

But its `review.md` flagged the very gap this ticket runs into (notes #2–#3):
- **#2 "budget-exhausted ≠ walk-away."** Those probes are andons, not walk-away successes. The sprint "must cast under real budgets so its records are genuine `success` walk-aways."
- **#3 "Materialize on real sprint casts."** A real `success` decompose **will** write stories/tickets to the board; the sprint needs an epic that decomposes cleanly or must accept/curate the output.

So the readiness gate verified the wire **in andon mode only**. Whether genuine forward evidence can be produced is exactly what this ticket discovers.

## The two cast paths that reach the ledger

**Path A — `vend run <play> <epic.md> --budget <ms>,<tokens> --intervened|--no-intervened`**
`cli.ts:parseRunArgs` (l.412) parses the presence-flag pair → `cli.ts` run arm (l.687) → `dispatch.runPlay` → `decompose-epic.ts:assembleAndCast` → `engine/cast.ts:castPlay`. `castPlay` spreads `intervened` into the single `appendRunLog` call (l.229) **independent of outcome**. This is the ONLY path that threads the E1 self-report bit today.
- **Constraint:** `assembleAndCast` always assembles *decompose* inputs, so `vend run` is effectively decompose-epic only.
- **Constraint (the iron one):** for decompose-epic, `success ⟺ materialize`. `castPlay` runs `play.effect` only when `verdict.materialize` is true, which only happens on `success`. `decomposeEffect` writes story+ticket files to `docs/active/{stories,tickets}`. So **any genuine success writes to the board**; the only board-safe outcomes are the censored ones (`budget-exhausted`, `timed-out`) and the refusals (`gate-failed`, `id-collision`), all of which stop *before* the effect.

**Path B — `vend work [--budget] [--board] [--stale-ok]`** (the macro-wallet gesture)
`cli.ts:work` arm (l.593) → `work.ts:castWork` → `spendDown` → `castProposeDecomposeChain` (per board signal) → two `castPlay` casts (propose + decompose), each appending one record. This is the genuine **"fund it and walk away"** production path — real budgets, real successes against the live wallet, legitimate board output (it minted E-026 autonomously earlier today).
- **The blocker:** `ChainProposeDecomposeOptions` (chain-propose-decompose.ts l.34) has **no `intervened` field**, and neither step's `opts` sets it. `WorkOptions` (work.ts l.48) has none either, and `parseWorkArgs` (cli.ts l.372) parses no `--intervened`. So **every `vend work` cast records the ledger with the `intervened` field absent** — confirmed in the ledger: the live `vend work` records at 05:04–05:24Z carry no `intervened` key.

## The read path (`vend audit`) — what counts

`cli.ts:audit` arm (l.665) → `walk-away.ts:auditWalkAway`. The intervention sample is `scope.filter(r => r.intervened !== undefined)` (l.166) — **any carrier of the bit, any outcome, counts.** Walk-away rate is rendered as `1 − interventionRate` (`reported - intervened` "ran untouched"); `trend` splits the carriers in half. `false` is a value (kept verbatim); only absence is unknown. The audit filters by **play**, not epic, so probe records can't be excluded by id (T-026-01 note #1).

Implication: mechanically, **andon records carrying the bit raise the carrier count** and move the rate. But the rate over forced 1-token andons measures the self-report wire, not genuine "can I trust an autonomous run" behaviour — which is the quality concern T-026-01 #2 raised and E-014's verdict actually hinges on.

## Current ledger state (`.vend/runs.jsonl`, 25 lines)

- 15 records carry `intervened`; **13 are the post-hoc attestation back-fill** (`attest-intervention.ts`, marked `intervenedAttestation`, basis excludes synthetic/probe epics).
- **2 are genuine live forward captures** — T-026-01's probes (`epic:"verify-e1-instrument-readiness"`, `intervened:true`/`false`, `outcome:budget-exhausted`, no attestation marker). These are the only genuine forward records so far. Both andon-outcome.
- The recent `vend work` / chain records (propose-epic, decompose-epic E-026) are genuine successes **but carry no `intervened` bit** — the blocker above.

## The "genuine" tension, stated precisely

The AC wants ≥10 real, non-synthetic, mixed-bit sessions "so the walk-away rate is read from genuine behaviour." Three mutually-exclusive ways to get there, each with a wall:
1. **Board-safe `vend run` andons** (T-026-01 mode, ×10): real + non-synthetic + mixed bits, but **degenerate** (1-token andons the author never had a real chance to walk away from). Producing 10 to hit the count is **padding the sample** — which the AC explicitly forbids.
2. **Genuine `vend run` successes** (×10): real walk-away behaviour, but each **materialises to the board** (pollution) and needs ~10 undecomposed epics — none exist (E-001…E-027 are all decomposed); throwaway epics risk id-collision and add board churn.
3. **Genuine `vend work` successes**: the real "against the live wallet" behaviour the AC describes — but the gesture **does not carry the bit**, so its records are unmeasurable for E1.

## Cost / latency / environment constraints

- Each cast spawns `claude` via the Agent SDK (`executor/claude.ts:dispense`): real tokens (~$0.4–0.7/decompose), ~1–3 min wall-clock. Ten sequential genuine casts ≈ $5–7 and 20–40 min — a **bounded multi-sitting background sweep**, exactly the case the AC anticipates flagging.
- The staged board is currently **stale** (E-027 freshness gate); `vend work` would refuse without `--stale-ok`, casting nothing.
- The SDK is authenticated/reachable in this repo/session (T-026-01's casts + today's autonomous sweeps); a headless/cron environment would need its own readiness check (T-026-01 note #4).

## Assumptions & constraints carried into Design

- **A1.** The bit threads as **pass-through data** (the proven `project`/`model`/`intervened`-on-`run` pattern): no transform, logged regardless of outcome. Wiring it through `vend work` is low-risk and mirrors an already-tested path.
- **A2.** Board safety is non-negotiable for any probe-only cast (T-026-01 #2 invariant). Legitimate `vend work` output (a real epic decomposition) is *not* pollution — it is the product working — but must be human-reviewed (IA-5), like E-026.
- **A3.** "Non-synthetic" = an actual `vend run`/`vend work` invocation through the SDK; a hand-written ledger line or unit-test fake does not satisfy the AC.
- **A4.** Reaching ≥10 genuine records is intrinsically multi-sitting (latency + cost) and the AC says **flag it, don't pad** — so the deliverable centres on making the genuine path *capturable*, then accumulating, not on force-fabricating a count.

## Open questions for Design

- Pad with degenerate andons (forbidden), pollute with throwaway successes, or **wire the genuine `vend work` path to carry the bit** and accumulate over real sweeps?
- If wiring `vend work`: is that in scope for an "evidence" ticket, given it is the *only* path to the genuine evidence the AC describes?
- How to prove the wired bit lands end-to-end without an unbounded/board-mutating live sweep in this sitting?
