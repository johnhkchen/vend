# T-058-05 — Research: gold-master live drive on the seed

Descriptive map of the surface this ticket exercises. The ticket is not a code change — it is a
**LIVE METERED drive** of the shipped hackathon seed end-to-end, capturing the real outcome (the
"gold master") into `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md`. So "the codebase" here
is the set of gestures the drive invokes, the files the drive reads/writes, and the seams that
decide whether a coherent board comes off a *thin non-vend-domain seed* — the make-or-break **A3
risk**.

## The drive's gestures (all shipped, confirmed in `src/cli.ts`)

`src/cli.ts` is the single CLI entry. Every gesture the ticket names parses + dispatches today:

- `vend init [--template <name>]` — `parseInitArgs` (cli.ts:228) → `runInit(cwd, template)`
  (`src/init/init-effect.ts`). Overlay seam shipped by **T-058-01** (commit `b9110d7`).
- `vend doctor` — `parseDoctorArgs` → `probeDoctor` + `renderDoctorReport`. Read-only preflight.
- `vend steer [--budget <ms>,<tokens>]` — `parseSteerArgs` → `castSteer` (`src/play/steer.ts`).
- `vend work [--budget …] [--board …] [--stale-ok] [--intervened|--no-intervened]` —
  `parseWorkArgs` → `castWork` (`src/play/work.ts`).
- `vend svg [--seat <designer|dev>] [--out <path>]` — `parseSvgArgs` → `writeBoardSvg`
  (`src/present/svg-file.ts`). Writes `.vend/work-graph.svg` (default).
- `vend survey` — the lighter board-only sibling of steer (fallback board source for `work`).

The USAGE banner (cli.ts:17–30) is the authoritative spelling; the seed's README/shelf-note were
cross-checked against it in T-058-03.

## What `vend init --template hackathon` actually writes — KEY FINDING

`src/init/init-core.ts` holds the template registry:

```
TEMPLATE_REGISTRY = { hackathon: [ { kind:"file", path:"SEED.md", contents: HACKATHON_SEED_STUB } ] }
```

So `--template hackathon` applies the base `SCAFFOLD_MANIFEST` **plus a single stub `SEED.md`**. The
base manifest (init-core.ts:140–163) writes: the empty board (`docs/active/demand.md`, zero demand
rows), the PM desk, the archive, and **knowledge stubs** including `docs/knowledge/charter.md =
CHARTER_STUB` and `docs/knowledge/vision.md = VISION_STUB`. The overlay is **trivial by design** —
T-058-01's header says the rich content "is T-058-02/03." That rich content lives **only** in
`examples/templates/hackathon-seed/` (the directory you *copy*), NOT in the registry. The drive's
"copy the seed to a sandbox" step is therefore load-bearing: it is what supplies the real
team-finder `SEED.md`, the tuned `charter.md`, the Astro app, `/board`, and the EXPECTED-OUTCOME stub.

`runInit` is **no-clobber** (`planTemplate` → `planInit` over the merged manifest, init-core.ts:215).
So in a sandbox that already contains the seed's root `SEED.md` and `charter.md`, init **skips** them
(the rich files win; the stub never overwrites). Confirmed by `init-effect.test.ts` (no-clobber on a
pre-existing edited `SEED.md`).

## What `steer` reads — the A3 crux

`assembleSteerInputs` (`src/play/steer.ts:109`) builds the steer prompt's two inputs:

1. `charter = readFile(join(root, CHARTER_PATH))` where `CHARTER_PATH =
   "docs/knowledge/charter.md"` (`src/play/project-context.ts:18`).
2. `project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets })` — **`srcFiles` is
   empty** (steer's heaviness is the model's *agentic* file-reading during the live cast, per the
   steer.ts header), and after a fresh init the stories/tickets dirs are empty.

**Consequence:** the charter handed to the steer prompt is the init **CHARTER_STUB** ("_Stub — author
your project's value function here_"), **not** the seed's hackathon-tuned `charter.md` (which sits at
the sandbox **root**, `./charter.md`, where steer never reads it). The tuned charter and the
team-finder `SEED.md` are only seen if the **model agentically opens them** during the cast (the
Claude executor runs `claude -p` with file tools). This is the central question the live drive
answers: *does steer produce a coherent team-finder board when its explicit charter input is a generic
stub and the real intent must be discovered by agentic reading?*

## The casting spine + executor (what "metered" means)

- `castSteer`/`castWork` → `castPlay`/`spendDown` (`src/engine/`) → the **Claude executor**
  (`src/executor/claude.ts`, selected by `src/executor/select.ts`; default id `claude`, no config
  needed). `dispense` spawns real `claude -p`. So steer and work are **real model spend** — the
  ticket's "LIVE METERED, NOT a free proof."
- `steerProjectPlay.budget` default = **400k tokens / 40 min** (steer.ts:78). `DEFAULT_MACRO_BUDGET`
  for work = **2M tokens / 2 h** (work.ts:38). Budgets are ceilings (P7 hard contract); a `--budget`
  funds an explicit, smaller envelope.
- `steer` STAGES `docs/active/pm/staged/steer.md` (board + forks). `work` reads
  `DEFAULT_BOARDS = [steer.md, survey-board.md]` (work.ts:42), funds a wallet, prices each pull at the
  recalibrated propose+decompose envelope (E-013), and `spendDown` casts the propose→decompose chain
  per signal — each a metered cast appending a record to `.vend/runs.jsonl`.

## Run-log + forward-E1 record

`src/log/run-log.ts` defines the record. The **forward-E1** instrument is the `intervened?: boolean`
field (run-log.ts:125) — captured live when `work` is run with `--intervened`/`--no-intervened`
(threaded through every chain cast, work.ts:221). `intervenedAttested` distinguishes a live forward
capture (absent) from a post-hoc attestation. The ticket's "forward-E1 record accrued" = a
`runs.jsonl` record from a real `work` sweep carrying a live `intervened` bit — the Frontier-1 second
payoff (a genuine walk-away sweep doubling as E1 evidence).

## Doctor preconditions in THIS environment

`probeDoctor` (`src/doctor/doctor-probe.ts`) runs four checks: lisa on PATH, claude on PATH, BAML
addon loadable, active-executor config. Live probe of this host: `lisa`
(`/opt/homebrew/bin/lisa`), `claude` (`/Users/johnchen/.local/bin/claude`), `bun` all resolve;
default executor is `claude` (needs no config); BAML addon loads (the suite is green). So **doctor is
expected green** and `castWork`'s door-preflight (work.ts:162) will not refuse. `ANTHROPIC_API_KEY`
is **unset** in-shell — the `claude` CLI uses its own logged-in credentials, which doctor does not
probe. Whether nested `claude -p` authenticates/runs in this sandbox is an open empirical question
the drive itself answers.

## The gold-master target + the gates that define "coherent"

- `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` is a **TARGET stub** (T-058-03, banner
  "_FILLED BY T-058-05_") with a table of blanks: board items / forks / slices cleared / budget spent
  / forward-E1. This ticket fills the "Actual (live)" column.
- "Coherent board / genuine forks" is defined by steer's three gates (`src/play/steer-core.ts`):
  `read-never-invent` → `fork-genuineness` (a fork needs `MIN_FORK_OPTIONS=2`..`MAX_FORK_OPTIONS=4`
  distinct options) → `leverage-rank`. A weak/junk board would fail these or rank the template's own
  scaffolding (the self-referential failure E-044's steer-demotion fix de-risks).

## Constraints / assumptions

- **Do not mutate the committed template.** The drive runs in a throwaway copy (a tmpdir outside the
  repo); only the captured `EXPECTED-OUTCOME.md` is written back into `examples/templates/...`.
- **Honest-on-outcome.** A weak board off the thin seed is the *A3 finding* (charter/seed need
  tuning), to be recorded, not papered over.
- **Bounded spend.** Budgets are funded explicitly and modestly; the drive must be re-runnable +
  comparable (the consistency bar), so the captured numbers are real, not aspirational.
- Sibling reviews (T-058-03/04) flag two carry-ins to re-check at drive time: gesture-string drift vs
  `cli.ts` USAGE, and the `/board` route's `process.cwd()`-relative read of `.vend/work-graph.svg`.
