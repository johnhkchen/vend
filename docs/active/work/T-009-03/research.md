# T-009-03 — Research: register-and-cast-propose-epic

Descriptive map of the codebase as it bears on wiring `ProposeEpic` as a registered `Play`
and casting it through the shared `castPlay`. The pure judgment (gates, renderer, mint) and
the BAML authoring already exist; this ticket is the IMPURE shell that joins them — the third
play, completing the "three plays through one engine" proof (E-007's keystone, extended).

## What already exists (the two upstream tickets)

### T-009-01 — `ProposeEpic` BAML authoring (commit `dd5d66f`)
- `baml_src/propose.baml` declares `class EpicCard` + `function ProposeEpic(signal, charter,
  project) -> EpicCard` on the render-only `ClaudeStub`. `bun run baml:gen` emits `EpicCard`
  and the `CardColor`/`CardType`/`CardRarity` enums into the gitignored `baml_client/`, plus
  `b.{request,parse}.ProposeEpic`.
- `EpicCard` fields (the shape `b.parse` yields): `id, title, kind, advances[], serves,
  manaCost, color[], type, rarity, intent, value, doneLooksLike, context`. Enum-valued
  fields (`kind`/`type`/`rarity`) round-trip as MEMBER names — `b.parse` returns `"Permanent"`,
  `"Blue"`, `"Rare"` (the `@alias` maps the lowercase card token back to the member).
- `src/baml/propose-bridge.ts` + `src/baml/propose.test.ts` prove render/parse OFFLINE via a
  child-`bun` subprocess (the native-addon one-call-per-`bun test`-process limit). A key fact
  pinned there: **`b.parse.ProposeEpic` THROWS on a garbage reply** (EpicCard has required
  scalars — unlike DecomposeEpic's all-array `WorkPlan`, which degrades to empty). This mirrors
  `Note` and dictates a catching `parse` closure in this ticket's shell.

### T-009-02 — `ProposeEpic` pure core (commit `5d7cdae`)
`src/play/propose-core.ts` (addon-free; BAML/engine imports TYPE-ONLY) exports everything the
shell plugs into the engine:
- `clear(card: EpicCard, ctx: ProposeClearContext): GateVerdict` — the three PE gates in
  value-priority order (`value` → `bounds` → `structural`), andon on first failure, CLEAR
  echoes all three names. Returns the engine's play-agnostic `GateVerdict` directly (drops
  into `Play.gates` with zero adapter — the `clearNote` precedent).
- `ProposeClearContext = { charter: string; existingEpicIds: readonly string[] }` — what the
  gate needs beyond the card. `charter` is greped for live `P#`/`N#` ids (bounds);
  `existingEpicIds` is the structural gate's disjointness oracle.
- `renderCard(card: EpicCard): string` — the pure `E-0XX.md` markdown (frontmatter +
  stat-block + body), round-tripping every card field. Throws `RangeError` only on enum/alias
  drift. A freshly proposed card renders `status: open`.
- `nextEpicId(existing: readonly string[]): string` — the next free `E-0XX`, one past the
  numeric max, zero-padded; empty board → `E-001`; ignores non-epic ids. Exported expressly
  for this ticket's effect to mint with.
- `COLOR_ALIAS`/`CARD_TYPE_ALIAS`/`RARITY_ALIAS`, `PE_GATE_NAMES`.
- The one runtime import is `detectCollisions` from `./id-guard.ts` (the purest module in the
  tree). The module is otherwise PURE — **it holds NO effect** (the effect was explicitly
  deferred to this ticket).

`src/play/propose-core.test.ts` (18 pins) exercises every gate branch, the mint, and the
render round-trip — all offline, no addon. **The effect and the cast are not yet built.**

## The engine the play casts through (unchanged, play-agnostic)

- `src/engine/play.ts` — the `Play<I, O>` contract (six members: `name`, `render`, `parse`,
  `gates`, `effect`, `budget`, `card`), the `Card`/`GateVerdict`/`CastContext<I>`/`EffectResult`
  types, and the singleton `registry` (a `name → Play` map; `register` throws
  `DuplicatePlayError` on a dup name). `EffectResult = { ok; outcome?; detail?; artifacts? }`
  — the effect reports back as DATA, optionally RELABELLING the run outcome (e.g.
  `id-collision`) instead of throwing across the orchestration boundary.
- `src/engine/cast.ts` — `castPlay<I,O>(play, inputs, budget, opts)`: the single impure
  orchestrator. render → dispense (spawns `claude` under a wall-clock budget) → meter
  (`check`) → `play.parse` → `play.gates` → `classify` → on `materialize` call `play.effect`
  → `appendRunLog` exactly once (`play: play.name`, `epic: opts.subject`). `CastOptions =
  { subject (required, non-empty); projectRoot?; model?; runId?; transcriptDir?; runLogPath? }`.
  Returns `RunSummary = { runId; outcome; materialized }`. **Calls `play.parse` with no error
  channel** — a throwing parse would crash the cast (hence the catch in the shell).
- `src/engine/cast-core.ts` — `classify({ timedOut, budgetOutcome, gateVerdict }) → { outcome,
  materialize, gateLog }` (pure, first-match priority: timeout → budget → gate → success). The
  offline wiring oracle the effect test uses to show clear→materialize / stop→no-write.

## The exact pattern to mirror — `src/play/note.ts` (capture-note, T-007-04)

The ticket says: read `note.ts` and mirror it. The CaptureNote shell is the precise template:
- `PLAY = "capture-note"`; `captureNotePlay: Play<NoteInputs, Note>` collects the six members.
  `render` = `extractPromptText(b.request.CaptureNote(...))`; `parse` = `parseNote` (catches
  `b.parse` throw → `EMPTY_NOTE` so a garbage reply becomes a clean `gate-failed` andon, not a
  crash); `gates` = `(n) => clearNote(n)`; `effect` = `captureNoteEffect`; `budget` inlined
  (not imported from the shelf — that edge would cycle); `card` = Red sorcery common.
- `registry.register(captureNotePlay)` at module load (self-register). **No bun-test value-imports
  this module** (it loads the BAML addon) — its logic is the engine's tested core + the
  addon-free `note-core.ts` (which holds the gate AND the effect, tested via a real temp dir) +
  the bridge test.
- `assembleNoteInputs(opts)` — the IMPURE verb: builds a thin go-and-see snapshot (`srcFiles:
  []`, plus story/ticket ids via `listIdsIn`) with the EXPORTED `buildProjectSnapshot`.
- `castCaptureNote(opts)` — assembles inputs and calls `castPlay(captureNotePlay, …)`; the
  parallel of `runDecomposeEpic`, with `subject: opts.topic`.

`captureNoteEffect` (in `note-core.ts`, addon-free, impure: `mkdir`+`writeFile`) is the
precedent for where the world-touching verb lives so it is testable offline against a temp
projectRoot — **and is "the AC#3 demonstration"** (per T-007-04's review).

## Supporting modules

- `src/play/project-context.ts` (addon-free) — `buildProjectSnapshot(parts)` (PURE,
  deterministic), `listIdsIn(dir)` (lists `*.md` basenames; tolerates a missing dir → `[]`;
  EXPORTED), `CHARTER_PATH = "docs/knowledge/charter.md"`.
- `src/play/decompose-epic.ts` — the precedent for an effect that does a final cross-board
  collision guard at write time and RELABELS `id-collision` (catches `IdCollisionError` from
  `materialize`), the TOCTOU pattern. Also `assembleAndCast`/`runDecomposeEpic`.
- `src/play/dispatch.ts` — by-name dispatch over `registry`; today bound to the epic-shaped
  `RunOptions`, so `vend run <name>` is not generalized to heterogeneous inputs (note casts via
  `castCaptureNote`, not `runPlay`). The keystone does not require generalized dispatch.

## On-disk facts

- Existing epics live in `docs/active/epic/` (singular): `E-001.md … E-009.md` + `TEMPLATE.md`.
  So the next free id is `E-010`. `listIdsIn` returns `TEMPLATE` too; `nextEpicId`/`detectCollisions`
  ignore non-`E-\d+` ids harmlessly.
- `docs/knowledge/charter.md` exists (the real value function the bounds gate greps).
- `bun run check` = `baml:gen` → `tsc --noEmit` → `bun test`. The full suite is 303 pass / 0
  fail after T-009-02.

## Constraints & assumptions surfaced

1. **No bun-test may value-import a `b`-loading module.** The shell (render/parse call BAML
   in-process) must have no test value-import; the offline effect + cast proof must live in an
   addon-free module (the `note-core.ts` discipline).
2. **`Play.parse` must be total** for `castPlay` (no error channel) — the shell's `parse` must
   catch `b.parse.ProposeEpic`'s throw and coerce to an empty card → the value gate STOPs cleanly.
3. **The effect mints + writes under the project root**, must be id-disjoint, and writes only
   on a gate pass (`castPlay` only calls `effect` when `classify` says `materialize`).
4. **Pull-discipline (PE-1):** the cast takes ONE explicitly pulled signal — it must not iterate
   / auto-drain the demand board.
5. **No live model run is expected offline** (no API; would mutate the board). The AC's
   "live (or fixture-with-canned-reply) cast" is met offline by the effect test (a cleared card
   → a real `E-0XX.md` write) + the registration smoke + the upstream bridge test, exactly as
   capture-note's AC#3 was met.
6. **Dependency direction stays acyclic:** the play depends UP onto the engine; the budget is
   inlined, not imported from the shelf.
</content>
</invoke>
