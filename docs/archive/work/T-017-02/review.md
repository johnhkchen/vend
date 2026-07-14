# T-017-02 Review — register-survey-and-gesture

The handoff doc. What changed, test coverage, open concerns. The Survey pure core (T-017-01) is now
wired into a registered, castable play with a `vend survey` gesture and a board-staging effect — the
fifth registry entry, the demand-extraction primitive one scale above ExpandFragment.

## What changed

### Created
- **`src/play/survey-effect.ts`** (125 lines) — addon-free, impure (fs only). `SurveyInputs`
  (`{project, charter}`), `BOARD_STEM = "survey-board"`, `renderStagedBoard(board)` (pure; empty →
  honest-abstention note, non-empty → `# Survey` heading + demand table header + `renderBoard` rows + a
  `## Pull these` block of per-signal `vend chain` gestures + origin trailer), and `surveyBoardEffect`
  (mkdir + writeFile the fixed `survey-board.md`, returns `EffectResult`). Reuses `STAGING_DIR` from
  `expand-effect.ts`.
- **`src/play/survey.ts`** (154 lines) — the registered shell. `parseSurvey` (try/catch → `EMPTY_BOARD`),
  `surveyPlay: Play<SurveyInputs, Board>`, `registry.register`, `SurveyOptions`, `assembleSurveyInputs`
  (impure), `castSurvey`. The only module that value-imports the BAML addon.
- **`src/play/survey-effect.test.ts`** (176 lines) — the AC#3 offline proof (9 tests).

### Modified
- **`src/cli.ts`** — `USAGE` line, `{cmd:"survey", budget?}` variant, `parseArgs` route,
  `parseSurveyArgs` (flags-only), the dispatch arm (lazy-import + cast + print/exit).
- **`src/cli.test.ts`** — 5 `survey` parse pins.

### Not touched
- `survey-core.ts`, `survey.baml`, `survey-bridge.ts` (T-017-01, done — consumed as-is). The engine
  (`play.ts`/`cast.ts`) is unchanged — Survey plugs into the existing contract with no adapter.

3 commits (`7be08d7`, `6c20fe1`, `6cac617`), one per atomic step.

## Acceptance criteria — status

- **AC#1** `surveyPlay` registered with a generously pre-filled budget; `castSurvey` casts it ✅ —
  `registry.register(surveyPlay)` at module load; budget `{timeMs: 1_800_000, tokens: 300_000}` (a
  project-scale floor above expand's indicted 211k actual, with the recalibrate-from-the-log note).
  `castSurvey` routes through the shared `castPlay` (render → dispense → gates → effect → log).
- **AC#2** `vend survey` casts the play; success stages the ranked board; honest-empty / read-never-
  invent refusal halts with a clear andon, no fabricated board ✅ — the dispatch arm + the
  clear→classify wiring tests prove both branches (a padded/ungrounded board → `gate-failed`,
  `materialize:false`, nothing written).
- **AC#3** a fixture/canned-reply test proves project → staged board end to end; the effect writes to
  staging, not the live `demand.md` ✅ — `survey-effect.test.ts` stages to `docs/active/pm/staged/
  survey-board.md` on a temp root and asserts `demand.md`/`epic`/`stories`/`tickets` are NOT written.
- **AC#4** `bun run check:*` green ✅ (exit 0; 541 tests, typecheck clean). The live `vend survey` cast
  is the deferred human sweep step (by design — see below).

## Test coverage

- **Pure gates + renderer** — `survey-core.test.ts` (T-017-01, 12 tests): the three gates pass/stop +
  `renderBoard`. Unchanged.
- **Offline BAML** — `survey.test.ts` (T-017-01): parse round-trip, the hybrid SAP-degrade (object →
  empty, bare string → throw), render. Unchanged — and it explicitly pins the throw that `parseSurvey`'s
  catch now absorbs.
- **Effect + cast wiring (new)** — `survey-effect.test.ts` (9 tests): stages under the PM desk; never
  touches the board; empty-board abstention note; clear→classify for ranked/empty/padded/ungrounded;
  pure `renderStagedBoard` both branches. This is the project→staged-board proof without a model.
- **Gesture (new)** — `cli.test.ts` (5 survey pins): no-budget, `--budget` override, unexpected
  positional, malformed/dangling `--budget`.

### Coverage gaps (intentional, by house rule)
- `survey.ts`'s impure verbs (`assembleSurveyInputs`, `castSurvey`) and `render`/`parse` are NOT
  unit-tested — value-importing the shell loads the BAML addon, which the once-per-process limit forbids
  in `bun test`. Their logic is the engine's tested `castPlay` core + the pure core + the subprocess
  bridge. Same posture as `expand-fragment.ts` / `decompose-epic.ts`. The live cast is the proof.
- No live-model integration test in CI (same reason). Mitigated by the human sweep (AC#4).

## Open concerns / notes for the reviewer

1. **`STAGING_DIR` import couples `survey-effect.ts` → `expand-effect.ts`.** Deliberate (design D4): a
   genuine shared contract (the same machine inbox); re-declaring risks drift, and `expand-effect.ts` is
   addon-free so the import stays clean. If a third stager appears, consider lifting `STAGING_DIR` to a
   tiny shared constants module — but two consumers do not yet warrant it (the no-shared-util rule).
2. **Empty-board materializes a file.** An honestly-empty board CLEARS the gates, so the effect runs and
   writes an abstention note (design D5) — a deliberate divergence from "andon ⇒ nothing written" (that
   rule applies only to a STOP, i.e. a *padded/fabricated* board). The note leaves a legible trace of a
   successful abstention; verify this is the intended product behavior at sweep.
3. **Budget is a generous floor, not calibrated.** `{30 min, 300k tokens}` is above expand's observed
   211k; the real envelope comes from the first live runs (E-013 ledger / `vend envelope survey`). The
   `// recalibrate from the log` note flags this. Watch the first `vend survey` run's logged actuals.
4. **`survey-board.md` overwrites on every cast (idempotent).** Re-surveying replaces the prior draft —
   intended (a board has no DAG identity). A human who wants to keep a board must pull from it before
   re-surveying. Documented in the module header and the staged artifact is clearly un-promoted.

## Recommendation
Ready for the human sweep: run `vend survey` on this repo, confirm a ranked board lands under
`docs/active/pm/staged/survey-board.md`, and recalibrate the budget from the logged actuals.
