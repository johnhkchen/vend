# Design — T-062-03-04 harden-bootstrap-friction-fix-at-source

_Phase: Design. Options, tradeoffs, the decision and why — grounded in Research. What gets
built, what gets escalated, what gets rejected._

## The decision in one line

The deterministic bootstrap surface already drives clean (Research, verified by hand) and every
friction the epic names was fixed in its own predecessor card with a per-seam guard. So this
card's substance is: **(1) close the one structural gap — add a single end-to-end re-drive
guard that gates the AC's "full path runs clean, no manual intervention" clause; (2) write the
consolidated friction ledger recording each friction's disposition; (3) escalate the
out-of-scope boundaries to a follow-up epic as a recommendation, not a hand-authored ticket.**

## The core question

Is there source code to *change* in this card? Research says: the deterministic path is
friction-free (init 31-created, doctor 3-green, idempotent re-init, degrade correct, steer-inputs
carry intent). The genuine frictions (template-not-registered, missing SEED.md/charter) were
already fixed at source upstream. So "fix at source" here is **not** re-fixing — it is **proving
the composite path stays fixed** and **recording the dispositions**. The AC is satisfied
per-friction by the upstream fixes + their guards; what is missing is the *composite* guard and
the *ledger*.

## What the AC actually requires (re-read)

> Each friction logged during the drive is either fixed-at-source with a regression guard
> (test/probe) **or** filed as a follow-up-epic ticket, **and** a fresh re-drive of the full
> path runs clean with no manual intervention.

Two clauses:
- **Clause A (per-friction disposition):** met by the upstream fixes + guards (ledger records
  each). Overflow → escalate.
- **Clause B (full-path re-drive clean):** today only a by-hand witness. Needs a gate.

## Options for Clause B (the full-path re-drive guard)

### Option 1 — Spawn the real CLI for each stage, in sequence, on one dir
Drive `bun run src/cli.ts init` then `… doctor` then `… steer` via `Bun.spawnSync` on one temp
dir, asserting each stdout.
- **Pro:** exercises the wired CLI exactly as a cook does.
- **Con:** `vend steer` and `vend work` are **metered** — they hit the live executor (Research
  confirmed steer streamed real turns). A gate that spends tokens / needs a Claude login is not
  a gate. Spawning per stage is also slow and re-pays BAML addon load. **Rejected** for the
  metered stages; the smoke test already covers the spawned `doctor` path.

### Option 2 — One test, one temp dir, drive the deterministic seams **in sequence** via their real functions (CHOSEN)
A single `describe`/`test` that, on ONE fresh `mkdtemp` workspace, runs the path in order:
`runInit` → scaffold assertions → `probeKitchen`+`renderDoctorReport` → `buildProjectSnapshot`
(steer-inputs) → `readProjectMcpServers`+`resolveTools` (degrade) → re-`runInit` (idempotent).
- **Pro:** the seams run *as a composition on one workspace* — exactly what no existing test
  does. Each function is the **real shipped one** (`runInit`, `probeKitchen`, `buildProjectSnapshot`,
  `resolveTools`, `DECOMPOSE_TOOLS`), not a mock. Deterministic + offline + fast (no spawn, no
  spend). Green-by-construction (bun runs the test).
- **Con:** it stops at the steer *inputs* / degrade *resolution*, not the live ranking/clear —
  but that is the honest boundary (the metered half is T-062-04-01). The test documents this.
- **Why it wins:** it is the smallest thing that makes Clause B a *gate* instead of a by-hand
  note, reusing the exact patterns the per-seam tests already established (so it cannot drift
  from them) while adding the one dimension they omit: the **sequence on a shared workspace**.

### Option 3 — Do nothing in code; rely on the per-seam tests + the by-hand witness
- **Pro:** zero new code; the path does drive clean today.
- **Con:** fails the AC's Clause B as a *guard* — "runs clean with no manual intervention" stays
  a manual claim. The first regression that breaks the composition (not any single seam) ships
  silently. **Rejected** — a hardening card whose deliverable is "trust me, I ran it" is exactly
  the friction this epic exists to remove.

## Decision

**Option 2.** One end-to-end re-drive guard, `src/kitchen/cold-start-redrive.test.ts`, driving
the deterministic cold-start path in sequence on one workspace, reusing the real shipped seam
functions. Plus the friction ledger artifact. Plus a documented escalation recommendation.

## Why not change any source under `src/`?

Because Research found nothing broken on the deterministic surface — and inventing a "fix" where
there is no friction would violate honest-on-outcome (manufacturing churn to look busy). The
honest fix-at-source for *this* card is the **guard** (it is itself a regression probe, the AC's
named alternative to a code fix) plus the **ledger**. If the new guard had surfaced a real break
in the composition, that break would be fixed here; it did not (the guard passes first run).

## Escalation: overflow → follow-up epic (recommendation, not fabrication)

The three out-of-scope boundaries (live CI `astro build`, doctor deps-installed detection, live
EmDash REST round-trip) are genuine future coverage but need live infra beyond the
dress-rehearsal bootstrap surface — the ticket's "escalate overflow to a follow-up epic" path.

Tickets here are **materialized by Vend's `decompose-epic` play** (S-062-03 header), not
hand-written. Hand-authoring ticket files risks id/DAG collisions (`T-063/064/065` already exist
under E-061's stories). So the escalation is recorded in the friction ledger as a **proposed
follow-up epic** (provisional `E-063 kitchen-clean-room-drive` — the untouched fresh-repo drive
the epic's own "Context & constraints" already names as the separate downstream epic), to be
materialized via `propose-epic`/`decompose-epic` when the clean-room phase opens. This honors the
AC's "filed as a follow-up-epic" branch without fabricating DAG state Lisa owns.

This is consistent with the epic boundary text itself: *"the untouched fresh-repo clean-room
drive that is the actual forward-E1 proof is a SEPARATE downstream epic and must not be folded in
here … if friction-fixes balloon beyond the bootstrap surface, that overflow is its own follow-up
epic."*

## What this design explicitly does NOT do

- Does **not** run or capture the live metered drive (steer ranking / work clear) — T-062-04-01.
- Does **not** add a live `astro build` or EmDash server to the gate — escalated.
- Does **not** hand-author follow-up ticket files — recommends materialization via the play.
- Does **not** touch engine / CLI / BAML / overlay source — no friction there to fix.

## Risks & mitigations

- **Risk:** the new guard duplicates the per-seam tests. **Mitigation:** it asserts the *one*
  thing they don't — the sequence on a shared workspace — and shares their exact helper idioms,
  so it reads as the composition over them, not a copy.
- **Risk:** "no source change" reads as under-delivery. **Mitigation:** the ledger + guard ARE
  the deliverable the AC names (regression guard); the honest finding is that upstream already
  fixed the frictions, which is the *good* outcome for a hardening card.
- **Risk:** escalation-by-recommendation is seen as not "filed". **Mitigation:** the ledger
  records the proposed epic, scope, and trigger explicitly; review.md flags it for the human.
