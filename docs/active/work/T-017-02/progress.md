# T-017-02 Progress — register-survey-and-gesture

All plan steps complete. `bun run check` green (baml:gen + typecheck + **541 tests**, up from the
528-test baseline; +13 new pins). Three commits on `main`, one per atomic unit.

## Step-by-step

### Step 1–2 — `survey-effect.ts` + `survey-effect.test.ts` ✅ (commit 1)
- Created `src/play/survey-effect.ts`: `SurveyInputs`, `BOARD_STEM = "survey-board"`,
  `renderStagedBoard` (empty-vs-non-empty branch, D5), `surveyBoardEffect`. Addon-free (type-only BAML
  + engine imports; reuses `STAGING_DIR` from `expand-effect.ts`, itself addon-free).
- Created `src/play/survey-effect.test.ts`: 9 tests across three groups — effect stages under the PM
  desk (incl. the never-touch-board negatives + the empty-board abstention), clear→classify wiring
  (ranked/empty/padded/ungrounded), and the pure `renderStagedBoard`. This IS the AC#3 offline proof.
- **Deviation:** the empty-board assertion initially looked for `"no demand gradient"`; the rendered
  copy reads `"no real demand gradient"`. Fixed the assertion to the actual text (a test typo, not a
  code change). `bun test src/play/survey-effect.test.ts` → 9 pass.
- Commit: `feat(survey): board-staging effect + offline AC#3 proof (T-017-02)`.

### Step 3 — `survey.ts` (registered shell) ✅ (commit 2)
- Created `src/play/survey.ts`: `parseSurvey` (try/catch → `EMPTY_BOARD`, the D3 hybrid-degrade fix),
  `surveyPlay: Play<SurveyInputs, Board>` (the six variation points; `gates: (board) => clear(board)`
  ignores ctx per D2; budget `{1_800_000, 300_000}` generous + the recalibrate-from-the-log note per
  D7; Blue/Green rare permanent card), `registry.register(surveyPlay)`, `SurveyOptions`,
  `assembleSurveyInputs` (IMPURE), `castSurvey` (synthesized `survey of <project>` subject per D8).
- `bun run check:typecheck` clean; full `bun test` → 537 pass (registration adds no regression; no
  duplicate-name throw). No new test file — the shell is impure/untested by house rule (its logic is
  the tested core + effect + the survey.test.ts bridge).
- Commit: `feat(survey): register surveyPlay + castSurvey shell (T-017-02)`.

### Step 4 — `cli.ts` + `cli.test.ts` (the gesture) ✅ (commit 3)
- `cli.ts`: added the `USAGE` line, the `{cmd:"survey", budget?}` `ParsedCommand` variant, the
  `parseArgs` route, `parseSurveyArgs` (flags-only per D6 — no positional subject; an unexpected
  positional → usage), and the dispatch arm (lazy-import `castSurvey`/`surveyPlay`, default budget to
  the play envelope, print + exit 0/1 — the expand-arm shape).
- `cli.test.ts`: 5 new `survey` parse pins (no-budget, `--budget` override, unexpected positional,
  malformed/dangling `--budget`). `bun test src/cli.test.ts` → 57 pass.
- Commit: `feat(cli): vend survey gesture — parse + dispatch (T-017-02)`.

### Step 5 — full gate ✅
- `bun run check` → exit 0; 541 tests pass, typecheck clean, baml client regenerates clean.

## Deviations from plan
- One only: the step-2 empty-board assertion text fix noted above (assertion ↔ copy mismatch, corrected
  before the first commit). No structural or design deviations; the three-file trio, the gates-ignore-
  ctx closure, the hybrid-degrade catch, the one-fixed-board-file effect, and the flags-only gesture all
  landed as designed.

## Deferred (the human sweep — AC#4)
- The live `vend survey` cast on this repo → a staged board under `docs/active/pm/staged/survey-board.md`
  is the human verification step. Not run here (the addon's one-call-per-process limit + the
  no-`bun test`-imports-`survey.ts` rule mean the live cast is proven at sweep, exactly as expand's was).
  The generous project-scale budget is a floor to recalibrate from that run's logged actuals (E-013).
