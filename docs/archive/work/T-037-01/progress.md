# T-037-01 — Progress

## Status: complete

Analysis ticket — no source change. The deliverable `preflight.md` is written; the deterministic
gate is green. Below: each plan step's outcome and any deviations.

## Steps

- [x] **Step 1 — Price the chain (Claim 1).** Ran `loadRunLog` → `recalibrate` ×2 → `sumBudgets`
  over the live ledger via a throwaway pure-module harness. Result: propose `{72785, 227390}`,
  decompose `{160745, 227464}`, both `measured` (5 / 6 successes, p90). **Chain price
  `{233530 ms, 454854 tok}` = 454.9k / 233.5s.** Captured in preflight.md §Claim 1.

- [x] **Step 2 — Affordability (Claim 2).** Simulated `canAfford` over `allocate({3600000,1000000})`
  at the price. **2 chains** (token-bound; time affords 15). ≥1 guaranteed, ~2 realized ⇒ spend-down.
  Captured §Claim 2.

- [x] **Step 3 — Forward-E1 thread (Claim 3).** Traced cli→work→chain→record→reviveRecord→audit
  against source — every edge present; `false` survives read-back; no attestation ⇒ forward. Ran
  `auditWalkAway` over the live ledger: forward **1/2 (50%)**, attested 13/0. Captured §Claim 3.
  No live cast.

- [x] **Step 4 — Freshness gate (Claim 4).** Confirmed `isBoardStale` is `<` (fresh-on-tie); a
  run-time board has `boardMtime ≥ liveMtime` ⇒ fresh. Cross-checked `work-core.test.ts:134-145`.
  Captured §Claim 4.

- [x] **Step 5 — auth==exec + go/no-go.** Confirmed `castWork` threads the priced envelopes into the
  cast per step (work.ts:183-185 vs 195-196). E-024 no-op cannot recur. **GO** written with the
  ≥2-signal precondition and honest caveats.

- [x] **Step 6 — Deterministic gate.** `bun run check:typecheck` clean; `bun test` **998 pass /
  0 fail** (2439 expects, 66 files). No regression (no source touched).

- [x] **Step 7 — Clean up.** Throwaway harness removed; `git status` shows only the work-dir
  artifacts (+ pre-existing untracked files not mine, + Lisa's auto-advance of the ticket frontmatter).

## Deviations from plan

- **None material.** The verification harness was run during the Research phase (to ground the
  Design's numbers) rather than waiting for Implement — same pure functions, same result; recorded
  here for traceability.
- Did **not** add a new automated test (an analysis ticket; pinning today's ledger numbers would be
  brittle as the ledger grows). Justified in plan.md §Testing strategy and flagged in review.md.

## Artifacts produced

`research.md`, `design.md`, `structure.md`, `plan.md`, **`preflight.md` (the deliverable)**,
`progress.md`, `review.md`. No `src/` change; no ticket frontmatter edited (Lisa owns transitions).

## Handoff to T-037-02

GO. Stage a board with ≥2 ranked signals, fund `--budget 3600000,1000000`, run
`vend work --no-intervened`. Expect ~2 chains cleared (≥1 floor), spend-down to a clean P7 stop,
4 forward records appended (2 per chain). auth==exec holds — no price-mismatch no-op.
