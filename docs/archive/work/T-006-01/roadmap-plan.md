# Vend — Roadmap Plan: the next wave of stories

> Cast of **Survey the Roadmap** (E-006, a Blue *sorcery*). Cross-references the
> knowledge base (`docs/knowledge/**`) with the roadmap (`demand.md` + the epic cards
> + `.vend/decisions.jsonl`) and lays out the **next wave of stories**, sequenced by
> leverage + readiness. Stories only — no tickets materialized. *Go and see, then
> chart the course.*

Survey time: 2026-06-18, on `main` after `4a1d632` (E-001 converged + committed).

---

## How to read this

- **Value tier** (`demand.md`, leverage not effort): **Keystone** (unblocks the DAG /
  *is* the core feature) → **High** (advances the core feature or a charter invariant,
  or de-risks much that follows) → **Standard** (real value, bounded blast radius) →
  **Leaf** (unblocks nothing).
- **Budget envelope** is a *bound*, not an estimate — agent runs are fat-tailed. Unit:
  wall-clock + token ceiling; the human macro-unit is the **~2-hour feature block**.
- **Cite, don't invent** — each story names the KB doc(s) that drive it; alignment is
  *recomputed* against the charter, not asserted.
- **Stories only.** This plans the wave; each epic's own later `DecomposeEpic` cast
  materializes its tickets. Story ids are **epic-scoped** (`S-<epic>-<n>`) — see the
  bounds check (F1) for why the flat scheme was retired here.

## The recommended pull order

Ranked by leverage × readiness (not effort, not ID order):

1. **E-004 — cross-board-id-guard** ⟵ **recommended next pull.** High-leverage
   *enabler*, ready today, and the one prerequisite `demand.md` names for letting the
   *machine* decompose the next epic **in place** instead of in a sandbox. Without it,
   pointing `DecomposeEpic` at the now-populated board clobbers ids — the same defect
   (F1) is *already biting at planning time*. Cheapest unlock of every later cast.
2. **E-005 — thread-real-model-id** — tiny, ready, rides alongside E-004. Makes the
   run ledger read the *true* model, so budget calibration stands on truth (P3).
3. **⟂ THE FORK — E-003 shelf ⟂ E-002 CI** — both **High**, opposite directions.
   Surfaced as a decision for the human (next section), not silently resolved.
4. **E-007 — casting-engine (sorcery)** — last. Highest *future* leverage (the
   product's next leap) but lowest readiness: its input is the friction this very
   survey produces (F4). Sequencing it last is itself a finding.

## The fork — surfaced, not resolved (the andon)

`demand.md` states it directly: after E-001, the `vend` shelf (E-003) and the CI
backstop (E-002) are **both High but pull in opposite directions** — the shelf
advances the *core feature*, CI is the *enabler* — and "the board surfaces the trade,
it doesn't resolve it." This survey hands the call up rather than fabricating a winner
(`project-steering.md`: ask on real forks, decide-and-proceed on defaults).

- **Recommendation — E-003 shelf first.** It advances the **core feature** directly
  (**P2**, the first real counter). CI is an enabler and, by our own lens
  (`ci-strategy.md`), the *weakest check type*; it de-risks a parallel fleet that
  mostly doesn't exist yet. And the sequencing composes: once E-004 (step 1) lands,
  the shelf can dispense `DecomposeEpic` against the live board safely — E-003's value
  is *unlocked by the recommended-first pull*.
- **Alternative — E-002 CI first** (the human's to weigh): correct if the priority is
  de-risking the fast-committing parallel fleet **before** it scales, catching
  structural defects at the source rather than letting a defect travel into the next
  agent's context (`ci-strategy.md` trigger model). A "which risk first" call.

---

## Planned stories

Pull order, top to bottom. Each carries: outcome · value · budget · readiness · cites
· advances · known-done-by.

### E-004 — cross-board-id-guard  ⟵ recommended next pull

- **S-004-01 — guard-materialize-against-collision**
  - **Outcome:** `materialize` refuses (andon, no write) when any generated story/
    ticket id collides with an existing id on the target board — or ids are namespaced
    by epic so collision is impossible.
  - **Value tier:** **High** (enabler — prerequisite to machine-decomposing E-002/E-003
    in place).
  - **Budget envelope:** ~1h block; token ceiling small (a guarded write + one test).
  - **Readiness:** **ready** (E-001 done; the seam exists).
  - **Cites:** `epic/E-004.md`; `playbook-decompose-epic.md` (gate 4, the structural
    poka-yoke this extends); `decisions.jsonl` D-006 + `work/T-002-04/proof.md`
    kaizen#4; `runs.jsonl` A1 (safe only via sandbox).
  - **Advances:** **P3** (a gate that prevents a destructive write).
  - **Known-done by:** a colliding-fixture test proves the refusal; a run against the
    populated board writes only fresh ids or stops with a named reason — never silently
    overwrites.

### E-005 — thread-real-model-id

- **S-005-01 — stamp-the-real-model-id**
  - **Outcome:** `runs.jsonl` `model` carries the id read off the terminal `result`
    (`claude-opus-4-8[1m]`), not the `claude-cli-default` sentinel; sentinel only as
    fallback when the result carries no id.
  - **Value tier:** **Standard** (data fidelity for the consistency layer).
  - **Budget envelope:** tiny — minutes; likely a single ticket's worth.
  - **Readiness:** **ready.**
  - **Cites:** `epic/E-005.md`; `work/T-002-04/proof.md` kaizen#3; `runs.jsonl` (the
    sentinel, observed on A1–shelf-E-004); `steering-data-model.md` (the ledger must
    read truth).
  - **Advances:** **P3** ("you got what you paid for" needs the *real* model logged).
  - **Known-done by:** a run's logged `model` equals the id on the terminal result;
    fallback path covered.

### E-003 — vend-cli-shelf  ⟂ the fork (core-feature side)

Two stories, ordered — the menu must exist before a selection can resolve against it
(`E-003.md`: "resolves indices against the same list just shown").

- **S-003-01 — deterministic-ranked-menu**
  - **Outcome:** bare `vend` renders a numbered menu of *ready, high-leverage* actions
    with value tier + warranted budget + state, computed deterministically (no LLM)
    from `demand.md` + `lisa status`, persisted to `.vend/menu.json`.
  - **Value tier:** **High** (the first real counter).
  - **Budget envelope:** ~half a feature block (~1h).
  - **Readiness:** **unblocked** (E-001 done; `src/cli.ts` from T-002-03 exists to
    extend). *Composes best after E-004* so the menu's actions can dispense in place.
  - **Cites:** `epic/E-003.md`; `vision.md` P2 + `charter.md` P2 (two gestures);
    `card-model.md` (the counter / vending press); `demand.md` (the value ranking the
    menu renders).
  - **Advances:** **P2** (the run is two gestures, collapsed toward one).
  - **Known-done by:** `vend` prints the ranked menu deterministically and writes
    `.vend/menu.json`; a materially-stale menu warns "re-run vend".

- **S-003-02 — selection-minilanguage-and-dispatch**
  - **Outcome:** `vend <sel>` parses the selection mini-language (`1,2,4-6`,
    1-indexed, deduped, range-inclusive; invalid index = hard error) against the
    persisted menu and runs each picked action's playbook with its warranted budget
    (overridable `--budget`), in order, each appended to the run log; `--all` reveals
    hidden blocked/leaf rows.
  - **Value tier:** **High** (completes the press: pick + budget + run).
  - **Budget envelope:** ~half a feature block (~1h).
  - **Readiness:** **blocked on S-003-01** (resolves against the menu it persists).
  - **Cites:** `epic/E-003.md` (the mini-language spec); `T-001-04` run log; `T-001-03`
    budget control; `charter.md` P2/P7.
  - **Advances:** **P2**, **P7** (each pick runs under its warranted envelope).
  - **Known-done by:** `vend 1,2,4-6` runs the right actions in order under the right
    budgets and appends one run-log record each; an out-of-range index hard-errors.

### E-002 — CI structural backstop  ⟂ the fork (enabler side)

> **Prerequisite (gap F3):** no `epic/E-002.md` exists — E-002 is a `demand.md` signal
> only. Author the epic card first from `ci-strategy.md` (which already holds the full
> epic-worth of steering). That card-authoring is a precondition of this story, not
> part of it.

- **S-002-01 — first-gate-honest (`check:test` via Dagger)**
  - **Outcome:** a single structural gate, end to end: `bun run check:test` runs the
    suite standalone; `/ci/src/test.ts` (a `Test` sub-class) spins a Bun container and
    invokes it; `/ci/src/index.ts` routes `test()` and *nothing else yet*; engine
    pinned `v0.21.4`, Node runtime.
  - **Value tier:** **High** (enabler — independent structural backstop for the
    parallel fleet; the *weakest check type* by our lens, but the trustworthy one).
  - **Budget envelope:** ~1 feature block (~2h; one gate end-to-end).
  - **Readiness:** **unblocked** (E-001 scaffold + `check:*` surface exist) **after the
    E-002 card is authored** (F3).
  - **Cites:** `ci-strategy.md` (the Central Rule, `/ci` structure, pinned `v0.21.4`,
    18.4s cold-start); `ci-structural-gate.md` (the 6 repeatable steps, the first-gate
    slice); `demand.md` (the E-002 signal).
  - **Advances:** **P3** (the inspection backstop) — Dagger *invokes, never defines*.
  - **Known-done by:** the same `bun run check:test` passes standalone, as the play's
    andon gate, and as CI's independent run — all three agree; `index.ts` routes only
    `test()`. (Out of this slice, deliberately: lint, typecheck, consistency, keep-warm
    — see Future signals.)

### E-007 — casting-engine (sorcery)  ⟵ last; readiness-gated

> **Prerequisite:** no epic id assigned yet. Propose **E-007** (the free epic slot;
> kept distinct from the E-002 CI signal). The card must be authored before this story.

- **S-007-01 — spec-the-sorcery-engine (spike)**
  - **Outcome:** a *spike* that specs what the BAML single-use-play (sorcery) engine
    must support — authoring a one-shot play, paying its mana (budget), resolving it
    against its gates — grounded in E-006's **recorded friction** (this survey's F4:
    where forcing a sorcery through RDSPI breaks down). Output is a spec, not an engine.
  - **Value tier:** **High** *future* leverage, **Standard** *now* (readiness-gated; do
    not over-invest before the friction is in hand).
  - **Budget envelope:** ~1 feature block (~2h) — a Blue planning/spike cast.
  - **Readiness:** **blocked on E-006** (this ticket) — its input is F4, which `review.md`
    produces. Sequence last.
  - **Cites:** `card-model.md` (Sorcery vs Permanent; the `card={…}` target shape; "the
    casting engine is the build-the-BAML-layer-harder direction"); `epic/E-006.md`
    notes ("the friction that motivates the BAML sorcery engine"); this survey's F4.
  - **Advances:** **P1** (author-once for single-use plays) and the card-model's
    single-use/reusable axis; sets up later *graduation* of recurring sorceries to
    permanents (`playbooks/`).
  - **Known-done by:** a written spec of the casting flow + gate model + card type,
    explicitly citing which RDSPI frictions it removes.

---

## Bounds check (F1–F4)

**Contradictions found** — at the *operational* layer; the *principle* layer
(vision↔charter↔tps↔card-model) is coherent and pinned.

- **F1 — the story-id scheme contradicts itself (genuine).** E-001 consumed **both**
  `S-001` and `S-002` under a **flat sequential** scheme; E-006 used **epic-matched**
  numbering (`E-006`→`S-006`/`T-006-01`). Under epic-matched numbering, E-002's natural
  story id `S-002` is **already taken** by E-001's second story. This is the
  cross-board id-collision (the very thing **E-004** fixes for tickets) showing up *by
  hand, at planning time, at story granularity*. **Resolution adopted here:**
  epic-scoped ids (`S-<epic>-<n>`) for all planned stories — collision-free against the
  live flat ids, and a hand-prototype of E-004's namespace. (Note: this divergence
  from the flat convention is itself a deliberate deviation — see `progress.md`.)
- **F2 — `demand.md` is internally stale (genuine).** Its signal table marks E-001
  **done**, yet the same file's E-003 and CI rows still read "**blocked on E-001**."
  E-001 is committed (`4a1d632`; D-001 outcome `done`). Both are now **unblocked**.
  The board hasn't been swept since E-001 landed. *Reported, not fixed* (sweeping it is
  later pulled work, not this spike's scope).
- **F3 — E-002 is an epic without a card (gap).** Referenced as "E-002" in
  `ci-strategy.md`, `demand.md`, and `E-001.md`, but no `epic/E-002.md` exists.
  Authoring it is a named prerequisite of S-002-01 above.
- **F4 — RDSPI mismatch (process friction, → `review.md`).** Forcing this planning
  *sorcery* through RDSPI (built for code *permanents*) is the commissioned friction
  of E-006. Recorded in full in the Review artifact, where the ticket Notes require it.

## Future signals (not planned — un-elaborated, anti-rot)

One line each; pulled only when there's capacity (`demand.md` discipline):

- **Bound dispense exploration** — `--max-turns` / system-prompt constraint on the
  `claude -p` seam (A2 burned 119k tokens on a tiny fixture). Standard.
- **Value/budget surface in Vend** — the shelf showing each play's worth + warranted
  budget, run log feeding *actuals* back to recalibrate envelopes. Standard; needs the
  shelf (E-003) to land on.
- **Design-language session** — the TUI surface language; output a capped design
  charter. High; precedes any TUI epic.
- **Additional CI gates** — lint, typecheck, consistency, keep-warm tuning. Each
  generalizes out of S-002-01's one honest gate; *do not bundle them in*.
- **Graduate `DecomposeEpic`-bootstrap to a permanent** — if "Survey the Roadmap"
  recurs across projects, reprint the sorcery as a reusable playbook (`card-model.md`).

## Provenance

- **Cites:** `vision.md`, `charter.md`, `tps.md`, `card-model.md`, `stack.md`,
  `ci-strategy.md`, `go-and-see.md`, `playbook-decompose-epic.md`,
  `playbooks/{project-steering,steering-data-model,ci-structural-gate}.md`; the epic
  cards `E-001/003/004/005/006`; `demand.md`; `.vend/{runs,decisions}.jsonl`;
  `work/T-002-04/proof.md`.
- **Decision record:** appended to `.vend/decisions.jsonl` (`move: queue`, this
  survey's ranked pull + the escalated fork, `humanVerdict: pending`).
- **Scope honored:** stories only; no tickets materialized; no board mutation; F2/F3
  reported, not fixed.
