# T-018-02 Review — register-steer-and-gesture

Handoff document. What changed, test coverage, open concerns. The headline: the SteerProject-lite
pure core (T-018-01) is now a registered, castable play — `vend steer` reads the whole project and
stages a steer (the ranked board AND the real forks) under the PM desk for human assent. Sixth
registry entry; the demand-extraction capstone one rung above Survey.

## What changed

### New files
- **`src/play/steer-effect.ts`** (≈135 lines) — addon-free, impure staging effect. `SteerInputs`,
  `STEER_STEM = "steer"`, pure `renderStagedSteer` (three branches — fully-empty abstention / board
  half / forks half-or-clear-path-note), `steerEffect` (writes `docs/active/pm/staged/steer.md`).
  Reuses `renderBoard` (survey-core), `renderForks` (steer-core), `STAGING_DIR` (expand-effect).
- **`src/play/steer.ts`** (≈130 lines) — BAML-loading registered play. `PLAY`, `parseSteer` (no
  try/catch — the two-array SAP degrade), `steerProjectPlay` (registered at load), `SteerOptions`,
  `assembleSteerInputs`, `castSteer`.
- **`src/play/steer-effect.test.ts`** (≈190 lines) — the AC#3 offline proof (10 tests).

### Modified files
- **`src/cli.ts`** — `USAGE` line, `ParsedCommand` steer arm, `parseArgs` route, `parseSteerArgs`
  (flags-only), dispatch arm (lazy import + cast + exit).
- **`src/cli.test.ts`** — 4 steer parse tests (mirror the survey block).

### Unchanged (consumed as-is)
The engine seam (`castPlay`, `Play`, `CastContext`, `EffectResult`, `registry`), the BAML
(`steer.baml` + generated `Steer`/`Fork`), the pure core (`steer-core.ts`) and bridge
(`steer-bridge.ts` + `steer.test.ts`) — all from T-018-01. No engine, no BAML changes.

## Test coverage

- **Full gate:** `bun run check` (baml:gen + tsc + bun test) → **576 pass / 0 fail** (562 T-018-01
  baseline + 10 steer-effect + 4 cli parse). Typecheck clean. No `baml_client` churn.
- **The steer surface is covered at three layers** (the house split):
  1. **Pure gates + renderers** — `steer-core.test.ts` (17 tests, T-018-01): clear/each-stop,
     every fork-genuineness arm, leverage-rank, `renderFork`/`renderForks`.
  2. **BAML render/parse** — `../baml/steer.test.ts` (T-018-01): the canned-reply parse, the
     two-array SAP-degrade pin (both garbage shapes → empty steer, no throw), the render pin.
  3. **Effect + cast wiring** — `steer-effect.test.ts` (NEW): the effect stages board+forks under
     the PM desk and writes nothing to the live board; the board-only and fully-empty branches; the
     clear→classify outcomes (materialize / read-never-invent gate-fail / fork-genuineness gate-fail).
  4. **Parser** — `cli.test.ts` (NEW steer block): no-budget / override / bad-positional / malformed
     budget.

### Coverage gaps (by design)
- **No automated live-cast test.** `castSteer` (and `assembleSteerInputs`) are the impure verbs and
  are NOT unit-tested — their logic is the engine's already-tested `castPlay` core plus thin fs
  reads, exactly as `castSurvey` is untested. The live `vend steer` on this repo → a staged board +
  real forks is the **human verification at sweep** (AC#4 says so explicitly): a real model call is
  non-deterministic and spends budget, so the offline fixture is the CI gate, not a live call.
- `steer.ts` is intentionally NOT value-imported by any `bun test` file (it loads the BAML addon,
  whose once-per-process reactor makes a test flaky). The registry-registration smoke was run
  manually (`bun -e import(...)` → `registered: steer`), not as a bun test, for that reason.

## Open concerns for the human reviewer

1. **Budget is a cold-start FLOOR, not measured.** `{ timeMs: 2_400_000, tokens: 400_000 }` (40 min
   / 400k) is a reasoned floor above Survey's held 300k (the ticket forbids copying 300k — steer
   does more). It has **never been run live**. Heed E-016 (expand under-shot: 100k ceiling, 211k
   spent). The first live `vend steer` is the calibration data point — recalibrate from the log
   (E-013) at sweep. This is the single highest-uncertainty number in the change.
2. **`srcFiles: []` in the snapshot.** Steer's assembly mirrors Survey — it reads board state, not
   the `src/**` tree. The forks are steered off the same demand gradient, and the model reads files
   agentically during the live cast, so the thin snapshot is intentional. If the live steer surfaces
   *shallow* forks (not grounded in the code), revisit whether the snapshot should carry more.
3. **`renderBoard({ signals: steer.signals })`** passes an explicit Board view of the steer's board
   half. It typechecks (Steer's `signals` IS `Board.signals`) and keeps the staged board
   byte-identical to a Survey board. A reviewer who prefers `renderSignalRow`-mapping directly should
   note both produce the same bytes; the reuse is deliberate (one shared row contract).
4. **Commits not yet made.** The working tree holds all changes; atomic commit boundaries are in
   `plan.md`. Sweep should commit (and is also where the live cast + budget recalibration happen).
5. **Card parity over fine-tuning.** The card is Survey's (`["blue","green"]` permanent rare) — the
   new fork-genuineness gate arguably adds a White (order) facet, but parity with Survey was chosen
   deliberately. Cosmetic; flag only if the shelf ranking cares.

## Verdict

AC#1–AC#3 met and proven offline; AC#4's gate is green with the live cast correctly deferred to the
human sweep. The change is a faithful one-rung-up mirror of the Survey play with the forks threaded
through the effect and the staged artifact. The one thing to watch is the unproven budget (concern
#1) — everything else is covered by the three-layer test discipline.
