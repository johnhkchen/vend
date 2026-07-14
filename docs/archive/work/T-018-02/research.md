# T-018-02 Research — register-steer-and-gesture

Descriptive map of the code this ticket touches. T-018-02 wires the pure core shipped in
T-018-01 (`steer-core.ts`, `steer-bridge.ts`, `baml_src/steer.baml`) into a **registered,
castable play** with a `vend steer` gesture that reads the whole project and **stages a
steer** — the ranked board **and** the real forks — under the PM desk. This is the sixth
registry entry of the casting engine and the demand-extraction capstone one scale above
Survey.

## What already exists (T-018-01, done)

- **`baml_src/steer.baml`** — defines `Fork` (question · options · whyItMatters ·
  recommendation), `Steer` (`signals Signal[]` reusing E-016's Signal + `forks Fork[]`),
  and `function SteerProject(project, charter) -> Steer`. Authoring-only (`ClaudeStub`).
  `baml:gen` has emitted `Steer`/`Fork` into `baml_client`. An **all-array class with two
  array fields** → the WorkPlan SAP-degrade pattern (see below).
- **`src/play/steer-core.ts`** — PURE. Exports `clear(steer): GateVerdict` (the three gates
  read-never-invent → fork-genuineness → leverage-rank), `STEER_GATE_NAMES`, `MIN/MAX_FORK_OPTIONS`,
  and the pure renderers `renderFork(fork)` / `renderForks(forks)`. Imports `renderSignalRow`
  (expand-core) and `TIER_RANK` (survey-core) as genuine shared contracts; addon-free.
- **`src/play/steer-core.test.ts`** — 17 pure tests: clear (board+fork, empty steer, board-only),
  every fork-genuineness arm, leverage-rank, the renderers.
- **`src/baml/steer-bridge.ts`** + **`src/baml/steer.test.ts`** — the offline render/parse
  pins via a child-`bun` subprocess. Pins the **two-array SAP degrade**: BOTH an object-shaped
  reply lacking the fields AND a bare unstructured string degrade to `{signals:[], forks:[]}`;
  **neither throws** (the divergence from Survey's single-field `Board`, which throws on a bare
  string — obs 21370–21372, 21381).

## The mirror target — Survey (T-017-02, the immediate precedent)

The register/effect/gesture trio to copy, one rung down (board only, no forks):

- **`src/play/survey.ts`** — the registered play. Owns: `PLAY = "survey"`; `parseSurvey`
  (b.parse made total with a `try/catch` → `EMPTY_BOARD`); `surveyPlay: Play<SurveyInputs, Board>`
  (render via `extractPromptText(b.request.Survey(...))`, parse, `gates: (board) => clear(board)`,
  `effect: surveyBoardEffect`, `budget: {timeMs: 1_800_000, tokens: 300_000}`, blue/green
  permanent rare card); `registry.register(surveyPlay)` at module load; `SurveyOptions`;
  `assembleSurveyInputs` (impure — reads charter + lists stories/tickets, `buildProjectSnapshot`
  with `srcFiles: []`); `castSurvey` (impure — `castPlay` over the play, subject `survey of <root>`).
- **`src/play/survey-effect.ts`** — the addon-free staging effect. `SurveyInputs {project, charter}`,
  `BOARD_STEM = "survey-board"`, `renderStagedBoard(board)` (empty → abstention note; non-empty →
  heading + demand table + `## Pull these` block), `surveyBoardEffect(board, ctx)` (mkdir + write
  to `docs/active/pm/staged/survey-board.md`, returns `EffectResult` with `artifacts`/`produced`).
  Imports `renderBoard` (survey-core) + `STAGING_DIR` (expand-effect). No BAML, no spawn.
- **`src/play/survey-effect.test.ts`** — the AC#3 analogue: the effect stages under the PM desk,
  writes nothing to `demand.md`/board, the empty-board abstention case, and the clear→classify
  wiring (grounded board materializes; padded/ungrounded → gate-failed, nothing staged).

## The engine seam (unchanged, consumed as-is)

- **`src/engine/play.ts`** — `Play<I,O>` (render/parse/gates/effect/budget/maxTurns?/card),
  `GateVerdict`, `CastContext<I> {inputs, projectRoot}`, `EffectResult {ok, outcome?, detail?,
  artifacts?, produced?}`, `Card`, and the singleton `registry`. `steer-core.clear` already
  returns the engine's play-agnostic `GateVerdict`, so it drops into `Play.gates` with no adapter.
- **`src/engine/cast.ts`** — `castPlay(play, inputs, budget, opts)`: render → dispense (seam,
  wall-clock latch) → meter (`check`) → parse → gates (unless `skipGates`) → `classify` → on a
  CLEAR verdict run `effect` → `appendRunLog`. Returns `RunSummary {runId, outcome, materialized,
  produced?}`. `CastOptions {subject, projectRoot?, project?, model?, maxTurns?, runId?,
  transcriptDir?, runLogPath?, intervened?, skipGates?}`.

## The gesture surface — `src/cli.ts`

- `USAGE` banner lists each gesture (`run`/`chain`/`expand`/`survey`/`envelope`/`audit`).
- `ParsedCommand` is a discriminated union; `survey` is `{cmd:"survey"; budget?}`.
- `parseArgs` routes `argv[0]`; `parseSurveyArgs` is **flags-only** (no positional subject —
  reading the whole project IS the gesture; any positional token → usage error).
- The `import.meta.main` dispatch: each arm lazy-imports its play (keeps the BAML addon off the
  pure-parse path), resolves `budget ?? play.budget`, casts, prints `run <id>: <outcome>
  (materialized: …)`, exits non-zero on a non-success outcome.
- **`src/cli.test.ts`** — pure parser tests; the survey block (lines 174–190) is the template
  for the steer parse tests.

## Context assembly — `src/play/project-context.ts`

`buildProjectSnapshot(parts)` (PURE, deterministic sorted listing), `listIdsIn(dir)` (lists
`*.md` ids, tolerates missing dir), `CHARTER_PATH = "docs/knowledge/charter.md"`. Survey's
`assembleSurveyInputs` reuses these with `srcFiles: []` (a board-state read, not a src walk).

## The staging contract — `docs/active/pm/`

`docs/active/pm/README.md`: the **upstream, un-promoted** PM desk. `STAGING_DIR =
"docs/active/pm/staged"` (expand-effect, the machine inbox, distinct from the hand-authored
`proposed-batch.md`). A play writes ONLY here — never `demand.md`, `epic/`, `stories/`,
`tickets/`. Promotion is the separate human gesture `vend chain "<signal>"`.

## Constraints & assumptions surfaced

1. **No try/catch in parse.** Steer is two-array → SAP degrades both garbage shapes to an empty
   steer and never throws (steer.test.ts pins this). So `parseSteer` diverges from `parseSurvey`:
   no `EMPTY_STEER` coercion closure is needed. Documenting *why* matters (it reads as a missing
   safety net otherwise).
2. **The effect renders BOTH halves.** Unlike survey (board only), the steer effect composes the
   board (reusing `renderBoard`/`renderSignalRow`) AND the forks (reusing `renderForks`). The
   empty-steer abstention and the board-only case (no forks) both need legible output.
3. **Budget above Survey's 300k.** The heaviest read yet (board + forks). Pre-fill generously,
   leave a `recalibrate from the log (E-013)` note. Live cast at sweep is the calibration source.
4. **Purity discipline.** `steer.ts` value-imports `b` (addon) → no bun-test value-imports it.
   The effect (`steer-effect.ts`) is addon-free so `steer-effect.test.ts` runs as an ordinary
   temp-dir test (the survey-effect discipline). The board+fork render reuse stays addon-free.
5. **Files modify-collision:** T-018-02 edits `src/cli.ts` + `src/cli.test.ts` (shared with prior
   tickets) — serialized by Lisa's lock; `depends_on: [T-018-01]` already orders the cores.
