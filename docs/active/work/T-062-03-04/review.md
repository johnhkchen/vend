# Review — T-062-03-04 harden-bootstrap-friction-fix-at-source

_Phase: Review. The handoff — what changed, how it's covered, what a human reviewer should
decide. Read this instead of the diff._

**Ticket:** `harden-bootstrap-friction-fix-at-source` (S-062-03, E-062 kitchen-emdash-dress-
rehearsal) — the last card before the gold-master freeze (T-062-04-01 depends on it).

**Verdict:** ✅ done. The honest finding is the *good* outcome for a hardening card: the
deterministic bootstrap surface **already drives clean end-to-end** — every friction the epic
names was fixed at source in its own predecessor card, each with a per-seam regression guard
(verified, see ledger). This card closes the one structural gap those per-seam tests leave open
(nothing drove the **whole path as a composition**), records the consolidated friction ledger,
and escalates the out-of-scope boundaries to a follow-up epic.

## What changed

| File | Kind | Summary |
|---|---|---|
| `src/kitchen/cold-start-redrive.test.ts` | **new** | The end-to-end re-drive guard: one test driving init → scaffold → doctor → steer-inputs → degrade → idempotent re-init **in sequence on one workspace**, using the real shipped seam functions. The AC's "full path runs clean, no manual intervention" turned from a by-hand witness into a gate. |
| `docs/active/work/T-062-03-04/friction-ledger.md` | **new** (artifact) | Every friction + disposition (fix-at-source location + guard), the boundaries→escalation table, re-drive evidence, honest-on-outcome footer. |
| `docs/active/work/T-062-03-04/{research,design,structure,plan,progress,review}.md` | **new** | The RDSPI trail. |
| `src/` source (engine / CLI / init / doctor / overlay / BAML) | **unchanged** | No deterministic seam needed a new fix — the guard passed on the current tree first run. |

## How each AC clause is met

> Each friction logged during the drive is either fixed-at-source with a regression guard
> (test/probe) or filed as a follow-up-epic ticket, and a fresh re-drive of the full path runs
> clean with no manual intervention.

| Clause | Treatment | Evidence |
|---|---|---|
| A — each friction fixed-at-source with a guard, **or** filed as overflow | **met** | `friction-ledger.md`: 6 epic-named frictions all fixed-at-source upstream, each with a named guard (rows 1–6); this card adds the composition guard (row 7). The 3 out-of-scope boundaries (live CI build, doctor deps-installed, live EmDash REST) escalated to the proposed follow-up epic. |
| B — a fresh re-drive of the full path runs clean, no manual intervention | **met (deterministic) / deferred (metered)** | `cold-start-redrive.test.ts` gates the deterministic re-drive (1 pass / 25 expect, first run). The metered half (live steer ranking + work clear in budget) is `⟪…⟫`, T-062-04-01. |

## Why no `src/` source change (and why that is correct, not under-delivery)

A hardening card's job is to leave the path provably clean — not to manufacture churn. Research
verified the deterministic path drives clean by hand (init 31-created, doctor 3-green, idempotent,
degrade correct, steer-inputs carry intent); the genuine frictions (template-not-registered,
missing SEED.md/charter) were already fixed upstream. The AC names a **regression guard
(test/probe)** as a first-class alternative to a code fix — the new guard *is* that fix-at-source
for the one open dimension (the composition). Inventing a code change where there is no friction
would violate honest-on-outcome. The guard passing first run is the proof the surface was already
hardened.

## Test coverage

- **The new dimension:** `cold-start-redrive.test.ts` is the only test that drives all bootstrap
  seams **as a sequence on one shared workspace** — it would fail loudly if a scaffold change init
  lays were no longer accepted by doctor/steer, or if an ordering coupling crept in. The per-seam
  tests (`init-kitchen`, `kitchen-doctor.smoke`, `seed-steer-seam`, `kitchen-degrade`) remain the
  deep coverage of each seam; this composes over them without duplicating their depth.
- **Deterministic + offline + fast:** no spawn, no executor, no token spend, no Claude login;
  green by construction (bun runs the test ⇒ on PATH; config + seed scaffolded; registry empty).
- `bun run check` → **1488 pass / 1 skip / 0 fail** (+1, no regression); `tsc --noEmit` clean.

### Gaps / NOT covered (by design)
- **The live metered drive** — the non-deterministic `vend steer` ranking and the `vend work`
  clear landing inside the cold-start budget in `runs.jsonl` — is clause B's metered half, deferred
  to the human-authorized cast (T-062-04-01), recorded as `⟪…⟫`. The guard stops at steer *inputs*
  and degrade *resolution*; it spends nothing.
- **Live `astro build` in CI, doctor deps-installed detection, live EmDash REST round-trip** —
  escalated to the proposed follow-up epic (see below), not folded in.

## Open concerns / handoff

1. **Escalation is a recommendation, not a fabricated ticket — needs a human/Lisa decision.**
   The 3 out-of-scope boundaries are escalated to a **proposed `E-063 kitchen-clean-room-drive`**
   in the friction ledger, *not* a hand-authored ticket file. Rationale: tickets here are
   materialized by Vend's `decompose-epic` play (S-062-03 header), and `T-063/064/065` already
   exist under E-061's stories — hand-writing files risks id/DAG collisions. **Action:** when the
   clean-room phase opens, materialize the follow-up epic via `propose-epic`/`decompose-epic`
   using the ledger's boundaries table as the scope. This honors the AC's "filed as a follow-up-
   epic" branch without Vend writing DAG state Lisa owns. (Consistent with the epic's own boundary
   text naming the clean-room drive as a separate downstream epic.)
2. **None blocking.** The contract is gated, the gate is green, the record is honest (fixed +
   escalated + deferred).
3. **Watch-for-regression:** if a future change breaks the composition (a scaffold byte doctor
   or steer no longer accepts, a `.mcp.json` slipping into the overlay, a re-required MCP), or
   breaks idempotency, `cold-start-redrive.test.ts` fails loudly — the intended tripwire.
4. **Commits left to Lisa** (deliberate) — the working tree carries uncommitted sibling-thread
   work (the whole `examples/templates/kitchen-seed/` tree + `src/init/*` mods + the other
   T-062-03-0x kitchen files). `bun run check` is green over the combined tree.

## Reviewer's quick-look

Read `src/kitchen/cold-start-redrive.test.ts` (the six numbered stages, top to bottom — it reads
as the cook's drive). Then `friction-ledger.md`'s disposition table (every friction → fix → guard)
and its boundaries→escalation table. The guard passing first run, with no `src/` source change, is
the evidence the bootstrap surface was already hardened by the predecessor cards — this card makes
that fact a gate and records it.
