# Concrete board (T-039-01 re-point) — derived from staged/steer.md @ 2026-06-20 17:07:38

The fresh steer board's #1 was self-referential ("Re-run the bounded metered sweep again…")
— the E-037 degenerate recursive case. Per T-039-01 Decision 2 / Step 3, the sweep is pointed
at the top CONCRETE product-demand signal instead. Signals below are verbatim from steer.md,
self-referential #1 dropped, real demand promoted (vend init first).

## Pull these

vend chain "Author `vend init` — one idempotent command that scaffolds a vend+lisa project (board, pm/ desk, epic/stories/tickets/work, knowledge stubs, .vend/ state) over a bare lisa project. — PRD-recommended first pull of Frontier 7; the foundation everything else in distribution stands on. Compounds the keystone: more driveable projects → more cleared runs → forward-E1 accrual."
vend chain "Author `vend doctor` — an envinfo-backed preflight that verifies lisa + claude on PATH, BAML bundled/loadable, and executor config, refusing cleanly with fix-it hints (gated, not a crash). — Smallest, most-ready piece of Frontier 7 and immediately useful for debugging the vend+lisa combo even during the current live sweeps. A clean gated refusal advances the correctness contract."
vend chain "Build the multi-node typed DAG — plays composing into a real graph (fan-out, join, conditional) beyond the linear propose→decompose chain. — The architectural centerpiece of the v1 vision ('typed, graph-structured agent orchestration') still unbuilt; also the substrate Frontier 2's open-model runner likely wants underneath it."
vend chain "Ship the hackathon `examples/` template wired to `vend init --template <name>` (seed → driven board, gold-mastered expected outcome). — The v1.1 value proof — turns the scaffold into a visible win AND is the test of assumption A3 (steer/survey useful off a thin domain seed, not just this repo). Generates the cleared runs that feed the keystone (KR2/KR4)."
vend chain "Thread the structured stop-reason onto the run record so honest-empty and budget-exhausted are countable (not stdout-only). — The cleanest ready hygiene lever: unblocks clean consistency/trust measurement that the probe + `vend audit` can't currently split — and trust measurement is exactly what the keystone cadence is accruing."
