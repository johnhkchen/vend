# T-007-03 — Progress: register-decompose-epic-on-the-engine

Implement phase. All four plan steps executed; `tsc` clean, full suite green (252 pass /
0 fail), registration smoke confirms the play is wired. No deviations from the plan.

## Step 1 — Enrich `GateVerdict.clear` to preserve the four success rows ✓

- `src/engine/play.ts`: `GateVerdict` clear arm gains `cleared?: readonly string[]` +
  expanded doc-comment (the optional per-gate echo; opaque-by-default, names when a play
  has them).
- `src/engine/cast-core.ts`: `castGateRows` clear branch →
  `(g.cleared ?? []).map((gate) => ({ gate, passed: true }))` + doc-comment.
- `src/engine/cast-core.test.ts`: added `clearedNamed` fixture and two assertions
  (`castGateRows` → four passed rows; `classify` puts them in `gateLog`). Existing
  bare-`{status:"clear"}` cases retained — they prove the `[]` default survives.
- **Verify**: `bun test src/engine/` → 21 pass; `tsc` clean. Behaviour-neutral on its own.

## Step 2 — DecomposeEpic becomes a registry entry; runner is `castPlay` over it ✓

- `src/play/decompose-epic.ts` rewritten:
  - import block swapped to engine + gate + project-context + materialize + baml; dropped
    the seam / budget / run-log / `*-core` / `node:fs` imports and the dead
    `export * from "./decompose-epic-core.ts"`.
  - `decomposeEffect` (materialize + lisaValidate; `IdCollisionError` → `id-collision`
    relabel as data; else throw) — a faithful re-encoding of the welded block (D4).
  - `decomposeEpicPlay: Play<DecomposeInputs, WorkPlan>` — render (`b.request` →
    `extractPromptText`), parse (`b.parse`), gates (`clear`), effect, budget (2h/50k
    high-tier default, inlined to avoid a play→shelf cycle), card (Azorius WU mythic
    permanent).
  - `registry.register(decomposeEpicPlay)` at module load (self-registration side-effect).
  - `assembleAndCast(play, opts)` — the single play-specific assembly site
    (`assembleInputs` + `epicIdOf` → `castPlay`), shared by the runner and the dispatcher.
  - `runDecomposeEpic(opts)` = `assembleAndCast(decomposeEpicPlay, opts)` (AC#2).
  - kept `PLAY`, `RunOptions`, `lisaValidate`, `epicIdOf`; `RunSummary` re-exported from
    `../engine/cast.ts` (so `press-core.ts` / `press.ts` still resolve it here); removed
    `stopReason` (the cast loop owns the andon line now).
- `src/play/dispatch.ts` (new): `runPlay(name, opts)` → `registry.get` →
  `assembleAndCast` or `{kind:"no-play", error}`.
- **Verify**: `tsc` clean (the play typechecks as `Play<DecomposeInputs, WorkPlan>`;
  `clear()`'s `GateResult` assigns into `Play.gates`; `decomposeEffect` is an
  `EffectResult`); `decompose-epic.test.ts` / `press-core.test.ts` green unchanged.

## Step 3 — Route both dispatch sites by name (AC#3) ✓

- `src/cli.ts`: `ParsedCommand.run.play` widened to `string`; `parseRunArgs` drops the
  `decompose-epic` literal guard (captures any non-flag token; `missing <play>` when
  absent); `USAGE` → `vend run <play> <epic.md> --budget <ms>,<tokens>`; run-arm shell
  lazy-imports `runPlay`, mapping `no-play` → stderr + exit 2.
- `src/shelf/press.ts`: imports `runPlay` (+ `type RunSummary` from `decompose-epic.ts`);
  loop dispatches the constant `"decompose-epic"` through `runPlay`, throwing on the
  impossible `no-play` (a wiring bug). Header comment refreshed. `press-core.ts` untouched.
- `src/cli.test.ts`: added the generic-play-name parse case + a `missing <play>` case;
  tightened the `run summon` assertion to the now-exact `missing <epic.md>`. All prior
  assertions still hold.
- **Verify**: `bun test src/cli.test.ts src/shelf/` green; `tsc` clean.

## Step 4 — End-to-end verification ✓

- `bun run build` (tsc --noEmit): clean.
- `bun test` (whole suite): **252 pass / 0 fail / 453 expect()** across 17 files (was 248;
  +2 cast-core, +2 cli). AC#4 — every prior test green unchanged.
- **Registration smoke** (plain `bun -e`, no addon limit): `registry.names()` →
  `["decompose-epic"]`; `get("decompose-epic").found === true` with
  `card = {color:["blue","white"], type:"permanent", rarity:"mythic"}` and
  `budget = {timeMs:7200000, tokens:50000}`; `get("propose-epic")` →
  `found:false`, message `play "propose-epic" is not registered — available: decompose-epic`.
- `lint`: no `lint` script defined in `package.json` (a CLAUDE.md *intended* convention,
  not yet wired); `bun run check` covers baml:gen + typecheck + test.

## Deviations

None. The plan held end to end.

## Notes for Review

- The only behavioural delta vs. the welded runner is **cosmetic stdout**: the cast loop
  prints `· effect ✓ lisa validate ✓` / `· effect ✗ id-collision — …` where the welded
  runner printed `· lisa validate ✓` / `· andon: id-collision — …`. The `detail` carries the
  same information; the run-log record (outcome, gate rows, materialized) is byte-identical.
- `runDecomposeEpic` is now only referenced as the AC#2 artifact (CLI + press route via
  `runPlay`). It is a live, exported entry — kept deliberately as the canonical direct cast.
- Git commits / phase transitions are left to the lisa workflow (per the run instruction);
  the working tree carries the implementation + artifacts for Lisa to serialize.
