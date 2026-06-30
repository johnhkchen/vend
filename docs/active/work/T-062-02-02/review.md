# T-062-02-02 — Review: doctor-green-on-kitchen-workspace

## What changed

`vend doctor` became **workspace-aware**. In a standalone kitchen workspace it now probes the
app's own prerequisites (bun, the Astro/Cloudflare storefront config, the EmDash Dish seed)
instead of the vend/lisa build-engine deps; everywhere else it is unchanged.

| File | Change |
|---|---|
| `src/kitchen/kitchen-doctor.ts` | **NEW** — impure kitchen probe + pure `isKitchenWorkspace` detector |
| `src/kitchen/kitchen-doctor.test.ts` | **NEW** — unit cover of every branch (injected facts) |
| `src/kitchen/kitchen-doctor.smoke.test.ts` | **NEW** — the AC, guarded-live scaffold-then-run |
| `src/cli.ts` | **MODIFIED** — `doctor` dispatch arm now branches on the cwd signature |

Untouched by design: `doctor-core.ts` (the renderer is already general over any `Check[]`),
`doctor-probe.ts`, `preflight.ts` (the cast door deliberately keeps the build-engine checks —
a standalone kitchen app still needs the engine to `vend work` later), and `dish-seed.ts`
(consumed as-is; its header already anticipated this reuse).

## How it satisfies the AC

> A smoke test scaffolds the kitchen workspace then runs `vend doctor` and asserts a green exit
> with every kitchen-seed prerequisite probe passing.

`kitchen-doctor.smoke.test.ts` does exactly this: real `runInit(tmp, "kitchen")`, then a real
`bun run src/cli.ts doctor` spawned with `cwd: tmp`, asserting `exitCode === 0`, `doctor: ok`,
and a green `✓` line for each of bun / Astro storefront config / EmDash Dish seed. It
additionally asserts the build-engine lines are ABSENT (proving the workspace-aware switch
actually swapped check-sets, so green isn't a host accident) and that there is no stack trace.

## The one real design decision (flagged for the reviewer)

**Why a context switch rather than appending kitchen checks to the existing four.** The AC
requires a *hard green exit*. The pre-existing doctor smoke test (`doctor-cli.smoke.test.ts`)
deliberately refuses to assert a hard green because lisa/claude/BAML are not guaranteed on a CI
box. So the asserted-green set must be deterministically green: bun (the runtime running the
test), the scaffolded Astro config, the scaffolded EmDash seed — none of which is the build
engine. Appending would have re-introduced the exact flakiness E-042 engineered around.

This is also semantically correct: a kitchen workspace is a `STANDALONE_TEMPLATE` (no lisa
marker), so its prerequisites genuinely are the app's, not the build engine's. `vend doctor`
answers "the prerequisites for what you'd do *here*". A reviewer who disagrees should look at
the alternative (additive) and confirm it cannot meet the hard-green AC without assuming host
deps.

## Test coverage

- **Unit** (`kitchen-doctor.test.ts`, host-independent via injected `onPath`/`readFile`):
  all-green (graded against the *authored* seed bytes), bun-off-PATH, astro config missing the
  adapter, package.json missing a dependency, seed contract violation (hint names the violation),
  malformed seed JSON degraded by `safeCheck`, readFile-always-throws → three reds, plus
  `isKitchenWorkspace` true/false and a guarded-live defaults-compose block.
- **Integration** (`kitchen-doctor.smoke.test.ts`): the full wired path on a real scaffold.
- **Gate**: `bun run check` — tsc clean, 1471 pass / 1 skip / 0 fail.

### Gaps / not covered (intentional)

- The CLI `doctor` arm's branch selection is exercised by the smoke test (kitchen branch) and
  the pre-existing doctor smoke test (default branch, run from repo root). The `readdir`-failure
  fallback (`.catch(() => [])`) is not directly tested — it is a defensive default that degrades
  to the existing, well-tested build-engine branch; low risk.
- The Astro check is a **config-presence** check (text/manifest signals), not a node_modules
  resolution — by necessity, since the seed ships no `node_modules` and the AC's green must hold
  right after scaffold. It tracks the same signals T-062-02-01's scaffold test pins, so it moves
  in lockstep with the authored seed. It would NOT catch a workspace where deps are declared but
  `bun install` was never run — but that is out of scope (and bun being on PATH is the actionable
  prerequisite for fixing it).

## Open concerns / follow-ups

- **None blocking.** One latent coupling worth noting: `astroConfigCheck`'s string signals
  (`adapter`, `cloudflare`, the two dep names) and `dishSeedCheck`'s contract are pinned to the
  authored seed. If a future ticket reshapes `astro.config.mjs` or the Dish schema, this probe
  and T-062-02-01's scaffold test move together — the unit test's all-green case reads the
  authored bytes, so drift surfaces as a test failure rather than a silent false-green.
- The cast door (`castPreflight`) remains build-engine-only on purpose; if E-062's later
  hands-off clean-room drive wants a kitchen-aware cast preflight, that is a separate decision,
  not folded in here.

## Handoff

Self-contained, gated green, committed (`4ffbff7`). No human action required to land; the only
judgment call a reviewer should weigh is the context-switch-vs-additive decision above.
