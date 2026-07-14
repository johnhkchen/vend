# T-018-02 Plan — register-steer-and-gesture

Ordered, independently-verifiable steps with a testing strategy. Each step is a clean atomic
commit. The sequence is bottom-up: the addon-free effect (with its offline proof) first, then the
BAML shell that imports it, then the gesture.

## Testing strategy

- **Unit (pure, addon-free):** `steer-effect.test.ts` proves the effect + `renderStagedSteer` and
  the clear→classify wiring on a real temp-dir root — the AC#3 end-to-end-without-a-model proof.
  This is the only new test file; the pure gates (`steer-core.test.ts`) and the BAML render/parse
  (`steer.test.ts`) already cover their halves from T-018-01.
- **Parser (pure):** `cli.test.ts` steer block proves `parseSteer*` arg handling.
- **No new live/integration test.** Per AC#4, the live cast (`vend steer` on this repo → a staged
  board + real forks) is the **human verification at sweep**, not an automated test (a real model
  call is non-deterministic and costs budget — the offline fixture is the CI gate).
- **Gate:** `bun run check:*` (typecheck + tests + lint/format) green at the end of every step that
  touches code, and as the final AC#4 gate.

## Step 1 — `src/play/steer-effect.ts`

Create the addon-free effect. `SteerInputs`, `STEER_STEM = "steer"`, `renderStagedSteer` (the three
branches: fully-empty abstention / board + `## Pull these` / `## Forks` or clear-path note),
`steerEffect` (mkdir + write to `docs/active/pm/staged/steer.md`, returns `EffectResult`). Reuse
`renderBoard` (survey-core), `renderForks` (steer-core), `STAGING_DIR` (expand-effect). Type-only
`Steer`/`Fork`, `CastContext`/`EffectResult`.

- **Verify:** `bun run check:typecheck` clean (the module compiles; addon-free).
- **Commit:** `feat(steer): board+forks staging effect (T-018-02)`.

## Step 2 — `src/play/steer-effect.test.ts`

Create the AC#3 proof (mirror `survey-effect.test.ts`). Lift `mkSignal`/`mkFork`/`mkSteer` from the
steer-core test. Assert: stages `steer.md` carrying the demand rows + a pull line per signal + the
fork block; writes nothing to `demand.md`/board; the board-only case stages the clear-path note; the
fully-empty steer stages the abstention; clear→classify (grounded board+fork materializes,
ungrounded → read-never-invent gate-failed, manufactured fork → fork-genuineness gate-failed).

- **Verify:** `bun test src/play/steer-effect.test.ts` green; no addon loaded (runs as a plain unit
  test).
- **Commit:** `test(steer): offline AC#3 proof for board+forks staging (T-018-02)`.

## Step 3 — `src/play/steer.ts`

Create the registered play + cast verbs (mirror `survey.ts`). `PLAY`, `parseSteer` (NO try/catch —
doc-comment the two-array degrade), `steerProjectPlay` (render/parse/gates/effect/budget/card),
`registry.register(steerProjectPlay)`, `SteerOptions`, `assembleSteerInputs` (charter + ids +
`buildProjectSnapshot` with `srcFiles: []`), `castSteer` (subject `steer of <root>`). Budget
`{ timeMs: 2_400_000, tokens: 400_000 }` with the recalibrate note.

- **Verify:** `bun run check:typecheck` clean (`steerProjectPlay` satisfies `Play<SteerInputs,
  Steer>`; `clear`/`steerEffect` drop into the contract). Confirm the registry has no duplicate-name
  throw (a fresh name).
- **Commit:** `feat(steer): register steerProjectPlay + castSteer shell (T-018-02)`.

## Step 4 — `src/cli.ts` (gesture)

Add the `USAGE` line, the `ParsedCommand` steer arm, the `parseArgs` route, `parseSteerArgs`
(flags-only, copy of `parseSurveyArgs`), and the dispatch arm (lazy import, `budget ??
steerProjectPlay.budget`, cast, print, exit). 

- **Verify:** `bun run check:typecheck` clean; `bun run build` (typecheck + bundle) clean.
- **Commit:** `feat(cli): vend steer gesture — parse + dispatch (T-018-02)`.

## Step 5 — `src/cli.test.ts` (parse tests)

Add the steer parse block mirroring the survey block: no-budget, `--budget` override, unexpected
positional → usage, malformed/dangling `--budget` → usage.

- **Verify:** `bun test src/cli.test.ts` green.
- **Commit:** folded into Step 4's commit if sequential, or its own `test(cli): vend steer parse
  cases (T-018-02)`.

## Step 6 — full gate + progress

Run `bun run check:*` (or the project's `check:typecheck` + `bun test` + `bun run lint`). Confirm
zero regressions against the T-018-01 baseline (562 tests). Write `progress.md`.

- **Verify:** all checks green; test count = prior baseline + the new steer-effect tests + the new
  cli parse tests.
- **Commit:** `chore(steer): T-018-02 gate green + progress (T-018-02)` if any residual changes.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `renderBoard({ signals })` — passing a Board view of a Steer mis-types | Steer's `signals` is `Signal[]`; `{ signals }` is exactly `Board`. Typecheck catches a mismatch at Step 1. |
| Forgetting the no-catch rationale reads as a missing safety net | `parseSteer` doc-comment states the two-array SAP-degrade pin explicitly (D2). |
| Budget too low (E-016 under-shoot repeat) | Pre-filled at 400k (above survey's held 300k) with a recalibrate note; live sweep recalibrates from the log. |
| CLI shared-file lock contention with sibling tickets | `depends_on: [T-018-01]` orders the cores; Lisa's file lock serializes the `cli.ts` edit. |
| Duplicate registry name | `PLAY = "steer"` is new (registry has decompose-epic/propose-epic/capture-note/expand-fragment/survey); `register` throws on a dup — caught at first import in any test. |
| Empty `## Pull these` heading on a forks-only-but-no-board steer | A steer with forks but no signals is possible; the non-empty branch must guard the board half independently from the fork half (render the table only when `signals.length`). Handled in `renderStagedSteer` branch logic. |

## Definition of done (AC trace)

- AC#1 — `steerProjectPlay` registered with the generous budget; `castSteer` casts via `castPlay`. (Steps 3)
- AC#2 — `vend steer` stages board+forks on success; a refusal halts as `gate-failed`, nothing staged. (Steps 1, 4; proven in Step 2)
- AC#3 — `steer-effect.test.ts` proves project→staged steer offline; staging not the live board. (Step 2)
- AC#4 — `bun run check:*` green; live cast is the human sweep. (Step 6)
