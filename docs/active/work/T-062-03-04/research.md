# Research — T-062-03-04 harden-bootstrap-friction-fix-at-source

_Phase: Research. Descriptive map of the bootstrap surface, the frictions logged across the
E-062 dress rehearsal, and how each was disposed. No solutions proposed here._

## The ticket in one line

Fix-at-source every bootstrap friction surfaced during the E-062 drive — across **install,
init, doctor, scaffold, seed→steer, cold-start budget, mcp-absence** — give each a regression
guard, re-drive the full path clean with no manual intervention, and escalate any overflow
beyond the bootstrap surface to a follow-up epic rather than into this card.

This is the **last card of S-062-03** (depends_on `T-062-03-03`), and `T-062-04-01`
(gold-master capture) depends on it. So this card is the consolidation gate: it must leave the
bootstrap path provably clean before the epic is frozen.

## The bootstrap path, stage by stage (where each lives)

The cold-start path a brew-installed cook walks, and the code each stage exercises:

| Stage | Gesture | Code | Determinism |
|---|---|---|---|
| install | `brew install johnhkchen/vend/vend` | E-061 tap + compiled binary (`T-063-01`, live) | out of this repo's gate |
| init | `vend init --template kitchen` | `src/init/init-effect.ts` `runInit` → `src/init/init-core.ts` `TEMPLATE_REGISTRY.kitchen` = `KITCHEN_OVERLAY` (`src/kitchen/kitchen-overlay.ts`) | **deterministic** |
| scaffold | (the bytes init lays) | `KITCHEN_OVERLAY` (13 text-embedded seed files) + base manifest | **deterministic** |
| doctor | `vend doctor` (cwd in the workspace) | `src/kitchen/kitchen-doctor.ts` `probeKitchen` → `renderDoctorReport` (`src/doctor/doctor-core.ts`); CLI dispatches on cwd signature | **deterministic** |
| seed→steer | `vend steer` | inputs: `src/play/project-context.ts` `buildProjectSnapshot` (pure); ranking: `src/play/steer.ts` `assembleSteerInputs` → live executor | inputs deterministic; **ranking metered** |
| cold-start budget | `vend work` (no `--budget`) | `src/cli.ts` work arm defaults to the calibrated cold-start envelope (T-060-02-02); `castWork` | **metered** |
| mcp-absence | (degrade during steer/work) | `src/engine/mcp-registry.ts` `readProjectMcpServers` → `src/engine/cast-core.ts` `resolveTools` against `DECOMPOSE_TOOLS` | **deterministic** |

The split that governs this card: the **deterministic half** (init, scaffold, doctor,
steer-inputs, degrade, idempotency) can be driven and gated offline; the **metered half**
(the live steer ranking + the live `vend work` clear landing in budget) is human-authorized
(P7) and is `T-062-04-01`'s job, recorded as `⟪…⟫` in the predecessors' EXPECTED-OUTCOME files.

## What I actually drove (live, deterministic half)

To ground this in fact rather than the predecessors' prose, I ran the deterministic path by
hand against `src/cli.ts` in a fresh temp dir:

- `vend init --template kitchen` → `31 created, 0 skipped`, exit 0. Tree carries `.emdash/seed.json`,
  `SEED.md`, `docs/knowledge/charter.md`, `astro.config.mjs`, `src/pages/index.astro`,
  `wrangler.toml`, `.github/workflows/deploy.yml`, `package.json`, `bun.lock`, etc.
- `vend doctor` (cwd in the workspace) → `doctor: ok — 3 check(s) passed`: `✓ bun on PATH`,
  `✓ Astro storefront config present`, `✓ EmDash Dish seed valid`. Exit 0.
- re-`init` → `0 created, 31 skipped` (idempotent no-clobber). re-`doctor` → still green.
- `vend steer` → DOES dispatch the live executor (metered; it streamed assistant/user turns).
  This is the human-authorized half — **not** re-run here; left to T-062-04-01.

**Finding: the deterministic bootstrap surface already drives clean end-to-end.** Every
friction the epic names was fixed in its own predecessor card. This card's leverage is therefore
(a) consolidating the friction ledger with dispositions, and (b) closing the one structural gap
the per-seam tests leave open — see below.

## The friction log (surfaced across the dress rehearsal) + where it was fixed

Drawn from each predecessor's `review.md` "open concerns" / "what this delivers":

1. **init — kitchen template not registered** (`T-062-01-01` review concern 1): the seed was
   authored but `vend init --template kitchen` would not lay it. **Fixed at source** in
   `T-062-02-01` (`init-core.ts` `TEMPLATE_REGISTRY.kitchen` + `STANDALONE_TEMPLATES`).
   Guard: `init-kitchen.test.ts` + the registry-iterating pure invariants.
2. **scaffold — overlay embedding / binary safety** (`T-062-02-01`): text imports
   (`with { type: "text" }`) so the seed embeds in `bun build --compile`. **Fixed at source.**
   Guard: byte-equal scaffold assertions + manual compile smoke.
3. **seed→steer — materialized seed had no SEED.md and only the generic charter** (`T-062-03-01`,
   the one genuine gap found): `vend steer` had an empty snapshot + generic value function.
   **Fixed at source** (overlay now carries `SEED.md` + kitchen `charter.md`). Guard:
   `seed-steer-seam.test.ts`.
4. **doctor — green on the kitchen workspace** (`T-062-02-02`): workspace-aware doctor branch.
   **Fixed at source.** Guard: `kitchen-doctor.test.ts` + `kitchen-doctor.smoke.test.ts`.
5. **mcp-absence — graceful degrade without codebase-memory-mcp** (`T-062-03-02`): seam was
   already correct (no `.mcp.json` shipped; `DECOMPOSE_TOOLS` optional). Guard:
   `kitchen-degrade.test.ts`.
6. **cold-start budget** (`T-060-02-02`, reused): `vend work` defaults to the calibrated
   cold-start envelope; the menu-render slice's render contract gated by `menu-render.test.ts`.

### Boundaries noted as out-of-scope (NOT unfixed frictions — candidates to escalate)

These were called out as deliberate scope cuts, never as blockers the drive hit:

- **Live `astro build` of the seed in CI** (`T-062-02-01` gap): the build is proven offline
  (`T-062-03-03` `build.proof.txt`, exit 0) but not in an automated CI gate.
- **doctor catching deps-declared-but-not-installed** (`T-062-02-02` gap): the Astro check is
  config-presence, not a `node_modules` resolution. Needs `bun install` to have run.
- **Live EmDash REST round-trip** (multiple): the render is proven against the REST *shape* +
  the seeded example, not a running D1/HTTP server.

These need live infra (a server, CI, installed deps) — beyond the dress-rehearsal bootstrap
surface. They are the natural escalation candidates the ticket's "overflow → follow-up epic"
clause covers.

## The one structural gap in the existing guards

Every stage above has its **own** test, but each scaffolds its **own** temp dir and asserts its
**own** seam in isolation:

- `init-kitchen.test.ts` — init only
- `kitchen-doctor.smoke.test.ts` — scaffold + doctor
- `seed-steer-seam.test.ts` — scaffold + steer-inputs
- `kitchen-degrade.test.ts` — scaffold + degrade

**No single test drives the whole path as one continuous re-drive on one workspace.** So a
regression in the *composition* — a scaffold change that init lays but doctor/steer no longer
accept, or an ordering coupling — would not fail loudly. The AC's second clause ("a fresh
re-drive of the full path runs clean with no manual intervention") has, today, only a *by-hand*
witness (what I ran above), not a gated one.

## Constraints / assumptions

- **No new engine surface** (epic boundary): reuse the shipped seams; this card adds a guard +
  a ledger, not a command.
- **Honest-on-outcome**: the metered half stays `⟪…⟫` (T-062-04-01); no live number invented.
- **Determinism for the new guard**: `probeKitchen`'s bun check passes because bun runs the
  test (guaranteed on PATH) — green by construction, the `kitchen-doctor.smoke.test.ts` rationale.
- **No hand-authored tickets**: tickets in this project are materialized by Vend's
  `decompose-epic` play (see S-062-03 header), not written by hand — so an escalation is a
  *recommendation to materialize*, not a fabricated ticket file (would risk DAG/id collisions;
  `T-063/064/065` already exist under E-061's stories).
- **Commits left to Lisa**: the working tree carries uncommitted sibling-thread work; `bun run
  check` must stay green over the combined tree.
