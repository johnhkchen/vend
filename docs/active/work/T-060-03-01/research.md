# T-060-03-01 — Research: the closing LIVE re-drive that flips the gold master

**Ticket:** live-redrive-flips-gold-master-to-positive (S-060-03 · E-060)
**Depends on:** T-060-01-02 (reduced-grounding marker on the run record), T-060-02-02 (calibrated
default budget). Both `phase: done`.

Descriptive only — what exists and how it connects. No solutions here.

## What this ticket is

The closing card of E-060. The three preceding fixes (E-059 steer wiring, T-060-01 graceful-degrade,
T-060-02 calibrated budget) each closed one of the three findings the E-058 live drive recorded. This
ticket runs the **LIVE two-gesture re-drive** on a sandboxed seed copy with no `codebase-memory-mcp`
present, clears ≥1 real slice end-to-end, and flips the gold master
(`examples/templates/hackathon-seed/EXPECTED-OUTCOME.md`) from the E-058 empty-board **negative** to
its **positive** form (board renders AND a slice clears). It is a *measurement-and-capture* ticket,
not a `src/` change: it exercises the shipped artifact and writes back the gold master.

## The negative gold master being replaced

`examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` today is the T-058-05 capture (drive of
**2026-06-21**, total spend **$0.91**). Its headline verdict is the A3 finding: the **shipped** flow
(`copy → lisa init → vend init --template hackathon → vend steer`) produces an **honest-empty steer**
(no board, no forks). It records three follow-ups, each now closed by an E-059/E-060 fix:

1. **Input wiring (A3 / finding #1)** — `vend init --template hackathon` wrote the seed intent nowhere
   `steer` reads it; `assembleSteerInputs` read `docs/knowledge/charter.md` + the board snapshot,
   never `SEED.md`. ⇒ closed by **E-059** (T-059-01 threads SEED intent into the snapshot; T-059-02
   overlays the tuned charter at `docs/knowledge/charter.md`).
2. **Budget shape (finding #2)** — the cold-start chain prices at ~120 min on the time axis; a tight
   `--budget` funds nothing (denomination-separate wallet, IA-8). ⇒ closed by **T-060-02-02** (omit
   `--budget` ⇒ the calibrated cold-start envelope funds the first clear).
3. **MCP capability (finding #3)** — the clearing chain required `codebase-memory-mcp`; a fresh
   seed/lisa-init project lacks it, so propose cleared but decompose **andoned**
   (`missing-capability`). ⇒ closed by **T-060-01-01** (reclassified to `optionalMcp` ⇒ degrade, not
   andon) + **T-060-01-02** (the degrade rides the run record as `reducedGrounding`).

The re-run block at the bottom of the negative gold master still carries the **diagnostic hack**
(`cat charter.md SEED.md > docs/knowledge/charter.md`) that the A3 finding forced. With E-059 landed,
that hack is obsolete — the shipped flow renders the board directly.

## The drive surface (the gestures, where they live)

`src/cli.ts` dispatches the verbs. The relevant arms for this drive:

- **`vend init --template hackathon`** (`src/init/init-core.ts`) — overlays the hackathon template
  over the cwd via `mergeManifests` (no-clobber: existing files are skipped). `TEMPLATE_REGISTRY.hackathon`
  (init-core.ts:256-261) writes `SEED.md` (`HACKATHON_SEED_STUB`, skipped when the rich seed already
  exists) and `docs/knowledge/charter.md` (`HACKATHON_CHARTER`, the tuned value function `steer` reads).
- **`vend steer`** (`src/play/steer.ts`) — `assembleSteerInputs` (steer.ts:112-122) reads
  `docs/knowledge/charter.md` (CHARTER_PATH) AND `SEED.md` (SEED_PATH, **tolerantly** — absent ⇒
  undefined). `buildProjectSnapshot` (project-context.ts:59-77) inserts a `## Stated intent (SEED.md)`
  section into the `{{ project }}` block when intent is present. Output: a staged board + forks at
  `docs/active/pm/staged/steer.md`. This is the E-059 wire — the make-or-break path.
- **`vend work`** (`src/play/work.ts`) — reads the staged board (`DEFAULT_BOARDS` = steer board first,
  then survey board), prices it via `coldStartEnvelope` over the run-log, allocates a macro-wallet,
  and `spendDown` casts the propose→decompose chain per signal until a clean stop. Omitting `--budget`
  ⇒ the **calibrated cold-start envelope** default (T-060-02-02). `--no-intervened` forwards
  `intervened:false` to every cast (forward-E1). `--stale-ok` (IA-5) bypasses the board-freshness gate.
- **`vend svg`** (`src/present/…`) — read-only render of the live work-graph to `.vend/work-graph.svg`
  (the designer's view). Never mutates the graph (E-055/E-056 one-way authority).

## The clearing chain and the degrade

`vend work` casts `castProposeDecomposeChain` (`src/play/chain-propose-decompose.ts`): **propose-epic**
(mints an epic from the board signal) → **decompose-epic** (mints stories/tickets from the epic). A
full **slice clear** is the chain clearing both casts.

- `decompose-epic` declares `DECOMPOSE_TOOLS` (`src/play/decompose-epic-core.ts:72-76`):
  `optionalMcp: ["codebase-memory-mcp"]`, `allow: [Read, Grep, Glob]`, `deny: AUTONOMOUS_DENY`.
- `resolveTools` (`src/engine/cast-core.ts:112`) matches declared tools against the project's
  `available` set (from `readProjectMcpServers`, mcp-registry.ts — reads `.mcp.json`, absent ⇒ `[]`).
  An absent **required** `mcp` andons; an absent **`optionalMcp`** id is **dropped** and flips
  `reducedGrounding = true` (cast-core.ts:124) — a degrade, never an andon.
- `castPlay` (`src/engine/cast.ts:284-286, 315`) surfaces the degrade: a stdout note at cast time AND
  the one-way `reducedGrounding: true` marker spread onto the run record (only when degraded — a
  fully-grounded record stays byte-identical). `run-log.ts` carries it through `buildRunRecord` and
  `reviveRecord` (one-way `normalizeReducedGrounding`), so the marker survives the ledger round-trip.
  **NOTE: these two files (cast.ts, run-log.ts) are T-060-01-02's edits, present in the working tree
  (uncommitted). The drive runs `bun run $PWD/src/cli.ts` over the working tree, so the marker is
  active for the live drive even though those edits belong to another ticket's commit.**

## Forward-E1 — what "a cleared forward-E1 record" means

From project memory (`vend-forward-e1-measurement`): a **forward-E1 record** is a run cast LIVE
**without intervention** that cleared its gates and ran untouched (`intervened:false` recorded at run
time, not back-filled), accruing forward in `.vend/runs.jsonl`. It is the OKR Set-A autonomy gauge
(bar: ≥10 cleared forward records; ~4 today). `--no-intervened` on `vend work` is what stamps
`intervened:false` onto each chain cast. So a clearing drive with `--no-intervened` accrues cleared
forward-E1 records. In a throwaway sandbox these live in the sandbox's `.vend/runs.jsonl`; the prior
drive captured them verbatim into the gold master + `progress.md` as durable evidence.

## The drive recipe (precedent — T-058-05)

`docs/active/work/T-058-05/progress.md` is the model: a throwaway `mktemp -d` sandbox, `cp -R` the
seed, strip `node_modules/.astro/.vend`, run the gestures via `VEND=$PWD/src/cli.ts`. The committed
template is **not** mutated (only `EXPECTED-OUTCOME.md` is written back). The current re-run block is
embedded at the bottom of `EXPECTED-OUTCOME.md`.

## Verified state (preconditions for the drive)

- **Gate green:** `bun run check` → **1354 pass / 0 fail**, typecheck clean (working tree, with the
  T-060-01-02 marker edits present).
- **Tooling present:** `bun`, `lisa`, `claude` (2.1.195), `doppler` all on PATH. The `claude` executor
  (`src/executor/claude.ts`) spawns `claude -p` authenticated by the **subscription**, not a metered
  API key — so the Doppler keyring error (`exit status 36`) does **not** block a live drive (it only
  affects `doppler run -- bun run check`, irrelevant to the drive itself).
- **E-059 landed** (commits f7b67bc, 5dbb228, 3f347bf): shipped steer reads SEED + tuned charter.
- **T-060-01-01 landed** (16c25e0): decompose graceful-degrades on absent MCP.
- **T-060-02-02 landed** (856f3c0): omit `--budget` ⇒ calibrated cold-start envelope.

## Assumptions & constraints

- **Honest-on-outcome (house law).** The gold master captures the REAL drive — including any
  shortfall. No fabricated records, no laundered evidence. If a slice does not clear live, the gold
  master does not get flipped to positive; the shortfall is recorded instead.
- **No `src/` change.** This ticket measures the shipped artifact. The only repo writes are
  `EXPECTED-OUTCOME.md` (flipped) and the `work/T-060-03-01/` artifacts (incl. captured runs.jsonl).
- **Commit only own files.** cast.ts/run-log.ts (T-060-01-02) stay unstaged — another ticket owns them.
- **Live cost & nondeterminism.** Real metered spend (~$1 precedent); the board's exact wording will
  differ run-to-run — the gold master is a *comparable* bar (gated validity), not a wording match.
- **Budget risk.** Omitting `--budget` on a cold-start ledger funds the wallet at the summed standard
  prior; the per-cast funding floor (350k tokens, E-053) is what authorizes each cast. Unit-tested in
  work-core, but live is the first real exercise — a fallback explicit `--budget` is the contingency.
