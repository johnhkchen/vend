# T-007-03 — Research: register-decompose-epic-on-the-engine

Map the territory for making `DecomposeEpic` the *first* registry entry and routing
the existing runner + both dispatch sites through the generic engine (E-007). This is
the convergence ticket of S-007-01: T-007-01 built the `Play<I,O>` contract + registry,
T-007-02 built the generic `castPlay` loop, and this welds the real play onto them with
**no behaviour change**. Descriptive only — options and decisions are Design's job.

## The thing being replaced: the welded runner

`src/play/decompose-epic.ts` (`runDecomposeEpic`, 216 lines) is the hardcoded play. Its
orchestration is the exact spine `castPlay` already re-implements generically:

1. `assembleInputs({epicPath, projectRoot})` → `{epic, charter, project}` (impure: reads
   the epic + charter files, walks `src/`, lists board ids). `epicIdOf(epic, epicPath)`
   greps `id:` from frontmatter, else the basename → the run-log `epic` field.
2. **render**: `b.request.DecomposeEpic(epic, charter, project)` → `extractPromptText(req)`
   (BAML in-process; `extractPromptText` lives in `src/baml/decompose-bridge.ts`).
3. transcript + two-surface stream sink → `dispense({prompt, model, onMessage, timeoutMs})`.
4. **meter**: `check(budget, result.usage)`; on `ok`, **parse**: `b.parse.DecomposeEpic(text)`
   → `WorkPlan`; **gate**: `clear(plan, {epic, charter})` → `GateResult`.
5. `classify({timedOut, budgetOutcome, gateResult})` → outcome + materialize decision.
6. on materialize: `materialize(plan, {storiesDir, ticketsDir})` then `lisaValidate(root)`;
   catch `IdCollisionError` → relabel outcome `id-collision`; any other throw re-raised.
7. `appendRunLog({runId, play: PLAY, epic: epicId, model, outcome, usage, costUsd,
   gateResults: verdict.gateLog, startedAt, endedAt})`.

The six per-play variation points (render / parse / gates / effect / budget / card) are
exactly what `Play<I,O>` factors out; steps 3–5, 7 and the transcript are the fixed spine
`castPlay` owns. `runDecomposeEpic`'s pure judgment lives in `decompose-epic-core.ts`
(`classify`, `gateRowsFor`, `formatMessage`, `makeStreamSink`, `resolveLoggedModel`,
`DEFAULT_MODEL`) and is re-exported via `export * from "./decompose-epic-core.ts"`.

## The engine surface this ticket consumes

- `src/engine/play.ts` — `Play<I,O>` (`name`, `render`, `parse`, `gates`, `effect`,
  `budget`, `card`), `CastContext<I>` (`{inputs, projectRoot}`), `GateVerdict`
  (`{status:"clear"}` | `{status:"stop", gate:string, unit, reason}`), `EffectResult`
  (`{ok, outcome?, detail?, artifacts?}`), `Card`/`Color`/`CardType`/`Rarity`, the
  `PlayRegistry` class + `registry` singleton, `PlayNotFoundError`/`DuplicatePlayError`,
  `PlayLookup` (`{found:true, play}` | `{found:false, error}`).
- `src/engine/cast.ts` — `castPlay<I,O>(play, inputs, budget, opts)` → `RunSummary`
  (`{runId, outcome, materialized}`). `CastOptions` = `{subject, projectRoot?, model?,
  runId?, transcriptDir?, runLogPath?}`. `subject` populates the log's `epic` field.
  Re-exports `cast-core.ts`.
- `src/engine/cast-core.ts` — pure: `classify`, `castGateRows`, the stream sink, the
  model resolver. **The engine imports NO `src/play/`** — that acyclicity is the whole
  point (a concrete play depends UP onto the engine).

### Structural assignability already engineered in

`gates.ts` `clear()` returns `GateResult = GateClear | GateStop` where
`GateClear = {status:"clear", cleared: readonly GateName[]}` and `GateStop.gate: GateName`.
`GateName ⊂ string`, and a value with extra props is assignable to a narrower shape, so
**`GateResult` is structurally assignable to `GateVerdict`** (T-007-01 D2 designed this).
DecomposeEpic's `clear(...)` therefore drops into `Play.gates` with zero adaptation.

### One run-log delta the generic path introduces

The welded runner logs `gateResults` on SUCCESS as **four passed rows** (`gateRowsFor`
reads `GateClear.cleared`). `castGateRows` (cast-core) returns `[]` on clear, because the
generic `GateVerdict.clear` is **opaque** — it carries no gate names. So routing
DecomposeEpic through `castPlay` unchanged would change a successful run's ledger row from
four passed gates to none. T-007-02 design (D3) flagged this precisely and pre-authorized
the fix: *"T-007-03 can enrich `GateVerdict.clear` to carry `cleared` and `castGateRows`
reads it — a one-line change."* The cast-core/play tests use bare `{status:"clear"}`
fixtures, so an **optional** `cleared` field leaves them green.

## The effect: what `materialize` + `lisaValidate` need

`materialize(plan, {storiesDir, ticketsDir})` (impure) runs the cross-board collision
guard FIRST (`listIdsIn` + `detectCollisions`), throwing `IdCollisionError` BEFORE any
write, then writes story/ticket files; returns `{storyFiles, ticketFiles}`. `lisaValidate(
root)` spawns `lisa validate --path root`, tolerating an absent binary (`{ok:false,
output}`), never throwing. The welded runner sets `materialized = validated.ok` and leaves
the outcome `success` even when validate fails (only `IdCollisionError` relabels). The
effect must reproduce this exactly: try `materialize` + `lisaValidate`, return `{ok:
validated.ok, …}`; catch `IdCollisionError` → `{ok:false, outcome:"id-collision", detail}`;
re-throw anything else. `ctx.projectRoot` composes the two dirs (`docs/active/stories|
tickets`) and the validate root.

## Inputs, budget, card — the play's data

- `I = DecomposeInputs` (`{epic, charter, project}`, from `project-context.ts`); `O =
  WorkPlan` (BAML). `gates` reads `ctx.inputs.epic`/`.charter`; `render` reads all three.
- **Input assembly is play-specific and lives OUTSIDE the `Play`** by T-007-01 design
  (`render` takes already-assembled `I`, not a path). For DecomposeEpic the assembler is
  `assembleInputs` + `epicIdOf`. There is exactly ONE assembly shape today.
- **budget**: `Play.budget` is the default mana cost. Both dispatch sites already supply an
  explicit budget (CLI `--budget` required; press `action.budget = budgetForTier(tier)`
  from `gather.ts`), so the default is a fallback. `TIER_BUDGET` (gather.ts) lives in the
  *shelf*; the play must not import it (would cycle: press → play). Tiers: high = `2h/50k`.
- **card**: `play.ts` doc + `play.test.ts` stub both model decompose-epic as
  `{color:["blue","white"], type:"permanent", rarity:"mythic"}` (Azorius WU permanent,
  keystone). The ticket calls it "Blue Permanent" (dominant colour shorthand).

## The two dispatch sites (AC#3)

- **CLI** (`src/cli.ts`): `parseArgs` → `parseRunArgs` hardcodes `argv[1] !== "decompose-
  epic"`; `ParsedCommand.run.play` is the literal `"decompose-epic"`. The `import.meta.main`
  shell lazy-imports `runDecomposeEpic` and calls it. The parsers are PURE + unit-tested
  (`cli.test.ts` imports only `cli.ts`, never the runner → no BAML).
- **Press** (`src/shelf/press.ts`): `pressShelf` loops `planRuns(...)` and calls
  `runDecomposeEpic({epicPath, budget, projectRoot})` per pick. It value-imports
  `runDecomposeEpic` (BAML). The pure core `press-core.ts` imports `type RunSummary` from
  `decompose-epic.ts` (erased) and is fully unit-tested. `MenuCache.Action` carries **no
  play name** — every board epic is implicitly decompose-epic; adding a play field would
  bump `MENU_CACHE_VERSION` and break `gather.test.ts` (out of scope).

## Constraints

- **Acyclic deps**: engine must not import `src/play/`. Play → engine is the allowed edge.
  A new dispatcher importing the play (for registration) must not be imported back by it.
- **BAML one-call-per-`bun test` limit** (memory 20213): any test that value-imports
  `decompose-epic.ts` loads the addon and risks flakiness. Existing tests avoid it by
  importing `*-core.ts` modules. New tests for this ticket must stay addon-free (parsers,
  pure cast-core), and the live wiring is proven by smoke (the T-002-04 / T-007-02 stance).
- `verbatimModuleSyntax` (type-only imports must say `type`), `noUncheckedIndexedAccess`,
  `strict`. No `noUnusedLocals` in tsconfig, but the lint gate may flag dead imports.
- **AC#4 — existing tests pass unchanged**: `cli.test.ts`, `press-core.test.ts`,
  `cast-core.test.ts`, `play.test.ts`, `decompose-epic.test.ts`, `gather.test.ts` must all
  stay green. `press-core.ts` imports `RunSummary` from `decompose-epic.ts`, so that type
  must remain exported from there.

## Open questions carried into Design

1. Where does name-based dispatch live so both CLI + press share it without a cycle?
2. Does `runDecomposeEpic` survive (AC#2 names it) or get replaced?
3. Enrich `GateVerdict.clear` to preserve the four success rows, or accept `[]`?
4. How is the constant play name ("decompose-epic") sourced at the press without a menu
   schema change?
