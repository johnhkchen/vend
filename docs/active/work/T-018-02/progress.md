# T-018-02 Progress — register-steer-and-gesture

All plan steps complete. The pure core (T-018-01) is now wired into a registered, castable play
with a `vend steer` gesture that stages the board AND the forks. Full gate green; the live cast is
the human verification at sweep (AC#4).

## Steps

### Step 1 — `src/play/steer-effect.ts` ✅
Created the addon-free, impure effect. `SteerInputs {project, charter}`, `STEER_STEM = "steer"`,
`renderStagedSteer` (three branches: fully-empty abstention / board + `## Pull these` / `## Forks`
or clear-path note), `steerEffect` (mkdir + write `docs/active/pm/staged/steer.md`, returns
`EffectResult` with `artifacts`/`produced`). Reuses `renderBoard` (survey-core), `renderForks`
(steer-core), `STAGING_DIR` (expand-effect) — all addon-free, all genuine shared contracts.
Typecheck clean.

### Step 2 — `src/play/steer-effect.test.ts` ✅
The AC#3 offline proof (mirrors `survey-effect.test.ts`). 10 tests: stages `steer.md` with the
demand rows + a pull line per signal + the fork blocks; writes nothing to `demand.md`/board; the
board-only case stages the clear-path note (no `### Fork —`); the fully-empty steer stages the
abstention; clear→classify (grounded board+fork → success+materialize with three passed gate rows;
ungrounded → read-never-invent gate-failed; one-option fork → fork-genuineness gate-failed); the
`renderStagedSteer` pure-helper branches. `bun test src/play/steer-effect.test.ts` → 10 pass, no
addon loaded.

### Step 3 — `src/play/steer.ts` ✅
The registered play (mirrors `survey.ts`). `PLAY = "steer"`; `parseSteer` (b.parse.SteerProject —
**NO try/catch**, doc-commented with the two-array SAP-degrade rationale, the deliberate divergence
from `parseSurvey`); `steerProjectPlay: Play<SteerInputs, Steer>` (render via `extractPromptText`,
`gates: (steer) => clear(steer)`, `effect: steerEffect`, budget `{timeMs: 2_400_000, tokens:
400_000}` with the recalibrate note, blue/green permanent rare card); `registry.register(...)`;
`SteerOptions`; `assembleSteerInputs` (charter + ids + snapshot, `srcFiles: []`); `castSteer`
(subject `steer of <root>`). Typecheck clean; registry smoke confirms `name: "steer"`, budget set.

### Step 4 — `src/cli.ts` ✅
Added the `USAGE` line (`vend steer [--budget <ms>,<tokens>]`), the `ParsedCommand` steer arm, the
`parseArgs` route, `parseSteerArgs` (flags-only copy of `parseSurveyArgs`), and the dispatch arm
(lazy import, `budget ?? steerProjectPlay.budget`, cast, print, exit on outcome). Usage smoke:
`vend steer junk` → `unexpected steer argument: junk` + the banner.

### Step 5 — `src/cli.test.ts` ✅
Added the steer parse block (mirrors survey): no-budget → `{cmd:"steer"}`; `--budget` override;
unexpected positional → usage; malformed/dangling `--budget` → usage.

### Step 6 — full gate ✅
`bun run check` (baml:gen + typecheck + test) green: **576 pass / 0 fail** (562 baseline + 10
steer-effect + 4 cli parse). No `baml_client` churn (T-018-01's generated `Steer`/`Fork` already
committed).

## Deviations from the plan

- **None of substance.** Commits were not yet made (the working tree holds the changes); the
  intended atomic commit boundaries are documented in `plan.md` and can be applied at the sweep.
  Step 5's parse tests are bundled with the Step 4 CLI change as the plan's fallback allows.
- `renderStagedSteer` uses `renderBoard({ signals: steer.signals })` — the explicit Board view of
  the steer's board half (D3), which typechecks cleanly and keeps the staged board byte-identical
  to a Survey board.

## AC status

- AC#1 — `steerProjectPlay` registered with the generous (>300k) budget; `castSteer` casts via
  `castPlay`. ✅ (registry smoke + Step 3)
- AC#2 — `vend steer` stages board+forks on success; a read-never-invent / fork-genuineness refusal
  halts as `gate-failed`, nothing staged. ✅ (Step 4 wiring; proven offline in Step 2)
- AC#3 — `steer-effect.test.ts` proves project→staged steer offline; the effect writes to staging,
  not the live `demand.md`. ✅ (Step 2)
- AC#4 — `bun run check` green. ✅ The live cast (`vend steer` on this repo → a staged board + real
  forks) is the human verification at sweep — deferred to the human, per the ticket.
