# Vend — Cleared demand (compacted ledger)

Signals pulled, cleared, and verified — moved off the live board (`docs/active/demand.md`)
to keep it lean (overproduced plans are inventory; cleared ones are history). One line per
epic: **what it delivered**, grouped by the goal it served. Full epic cards live in
`docs/active/epic/`; full proofs in `docs/active/work/<ticket>/`.

The board's job is *demand*; this file's job is *the record of demand met*. When a live
signal clears, crystallize it to one line here and delete its verbose board entry.

---

## The pipeline spine — author a play → cast it → chain plays (the core capability)

- **E-001 — dispense slice** — the one metered lever: `DecomposeEpic` via `claude -p`, gated · budgeted · streamed · countably logged. Unblocked everything. (`4a1d632`, 4/4 live paths.)
- **E-007 — casting engine** — one play-agnostic `castPlay`; two plays cast through the single metered seam (mana + gates + log). The v1 leap that made written specs runnable.
- **E-009 — register ProposeEpic** — the play above decompose: a demand signal → an epic card. `signal → epic` made real.
- **E-011 — chain (signal → tickets)** — `vend chain <signal>` casts ProposeEpic → DecomposeEpic as one gesture; proven on both the success and the andon-halt path. "Vend the whole roadmap" is real.

## The counter & shelf — the two-gesture surface (P2)

- **E-003 — context-aware shelf** — bare `vend` renders a ranked menu driven by playbooks + live project state, persisted to `.vend/menu.json`. The early CLI of the two-gesture counter.
- **E-030 — value/budget shelf** — `vend shelf`: each play shown with its worth + its *measured* recalibrated envelope (E-013) and confidence, not a static guess.
- **E-031 — board+shelf Home fusion** — bare `vend` renders the DL-6 Home: board leads, shelf recedes, provenance-split ledger at the foot. Press preserved bit-for-bit.

## The gate frame — gates are the contract (P3)

- **E-004 — id-collision guard** — `DecomposeEpic` refuses to materialize on a cross-board id clash (no clobbering live work).
- **E-008 — done-means-committed** — `check:committed` fails on uncommitted source, fired by the `on-stop` hook. Fixed the recurring D-005 andon.
- **E-010 — HEAD-builds gate** — `check:head` verifies the committed HEAD itself builds (isolated worktree), wired to `on-clear`. "Done" = committed *and* builds.
- **E-012 — commit-gate scope-gap** — widened `check:committed` to `.lisa/hooks/` (the gate now polices the hooks that police commits). First epic both minted *and* decomposed by `vend chain`.
- **E-032 — per-play tooling** — a play declares its MCPs/tools (`tools?` on `Play`); binding via a committed portable `.mcp.json`; cast wires only-declared servers (least-privilege); missing required MCP → amber andon.
- **E-033 — per-commit green gate** — `.githooks/pre-commit` runs `check:test`, blocks a red commit naming the failure (fail-closed on red, fail-open on can't-run). Per-commit layer of the frame.
- **E-034 — red-commit audit** — `check:history`: a bounded linear sweep rebuilding+testing each commit in a range to flag any that wasn't green. The post-hoc backstop to E-033; on its first run it found + corrected a real red commit (`a14d96a`).

## The budget contract — budget is a hard contract (P7)

- **E-013 — measured envelopes** — `vend envelope <play>` reads run-log actuals, bounds at the value-tier percentile, de-biases a raw estimate, with honest cold-start/confidence. The budget contract measured, not guessed.
- **E-015 — `--max-turns` bound** — a safety bound at the seam (default 15, override wins), `turnsUsed` logged. (Found: decompose's tail is genuine cost, not turn-sprawl → recalibrate the envelope, not the cap.)
- **E-024 — macro-wallet** — the depleting feature-block wallet (P7) + the autonomous spend loop (P4) + the `vend work --budget` counter gesture. Wired + green; *live multi-cast spend remains a live signal*.
- **E-025 — wallet-priced casts** — threads the recalibrated per-step prediction into the chain so authorization == execution. Verified: the sweep that cleared 0 under the bug now clears 1.

## Trust & consistency — measure before autonomy (P3/P4)

- **E-014 — trust evidence gate** — instrumented walk-away (A2) + gate-variance (A5) from run-log data; returned an honest HOLD rather than fabricate a verdict. (Later un-gated: go.)
- **E-019 — articulation consistency probe** — a 9-cast live sweep over expand/survey/steer; surfaced honest-empty over-fire + unbounded dispersion → three follow-on signals.
- **E-020 — honest-empty recalibration** — prompt-only fix turning abstention into a rare source-gated exception; over-fire eliminated (expand 33→0%, survey 67→0%).
- **E-022 — consistency contract** — captured IA-17 (consistency = gated validity, not lexical identity); a semantic-equivalence judge resolved the converge-vs-by-design fork with data.
- **E-023 — survey-convergence** — measure-then-decide said *accept, not build*: survey's semantic head is stable 1.00 (only the tail re-orders). No lever built; IA-17 amended.
- **E-026 — forward-E1 instrument** — `vend work --intervened/--no-intervened` self-measures walk-away. *Forward accrual remains a live signal* (≥10-genuine bar not yet met).
- **E-028 — audit provenance split** — `vend audit` splits walk-away into forward-live vs attested back-fill, so the over-claim (15 carriers read as forward) is structurally impossible.

## The articulation trilogy — automate STEER (the demand-extraction lift)

- **E-016 — expand-fragment** — `vend expand "<fragment>"`: a rough fragment → a grounded, staged, priced signal (read-never-invent). Vend articulates *for* you.
- **E-017 — survey play** — `vend survey`: read a rough project → a ranked staged demand board. `expand` at project scale; the cold-start bootstrap.
- **E-018 — steer play** — `vend steer`: read a project → a ranked board *plus* the genuine human forks. The steer capstone; STEER automated end-to-end.

## Executor-agnostic underneath (P6)

- **E-035 — second executor** — extracted the `Executor` interface + `executorFor` selector; refactored Claude behind it (byte-identical) + added a non-Claude `OpenAICompatExecutor` (`/v1/chat/completions`). Vend is an orchestrator, not a Claude wrapper. (Single-completion adapter — *not* agentic open-model parity; that's a live signal.)
- **E-036 — open-model BAML support** — the authoring-layer half: `OpenModelStub` (provider `openai-generic`, render-only) so BAML's `b.request.*` targets open models; proven the *request shape* differs from anthropic (`/chat/completions` vs `/v1/messages`, no `max_tokens`, flat-string content) while `b.parse.*` stays provider-agnostic; render-client follows `VEND_EXECUTOR` (one switch drives dispatch + render). Boundary recorded in `stack.md`: config-level at both layers, the **live agentic runtime** deferred. 998 tests. (The live runtime is a live signal — Frontier 2.)

## Presentation (P5)

- **E-021 — presentation surface** — `src/present/`: graph loader → spec → vocab-translate → projection → paper/Mermaid renderer, one-way-authority guarded. Rendered the 61-ticket board into a jargon-free designer projection. (Linear renderer + annotation round-trip are downstream live signals.)

## Infrastructure & knowledge

- **E-002 — CI structural backstop** — `/ci` Dagger gate: `dagger call test run` runs `check:test` in-container, drift-free.
- **E-005 — thread the real model id** — `runs.jsonl` logs the true `claude-opus-4-8[1m]`, not `claude-cli-default`. Data fidelity.
- **E-029 — design language** — captured `docs/knowledge/design-language.md` (DL-1…DL-9): the clean-typographic visual spine a TUI implements against.
- **Information architecture** — captured `docs/knowledge/information-architecture.md` (IA-1…IA-17): the recommendation-first home, the cold-start arc, the Counter, the andon-as-refusal stance, the recalibration loop. (Remaining design threads are live signals.)
- **Measurement sprint** (2026-06-19) — collected both trust numbers (E1 100%/13 back-fill, E2 21% variance cut); un-gated the macro-wallet to **go** (provisional, forward-leaning).

---

*Kaizen one-liners that cleared (from E-001's first live runs): cross-board id guard (→E-004), `--max-turns` (→E-015), real model id (→E-005), wallet-priced casts (→E-025), per-commit green gate (→E-033/E-034). All folded into the epics above.*
