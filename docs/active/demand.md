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
| **Done Means Committed** (the D-005 fix) — `check:committed` fails when source sits uncommitted, fired by a lisa `on-stop` hook; makes "done" mean "committed". | **High** (enabler — stops the recurring andon that bit 3 loops, incl. the E-007 broken HEAD) | small (~1h) | **done → E-008** — `check:committed` live (dirty source → fail naming the file; clean → pass), wired into the `on-stop` hook (blocks the stop on uncommitted source, fails open). **D-005 fixed.** |

| **Register ProposeEpic** — the play above decompose: a demand signal → an epic card, cast through the engine; completes signal → epic → tickets. | **High** (core feature; the pipeline) | ~2-3h | **done → E-009** — ProposeEpic registered + cast live ($0.41): a signal minted a valid epic card (E-010, id disjoint, PE gates passed). **`signal → epic` is real; three plays cast through one engine.** |
| **HEAD-builds gate** (`epic/E-010.md`) — verify the committed HEAD itself builds (isolated checkout + `check`), catching inconsistent-but-committed commits like E-007's `cast.ts`-without-`play.ts`. E-008's follow-up. | **High** (closes local-green vs HEAD-green; P3/P4) | ~2h | **done → E-010** — `check:head` live (committed HEAD builds, isolated git-worktree, ~3s, no leak); wired to `on-clear` (per the decompose decision). **"Done" now means committed *and builds*.** |
| **`check:committed` scope-gap** — E-008's gate covers `src/baml_src/ci` but **not `.lisa/hooks/`**; E-010's own enforcement hook (`on-clear.sh`) slipped through uncommitted. Widen the gate to the lisa hooks (functional source — they enforce the gates). | **Standard** (closes the gate's blind spot — the commit-gate doesn't police the hooks that police commits) | small (~30m) | **done → E-012** — `SOURCE_PREFIXES` widened to `.lisa/hooks/` (one-line R12 contract); live andon proven (dirty `on-stop.sh` → exit 1, names the hook). **First epic both *minted and decomposed* by `vend chain` — the pipeline fed its own board.** |
| **Chain: Signal → Tickets** (`epic/E-011.md`) — cast ProposeEpic → DecomposeEpic as one gesture: a demand signal → epic card → tickets. The engine's first play composition; *vend the whole roadmap*. | **Keystone** (the core-feature capstone; P2, one gesture) | ~2-3h | **done → E-011** — `vend chain <signal>` live: one gesture minted **E-012** *and* threaded it to tickets (two run-log records); both paths proven — success (signal→epic→tickets) **and** halt (thin budget → ProposeEpic andon → decompose never ran, no half-output). `castChain` impure shell over pure `runChain`; 340 tests. **"Vend the whole roadmap" is real.** |
| **Measured envelopes** (`epic/E-013.md`) — read the run log's actuals; bound each play's cost at the value-tier percentile; surface it as the Confirm default so *accept-the-default* is earned, not guessed. The recalibration core (IA-12…IA-15). | **Keystone** (the budget contract made honest; the first rung of the 2-hour mechanic) | ~2-3h | **done → E-013** — `vend envelope <play>` live: reads run-log actuals, bounds at the value-tier percentile, de-biases a raw `--estimate` (IA-16), with honest cold-start/confidence (IA-8/IA-13 — censored excluded but counted, prior fallback). `src/ledger/recalibrate.ts`; 415 tests across every regime (percentile/censoring/cold-start/bias/3-way pooling). **The budget contract is measured, not guessed — the 2-hour mechanic now has measured prices to spend.** |
| **Trust & consistency evidence gate** (`epic/E-014.md`) — measure walk-away trust (A2) + gate-driven variance reduction (A5) from existing run-log data **before** building more autonomy; return a go/reroute decision. From the PM discovery's central finding (trust-before-autonomy). | **Keystone** (gates the macro-wallet; the cheapest highest-leverage move — measurement, not a feature) | ~0.5–1h | **done → E-014** — instruments shipped + 467 tests: E1 `vend run --intervened/--no-intervened` + `vend audit`; E2 `vend run --no-gates` + `run-probe.ts` (line-set Jaccard, censoring-aware). Findings note returns **HOLD** — *unmeasured ≠ weak*; the macro-wallet stays gated. **The evidence gate refused to fabricate a verdict — an andon at the roadmap level.** **E2 now measured: gates cut decompose variance ~21%** (0.62→0.49 dispersion, N=5; modest but real — *not* weak, so no E2 reroute). **E1 (walk-away) still needs forward self-reported runs → HOLD holds.** Side finding: decompose blows its 50k token envelope ~80% of the time (the `--max-turns` signal, quantified). **Update (E-026, 2026-06-19, corrected): the forward-E1 *instrument* is built (`vend work` self-measures), but only **2/10 genuine forward records** exist so far (1 a real `--intervened`, trust held). The 93%/15 `vend audit` is the *combined* ledger (13 back-fill + 2 fwd), NOT 15 forward carriers — T-026-04 over-counted that. Honest state: go stands **provisional + forward-leaning**, NOT forward-confirmed; ≥10-genuine bar at 2/10, accruing (`work/T-026-04/verdict.md`).** |
| **`expand-fragment`** (`epic/E-016.md`) — the demand-extraction primitive: a rough fragment (felt "this is rough", a one-liner, a TODO) → a board-ready, priced signal. Vend articulates *for* you — edit a draft, don't compose from blank. Upstream of ProposeEpic; the primitive the articulation lift reuses. | **Keystone** (the articulation lift's foundation; O1 gap 0.72; *not* trust-gated — ships while the wallet is parked, and accrues the E1 data that ungates it) | ~1 block | **done → E-016** — `vend expand "<fragment>"` live: a grounded fragment → a staged, priced signal in `pm/staged/` (read-never-invent ✓, honest-empty gate ✓, 511 tests). Sweep bugfix: the staging slug wasn't length-capped (a full-sentence `what` → ENAMETOOLONG) — fixed + regression-tested. **Findings:** (1) expand's own cold-start budget is too thin (a 100k run spent **211k** — the staged signal it produced is literally *"recalibrate expand's budget"*, self-referential; folds into batch #5 cold-start-envelope recalibration); (2) **high run-to-run variance** — 3 casts on the same grounded fragment gave signal / budget-blow / honest-empty (the honest-empty looked over-eager; a consistency note, cf. E-014). |
| **Survey play** (`epic/E-017.md`) — the run-0 bootstrap: `vend survey` reads a rough project (repo + docs + state) → a ranked, staged demand board of the highest-leverage moves it sees. `expand-fragment` at project scale; *"articulating is exhausting" → "review a list."* (IA-3/4.) | **High** (the cold-start half of the experience; 2nd brick of automating STEER; *not* trust-gated) | ~1 block | **done → E-017** — `vend survey` live: read this repo → an **8-signal ranked board** staged at `pm/staged/survey-board.md` (success, 8 turns, **300k budget held** — the E-016 generous-pre-fill lesson validated, no overrun). **PM-grade quality:** every signal grounded in real state (line numbers, obs IDs, source facts), it marked the macro-wallet **`blocked: E-014 go verdict`** (understood the trust gating), and it surfaced this session's own findings (cold-start recalibration, expand/survey variance). 541 tests. **The STEER stage is automatable — Survey produces a board comparable to the hand-authored batch.** |
| **SteerProject-lite** (`epic/E-018.md`) — `vend steer` reads a project → a ranked board **and** the real **forks** (the genuine decisions only a human can make), staged for assent. Productizes `project-steering.md`'s 10 moves; composes E-016 + E-017 and adds fork-surfacing. The steer capstone — *the fruit-picker itself*. | **High** (the steer capstone; 3rd/last brick of automating STEER; collapses the human to author+assent, `clearing-dynamics.md`; *not* trust-gated) | ~1–2 blocks | **done → E-018** — `vend steer` live: read this repo → a ranked board **+ 2 genuine forks** staged at `pm/staged/steer.md` (success, 6 turns, 400k budget held). **Fork-genuineness gate works:** the forks are real values calls — Fork 1 (*"where do the next blocks point now the articulation trilogy landed?"*) is literally **our actual next decision**, and it flagged the risk-appetite as *"yours to set, not mine"* (didn't manufacture/auto-decide); Fork 2 a real P5/N2 charter-boundary call. Board still PM-grade + gating-aware (wallet `blocked: E-014`). 576 tests. **STEER is now automated end-to-end (expand+survey+steer) — `vend steer` produces what the orchestrator made by hand all session.** |
| **Articulation consistency probe** (`epic/E-019.md`) — measure run-to-run consistency of expand/survey/steer + check honest-empty/fork over-eagerness (E-016 saw 3 casts → 3 outcomes). Generalizes `run-probe.ts` to any-play N-cast; reuses `variance.ts`. | **High** (the *"validate"* half of Vend's own "Consolidate & validate" steer fork; consistency IS the value prop, P3 — unmeasured on the widest surface) | ~1 block | **done → E-019** — generalized probe (`run-consistency-probe.ts`) + the loop ran a **9-cast live sweep** (N=3 × expand/survey/steer). **Verdict: consistency NOT yet acceptable — tune the gates.** Two failure modes: (1) **honest-empty over-fires** on grounded input — survey **67%**, expand **33%** false-negative abstention; (2) **signal dispersion unbounded** run-to-run — steer **0.72**, expand 0.50. **Budgets vindicated** (0/9 exhausted — the recalibration held). Confirms+generalizes E-016. → **3 signals surfaced** below. *Recalibration half done by hand (12k→250k, 16k→150k).* |
| **Honest-empty gate over-fires on grounded input** (surfaced by E-019) — survey 67% / expand 33% false-negative abstention on real demand; tighten the abstention threshold so it fires only on genuinely thin input. | **High** (the consistency promise, P3; honest-empty is the IA-4 gate the whole shelf leans on) | ~1 block | **done → E-020** — prompt-only recalibration of the honest-empty gate (`baml_src/survey.baml` + expand): rewritten from a co-equal *abstain-or-author* branch into a **rare, source-gated exception** (abstain only on a genuinely complete/frozen project; explicit "do NOT abstain because the board is saturated"). 731 tests. **Proof ✓ (re-run 2026-06-19):** honest-empty over-fire **eliminated** — expand **33%→0%** (3/3 now signal) and survey **67%→0%** (3/3 now stage a board) on the same grounded inputs. The prompt-only fix held. Built by the dogfood loop. |
| **Linear presentation surface** (`epic/E-021.md`) — make Vend's authoritative work-graph legible to non-dev teammates as a **calibratable, read-only projection** (data/presentation split; one-way authority — the projection never writes the canonical graph). MCP-independent first slice; the Linear renderer + the annotation→demand round-trip (reuses `expand-fragment`) are downstream epics. From the PM's `linear-surface-prep.md` + the steer Fork-2 *B-slice* call. | **High** (opens the visual-thinking segment; P5/P1; respects N2/N4) | ~2 blocks | **done → E-021** — full `src/present/` layer: graph loader → spec schema → vocab-translate → projection → paper/Mermaid renderer, **one-way-authority guarded** (a static guard + byte-hash E2E — never writes the canonical graph), + a calibration demo & rubric scorecard. **Verified live: the rubric probe rendered this repo's 61-ticket board into a jargon-free designer projection scoring "good enough: yes" on all 5 dimensions** (comprehension/structure/density/language/navigability). +145 tests (731). The MCP-independent slice; the Linear renderer + annotation round-trip are downstream. |
| **Articulation signal dispersion unbounded** (surfaced by E-019; reinforced by E-020's proof) — **expand 0.50 / survey 0.69 / steer 0.72** content variance run-to-run (survey's became measurable once E-020 stopped its over-abstention); the gates censor but don't *converge* content. Decide whether the consistency gate should converge output or whether divergence is by-design, and gate accordingly. | **High** (consistency IS the value prop, P3 — the *remaining* half of E-019's verdict after E-020) | ~1 block | **active → E-022** (`articulation-consistency-contract`) — pulled as **measure-then-decide**: is the dispersion *equivalent-diversity* or *genuine-disagreement*? → a **semantic-equivalence judge** (T-022-01) → the **consistency contract** (validity-not-lexical) + the converge-vs-by-design fork (T-022-02). The convergence *lever* (if chosen) is a downstream pull. **Status (T-022-02 + sweep): contract captured → `IA-17` (consistency = gated validity, not lexical identity). The live equivalence sweep RAN (N=3, 2026-06-19; `work/T-022-02/sweep-logs/`) and resolved the fork with data — overturning 2 of 3 recommendations: expand **by-design ✓** (equivalent-diversity 1.00); survey **converge** (genuine-disagreement 0.00 — boards differ run-to-run); steer **by-design** (equivalent-diversity 1.00 *despite* highest dispersion 0.80). Lesson: dispersion magnitude ≠ meaning. **Done — one downstream pull surfaced: survey-convergence (below).** |
| **Thread the structured stop-reason onto `RunSummary`/run record** (surfaced by E-019, instrument kaizen) — STOP-style plays (expand/decompose) fold honest-empty into `budget-exhausted` (stdout-only today), so the probe + `vend audit` can't split them; thread the stop-reason so the data is countable. *(Self-referentially, exactly what an early `vend expand` fragment described.)* | **Standard** (data fidelity; unblocks clean consistency/trust measurement) | small (~1h) | **ready**. |

**Next-pull call — the clearing pipeline is real.** v0 (E-001/E-003/E-004/E-005/E-002),
**E-007's first slice** (the `castPlay` engine), **E-008** (the commit gate), and
**E-009** (register ProposeEpic), and **E-010** (the HEAD-builds gate) are all done.
**The pipeline ran a full lap:** ProposeEpic *proposed* E-010, DecomposeEpic (by hand)
*cleared* it, a loop *built* it — and decompose corrected propose (`on-clear`, not
`on-stop`). Newly surfaced: the **`check:committed` scope-gap** (`.lisa/hooks/`
uncovered, ready). **E-011 (the chain — signal → epic → tickets in one gesture) is now
in flight** — the core-feature capstone. The other follow-ups —
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
| **Bound dispense exploration** (`--max-turns`) — `claude -p` is the full agent; the token fat-tail is *agentic wandering*, not input size (A2's tiny fixture once burned 119k). **Quantified by E-014's E2 probe (2026-06-19): `decompose-epic` blew its 50k token envelope ~80% of the time across 20 fresh casts (tail ~85–95k)** — it *censored* the consistency measurement until the per-cast budget was raised to 180k. Two angles: (a) add `--max-turns` / a system-prompt bound at the seam to cap the wandering; (b) decompose's 50k is a **cold-start guess too thin** — E-013's measured recalibration raises it once the log has tails. | **High** (was Standard) — cost predictability **+** the macro-wallet's per-cast token accounting needs a *bounded* denomination (IA-8: tokens are detect-after); it actively censored E-014's E2 measurement | small (~1h for `--max-turns`) | **done → E-015** — `--max-turns` live at the seam: `buildArgs`→`dispense`→`CastOptions`, warranted default **15 turns** on the Play contract (override wins), `turnsUsed` logged for data-driven tuning (IA-14 measure-then-tighten). 485 tests. **Empirical result (probe re-run): `--max-turns@15` did NOT shrink decompose's tail** — it's *bimodal* (lean <50k **or** ~85–94k) and the cap didn't move the high band, so the ~85–94k is **genuine cost, not turn-sprawl**. So `--max-turns` is a **safety bound, not decompose's cost lever**; the real fix was **recalibrating decompose's envelope 50k→120k from measured use** (the E-013 principle, by hand until the loop warms). Likely the other plays' cold-start envelopes need the same. |
| **Thread the real model id** — `runs.jsonl` logs `claude-cli-default`; the true id (`claude-opus-4-8[1m]`) lives on the terminal `result`. Thread it through the runner so the consistency layer reads truth. | **Standard** (data fidelity) | tiny (mins) | **done → E-005** |
| **`vend work` casts under the play default, not the wallet-reserved price** — surfaced by E-024's first live spend (`work/T-024-03/sweep-logs/findings.md`, 2026-06-19): the wallet predicts a chain at 455k (propose 227k + decompose 227k) and authorizes on it, but `castWork` calls `castProposeDecomposeChain` with **no budget**, so each step runs under its *static play default* (propose 150k). The #1 pull's propose needed 175k → blew the 150k default → `budget-exhausted` andon → **cleared 0**, though the wallet had reserved 227k for it. **`canAfford` is wired to the measured price; the cast is not** — the macro-wallet's premise is half-wired. Fix: thread the recalibrated prediction into `castProposeDecomposeChain` (per-step budget) so authorization == execution. *(P7 held perfectly — nothing partial, truthful receipt, clean exit; this is a functional gap, not a safety one.)* | **High** (blocks `vend work` from actually clearing work — the headline feature) | small (~1h, one wire) | **fixed → E-025 built** (`wallet-priced-casts`, 2026-06-19): per-step propose/decompose budgets on the chain (pure `resolveStepBudgets` core) + `castWork` threads the recalibrated envelopes it authorizes on (auth == exec). 830 tests. **Live re-sweep (2026-06-19): VERIFIED** — the exact sweep that cleared 0 under E-024 now **cleared 1** (#1 pull's propose cast at its 227k reservation → success → minted E-026 + decomposed → `lisa validate ✓`), stopped clean `wallet-exhausted` after one chain (P7 held). Auth == exec. `work/T-025-01/sweep-logs/findings.md`. |

| **`vend work` spends against a stale staged board** — surfaced by E-025's live re-sweep (`work/T-025-01/sweep-logs/findings.md`, 2026-06-19): `vend work` pulled `steer.md` (~10h old, pre-measurement-sprint) and cleared its #1 signal ("run the E1 sprint"), minting **E-026** whose premise — "flip E-014's HOLD" — was already resolved to *go* hours earlier. The spend was correct; the *board* was stale. **A wallet spent down a stale board clears already-done / superseded work.** Fix options: `vend work` re-surveys/re-steers before spending, or freshness-checks the board's age, or filters candidates against the live epic/ticket state. | **High** (correctness of the headline autonomous loop — it can clear stale work convincingly) | small–medium | **active → E-027** (`board-freshness-gate`) — refuse a board staged before the project last moved (amber andon, IA-9) + `--stale-ok` override (IA-5); live proof is free + deterministic |

| **`vend audit` doesn't separate back-filled from forward E1** — surfaced by E-026's verdict (2026-06-19): `auditWalkAway` counts every `intervened`-carrying record the same, so the 13 post-hoc *attested* back-fill records and the 2 *live forward* records read as one "15 carriers / 93%" number — and T-026-04 over-counted the back-fill as forward, claiming "forward-confirmed" off a 2-record forward sample. The `intervenedAttestation` marker (`attest-intervention.ts`) already tags back-fill; `vend audit` should **split the rate: attested vs live-forward** (and a verdict should cite the forward-only count). | **High** (the trust gate the macro-wallet rests on must not conflate attested with measured) | small (~1h — read the marker, split the stat) | **active → E-028** (`audit-provenance-split`) — `reviveRecord` surfaces the marker + `auditWalkAway` splits attested/forward + render both; root cause is the reader strips the marker, so audit can't see provenance |

*Noted, not yet a signal:* the token budget is **detect-after** (an accountability
andon, post-completion); only the wall-clock budget halts mid-flight. Both honor
P7's "no partial materialization," differently. Document in the budget notes;
revisit only if a hard token cap is ever needed.

## Not yet pulled

Surfaced demand, deliberately un-elaborated until pulled:

- **Measurement sprint** (unblocks E-014's verdict) — **done 2026-06-19 → verdict: go.** Both
  numbers collected: **E1** walk-away **100% (13/13)**, KR1 ≥10 met (via the auditable back-fill
  `src/ledger/attest-intervention.ts` — post-hoc, attested, marked as such); **E2** clean **21%**
  stands + a censored-but-corroborating E-023 read (the `value` gate refused 3/5 empty plans).
  Neither reroute branch fires → the pre-wired rule reads **go: un-gate the macro-wallet** (below).
  **Caveat (load-bearing):** E1 is *uniform / post-hoc / single-attestor* (zero `--intervened`), so
  it's "didn't-break," not "stress-tested" — a forward, variance-bearing E1 is the real next
  collection. `work/measurement-sprint/findings.md`. **Forward-E1 instrument built (E-026): `vend
  work --intervened/--no-intervened` now self-measures. Forward records so far: 2/10 genuine (1 a
  real intervention — trust held under the first step-in). Combined ledger 93% (14/15) is mostly the
  back-fill; the ≥10-genuine-forward bar is NOT yet met. Go stands provisional + forward-leaning, NOT
  forward-confirmed (T-026-04 corrected; `work/T-026-04/verdict.md`).**
- **The "work for 2 hours" macro mechanic** — the founding gesture made literal: the
  human allocates a **feature-block budget** (the ~2h macro envelope) at the counter,
  and vend spends it *down* autonomously across casts — pulling/chaining until the
  budget is exhausted or the board is cleared, each cast fit into the **remaining**
  macro budget using its measured price. **The rung directly above E-013** (measured
  envelopes are the prerequisite — you can't spend a macro budget intelligently against
  guessed per-cast costs). **Keystone**; E-013 landed. A macro budget *wallet*
  that depletes (P7) + the autonomous spend-until-exhausted loop (P4).
  **✅ Un-gated by E-014 (2026-06-19): go.** The measurement sprint collected both numbers and
  neither reroute branch fired (E1 walk-away 100%/13, E2 21%) → the pre-wired rule green-lights
  the wallet. **Build it with the andon/budget hard-stops intact (P7)** — the trust evidence is
  *didn't-break*, not *stress-tested* (E1 is uniform/post-hoc; see the caveat above), so the
  wallet's own first runs become the forward, variance-bearing E1 the back-fill couldn't be.
  **Now pullable** (was HOLD); `work/measurement-sprint/findings.md` + `work/T-014-03/findings.md`.
  **◐ Forward-leaning, not yet forward-confirmed (E-026/T-026-04, 2026-06-19, corrected): the
  forward-E1 *instrument* is built (`vend work` self-measures), but only **2/10 genuine forward
  records** exist (1 a real intervention — trust held). The 93%/15 is the combined ledger (13
  back-fill + 2 fwd), not a forward-only read. No reroute (1 step-in ≠ "keeps intervening"); the go
  stays as shipped but **provisional** until ≥10 genuine forward accrue. `work/T-026-04/verdict.md`.**
  **→ E-024 built 2026-06-19** (`macro-wallet`): the depleting wallet (T-024-01, P7) → the
  autonomous spend loop (T-024-02, P4) → the `vend work --budget <ms>,<tokens>` counter gesture
  (T-024-03). `vend work` is wired + green (825 tests); the full **live multi-cast spend** (≥1 real
  cleared pull) is the one **deferred human sweep** — matches T-017/T-018's live-cast deferral. Its
  own autonomous runs become the forward variance-bearing E1.
- **Information architecture** — *captured* → `knowledge/information-architecture.md`
  (IA-1…IA-15): recommendation-first home, the cold-start arc, the Counter
  (Confirm→Run→Settle), the andon-as-successful-refusal stance, and the **Ledger
  recalibration loop** (IA-12…IA-15 — the andon-budget control loop; now *building* as
  E-013). The capped spine TUI epics anchor to. Remaining **open threads** (the
  detached/notify mechanism, the fleet/DAG andon board, Confirm's budget-adjust
  gesture) are the next design pulls.
- **Survey-convergence** — **done → E-023** (`survey-convergence`, 2026-06-19). *Resolved:
  measure-then-decide said accept, not build — no lever.* The head-isolating probe (T-023-01) read
  survey at N=3: lexical head **flips** (the #1 is reworded each cast) but semantic head is
  **stable 1.00** (3/3 — the #1 pull is the *same* keystone scaffold every time). E-022's
  whole-board `genuine-disagreement` over-counted: it scored the **tail**, not the head IA-1 feeds.
  So **IA-17 amended** — survey divergence is *tail re-ordering by-design; the load-bearing #1 pull
  is consistent run-to-run*. **No convergence lever built** (you don't converge a head that doesn't
  move — the E-014/E-022 discipline paying off a second time). All three articulation plays now
  resolved **by-design**; the E-019 dispersion thread is closed. Re-measure trigger: once `src/**`
  is no longer empty (the keystone resolves, a new #1 must emerge). `work/T-023-02/findings.md`.
- **Design-language session** — assemble the project-wide *look* (the visual surface:
  palette — amber andon per IA-9, run-stream, budget meter, shelf cards); output a
  capped design charter, downstream of the IA spine. High; precedes any TUI epic.
  Generative, not an audit. (Inherits IA-9's amber-not-red andon family.)
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
