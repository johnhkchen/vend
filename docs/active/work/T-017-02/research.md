# T-017-02 Research — register-survey-and-gesture

Descriptive map of what exists and where the Survey shell must plug in. T-017-01 (the pure
core) is **done**; this ticket wires it into a registered, castable play with a `vend survey`
gesture and a board-staging effect. Mirrors the ExpandFragment register/effect/gesture trio.

## What T-017-01 already shipped (the foundation to build on)

- `src/play/survey-core.ts` — PURE. `clear(board): GateVerdict` runs the three board gates in
  value-order (`honest-empty → read-never-invent → leverage-rank`), `renderBoard(board): string`
  renders one `demand.md` row per signal (reuses `renderSignalRow` from `expand-core.ts`), and
  `SURVEY_GATE_NAMES`. No fs/spawn/addon; `Board`/`Signal`/`SignalTier` imports are type-only.
  Crucially `clear` takes **no ctx** (the gates need no charter — leverage-rank reads only tier
  order), so the play's `gates` closure is `(board) => clear(board)`.
- `baml_src/survey.baml` — the `Board { signals Signal[] }` class + `Survey(project, charter) -> Board`
  function. Authoring-only; `ClaudeStub` client (render-only, never the transport).
- `src/baml/survey-bridge.ts` — the fifth child-process bridge (`b.request.Survey` / `b.parse.Survey`),
  used only by `survey.test.ts`.
- `src/play/survey-core.test.ts`, `src/baml/survey.test.ts` — pure-gate + offline-BAML pins. Green.

The whole `bun run check` is green at 528 tests (obs 21376).

## The pattern to mirror: ExpandFragment (E-016), one scale up

ExpandFragment is the direct sibling — one notch downstream (one fragment → one signal). Survey
reads the whole project → a ranked board. The three E-016 files map 1:1 to three Survey files:

| ExpandFragment (E-016) | Survey (E-017, this ticket) | Role |
|---|---|---|
| `expand-core.ts` (T-016-01) | `survey-core.ts` (T-017-01, **done**) | pure gates + renderer |
| `expand-effect.ts` (T-016-02) | `survey-effect.ts` (**to create**) | `Inputs` iface + staging effect |
| `expand-fragment.ts` (T-016-02) | `survey.ts` (**to create**) | BAML shell: parse, `Play`, register, cast |

### `src/play/expand-fragment.ts` — the shell to mirror

- `import { b } from "../../baml_client/sync_client.ts"` (loads the BAML addon → no `bun test`
  may value-import this module).
- `parseExpandFragment(text): Signal` — `try { b.parse.ExpandFragment(text) } catch { EMPTY_SIGNAL }`.
  The catch makes parse TOTAL so a garbage reply reaches the honest-empty gate as a clean andon
  rather than crashing `castPlay`.
- `expandFragmentPlay: Play<ExpandFragmentInputs, Signal>` — the six variation points:
  `render` (`extractPromptText(b.request.ExpandFragment(...))`), `parse`, `gates`
  (`clear(signal, {charter})`), `effect`, `budget` (inlined `{timeMs, tokens}`), `card`.
- `registry.register(expandFragmentPlay)` at module load (self-register).
- `ExpandFragmentOptions` + `assembleExpandFragmentInputs(opts)` (IMPURE: reads charter, lists
  story/ticket ids, builds the snapshot) + `castExpandFragment(opts)` → `castPlay(...)`.

### `src/play/expand-effect.ts` — the effect to mirror

- `STAGING_DIR = "docs/active/pm/staged"` (the PM desk's machine inbox — NEVER `demand.md`/board).
- `ExpandFragmentInputs { fragment; charter; project }` (the typed input threaded to render + ctx).
- `slugify(what)` (capped at 60 chars — the ENAMETOOLONG fix, obs 21332), `renderStagedSignal(signal)`
  (heading + demand table header + `renderSignalRow` + a `## Pull this` block with the exact
  `vend chain "<what> — <why>"` command + an origin trailer), and `expandFragmentEffect(signal, ctx)`
  — `mkdir -p` the staging dir, `writeFile` the rendered markdown, return `EffectResult`
  (`{ok, detail, artifacts:[path], produced:path}`).
- ADDON-FREE but impure (only fs). `Signal`/engine imports are type-only → testable in `bun test`.

## The engine seam (unchanged — Survey just plugs in)

- `src/engine/play.ts` — `Play<I,O>` (render/parse/gates/effect/budget/maxTurns?/card), `GateVerdict`
  (`clear|stop`, play-agnostic), `CastContext<I>` (`{inputs, projectRoot}`), `EffectResult`
  (`{ok, outcome?, detail?, artifacts?, produced?}`), `Card`, and the `registry` singleton.
  `survey-core`'s `clear` already returns a `GateVerdict` → drops into `Play.gates` with no adapter.
- `src/engine/cast.ts` — `castPlay(play, inputs, budget, opts): RunSummary`. The fixed spine:
  render → dispense (seam, wall-clock latch) → meter (`check`) → parse → gates → classify → on
  CLEAR run effect → `appendRunLog`. `CastOptions.subject` is REQUIRED non-empty (stamped on the
  run-log `epic` field). `RunSummary { runId, outcome, materialized, produced? }`.

## The gesture surface: `src/cli.ts`

- `parseArgs(argv): ParsedCommand` routes by `argv[0]`: `run|chain|expand|envelope|audit` each have
  a `parseXArgs`; the tail is `select|browse`. PURE — never imports a play/the addon (play names are
  validated at dispatch, not parse).
- `parseExpandArgs` is the closest template: positional tokens joined to one string + OPTIONAL
  `--budget`. **Survey differs:** it takes **no positional subject** — it surveys the whole project —
  so `vend survey [--budget <ms>,<tokens>]` is closer to a flags-only command (no "missing <x>" path).
- The `import.meta.main` dispatch has one arm per command. The `expand` arm (lines 421–432) is the
  template: lazy-import `castExpandFragment` + `expandFragmentPlay`, default the budget to the play's
  envelope, cast, print `run <id>: <outcome> (materialized: <bool>)`, exit 0/1. Lazy import keeps the
  addon off the pure-parse path.
- `USAGE` banner string lists each gesture — a `vend survey` line must be added.
- `src/cli.test.ts` — pins `parseArgs` for every command (pure). `parseExpandArgs` tests (lines
  148–172) are the template for the survey parse tests.

## The staging contract (`docs/active/pm/`)

- `docs/active/pm/README.md` — the PM desk: an **upstream, un-promoted** space. A play writes only
  here; it never edits `demand.md`/`epic/`/`stories/`/`tickets/` (those change only on a human pull).
  `docs/active/pm/staged/` is the machine-written inbox (distinct from the PM agent's hand-authored
  `proposed-batch.md`, so the two writers never collide).
- `docs/active/demand.md` — the board's **shape** the staged rows mirror: a signal is "what + why it
  might matter", tier = leverage (Keystone/High/Standard/Leaf), priced by envelope. The table header
  expand uses is `| Signal | Value | Budget (envelope) | Status |`.

## Constraints & assumptions surfaced

- **Purity discipline (load-bearing):** the gates + renderer live in `survey-core.ts` (no addon); the
  effect in `survey-effect.ts` (addon-free, fs-only — testable in `bun test`); only `survey.ts`
  value-imports `b`, so **no `bun test` file may value-import `survey.ts`**. The AC#3 end-to-end proof
  must therefore exercise the effect + clear→classify wiring directly (the `expand-effect.test.ts`
  shape), NOT by value-importing the BAML shell.
- **The HYBRID degrade (T-017-01 finding, obs 21370–21372):** `b.parse.Survey` DEGRADES an
  object-shaped garbage reply to `{signals: []}` (the all-array WorkPlan leniency) but THROWS on a
  bare unstructured string (Board's single array field cannot absorb a bare string). So `parseSurvey`
  **must wrap `b.parse.Survey` in try/catch** → empty board on throw, exactly as `parseExpandFragment`
  does. `survey.test.ts` already pins this and explicitly names T-017-02's catch closure as the fix.
- **Empty-board polarity (survey-core header):** an EMPTY board CLEARS (honest abstention) → the effect
  runs on a cleared empty board; a board padded with a BLANK filler signal STOPs (honest-empty andon)
  → effect never runs. The effect must render *something honest* for a cleared empty board.
- **Budget (ticket directive, E-016 finding obs 21333):** a project-scale read is heavier than expand,
  which itself under-shot (100k ceiling, 211k spent). Pre-fill `surveyPlay.budget` **generously** from
  the start, with a `// recalibrate from the log (E-013)` note — not a cold-start guess.
- **No `existingEpicIds` / id-minting:** Survey STAGES (like expand), it does not PROMOTE (like
  propose). The board has no DAG identity → idempotent overwrite-by-fixed-name, no id guard.
- **Subject for the run-log:** unlike expand (the fragment) / chain (the signal), survey has no
  positional subject — a synthesized subject (e.g. the project basename) must be supplied to satisfy
  `CastOptions.subject`'s non-empty assert.
