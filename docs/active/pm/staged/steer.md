# Steer — staged board + forks

A ranked demand board read off the whole project, highest-leverage first. Un-promoted: review and pull a row.

> **Board maintenance 2026-07-13 (post-v0.4.0):** row 1 (quota denomination) was **PULLED → E-082
> `learned-lane-quota`, swept same day** — which **UNBLOCKS row 2** (multi-lane parallel casting),
> now the top available pull. Row 5 (work-core GC) was **done by hand in the same maintenance
> pass** (commit 966f06b — pure dead-code deletion, gate-verified). Rows 3–4 remain as staged.
> The forks below are still open rulings.

| Signal | Value | Budget (envelope) | Status |
|---|---|---|---|
| **Add quota-per-reset-window as a budget denomination: wallet/ledger learn per-lane capacity, and lane heat upgrades from relative-burn to quota-fraction (inferred from ledger history + 429s)** — Makes P7 a hard contract in the primary persona's true scarce unit — quota per reset window, not dollars per token — and unblocks the practice ladder's last rung (scheduling across lanes needs known per-lane capacity) | **Keystone** | ~2 blocks (≈4h) | ready (advances [P7, core-feature: allocation in the unit the two-seat operator actually rations] · grounded in vend-two-seat-operator-persona (ratified 2026-07-09): 'lane-denominated budget awareness — quota/reset-window as a budget denomination; infer lane heat from ledger + 429s'; E-071 closeout confirmed the quota convention absent in-repo and shipped heat as relative-burn (src/play/lane-heat.ts)) |
| **Multi-lane parallel casting: cast independent board signals concurrently across executor seats, each debiting its own lane, sharing one board race-free** — The final rung of the ratified practice ladder — the allocation desk schedules casts across independently-metered lanes at once, which is the volume the clearing thesis exists to make trustworthy | **High** | ~3 blocks (≈6h) | blocked: lane-quota denomination — scheduling across lanes needs budget to know per-lane capacity, not just relative burn (advances [core-feature: clearing/allocation at volume across lanes, P7] · grounded in vend-two-seat-operator-persona practice ladder ('routing → overflow → cross-review → parallelize LAST'); every prior rung is swept on the epic board — E-069/E-070/E-071 (routing/degrade/overflow) and E-073/E-076 (cross-review) all status: done) |
| **Ship the release-day gold-master bake-off as a named shelf playbook: re-drive the EXPECTED-OUTCOME gold master against a new model or release and diff within tolerance** — Turns the captured consistency bar into an author-once playbook the operator grabs every release day, and is the cheapest live exercise of executor-agnosticism (same playbook, different model) | **Standard** | ~1 block (≈2h) | ready (advances [P1, P3, P6] · grounded in vend-two-seat-operator-persona ratified near-term scope ('release-day gold-master bake-off as a named playbook'); the EXPECTED-OUTCOME gold-master pattern already captured a live drive as a re-runnable consistency bar) |
| **Make the go-and-see snapshot honest about what it didn't gather: steer/survey/propose/expand snapshots should omit or mark the src section instead of asserting 'Source modules (src/**): (none)'** — Every steer/survey cast currently grounds itself on a false claim — the clearing house's own primary input violates honest-empty on any code-bearing repo, indistinguishable from a genuinely empty project | **Standard** | small (~1h) | ready (advances [core-feature: grounded clearing (charter criterion 2, go-and-see)] · grounded in src/play/steer.ts:120, survey.ts:130, propose-epic.ts:160, expand-fragment.ts:146 all pass srcFiles: [] by design, while buildProjectSnapshot (src/play/project-context.ts:95) renders that as '- (none)'; this very steer's snapshot asserted '(none)' against a ~25-module src/ tree) |
| **GC the retired macro-wallet remnants in src/play/work-core.ts — remove the dead receipt/budget-plan renderers, keeping parseBoardSignals as the one board→signal source** — Closes the flagged follow-up from the `vend work` retirement so the clearing spine carries no dead surface from a retired gesture | **Leaf** | small (~1h) | ready (advances [core-feature: one legible source of truth on the board→signal path] · grounded in vend-work-retired memory flags work-core's now-dead renderers as 'follow-up GC (not done)'; verified today only parseBoardSignals is still imported (src/play/graph-real-play-core.ts:22) and the engine's budget/wallet.ts is NOT orphaned (engine/graph-core.ts, spend.ts import it) — scope is work-core only) |

## Pull these

A human pulls any one staged signal onto the board with one gesture:

```
vend chain "Add quota-per-reset-window as a budget denomination: wallet/ledger learn per-lane capacity, and lane heat upgrades from relative-burn to quota-fraction (inferred from ledger history + 429s) — Makes P7 a hard contract in the primary persona's true scarce unit — quota per reset window, not dollars per token — and unblocks the practice ladder's last rung (scheduling across lanes needs known per-lane capacity)"   # recommended next pull (highest leverage)
vend chain "Multi-lane parallel casting: cast independent board signals concurrently across executor seats, each debiting its own lane, sharing one board race-free — The final rung of the ratified practice ladder — the allocation desk schedules casts across independently-metered lanes at once, which is the volume the clearing thesis exists to make trustworthy"
vend chain "Ship the release-day gold-master bake-off as a named shelf playbook: re-drive the EXPECTED-OUTCOME gold master against a new model or release and diff within tolerance — Turns the captured consistency bar into an author-once playbook the operator grabs every release day, and is the cheapest live exercise of executor-agnosticism (same playbook, different model)"
vend chain "Make the go-and-see snapshot honest about what it didn't gather: steer/survey/propose/expand snapshots should omit or mark the src section instead of asserting 'Source modules (src/**): (none)' — Every steer/survey cast currently grounds itself on a false claim — the clearing house's own primary input violates honest-empty on any code-bearing repo, indistinguishable from a genuinely empty project"
vend chain "GC the retired macro-wallet remnants in src/play/work-core.ts — remove the dead receipt/budget-plan renderers, keeping parseBoardSignals as the one board→signal source — Closes the flagged follow-up from the `vend work` retirement so the clearing spine carries no dead surface from a retired gesture"
```

## Forks

The genuine decisions only the human can make — each recommendation-first. Assent or override:

### Fork — Forward-E1 lost its only accrual path when `vend work` retired — rehome the `--intervened|--no-intervened` self-report on `vend chain`, retire the autonomy keystone outright, or leave the 0/10 ledger deliberately dormant?
- **Why it matters:** P4 is a charter invariant and this decides whether its claim stays measurable: a gauge that CANNOT accrue reads as failed autonomy when it's actually unplumbed, and the record explicitly marks this rehoming as a decision not yet made — defaulting either way launders a strategy call into plumbing. `vend run` carries the flags today (src/cli.ts:40); `vend chain` does not.
- **Options:**
  1. Rehome: `vend chain` accepts the self-report flags and chain casts accrue to .vend/forward-e1.jsonl as a secondary gauge
  2. Retire: drop the ≥10 forward-E1 bar and the portable-ledger machinery; the repositioned consistency NSM (gated-valid-stays-committed clears) is the whole metrics stack
  3. Dormant: change nothing; the ledger waits at 0/10 until a deliberate future autonomy push
- **Vend recommends:** Rehome — a flag pass-through on chain is about an hour, keeps the P4 gauge honest at near-zero cost, and commits to nothing: the repositioned NSM stays primary while real walk-away evidence, if it ever appears, lands where the loop actually runs.

### Fork — Is the terminal TUI still vend's v1 surface, or has the CLI+SVG desk become v1 — and do the canonical docs get amended to say so?
- **Why it matters:** This is the largest unfunded promise in the canonical docs — stack.md:16 declares 'v1 surface: TUI' and after 77 swept epics there is zero TUI code in src/. Building it bets the next quarter's biggest block on the visual-surface claim the riskiest-hypothesis record grades as hypothesis-only; leaving the drift makes the canonical docs misstate the product, which the charter's no-drift rule forbids.
- **Options:**
  1. Build the TUI shelf now on the settled IA-1..17 spine, funding the stack.md promise
  2. Ratify CLI+SVG as the v1 surface and amend stack.md/vision so the docs stop promising an unfunded surface; TUI becomes a later, validated bet
  3. Defer the call until a recruited non-dev driver tests the visual-surface hypothesis (the Set-B data gap) — no doc change, no build
- **Vend recommends:** Ratify CLI+SVG as v1 and amend the docs — the honey-kitchen field drive ran 14 epics deep on the CLI desk without missing a TUI, and the charter refuses building on an unvalidated hypothesis (overproduction); the TUI re-enters via a Set-B driver test, not by default.

_Staged by Vend's `steer` play — not promoted; pull a signal / assent to a fork to clear._
