# T-017-02 Plan — register-survey-and-gesture

Ordered, independently-verifiable steps. Each ends green-or-better; commits are atomic. The live
`vend survey` cast on this repo is the human verification at sweep (AC#4), not a CI step.

## Step 1 — `src/play/survey-effect.ts` (the addon-free staging effect)

Create the module per Structure: `SurveyInputs`, `BOARD_STEM`, `renderStagedBoard` (empty vs
non-empty branches), `surveyBoardEffect`. Reuse `STAGING_DIR` from `expand-effect.ts`.

- **Verify:** `bun run check:types` clean for the new module (no test yet). Eyeball: type-only BAML +
  engine imports, fs the only side effect.

## Step 2 — `src/play/survey-effect.test.ts` (AC#3 proof — green before the shell)

Create the offline test per Structure. Build `Board`s directly (a `mkSignal` helper like
expand-core.test's). Three groups: effect-stages-under-PM-desk (incl. the never-touch-board negative
assertions + the empty-board abstention), clear→classify wiring (ranked/empty/padded/ungrounded), and
the pure `renderStagedBoard`.

- **Verify:** `bun test src/play/survey-effect.test.ts` green. This proves project→staged-board end to
  end (the effect writes to staging, not `demand.md`) without a live model — AC#3.
- **Commit:** `feat(survey): board-staging effect + offline AC#3 proof (T-017-02)` — steps 1–2 together
  (the test pins the effect; they are one atomic unit).

## Step 3 — `src/play/survey.ts` (the registered play shell + cast)

Create per Structure: `parseSurvey` (try/catch → `EMPTY_BOARD`), `surveyPlay` (the six variation
points, generous budget + recalibration note), `registry.register`, `SurveyOptions`,
`assembleSurveyInputs`, `castSurvey`.

- **Verify:** `bun run check:types` clean. `bun test` full suite still green (registration adds a play
  to the singleton — confirm no duplicate-name throw and no other suite regresses). A quick registry
  smoke (the `survey` name resolves) is covered by the full suite loading the module via the CLI path
  — no new test file (the shell is impure/untested by house rule; its logic is the tested core +
  effect + bridge).
- **Commit:** `feat(survey): register surveyPlay + castSurvey shell (T-017-02)`.

## Step 4 — `src/cli.ts` + `src/cli.test.ts` (the `vend survey` gesture)

Edit `cli.ts`: `USAGE` line, `ParsedCommand` variant, `parseArgs` route, `parseSurveyArgs`, the
dispatch arm. Edit `cli.test.ts`: the `survey` parse block.

- **Verify:** `bun test src/cli.test.ts` green (the new parse pins + every existing pin unchanged).
- **Commit:** `feat(cli): vend survey gesture — parse + dispatch (T-017-02)`.

## Step 5 — full gate + progress

- **Verify:** `bun run check` (types + lint + the full test suite) green, zero regressions off the
  528-test baseline (now higher with the new pins). Record the count in `progress.md`.
- The live cast (`vend survey` on this repo → a staged board under `docs/active/pm/staged/`) is the
  human sweep step (AC#4) — note it as the deferred human verification, do not run it here.

## Testing strategy

- **Unit / pure:** `renderStagedBoard` (both branches), `parseSurvey`'s coercion is covered indirectly
  — the *parse-throws-on-bare-string* fact is already pinned in `survey.test.ts`; the catch's effect
  (empty board) flows into the clear→classify wiring test. `parseSurveyArgs` pinned in `cli.test.ts`.
- **Offline integration (AC#3):** `survey-effect.test.ts`'s effect + clear→classify groups ARE the
  project→staged-board proof without a model — the same seam `expand-effect.test.ts` proves.
- **No live-model test in CI:** the addon's one-call-per-process limit + the no-`bun test`-imports-
  `survey.ts` rule mean the live cast is proven at the human sweep, exactly as expand's was.
- **Verification criteria:** every AC box → a green assertion (registration + cast: step 3/full suite;
  gesture stages a board / honest-empty andon: `survey-effect.test.ts` + `cli.test.ts`; fixture proof
  to staging not demand.md: `survey-effect.test.ts`; `bun run check:*` green: step 5).

## Risks & mitigations

- **`STAGING_DIR` import couples survey-effect → expand-effect.** Accepted: it is a genuine shared
  contract (the same machine inbox), `expand-effect.ts` is addon-free so the import stays clean, and
  re-declaring would risk the two drifting. Documented in the module header.
- **Empty-board effect behavior.** The clear-then-materialize path runs the effect on an empty board;
  the abstention-note branch (D5) handles it and is unit-pinned, so an honest abstention leaves a
  legible artifact rather than an empty/`undefined` write.
- **Budget over-provisioned.** Intentional (D7) — a generous floor beats expand's indicted under-shot;
  the `// recalibrate from the log` note + the ledger (E-013) are the correction path.
