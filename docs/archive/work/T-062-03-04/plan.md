# Plan — T-062-03-04 harden-bootstrap-friction-fix-at-source

_Phase: Plan. Ordered, independently-verifiable steps + the testing strategy. Each step small
enough to commit atomically (commits left to Lisa per §Concurrency)._

## Testing strategy

- **The deliverable IS a test** — `cold-start-redrive.test.ts`, the end-to-end re-drive guard.
  It is the AC's named "regression guard (test/probe)" for Clause B (full path runs clean).
- **No new unit surface to test** — no `src/` source changes (Design), so nothing else needs a
  unit. The guard reuses the real shipped seam functions; it is an integration-shaped test that
  stays fully offline + deterministic.
- **Verification bar per step:** the guard passes on the current tree first run (proving the
  composition is already clean); `bun run check` stays green with `+N` tests, `tsc --noEmit`
  clean, zero regression in init/doctor/kitchen/cast suites.
- **Honest boundary:** the guard never spends a token (stops at steer inputs + degrade
  resolution); the metered half is `⟪…⟫` (T-062-04-01).

## Steps

### Step 1 — Write the end-to-end re-drive guard
Create `src/kitchen/cold-start-redrive.test.ts` per Structure: one `describe`, one primary
`test` driving init → scaffold → doctor → steer-inputs → degrade → idempotent re-init in
sequence on ONE temp workspace, using the real shipped functions and the existing kitchen-test
idioms (`exists`, `tmps`+`afterEach`).
- **Verify:** `bun test src/kitchen/cold-start-redrive.test.ts` → green first run.
- **If red:** a real composition break exists → fix at source (the actual "fix-at-source" this
  card would then carry), document the deviation in progress.md, re-run.

### Step 2 — Confirm no regression across the gate
Run the full gate.
- **Verify:** `bun run check` → `tsc --noEmit` clean; suite green; count rises by the new tests;
  no failures in `src/init`, `src/doctor`, `src/kitchen`, `src/engine` suites.

### Step 3 — Write the friction ledger
Create `docs/active/work/T-062-03-04/friction-ledger.md` per Structure: the per-friction
disposition table (6 rows), the boundaries→escalation table (3 rows → proposed
`E-063 kitchen-clean-room-drive`), the re-drive evidence (by-hand transcript + the gated guard),
honest-on-outcome footer.
- **Verify:** every friction from Research §"friction log" has a row with a fix-at-source
  location AND a named guard; every boundary has an escalation target.

### Step 4 — Re-drive witness (already captured in Research)
The by-hand deterministic drive is recorded in Research (init 31-created, doctor 3-green,
idempotent, steer dispatches metered). No re-run of the metered path. The gated guard (Step 1)
is the durable replacement for the by-hand witness.
- **Verify:** ledger §"re-drive evidence" cites both the by-hand transcript and the new guard.

### Step 5 — progress.md + review.md
Write the execution log + the handoff. review.md summarizes: files changed (one test + ledger,
zero `src/` source), test coverage (the composition dimension closed; what stays deferred),
open concerns (the escalation recommendation for the human), and the honest finding (surface
already clean).
- **Verify:** review.md states the AC clause-by-clause disposition and flags the escalation.

## Ordering rationale

Guard before ledger: the ledger's "re-drive evidence" row must report the guard's *actual*
result, not a predicted one. Gate before ledger: the ledger's footer claims "no regression" —
that must be a measured fact. Artifacts last: progress/review summarize what actually happened.

## Rollback / risk

- The only `src/` addition is a test — it cannot break production code paths; worst case it is
  removed with zero blast radius.
- If Step 1 surfaces a break, scope stays inside the bootstrap surface (Design); anything beyond
  it is escalated to the follow-up epic, not folded in (epic boundary, PE-7).

## Definition of done (this card)

- `cold-start-redrive.test.ts` green, gating the full-path re-drive (Clause B).
- `friction-ledger.md` records every friction's disposition (Clause A) + escalations.
- `bun run check` green, `+N` tests, no regression.
- RDSPI trail complete (research → review).
- Metered half honestly deferred to T-062-04-01; no live number invented.
- Commits left to Lisa.
