# Friction Ledger — T-062-03-04 harden-bootstrap-friction-fix-at-source

The consolidated record the AC requires: every bootstrap friction surfaced across the E-062
dress rehearsal, its disposition, the fix-at-source location, and the regression guard — plus
the out-of-scope boundaries escalated to a follow-up epic.

## Scope & the honest finding

The bootstrap surface spans **install → init → scaffold → doctor → seed→steer → cold-start
budget → mcp-absence**. It splits into a **deterministic half** (init, scaffold, doctor,
steer-inputs, degrade, idempotency — gate-coverable offline) and a **metered half** (the live
`vend steer` ranking + the live `vend work` clear landing in budget — human-authorized, P7,
T-062-04-01).

**Finding: the deterministic bootstrap surface already drives clean end-to-end.** Every friction
the epic names was fixed at source in its own predecessor card, each with a per-seam regression
guard. So this card's work is (1) recording the dispositions below, (2) closing the one
structural gap (no test drove the *whole path as a composition*) with a new gated re-drive guard,
and (3) escalating the genuine out-of-scope boundaries to the follow-up epic. No deterministic
seam needed a new source fix — the re-drive guard passed on the current tree first run.

## Per-friction disposition (AC clause A)

| # | Friction (stage) | Surfaced in | Disposition | Fix-at-source | Regression guard |
|---|---|---|---|---|---|
| 1 | `kitchen` template not registered, so `vend init --template kitchen` would not lay the seed (**init**) | T-062-01-01 review §1 | **fixed-at-source** | `src/init/init-core.ts` — `TEMPLATE_REGISTRY.kitchen = KITCHEN_OVERLAY`, `STANDALONE_TEMPLATES ∋ kitchen` | `src/kitchen/init-kitchen.test.ts` + registry-iterating pure invariants |
| 2 | seed must embed in the compiled binary (no runtime `examples/` read) (**scaffold**) | T-062-02-01 review | **fixed-at-source** | `src/kitchen/kitchen-overlay.ts` — text imports (`with { type: "text" }`); `seed-text-modules.d.ts` shim | `init-kitchen.test.ts` byte-equal scaffold assertions + manual `bun build --compile` smoke |
| 3 | materialized seed had **no SEED.md** and only the generic charter, so `vend steer` had an empty snapshot + generic value function (**seed→steer**) | T-062-03-01 (the one genuine gap found) | **fixed-at-source** | `kitchen-overlay.ts` now ships `SEED.md` + an overriding `docs/knowledge/charter.md` | `src/kitchen/seed-steer-seam.test.ts` |
| 4 | `vend doctor` had no kitchen-workspace branch — green needed the build engine (**doctor**) | T-062-02-02 | **fixed-at-source** | `src/kitchen/kitchen-doctor.ts` — `isKitchenWorkspace` → `probeKitchen` (bun/astro/seed checks) | `kitchen-doctor.test.ts` (branch matrix) + `kitchen-doctor.smoke.test.ts` (wired CLI) |
| 5 | run must degrade without `codebase-memory-mcp` on a fresh cook repo (**mcp-absence**) | T-062-03-02 (seam already correct) | **fixed-at-source** (verified, no change needed) | no overlay ships `.mcp.json`; `DECOMPOSE_TOOLS` declares the MCP optional (E-060) | `src/kitchen/kitchen-degrade.test.ts` |
| 6 | `vend work` must clear the menu-render slice inside the cold-start budget (**cold-start budget**) | E-060 (reused) / T-062-03-03 | **fixed-at-source** (deterministic half) | `src/cli.ts` work arm defaults to the calibrated cold-start envelope (T-060-02-02); render contract in `src/kitchen/menu-render.ts` | `src/kitchen/menu-render.test.ts` + `build.proof.txt` (live half = `⟪…⟫`, T-062-04-01) |
| 7 | **the whole path as one composition** had no single guard — only by-hand witness (**all stages**) | this card (T-062-03-04) | **fixed-at-source** (new guard) | n/a (a guard, not a code fix) | `src/kitchen/cold-start-redrive.test.ts` — init → scaffold → doctor → steer-inputs → degrade → idempotent re-init, in sequence on one workspace |

## Boundaries → escalation (AC clause A, the "follow-up-epic" branch)

These are deliberate scope cuts noted in predecessor reviews — **not** frictions the drive hit as
blockers. Each needs live infra beyond the dress-rehearsal bootstrap surface, so per the ticket
("escalate any overflow beyond the bootstrap surface to a follow-up epic, not into this card")
they are escalated rather than folded in:

| Boundary | Why out of the bootstrap surface | Escalation target |
|---|---|---|
| Live `astro build` of the seed in an automated CI gate | proven offline (`T-062-03-03/build.proof.txt`, exit 0) but not CI-gated; needs CI infra + `bun install` | proposed `E-063 kitchen-clean-room-drive` |
| `vend doctor` detecting deps-declared-but-not-installed | the Astro check is config-presence by necessity (seed ships no `node_modules`); a live `node_modules` resolution needs `bun install` to have run | proposed `E-063 kitchen-clean-room-drive` |
| Live EmDash REST round-trip (D1/HTTP) | render is proven against the REST *shape* + the seeded example; a running server is the cook's own deploy, out of the rehearsal | proposed `E-063 kitchen-clean-room-drive` |

**Escalation mechanism (honest):** tickets in this project are materialized by Vend's
`decompose-epic` play (see the S-062-03 header), not hand-authored — hand-writing ticket files
risks id/DAG collisions (`T-063/064/065` already exist under E-061's stories). So these are
recorded here as a **proposed follow-up epic** to be materialized via `propose-epic` /
`decompose-epic` when the clean-room phase opens. This matches the epic's own boundary text: *"the
untouched fresh-repo clean-room drive that is the actual forward-E1 proof is a SEPARATE downstream
epic and must not be folded in here."* Flagged for the human in `review.md`.

## Re-drive evidence (AC clause B — full path runs clean, no manual intervention)

**By-hand witness** (deterministic half, run against `src/cli.ts` in a fresh temp dir):
- `vend init --template kitchen` → `31 created, 0 skipped`, exit 0.
- `vend doctor` (cwd in workspace) → `doctor: ok — 3 check(s) passed` (`✓ bun on PATH`,
  `✓ Astro storefront config present`, `✓ EmDash Dish seed valid`), exit 0.
- re-`init` → `0 created, 31 skipped`; re-`doctor` → still green.
- `vend steer` → dispatches the live executor (metered) — the human-authorized half, **not**
  re-run; left to T-062-04-01.

**Durable gated witness** (replaces the by-hand note): `src/kitchen/cold-start-redrive.test.ts`
drives the deterministic path as one continuous sequence on one workspace — `1 pass / 25
expect()` first run, no source fix needed. Full gate: `bun run check` → **1488 pass / 1 skip / 0
fail** (+1, no regression), `tsc --noEmit` clean.

## Honest-on-outcome footer

The **metered half** — the live, non-deterministic `vend steer` ranking and the `vend work`
clear landing inside the cold-start budget in `runs.jsonl` — stays **deferred** to the
human-authorized cast (T-062-04-01) and is recorded as `⟪…⟫` in the predecessors'
EXPECTED-OUTCOME files. No live number was invented in this card.
